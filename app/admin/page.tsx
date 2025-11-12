'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { AttendanceType } from '@/types';
import { DatePickerCalendar } from '@/components/DatePickerCalendar';
import AlertModal from '@/components/AlertModal';
import dayjs from 'dayjs';
import { FiCalendar, FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';

interface User {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  isTempPassword: boolean;
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
  const [userDeleteModalOpen, setUserDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Alert 모달 상태
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'success' | 'error' | 'warning'>('info');

  // 근태 목록 필터링 상태
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');

  // 사용자 추가 관련 상태
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');

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

  // 필터링된 근태 데이터
  const filteredAttendances = useMemo(() => {
    return attendances.filter(attendance => {
      // 월 필터링
      const attendanceMonth = dayjs(attendance.date).format('YYYY-MM');
      const monthMatch = attendanceMonth === selectedMonth;

      // 사용자 필터링
      const userMatch = selectedUserFilter === 'all' || attendance.userName === selectedUserFilter;

      return monthMatch && userMatch;
    });
  }, [attendances, selectedMonth, selectedUserFilter]);

  // CSV 다운로드 함수
  const downloadCSV = () => {
    if (filteredAttendances.length === 0) {
      setAlertTitle('오류');
      setAlertMessage('다운로드할 데이터가 없습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
      return;
    }

    const csvData = filteredAttendances.map(attendance => ({
      '사용자': attendance.userName,
      '날짜': attendance.date,
      '유형': attendance.type,
      '사유': attendance.reason || ''
    }));

    const headers = ['사용자', '날짜', '유형', '사유'];
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `근태목록_${selectedMonth}_${selectedUserFilter === 'all' ? '전체' : selectedUserFilter}.csv`;
    link.click();
  };

  // XLSX 다운로드 함수
  const downloadXLSX = () => {
    if (filteredAttendances.length === 0) {
      setAlertTitle('오류');
      setAlertMessage('다운로드할 데이터가 없습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
      return;
    }

    const worksheetData = filteredAttendances.map(attendance => ({
      '사용자': attendance.userName,
      '날짜': attendance.date,
      '유형': attendance.type,
      '사유': attendance.reason || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '근태목록');

    XLSX.writeFile(workbook, `근태목록_${selectedMonth}_${selectedUserFilter === 'all' ? '전체' : selectedUserFilter}.xlsx`);
  };

  const handleAddAttendance = async () => {
    if (!selectedUserId) {
      setAlertTitle('오류');
      setAlertMessage('사용자를 선택하세요.');
      setAlertType('error');
      setAlertModalOpen(true);
      return;
    }

    if (!reason.trim()) {
      setAlertTitle('오류');
      setAlertMessage('근태사유를 입력하세요.');
      setAlertType('error');
      setAlertModalOpen(true);
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
        setAlertTitle('성공');
        setAlertMessage('근태가 추가되었습니다.');
        setAlertType('success');
        setAlertModalOpen(true);
        setStartDate(format(new Date(), 'yyyy-MM-dd'));
        setEndDate(format(new Date(), 'yyyy-MM-dd'));
        setReason('');
      } else {
        const data = await res.json();
        setAlertTitle('오류');
        setAlertMessage(data.error || '근태 추가에 실패했습니다.');
        setAlertType('error');
        setAlertModalOpen(true);
      }
    } catch (error) {
      setAlertTitle('오류');
      setAlertMessage('오류가 발생했습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
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
        setAlertTitle('성공');
        setAlertMessage('저장되었습니다.');
        setAlertType('success');
        setAlertModalOpen(true);
      } else {
        setAlertTitle('오류');
        setAlertMessage('저장에 실패했습니다.');
        setAlertType('error');
        setAlertModalOpen(true);
      }
    } catch (error) {
      setAlertTitle('오류');
      setAlertMessage('오류가 발생했습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
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
        setAlertTitle('성공');
        setAlertMessage('삭제되었습니다.');
        setAlertType('success');
        setAlertModalOpen(true);
      } else {
        setAlertTitle('오류');
        setAlertMessage('삭제에 실패했습니다.');
        setAlertType('error');
        setAlertModalOpen(true);
      }
    } catch (error) {
      setAlertTitle('오류');
      setAlertMessage('오류가 발생했습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
    }
  };

  // 4자리 숫자 비밀번호 생성
  const generatePassword = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  // 사용자 추가 핸들러
  const handleAddUser = async () => {
    if (!newUserUsername.trim() || !newUserName.trim()) {
      setAlertTitle('오류');
      setAlertMessage('사번과 이름을 모두 입력해주세요.');
      setAlertType('error');
      setAlertModalOpen(true);
      return;
    }

    const password = generatePassword();
    setGeneratedPassword(password);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUserUsername.trim(),
          name: newUserName.trim(),
          password: password,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await loadUsers();
        setAlertTitle('성공');
        setAlertMessage(`사용자가 추가되었습니다!\n사번: ${newUserUsername}\n이름: ${newUserName}\n초기 비밀번호: ${password}\n\n보안을 위해 초기 비밀번호로 로그인 후 바로 비밀번호를 변경해주세요.`);
        setAlertType('success');
        setAlertModalOpen(true);
        setNewUserUsername('');
        setNewUserName('');
        setGeneratedPassword('');
      } else {
        const error = await res.json();
        setAlertTitle('오류');
        setAlertMessage(error.error || '사용자 추가에 실패했습니다.');
        setAlertType('error');
        setAlertModalOpen(true);
      }
    } catch (error) {
      setAlertTitle('오류');
      setAlertMessage('오류가 발생했습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // 사용자 삭제 핸들러
  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setUserToDelete(user);
      setUserDeleteModalOpen(true);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const res = await fetch(`/api/users?userId=${userToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await Promise.all([loadUsers(), loadAttendances()]);
        setUserDeleteModalOpen(false);
        setUserToDelete(null);
        setAlertTitle('성공');
        setAlertMessage('사용자가 삭제되었습니다.');
        setAlertType('success');
        setAlertModalOpen(true);
      } else {
        const data = await res.json();
        setAlertTitle('오류');
        setAlertMessage(data.error || '사용자 삭제에 실패했습니다.');
        setAlertType('error');
        setAlertModalOpen(true);
      }
    } catch (error) {
      setAlertTitle('오류');
      setAlertMessage('오류가 발생했습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
    }
  };

  // 비밀번호 변경 핸들러 (자동 생성)
  const handleChangePassword = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // 4자리 랜덤 숫자 비밀번호 생성
    const newPassword = generatePassword();

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          newPassword: newPassword,
        }),
      });

      if (res.ok) {
        setAlertTitle('성공');
        setAlertMessage(`${user.name}님의 비밀번호가 ${newPassword}로 변경되었습니다.`);
        setAlertType('success');
        setAlertModalOpen(true);
      } else {
        const data = await res.json();
        setAlertTitle('오류');
        setAlertMessage(data.error || '비밀번호 변경에 실패했습니다.');
        setAlertType('error');
        setAlertModalOpen(true);
      }
    } catch (error) {
      setAlertTitle('오류');
      setAlertMessage('오류가 발생했습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
    }
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
          {/* 사용자 추가 */}
          <div className="bg-white rounded-xl p-6 border-2 border-blue-200 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">사용자 추가</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    사번
                  </label>
                  <input
                    type="text"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    placeholder="사번을 입력하세요"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    이름
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                  />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-blue-700">
                  <div className="font-medium mb-1">자동 생성 비밀번호:</div>
                  <div className="text-lg font-mono font-bold">
                    {generatedPassword || '사용자 추가 시 자동 생성됩니다'}
                  </div>
                  <div className="text-xs mt-1 text-blue-600">
                    4자리 숫자로 자동 생성되며, 첫 로그인 시 비밀번호 변경이 필요합니다.
                  </div>
                </div>
              </div>
              <button
                onClick={handleAddUser}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
              >
                사용자 추가
              </button>
            </div>

            {/* 사용자 리스트 */}
            <div className="mt-8 border-t border-blue-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                등록된 사용자 목록
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    등록된 사용자가 없습니다
                  </div>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="bg-white rounded-lg p-4 border border-blue-100 hover:border-blue-200 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{user.name}</h4>
                              <p className="text-sm text-gray-500">{user.username}</p>
                              <div className="flex gap-2 mt-1">
                                {user.isAdmin && (
                                  <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                                    관리자
                                  </span>
                                )}
                                {user.isTempPassword && (
                                  <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
                                    임시비밀번호
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleChangePassword(user.id)}
                            className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-medium hover:bg-yellow-600 transition"
                          >
                            비밀번호 변경
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 사용자 연차/체휴 설정 */}
          <div className="bg-white rounded-xl p-6 border-2 border-green-200 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">사용자 연차/체휴 설정</h2>
            </div>
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
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
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
                        className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
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
          <div className="bg-white rounded-xl p-6 border-2 border-purple-200 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">근태 추가</h2>
            </div>
            <div className="space-y-4">
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
                className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition"
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
          <div className="bg-white rounded-xl p-6 border-2 border-orange-200 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">근태 목록</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={downloadCSV}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                >
                  <FiDownload className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={downloadXLSX}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  <FiDownload className="w-4 h-4" />
                  XLSX
                </button>
              </div>
            </div>

            {/* 필터링 컨트롤 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    월 선택
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    사용자 필터
                  </label>
                  <select
                    value={selectedUserFilter}
                    onChange={(e) => setSelectedUserFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                  >
                    <option value="all">전체 사용자</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.name}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                총 {filteredAttendances.length}개의 근태 기록이 필터링되었습니다.
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                    {filteredAttendances.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                          필터링된 근태 기록이 없습니다
                        </td>
                      </tr>
                    ) : (
                      filteredAttendances.map((attendance) => (
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
                              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition"
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

          {/* 사용자 삭제 확인 모달 */}
          {userDeleteModalOpen && userToDelete && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                <h3 className="text-lg font-bold text-gray-900 mb-4">사용자 삭제 확인</h3>
                <div className="mb-6">
                  <p className="text-sm text-gray-700 mb-3">
                    <span className="font-semibold">{userToDelete.name}</span>님을 삭제하시겠습니까?
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-sm text-red-700">
                      <div className="font-medium mb-1">⚠️ 주의사항</div>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        <li>사용자의 모든 근태 기록이 함께 삭제됩니다.</li>
                        <li>삭제된 사용자는 복구할 수 없습니다.</li>
                      </ul>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-3">
                    <div className="text-sm text-gray-600 space-y-1">
                      <div><span className="font-medium text-gray-700">이름:</span> {userToDelete.name}</div>
                      <div><span className="font-medium text-gray-700">사번:</span> {userToDelete.username}</div>
                      {userToDelete.isAdmin && (
                        <div><span className="font-medium text-gray-700">권한:</span> 관리자</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setUserDeleteModalOpen(false);
                      setUserToDelete(null);
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                  >
                    취소
                  </button>
                  <button
                    onClick={confirmDeleteUser}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Alert 모달 */}
          <AlertModal
            isOpen={alertModalOpen}
            onClose={() => setAlertModalOpen(false)}
            title={alertTitle}
            message={alertMessage}
            type={alertType}
          />
        </div>
      </div>
    </div>
  );
}

