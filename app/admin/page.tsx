'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { AttendanceType } from '@/types';
import { DatePickerCalendar } from '@/components/DatePickerCalendar';
import AlertModal from '@/components/AlertModal';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { FiCalendar, FiDownload, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import * as XLSX from 'xlsx';

// 아바타 이미지 선택 헬퍼 함수
const getAvatarImage = (userId: string): string => {
  const avatarList = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6', 'avatar7', 'avatar8', 'avatar9', 'avatarA', 'avatarB'];
  // 사용자 ID의 마지막 숫자를 이용해서 avatar 선택
  const lastChar = userId.slice(-1);
  const index = parseInt(lastChar, 16) % avatarList.length; // 16진수로 변환하여 11로 나눔
  return `/image/${avatarList[index]}.png`;
};

// 30분 단위로 시간 계산 헬퍼 함수
const calculateTimeSlots = (startTime?: string, endTime?: string, type?: string): number => {
  if (!startTime || !endTime) {
    // 시간 정보가 없는 경우 기본값 사용
    switch (type) {
      case '연차':
      case '체휴':
      case '결근':
        return 16; // 8시간 = 16 * 30분
      case '오전반차':
        return 10; // 5시간 = 10 * 30분 (9시~14시)
      case '오후반차':
        return 8; // 4시간 = 8 * 30분 (14시~18시)
      case '반반차':
        return 4; // 2시간 = 4 * 30분 (14시~16시)
      default:
        return 16; // 기본 8시간
    }
  }

  // 시간 정보가 있는 경우 실제 시간 계산
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return Math.ceil(diffMinutes / 30); // 30분 단위로 계산
};

interface User {
  id: string;
  username: string;
  name: string;
  department?: string;
  role: 'user' | 'manager' | 'admin';
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
  startTime?: string;
  endTime?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedType, setSelectedType] = useState<AttendanceType>('연차');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [annualLeaveTotal, setAnnualLeaveTotal] = useState('');
  const [compLeaveTotal, setCompLeaveTotal] = useState('');
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
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
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showUserFilter, setShowUserFilter] = useState(false);

  // 현재 사용자 권한 상태
  const [currentUserRole, setCurrentUserRole] = useState<'user' | 'manager' | 'admin'>('user');
  const [currentUserDepartment, setCurrentUserDepartment] = useState<string>('');

  // 일자 범위 필터링 상태
  const [useDateRange, setUseDateRange] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // 뷰 모드 (테이블 / 캘린더)
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar');

  // 근태 추가 모달 상태
  const [showUserModal, setShowUserModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  // 일괄 생성 모달 상태
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [bulkCreateYear, setBulkCreateYear] = useState(new Date().getFullYear().toString());
  const [bulkCreateLoading, setBulkCreateLoading] = useState(false);

  // 사용자 추가 관련 상태
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserDepartment, setNewUserDepartment] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'manager' | 'admin'>('user');
  const [generatedPassword, setGeneratedPassword] = useState('');

  // 권한 선택 모달 상태
  const [showRoleModal, setShowRoleModal] = useState(false);

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

      // 권한에 따른 접근 제어 - 관리자만 접근 가능
      if (session.role !== 'admin' && session.role !== 'manager') {
        router.push('/calendar');
        return;
      }

      // 현재 사용자 권한 저장 (관리자 계정은 role이 없을 수 있으므로 기본값 처리)
      const userRole = session.role || (session.username === '8000000' ? 'admin' : 'user');
      const userDepartment = session.department || '';
      setCurrentUserRole(userRole);
      setCurrentUserDepartment(userDepartment);

      await Promise.all([loadUsers(userRole, userDepartment), loadAttendances(userRole, userDepartment)]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (userRole?: string, userDepartment?: string) => {
    const res = await fetch('/api/users');
    if (res.ok) {
      let data = await res.json();

      // 중간관리자의 경우 자신이 속한 부서의 일반 사용자만 표시 (관리자는 제외)
      const role = userRole || currentUserRole;
      const department = userDepartment || currentUserDepartment;

      if (role === 'manager' && department) {
        data = data.filter((user: User) =>
          user.department === department &&
          user.role !== 'admin'  // admin은 제외, manager 자신은 포함
        );
      } else if (role === 'manager' && !department) {
        // department 정보가 없으면 빈 배열
        data = [];
      }

      setUsers(data);

      // 선택된 사용자가 필터링된 목록에 없는 경우 재설정
      const isSelectedUserValid = data.some((user: User) => user.id === selectedUserId);
      if (data.length > 0 && (!selectedUserId || !isSelectedUserValid)) {
        setSelectedUserId(data[0].id);
      }
    }
  };

  const loadAttendances = async (userRole?: string, userDepartment?: string) => {
    const res = await fetch('/api/attendance/all');
    if (res.ok) {
      let data = await res.json();

      // 중간관리자의 경우 자신이 속한 부서의 사용자 근태만 표시
      const role = userRole || currentUserRole;
      const department = userDepartment || currentUserDepartment;
      if (role === 'manager' && department) {
        // 사용자 정보를 가져와서 부서 및 권한 필터링
        const usersRes = await fetch('/api/users');
        if (usersRes.ok) {
          const allUsers = await usersRes.json();
          const departmentUserIds = allUsers
            .filter((user: User) =>
              user.department === department &&
              user.role !== 'admin'  // admin은 제외, manager 자신은 포함
            )
            .map((user: User) => user.id);
          data = data.filter((attendance: Attendance) => departmentUserIds.includes(attendance.userId));
        }
      } else if (role === 'manager' && !department) {
        // department 정보가 없으면 빈 배열 반환
        data = [];
      }

      setAttendances(data);
    }
  };

  // 필터링된 근태 데이터
  const filteredAttendances = useMemo(() => {
    return attendances.filter(attendance => {
      // 날짜 필터링
      let dateMatch = true;
      if (useDateRange) {
        // 일자 범위 필터링
        if (startDateFilter && endDateFilter) {
          const attendanceDate = dayjs(attendance.date);
          const start = dayjs(startDateFilter);
          const end = dayjs(endDateFilter);
          dateMatch = (attendanceDate.isAfter(start) || attendanceDate.isSame(start)) && (attendanceDate.isBefore(end) || attendanceDate.isSame(end));
        } else if (startDateFilter) {
          dateMatch = dayjs(attendance.date).isSame(dayjs(startDateFilter));
        }
      } else {
        // 월 필터링
        const attendanceMonth = dayjs(attendance.date).format('YYYY-MM');
        dateMatch = attendanceMonth === selectedMonth;
      }

      // 사용자 필터링
      const userMatch = selectedUserFilter === 'all' || attendance.userName === selectedUserFilter;

      return dateMatch && userMatch;
    });
  }, [attendances, selectedMonth, selectedUserFilter, useDateRange, startDateFilter, endDateFilter]);

  // CSV 다운로드 함수
  const downloadCSV = () => {
    if (filteredAttendances.length === 0) {
      setAlertTitle('오류');
      setAlertMessage('다운로드할 데이터가 없습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
      return;
    }

    const csvData = filteredAttendances.map(attendance => {
      const user = users.find(u => u.name === attendance.userName);
      return {
        '사용자': attendance.userName,
        '사번': user?.username || '',
        '날짜': attendance.date,
        '유형': attendance.type,
        '사유': attendance.reason || ''
      };
    });

    const headers = ['사용자', '사번', '날짜', '유형', '사유'];
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

    const worksheetData = filteredAttendances.map(attendance => {
      const user = users.find(u => u.name === attendance.userName);
      // 근태 시간 계산 (30분 단위)
      const timeSlots = calculateTimeSlots(attendance.startTime, attendance.endTime, attendance.type);
      const hours = (timeSlots * 0.5).toFixed(1);

      return {
        '소속': user?.department || '',
        '성명': attendance.userName,
        '사번': user?.username || '',
        '시작일자': attendance.date,
        '종료일자': attendance.date, // 단일 날짜 근태의 경우 시작일자와 종료일자가 같음
        '시작시간': attendance.startTime || '',
        '종료시간': attendance.endTime || '',
        '근태일수': '1', // 단일 날짜 근태의 경우 1일
        '근태시간': hours,
        '근태유형': attendance.type,
        '사유': attendance.reason || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '근태목록');

    XLSX.writeFile(workbook, `근태목록_${selectedMonth}_${selectedUserFilter === 'all' ? '전체' : selectedUserFilter}.xlsx`);
  };

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

  const checkTimeOverlap = (existingAttendances: any[], newStartTime?: string, newEndTime?: string): any | null => {
    if (!newStartTime || !newEndTime) return null; // 시간 정보가 없으면 겹침 체크하지 않음

    const newStart = new Date(`2000-01-01T${newStartTime}`);
    const newEnd = new Date(`2000-01-01T${newEndTime}`);

    for (const attendance of existingAttendances) {
      if (attendance.startTime && attendance.endTime) {
        const existingStart = new Date(`2000-01-01T${attendance.startTime}`);
        const existingEnd = new Date(`2000-01-01T${attendance.endTime}`);

        // 시간대가 겹치는지 확인 (끝시간이 시작시간과 같거나, 시작시간이 끝시간과 같으면 겹치지 않음으로 처리)
        if (newStart < existingEnd && newEnd > existingStart) {
          return attendance; // 겹치는 근태 정보를 반환
        }
      }
    }
    return null; // 겹치는 근태가 없음
  };

  const handleAddAttendance = async () => {
    if (!selectedUserId || !users.find(u => u.id === selectedUserId)) {
      setAlertTitle('오류');
      setAlertMessage('유효한 사용자를 선택하세요.');
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

    // 시간 겹침 체크를 위한 새로운 근태 시간 계산
    const newStartTime = selectedType === '반반차' ? startTime :
                        (selectedType === '오전반차' ? '09:00' :
                       selectedType === '오후반차' ? '14:00' :
                       ['연차', '체휴', '결근'].includes(selectedType) ? '09:00' : undefined);
    const newEndTime = selectedType === '반반차' ? endTime :
                      (selectedType === '오전반차' ? '14:00' :
                       selectedType === '오후반차' ? '18:00' :
                       ['연차', '체휴', '결근'].includes(selectedType) ? '18:00' : undefined);

    // 같은 날짜의 같은 사용자의 기존 근태들을 확인
    const existingAttendancesOnDate = attendances.filter(a =>
      a.userId === selectedUserId && a.date === startDate
    );

    // 시간 겹침 체크 (시간 정보가 있는 근태들만)
    const overlappingAttendance = checkTimeOverlap(existingAttendancesOnDate, newStartTime, newEndTime);
    if (overlappingAttendance) {
      const timeInfo = overlappingAttendance.startTime && overlappingAttendance.endTime
        ? `${formatTimeDisplay(overlappingAttendance.startTime)} ~ ${formatTimeDisplay(overlappingAttendance.endTime)}`
        : '';
      setAlertTitle('근태 시간대 중복');
      setAlertMessage(`선택한 시간대에 이미 '${overlappingAttendance.type}' 근태가 입력되어 있습니다.\n시간대: ${timeInfo}`);
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
          startTime: selectedType === '반반차' ? startTime :
                     (['연차', '오전반차', '오후반차', '체휴', '결근'].includes(selectedType) ? '09:00' :
                      ['팀장대행', '코칭', '교육', '휴식', '출장', '장애', '기타', '연장근무'].includes(selectedType) ? startTime : undefined),
          endTime: selectedType === '반반차' ? endTime :
                   (['연차', '오전반차', '오후반차', '체휴', '결근'].includes(selectedType) ? '18:00' :
                    ['팀장대행', '코칭', '교육', '휴식', '출장', '장애', '기타', '연장근무'].includes(selectedType) ? endTime : undefined),
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
        setStartTime('');
        setEndTime('');
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

  const handleBulkCreateLeave = async () => {
    setBulkCreateLoading(true);
    try {
      const res = await fetch('/api/users/bulk-create-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(bulkCreateYear),
          annualLeaveTotal: 15,
          compLeaveTotal: 5,
        }),
      });

      if (res.ok) {
        await loadUsers();
        setShowBulkCreateModal(false);
        setBulkCreateYear(new Date().getFullYear().toString());
        setAlertTitle('성공');
        setAlertMessage(`${bulkCreateYear}년 연차/체휴가 전직원에게 일괄 생성되었습니다.`);
        setAlertType('success');
        setAlertModalOpen(true);
      } else {
        const data = await res.json();
        setAlertTitle('오류');
        setAlertMessage(data.error || '일괄 생성에 실패했습니다.');
        setAlertType('error');
        setAlertModalOpen(true);
      }
    } catch (error) {
      setAlertTitle('오류');
      setAlertMessage('오류가 발생했습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
    } finally {
      setBulkCreateLoading(false);
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
          department: newUserDepartment.trim() || null,
          role: newUserRole,
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
        setNewUserDepartment('');
        setNewUserRole('user');
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
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)' }}>
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute top-0 left-0 w-full h-full">
              <div className="w-16 h-16 border-4 border-purple-100 border-t-purple-300 rounded-full animate-spin"></div>
            </div>
            <div className="absolute top-2 left-2 w-12 h-12">
              <div className="w-12 h-12 border-4 border-pink-100 border-t-pink-300 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
            </div>
          </div>
          <div className="text-base font-semibold text-gray-700 mb-2">로딩 중...</div>
          <div className="text-sm text-gray-500">잠시만 기다려주세요</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl lg:max-w-7xl xl:max-w-full mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 md:px-8 lg:px-12 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">관리자</h1>
              <p className="text-xs text-gray-500 mt-0.5">사용자 및 근태 관리</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/calendar')}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition"
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

        <div className="p-6 md:p-8 lg:p-12 space-y-8">
          {/* 사용자 추가 - 관리자만 표시 */}
          {currentUserRole === 'admin' && (
            <div className="bg-white rounded-xl p-6 md:p-8 lg:p-10 border-2 border-blue-200 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">사용자 추가</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    소속
                  </label>
                  <input
                    type="text"
                    value={newUserDepartment}
                    onChange={(e) => setNewUserDepartment(e.target.value)}
                    placeholder="소속을 입력하세요 (선택사항)"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    권한
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRoleModal(true)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 bg-white text-left flex items-center justify-between hover:bg-gray-50"
                  >
                    <span>
                      {newUserRole === 'user' ? '사용자' :
                       newUserRole === 'manager' ? '중간관리자' :
                       '관리자'}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
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
                등록된 사용자
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
                            <img
                              src={getAvatarImage(user.id)}
                              alt={user.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div>
                              <h4 className="font-semibold text-gray-900">{user.username}</h4>
                              <p className="text-sm text-gray-500">{user.name}</p>
                              {user.department && (
                                <p className="text-sm text-gray-600">{user.department}</p>
                              )}
                              <div className="flex gap-2 mt-1">
                                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${
                                  user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                  user.role === 'manager' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {user.role === 'admin' ? '관리자' :
                                   user.role === 'manager' ? '중간관리자' :
                                   '사용자'}
                                </span>
                                {user.isTempPassword && (
                                  <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
                                    임시비밀번호
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleChangePassword(user.id)}
                            className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-medium hover:bg-yellow-600 transition whitespace-nowrap"
                          >
                            비밀번호 변경
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition whitespace-nowrap"
                          >
                            사용자 삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          )}

          {/* 사용자 연차/체휴 설정 - 관리자만 표시 */}
          {currentUserRole === 'admin' && (
            <div className="bg-white rounded-xl p-6 md:p-8 lg:p-10 border-2 border-red-200 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">연차/체휴 설정</h2>
              </div>
              <button
                onClick={() => setShowBulkCreateModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                일괄 생성
              </button>
            </div>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.username}</h3>
                      <p className="text-xs text-gray-500">{user.name}</p>
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
                    <div className="bg-red-50 border border-red-100 rounded-lg p-2.5">
                      <div className="text-xs text-red-600 font-medium mb-1">연차</div>
                      <div className="flex items-baseline gap-1">
                        <div className="text-lg font-bold text-red-700">
                          {user.annualLeaveRemaining}
                        </div>
                        <div className="text-xs text-red-500">
                          / {user.annualLeaveTotal}일
                        </div>
                      </div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-2.5">
                      <div className="text-xs text-yellow-600 font-medium mb-1">체휴</div>
                      <div className="flex items-baseline gap-1">
                        <div className="text-lg font-bold text-yellow-700">
                          {user.compLeaveRemaining}
                        </div>
                        <div className="text-xs text-yellow-500">
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

            {/* 일괄 생성 모달 */}
            {showBulkCreateModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">연차/체휴 일괄 생성</h3>
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-sm text-blue-800">
                        <div className="font-medium mb-2">생성 내용:</div>
                        <ul className="list-disc list-inside space-y-1">
                          <li>연차: 15일</li>
                          <li>체휴: 5일</li>
                          <li>대상: 전직원</li>
                        </ul>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        생성 년도
                      </label>
                      <input
                        type="number"
                        value={bulkCreateYear}
                        onChange={(e) => setBulkCreateYear(e.target.value)}
                        min="2020"
                        max="2030"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => {
                          setShowBulkCreateModal(false);
                          setBulkCreateYear(new Date().getFullYear().toString());
                        }}
                        disabled={bulkCreateLoading}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleBulkCreateLeave}
                        disabled={bulkCreateLoading}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {bulkCreateLoading ? '생성 중...' : '실행'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    사용자
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUserModal(true)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                  >
                    <span>
                      {selectedUserId && users.find(u => u.id === selectedUserId)
                        ? users.find(u => u.id === selectedUserId)?.username + ' (' + users.find(u => u.id === selectedUserId)?.name + ')'
                        : '선택하세요'
                      }
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    근태 유형
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTypeModal(true)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                  >
                    <span>
                      {selectedType
                        ? (() => {
                              const labels: Record<string, string> = {
                                '연차': '연차 (1일)',
                                '오전반차': '오전반차 (0.5일)',
                                '오후반차': '오후반차 (0.5일)',
                                '반반차': '반반차 (0.25일)',
                                '체휴': '체휴 (1일)',
                                '팀장대행': '팀장대행',
                                '코칭': '코칭',
                                '교육': '교육',
                                '휴식': '휴식',
                                '출장': '출장',
                                '장애': '장애',
                                '기타': '기타',
                                '연장근무': '연장근무',
                                '결근': '결근'
                              };
                            return labels[selectedType] || selectedType;
                          })()
                        : '선택하세요'
                      }
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      // 반차는 종료일자 선택 불가, 반반차는 시간 지정이므로 선택 가능
                      if (!['오전반차', '오후반차'].includes(selectedType)) {
                      setShowEndCalendar(true);
                      setShowStartCalendar(false);
                      }
                    }}
                    disabled={['오전반차', '오후반차'].includes(selectedType)}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between text-left text-gray-900 ${
                      ['오전반차', '오후반차'].includes(selectedType)
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span>{endDate || '선택하세요'}</span>
                    <FiCalendar className={`w-4 h-4 ${['오전반차', '오후반차'].includes(selectedType) ? 'text-gray-300' : 'text-gray-400'}`} />
                  </button>
                </div>
              </div>

              {/* 시간 입력 - 반반차, 팀장대행, 코칭, 교육, 휴식, 출장, 장애, 기타, 연장근무 */}
              {selectedType && ['반반차', '팀장대행', '코칭', '교육', '휴식', '출장', '장애', '기타', '연장근무'].includes(selectedType) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      시작시간
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowStartTimeModal(true)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                    >
                      <span>{startTime || '시간 선택'}</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      종료시간
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEndTimeModal(true)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                    >
                      <span>{endTime || '시간 선택'}</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

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
                  onClick={downloadXLSX}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
                >
                  <FiDownload className="w-4 h-4" />
                  Excel
                </button>
              </div>
            </div>

            {/* 필터링 컨트롤 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              {/* 필터 타입 토글 */}
              <div className="mb-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="filterType"
                      checked={!useDateRange}
                      onChange={() => setUseDateRange(false)}
                      className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">월별 조회</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="filterType"
                      checked={useDateRange}
                      onChange={() => setUseDateRange(true)}
                      className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">일자 범위 조회</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!useDateRange ? (
                  // 월 선택
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      월 선택
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowMonthPicker(true)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                    >
                      <span>{dayjs(selectedMonth).format('YYYY년 M월')}</span>
                      <FiCalendar className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  // 일자 범위 선택
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        시작일
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowStartDatePicker(true)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                      >
                        <span>{startDateFilter || '선택하세요'}</span>
                        <FiCalendar className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        종료일
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowEndDatePicker(true)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                      >
                        <span>{endDateFilter || '선택하세요'}</span>
                        <FiCalendar className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    사용자 필터
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUserFilter(true)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                  >
                    <span>
                      {selectedUserFilter === 'all'
                        ? '전체 사용자'
                        : users.find(u => u.name === selectedUserFilter)?.name || '전체 사용자'
                      }
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 뷰 모드 토글 (월별 조회일 때만) */}
              {!useDateRange && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">보기 방식:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewMode('calendar')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          viewMode === 'calendar'
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        캘린더
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          viewMode === 'table'
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        테이블
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-3 text-sm text-gray-600">
                총 {filteredAttendances.length}개의 근태 기록이 필터링되었습니다.
              </div>
            </div>
            {/* 테이블 뷰 */}
            {viewMode === 'table' && (
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
                      filteredAttendances.map((attendance) => {
                        const user = users.find(u => u.name === attendance.userName);
                        return (
                          <tr key={attendance.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {user?.username || attendance.userName}
                              {user && (
                                <span className="text-xs text-gray-500 ml-1">({user.name})</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{attendance.date}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${
                                attendance.type === '연차' ? 'bg-red-100 text-red-700' :
                                (attendance.type === '오전반차' || attendance.type === '오후반차') ? 'bg-green-100 text-green-700' :
                                attendance.type === '반반차' ? 'bg-gray-100 text-gray-700' :
                                attendance.type === '체휴' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-purple-100 text-purple-700'
                              }`}>
                                {attendance.type}
                                {attendance.startTime && attendance.endTime && (
                                  <span className="text-xs ml-1">
                                    ({formatTimeDisplay(attendance.startTime)}~{formatTimeDisplay(attendance.endTime)})
                                  </span>
                                )}
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
                        );
                      })
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 캘린더 뷰 (월별 조회일 때만) */}
            {viewMode === 'calendar' && !useDateRange && (
              <MonthlyAttendanceCalendar
                selectedMonth={selectedMonth}
                attendances={filteredAttendances}
                users={users}
                onDeleteAttendance={handleDeleteAttendance}
              />
            )}
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
                      <div><span className="font-medium text-gray-700">사번:</span> {userToDelete.username}</div>
                      <div><span className="font-medium text-gray-700">이름:</span> {userToDelete.name}</div>
                      {userToDelete.department && (
                        <div><span className="font-medium text-gray-700">소속:</span> {userToDelete.department}</div>
                      )}
                      <div><span className="font-medium text-gray-700">권한:</span> {
                        userToDelete.role === 'admin' ? '관리자' :
                        userToDelete.role === 'manager' ? '중간관리자' :
                        '사용자'
                      }</div>
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

          {/* 시작일 선택 모달 */}
          {showStartDatePicker && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">시작일 선택</h3>
                    <button
                      onClick={() => setShowStartDatePicker(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <DatePickerCalendar
                    startDate={startDateFilter ? dayjs(startDateFilter) : null}
                    endDate={endDateFilter ? dayjs(endDateFilter) : null}
                    onStartDateSelect={(date) => {
                      setStartDateFilter(date.format('YYYY-MM-DD'));
                      setShowStartDatePicker(false);
                    }}
                    onEndDateSelect={() => {}}
                    onClose={() => setShowStartDatePicker(false)}
                    initialSelectingStart={true}
                  />
                </div>
              </motion.div>
            </div>
          )}

          {/* 종료일 선택 모달 */}
          {showEndDatePicker && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">종료일 선택</h3>
                    <button
                      onClick={() => setShowEndDatePicker(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <DatePickerCalendar
                    startDate={startDateFilter ? dayjs(startDateFilter) : null}
                    endDate={endDateFilter ? dayjs(endDateFilter) : null}
                    onStartDateSelect={() => {}}
                    onEndDateSelect={(date) => {
                      setEndDateFilter(date.format('YYYY-MM-DD'));
                      setShowEndDatePicker(false);
                    }}
                    onClose={() => setShowEndDatePicker(false)}
                    initialSelectingStart={false}
                  />
                </div>
              </motion.div>
            </div>
          )}

          {/* 월 선택 모달 */}
          {showMonthPicker && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">월 선택</h3>
                    <button
                      onClick={() => setShowMonthPicker(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {/* 연도 선택 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      연도
                    </label>
                    <select
                      value={dayjs(selectedMonth).year()}
                      onChange={(e) => {
                        const currentMonth = dayjs(selectedMonth).month() + 1;
                        const newYear = parseInt(e.target.value);
                        setSelectedMonth(`${newYear}-${currentMonth.toString().padStart(2, '0')}`);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                    >
                      {Array.from({ length: 10 }, (_, i) => dayjs().year() - 2 + i).map(year => (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 월 선택 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      월
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                        const currentMonth = dayjs(selectedMonth).month() + 1;
                        const isSelected = currentMonth === month;

                        return (
                          <button
                            key={month}
                            onClick={() => {
                              const currentYear = dayjs(selectedMonth).year();
                              setSelectedMonth(`${currentYear}-${month.toString().padStart(2, '0')}`);
                              setShowMonthPicker(false);
                            }}
                            className={`p-3 text-sm font-medium rounded-lg transition ${
                              isSelected
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {month}월
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 현재 선택된 월 표시 */}
                  <div className="text-center p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-sm font-medium text-orange-700">
                      선택된 월: {dayjs(selectedMonth).format('YYYY년 M월')}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* 근태 추가 - 사용자 선택 모달 */}
          {showUserModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">사용자 선택</h3>
                    <button
                      onClick={() => setShowUserModal(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-6">
                    <div className="text-sm font-medium text-gray-700 mb-3">
                      근태를 추가할 사용자를 선택하세요
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setShowUserModal(false);
                          }}
                          className={`w-full p-3 text-left rounded-lg transition ${
                            selectedUserId === user.id
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={getAvatarImage(user.id)}
                              alt={user.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <div>
                              <div className="font-medium">{user.username}</div>
                              <div className="text-xs opacity-75">{user.name}</div>
                            </div>
                            {user.isAdmin && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                selectedUserId === user.id
                                  ? 'bg-white/20 text-white'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                관리자
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 현재 선택 표시 */}
                  <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-medium text-blue-700">
                      선택된 사용자: {
                        selectedUserId
                          ? users.find(u => u.id === selectedUserId)?.name || '알 수 없음'
                          : '없음'
                      }
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* 권한 선택 모달 */}
          {showRoleModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">권한 선택</h3>
                    <button
                      onClick={() => setShowRoleModal(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">
                    사용자 권한을 선택하세요
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setNewUserRole('user');
                        setShowRoleModal(false);
                      }}
                      className={`w-full p-3 text-left rounded-lg transition ${
                        newUserRole === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src="/image/avatar1.png"
                          alt="사용자"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-medium">사용자</div>
                          <div className="text-xs opacity-75">기본 권한 - 자신의 근태만 관리</div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setNewUserRole('manager');
                        setShowRoleModal(false);
                      }}
                      className={`w-full p-3 text-left rounded-lg transition ${
                        newUserRole === 'manager'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src="/image/avatar2.png"
                          alt="중간관리자"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-medium">중간관리자</div>
                          <div className="text-xs opacity-75">조직 구성원들의 근태 관리</div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setNewUserRole('admin');
                        setShowRoleModal(false);
                      }}
                      className={`w-full p-3 text-left rounded-lg transition ${
                        newUserRole === 'admin'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src="/image/avatar3.png"
                          alt="관리자"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-medium">관리자</div>
                          <div className="text-xs opacity-75">전체 시스템 관리</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* 근태 추가 - 유형 선택 모달 */}
          {showTypeModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">근태 유형 선택</h3>
                    <button
                      onClick={() => setShowTypeModal(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-6">
                    <div className="text-sm font-medium text-gray-700 mb-3">
                      근태 유형을 선택하세요
                    </div>
                    <div className="space-y-2">
                      {/* 첫 번째 행 - 연차, 체휴, 근무 */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            setSelectedType('연차');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '연차'
                              ? 'bg-red-500 text-white'
                              : 'bg-red-50 text-red-900 border border-red-200 hover:bg-red-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">✈️</span>
                            <div>
                              <div className="font-medium text-xs">연차</div>
                              <div className="text-xs opacity-75">1일</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedType('체휴');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '체휴'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-yellow-50 text-yellow-900 border border-yellow-200 hover:bg-yellow-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🏠</span>
                            <div>
                              <div className="font-medium text-xs">체휴</div>
                              <div className="text-xs opacity-75">1일</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedType('결근');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '결근'
                              ? 'bg-blue-500 text-white'
                              : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">❌</span>
                            <div>
                              <div className="font-medium text-xs">결근</div>
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* 두 번째 행 - 오전반차, 오후반차, 반반차 */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            setSelectedType('오전반차');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '오전반차'
                              ? 'bg-orange-500 text-white'
                              : 'bg-orange-50 text-orange-900 border border-orange-200 hover:bg-orange-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🌅</span>
                            <div>
                              <div className="font-medium text-xs">오전반차</div>
                              <div className="text-xs opacity-75">0.5일</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedType('오후반차');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '오후반차'
                              ? 'bg-green-500 text-white'
                              : 'bg-green-50 text-green-900 border border-green-200 hover:bg-green-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🌆</span>
                            <div>
                              <div className="font-medium text-xs">오후반차</div>
                              <div className="text-xs opacity-75">0.5일</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedType('반반차');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '반반차'
                              ? 'bg-purple-500 text-white'
                              : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🌄</span>
                            <div>
                              <div className="font-medium text-xs">반반차</div>
                              <div className="text-xs opacity-75">0.25일</div>
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* 세 번째 행 - 팀장대행, 코칭, 교육 */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            setSelectedType('팀장대행');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '팀장대행'
                              ? 'bg-gray-500 text-white'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">👔</span>
                            <div>
                              <div className="font-medium text-xs">팀장대행</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedType('코칭');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '코칭'
                              ? 'bg-gray-500 text-white'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">👨‍🏫</span>
                            <div>
                              <div className="font-medium text-xs">코칭</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedType('교육');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '교육'
                              ? 'bg-gray-500 text-white'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">📚</span>
                            <div>
                              <div className="font-medium text-xs">교육</div>
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* 네 번째 행 - 휴식, 출장, 장애 */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            setSelectedType('휴식');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '휴식'
                              ? 'bg-gray-500 text-white'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">😴</span>
                            <div>
                              <div className="font-medium text-xs">휴식</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedType('출장');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '출장'
                              ? 'bg-gray-500 text-white'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🏢</span>
                            <div>
                              <div className="font-medium text-xs">출장</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedType('장애');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '장애'
                              ? 'bg-gray-500 text-white'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">⚠️</span>
                            <div>
                              <div className="font-medium text-xs">장애</div>
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* 다섯 번째 행 - 기타, 연장근무 */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setSelectedType('기타');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '기타'
                              ? 'bg-gray-500 text-white'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">❓</span>
                            <div>
                              <div className="font-medium text-xs">기타</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedType('연장근무');
                            setStartTime('');
                            setEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            selectedType === '연장근무'
                              ? 'bg-gray-500 text-white'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">⏰</span>
                            <div>
                              <div className="font-medium text-xs">연장근무</div>
                            </div>
                          </div>
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* 현재 선택 표시 */}
                  <div className="text-center p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-sm font-medium text-purple-700">
                      선택된 유형: {
                        (() => {
                          const labels: Record<string, string> = {
                            '연차': '연차 (1일)',
                            '오전반차': '오전반차 (0.5일)',
                            '오후반차': '오후반차 (0.5일)',
                            '반반차': '반반차 (0.25일)',
                            '체휴': '체휴 (1일)',
                            '팀장대행': '팀장대행',
                            '코칭': '코칭',
                            '교육': '교육',
                            '휴식': '휴식',
                            '출장': '출장',
                            '장애': '장애',
                            '기타': '기타',
                            '연장근무': '연장근무',
                            '결근': '결근'
                          };
                          return labels[selectedType] || selectedType || '없음';
                        })()
                      }
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* 시작시간 선택 모달 */}
          {showStartTimeModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">시작시간 선택</h3>
                    <button
                      onClick={() => setShowStartTimeModal(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-4 max-h-96 overflow-y-auto">
                  <div className="text-sm font-medium text-gray-700 mb-3">
                    시간을 선택하세요 (9:00 ~ 18:00)
                    <div className="text-xs text-red-600 mt-1">
                      빨간색으로 표시된 시간은 이미 다른 근태가 입력되어 있어 선택할 수 없습니다.
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 19 }, (_, i) => {
                      const hour = Math.floor(i / 2) + 9;
                      const minute = i % 2 === 0 ? '00' : '30';
                      const timeString = `${hour.toString().padStart(2, '0')}:${minute}`;

                      // 선택된 날짜의 기존 근태들과 시간 겹침 확인
                      const existingAttendances = selectedUserId ? attendances.filter(a => a.userId === selectedUserId && a.date === startDate) : [];
                      const isTimeOccupied = existingAttendances.some(attendance => {
                        if (!attendance.startTime || !attendance.endTime) return false;

                        // 현재 근태의 시간대를 계산
                        const currentStart = new Date(`2000-01-01T${timeString}`);
                        const currentEnd = new Date(currentStart.getTime() + 30 * 60 * 1000); // 30분 후

                        // 기존 근태의 시간대와 비교
                        const existingStart = new Date(`2000-01-01T${attendance.startTime}`);
                        const existingEnd = new Date(`2000-01-01T${attendance.endTime}`);

                        // 시간대가 겹치는지 확인
                        return currentStart < existingEnd && currentEnd > existingStart;
                      });

                      // 종료시간이 이미 선택되어 있다면 종료시간과 같거나 늦은 시간은 비활성화
                      // 또는 이미 차지된 시간대는 비활성화
                      const isDisabled = !!(endTime && timeString >= endTime) || isTimeOccupied;
                      return (
                        <button
                          key={timeString}
                          onClick={() => {
                            if (!isDisabled) {
                              setStartTime(timeString);
                              // 반반차의 경우 시작시간 입력 시 종료시간 자동 계산 (+2시간)
                              if (selectedType === '반반차') {
                                const [hours, minutes] = timeString.split(':').map(Number);
                                const endDateTime = new Date();
                                endDateTime.setHours(hours + 2, minutes);
                                const endTimeStr = endDateTime.toTimeString().slice(0, 5);
                                setEndTime(endTimeStr);
                              }
                              setShowStartTimeModal(false);
                            }
                          }}
                          disabled={isDisabled}
                          className={`p-3 text-center rounded-lg transition text-sm font-medium ${
                            startTime === timeString
                              ? 'bg-blue-500 text-white'
                              : isDisabled
                              ? isTimeOccupied
                                ? 'bg-red-100 text-red-400 cursor-not-allowed border border-red-200'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {timeString}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* 종료시간 선택 모달 */}
          {showEndTimeModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">종료시간 선택</h3>
                    <button
                      onClick={() => setShowEndTimeModal(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-4 max-h-96 overflow-y-auto">
                  <div className="text-sm font-medium text-gray-700 mb-3">
                    시간을 선택하세요 (9:00 ~ 18:00)
                    <div className="text-xs text-red-600 mt-1">
                      빨간색으로 표시된 시간은 이미 다른 근태가 입력되어 있어 선택할 수 없습니다.
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 19 }, (_, i) => {
                      const hour = Math.floor(i / 2) + 9;
                      const minute = i % 2 === 0 ? '00' : '30';
                      const timeString = `${hour.toString().padStart(2, '0')}:${minute}`;

                      // 선택된 날짜의 기존 근태들과 시간 겹침 확인
                      const existingAttendances = selectedUserId ? attendances.filter(a => a.userId === selectedUserId && a.date === startDate) : [];
                      const isTimeOccupied = existingAttendances.some(attendance => {
                        if (!attendance.startTime || !attendance.endTime) return false;

                        // 현재 근태의 시간대를 계산
                        const currentStart = new Date(`2000-01-01T${timeString}`);
                        const currentEnd = new Date(currentStart.getTime() + 30 * 60 * 1000); // 30분 후

                        // 기존 근태의 시간대와 비교
                        const existingStart = new Date(`2000-01-01T${attendance.startTime}`);
                        const existingEnd = new Date(`2000-01-01T${attendance.endTime}`);

                        // 시간대가 겹치는지 확인
                        return currentStart < existingEnd && currentEnd > existingStart;
                      });

                      // 시작시간이 이미 선택되어 있다면 시작시간과 같거나 앞서는 시간은 비활성화
                      // 또는 이미 차지된 시간대는 비활성화
                      const isDisabled = !!(startTime && timeString <= startTime) || isTimeOccupied;
                      return (
                        <button
                          key={timeString}
                          onClick={() => {
                            if (!isDisabled) {
                              setEndTime(timeString);
                              setShowEndTimeModal(false);
                            }
                          }}
                          disabled={isDisabled}
                          className={`p-3 text-center rounded-lg transition text-sm font-medium ${
                            endTime === timeString
                              ? 'bg-blue-500 text-white'
                              : isDisabled
                              ? isTimeOccupied
                                ? 'bg-red-100 text-red-400 cursor-not-allowed border border-red-200'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {timeString}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* 사용자 필터 모달 */}
          {showUserFilter && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">사용자 필터</h3>
                    <button
                      onClick={() => setShowUserFilter(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {/* 전체 사용자 옵션 */}
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        setSelectedUserFilter('all');
                        setShowUserFilter(false);
                      }}
                      className={`w-full p-3 text-left rounded-lg transition ${
                        selectedUserFilter === 'all'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src="/image/avatar4.png"
                          alt="전체 사용자"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-medium">전체 사용자</div>
                          <div className="text-xs opacity-75">모든 사용자의 근태 기록</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* 사용자 리스트 */}
                  <div className="mb-6">
                    <div className="text-sm font-medium text-gray-700 mb-3">
                      개별 사용자 선택
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUserFilter(user.name);
                            setShowUserFilter(false);
                          }}
                          className={`w-full p-3 text-left rounded-lg transition ${
                            selectedUserFilter === user.name
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={getAvatarImage(user.id)}
                              alt={user.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <div>
                              <div className="font-medium">{user.username}</div>
                              <div className="text-xs opacity-75">{user.name}</div>
                            </div>
                            {user.isAdmin && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                selectedUserFilter === user.name
                                  ? 'bg-white/20 text-white'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                관리자
                              </span>
                            )}
                            {user.isTempPassword && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                selectedUserFilter === user.name
                                  ? 'bg-white/20 text-white'
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                임시비밀번호
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 현재 선택 표시 */}
                  <div className="text-center p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-sm font-medium text-orange-700">
                      선택된 필터: {
                        selectedUserFilter === 'all'
                          ? '전체 사용자'
                          : users.find(u => u.name === selectedUserFilter)?.name || '전체 사용자'
                      }
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 월별 근태 캘린더 컴포넌트
function MonthlyAttendanceCalendar({
  selectedMonth,
  attendances,
  users,
  onDeleteAttendance
}: {
  selectedMonth: string;
  attendances: Attendance[];
  users: User[];
  onDeleteAttendance: (id: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(dayjs(selectedMonth));

  useEffect(() => {
    setCurrentMonth(dayjs(selectedMonth));
  }, [selectedMonth]);

  const daysInMonth = currentMonth.daysInMonth();

  // 사용자별 근태 맵 생성
  const userAttendanceMap = useMemo(() => {
    const map: Record<string, Record<string, Attendance[]>> = {};

    users.forEach(user => {
      map[user.id] = {};
      // 해당 월의 모든 날짜에 대해 빈 배열 초기화
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = currentMonth.date(day).format('YYYY-MM-DD');
        map[user.id][dateStr] = [];
      }
    });

    // 근태 데이터 채우기
    attendances.forEach(attendance => {
      const userId = users.find(u => u.name === attendance.userName)?.id;
      if (userId && map[userId]) {
        if (!map[userId][attendance.date]) {
          map[userId][attendance.date] = [];
        }
        map[userId][attendance.date].push(attendance);
      }
    });

    return map;
  }, [attendances, users, currentMonth, daysInMonth]);

  const getAttendanceColor = (attendances: Attendance[]): string => {
    if (attendances.length === 0) return 'bg-white border border-gray-200';

    // 여러 근태가 있는 경우 우선순위에 따라 색상 결정
    const type = attendances[0].type;
    switch (type) {
      case '연차': return 'bg-red-50 border border-red-200';
      case '오전반차':
      case '오후반차': return 'bg-green-50 border border-green-200';
      case '반반차': return 'bg-gray-50 border border-gray-200';
      case '체휴': return 'bg-yellow-50 border border-yellow-200';
      default: return 'bg-white border border-gray-200';
    }
  };

  // 9시부터 18시까지 30분 단위 시간 슬롯 생성 (총 18개)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  // 근태 시간을 시간 슬롯에 매핑
  const getTimeSlotColors = (attendances: Attendance[]) => {
    const timeSlots = generateTimeSlots(); // 18개 슬롯
    const slotColors = new Array(18).fill('bg-gray-100'); // 기본 회색

    attendances.forEach(attendance => {
      const color = getAttendanceColorForSlot(attendance.type);
      let startSlot = 0;
      let endSlot = 17; // 기본 9시~18시 전체

      if (attendance.startTime && attendance.endTime) {
        // 실제 시간에 따른 슬롯 계산
        const startHour = parseInt(attendance.startTime.split(':')[0]);
        const startMinute = parseInt(attendance.startTime.split(':')[1]);
        const endHour = parseInt(attendance.endTime.split(':')[0]);
        const endMinute = parseInt(attendance.endTime.split(':')[1]);

        // 9시부터 시작하는 인덱스 계산
        startSlot = Math.max(0, (startHour - 9) * 2 + (startMinute >= 30 ? 1 : 0));
        endSlot = Math.min(17, (endHour - 9) * 2 + (endMinute > 30 ? 1 : 0));
      } else {
        // 시간 정보가 없는 경우 근태 유형에 따른 기본 시간 적용
        switch (attendance.type) {
          case '오전반차':
            endSlot = 9; // 9시~14시 (10슬롯)
            break;
          case '오후반차':
            startSlot = 10; // 14시~18시 (8슬롯)
            break;
          case '반반차':
            startSlot = 10; // 14시~16시 (4슬롯)
            endSlot = 13;
            break;
          // 연차, 체휴, 결근 등은 전체 시간 (9시~18시)
        }
      }

      // 해당 슬롯 범위에 색상 적용
      for (let i = startSlot; i <= endSlot; i++) {
        slotColors[i] = color;
      }
    });

    return slotColors;
  };

  // 슬롯용 색상 함수
  const getAttendanceColorForSlot = (type: AttendanceType): string => {
    switch (type) {
      case '연차':
        return 'bg-red-500';        // 빨강
      case '결근':
        return 'bg-rose-500';       // 장미빨강
      case '오전반차':
        return 'bg-orange-500';     // 주황
      case '연장근무':
        return 'bg-amber-500';      // 황금색
      case '체휴':
        return 'bg-yellow-500';     // 노랑
      case '오후반차':
        return 'bg-lime-500';       // 라임색
      case '출장':
        return 'bg-green-500';      // 초록
      case '교육':
        return 'bg-emerald-500';    // 에메랄드
      case '휴식':
        return 'bg-teal-500';       // 청록
      case '팀장대행':
        return 'bg-cyan-500';       // 하늘색
      case '코칭':
        return 'bg-blue-500';      // 파랑
      case '반반차':
        return 'bg-indigo-500';     // 남색
      case '장애':
        return 'bg-violet-500';     // 보라
      case '기타':
        return 'bg-purple-500';     // 자줏빛
      default:
        return 'bg-gray-500';
    }
  };

  // 시간을 13시 30분 형식으로 변환
  const formatTimeDisplay = (timeString: string) => {
    const [hour, minute] = timeString.split(':').map(Number);
    if (minute === 0) {
      return `${hour}시`;
    } else {
      return `${hour}시 ${minute}분`;
    }
  };

  const getAttendanceText = (attendances: Attendance[]): string => {
    if (attendances.length === 0) return '';

    if (attendances.length === 1) {
      const attendance = attendances[0];
      if (attendance.type === '반반차' && attendance.startTime && attendance.endTime) {
        const startTime = formatTimeDisplay(attendance.startTime);
        const endTime = formatTimeDisplay(attendance.endTime);
        return `${attendance.type}\n${startTime}~${endTime}`;
      }
      return attendance.type;
    }

    return `${attendances.length}개`;
  };

  const getDayOfWeek = (day: number): string => {
    const date = currentMonth.date(day);
    const dayOfWeek = date.day();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[dayOfWeek];
  };

  const getDayOfWeekColor = (day: number): string => {
    const date = currentMonth.date(day);
    const dayOfWeek = date.day();
    if (dayOfWeek === 0) return 'text-red-600'; // 일요일
    if (dayOfWeek === 6) return 'text-blue-600'; // 토요일
    return 'text-gray-900'; // 평일
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => prev.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => prev.add(1, 'month'));
  };

  const handleDayClick = (userId: string, dateStr: string, attendances: Attendance[]) => {
    if (attendances.length === 1) {
      onDeleteAttendance(attendances[0].id);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* 캘린더 헤더 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
        <motion.button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiChevronLeft className="w-5 h-5 text-gray-700" />
        </motion.button>

        <h3 className="text-lg font-bold text-gray-900">
          {currentMonth.format('YYYY년 M월')} 근태 현황
        </h3>

        <motion.button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiChevronRight className="w-5 h-5 text-gray-700" />
        </motion.button>
      </div>

      {/* 사용자별 일별 근태 그리드 */}
      <div className="relative overflow-x-auto">
        <div className="min-w-max">
          {/* 일자 헤더 */}
          <div className="grid sticky top-0 z-10 bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns: `200px repeat(${daysInMonth}, 80px)` }}>
            <div className="sticky left-0 z-20 px-4 py-3 text-xs font-semibold text-gray-700 border-r border-gray-200 bg-gray-50">
              사용자
            </div>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
              <div
                key={day}
                className={`px-2 py-3 text-xs font-semibold text-center border-r border-gray-200 last:border-r-0 ${getDayOfWeekColor(day)}`}
              >
                <div className="font-bold">{day}</div>
                <div className="text-xs opacity-75">{getDayOfWeek(day)}</div>
              </div>
            ))}
          </div>

          {/* 사용자별 행 */}
          {users.map((user) => (
            <div
              key={user.id}
              className="grid border-b border-gray-100 hover:bg-gray-50 transition"
              style={{ gridTemplateColumns: `200px repeat(${daysInMonth}, 80px)` }}
            >
              {/* 사용자 이름 - 고정 */}
              <div className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200 bg-gray-50 flex items-center">
                {user.username}
                <span className="text-xs text-gray-500 ml-1">({user.name})</span>
              </div>

              {/* 일자별 셀들 */}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dateStr = currentMonth.date(day).format('YYYY-MM-DD');
                const dayAttendances = userAttendanceMap[user.id]?.[dateStr] || [];
                const slotColors = getTimeSlotColors(dayAttendances);
                const text = getAttendanceText(dayAttendances);

                return (
                  <motion.button
                    key={day}
                    onClick={() => handleDayClick(user.id, dateStr, dayAttendances)}
                    className={`px-1 py-3 text-xs text-center rounded border transition-all duration-200 bg-white hover:bg-gray-50 min-h-[7rem] ${
                      dayAttendances.length > 0 ? 'hover:shadow-sm' : 'cursor-default'
                    } border-r border-gray-100 last:border-r-0`}
                    whileHover={dayAttendances.length > 0 ? { scale: 1.02 } : {}}
                    whileTap={dayAttendances.length > 0 ? { scale: 0.98 } : {}}
                    title={dayAttendances.length > 0 ? dayAttendances.map(a => `${a.type}${a.reason ? `(${a.reason})` : ''}`).join('\n') : ''}
                  >
                    <div className="flex flex-col gap-0.5">
                      {/* 30분 단위 시간 슬롯들 (9시~18시, 총 18개) */}
                      {slotColors.map((color, index) => (
                        <div
                          key={index}
                          className={`h-1 w-full rounded-sm ${color} border border-gray-200`}
                          title={`${9 + Math.floor(index / 2)}:${index % 2 === 0 ? '00' : '30'}`}
                        />
                      ))}

                      {/* 근태 텍스트 (슬롯 아래에 표시) */}
                      <div className="mt-1 min-h-[3rem] flex items-start justify-center">
                    {text && (
                          <div className="text-xs text-gray-700 leading-tight text-center break-words whitespace-pre-line">
                        {text}
                      </div>
                    )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-col gap-4">
          {/* 시간 슬롯 색상 범례 */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">시간 슬롯 색상</h3>
        <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 border border-gray-300 rounded"></div>
                <span>연차</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-rose-500 border border-gray-300 rounded"></div>
                <span>결근</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 border border-gray-300 rounded"></div>
                <span>오전반차</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 border border-gray-300 rounded"></div>
                <span>연장근무</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 border border-gray-300 rounded"></div>
                <span>체휴</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-lime-500 border border-gray-300 rounded"></div>
                <span>오후반차</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 border border-gray-300 rounded"></div>
                <span>출장</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 border border-gray-300 rounded"></div>
                <span>교육</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-teal-500 border border-gray-300 rounded"></div>
                <span>휴식</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-500 border border-gray-300 rounded"></div>
                <span>팀장대행</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 border border-gray-300 rounded"></div>
                <span>코칭</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-500 border border-gray-300 rounded"></div>
                <span>반반차</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-violet-500 border border-gray-300 rounded"></div>
                <span>장애</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 border border-gray-300 rounded"></div>
                <span>기타</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
                <span>근태 없음</span>
              </div>
            </div>
          </div>

        </div>
        <p className="text-xs text-gray-500 mt-3">셀을 클릭하면 해당 근태를 삭제할 수 있습니다. 각 칸의 작은 바는 30분 단위를 나타냅니다.</p>
      </div>
    </div>
  );
}

