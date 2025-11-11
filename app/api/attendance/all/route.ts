import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getSession } from '@/lib/auth';
import { AttendanceType } from '@/types';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sql`
      SELECT 
        a.id,
        a.user_id as "userId",
        u.name as "userName",
        a.date,
        a.type
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.date DESC, u.name ASC
    `;

    const attendances = result.rows.map(row => ({
      id: row.id.toString(),
      userId: row.userId.toString(),
      userName: row.userName,
      date: row.date.toISOString().split('T')[0],
      type: row.type as AttendanceType,
    }));

    return NextResponse.json(attendances);
  } catch (error) {
    console.error('Error fetching all attendance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}

