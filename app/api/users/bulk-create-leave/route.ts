import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, annualLeaveTotal, compLeaveTotal } = await request.json();

    if (!year || annualLeaveTotal === undefined || compLeaveTotal === undefined) {
      return NextResponse.json(
        { error: 'year, annualLeaveTotal, and compLeaveTotal are required' },
        { status: 400 }
      );
    }

    // 모든 사용자 조회
    const usersResult = await sql`SELECT id, username FROM atnd_users`;
    const users = usersResult.rows;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No users found' },
        { status: 400 }
      );
    }

    // 각 사용자에 대해 연차/체휴 생성 또는 업데이트
    const createdCount = { annual: 0, comp: 0 };
    const updatedCount = { annual: 0, comp: 0 };

    for (const user of users) {
      // 연차 처리
      const existingAnnualResult = await sql`
        SELECT id FROM leave_balances
        WHERE user_id = ${user.id} AND year = ${year} AND leave_type = 'annual'
      `;

      if (existingAnnualResult.rows.length === 0) {
        // 연차가 없으면 생성
        await sql`
          INSERT INTO leave_balances (user_id, year, leave_type, total, remaining, used)
          VALUES (${user.id}, ${year}, 'annual', ${annualLeaveTotal}, ${annualLeaveTotal}, 0)
        `;
        createdCount.annual++;
      } else {
        // 연차가 있으면 업데이트 (기존 사용량은 유지)
        const existing = existingAnnualResult.rows[0];
        await sql`
          UPDATE leave_balances
          SET total = ${annualLeaveTotal},
              remaining = ${annualLeaveTotal} - used
          WHERE id = ${existing.id}
        `;
        updatedCount.annual++;
      }

      // 체휴 처리
      const existingCompResult = await sql`
        SELECT id FROM leave_balances
        WHERE user_id = ${user.id} AND year = ${year} AND leave_type = 'compensatory'
      `;

      if (existingCompResult.rows.length === 0) {
        // 체휴가 없으면 생성
        await sql`
          INSERT INTO leave_balances (user_id, year, leave_type, total, remaining, used)
          VALUES (${user.id}, ${year}, 'compensatory', ${compLeaveTotal}, ${compLeaveTotal}, 0)
        `;
        createdCount.comp++;
      } else {
        // 체휴가 있으면 업데이트 (기존 사용량은 유지)
        const existing = existingCompResult.rows[0];
        await sql`
          UPDATE leave_balances
          SET total = ${compLeaveTotal},
              remaining = ${compLeaveTotal} - used
          WHERE id = ${existing.id}
        `;
        updatedCount.comp++;
      }
    }

    return NextResponse.json({
      success: true,
      year,
      totalUsers: users.length,
      annualLeaveTotal,
      compLeaveTotal,
      created: createdCount,
      updated: updatedCount,
      message: `${year}년 연차/체휴가 ${users.length}명의 사용자에게 일괄 생성/업데이트되었습니다.`
    });
  } catch (error: any) {
    console.error('Error bulk creating leave:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to bulk create leave' },
      { status: 500 }
    );
  }
}
