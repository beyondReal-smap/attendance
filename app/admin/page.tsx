'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { AttendanceType } from '@/types';

interface User {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
}

interface Attendance {
  id: string;
  userId: string;
  userName: string;
  date: string;
  type: AttendanceType;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedType, setSelectedType] = useState<AttendanceType>('근무');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const sessionRes = await fetch('/api/auth/session');
      if (!sessionRes.ok) {
        router.push('/login');
        return;
      }
      const session = await sessionRes.json();
      if (!session.isAdmin) {
        router.push('/calendar');
        return;
      }

      await Promise.all([loadUsers(), loadAttendances()]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
      if (data.length > 0 && !selectedUserId) {
        setSelectedUserId(data[0].id);
      }
    }
  };

  const loadAttendances = async () => {
    const res = await fetch('/api/attendance/all');
    if (res.ok) {
      const data = await res.json();
      setAttendances(data);
    }
  };

  const handleAddAttendance = async () => {
    if (!selectedUserId) {
      alert('사용자를 선택하세요.');
      return;
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          date: selectedDate,
          type: selectedType,
        }),
      });

      if (res.ok) {
        await loadAttendances();
        alert('근태가 추가되었습니다.');
      } else {
        const data = await res.json();
        alert(data.error || '근태 추가에 실패했습니다.');
      }
    } catch (error) {
      alert('오류가 발생했습니다.');
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/attendance?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await loadAttendances();
        alert('삭제되었습니다.');
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      alert('오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
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
      <div className="max-w-4xl mx-auto bg-white min-h-screen shadow-lg">
        {/* Header */}
        <div className="bg-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">관리자 페이지</h1>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/calendar')}
                className="px-3 py-1 bg-white text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition"
              >
                캘린더
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-800 transition"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Add Attendance Form */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">근태 추가</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사용자
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="">선택하세요</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  날짜
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  근태 유형
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as AttendanceType)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="연차">연차</option>
                  <option value="체휴">체휴</option>
                  <option value="근무">근무</option>
                  <option value="시차">시차</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleAddAttendance}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
                >
                  추가
                </button>
              </div>
            </div>
          </div>

          {/* Attendance List */}
          <div>
            <h2 className="text-xl font-semibold mb-4">근태 목록</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">사용자</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">날짜</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">유형</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                        등록된 근태가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    attendances.map((attendance) => (
                      <tr key={attendance.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{attendance.userName}</td>
                        <td className="border border-gray-300 px-4 py-2">{attendance.date}</td>
                        <td className="border border-gray-300 px-4 py-2">{attendance.type}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <button
                            onClick={() => handleDeleteAttendance(attendance.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

