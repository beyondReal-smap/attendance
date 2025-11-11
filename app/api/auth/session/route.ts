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
    const userResult = await sql`
      SELECT 
        id, username, name, is_admin,
        annual_leave_total, annual_leave_used,
        comp_leave_total, comp_leave_used
      FROM atnd_users
      WHERE id = ${session.userId}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];
    const annualLeaveTotal = Number(user.annual_leave_total) || 15;
    const annualLeaveUsed = Number(user.annual_leave_used) || 0;
    const compLeaveTotal = Number(user.comp_leave_total) || 0;
    const compLeaveUsed = Number(user.comp_leave_used) || 0;
    
    return NextResponse.json({
      userId: user.id.toString(),
      username: user.username,
      name: user.name,
      isAdmin: user.is_admin === 1,
      annualLeaveTotal,
      annualLeaveUsed,
      annualLeaveRemaining: annualLeaveTotal - annualLeaveUsed,
      compLeaveTotal,
      compLeaveUsed,
      compLeaveRemaining: compLeaveTotal - compLeaveUsed,
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    return NextResponse.json(session);
  }
}

