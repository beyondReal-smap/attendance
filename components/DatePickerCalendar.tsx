'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface DatePickerCalendarProps {
  startDate: Dayjs | null;
  endDate: Dayjs | null;
  onStartDateSelect: (date: Dayjs) => void;
  onEndDateSelect: (date: Dayjs) => void;
  onClose: () => void;
  initialSelectingStart?: boolean;
  showConfirmButton?: boolean;
  selectedColor?: 'blue' | 'orange';
}

export function DatePickerCalendar({
  startDate,
  endDate,
  onStartDateSelect,
  onEndDateSelect,
  onClose,
  initialSelectingStart = true,
  showConfirmButton = true,
  selectedColor = 'blue',
}: DatePickerCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectingStart, setSelectingStart] = useState(initialSelectingStart);

  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfMonth = currentMonth.startOf('month').day();
  const today = dayjs();

  // 총 42개의 셀(6주 × 7일)을 고정으로 사용
  const totalCells = 42;
  const emptyCellsAtStart = firstDayOfMonth;

  const handlePrevMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'));
  };

  const handleDateClick = (date: Dayjs) => {
    if (selectingStart) {
      onStartDateSelect(date);
      if (!endDate || date.isAfter(endDate)) {
        onEndDateSelect(date);
      }
      setSelectingStart(false);
    } else {
      if (date.isBefore(startDate!)) {
        onStartDateSelect(date);
        onEndDateSelect(startDate!);
      } else {
        onEndDateSelect(date);
      }
      setSelectingStart(true);
    }
  };

  const isInRange = (date: Dayjs): boolean => {
    if (!startDate || !endDate) return false;
    return (date.isAfter(startDate, 'day') || date.isSame(startDate, 'day')) && 
           (date.isBefore(endDate, 'day') || date.isSame(endDate, 'day'));
  };

  const isStartDate = (date: Dayjs): boolean => {
    return startDate ? date.isSame(startDate, 'day') : false;
  };

  const isEndDate = (date: Dayjs): boolean => {
    return endDate ? date.isSame(endDate, 'day') : false;
  };

  return (
    <div className="bg-white rounded-xl p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <motion.button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiChevronLeft className="w-5 h-5 text-gray-700" />
        </motion.button>
        
        <div className="text-center">
          <h3 className="text-base font-bold text-gray-900">
            {currentMonth.format('YYYY년 M월')}
          </h3>
          <div className="flex gap-2 mt-2 text-xs">
            <button
              onClick={() => setSelectingStart(true)}
              className={`px-2.5 py-1 rounded-md transition ${
                selectingStart
                  ? selectedColor === 'orange'
                    ? 'bg-orange-100 text-orange-700 font-medium'
                    : 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              시작일자
            </button>
            <button
              onClick={() => setSelectingStart(false)}
              className={`px-2.5 py-1 rounded-md transition ${
                !selectingStart
                  ? selectedColor === 'orange'
                    ? 'bg-orange-100 text-orange-700 font-medium'
                    : 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              종료일자
            </button>
          </div>
        </div>
        
        <motion.button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiChevronRight className="w-5 h-5 text-gray-700" />
        </motion.button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
          <div
            key={day}
            className={`h-8 flex items-center justify-center text-xs font-semibold ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 - 6주 × 7일 = 42개의 고정 셀 */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayIndex = i - emptyCellsAtStart;

          // 빈 칸 (월의 시작 전 또는 끝 후)
          if (dayIndex < 0 || dayIndex >= daysInMonth) {
            return <div key={`empty-${i}`} className="h-10"></div>;
          }

          // 날짜 셀
          const date = currentMonth.date(dayIndex + 1);
          const isToday = today.isSame(date, 'day');
          const inRange = isInRange(date);
          const isStart = isStartDate(date);
          const isEnd = isEndDate(date);

          return (
            <motion.button
              key={i}
              onClick={() => handleDateClick(date)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                h-10 w-full rounded-lg flex items-center justify-center text-sm font-semibold
                transition-all duration-200 relative
                ${
                  isStart || isEnd
                    ? selectedColor === 'orange' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                    : inRange
                    ? selectedColor === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    : isToday
                    ? 'bg-gray-100 text-gray-900 ring-2 ring-gray-300'
                    : 'hover:bg-gray-100 text-gray-700'
                }
              `}
            >
              {dayIndex + 1}
            </motion.button>
          );
        })}
      </div>

      {/* 선택된 날짜 표시 */}
      {(startDate || endDate) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500">시작일자: </span>
              <span className="font-semibold text-gray-900">
                {startDate ? startDate.format('YYYY-MM-DD') : '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">종료일자: </span>
              <span className="font-semibold text-gray-900">
                {endDate ? endDate.format('YYYY-MM-DD') : '-'}
              </span>
            </div>
          </div>
          {showConfirmButton && (
            <button
              onClick={onClose}
              className={`w-full mt-3 px-4 py-2.5 text-white rounded-lg text-sm font-medium transition-colors ${
                selectedColor === 'orange'
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              확인
            </button>
          )}
        </div>
      )}
    </div>
  );
}

