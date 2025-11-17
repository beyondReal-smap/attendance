'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import { FiX, FiCalendar } from 'react-icons/fi';
import { AttendanceType } from '@/types';
import { countWorkingDays, getDateRange } from '@/lib/holidays';
import { getAttendanceTimeInfo } from '@/lib/attendance-utils';
import { DatePickerCalendar } from './DatePickerCalendar';

interface ExistingAttendance {
  date: string;
  type: AttendanceType;
  reason?: string | null;
  startTime?: string;
  endTime?: string;
}

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Dayjs | null;
  existingAttendances?: ExistingAttendance[];
  onSave: (data: {
    startDate: string;
    endDate: string;
    type: AttendanceType;
    reason: string;
    days: number;
    startTime?: string;
    endTime?: string;
  }) => Promise<void>;
  onAlert?: (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning') => void;
}

export default function AttendanceModal({ isOpen, onClose, selectedDate, existingAttendances = [], onSave, onAlert }: AttendanceModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [type, setType] = useState<AttendanceType>('연차');
  const [reason, setReason] = useState('');
  const [workingDays, setWorkingDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);


  useEffect(() => {
    if (isOpen && selectedDate) {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      setStartDate(dateStr);
      setEndDate(dateStr);
    }
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
    const [hour, minute] = timeString.split(':').map(Number);
    if (minute === 0) {
      return `${hour}시`;
    } else {
      return `${hour}시 ${minute}분`;
    }
  };

  // 시작시간 모달이 열릴 때 초기화 (버튼 방식이므로 스크롤 설정 불필요)

  // 종료시간 모달이 열릴 때 초기화 (버튼 방식이므로 스크롤 설정 불필요)


  // 근태 유형 변경 시 종료일자 자동 설정
  useEffect(() => {
    if (startDate) {
      const timeInfo = getAttendanceTimeInfo(type);
      // 반차나 반반차의 경우 종료일자를 시작일자와 같게 설정
      if (timeInfo.days < 1 && timeInfo.days > 0) {
        setEndDate(startDate);
      }
    }
  }, [type, startDate]);

  useEffect(() => {
    if (startDate && endDate) {
      const timeInfo = getAttendanceTimeInfo(type);

      // 반차나 반반차의 경우 고정된 일수 사용
      if (timeInfo.days < 1 && timeInfo.days > 0) {
        setWorkingDays(timeInfo.days);
      } else {
        // 그 외의 경우 기존 로직 사용
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      if (start.isValid() && end.isValid() && !end.isBefore(start)) {
        const days = countWorkingDays(start, end);
        setWorkingDays(days);
      } else {
        setWorkingDays(0);
      }
    }
    }
  }, [startDate, endDate, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 필수 필드 검증
    if (!startDate || !endDate) {
      if (onAlert) onAlert('오류', '시작일자와 종료일자를 선택해주세요.', 'error');
      return;
    }

    if (!reason.trim()) {
      if (onAlert) onAlert('근태 사유 입력 필요', '근태 사유를 입력해주세요.', 'error');
      return;
    }

    // 특정 근태 유형들은 시작시간과 종료시간이 필수
    const timeRequiredTypes = ['팀장대행', '코칭', '교육', '휴식', '출장', '장애', '기타', '연장근무', '반반차'];
    if (timeRequiredTypes.includes(type)) {
      if (!startTime || !endTime) {
        if (onAlert) onAlert('시간 입력 필요', `${type} 근태는 시작시간과 종료시간을 입력해야 합니다.`, 'error');
        return;
      }
    }

    const timeInfo = getAttendanceTimeInfo(type);
    const start = dayjs(startDate);
    const end = dayjs(endDate);

    // 반차나 반반차가 아닌 경우에만 종료일자 검증
    if (timeInfo.days >= 1 && end.isBefore(start)) {
      if (onAlert) onAlert('오류', '종료일자는 시작일자보다 이후여야 합니다.', 'error');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        startDate,
        endDate,
        type,
        reason: reason.trim(),
        days: workingDays,
        startTime: (type === '반반차' || type === '근무') ? startTime :
                   (type === '오전반차' ? '09:00' :
                    type === '오후반차' ? '14:00' :
                    ['연차', '체휴', '결근'].includes(type) ? '09:00' :
                    ['팀장대행', '코칭', '교육', '휴식', '출장', '장애', '기타', '연장근무'].includes(type) ? startTime : undefined),
        endTime: (type === '반반차' || type === '근무') ? endTime :
                 (type === '오전반차' ? '14:00' :
                  type === '오후반차' ? '18:00' :
                  ['연차', '체휴', '결근'].includes(type) ? '18:00' :
                  ['팀장대행', '코칭', '교육', '휴식', '출장', '장애', '기타', '연장근무'].includes(type) ? endTime : undefined),
      });
      // 초기화
      setStartDate('');
      setEndDate('');
      setStartTime('');
      setEndTime('');
      setReason('');
      setType('연차');
      onClose();
    } catch (error) {
      console.error('Error saving attendance:', error);
      if (onAlert) onAlert('오류', '근태 등록에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="attendance-modal">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed left-0 right-0 bottom-0 max-w-md mx-auto bg-white rounded-t-2xl shadow-xl z-50 max-h-[90vh] overflow-y-auto"
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
                  <h3 className="text-lg font-bold text-white">근태 등록</h3>
                  <p className="text-blue-100 text-sm">새로운 근태를 등록하세요</p>
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

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 근태 유형 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    근태 유형
                  </label>
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
                          '코칭': '코칭',
                          '교육': '교육',
                          '휴식': '휴식',
                          '출장': '출장',
                          '장애': '장애',
                          '기타': '기타',
                          '연장근무': '연장근무',
                          '결근': '결근'
                        };
                        return labels[type] || type;
                      })()}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* 날짜 선택 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      시작일자
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowStartCalendar(true);
                        setShowEndCalendar(false);
                      }}
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                    >
                      <span>{startDate || '선택하세요'}</span>
                      <FiCalendar className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      종료일자
                    </label>
                    <button
                      type="button"
                      disabled={getAttendanceTimeInfo(type).days < 1 && getAttendanceTimeInfo(type).days > 0}
                      onClick={() => {
                        setShowEndCalendar(true);
                        setShowStartCalendar(false);
                      }}
                      className={`w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900 ${
                        getAttendanceTimeInfo(type).days < 1 && getAttendanceTimeInfo(type).days > 0 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <span>{endDate || '선택하세요'}</span>
                      <FiCalendar className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* 시간 입력 - 반반차, 팀장대행, 코칭, 교육, 휴식, 출장, 장애, 기타, 연장근무 */}
                {['반반차', '팀장대행', '코칭', '교육', '휴식', '출장', '장애', '기타', '연장근무'].includes(type) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        시작시간
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowStartTimeModal(true)}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                      >
                        <span>{startTime ? formatTimeDisplay(startTime) : '시간 선택'}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        종료시간
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowEndTimeModal(true)}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-50 text-gray-900"
                      >
                        <span>{endTime ? formatTimeDisplay(endTime) : '시간 선택'}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

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
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">시작일자 선택</h3>
                              <p className="text-blue-100 text-sm">근태 시작일자를 선택하세요</p>
                            </div>
                            <button
                              onClick={() => setShowStartCalendar(false)}
                              className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                            >
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {showEndCalendar && (
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">종료일자 선택</h3>
                              <p className="text-blue-100 text-sm">근태 종료일자를 선택하세요</p>
                            </div>
                            <button
                              onClick={() => setShowEndCalendar(false)}
                              className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                            >
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
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

                {/* 근태 일수 표시 - 특정 유형 제외 */}
                {workingDays > 0 && !['팀장대행', '코칭', '교육', '휴식', '출장', '장애', '기타', '연장근무', '결근'].includes(type) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-blue-700">근태 일수</span>
                      <span className="text-xl font-bold text-blue-700">{workingDays}일</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {getAttendanceTimeInfo(type).days < 1 && getAttendanceTimeInfo(type).days > 0
                        ? '(고정 일수)'
                        : '(주말 및 공휴일 제외)'}
                    </p>
                  </div>
                )}


                {/* 근태사유 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    근태사유
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    rows={3}
                    placeholder="근태사유를 입력하세요"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-gray-900"
                  />
                </div>

                {/* 버튼 */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={loading || workingDays === 0}
                    className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? '등록 중...' : '등록'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* 근태 유형 선택 모달 */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
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
                  <h3 className="text-lg font-bold text-white">근태 유형 선택</h3>
                  <p className="text-blue-100 text-sm">등록할 근태의 유형을 선택하세요</p>
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
                  {/* 첫 번째 행 - 연차, 체휴, 근무 */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setType('연차');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '연차'
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
                        setType('체휴');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '체휴'
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
                        setType('결근');
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '결근'
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

                  {/* 두 번째 행 - 오전반차, 오후반차, 오전반반차A */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setType('오전반차');
                        setEndDate(startDate);
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '오전반차'
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
                        setType('오후반차');
                        setEndDate(startDate);
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '오후반차'
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
                        setType('반반차');
                        setEndDate(startDate);
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '반반차'
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
                        setType('팀장대행');
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '팀장대행'
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
                        setType('코칭');
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '코칭'
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
                        setType('교육');
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '교육'
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
                        setType('휴식');
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '휴식'
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
                        setType('출장');
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '출장'
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
                        setType('장애');
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '장애'
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
                        setType('기타');
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '기타'
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
                        setType('연장근무');
                        setStartTime('');
                        setEndTime('');
                        setShowTypeModal(false);
                      }}
                      className={`p-2 text-left rounded transition ${
                        type === '연장근무'
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
                  선택된 유형: {type}
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
                  // 선택된 날짜의 기존 근태들과 시간 겹침 확인
                  const isTimeOccupied = existingAttendances.some(attendance => {
                    if (!attendance.startTime || !attendance.endTime) return false;

                    // 현재 근태의 시간대를 계산
                    const currentStart = new Date(`2000-01-01T${time}`);
                    const currentEnd = new Date(currentStart.getTime() + 30 * 60 * 1000); // 30분 후

                    // 기존 근태의 시간대와 비교
                    const existingStart = new Date(`2000-01-01T${attendance.startTime}`);
                    const existingEnd = new Date(`2000-01-01T${attendance.endTime}`);

                    // 시간대가 겹치는지 확인
                    return currentStart < existingEnd && currentEnd > existingStart;
                  });

                  // 종료시간이 이미 선택되어 있다면 종료시간과 같거나 늦은 시간은 비활성화
                  // 또는 이미 차지된 시간대는 비활성화
                  const isDisabled = !!(endTime && time >= endTime) || isTimeOccupied;
                  return (
                    <button
                      key={time}
                      onClick={() => {
                        if (!isDisabled) {
                          setStartTime(time);
                          // 반반차의 경우 시작시간 입력 시 종료시간 자동 계산 (+2시간)
                          if (type === '반반차') {
                            const [hours, minutes] = time.split(':').map(Number);
                            const endDateTime = new Date();
                            endDateTime.setHours(hours + 2, minutes);
                            const endTimeStr = endDateTime.toTimeString().slice(0, 5);
                            setEndTime(endTimeStr);
                          }
                          setShowStartTimeModal(false);
                        }
                      }}
                      disabled={isDisabled}
                      className={`p-2 text-center rounded-lg transition text-xs font-medium leading-tight ${
                        startTime === time
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
          >
            {/* 헤더 */}
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
                  // 선택된 날짜의 기존 근태들과 시간 겹침 확인
                  const isTimeOccupied = existingAttendances.some(attendance => {
                    if (!attendance.startTime || !attendance.endTime) return false;

                    // 현재 근태의 시간대를 계산
                    const currentStart = new Date(`2000-01-01T${time}`);
                    const currentEnd = new Date(currentStart.getTime() + 30 * 60 * 1000); // 30분 후

                    // 기존 근태의 시간대와 비교
                    const existingStart = new Date(`2000-01-01T${attendance.startTime}`);
                    const existingEnd = new Date(`2000-01-01T${attendance.endTime}`);

                    // 시간대가 겹치는지 확인
                    return currentStart < existingEnd && currentEnd > existingStart;
                  });

                  // 시작시간이 이미 선택되어 있다면 시작시간과 같거나 앞서는 시간은 비활성화
                  // 또는 이미 차지된 시간대는 비활성화
                  const isDisabled = !!(startTime && time <= startTime) || isTimeOccupied;
                  return (
                    <button
                      key={time}
                      onClick={() => {
                        if (!isDisabled) {
                          setEndTime(time);
                          setShowEndTimeModal(false);
                        }
                      }}
                      disabled={isDisabled}
                      className={`p-2 text-center rounded-lg transition text-xs font-medium leading-tight ${
                        endTime === time
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

    </AnimatePresence>
  );
}

