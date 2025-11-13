import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 사용자 정보와 연차/체휴 정보 가져오기
  try {
    const currentYear = new Date().getFullYear();

    const userResult = await sql`
      SELECT
        id, username, name, role, is_admin
      FROM atnd_users
      WHERE id = ${session.userId}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 연차 정보 가져오기
    const annualLeaveResult = await sql`
      SELECT total, used, remaining
      FROM leave_balances
      WHERE user_id = ${session.userId}
      AND year = ${currentYear}
      AND leave_type = 'annual'
    `;

    // 체휴 정보 가져오기
    const compLeaveResult = await sql`
      SELECT total, used, remaining
      FROM leave_balances
      WHERE user_id = ${session.userId}
      AND year = ${currentYear}
      AND leave_type = 'compensatory'
    `;

    const user = userResult.rows[0];
    const annualLeave = annualLeaveResult.rows[0] || { total: 15, used: 0, remaining: 15 };
    const compLeave = compLeaveResult.rows[0] || { total: 0, used: 0, remaining: 0 };

    return NextResponse.json({
      userId: user.id.toString(),
      username: user.username,
      name: user.name,
      role: user.role,
      isAdmin: user.is_admin === 1 || user.role === 'admin',
      annualLeaveTotal: Number(annualLeave.total),
      annualLeaveUsed: Number(annualLeave.used),
      annualLeaveRemaining: Number(annualLeave.remaining),
      compLeaveTotal: Number(compLeave.total),
      compLeaveUsed: Number(compLeave.used),
      compLeaveRemaining: Number(compLeave.remaining),
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    return NextResponse.json(session);
  }
}

