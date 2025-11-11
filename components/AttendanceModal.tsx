'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import { FiX, FiCalendar } from 'react-icons/fi';
import { AttendanceType } from '@/types';
import { countWorkingDays, getDateRange } from '@/lib/holidays';
import { getAttendanceTimeInfo } from '@/lib/attendance-utils';
import { DatePickerCalendar } from './DatePickerCalendar';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Dayjs | null;
  onSave: (data: {
    startDate: string;
    endDate: string;
    type: AttendanceType;
    reason: string;
    days: number;
  }) => Promise<void>;
}

export default function AttendanceModal({ isOpen, onClose, selectedDate, onSave }: AttendanceModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<AttendanceType>('연차');
  const [reason, setReason] = useState('');
  const [workingDays, setWorkingDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (isOpen && selectedDate) {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      setStartDate(dateStr);
      setEndDate(dateStr);
    }
  }, [isOpen]);

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
    if (!startDate || !endDate || !reason.trim()) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    if (type === '시차' && (!startTime || !endTime)) {
      alert('시차 근태는 시작시간과 종료시간을 입력해야 합니다.');
      return;
    }

    const timeInfo = getAttendanceTimeInfo(type);
    const start = dayjs(startDate);
    const end = dayjs(endDate);

    // 반차나 반반차가 아닌 경우에만 종료일자 검증
    if (timeInfo.days >= 1 && end.isBefore(start)) {
      alert('종료일자는 시작일자보다 이후여야 합니다.');
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
        startTime: type === '시차' ? startTime : undefined,
        endTime: type === '시차' ? endTime : undefined,
      } as any);
      // 초기화
      setStartDate('');
      setEndDate('');
      setReason('');
      setType('연차');
      setStartTime('');
      setEndTime('');
      onClose();
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('근태 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
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
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">근태 등록</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 근태 유형 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    근태 유형
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AttendanceType)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
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

                {/* 캘린더 모달 */}
                {(showStartCalendar || showEndCalendar) && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-xl p-4 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-xl"
                    >
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
                    </motion.div>
                  </div>
                )}

                {/* 근태 일수 표시 */}
                {workingDays > 0 && (
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

                {/* 시차 근태 시간 입력 */}
                {type === '시차' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        시작시간
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        종료시간
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                      />
                    </div>
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
        </>
      )}
    </AnimatePresence>
  );
}

