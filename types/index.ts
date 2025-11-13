export type AttendanceType = '연차' | '체휴' | '근무' | '오전반차' | '오후반차' | '반반차' | '팀장대행' | '코칭' | '교육' | '휴식' | '출장' | '장애' | '기타' | '연장근무' | '결근';

export type LeaveType = 'annual' | 'compensatory';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  isAdmin: boolean;
  createdAt: Date;
}

export interface LeaveBalance {
  id: string;
  userId: string;
  year: number;
  leaveType: LeaveType;
  total: number;
  used: number;
  remaining: number;
  createdAt: Date;
  updatedAt: Date;
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
  department?: string;
  isAdmin: boolean;
  role: 'user' | 'manager' | 'admin';
}

