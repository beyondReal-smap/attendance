export type AttendanceType = '연차' | '체휴' | '근무' | '시차' | '오전반차' | '오후반차' | '오전반반차A' | '오전반반차B' | '오후반반차A' | '오후반반차B';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  isAdmin: boolean;
  annualLeaveTotal: number;
  annualLeaveUsed: number;
  compLeaveTotal: number;
  compLeaveUsed: number;
  createdAt: Date;
}

export interface Attendance {
  id: string;
  userId: string;
  date: Date;
  type: AttendanceType;
  reason?: string;
  startTime?: string;
  endTime?: string;
  createdAt: Date;
}

export interface Session {
  userId: string;
  username: string;
  name: string;
  isAdmin: boolean;
}

