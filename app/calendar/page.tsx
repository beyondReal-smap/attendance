'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { AttendanceType } from '@/types';

interface Attendance {
  date: string;
  type: AttendanceType;
}

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    fetchUserAndAttendances();
  }, [currentDate]);

  const fetchUserAndAttendances = async () => {
    try {
      const userRes = await fetch('/api/auth/session');
      if (!userRes.ok) {
        router.push('/login');
        return;
      }
      const userData = await userRes.json();
      setUser(userData);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const res = await fetch(`/api/attendance?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setAttendances(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getAttendanceForDate = (date: Date): AttendanceType | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const attendance = attendances.find(a => a.date === dateStr);
    return attendance ? attendance.type : null;
  };

  const getAttendanceColor = (type: AttendanceType | null): string => {
    switch (type) {
      case '연차': return 'bg-blue-100 text-blue-800 border-blue-300';
      case '체휴': return 'bg-purple-100 text-purple-800 border-purple-300';
      case '근무': return 'bg-green-100 text-green-800 border-green-300';
      case '시차': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const changeMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg">
        {/* Header */}
        <div className="bg-indigo-600 text-white p-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">{user?.name}님의 근태</h1>
            <div className="flex gap-2">
              {user?.isAdmin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="px-3 py-1 bg-white text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition"
                >
                  관리자
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-800 transition"
              >
                로그아웃
              </button>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-indigo-700 rounded-lg transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold">
              {format(currentDate, 'yyyy년 M월')}
            </h2>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-indigo-700 rounded-lg transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map((day) => {
              const attendance = getAttendanceForDate(day);
              const isCurrentDay = isToday(day);
              
              return (
                <div
                  key={day.toISOString()}
                  className={`aspect-square p-1 rounded-lg border-2 ${getAttendanceColor(attendance)} ${
                    isCurrentDay ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
                  }`}
                >
                  <div className="text-xs font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  {attendance && (
                    <div className="text-[10px] font-semibold truncate">
                      {attendance}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">범례</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['연차', '체휴', '근무', '시차'] as AttendanceType[]).map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border ${getAttendanceColor(type)}`} />
                  <span className="text-sm text-gray-600">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

