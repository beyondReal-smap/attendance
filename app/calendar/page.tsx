'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import { AttendanceType } from '@/types';
import AttendanceModal from '@/components/AttendanceModal';
import AlertModal from '@/components/AlertModal';
import HamburgerMenu from '@/components/HamburgerMenu';
import MobileCalendar from '@/components/MobileCalendar';
import AIChatModal from '@/components/AIChatModal';
import PasswordChangeModal from '@/components/PasswordChangeModal';

dayjs.locale('ko');

interface Attendance {
  date: string;
  type: AttendanceType;
  reason?: string | null;
  startTime?: string;
  endTime?: string;
}

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

  // Alert 모달 상태
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'success' | 'error' | 'warning'>('info');

  // AI 채팅 관련 상태
  const [aiChatModalOpen, setAiChatModalOpen] = useState(false);

  useEffect(() => {
    fetchUserAndAttendances();

    // 임시 비밀번호로 로그인한 경우 비밀번호 변경 모달 표시
    const isTempPasswordLogin = localStorage.getItem('tempPasswordLogin') === 'true';
    if (isTempPasswordLogin) {
      setShowPasswordChangeModal(true);
    }
  }, [currentMonth?.format('YYYY-MM')]);

  // 모달이 열려있을 때 body 스크롤 방지
  useEffect(() => {
    const hasModalOpen = isModalOpen || alertModalOpen || showPasswordChangeModal || aiChatModalOpen;

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
  }, [isModalOpen, alertModalOpen, showPasswordChangeModal, aiChatModalOpen]);

  const fetchUserAndAttendances = async () => {
    try {
      setLoading(true);
      console.log('fetchUserAndAttendances called, currentMonth:', currentMonth?.format('YYYY-MM'));

      const year = currentMonth.year();
      const month = currentMonth.month() + 1;

      // 병렬로 데이터 요청
      const [userRes, attendanceRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch(`/api/attendance?year=${year}&month=${month}`)
      ]);

      if (!userRes.ok) {
        router.push('/login');
        return;
      }

      const userData = await userRes.json();

      // 임시비밀번호 사용자는 비밀번호 변경을 완료할 때까지 접근 불가
      if (userData.isTempPassword) {
        router.push('/login?tempPassword=true');
        return;
      }

      setUser(userData);

      if (attendanceRes.ok) {
        const attendanceData = await attendanceRes.json();
        console.log('Fetched attendance data:', attendanceData);
        setAttendances(attendanceData);
      } else {
        console.error('Failed to fetch attendance data, status:', attendanceRes.status);
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

  const selectedAttendance = selectedDate ? attendances.find(a => a.date === selectedDate.format('YYYY-MM-DD')) : null;
  const existingAttendances = selectedDate ? attendances.filter(a => a.date === selectedDate.format('YYYY-MM-DD')) : [];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)' }}>
      <div className="w-full bg-white min-h-screen shadow-lg pb-1">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b-2 border-blue-200 px-5 md:px-8 lg:px-12 py-4 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user?.name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">근태 관리</p>
            </div>
            <div className="flex gap-2">
              <HamburgerMenu
                items={[
                  ...(user && (user.role === 'admin' || user.role === 'manager') ? [{
                    label: '관리자',
                    onClick: () => router.push('/admin'),
                    className: 'text-gray-600'
                  }] : []),
                  {
                    label: 'AI 챗',
                    onClick: () => setAiChatModalOpen(true),
                    className: 'text-gray-600'
                  },
                  {
                    label: '로그아웃',
                    onClick: handleLogout,
                    className: 'text-red-600'
                  }
                ]}
              />
            </div>
          </div>

          {/* 연차/체휴 정보 */}
          {user && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-red-600 font-medium">연차</div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-xl font-bold text-red-700">{user.annualLeaveRemaining}</span>
                    <span className="text-xs text-red-500 font-medium">/{user.annualLeaveTotal}일</span>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 border border-yellow-200 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-yellow-600 font-medium">체휴</div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-xl font-bold text-yellow-700">{user.compLeaveRemaining}</span>
                    <span className="text-xs text-yellow-500 font-medium">/{user.compLeaveTotal}일</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="p-5 md:p-6 lg:p-8 bg-blue-50/30 rounded-xl border border-blue-100 mx-2 md:mx-4 lg:mx-6 mt-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            근태 달력
          </h2>
          <MobileCalendar
            selectedDay={selectedDate}
            onDayClick={handleDayClick}
            attendances={attendances}
            onMonthChange={handleMonthChange}
            onTodayClick={() => setSelectedDate(null)}
            onRefreshData={fetchUserAndAttendances}
            onSetAttendances={setAttendances}
          />
        </div>

        {/* 근태 유형 범례 */}
        <div className="mt-4 p-3 md:p-4 lg:p-6 bg-gray-50/50 rounded-xl border border-gray-200 mx-2 md:mx-4 lg:mx-6 mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            근태 유형 범례
          </h3>
          <div className="space-y-2">
            {/* 첫 번째 행 - 연차, 체휴, 근무 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                <span className="text-sm">✈️</span>
                <div>
                  <div className="font-medium text-red-900 text-sm">연차</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                <span className="text-sm">🏠</span>
                <div>
                  <div className="font-medium text-yellow-900 text-sm">체휴</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                <span className="text-sm">❌</span>
                <div>
                  <div className="font-medium text-blue-900 text-sm">결근</div>
                </div>
              </div>
            </div>

            {/* 두 번째 행 - 오전반차, 오후반차, 반반차 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                <span className="text-sm">🌅</span>
                <div>
                  <div className="font-medium text-orange-900 text-sm">오전반차</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                <span className="text-sm">🌆</span>
                <div>
                  <div className="font-medium text-green-900 text-sm">오후반차</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-200">
                <span className="text-sm">🌄</span>
                <div>
                  <div className="font-medium text-purple-900 text-sm">반반차</div>
                </div>
              </div>
            </div>

            {/* 세 번째 행 - 팀장대행, 동석(코칭), 교육 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm">👔</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">팀장대행</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm">👨‍🏫</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">동석(코칭)</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm">📚</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">교육</div>
                </div>
              </div>
            </div>

            {/* 네 번째 행 - 휴식, 출장, 장애 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm">😴</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">휴식</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm">🏢</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">출장</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm">⚠️</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">장애</div>
                </div>
              </div>
            </div>

            {/* 다섯 번째 행 - 기타, 연장근무 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm">❓</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">기타</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm">⏰</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">연장근무</div>
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
        existingAttendances={existingAttendances}
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
              선택한 날짜에 이미 근태가 입력되어 있습니다.<br />
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
      <PasswordChangeModal
        isOpen={showPasswordChangeModal}
        onClose={() => setShowPasswordChangeModal(false)}
        onSuccess={() => setShowPasswordChangeModal(false)}
        onAlert={(title, message, type) => {
          setAlertTitle(title);
          setAlertMessage(message);
          setAlertType(type);
          setAlertModalOpen(true);
        }}
      />

      {/* Alert 모달 */}
      <AlertModal
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
      />

      {/* AI 채팅 모달 */}
      <AIChatModal
        isOpen={aiChatModalOpen}
        onClose={() => setAiChatModalOpen(false)}
      />
    </div>
  );
}
