import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AttendanceType } from '@/types';
import dayjs from 'dayjs';
import { getDateRange, isWorkingDay } from '@/lib/holidays';
import { getAttendanceTimeInfo, getLeaveUsage, isLeaveType, isAnnualLeaveType } from '@/lib/attendance-utils';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (!session.isAdmin && session.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, startDate, endDate, type, reason, startTime, endTime } = await request.json();

    if (!userId || !startDate || !endDate || !type) {
      return NextResponse.json(
        { error: 'userId, startDate, endDate, and type are required' },
        { status: 400 }
      );
    }

    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const dateRange = getDateRange(start, end);
    const workingDays = dateRange.filter(d => isWorkingDay(d));
    
    // 시간 정보 가져오기 (시차가 아닌 경우 자동 설정)
    const timeInfo = getAttendanceTimeInfo(type);
    const finalStartTime = startTime || timeInfo.startTime;
    const finalEndTime = endTime || timeInfo.endTime;

    // 기존 근태 확인 - 같은 날짜에 이미 등록된 근태가 있는지 확인
    const leaveUsage = getLeaveUsage(type);
    let totalLeaveUsage = 0;
    
    for (const date of workingDays) {
      const dateStr = date.format('YYYY-MM-DD');
      const existingResult = await sql`
        SELECT id, type FROM atnd_attendance
        WHERE user_id = ${userId} AND date = ${dateStr}
      `;
      
      // 같은 날짜에 이미 근태가 있으면 에러
      if (existingResult.rows.length > 0) {
        return NextResponse.json(
          { error: `${dateStr}에 이미 근태가 등록되어 있습니다. 기존 근태를 삭제한 후 다시 등록해주세요.` },
          { status: 400 }
        );
      }
      
      if (isLeaveType(type) && isWorkingDay(date)) {
        totalLeaveUsage += leaveUsage;
      }
    }

    // 연차/체휴인 경우 사용량 확인
    const currentYear = new Date().getFullYear();

    if (isAnnualLeaveType(type) && totalLeaveUsage > 0) {
      const leaveResult = await sql`
        SELECT remaining
        FROM leave_balances
        WHERE user_id = ${userId}
        AND year = ${currentYear}
        AND leave_type = 'annual'
      `;

      const remaining = leaveResult.rows.length > 0 ? Number(leaveResult.rows[0].remaining) : 15;
      if (remaining < totalLeaveUsage) {
        return NextResponse.json(
          { error: `연차가 부족합니다. (잔여: ${remaining}일, 필요: ${totalLeaveUsage}일)` },
          { status: 400 }
        );
      }
    } else if (type === '체휴' && totalLeaveUsage > 0) {
      const leaveResult = await sql`
        SELECT remaining
        FROM leave_balances
        WHERE user_id = ${userId}
        AND year = ${currentYear}
        AND leave_type = 'compensatory'
      `;

      const remaining = leaveResult.rows.length > 0 ? Number(leaveResult.rows[0].remaining) : 0;
      if (remaining < totalLeaveUsage) {
        return NextResponse.json(
          { error: `체휴가 부족합니다. (잔여: ${remaining}일, 필요: ${totalLeaveUsage}일)` },
          { status: 400 }
        );
      }
    }

    // 기간 내 모든 날짜에 근태 등록
    for (const date of workingDays) {
      const dateStr = date.format('YYYY-MM-DD');
      
      await sql`
        INSERT INTO atnd_attendance (user_id, date, type, reason, start_time, end_time)
        VALUES (${userId}, ${dateStr}, ${type}, ${reason || null}, ${finalStartTime || null}, ${finalEndTime || null})
      `;
    }

    // 연차/체휴 사용량 업데이트
    if (totalLeaveUsage > 0) {
      const currentYear = new Date().getFullYear();

      if (isAnnualLeaveType(type)) {
        await sql`
          UPDATE leave_balances
          SET used = used + ${totalLeaveUsage},
              remaining = remaining - ${totalLeaveUsage}
          WHERE user_id = ${userId}
          AND year = ${currentYear}
          AND leave_type = 'annual'
        `;
      } else if (type === '체휴') {
        await sql`
          UPDATE leave_balances
          SET used = used + ${totalLeaveUsage},
              remaining = remaining - ${totalLeaveUsage}
          WHERE user_id = ${userId}
          AND year = ${currentYear}
          AND leave_type = 'compensatory'
        `;
      }
    }

    return NextResponse.json({ 
      success: true, 
      days: workingDays.length,
      leaveUsage: totalLeaveUsage,
      dates: workingDays.map(d => d.format('YYYY-MM-DD'))
    });
  } catch (error: any) {
    console.error('Error creating attendance:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: '해당 날짜에 이미 근태가 등록되어 있습니다.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create attendance' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (!session.isAdmin && session.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, date, type, reason, startTime, endTime } = await request.json();

    if (!id || !date || !type) {
      return NextResponse.json(
        { error: 'id, date, and type are required' },
        { status: 400 }
      );
    }

    // 기존 근태 정보 조회
    const existingResult = await sql`
      SELECT user_id, date, type, start_time, end_time
      FROM atnd_attendance
      WHERE id = ${id}
    `;

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { error: '근태 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const existing = existingResult.rows[0];
    const userId = existing.user_id;
    const oldDate = existing.date;
    const oldType = existing.type;

    // 날짜가 변경되었고, 새로운 날짜에 이미 근태가 있는지 확인
    if (date !== oldDate) {
      const duplicateCheck = await sql`
        SELECT id FROM atnd_attendance
        WHERE user_id = ${userId} AND date = ${date} AND id != ${id}
      `;

      if (duplicateCheck.rows.length > 0) {
        return NextResponse.json(
          { error: `${date}에 이미 근태가 등록되어 있습니다.` },
          { status: 400 }
        );
      }
    }

    // 시간 정보 가져오기
    const timeInfo = getAttendanceTimeInfo(type);
    const finalStartTime = startTime || timeInfo.startTime;
    const finalEndTime = endTime || timeInfo.endTime;

    // 근태 정보 업데이트
    await sql`
      UPDATE atnd_attendance
      SET date = ${date}, type = ${type}, reason = ${reason || null},
          start_time = ${finalStartTime || null}, end_time = ${finalEndTime || null}
      WHERE id = ${id}
    `;

    // 연차/체휴 사용량 업데이트 (날짜나 유형이 변경된 경우)
    if ((date !== oldDate || type !== oldType) && (isLeaveType(oldType) || isLeaveType(type))) {
      const currentYear = new Date().getFullYear();

      // 기존 사용량 차감
      if (isLeaveType(oldType) && isWorkingDay(dayjs(oldDate))) {
        const oldLeaveUsage = getLeaveUsage(oldType);
        if (isAnnualLeaveType(oldType)) {
          await sql`
            UPDATE leave_balances
            SET used = used - ${oldLeaveUsage},
                remaining = remaining + ${oldLeaveUsage}
            WHERE user_id = ${userId}
            AND year = ${currentYear}
            AND leave_type = 'annual'
          `;
        } else if (oldType === '체휴') {
          await sql`
            UPDATE leave_balances
            SET used = used - ${oldLeaveUsage},
                remaining = remaining + ${oldLeaveUsage}
            WHERE user_id = ${userId}
            AND year = ${currentYear}
            AND leave_type = 'compensatory'
          `;
        }
      }

      // 새로운 사용량 추가
      if (isLeaveType(type) && isWorkingDay(dayjs(date))) {
        const newLeaveUsage = getLeaveUsage(type);
        if (isAnnualLeaveType(type)) {
          await sql`
            UPDATE leave_balances
            SET used = used + ${newLeaveUsage},
                remaining = remaining - ${newLeaveUsage}
            WHERE user_id = ${userId}
            AND year = ${currentYear}
            AND leave_type = 'annual'
          `;
        } else if (type === '체휴') {
          await sql`
            UPDATE leave_balances
            SET used = used + ${newLeaveUsage},
                remaining = remaining + ${newLeaveUsage}
            WHERE user_id = ${userId}
            AND year = ${currentYear}
            AND leave_type = 'compensatory'
          `;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '근태가 성공적으로 수정되었습니다.'
    });
  } catch (error: any) {
    console.error('Error updating attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update attendance' },
      { status: 500 }
    );
  }
}

