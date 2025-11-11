import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getSession } from '@/lib/auth';
import { AttendanceType } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    const result = await sql`
      SELECT date, type
      FROM attendance
      WHERE user_id = ${session.userId}
        AND EXTRACT(YEAR FROM date) = ${year}
        AND EXTRACT(MONTH FROM date) = ${month}
      ORDER BY date ASC
    `;

    const attendances = result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      type: row.type as AttendanceType,
    }));

    return NextResponse.json(attendances);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, date, type } = await request.json();

    if (!userId || !date || !type) {
      return NextResponse.json(
        { error: 'userId, date, and type are required' },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO attendance (user_id, date, type)
      VALUES (${userId}, ${date}, ${type})
      ON CONFLICT (user_id, date) DO UPDATE SET type = ${type}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error creating attendance:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '해당 날짜에 이미 근태가 등록되어 있습니다.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create attendance' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await sql`DELETE FROM attendance WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json(
      { error: 'Failed to delete attendance' },
      { status: 500 }
    );
  }
}

