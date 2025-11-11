import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sql`
      SELECT 
        id, 
        username, 
        name, 
        is_admin as "isAdmin",
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
    const result = await sql`
      INSERT INTO atnd_users (username, name, password, annual_leave_total, comp_leave_total)
      VALUES (${username}, ${name}, ${hashedPassword}, 15, 0)
      RETURNING id, username, name
    `;

    // 임시 비밀번호 플래그 설정 (비밀번호가 4자리 숫자인 경우)
    if (/^\d{4}$/.test(password)) {
      // is_temp_password 필드가 있다면 업데이트 (현재 스키마에는 없으므로 주석 처리)
      // await sql`UPDATE atnd_users SET is_temp_password = 1 WHERE id = ${result.rows[0].id}`;
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

    const { userId, annualLeaveTotal, compLeaveTotal } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

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

