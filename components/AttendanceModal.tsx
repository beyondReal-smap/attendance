'use client';

import { useState, useEffect, useRef } from 'react';
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
  onAlert?: (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning') => void;
}

export default function AttendanceModal({ isOpen, onClose, selectedDate, onSave, onAlert }: AttendanceModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<AttendanceType>('연차');
  const [reason, setReason] = useState('');
  const [workingDays, setWorkingDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');


  useEffect(() => {
    if (isOpen && selectedDate) {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      setStartDate(dateStr);
      setEndDate(dateStr);
      // 시차 시간 초기화 (시차 유형이 아닐 때는 초기화하지 않음)
      if (type === '시차') {
        setStartTime('09:00');
        setEndTime('18:00');
      } else {
        setStartTime('');
        setEndTime('');
      }
    }
  }, [isOpen, type]);

  // 시작시간 모달이 열릴 때 초기화 (버튼 방식이므로 스크롤 설정 불필요)

  // 종료시간 모달이 열릴 때 초기화 (버튼 방식이므로 스크롤 설정 불필요)


  // 근태 유형 변경 시 종료일자 자동 설정 및 시간 초기화
  useEffect(() => {
    if (startDate) {
      const timeInfo = getAttendanceTimeInfo(type);
      // 반차나 반반차의 경우 종료일자를 시작일자와 같게 설정
      if (timeInfo.days < 1 && timeInfo.days > 0) {
        setEndDate(startDate);
      }

      // 시차 유형일 때는 시간을 초기화, 다른 유형일 때는 시간 초기화
      if (type === '시차') {
        setStartTime('09:00');
        setEndTime('18:00');
      } else {
        setStartTime('');
        setEndTime('');
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
      if (onAlert) onAlert('오류', '모든 필드를 입력해주세요.', 'error');
      return;
    }

    if (type === '시차' && (!startTime || !endTime)) {
      if (onAlert) onAlert('오류', '시차 근태는 시작시간과 종료시간을 입력해야 합니다.', 'error');
      return;
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
                          '오전반반차A': '오전반반차A (0.25일)',
                          '오전반반차B': '오전반반차B (0.25일)',
                          '오후반반차A': '오후반반차A (0.25일)',
                          '오후반반차B': '오후반반차B (0.25일)',
                          '체휴': '체휴 (1일)',
                          '근무': '근무',
                          '시차': '시차 (시간 직접 입력)'
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

                {/* 시작시간, 종료시간 - 시차 유형일 때만 표시 */}
                {type === '시차' && (
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
                        <span>{startTime || '선택하세요'}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                        <span>{endTime || '선택하세요'}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* 시차 근태 시간 입력 - 시차 타입일 때만 표시 */}
                {type === '시차' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-xs font-medium text-amber-700 mb-2">시차 근태 시간</div>
                    <div className="text-sm text-amber-600">
                      시작: {startTime || '미선택'} → 종료: {endTime || '미선택'}
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
                <div className="grid grid-cols-1 gap-2">
                  {/* 연차 */}
                  <button
                    onClick={() => {
                      setType('연차');
                      setShowTypeModal(false);
                    }}
                    className={`w-full p-3 text-left rounded-lg transition ${
                      type === '연차'
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">✈️</span>
                      <div>
                        <div className="font-medium">연차</div>
                        <div className="text-xs opacity-75">1일</div>
                      </div>
                    </div>
                  </button>

                  {/* 반차 */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setType('오전반차');
                        setEndDate(startDate);
                        setShowTypeModal(false);
                      }}
                      className={`p-3 text-left rounded-lg transition ${
                        type === '오전반차'
                          ? 'bg-sky-500 text-white'
                          : 'bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🌅</span>
                        <div>
                          <div className="font-medium text-sm">오전반차</div>
                          <div className="text-xs opacity-75">0.5일</div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setType('오후반차');
                        setEndDate(startDate);
                        setShowTypeModal(false);
                      }}
                      className={`p-3 text-left rounded-lg transition ${
                        type === '오후반차'
                          ? 'bg-cyan-500 text-white'
                          : 'bg-cyan-50 text-cyan-900 border border-cyan-200 hover:bg-cyan-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🌆</span>
                        <div>
                          <div className="font-medium text-sm">오후반차</div>
                          <div className="text-xs opacity-75">0.5일</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* 반반차 */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setType('오전반반차A');
                        setEndDate(startDate);
                        setShowTypeModal(false);
                      }}
                      className={`p-3 text-left rounded-lg transition ${
                        type === '오전반반차A'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🌄</span>
                        <div>
                          <div className="font-medium text-sm">오전반반차A</div>
                          <div className="text-xs opacity-75">0.25일</div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setType('오전반반차B');
                        setEndDate(startDate);
                        setShowTypeModal(false);
                      }}
                      className={`p-3 text-left rounded-lg transition ${
                        type === '오전반반차B'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">☀️</span>
                        <div>
                          <div className="font-medium text-sm">오전반반차B</div>
                          <div className="text-xs opacity-75">0.25일</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setType('오후반반차A');
                        setEndDate(startDate);
                        setShowTypeModal(false);
                      }}
                      className={`p-3 text-left rounded-lg transition ${
                        type === '오후반반차A'
                          ? 'bg-violet-500 text-white'
                          : 'bg-violet-50 text-violet-900 border border-violet-200 hover:bg-violet-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🌤️</span>
                        <div>
                          <div className="font-medium text-sm">오후반반차A</div>
                          <div className="text-xs opacity-75">0.25일</div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setType('오후반반차B');
                        setEndDate(startDate);
                        setShowTypeModal(false);
                      }}
                      className={`p-3 text-left rounded-lg transition ${
                        type === '오후반반차B'
                          ? 'bg-violet-500 text-white'
                          : 'bg-violet-50 text-violet-900 border border-violet-200 hover:bg-violet-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🌙</span>
                        <div>
                          <div className="font-medium text-sm">오후반반차B</div>
                          <div className="text-xs opacity-75">0.25일</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* 체휴 */}
                  <button
                    onClick={() => {
                      setType('체휴');
                      setShowTypeModal(false);
                    }}
                    className={`w-full p-3 text-left rounded-lg transition ${
                      type === '체휴'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏠</span>
                      <div>
                        <div className="font-medium">체휴</div>
                        <div className="text-xs opacity-75">1일</div>
                      </div>
                    </div>
                  </button>

                  {/* 근무 */}
                  <button
                    onClick={() => {
                      setType('근무');
                      setShowTypeModal(false);
                    }}
                    className={`w-full p-3 text-left rounded-lg transition ${
                      type === '근무'
                        ? 'bg-slate-500 text-white'
                        : 'bg-slate-50 text-slate-900 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💼</span>
                      <div>
                        <div className="font-medium">근무</div>
                        <div className="text-xs opacity-75">정상 근무</div>
                      </div>
                    </div>
                  </button>

                  {/* 시차 */}
                  <button
                    onClick={() => {
                      setType('시차');
                      setShowTypeModal(false);
                    }}
                    className={`w-full p-3 text-left rounded-lg transition ${
                      type === '시차'
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⏰</span>
                      <div>
                        <div className="font-medium">시차</div>
                        <div className="text-xs opacity-75">시간 직접 입력</div>
                      </div>
                    </div>
                  </button>
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
                        '오전반반차A': '오전반반차A (0.25일)',
                        '오전반반차B': '오전반반차B (0.25일)',
                        '오후반반차A': '오후반반차A (0.25일)',
                        '오후반반차B': '오후반반차B (0.25일)',
                        '체휴': '체휴 (1일)',
                        '근무': '근무',
                        '시차': '시차 (시간 직접 입력)'
                      };
                      return labels[type] || type;
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
            className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-hidden"
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">시작 시간 선택</h3>
                <button
                  onClick={() => setShowStartTimeModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition"
                >
                  <FiX className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-6">
                <div className="text-sm font-medium text-gray-700 mb-6 text-center">
                  시작시간을 선택하세요
                </div>

                {/* 시간 선택 버튼 */}
                <div className="mb-8">
                  <div className="flex flex-col items-center">
                    <label className="text-xs font-medium text-gray-600 mb-4">시작 시간</label>
                    <div className="grid grid-cols-4 gap-2 max-w-sm">
                      {Array.from({ length: 12 }, (_, i) => {
                        const hour = i + 8; // 8시부터 시작
                        return (
                          <button
                            key={hour}
                            onClick={() => {
                              setStartTime(`${hour.toString().padStart(2, '0')}:00`);
                            }}
                            className={`h-12 px-6 flex items-center justify-center text-sm font-semibold rounded-lg transition-all duration-200 ${
                              parseInt(startTime ? startTime.split(':')[0] : '9') === hour
                                ? 'bg-blue-600 text-white shadow-lg scale-105'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                            }`}
                          >
                            {hour.toString().padStart(2, '0')}시
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 선택된 시간 표시 */}
                  <div className="text-center mt-4">
                    <div className="text-lg font-bold text-blue-600">
                      {startTime ? startTime : '09:00'}
                    </div>
                  </div>
                </div>

                {/* 선택 완료 버튼 */}
                <button
                  onClick={() => {
                    // 시작시간 선택 시 종료시간 자동 설정 (+8시간)
                    if (startTime) {
                      const hours = parseInt(startTime.split(':')[0]);
                      const endHours = (hours + 8) % 24; // 24시간 형식 유지
                      setEndTime(`${endHours.toString().padStart(2, '0')}:00`);
                    }
                    setShowStartTimeModal(false);
                  }}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-md"
                >
                  선택 완료
                </button>
              </div>

              {/* 현재 선택 표시 */}
              <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-700">
                  선택된 시작시간: {startTime || '없음'}
                </div>
                {startTime && (
                  <div className="text-xs text-blue-600 mt-1">
                    종료시간: {(() => {
                      const hours = parseInt(startTime.split(':')[0]);
                      const endHours = (hours + 8) % 24;
                      return `${endHours.toString().padStart(2, '0')}:00`;
                    })()} (자동 설정)
                  </div>
                )}
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
            className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-hidden"
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

            <div className="p-4">
              <div className="mb-6">
                <div className="text-sm font-medium text-gray-700 mb-6 text-center">
                  종료시간을 선택하세요
                </div>

                {/* 시간 선택 버튼 */}
                <div className="mb-8">
                  <div className="flex flex-col items-center">
                    <label className="text-xs font-medium text-gray-600 mb-4">종료 시간</label>
                    <div className="grid grid-cols-4 gap-2 max-w-sm">
                      {Array.from({ length: 12 }, (_, i) => {
                        const hour = i + 8; // 8시부터 시작
                        return (
                          <button
                            key={hour}
                            onClick={() => {
                              setEndTime(`${hour.toString().padStart(2, '0')}:00`);
                            }}
                            className={`h-12 px-6 flex items-center justify-center text-sm font-semibold rounded-lg transition-all duration-200 ${
                              parseInt(endTime ? endTime.split(':')[0] : '18') === hour
                                ? 'bg-blue-600 text-white shadow-lg scale-105'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                            }`}
                          >
                            {hour.toString().padStart(2, '0')}시
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 선택된 시간 표시 */}
                  <div className="text-center mt-4">
                    <div className="text-lg font-bold text-blue-600">
                      {endTime ? endTime : '17:00'}
                    </div>
                  </div>
                </div>

                {/* 선택 완료 버튼 */}
                <button
                  onClick={() => {
                    setShowEndTimeModal(false);
                  }}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-md"
                >
                  선택 완료
                </button>
              </div>

              {/* 현재 선택 표시 */}
              <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-700">
                  선택된 종료시간: {endTime || '없음'}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

