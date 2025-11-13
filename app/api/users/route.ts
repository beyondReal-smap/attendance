import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (!session.isAdmin && session.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // is_temp_password 컬럼 존재 여부 확인 및 추가 (한 번만 실행)
    try {
      // 먼저 컬럼이 존재하는지 확인
      const columnCheck = await sql`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'atnd_users'
        AND COLUMN_NAME = 'is_temp_password'
      `;

      // 컬럼이 존재하지 않으면 추가
      if (columnCheck.rows.length === 0) {
        await sql`ALTER TABLE atnd_users ADD COLUMN is_temp_password TINYINT(1) DEFAULT 0 COMMENT '임시비밀번호 여부'`;
      }
    } catch (e: any) {
      // 컬럼 추가 실패 시 로깅 (Duplicate 에러는 무시)
      if (!e.message?.includes('Duplicate column name') && !e.message?.includes('ER_DUP_FIELDNAME')) {
        console.error('Column add error:', e);
      }
    }

    const currentYear = new Date().getFullYear();

    const result = await sql`
      SELECT
        u.id,
        u.username,
        u.name,
        u.department,
        u.role,
        COALESCE(u.is_temp_password, 0) as "isTempPassword",
        COALESCE(annual.total, 15) as "annualLeaveTotal",
        COALESCE(annual.used, 0) as "annualLeaveUsed",
        COALESCE(annual.total - annual.used, 15) as "annualLeaveRemaining",
        COALESCE(comp.total, 0) as "compLeaveTotal",
        COALESCE(comp.used, 0) as "compLeaveUsed",
        COALESCE(comp.total - comp.used, 0) as "compLeaveRemaining"
      FROM atnd_users u
      LEFT JOIN leave_balances annual ON u.id = annual.user_id
        AND annual.year = ${currentYear}
        AND annual.leave_type = 'annual'
      LEFT JOIN leave_balances comp ON u.id = comp.user_id
        AND comp.year = ${currentYear}
        AND comp.leave_type = 'compensatory'
      ORDER BY u.name ASC
    `;

    const users = result.rows.map(row => ({
      id: row.id.toString(),
      username: row.username,
      name: row.name,
      department: row.department || '',
      role: row.role,
      isAdmin: row.role === 'admin',
      isTempPassword: Boolean(row.isTempPassword),
      annualLeaveTotal: Number(row.annualLeaveTotal),
      annualLeaveUsed: Number(row.annualLeaveUsed),
      annualLeaveRemaining: Number(row.annualLeaveRemaining),
      compLeaveTotal: Number(row.compLeaveTotal),
      compLeaveUsed: Number(row.compLeaveUsed),
      compLeaveRemaining: Number(row.compLeaveRemaining),
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username, name, password, department, role } = await request.json();

    if (!username || !name || !password) {
      return NextResponse.json({ error: 'username, name, password are required' }, { status: 400 });
    }

    // 사번 중복 체크
    const existingUser = await sql`
      SELECT id FROM atnd_users WHERE username = ${username}
    `;

    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: '이미 존재하는 사번입니다.' }, { status: 400 });
    }

    // 비밀번호 해시
    const hashedPassword = await hashPassword(password);

    // 사용자 추가 (임시 비밀번호로 설정)
    const isTempPassword = /^\d{4}$/.test(password) ? 1 : 0;

    // 사용자 추가
    const result = await sql`
      INSERT INTO atnd_users (username, name, department, password, role, is_temp_password)
      VALUES (${username}, ${name}, ${department || null}, ${hashedPassword}, ${role || 'user'}, ${isTempPassword})
    `;

    // 새로 추가된 사용자의 ID 가져오기
    const userIdResult = await sql`
      SELECT id FROM atnd_users WHERE username = ${username}
    `;
    const newUserId = userIdResult.rows[0].id;

    // 현재 년도에 연차/체휴 초기 데이터 생성
    const currentYear = new Date().getFullYear();
    await sql`
      INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
      VALUES
        (${newUserId}, ${currentYear}, 'annual', 15, 0, 15),
        (${newUserId}, ${currentYear}, 'compensatory', 0, 0, 0)
    `;

    const newUser = {
      id: newUserId,
      username,
      name,
      department: department || null,
      role: role || 'user'
    };

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id.toString(),
        username: newUser.username,
        name: newUser.name,
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, annualLeaveTotal, compLeaveTotal, newPassword } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 비밀번호 변경인 경우
    if (newPassword) {
      const hashedPassword = await hashPassword(newPassword);
      try {
        await sql`
          UPDATE atnd_users
          SET password = ${hashedPassword}, is_temp_password = 0
          WHERE id = ${userId}
        `;
      } catch (e: any) {
        // is_temp_password 컬럼이 없는 경우
        if (e.message?.includes('Unknown column')) {
          await sql`
            UPDATE atnd_users
            SET password = ${hashedPassword}
            WHERE id = ${userId}
          `;
        } else {
          throw e;
        }
      }
      return NextResponse.json({ success: true, message: '비밀번호가 변경되었습니다.' });
    }

    // 연차/체휴 설정 변경인 경우
    const currentYear = new Date().getFullYear();

    // 연차 업데이트
    if (annualLeaveTotal !== undefined) {
      const existingAnnual = await sql`
        SELECT id, used FROM leave_balances
        WHERE user_id = ${userId} AND year = ${currentYear} AND leave_type = 'annual'
      `;

      if (existingAnnual.rows.length > 0) {
        // 기존 데이터 업데이트
        await sql`
          UPDATE leave_balances
          SET total = ${annualLeaveTotal}, remaining = ${annualLeaveTotal} - used
          WHERE id = ${existingAnnual.rows[0].id}
        `;
      } else {
        // 새 데이터 생성
        await sql`
          INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
          VALUES (${userId}, ${currentYear}, 'annual', ${annualLeaveTotal}, 0, ${annualLeaveTotal})
        `;
      }
    }

    // 체휴 업데이트
    if (compLeaveTotal !== undefined) {
      const existingComp = await sql`
        SELECT id, used FROM leave_balances
        WHERE user_id = ${userId} AND year = ${currentYear} AND leave_type = 'compensatory'
      `;

      if (existingComp.rows.length > 0) {
        // 기존 데이터 업데이트
        await sql`
          UPDATE leave_balances
          SET total = ${compLeaveTotal}, remaining = ${compLeaveTotal} - used
          WHERE id = ${existingComp.rows[0].id}
        `;
      } else {
        // 새 데이터 생성
        await sql`
          INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
          VALUES (${userId}, ${currentYear}, 'compensatory', ${compLeaveTotal}, 0, ${compLeaveTotal})
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 사용자 삭제 전에 해당 사용자의 근태 기록도 삭제
    await sql`DELETE FROM atnd_attendance WHERE user_id = ${userId}`;

    // 사용자 삭제
    await sql`DELETE FROM atnd_users WHERE id = ${userId}`;

    return NextResponse.json({ success: true, message: '사용자가 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

