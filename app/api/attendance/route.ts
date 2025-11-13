import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AttendanceType } from '@/types';
import dayjs from 'dayjs';
import { getDateRange, isWorkingDay } from '@/lib/holidays';
import { getAttendanceTimeInfo, getLeaveUsage, isLeaveType, isAnnualLeaveType } from '@/lib/attendance-utils';

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
      SELECT date, type, reason, start_time, end_time
      FROM atnd_attendance
      WHERE user_id = ${session.userId}
        AND YEAR(date) = ${year}
        AND MONTH(date) = ${month}
      ORDER BY date ASC
    `;

    const attendances = result.rows.map(row => ({
      date: dayjs(row.date).format('YYYY-MM-DD'),
      type: row.type as AttendanceType,
      reason: row.reason || null,
      startTime: row.start_time || null,
      endTime: row.end_time || null,
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { startDate, endDate, type, reason, startTime, endTime } = await request.json();

    if (!startDate || !endDate || !type) {
      return NextResponse.json(
        { error: 'startDate, endDate, and type are required' },
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

    // 기존 근태 확인 - 시간대 겹침 체크
    const leaveUsage = getLeaveUsage(type);
    let totalLeaveUsage = 0;

    for (const date of workingDays) {
      const dateStr = date.format('YYYY-MM-DD');
      const existingResult = await sql`
        SELECT id, type, start_time, end_time FROM atnd_attendance
        WHERE user_id = ${session.userId} AND date = ${dateStr}
      `;

      // 시간 겹침 체크 (시간 정보가 있는 근태들만)
      if (finalStartTime && finalEndTime) {
        const newStart = new Date(`2000-01-01T${finalStartTime}`);
        const newEnd = new Date(`2000-01-01T${finalEndTime}`);

        for (const existing of existingResult.rows) {
          if (existing.start_time && existing.end_time) {
            const existingStart = new Date(`2000-01-01T${existing.start_time}`);
            const existingEnd = new Date(`2000-01-01T${existing.end_time}`);

            // 시간대가 겹치는지 확인 (끝시간이 시작시간과 같거나, 시작시간이 끝시간과 같으면 겹치지 않음으로 처리)
            if (newStart < existingEnd && newEnd > existingStart) {
              // 겹치는 근태가 있으면 시간 정보를 포맷해서 에러 반환
              const formatTimeDisplay = (timeString: string): string => {
                if (!timeString) return '';
                const [hour, minute] = timeString.split(':').map(Number);
                const hour12 = hour > 12 ? hour - 12 : hour;
                const period = hour >= 12 ? '오후' : '오전';
                if (minute === 0) {
                  return `${period} ${hour12}시`;
                } else {
                  return `${period} ${hour12}시 ${minute}분`;
                }
              };

              const timeInfo = `${formatTimeDisplay(existing.start_time)} ~ ${formatTimeDisplay(existing.end_time)}`;
              return NextResponse.json(
                { error: `${dateStr}에 선택한 시간대와 겹치는 '${existing.type}' 근태가 이미 등록되어 있습니다.\n시간대: ${timeInfo}` },
                { status: 400 }
              );
            }
          }
        }
      } else {
        // 시간 정보가 없는 근태의 경우, 같은 날짜에 이미 등록된 근태가 있으면 에러
        if (existingResult.rows.length > 0) {
          return NextResponse.json(
            { error: `${dateStr}에 이미 근태가 등록되어 있습니다. 기존 근태를 삭제한 후 다시 등록해주세요.` },
            { status: 400 }
          );
        }
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
        WHERE user_id = ${session.userId}
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
        WHERE user_id = ${session.userId}
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
        VALUES (${session.userId}, ${dateStr}, ${type}, ${reason || null}, ${finalStartTime || null}, ${finalEndTime || null})
      `;
    }

    // 연차/체휴 사용량 업데이트
    if (totalLeaveUsage > 0) {
      const currentYear = new Date().getFullYear();

      if (isAnnualLeaveType(type)) {
        // leave_balances 데이터 확인 및 생성
        let existingData = await sql`
          SELECT used, remaining FROM leave_balances
          WHERE user_id = ${session.userId}
          AND year = ${currentYear}
          AND leave_type = 'annual'
        `;

        // 데이터가 없으면 생성
        if (existingData.rows.length === 0) {
          await sql`
            INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
            VALUES (${session.userId}, ${currentYear}, 'annual', 15, 0, 15)
          `;
          existingData = await sql`
            SELECT used, remaining FROM leave_balances
            WHERE user_id = ${session.userId}
            AND year = ${currentYear}
            AND leave_type = 'annual'
          `;
        }

        // 사용량 업데이트
        await sql`
          UPDATE leave_balances
          SET used = used + ${totalLeaveUsage},
              remaining = remaining - ${totalLeaveUsage}
          WHERE user_id = ${session.userId}
          AND year = ${currentYear}
          AND leave_type = 'annual'
        `;

      } else if (type === '체휴') {
        // leave_balances 데이터 확인 및 생성
        let existingData = await sql`
          SELECT used, remaining FROM leave_balances
          WHERE user_id = ${session.userId}
          AND year = ${currentYear}
          AND leave_type = 'compensatory'
        `;

        // 데이터가 없으면 생성
        if (existingData.rows.length === 0) {
          await sql`
            INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
            VALUES (${session.userId}, ${currentYear}, 'compensatory', 0, 0, 0)
          `;
          existingData = await sql`
            SELECT used, remaining FROM leave_balances
            WHERE user_id = ${session.userId}
            AND year = ${currentYear}
            AND leave_type = 'compensatory'
          `;
        }

        // 사용량 업데이트
        await sql`
          UPDATE leave_balances
          SET used = used + ${totalLeaveUsage},
              remaining = remaining - ${totalLeaveUsage}
          WHERE user_id = ${session.userId}
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

    // 삭제 전 근태 정보 확인
    const attendanceResult = await sql`
      SELECT user_id, date, type
      FROM atnd_attendance
      WHERE id = ${id}
    `;

    if (attendanceResult.rows.length === 0) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 });
    }

    const attendance = attendanceResult.rows[0];
    const date = dayjs(attendance.date);
    const attendanceType = attendance.type as AttendanceType;
    
    // 먼저 근태 삭제
    await sql`DELETE FROM atnd_attendance WHERE id = ${id}`;
    
    // 연차/체휴인 경우 사용량 차감 (삭제 후 처리)
    if (isLeaveType(attendanceType) && isWorkingDay(date)) {
      const leaveUsage = getLeaveUsage(attendanceType);
      const currentYear = new Date().getFullYear();

      if (isAnnualLeaveType(attendanceType)) {
        await sql`
          UPDATE leave_balances
          SET used = GREATEST(0, used - ${leaveUsage}),
              remaining = remaining + ${leaveUsage}
          WHERE user_id = ${attendance.user_id}
          AND year = ${currentYear}
          AND leave_type = 'annual'
        `;
      } else if (attendanceType === '체휴') {
        await sql`
          UPDATE leave_balances
          SET used = GREATEST(0, used - ${leaveUsage}),
              remaining = remaining + ${leaveUsage}
          WHERE user_id = ${attendance.user_id}
          AND year = ${currentYear}
          AND leave_type = 'compensatory'
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json(
      { error: 'Failed to delete attendance' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, type, reason, startTime, endTime } = await request.json();

    if (!id || !type) {
      return NextResponse.json(
        { error: 'id and type are required' },
        { status: 400 }
      );
    }

    // 기존 근태 정보 확인
    const existingResult = await sql`
      SELECT user_id, date, type
      FROM atnd_attendance
      WHERE id = ${id}
    `;

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 });
    }

    const existing = existingResult.rows[0];
    const date = dayjs(existing.date);
    const oldType = existing.type as AttendanceType;
    const newType = type as AttendanceType;

    // 시간 정보 가져오기
    const timeInfo = getAttendanceTimeInfo(newType);
    const finalStartTime = startTime || timeInfo.startTime;
    const finalEndTime = endTime || timeInfo.endTime;

    // 타입이 변경된 경우에만 사용량 업데이트
    if (oldType !== newType) {
      const isWorking = isWorkingDay(date);
      const currentYear = new Date().getFullYear();

      // 기존 타입의 사용량 차감
      if (isLeaveType(oldType) && isWorking) {
        const oldUsage = getLeaveUsage(oldType);

        if (isAnnualLeaveType(oldType)) {
          await sql`
            UPDATE leave_balances
            SET used = GREATEST(0, used - ${oldUsage}),
                remaining = remaining + ${oldUsage}
            WHERE user_id = ${existing.user_id}
            AND year = ${currentYear}
            AND leave_type = 'annual'
          `;
        } else if (oldType === '체휴') {
          await sql`
            UPDATE leave_balances
            SET used = GREATEST(0, used - ${oldUsage}),
                remaining = remaining + ${oldUsage}
            WHERE user_id = ${existing.user_id}
            AND year = ${currentYear}
            AND leave_type = 'compensatory'
          `;
        }
      }

      // 새 타입의 사용량 추가
      if (isLeaveType(newType) && isWorking) {
        const newUsage = getLeaveUsage(newType);

        // 사용 가능 여부 확인 및 데이터 생성
        if (isAnnualLeaveType(newType)) {
          // leave_balances 데이터 확인
          let leaveResult = await sql`
            SELECT remaining
            FROM leave_balances
            WHERE user_id = ${existing.user_id}
            AND year = ${currentYear}
            AND leave_type = 'annual'
          `;

          // 데이터가 없으면 생성
          if (leaveResult.rows.length === 0) {
            await sql`
              INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
              VALUES (${existing.user_id}, ${currentYear}, 'annual', 15, 0, 15)
            `;
            leaveResult = await sql`
              SELECT remaining
              FROM leave_balances
              WHERE user_id = ${existing.user_id}
              AND year = ${currentYear}
              AND leave_type = 'annual'
            `;
          }

          const remaining = Number(leaveResult.rows[0].remaining);
          if (remaining < newUsage) {
            return NextResponse.json(
              { error: `연차가 부족합니다. (잔여: ${remaining}일, 필요: ${newUsage}일)` },
              { status: 400 }
            );
          }

          await sql`
            UPDATE leave_balances
            SET used = used + ${newUsage},
                remaining = remaining - ${newUsage}
            WHERE user_id = ${existing.user_id}
            AND year = ${currentYear}
            AND leave_type = 'annual'
          `;
        } else if (newType === '체휴') {
          // leave_balances 데이터 확인
          let leaveResult = await sql`
            SELECT remaining
            FROM leave_balances
            WHERE user_id = ${existing.user_id}
            AND year = ${currentYear}
            AND leave_type = 'compensatory'
          `;

          // 데이터가 없으면 생성
          if (leaveResult.rows.length === 0) {
            await sql`
              INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
              VALUES (${existing.user_id}, ${currentYear}, 'compensatory', 0, 0, 0)
            `;
            leaveResult = await sql`
              SELECT remaining
              FROM leave_balances
              WHERE user_id = ${existing.user_id}
              AND year = ${currentYear}
              AND leave_type = 'compensatory'
            `;
          }

          const remaining = Number(leaveResult.rows[0].remaining);
          if (remaining < newUsage) {
            return NextResponse.json(
              { error: `체휴가 부족합니다. (잔여: ${remaining}일, 필요: ${newUsage}일)` },
              { status: 400 }
            );
          }

          await sql`
            UPDATE leave_balances
            SET used = used + ${newUsage},
                remaining = remaining - ${newUsage}
            WHERE user_id = ${existing.user_id}
            AND year = ${currentYear}
            AND leave_type = 'compensatory'
          `;
        }
      }
    }

    // 근태 정보 업데이트
    await sql`
      UPDATE atnd_attendance
      SET type = ${newType}, reason = ${reason || null}, start_time = ${finalStartTime || null}, end_time = ${finalEndTime || null}
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    );
  }
}
