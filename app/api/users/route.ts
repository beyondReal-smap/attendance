import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

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

