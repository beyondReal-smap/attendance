import { AttendanceType } from '@/types';

// 근태 유형별 시간 정보
export const ATTENDANCE_TIME_INFO: Record<string, { startTime: string; endTime: string; days: number }> = {
  '연차': { startTime: '09:00', endTime: '18:00', days: 1 },
  '체휴': { startTime: '09:00', endTime: '18:00', days: 1 },
  '근무': { startTime: '09:00', endTime: '18:00', days: 1 },
  '오전반차': { startTime: '09:00', endTime: '14:00', days: 0.5 },
  '오후반차': { startTime: '14:00', endTime: '18:00', days: 0.5 },
  '반반차': { startTime: '09:00', endTime: '11:00', days: 0.25 },
  '오전반반차A': { startTime: '09:00', endTime: '11:00', days: 0.25 },
  '오전반반차B': { startTime: '11:00', endTime: '14:00', days: 0.25 },
  '오후반반차A': { startTime: '14:00', endTime: '16:00', days: 0.25 },
  '오후반반차B': { startTime: '16:00', endTime: '18:00', days: 0.25 },
};

// 근태 유형에 따른 시간 정보 가져오기
export function getAttendanceTimeInfo(type: AttendanceType) {
  return ATTENDANCE_TIME_INFO[type] || { startTime: '', endTime: '', days: 0 };
}

// 근태 유형이 연차/체휴 계열인지 확인
export function isLeaveType(type: AttendanceType): boolean {
  return ['연차', '체휴', '오전반차', '오후반차', '반반차', '오전반반차A', '오전반반차B', '오후반반차A', '오후반반차B'].includes(type);
}

// 근태 유형별 사용 일수 계산
export function getLeaveUsage(type: AttendanceType): number {
  const info = getAttendanceTimeInfo(type);
  return info.days;
}

// 근태 유형이 연차 계열인지 확인 (체휴 제외)
export function isAnnualLeaveType(type: AttendanceType): boolean {
  return ['연차', '오전반차', '오후반차', '반반차', '오전반반차A', '오전반반차B', '오후반반차A', '오후반반차B'].includes(type);
}

