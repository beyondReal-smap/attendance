export type AttendanceType = '연차' | '체휴' | '근무' | '시차';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  isAdmin: boolean;
  createdAt: Date;
}

export interface Attendance {
  id: string;
  userId: string;
  date: Date;
  type: AttendanceType;
  createdAt: Date;
}

export interface Session {
  userId: string;
  username: string;
  name: string;
  isAdmin: boolean;
}

