'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import { FiX, FiCalendar, FiEdit3, FiTrash2 } from 'react-icons/fi';
import { AttendanceType } from '@/types';
import { countWorkingDays, getDateRange } from '@/lib/holidays';
import { getAttendanceTimeInfo } from '@/lib/attendance-utils';
import { DatePickerCalendar } from './DatePickerCalendar';

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

interface ExistingAttendance {
  date: string;
  type: AttendanceType;
  reason?: string | null;
  startTime?: string;
  endTime?: string;
}

interface AttendanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendance: Attendance | null;
  users: User[];
  onSave: (data: {
    id: string;
    startDate: string;
    endDate: string;
    type: AttendanceType;
    startTime?: string;
    endTime?: string;
  }) => Promise<void>;
  onDelete: (attendance: Attendance) => void;
  onAlert?: (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning') => void;
}

export default function AttendanceDetailModal({
  isOpen,
  onClose,
  attendance,
  users,
  onSave,
  onDelete,
  onAlert
}: AttendanceDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editType, setEditType] = useState<AttendanceType>('연차');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [loading, setLoading] = useState(false);

  // 모달 상태들
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);

  // 근태 데이터 초기화
  useEffect(() => {
    if (isOpen && attendance) {
      setEditStartDate(attendance.date);
      setEditEndDate(attendance.date);
      setEditType(attendance.type);
      setEditStartTime(attendance.startTime || '');
      setEditEndTime(attendance.endTime || '');
      setIsEditing(false);
    }
  }, [isOpen, attendance]);

  // 내부 모달이 열려있을 때 body 스크롤 방지
  useEffect(() => {
    const hasInnerModalOpen = showStartCalendar || showTypeModal || showStartTimeModal || showEndTimeModal;

    if (hasInnerModalOpen) {
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
  }, [showStartCalendar, showTypeModal, showStartTimeModal, showEndTimeModal]);

  // 모달 위치 강제 고정 (body padding 변경 시 레이아웃 시프트 방지)
  useEffect(() => {
    if (isOpen) {
      const modalElement = document.querySelector('[data-modal="attendance-detail"]') as HTMLElement;
      if (modalElement) {
        // 강제로 viewport 기준으로 위치 설정
        modalElement.style.bottom = '0px';
        modalElement.style.left = '0px';
        modalElement.style.right = '0px';
        modalElement.style.position = 'fixed';
        modalElement.style.zIndex = '50';
      }
    }
  }, [isOpen]);

  // body padding 변경 시 모달 위치 재설정
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const modalElement = document.querySelector('[data-modal="attendance-detail"]') as HTMLElement;
      if (modalElement && isOpen) {
        modalElement.style.bottom = '0px';
      }
    });

    if (isOpen) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['style']
      });
    }

    return () => observer.disconnect();
  }, [isOpen]);

  // 시간 옵션 생성 함수 (9:00 ~ 18:00, 30분 간격)
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 9; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 18 && minute === 30) break; // 18:30은 제외
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  // 시간을 13시 30분 형식으로 변환
  const formatTimeDisplay = (timeString: string) => {
    if (!timeString) return '';
    const [hour, minute] = timeString.split(':').map(Number);
    if (minute === 0) {
      return `${hour}시`;
    } else {
      return `${hour}시 ${minute}분`;
    }
  };

  // 근태 유형 변경 시 자동 설정 로직
  useEffect(() => {
    if (editStartDate) {
      const timeInfo = getAttendanceTimeInfo(editType);
      // 반차의 경우 시작일자와 종료일자를 같게 설정
      if (timeInfo.days < 1 && timeInfo.days > 0) {
        setEditEndDate(editStartDate);
      }
      // 반차나 반반차의 경우 고정된 시간 설정
      if (editType === '오전반차') {
        setEditStartTime('09:00');
        setEditEndTime('14:00');
      } else if (editType === '오후반차') {
        setEditStartTime('14:00');
        setEditEndTime('18:00');
      } else if (editType === '연차' || editType === '체휴' || editType === '결근') {
        setEditStartTime('09:00');
        setEditEndTime('18:00');
      }
    }
  }, [editType, editStartDate]);

  // 현재 근태와 같은 날짜의 다른 근태들 (시간 겹침 체크용)
  const existingAttendancesOnDate: ExistingAttendance[] = useMemo(() => {
    if (!attendance || !editStartDate) return [];
    // 같은 날짜의 다른 근태들만 필터링
    return []; // 실제로는 API에서 가져와야 함
  }, [attendance, editStartDate]);

  const checkTimeOverlap = (newStartTime?: string, newEndTime?: string): ExistingAttendance | null => {
    if (!newStartTime || !newEndTime) return null;

    const newStart = new Date(`2000-01-01T${newStartTime}`);
    const newEnd = new Date(`2000-01-01T${newEndTime}`);

    for (const existing of existingAttendancesOnDate) {
      if (existing.startTime && existing.endTime) {
        const existingStart = new Date(`2000-01-01T${existing.startTime}`);
        const existingEnd = new Date(`2000-01-01T${existing.endTime}`);

        if (newStart < existingEnd && newEnd > existingStart) {
          return existing;
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!attendance) return;

    // 시간 겹침 체크
    const overlappingAttendance = checkTimeOverlap(editStartTime, editEndTime);
    if (overlappingAttendance) {
      const timeInfo = overlappingAttendance.startTime && overlappingAttendance.endTime
        ? `${formatTimeDisplay(overlappingAttendance.startTime)} ~ ${formatTimeDisplay(overlappingAttendance.endTime)}`
        : '';
      if (onAlert) onAlert('근태 시간대 중복', `선택한 시간대에 이미 '${overlappingAttendance.type}' 근태가 입력되어 있습니다.\n시간대: ${timeInfo}`, 'error');
      return;
    }

    // 특정 근태 유형들은 시작시간과 종료시간이 필수
    const timeRequiredTypes = ['팀장대행', '동석(코칭)', '교육', '휴식', '출장', '장애', '기타', '연장근무', '반반차'];
    if (timeRequiredTypes.includes(editType)) {
      if (!editStartTime || !editEndTime) {
        if (onAlert) onAlert('시간 입력 필요', `${editType} 근태는 시작시간과 종료시간을 입력해야 합니다.`, 'error');
        return;
      }
    }

    setLoading(true);
    try {
      await onSave({
        id: attendance.id.toString(),
        startDate: editStartDate,
        endDate: editEndDate,
        type: editType,
        startTime: (editType === '반반차' || timeRequiredTypes.includes(editType)) ? editStartTime : undefined,
        endTime: (editType === '반반차' || timeRequiredTypes.includes(editType)) ? editEndTime : undefined,
      });
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error('Error updating attendance:', error);
      if (onAlert) onAlert('오류', '근태 수정에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!attendance) return null;

  const user = users.find(u => u.username === attendance.userName);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2000,
              pointerEvents: 'none'
            }}
        >
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
            style={{
              pointerEvents: 'auto'
            }}
          />

          {/* Modal */}
          <motion.div
            data-modal="attendance-detail"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="absolute left-0 right-0 bottom-0 max-w-md mx-auto bg-white rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto touch-none"
            style={{
              bottom: 0,
              zIndex: 2001,
              pointerEvents: 'auto',
              transformOrigin: 'bottom'
            }}
          >
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isEditing ? '근태 수정' : '근태 상세 정보'}
                  </h3>
                  <p className="text-blue-100 text-sm">
                    {isEditing ? '근태 정보를 수정하세요' : '근태 기록의 세부 사항을 확인하세요'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                >
                  <FiX className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-5">
              {/* 사용자 정보 */}
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                  <span className="text-sm font-medium text-blue-900">{attendance.userName}</span>
                  {user && (
                    <span className="text-xs text-blue-600 ml-1">({user.name})</span>
                  )}
                </div>
              </div>

              {/* 수정 모드 토글 */}
              {!isEditing && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-700">근태 정보</span>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors flex items-center gap-1"
                  >
                    <FiEdit3 className="w-3 h-3" />
                    수정
                  </button>
                </div>
              )}

              {/* Form */}
              <div className="space-y-4">
                {/* 근태 유형 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    근태 유형
                  </label>
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => setShowTypeModal(true)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                    >
                      <span>
                        {(() => {
                          const labels: Record<string, string> = {
                            '연차': '연차 (1일)',
                            '오전반차': '오전반차 (0.5일)',
                            '오후반차': '오후반차 (0.5일)',
                            '반반차': '반반차 (0.25일)',
                            '체휴': '체휴 (1일)',
                            '팀장대행': '팀장대행',
                            '동석(코칭)': '동석(코칭)',
                            '교육': '교육',
                            '휴식': '휴식',
                            '출장': '출장',
                            '장애': '장애',
                            '기타': '기타',
                            '연장근무': '연장근무',
                            '결근': '결근'
                          };
                          return labels[editType] || editType;
                        })()}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  ) : (
                    <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-900">
                      {attendance.type}
                    </div>
                  )}
                </div>

                {/* 날짜 선택 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      시작일자
                    </label>
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowStartCalendar(true);
                          setShowEndCalendar(false);
                        }}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                      >
                        <span>{editStartDate}</span>
                        <FiCalendar className="w-4 h-4 text-gray-400" />
                      </button>
                    ) : (
                      <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-900">
                        {attendance.date}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      종료일자
                    </label>
                    {isEditing ? (
                      <button
                        type="button"
                        disabled={getAttendanceTimeInfo(editType).days < 1 && getAttendanceTimeInfo(editType).days > 0}
                        onClick={() => {
                          setShowEndCalendar(true);
                          setShowStartCalendar(false);
                        }}
                        className={`w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900 ${
                          getAttendanceTimeInfo(editType).days < 1 && getAttendanceTimeInfo(editType).days > 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <span>{editEndDate}</span>
                        <FiCalendar className="w-4 h-4 text-gray-400" />
                      </button>
                    ) : (
                      <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-900">
                        {attendance.date}
                      </div>
                    )}
                  </div>
                </div>

                {/* 시간 입력 - 반반차, 팀장대행, 동석(코칭), 교육, 휴식, 출장, 장애, 기타, 연장근무 */}
                {(isEditing || attendance.startTime || attendance.endTime) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        시작시간
                      </label>
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => setShowStartTimeModal(true)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                        >
                          <span>{editStartTime ? formatTimeDisplay(editStartTime) : '시간 선택'}</span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : (
                        <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-900">
                          {attendance.startTime ? formatTimeDisplay(attendance.startTime) : '-'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        종료시간
                      </label>
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => setShowEndTimeModal(true)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                        >
                          <span>{editEndTime ? formatTimeDisplay(editEndTime) : '시간 선택'}</span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : (
                        <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-900">
                          {attendance.endTime ? formatTimeDisplay(attendance.endTime) : '-'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 근태사유 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    근태사유
                  </label>
                  <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-900 min-h-[2.5rem]">
                    {attendance.reason || '-'}
                  </div>
                </div>

                {/* 버튼들 */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) {
                        setIsEditing(false);
                        // 수정 취소 시 원래 값으로 복원
                        setEditStartDate(attendance.date);
                        setEditEndDate(attendance.date);
                        setEditType(attendance.type);
                        setEditStartTime(attendance.startTime || '');
                        setEditEndTime(attendance.endTime || '');
                      } else {
                        onClose();
                      }
                    }}
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {isEditing ? '취소' : '닫기'}
                  </button>
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={loading}
                      className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? '수정 중...' : '수정'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDelete(attendance)}
                      className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                      삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* 날짜 선택 모달 */}
          {(showStartCalendar || showEndCalendar) && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 2100 }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-hidden"
                style={{ zIndex: 2101 }}
              >
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {showStartCalendar ? '시작일자 선택' : '종료일자 선택'}
                      </h3>
                      <p className="text-blue-100 text-sm">
                        근태 {showStartCalendar ? '시작' : '종료'}일자를 선택하세요
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowStartCalendar(false);
                        setShowEndCalendar(false);
                      }}
                      className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <FiX className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <DatePickerCalendar
                    startDate={editStartDate ? dayjs(editStartDate) : null}
                    endDate={editEndDate ? dayjs(editEndDate) : null}
                    onStartDateSelect={(date) => {
                      setEditStartDate(date.format('YYYY-MM-DD'));
                      setShowStartCalendar(false);
                    }}
                    onEndDateSelect={(date) => {
                      setEditEndDate(date.format('YYYY-MM-DD'));
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

          {/* 근태 유형 선택 모달 */}
          {showTypeModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 2100 }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
              >
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">근태 유형 선택</h3>
                      <p className="text-blue-100 text-sm">수정할 근태의 유형을 선택하세요</p>
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
                    <div className="text-sm font-medium text-gray-700 mb-3">
                      근태 유형을 선택하세요
                    </div>
                    <div className="space-y-2">
                      {/* 첫 번째 행 - 연차, 체휴, 결근 */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            setEditType('연차');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '연차'
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
                            setEditType('체휴');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '체휴'
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
                            setEditType('결근');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '결근'
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
                            setEditType('오전반차');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '오전반차'
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
                            setEditType('오후반차');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '오후반차'
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
                            setEditType('반반차');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '반반차'
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

                      {/* 세 번째 행 - 팀장대행, 동석(코칭), 교육 */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            setEditType('팀장대행');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '팀장대행'
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
                            setEditType('동석(코칭)');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '동석(코칭)'
                              ? 'bg-gray-400 text-white'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">👨‍🏫</span>
                            <div>
                              <div className="font-medium text-xs">동석(코칭)</div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setEditType('교육');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '교육'
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
                            setEditType('휴식');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '휴식'
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
                            setEditType('출장');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '출장'
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
                            setEditType('장애');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '장애'
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
                            setEditType('기타');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '기타'
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
                            setEditType('연장근무');
                            setEditStartTime('');
                            setEditEndTime('');
                            setShowTypeModal(false);
                          }}
                          className={`p-2 text-left rounded transition ${
                            editType === '연장근무'
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

                  <div className="text-center p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-sm font-medium text-purple-700">
                      선택된 유형: {editType}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* 시작시간 선택 모달 */}
          {showStartTimeModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 2100 }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
              >
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">시작시간 선택</h3>
                      <p className="text-blue-100 text-sm">근태 시작 시간을 선택하세요</p>
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
                    {generateTimeOptions().map((time) => {
                      const isTimeOccupied = existingAttendancesOnDate.some(attendance => {
                        if (!attendance.startTime || !attendance.endTime) return false;
                        const currentStart = new Date(`2000-01-01T${time}`);
                        const currentEnd = new Date(currentStart.getTime() + 30 * 60 * 1000);
                        const existingStart = new Date(`2000-01-01T${attendance.startTime}`);
                        const existingEnd = new Date(`2000-01-01T${attendance.endTime}`);
                        return currentStart < existingEnd && currentEnd > existingStart;
                      });

                      const isDisabled = !!(editEndTime && time >= editEndTime) || isTimeOccupied;
                      return (
                        <button
                          key={time}
                          onClick={() => {
                            if (!isDisabled) {
                              setEditStartTime(time);
                              if (editType === '반반차') {
                                const [hours, minutes] = time.split(':').map(Number);
                                const endDateTime = new Date();
                                endDateTime.setHours(hours + 2, minutes);
                                const endTimeStr = endDateTime.toTimeString().slice(0, 5);
                                setEditEndTime(endTimeStr);
                              }
                              setShowStartTimeModal(false);
                            }
                          }}
                          disabled={isDisabled}
                          className={`p-2 text-center rounded-lg transition text-xs font-medium leading-tight ${
                            editStartTime === time
                              ? 'bg-blue-500 text-white'
                              : isDisabled
                              ? isTimeOccupied
                                ? 'bg-red-100 text-red-400 cursor-not-allowed border border-red-200'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {formatTimeDisplay(time)}
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
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 2100 }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
              >
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">종료시간 선택</h3>
                      <p className="text-blue-100 text-sm">근태 종료 시간을 선택하세요</p>
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
                    {generateTimeOptions().map((time) => {
                      const isTimeOccupied = existingAttendancesOnDate.some(attendance => {
                        if (!attendance.startTime || !attendance.endTime) return false;
                        const currentStart = new Date(`2000-01-01T${time}`);
                        const currentEnd = new Date(currentStart.getTime() + 30 * 60 * 1000);
                        const existingStart = new Date(`2000-01-01T${attendance.startTime}`);
                        const existingEnd = new Date(`2000-01-01T${attendance.endTime}`);
                        return currentStart < existingEnd && currentEnd > existingStart;
                      });

                      const isDisabled = !!(editStartTime && time <= editStartTime) || isTimeOccupied;
                      return (
                        <button
                          key={time}
                          onClick={() => {
                            if (!isDisabled) {
                              setEditEndTime(time);
                              setShowEndTimeModal(false);
                            }
                          }}
                          disabled={isDisabled}
                          className={`p-2 text-center rounded-lg transition text-xs font-medium leading-tight ${
                            editEndTime === time
                              ? 'bg-blue-500 text-white'
                              : isDisabled
                              ? isTimeOccupied
                                ? 'bg-red-100 text-red-400 cursor-not-allowed border border-red-200'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {formatTimeDisplay(time)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
