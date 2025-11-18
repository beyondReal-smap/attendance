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
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

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
  const [attendanceDetailModalOpen, setAttendanceDetailModalOpen] = useState(false);
  const [attendanceToView, setAttendanceToView] = useState<Attendance | null>(null);
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

  // 모달이 열려있을 때 body 스크롤 방지
  useEffect(() => {
    const hasModalOpen = showUserModal || showRoleModal || showBulkCreateModal || showUserFilter || editingUser || showStartCalendar || showEndCalendar || showMonthPicker || showStartDatePicker || showEndDatePicker || showTypeModal || userToDelete || alertModalOpen;

    if (hasModalOpen) {
      // 스크롤바 너비만큼 padding-right을 추가해서 레이아웃 시프트 방지
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    };
  }, [showUserModal, showRoleModal, showBulkCreateModal, showUserFilter, editingUser, showStartCalendar, showEndCalendar, showMonthPicker, showStartDatePicker, showEndDatePicker, showTypeModal, userToDelete, alertModalOpen]);

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
          user.role === 'user'  // 일반 사용자만 표시
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
              user.role === 'user'  // 일반 사용자만 표시
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

  const handleViewAttendance = (attendance: Attendance) => {
    setAttendanceToView(attendance);
    setAttendanceDetailModalOpen(true);
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
        setAttendanceToView(null);
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
          {/* 대시보드 */}
          <div className="bg-white rounded-xl p-6 md:p-8 lg:p-10 border-2 border-green-200 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">대시보드</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* 총 사용자 수 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-1">총 사용자</p>
                    <p className="text-3xl font-bold text-blue-900">{users.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 오늘 근태 현황 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 mb-1">오늘 근태</p>
                    <p className="text-3xl font-bold text-green-900">
                      {(() => {
                        const today = dayjs().format('YYYY-MM-DD');
                        const todayAttendances = attendances.filter(a => a.date === today);
                        const uniqueUsers = new Set(todayAttendances.map(a => a.userId));
                        return uniqueUsers.size;
                      })()}
                    </p>
                    <p className="text-xs text-green-600 mt-1">근태자 수</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 이번 달 근태 기록 수 */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600 mb-1">이번 달 기록</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {(() => {
                        const currentMonthStr = dayjs().format('YYYY-MM');
                        return attendances.filter(a => a.date.startsWith(currentMonthStr)).length;
                      })()}
                    </p>
                    <p className="text-xs text-purple-600 mt-1">총 근태 수</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 연차 사용 현황 */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600 mb-1">연차 잔여</p>
                    <p className="text-3xl font-bold text-orange-900">
                      {(() => {
                        const currentYear = new Date().getFullYear();
                        return users.reduce((total, user) => total + (user.annualLeaveRemaining || 0), 0);
                      })()}
                    </p>
                    <p className="text-xs text-orange-600 mt-1">총 잔여 일수</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 그래프 섹션 */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">근태 통계</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {/* 근태 유형별 분포 - 도넛 차트 */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 className="text-base font-semibold text-gray-900 mb-4">근태 유형별 분포</h4>
                  <div className="h-64">
                    {(() => {
                      const typeStats = attendances.reduce((acc, attendance) => {
                        acc[attendance.type] = (acc[attendance.type] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);

                      const total = Object.values(typeStats).reduce((sum, count) => sum + count, 0);
                      const colors = {
                        '연차': '#ef4444',        // bg-red-500
                        '결근': '#f43f5e',       // bg-rose-500
                        '오전반차': '#f97316',     // bg-orange-500
                        '연장근무': '#f59e0b',      // bg-amber-500
                        '체휴': '#eab308',        // bg-yellow-500
                        '오후반차': '#84cc16',      // bg-lime-500
                        '출장': '#22c55e',        // bg-green-500
                        '교육': '#10b981',        // bg-emerald-500
                        '휴식': '#14b8a6',        // bg-teal-500
                        '팀장대행': '#06b6d4',      // bg-cyan-500
                        '코칭': '#3b82f6',        // bg-blue-500
                        '반반차': '#6366f1',      // bg-indigo-500
                        '장애': '#8b5cf6',        // bg-violet-500
                        '기타': '#a855f7'        // bg-purple-500
                      };

                      const data = Object.entries(typeStats).map(([type, count]) => ({
                        name: type,
                        value: count,
                        percentage: Math.round((count / total) * 100)
                      }));

                      const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
                        if (percentage <= 5) return null;

                        const RADIAN = Math.PI / 180;
                        const radius = outerRadius + 15; // 도넛 바깥쪽에 더 넉넉하게 배치
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);

                        // 각도에 따라 textAnchor 결정
                        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                        const angle = midAngle % 360;
                        if (angle >= 90 && angle <= 270) {
                          textAnchor = 'end';
                        } else {
                          textAnchor = 'start';
                        }

                        return (
                          <text
                            x={x}
                            y={y}
                            fill="#374151"
                            textAnchor={textAnchor}
                            dominantBaseline="central"
                            className="text-xs font-medium"
                          >
                            {`${percentage}%`}
                          </text>
                        );
                      };

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={renderCustomizedLabel}
                              outerRadius={80}
                              innerRadius={40}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[entry.name as keyof typeof colors] || '#6b7280'} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: any, name: any) => [`${value}건 (${data.find(d => d.name === name)?.percentage}%)`, name]}
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={36}
                              formatter={(value, entry: any) => (
                                <span style={{ color: entry.color, fontSize: '12px' }}>
                                  {value}: {data.find(d => d.name === value)?.value}건
                                </span>
                              )}
                            />
                            {/* 중앙 텍스트 */}
                            <text x="50%" y="40%" textAnchor="middle" dominantBaseline="middle" className="text-lg font-bold fill-gray-900">
                              {total}
                            </text>
                            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-sm fill-gray-500">
                              총 기록
                            </text>
                          </PieChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                {/* 월별 근태 추이 - 선 그래프 */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 className="text-base font-semibold text-gray-900 mb-4">최근 6개월 근태 추이</h4>
                  <div className="h-64">
                    {(() => {
                      const monthlyStats = [];
                      for (let i = 5; i >= 0; i--) {
                        const date = dayjs().subtract(i, 'month');
                        const monthStr = date.format('YYYY-MM');
                        const count = attendances.filter(a => a.date.startsWith(monthStr)).length;
                        monthlyStats.push({
                          month: date.format('M월'),
                          count,
                          fullMonth: date.format('YYYY년 M월')
                        });
                      }

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis
                              dataKey="month"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                              }}
                              formatter={(value: any, name: any, props: any) => [
                                `${value}건`,
                                '근태 기록 수'
                              ]}
                              labelFormatter={(label, payload) => {
                                if (payload && payload[0]) {
                                  return payload[0].payload.fullMonth;
                                }
                                return label;
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#3b82f6"
                              strokeWidth={3}
                              dot={{
                                fill: '#3b82f6',
                                strokeWidth: 2,
                                stroke: '#ffffff',
                                r: 5
                              }}
                              activeDot={{
                                r: 7,
                                fill: '#1d4ed8',
                                stroke: '#ffffff',
                                strokeWidth: 2
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                {/* 요일별 근태 패턴 - 막대 그래프 */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 className="text-base font-semibold text-gray-900 mb-4">요일별 근태 패턴</h4>
                  <div className="h-64">
                    {(() => {
                      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                      const dayStats = dayNames.map(day => ({ day, count: 0 }));

                      attendances.forEach(attendance => {
                        const date = dayjs(attendance.date);
                        const dayIndex = date.day(); // 0: 일요일, 1: 월요일, ...
                        dayStats[dayIndex].count++;
                      });

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dayStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis
                              dataKey="day"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                              }}
                              formatter={(value: any) => [`${value}건`, '근태 기록 수']}
                              labelFormatter={(label) => `${label}요일`}
                            />
                            <Bar
                              dataKey="count"
                              fill="#10b981"
                              radius={[4, 4, 0, 0]}
                              name="근태 기록 수"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* 최근 근태 기록 */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 근태 기록</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(() => {
                  const recentAttendances = attendances
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 10);

                  return recentAttendances.map((attendance) => {
                    const user = users.find(u => u.id === attendance.userId);
                    return (
                      <div key={`${attendance.userId}-${attendance.date}-${attendance.type}`} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            attendance.type === '연차' ? 'bg-red-500' :
                            attendance.type === '오전반차' ? 'bg-orange-500' :
                            attendance.type === '오후반차' ? 'bg-green-500' :
                            attendance.type === '반반차' ? 'bg-purple-500' :
                            attendance.type === '체휴' ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`}></div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user?.name || '알 수 없음'}</p>
                            <p className="text-xs text-gray-500">{attendance.date} - {attendance.type}</p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {attendance.reason ? attendance.reason.substring(0, 20) + (attendance.reason.length > 20 ? '...' : '') : '사유 없음'}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

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
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
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
            <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
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
                <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
                  {/* 헤더 */}
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">연차/체휴 설정</h3>
                        <p className="text-green-100 text-sm">{editingUser.name}님의 휴가 정보를 수정하세요</p>
                      </div>
                    </div>
                  </div>

                  {/* 내용 */}
                  <div className="p-6">
                    <div className="space-y-4">
                      {/* 사용자 정보 */}
                      <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs text-green-600 font-medium">수정 대상</p>
                            <p className="text-sm font-semibold text-green-900">{editingUser.name} ({editingUser.username})</p>
                          </div>
                        </div>
                      </div>

                      {/* 입력 필드들 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            연차 총 수
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={annualLeaveTotal}
                              onChange={(e) => setAnnualLeaveTotal(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-gray-900 transition-colors duration-200"
                              placeholder="0"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                              일
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            체휴 총 수
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={compLeaveTotal}
                              onChange={(e) => setCompLeaveTotal(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-gray-900 transition-colors duration-200"
                              placeholder="0"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                              일
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 현재 정보 표시 */}
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs text-gray-500 font-medium">현재 정보</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">연차</p>
                            <p className="font-semibold text-gray-900">{editingUser.annualLeaveTotal}일 (사용: {editingUser.annualLeaveUsed}일)</p>
                          </div>
                          <div>
                            <p className="text-gray-500">체휴</p>
                            <p className="font-semibold text-gray-900">{editingUser.compLeaveTotal}일 (사용: {editingUser.compLeaveUsed}일)</p>
                          </div>
                        </div>
                      </div>

                      {/* 버튼들 */}
                      <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => {
                            setEditingUser(null);
                            setAnnualLeaveTotal('');
                            setCompLeaveTotal('');
                          }}
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handleUpdateUserLeave(editingUser.id)}
                          className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          저장
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 일괄 생성 모달 */}
            {showBulkCreateModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
                  {/* 헤더 */}
                  <div className="bg-gradient-to-r from-red-500 to-pink-600 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">연차/체휴 일괄 생성</h3>
                        <p className="text-red-100 text-sm">전직원에게 휴가를 일괄 생성합니다</p>
                      </div>
                    </div>
                  </div>

                  {/* 내용 */}
                  <div className="p-6">
                    <div className="space-y-4">
                      {/* 생성 정보 */}
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-blue-900 font-medium mb-2">생성될 휴가 정보</p>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="text-center">
                                <p className="text-blue-600 font-semibold">연차</p>
                                <p className="text-blue-800">15일</p>
                              </div>
                              <div className="text-center">
                                <p className="text-blue-600 font-semibold">체휴</p>
                                <p className="text-blue-800">5일</p>
                              </div>
                              <div className="text-center">
                                <p className="text-blue-600 font-semibold">대상</p>
                                <p className="text-blue-800">전직원</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 경고 메시지 */}
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <p className="text-xs text-amber-800">
                            이미 휴가가 생성된 사용자는 건너뜁니다. 기존 휴가에 영향을 주지 않습니다.
                          </p>
                        </div>
                      </div>

                      {/* 년도 입력 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          생성 년도
                        </label>
                        <input
                          type="number"
                          value={bulkCreateYear}
                          onChange={(e) => setBulkCreateYear(e.target.value)}
                          min="2020"
                          max="2030"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-gray-900 transition-colors duration-200"
                          placeholder={new Date().getFullYear().toString()}
                        />
                      </div>

                      {/* 버튼들 */}
                      <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => {
                            setShowBulkCreateModal(false);
                            setBulkCreateYear(new Date().getFullYear().toString());
                          }}
                          disabled={bulkCreateLoading}
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleBulkCreateLeave}
                          disabled={bulkCreateLoading}
                          className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {bulkCreateLoading ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              생성 중...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              실행
                            </>
                          )}
                        </button>
                      </div>
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                  >
                    <span>
                      {selectedType || '선택하세요'}
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none flex items-center justify-between hover:bg-gray-50 text-left text-gray-900"
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
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none flex items-center justify-between text-left text-gray-900 ${
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none text-gray-900"
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
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-hidden"
              >
                {/* 헤더 */}
                {showStartCalendar && (
                  <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">시작일자 선택</h3>
                        <p className="text-violet-100 text-sm">근태 시작일자를 선택하세요</p>
                      </div>
                      <button
                        onClick={() => setShowStartCalendar(false)}
                        className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                      >
                        <FiX className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                )}

                {showEndCalendar && (
                  <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">종료일자 선택</h3>
                        <p className="text-violet-100 text-sm">근태 종료일자를 선택하세요</p>
                      </div>
                      <button
                        onClick={() => setShowEndCalendar(false)}
                        className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                      >
                        <FiX className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-4">
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
                    showConfirmButton={false}
                  />
                </div>
              </motion.div>
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filterType"
                      checked={!useDateRange}
                      onChange={() => setUseDateRange(false)}
                      className="w-4 h-4 text-orange-600 focus:ring-orange-500 accent-orange-600 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700">월별 조회</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filterType"
                      checked={useDateRange}
                      onChange={() => setUseDateRange(true)}
                      className="w-4 h-4 text-orange-600 focus:ring-orange-500 accent-orange-600 cursor-pointer"
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
                        시작일자
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
                        종료일자
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
                onViewAttendance={handleViewAttendance}
              />
            )}
          </div>

          {/* 근태 상세 정보 모달 */}
          {attendanceDetailModalOpen && attendanceToView && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">근태 상세 정보</h3>
                      <p className="text-blue-100 text-sm">근태 기록의 세부 사항을 확인하세요</p>
                    </div>
                  </div>
                </div>

                {/* 내용 */}
                <div className="p-6">
                  <div className="space-y-4">
                    {/* 사용자 정보 */}
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium">사용자</p>
                        <p className="text-sm font-semibold text-blue-900">{attendanceToView.userName}</p>
                      </div>
                    </div>

                    {/* 근태 정보 그리드 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-gray-500 font-medium">날짜</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{attendanceToView.date}</p>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <p className="text-xs text-gray-500 font-medium">유형</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{attendanceToView.type}</p>
                      </div>

                      {(attendanceToView.startTime || attendanceToView.endTime) && (
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-gray-500 font-medium">시간</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">
                            {attendanceToView.startTime || '미정'} ~ {attendanceToView.endTime || '미정'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 사유 */}
                    {attendanceToView.reason && (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-amber-600 font-medium mb-1">사유</p>
                            <p className="text-sm text-amber-900 leading-relaxed">{attendanceToView.reason}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 버튼들 */}
                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setAttendanceDetailModalOpen(false);
                        setAttendanceToView(null);
                      }}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200"
                    >
                      닫기
                    </button>
                    <button
                      onClick={() => {
                        setAttendanceDetailModalOpen(false);
                        setAttendanceToView(null);
                        setAttendanceToDelete(attendanceToView);
                        setDeleteModalOpen(true);
                      }}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 삭제 확인 모달 */}
          {deleteModalOpen && attendanceToDelete && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-red-500 to-pink-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">근태 삭제 확인</h3>
                      <p className="text-red-100 text-sm">삭제된 데이터는 복구할 수 없습니다</p>
                    </div>
                  </div>
                </div>

                {/* 내용 */}
                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-red-900 font-medium mb-1">
                          <span className="font-semibold">{attendanceToDelete.userName}</span>님의 근태를 삭제하시겠습니까?
                        </p>
                        <p className="text-xs text-red-700">이 작업은 되돌릴 수 없습니다.</p>
                      </div>
                    </div>
                  </div>

                  {/* 근태 정보 */}
                  <div className="space-y-3 mb-6">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <p className="text-xs text-gray-500 font-medium">삭제할 근태 정보</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">날짜</p>
                          <p className="font-semibold text-gray-900">{attendanceToDelete.date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">유형</p>
                          <p className="font-semibold text-gray-900">{attendanceToDelete.type}</p>
                        </div>
                        {(attendanceToDelete.startTime || attendanceToDelete.endTime) && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">시간</p>
                            <p className="font-semibold text-gray-900">
                              {attendanceToDelete.startTime || '미정'} ~ {attendanceToDelete.endTime || '미정'}
                            </p>
                          </div>
                        )}
                        {attendanceToDelete.reason && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">사유</p>
                            <p className="font-semibold text-gray-900">{attendanceToDelete.reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 버튼들 */}
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setDeleteModalOpen(false);
                        setAttendanceToDelete(null);
                        setAttendanceToView(null);
                      }}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200"
                    >
                      취소
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 사용자 삭제 확인 모달 */}
          {userDeleteModalOpen && userToDelete && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-red-500 to-pink-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">사용자 삭제 확인</h3>
                      <p className="text-red-100 text-sm">삭제된 사용자는 복구할 수 없습니다</p>
                    </div>
                  </div>
                </div>

                {/* 내용 */}
                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-red-900 font-medium mb-2">
                          <span className="font-semibold">{userToDelete.name}</span>님을 삭제하시겠습니까?
                        </p>
                        <div className="text-xs text-red-700 space-y-1">
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            사용자의 모든 근태 기록이 함께 삭제됩니다.
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            삭제된 사용자는 복구할 수 없습니다.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 사용자 정보 */}
                  <div className="space-y-3 mb-6">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <p className="text-xs text-gray-500 font-medium">삭제할 사용자 정보</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">사번</p>
                          <p className="font-semibold text-gray-900">{userToDelete.username}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">이름</p>
                          <p className="font-semibold text-gray-900">{userToDelete.name}</p>
                        </div>
                        {userToDelete.department && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">소속</p>
                            <p className="font-semibold text-gray-900">{userToDelete.department}</p>
                          </div>
                        )}
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">권한</p>
                          <p className="font-semibold text-gray-900">{
                            userToDelete.role === 'admin' ? '관리자' :
                            userToDelete.role === 'manager' ? '중간관리자' :
                            '사용자'
                          }</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 버튼들 */}
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setUserDeleteModalOpen(false);
                        setUserToDelete(null);
                      }}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200"
                    >
                      취소
                    </button>
                    <button
                      onClick={confirmDeleteUser}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                      </svg>
                      삭제
                    </button>
                  </div>
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

          {/* 시작일자 선택 모달 */}
          {showStartDatePicker && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-hidden"
              >
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">시작일자 선택</h3>
                      <p className="text-orange-100 text-sm">근태 조회 시작일자를 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setShowStartDatePicker(false)}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
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
                    selectedColor="orange"
                    onEndDateSelect={() => {}}
                    onClose={() => setShowStartDatePicker(false)}
                    initialSelectingStart={true}
                    showConfirmButton={false}
                  />
                </div>
              </motion.div>
            </div>
          )}

          {/* 종료일자 선택 모달 */}
          {showEndDatePicker && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-hidden"
              >
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">종료일자 선택</h3>
                      <p className="text-orange-100 text-sm">근태 조회 종료일자를 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setShowEndDatePicker(false)}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
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
                    selectedColor="orange"
                    onClose={() => setShowEndDatePicker(false)}
                    initialSelectingStart={false}
                    showConfirmButton={false}
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
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">월 선택</h3>
                      <p className="text-orange-100 text-sm">근태 목록을 조회할 월을 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setShowMonthPicker(false)}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
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
                                ? 'bg-orange-500 text-white'
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
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">사용자 선택</h3>
                      <p className="text-violet-100 text-sm">근태를 추가할 사용자를 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setShowUserModal(false)}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-6">
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
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              selectedUserId === user.id
                                ? user.role === 'admin'
                                  ? 'bg-white/20 text-white'
                                  : user.role === 'manager'
                                  ? 'bg-green-100/50 text-green-200'
                                  : 'bg-gray-100/50 text-gray-200'
                                : user.role === 'admin'
                                ? 'bg-blue-100 text-blue-700'
                                : user.role === 'manager'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {user.role === 'admin' ? '관리자' :
                               user.role === 'manager' ? '중간관리자' :
                               '사용자'}
                            </span>
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
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">권한 선택</h3>
                      <p className="text-blue-100 text-sm">사용자의 권한을 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setShowRoleModal(false)}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
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
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">근태 유형 선택</h3>
                      <p className="text-violet-100 text-sm">등록할 근태의 유형을 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setShowTypeModal(false)}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-6">
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
                              ? 'bg-red-400 text-white'
                              : 'bg-red-50 text-red-900 border border-red-200 hover:bg-red-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">✈️</span>
                            <div>
                              <div className="font-medium text-xs">연차</div>
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
                              ? 'bg-yellow-400 text-white'
                              : 'bg-yellow-50 text-yellow-900 border border-yellow-200 hover:bg-yellow-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🏠</span>
                            <div>
                              <div className="font-medium text-xs">체휴</div>
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
                              ? 'bg-blue-400 text-white'
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
                              ? 'bg-orange-400 text-white'
                              : 'bg-orange-50 text-orange-900 border border-orange-200 hover:bg-orange-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🌅</span>
                            <div>
                              <div className="font-medium text-xs">오전반차</div>
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
                              ? 'bg-green-400 text-white'
                              : 'bg-green-50 text-green-900 border border-green-200 hover:bg-green-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🌆</span>
                            <div>
                              <div className="font-medium text-xs">오후반차</div>
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
                              ? 'bg-purple-400 text-white'
                              : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🌄</span>
                            <div>
                              <div className="font-medium text-xs">반반차</div>
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
                              ? 'bg-gray-400 text-white'
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
                              ? 'bg-gray-400 text-white'
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
                              ? 'bg-gray-400 text-white'
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
                              ? 'bg-gray-400 text-white'
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
                              ? 'bg-gray-400 text-white'
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
                              ? 'bg-gray-400 text-white'
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
                                ? 'bg-gray-400 text-white'
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
                              ? 'bg-gray-400 text-white'
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
                      선택된 유형: {selectedType || '없음'}
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
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">시작시간 선택</h3>
                      <p className="text-violet-100 text-sm">근태 시작 시간을 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setShowStartTimeModal(false)}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                <div className="p-4 max-h-96 overflow-y-auto">
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
                              ? 'bg-violet-500 text-white'
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
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">종료시간 선택</h3>
                      <p className="text-violet-100 text-sm">근태 종료 시간을 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setShowEndTimeModal(false)}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                <div className="p-4 max-h-96 overflow-y-auto">
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
                              ? 'bg-violet-500 text-white'
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
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">사용자 필터</h3>
                      <p className="text-orange-100 text-sm">근태 목록을 필터링할 사용자를 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setShowUserFilter(false)}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
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
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              selectedUserFilter === user.name
                                ? user.role === 'admin'
                                  ? 'bg-white/20 text-white'
                                  : user.role === 'manager'
                                  ? 'bg-green-100/50 text-green-200'
                                  : 'bg-gray-100/50 text-gray-200'
                                : user.role === 'admin'
                                ? 'bg-blue-100 text-blue-700'
                                : user.role === 'manager'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {user.role === 'admin' ? '관리자' :
                               user.role === 'manager' ? '중간관리자' :
                               '사용자'}
                            </span>
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
  onDeleteAttendance,
  onViewAttendance
}: {
  selectedMonth: string;
  attendances: Attendance[];
  users: User[];
  onDeleteAttendance: (id: string) => void;
  onViewAttendance: (attendance: Attendance) => void;
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

  // 근태 시간을 시간 슬롯에 매핑 (색상과 근태 ID 정보 포함)
  const getTimeSlotData = (attendances: Attendance[]) => {
    const timeSlots = generateTimeSlots(); // 18개 슬롯
    const slotData = new Array(18).fill(null).map(() => ({
      color: 'bg-gray-100',
      attendanceId: null as string | null
    })); // 기본 회색, ID 없음

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

      // 해당 슬롯 범위에 색상과 근태 ID 적용
      for (let i = startSlot; i <= endSlot; i++) {
        slotData[i] = {
          color: color,
          attendanceId: attendance.id
        };
      }
    });

    return slotData;
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
    // 날짜 클릭은 이제 개별 슬롯 클릭으로 대체되었으므로 아무 동작도 하지 않음
    // 필요시 날짜별 근태 목록 모달을 띄우는 기능으로 변경 가능
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
                const slotData = getTimeSlotData(dayAttendances);
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
                      {slotData.map((slot, index) => (
                        <div
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation(); // 부모 버튼 클릭 방지
                            if (slot.attendanceId) {
                              const attendance = attendances.find(a => a.id === slot.attendanceId);
                              if (attendance) {
                                onViewAttendance(attendance);
                              }
                            }
                          }}
                          className={`h-1 w-full rounded-sm ${slot.color} border border-gray-200 ${
                            slot.attendanceId ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''
                          }`}
                          title={`${9 + Math.floor(index / 2)}:${index % 2 === 0 ? '00' : '30'}${slot.attendanceId ? ' (클릭하여 상세정보)' : ''}`}
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
        <p className="text-xs text-gray-500 mt-3">시간 슬롯을 클릭하면 해당 근태의 상세정보를 볼 수 있습니다. 각 칸의 작은 바는 30분 단위를 나타냅니다.</p>
      </div>
    </div>
  );
}

