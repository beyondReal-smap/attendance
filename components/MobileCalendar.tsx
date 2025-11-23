'use client';

import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { AttendanceType } from '@/types';

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
    onMonthChange,
    onTodayClick,
    onRefreshData,
    onSetAttendances
}: {
    selectedDay: Dayjs | null;
    onDayClick: (day: Dayjs) => void;
    attendances: Attendance[];
    onMonthChange?: (year: number, month: number) => void;
    onTodayClick?: () => void;
    onRefreshData?: () => void;
    onSetAttendances?: (data: Attendance[]) => void;
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
            if (!acc[attendance.date]) {
                acc[attendance.date] = [];
            }
            acc[attendance.date].push({
                type: attendance.type,
                startTime: attendance.startTime,
                endTime: attendance.endTime
            });
            return acc;
        }, {} as Record<string, Array<{ type: AttendanceType, startTime?: string, endTime?: string }>>);
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
            case '동석(코칭)':
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
            case '동석(코칭)':
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
            case '동석(코칭)': return '👨‍🏫';
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

    const handleToday = async () => {
        console.log('handleToday called');
        setAnimationDirection('right');
        setIsAnimating(true);
        setTimeout(async () => {
            const now = dayjs();
            console.log('Setting currentMonth to:', now.format('YYYY-MM'));
            setCurrentMonth(now);
            if (onTodayClick) {
                onTodayClick();
            }

            // 현재 월의 데이터를 직접 가져와서 설정
            try {
                const year = now.year();
                const month = now.month() + 1;
                console.log('Directly fetching attendance for today, year:', year, 'month:', month);

                const res = await fetch(`/api/attendance?year=${year}&month=${month}`);
                if (res.ok) {
                    const data = await res.json();
                    console.log('Directly fetched attendance data for today:', data);

                    // attendances 상태 직접 설정
                    if (onSetAttendances) {
                        onSetAttendances(data);
                    }
                } else {
                    console.error('Failed to fetch attendance data, status:', res.status);
                }
            } catch (error) {
                console.error('Error fetching attendance data in handleToday:', error);
            }

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
                days.push(<div key={`empty-end-${i}`} className="h-16"></div>);
                continue;
            }

            // 빈 칸 (월의 끝 후)
            if (dayIndex >= daysInMonth) {
                days.push(<div key={`empty-end-${i}`} className="h-16"></div>);
                continue;
            }

            // 현재 달의 날짜
            const currentDate = currentMonth.date(dayIndex + 1);
            const dateString = currentDate.format('YYYY-MM-DD');
            const isSelected = selectedDay?.isSame(currentDate, 'day');
            const isToday = today.isSame(currentDate, 'day');
            const attendanceList = attendanceMap[dateString] || [];
            const hasAttendance = attendanceList.length > 0;
            const firstAttendance = attendanceList[0] || null;
            const attendanceType = firstAttendance?.type || null;
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
            h-16 w-full rounded-lg flex flex-col items-center justify-center text-base font-semibold
            transition-all duration-200 relative
            ${colors}
            ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
            ${isToday && !isSelected ? 'ring-2 ring-red-400 ring-offset-1' : ''}
            ${!hasAttendance ? 'border border-gray-200' : ''}
          `}
                    style={isToday && !isSelected ? {
                        backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 6px,
              rgba(239, 68, 68, 0.25) 6px,
              rgba(239, 68, 68, 0.25) 12px
            )`
                    } : undefined}
                >
                    <span className={`${attendanceType ? textColor : 'text-black'} text-base font-bold`}>
                        {dayIndex + 1}
                    </span>
                    {hasAttendance && (
                        <div className="flex flex-col items-center mt-0.5">
                            <span className="text-xs">{icon}</span>
                            {attendanceList.length > 1 && (
                                <span className="text-xs text-gray-600 mt-0.5">
                                    +{attendanceList.length - 1}
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
                    <div key={day} className={`h-10 flex items-center justify-center text-sm font-semibold ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
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

export default MobileCalendar;
