'use client';

import { useEffect, useState, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';
import { AttendanceType } from '@/types';
import AttendanceModal from '@/components/AttendanceModal';
import AlertModal from '@/components/AlertModal';

dayjs.locale('ko');

interface Attendance {
  date: string;
  type: AttendanceType;
  reason?: string | null;
  startTime?: string;
  endTime?: string;
}

const MobileCalendar = memo(({ 
  selectedDay, 
  onDayClick, 
  attendances,
  onMonthChange
}: { 
  selectedDay: Dayjs | null; 
  onDayClick: (day: Dayjs) => void;
  attendances: Attendance[];
  onMonthChange?: (year: number, month: number) => void;
}) => {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('right');
  
  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfMonth = currentMonth.startOf('month').day();
  const today = dayjs();

  // 총 42개의 셀(6주 × 7일)을 고정으로 사용
  const totalCells = 42;
  const emptyCellsAtStart = firstDayOfMonth;
  
  const attendanceMap = useMemo(() => {
    return attendances.reduce((acc, attendance) => {
      acc[attendance.date] = {
        type: attendance.type,
        startTime: attendance.startTime,
        endTime: attendance.endTime
      };
      return acc;
    }, {} as Record<string, {type: AttendanceType, startTime?: string, endTime?: string}>);
  }, [attendances]);

  const getAttendanceColor = (type: AttendanceType | null): string => {
    switch (type) {
      case '연차':
        return 'bg-red-50 text-red-900 border border-red-200';
      case '오전반차':
        return 'bg-orange-50 text-orange-900 border border-orange-200';
      case '오후반차':
        return 'bg-green-50 text-green-900 border border-green-200';
      case '반반차':
        return 'bg-purple-50 text-purple-900 border border-purple-200';
      case '체휴':
        return 'bg-yellow-50 text-yellow-900 border border-yellow-200';
      case '팀장대행':
        return 'bg-gray-50 text-gray-900 border border-gray-200';
      case '코칭':
        return 'bg-gray-50 text-gray-900 border border-gray-200';
      case '교육':
        return 'bg-gray-50 text-gray-900 border border-gray-200';
      case '휴식':
        return 'bg-gray-50 text-gray-900 border border-gray-200';
      case '출장':
        return 'bg-gray-50 text-gray-900 border border-gray-200';
      case '장애':
        return 'bg-gray-50 text-gray-900 border border-gray-200';
      case '기타':
        return 'bg-gray-50 text-gray-900 border border-gray-200';
      case '연장근무':
        return 'bg-gray-50 text-gray-900 border border-gray-200';
      case '결근':
        return 'bg-blue-50 text-blue-900 border border-blue-200';
      default:
        return 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200';
    }
  };

  const getAttendanceTextColor = (type: AttendanceType | null): string => {
    switch (type) {
      case '연차':
        return 'text-red-900';
      case '오전반차':
        return 'text-orange-900';
      case '오후반차':
        return 'text-green-900';
      case '반반차':
        return 'text-purple-900';
      case '체휴':
        return 'text-yellow-900';
      case '팀장대행':
        return 'text-gray-900';
      case '코칭':
        return 'text-gray-900';
      case '교육':
        return 'text-gray-900';
      case '휴식':
        return 'text-gray-900';
      case '출장':
        return 'text-gray-900';
      case '장애':
        return 'text-gray-900';
      case '기타':
        return 'text-gray-900';
      case '연장근무':
        return 'text-gray-900';
      case '결근':
        return 'text-blue-900';
      default:
        return 'text-gray-700';
    }
  };

  const getAttendanceIcon = (type: AttendanceType | null): string => {
    switch (type) {
      case '연차': return '✈️';
      case '오전반차': return '🌅';
      case '오후반차': return '🌆';
      case '반반차': return '🌄';
      case '체휴': return '🏠';
      case '팀장대행': return '👔';
      case '코칭': return '👨‍🏫';
      case '교육': return '📚';
      case '휴식': return '😴';
      case '출장': return '🏢';
      case '장애': return '⚠️';
      case '기타': return '❓';
      case '연장근무': return '⏰';
      case '결근': return '❌';
      default: return '';
    }
  };

  const handlePrevMonth = () => {
    setAnimationDirection('left');
    setIsAnimating(true);
    setTimeout(() => {
      const newMonth = currentMonth.subtract(1, 'month');
      setCurrentMonth(newMonth);
      setIsAnimating(false);
      if (onMonthChange) {
        onMonthChange(newMonth.year(), newMonth.month() + 1);
      }
    }, 150);
  };

  const handleNextMonth = () => {
    setAnimationDirection('right');
    setIsAnimating(true);
    setTimeout(() => {
      const newMonth = currentMonth.add(1, 'month');
      setCurrentMonth(newMonth);
      setIsAnimating(false);
      if (onMonthChange) {
        onMonthChange(newMonth.year(), newMonth.month() + 1);
      }
    }, 150);
  };

  const handleToday = () => {
    setAnimationDirection('right');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentMonth(today);
      onDayClick(today);
      setIsAnimating(false);
    }, 150);
  };

  const renderCalendarDays = () => {
    const days = [];

    // 총 42개의 셀 생성 (6주 × 7일)
    for (let i = 0; i < totalCells; i++) {
      const dayIndex = i - emptyCellsAtStart;

      // 빈 칸 (월의 시작 전)
      if (dayIndex < 0) {
        days.push(<div key={`empty-start-${i}`} className="h-12"></div>);
        continue;
      }

      // 빈 칸 (월의 끝 후)
      if (dayIndex >= daysInMonth) {
        days.push(<div key={`empty-end-${i}`} className="h-12"></div>);
        continue;
      }

      // 현재 달의 날짜
      const currentDate = currentMonth.date(dayIndex + 1);
      const dateString = currentDate.format('YYYY-MM-DD');
      const isSelected = selectedDay?.isSame(currentDate, 'day');
      const isToday = today.isSame(currentDate, 'day');
      const attendanceInfo = attendanceMap[dateString] || null;
      const attendanceType = attendanceInfo?.type || null;
      const colors = getAttendanceColor(attendanceType);
      const textColor = getAttendanceTextColor(attendanceType);
      const icon = getAttendanceIcon(attendanceType);

      days.push(
        <motion.button
          key={dayIndex + 1}
          onClick={() => onDayClick(currentDate)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className={`
            h-12 w-full rounded-lg flex flex-col items-center justify-center text-sm font-semibold
            transition-all duration-200 relative
            ${colors}
            ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
            ${isToday && !isSelected ? 'ring-2 ring-gray-300' : ''}
            ${!attendanceType ? 'border border-gray-200' : ''}
          `}
        >
          <span className={`${attendanceType ? textColor : 'text-black'} text-sm font-semibold`}>
            {dayIndex + 1}
          </span>
          {attendanceType && (
            <div className="flex flex-col items-center mt-0.5">
              <span className="text-xs">{icon}</span>
              {attendanceType === '반반차' && attendanceInfo?.startTime && attendanceInfo?.endTime && (
                <span className="text-xs text-gray-600 mt-0.5">
                  {attendanceInfo.startTime}~{attendanceInfo.endTime}
                </span>
              )}
            </div>
          )}
        </motion.button>
      );
    }

    return days;
  };

  return (
    <div className="bg-gray-50/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-gray-200">
      {/* 캘린더 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <motion.button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={isAnimating}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiChevronLeft className="w-5 h-5 text-gray-700" />
        </motion.button>
        
        <div className="text-center">
          <motion.h2 
            key={currentMonth.format('YYYY-MM')}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-lg font-bold text-gray-900"
          >
            {currentMonth.format('YYYY년 M월')}
          </motion.h2>
          <motion.button
            onClick={handleToday}
            className="text-xs text-gray-600 hover:text-blue-700 font-medium mt-1"
            disabled={isAnimating}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            오늘
          </motion.button>
        </div>
        
        <motion.button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={isAnimating}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiChevronRight className="w-5 h-5 text-gray-700" />
        </motion.button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
          <div key={day} className={`h-8 flex items-center justify-center text-xs font-semibold ${
            index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
          }`}>
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentMonth.format('YYYY-MM')}
          initial={{ 
            opacity: 0, 
            x: animationDirection === 'right' ? 50 : -50 
          }}
          animate={{ 
            opacity: 1, 
            x: 0 
          }}
          exit={{ 
            opacity: 0, 
            x: animationDirection === 'right' ? -50 : 50 
          }}
          transition={{ 
            duration: 0.3,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
          className="grid grid-cols-7 gap-1.5"
        >
          {renderCalendarDays()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

MobileCalendar.displayName = 'MobileCalendar';

export default function CalendarPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    userId: string;
    username: string;
    name: string;
    role: string;
    isAdmin: boolean;
    annualLeaveTotal: number;
    annualLeaveUsed: number;
    annualLeaveRemaining: number;
    compLeaveTotal: number;
    compLeaveUsed: number;
    compLeaveRemaining: number;
  } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Alert 모달 상태
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'success' | 'error' | 'warning'>('info');

  useEffect(() => {
    fetchUserAndAttendances();

    // 임시 비밀번호로 로그인한 경우 비밀번호 변경 모달 표시
    const isTempPasswordLogin = localStorage.getItem('tempPasswordLogin') === 'true';
    if (isTempPasswordLogin) {
      setShowPasswordChangeModal(true);
    }
  }, [currentMonth]);

  const fetchUserAndAttendances = async () => {
    try {
      const userRes = await fetch('/api/auth/session');
      if (!userRes.ok) {
        router.push('/login');
        return;
      }
      const userData = await userRes.json();
      setUser(userData);

      // 임시 비밀번호(4자리 숫자)로 로그인한 경우 비밀번호 변경 모달 표시
      const isTempPassword = /^\d{4}$/.test(''); // 실제로는 세션에서 비밀번호 정보를 받아와야 함
      // TODO: 세션에 임시 비밀번호 정보 추가 필요

      const year = currentMonth.year();
      const month = currentMonth.month() + 1;
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

  const handleDayClick = (day: Dayjs) => {
    setSelectedDate(day);
    setIsModalOpen(true);
  };

  // 비밀번호 변경 핸들러
  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      setAlertTitle('오류');
      setAlertMessage('모든 필드를 입력해주세요.');
      setAlertType('error');
      setAlertModalOpen(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setAlertTitle('오류');
      setAlertMessage('새 비밀번호가 일치하지 않습니다.');
      setAlertType('error');
      setAlertModalOpen(true);
      return;
    }

    if (newPassword.length < 6) {
      setAlertTitle('오류');
      setAlertMessage('비밀번호는 최소 6자리 이상이어야 합니다.');
      setAlertType('error');
      setAlertModalOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (res.ok) {
        setAlertTitle('성공');
        setAlertMessage('비밀번호가 성공적으로 변경되었습니다.');
        setAlertType('success');
        setAlertModalOpen(true);
        setShowPasswordChangeModal(false);
        setNewPassword('');
        setConfirmPassword('');
        // 임시 비밀번호 플래그 제거
        localStorage.removeItem('tempPasswordLogin');
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

  const checkTimeOverlap = (existingAttendances: Attendance[], newStartTime?: string, newEndTime?: string): Attendance | null => {
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

  const handleSaveAttendance = async (data: {
    startDate: string;
    endDate: string;
    type: AttendanceType;
    reason: string;
    days: number;
    startTime?: string;
    endTime?: string;
  }) => {
    // 같은 날짜의 기존 근태들을 확인
    const existingAttendancesOnDate = attendances.filter(a => a.date === data.startDate);

    // 시간 겹침 체크 (시간 정보가 있는 근태들만)
    const overlappingAttendance = checkTimeOverlap(existingAttendancesOnDate, data.startTime, data.endTime);
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

    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || '근태 등록에 실패했습니다.');
    }

    // 데이터 새로고침
    await fetchUserAndAttendances();
  };

  const handleMonthChange = (year: number, month: number) => {
    setCurrentMonth(dayjs().year(year).month(month - 1));
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

  const selectedAttendance = selectedDate ? attendances.find(a => a.date === selectedDate.format('YYYY-MM-DD')) : null;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)' }}>
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg pb-1">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b-2 border-blue-200 px-5 py-4 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-black text-gray-900">{user?.name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">근태 관리</p>
            </div>
            <div className="flex gap-2">
              {user && user.role === 'admin' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-all"
                >
                  관리자
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-all"
              >
                로그아웃
              </button>
            </div>
          </div>

          {/* 연차/체휴/근무 정보 */}
          {user && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <div className="text-xs text-red-600 font-medium mb-2">연차</div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-red-700 font-medium">잔여</span>
                    <span className="text-xl font-bold text-red-700">{user.annualLeaveRemaining}일</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-red-600">사용</span>
                    <span className="text-xs text-red-600">{user.annualLeaveUsed}일</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-red-500">전체</span>
                    <span className="text-xs text-red-500">{user.annualLeaveTotal}일</span>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                <div className="text-xs text-yellow-600 font-medium mb-2">체휴</div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-yellow-700 font-medium">잔여</span>
                    <span className="text-xl font-bold text-yellow-700">{user.compLeaveRemaining}일</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-yellow-600">사용</span>
                    <span className="text-xs text-yellow-600">{user.compLeaveUsed}일</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-yellow-500">전체</span>
                    <span className="text-xs text-yellow-500">{user.compLeaveTotal}일</span>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <div className="text-xs text-gray-600 font-medium mb-2">{currentMonth.format('M월')} 결근 현황</div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-blue-700 font-medium">결근일</span>
                    <span className="text-xl font-bold text-blue-700">
                      {attendances.filter(a => {
                        const attendanceMonth = dayjs(a.date).format('YYYY-MM');
                        return attendanceMonth === currentMonth.format('YYYY-MM') &&
                               a.type === '결근';
                      }).length}일
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="p-5 bg-blue-50/30 rounded-xl border border-blue-100 mx-2 mt-4">
          <h2 className="text-lg font-black text-gray-900 mb-4">
            근태 달력
          </h2>
          <MobileCalendar
            selectedDay={selectedDate}
            onDayClick={handleDayClick}
            attendances={attendances}
            onMonthChange={handleMonthChange}
          />
        </div>

        {/* 근태 유형 범례 */}
        <div className="mt-4 p-3 bg-gray-50/50 rounded-xl border border-gray-200 mx-2 mb-4">
            <h3 className="text-base font-bold text-gray-900 mb-3">
              근태 유형 범례
            </h3>
            <div className="space-y-2">
              {/* 첫 번째 행 - 연차, 체휴, 근무 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                  <span className="text-sm">✈️</span>
                  <div>
                    <div className="font-medium text-red-900 text-xs">연차</div>
                    <div className="text-xs text-red-600">1일</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                  <span className="text-sm">🏠</span>
                  <div>
                    <div className="font-medium text-yellow-900 text-xs">체휴</div>
                    <div className="text-xs text-yellow-600">1일</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                  <span className="text-sm">❌</span>
                  <div>
                    <div className="font-medium text-blue-900 text-xs">결근</div>
                  </div>
                </div>
              </div>

              {/* 두 번째 행 - 오전반차, 오후반차, 반반차 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                  <span className="text-sm">🌅</span>
                  <div>
                    <div className="font-medium text-orange-900 text-xs">오전반차</div>
                    <div className="text-xs text-orange-600">0.5일</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                  <span className="text-sm">🌆</span>
                  <div>
                    <div className="font-medium text-green-900 text-xs">오후반차</div>
                    <div className="text-xs text-green-600">0.5일</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-200">
                  <span className="text-sm">🌄</span>
                  <div>
                    <div className="font-medium text-purple-900 text-xs">반반차</div>
                    <div className="text-xs text-purple-600">0.25일</div>
                  </div>
                </div>
              </div>

              {/* 세 번째 행 - 팀장대행, 코칭, 교육 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm">👔</span>
                  <div>
                    <div className="font-medium text-gray-900 text-xs">팀장대행</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm">👨‍🏫</span>
                  <div>
                    <div className="font-medium text-gray-900 text-xs">코칭</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm">📚</span>
                  <div>
                    <div className="font-medium text-gray-900 text-xs">교육</div>
                  </div>
                </div>
              </div>

              {/* 네 번째 행 - 휴식, 출장, 장애 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm">😴</span>
                  <div>
                    <div className="font-medium text-gray-900 text-xs">휴식</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm">🏢</span>
                  <div>
                    <div className="font-medium text-gray-900 text-xs">출장</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm">⚠️</span>
                  <div>
                    <div className="font-medium text-gray-900 text-xs">장애</div>
                  </div>
                </div>
              </div>

              {/* 다섯 번째 행 - 기타, 연장근무 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm">❓</span>
                  <div>
                    <div className="font-medium text-gray-900 text-xs">기타</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm">⏰</span>
                  <div>
                    <div className="font-medium text-gray-900 text-xs">연장근무</div>
                  </div>
                </div>
              </div>

            </div>
        </div>
      </div>

      {/* 근태 등록 모달 */}
      <AttendanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        onSave={handleSaveAttendance}
        onAlert={(title, message, type) => {
          setAlertTitle(title);
          setAlertMessage(message);
          setAlertType(type);
          setAlertModalOpen(true);
        }}
      />

      {/* 이미 근태가 입력된 날짜 경고 모달 - 더 이상 사용하지 않음 */}
      <div className={`fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 transition-opacity duration-200 opacity-0 pointer-events-none`}>
        <div className={`bg-white rounded-xl shadow-xl max-w-sm w-full transform transition-transform duration-200 ${isModalOpen && selectedAttendance ? 'scale-100' : 'scale-95'}`}>
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">근태 입력 불가</h3>
            <p className="text-sm text-gray-600 mb-6">
              선택한 날짜에 이미 근태가 입력되어 있습니다.<br/>
              근태 수정을 원하시면 관리자에게 문의해주세요.
            </p>
            <button
              onClick={() => setIsModalOpen(false)}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition"
            >
              확인
            </button>
          </div>
        </div>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordChangeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">비밀번호 변경</h3>
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-4">
                보안을 위해 임시 비밀번호로 로그인하셨습니다. 새로운 비밀번호를 설정해주세요.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="text-sm text-yellow-800">
                  <div className="font-medium mb-1">비밀번호 요구사항:</div>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    <li>최소 6자리 이상</li>
                    <li>보안을 위해 강력한 비밀번호를 사용하세요</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호를 다시 입력하세요"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPasswordChangeModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  나중에 변경
                </button>
                <button
                  onClick={handlePasswordChange}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  비밀번호 변경
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
    </div>
  );
}
