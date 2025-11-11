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
    if (!session || !session.isAdmin) {
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
    if (isAnnualLeaveType(type) && totalLeaveUsage > 0) {
      const userResult = await sql`
        SELECT annual_leave_total, annual_leave_used, comp_leave_total, comp_leave_used
        FROM atnd_users
        WHERE id = ${userId}
      `;
      
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = userResult.rows[0];
      const remaining = user.annual_leave_total - user.annual_leave_used;
      if (remaining < totalLeaveUsage) {
        return NextResponse.json(
          { error: `연차가 부족합니다. (잔여: ${remaining}일, 필요: ${totalLeaveUsage}일)` },
          { status: 400 }
        );
      }
    } else if (type === '체휴' && totalLeaveUsage > 0) {
      const userResult = await sql`
        SELECT annual_leave_total, annual_leave_used, comp_leave_total, comp_leave_used
        FROM atnd_users
        WHERE id = ${userId}
      `;
      
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = userResult.rows[0];
      const remaining = user.comp_leave_total - user.comp_leave_used;
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
      if (isAnnualLeaveType(type)) {
        await sql`
          UPDATE atnd_users
          SET annual_leave_used = annual_leave_used + ${totalLeaveUsage}
          WHERE id = ${userId}
        `;
      } else if (type === '체휴') {
        await sql`
          UPDATE atnd_users
          SET comp_leave_used = comp_leave_used + ${totalLeaveUsage}
          WHERE id = ${userId}
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

