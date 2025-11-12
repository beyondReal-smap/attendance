import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
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

    const result = await sql`
      SELECT
        id,
        username,
        name,
        is_admin as "isAdmin",
        COALESCE(is_temp_password, 0) as "isTempPassword",
        annual_leave_total as "annualLeaveTotal",
        annual_leave_used as "annualLeaveUsed",
        comp_leave_total as "compLeaveTotal",
        comp_leave_used as "compLeaveUsed"
      FROM atnd_users
      ORDER BY name ASC
    `;

    const users = result.rows.map(row => {
      const annualLeaveTotal = Number(row.annualLeaveTotal) || 15;
      const annualLeaveUsed = Number(row.annualLeaveUsed) || 0;
      const compLeaveTotal = Number(row.compLeaveTotal) || 0;
      const compLeaveUsed = Number(row.compLeaveUsed) || 0;

      return {
        id: row.id.toString(),
        username: row.username,
        name: row.name,
        isAdmin: row.isAdmin === 1,
        isTempPassword: row.isTempPassword === 1,
        annualLeaveTotal,
        annualLeaveUsed,
        annualLeaveRemaining: annualLeaveTotal - annualLeaveUsed,
        compLeaveTotal,
        compLeaveUsed,
        compLeaveRemaining: compLeaveTotal - compLeaveUsed,
      };
    });

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

    const { username, name, password } = await request.json();

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

    // is_temp_password 컬럼이 있는지 확인 후 INSERT
    let result;
    try {
      result = await sql`
        INSERT INTO atnd_users (username, name, password, is_temp_password, annual_leave_total, comp_leave_total)
        VALUES (${username}, ${name}, ${hashedPassword}, ${isTempPassword}, 15, 0)
        RETURNING id, username, name
      `;
    } catch (e: any) {
      // is_temp_password 컬럼이 없는 경우
      if (e.message?.includes('Unknown column')) {
        result = await sql`
          INSERT INTO atnd_users (username, name, password, annual_leave_total, comp_leave_total)
          VALUES (${username}, ${name}, ${hashedPassword}, 15, 0)
          RETURNING id, username, name
        `;
      } else {
        throw e;
      }
    }

    const newUser = result.rows[0];

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
    await sql`
      UPDATE atnd_users
      SET
        annual_leave_total = ${annualLeaveTotal ?? null},
        comp_leave_total = ${compLeaveTotal ?? null}
      WHERE id = ${userId}
    `;

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

