'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { AttendanceType } from '@/types';
import { DatePickerCalendar } from '@/components/DatePickerCalendar';
import dayjs from 'dayjs';
import { FiCalendar } from 'react-icons/fi';

interface User {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  annualLeaveTotal: number;
  annualLeaveUsed: number;
  annualLeaveRemaining: number;
  compLeaveTotal: number;
  compLeaveUsed: number;
  compLeaveRemaining: number;
}

interface Attendance {
  id: string;
  userId: string;
  userName: string;
  date: string;
  type: AttendanceType;
  reason?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedType, setSelectedType] = useState<AttendanceType>('근무');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [annualLeaveTotal, setAnnualLeaveTotal] = useState('');
  const [compLeaveTotal, setCompLeaveTotal] = useState('');
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [attendanceToDelete, setAttendanceToDelete] = useState<Attendance | null>(null);

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

    if (!reason.trim()) {
      alert('근태사유를 입력하세요.');
      return;
    }

    try {
      const res = await fetch('/api/attendance/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          startDate,
          endDate,
          type: selectedType,
          reason: reason.trim(),
        }),
      });

      if (res.ok) {
        await Promise.all([loadUsers(), loadAttendances()]);
        alert('근태가 추가되었습니다.');
        setStartDate(format(new Date(), 'yyyy-MM-dd'));
        setEndDate(format(new Date(), 'yyyy-MM-dd'));
        setReason('');
      } else {
        const data = await res.json();
        alert(data.error || '근태 추가에 실패했습니다.');
      }
    } catch (error) {
      alert('오류가 발생했습니다.');
    }
  };

  const handleUpdateUserLeave = async (userId: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          annualLeaveTotal: parseInt(annualLeaveTotal) || 15,
          compLeaveTotal: parseInt(compLeaveTotal) || 0,
        }),
      });

      if (res.ok) {
        await loadUsers();
        setEditingUser(null);
        setAnnualLeaveTotal('');
        setCompLeaveTotal('');
        alert('저장되었습니다.');
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      alert('오류가 발생했습니다.');
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    const attendance = attendances.find(a => a.id === id);
    if (attendance) {
      setAttendanceToDelete(attendance);
      setDeleteModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!attendanceToDelete) return;

    try {
      const res = await fetch(`/api/attendance?id=${attendanceToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await Promise.all([loadUsers(), loadAttendances()]);
        setDeleteModalOpen(false);
        setAttendanceToDelete(null);
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-sm text-gray-600">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">관리자</h1>
              <p className="text-xs text-gray-500 mt-0.5">사용자 및 근태 관리</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/calendar')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
              >
                캘린더
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* 사용자 연차/체휴 설정 */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">사용자 연차/체휴 설정</h2>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.name}</h3>
                      <p className="text-xs text-gray-500">{user.username}</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setAnnualLeaveTotal(user.annualLeaveTotal.toString());
                        setCompLeaveTotal(user.compLeaveTotal.toString());
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                    >
                      수정
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                      <div className="text-xs text-blue-600 font-medium mb-1">연차</div>
                      <div className="flex items-baseline gap-1">
                        <div className="text-lg font-bold text-blue-700">
                          {user.annualLeaveRemaining}
                        </div>
                        <div className="text-xs text-blue-500">
                          / {user.annualLeaveTotal}일
                        </div>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                      <div className="text-xs text-emerald-600 font-medium mb-1">체휴</div>
                      <div className="flex items-baseline gap-1">
                        <div className="text-lg font-bold text-emerald-700">
                          {user.compLeaveRemaining}
                        </div>
                        <div className="text-xs text-emerald-500">
                          / {user.compLeaveTotal}일
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 수정 모달 */}
            {editingUser && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{editingUser.name} 연차/체휴 설정</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        연차 총 수
                      </label>
                      <input
                        type="number"
                        value={annualLeaveTotal}
                        onChange={(e) => setAnnualLeaveTotal(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        체휴 총 수
                      </label>
                      <input
                        type="number"
                        value={compLeaveTotal}
                        onChange={(e) => setCompLeaveTotal(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => {
                          setEditingUser(null);
                          setAnnualLeaveTotal('');
                          setCompLeaveTotal('');
                        }}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleUpdateUserLeave(editingUser.id)}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Add Attendance Form */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">근태 추가</h2>
            <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    사용자
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    시작일자
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartCalendar(true);
                      setShowEndCalendar(false);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-left text-gray-900"
                  >
                    <span>{startDate || '선택하세요'}</span>
                    <FiCalendar className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    종료일자
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEndCalendar(true);
                      setShowStartCalendar(false);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-left text-gray-900"
                  >
                    <span>{endDate || '선택하세요'}</span>
                    <FiCalendar className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  근태 유형
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as AttendanceType)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                >
                  <option value="연차">연차 (1일)</option>
                  <option value="오전반차">오전반차 (0.5일, 09:00-14:00)</option>
                  <option value="오후반차">오후반차 (0.5일, 14:00-18:00)</option>
                  <option value="오전반반차A">오전반반차A (0.25일, 09:00-11:00)</option>
                  <option value="오전반반차B">오전반반차B (0.25일, 11:00-14:00)</option>
                  <option value="오후반반차A">오후반반차A (0.25일, 14:00-16:00)</option>
                  <option value="오후반반차B">오후반반차B (0.25일, 16:00-18:00)</option>
                  <option value="체휴">체휴 (1일)</option>
                  <option value="근무">근무</option>
                  <option value="시차">시차 (시간 직접 입력)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  근태사유
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="근태사유를 입력하세요"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-gray-900"
                />
              </div>

              <button
                onClick={handleAddAttendance}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
              >
                추가
              </button>
            </div>
          </div>

          {/* 캘린더 모달 */}
          {(showStartCalendar || showEndCalendar) && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl p-4 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-xl">
                <DatePickerCalendar
                  startDate={startDate ? dayjs(startDate) : null}
                  endDate={endDate ? dayjs(endDate) : null}
                  onStartDateSelect={(date) => {
                    setStartDate(date.format('YYYY-MM-DD'));
                    setShowStartCalendar(false);
                  }}
                  onEndDateSelect={(date) => {
                    setEndDate(date.format('YYYY-MM-DD'));
                    setShowEndCalendar(false);
                  }}
                  onClose={() => {
                    setShowStartCalendar(false);
                    setShowEndCalendar(false);
                  }}
                  initialSelectingStart={showStartCalendar}
                />
              </div>
            </div>
          )}

          {/* Attendance List */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">근태 목록</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">사용자</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">날짜</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">유형</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">사유</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendances.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                          등록된 근태가 없습니다
                        </td>
                      </tr>
                    ) : (
                      attendances.map((attendance) => (
                        <tr key={attendance.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-sm text-gray-900">{attendance.userName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{attendance.date}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${
                              attendance.type === '연차' ? 'bg-blue-100 text-blue-700' :
                              attendance.type === '체휴' ? 'bg-emerald-100 text-emerald-700' :
                              attendance.type === '근무' ? 'bg-gray-100 text-gray-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {attendance.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={attendance.reason || ''}>
                            {attendance.reason || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDeleteAttendance(attendance.id)}
                              className="text-red-600 hover:text-red-700 text-xs font-medium hover:underline"
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

          {/* 삭제 확인 모달 */}
          {deleteModalOpen && attendanceToDelete && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                <h3 className="text-lg font-bold text-gray-900 mb-4">근태 삭제 확인</h3>
                <div className="mb-6">
                  <p className="text-sm text-gray-700 mb-3">
                    <span className="font-semibold">{attendanceToDelete.userName}</span>님의 근태를 삭제하시겠습니까?
                  </p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="text-sm text-gray-600 space-y-1">
                      <div><span className="font-medium text-gray-700">날짜:</span> {attendanceToDelete.date}</div>
                      <div><span className="font-medium text-gray-700">유형:</span> {attendanceToDelete.type}</div>
                      {attendanceToDelete.reason && (
                        <div><span className="font-medium text-gray-700">사유:</span> {attendanceToDelete.reason}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDeleteModalOpen(false);
                      setAttendanceToDelete(null);
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                  >
                    취소
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

