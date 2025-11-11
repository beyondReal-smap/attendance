import dayjs from 'dayjs';

// 한국 공휴일 목록 (2024-2025)
const HOLIDAYS: Record<string, string> = {
  // 2024년
  '2024-01-01': '신정',
  '2024-02-09': '설날',
  '2024-02-10': '설날',
  '2024-02-11': '설날',
  '2024-02-12': '설날 연휴',
  '2024-03-01': '삼일절',
  '2024-05-05': '어린이날',
  '2024-05-15': '부처님오신날',
  '2024-06-06': '현충일',
  '2024-06-17': '제주도민의 날',
  '2024-08-15': '광복절',
  '2024-09-16': '추석',
  '2024-09-17': '추석',
  '2024-09-18': '추석',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '크리스마스',
  
  // 2025년
  '2025-01-01': '신정',
  '2025-01-28': '설날',
  '2025-01-29': '설날',
  '2025-01-30': '설날',
  '2025-03-01': '삼일절',
  '2025-03-03': '제주도민의 날',
  '2025-05-05': '어린이날',
  '2025-05-06': '어린이날 대체공휴일',
  '2025-05-12': '부처님오신날',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-05': '추석',
  '2025-10-06': '추석',
  '2025-10-07': '추석',
  '2025-10-08': '추석 연휴',
  '2025-10-09': '한글날',
  '2025-12-25': '크리스마스',
};

// 주말인지 확인
export function isWeekend(date: dayjs.Dayjs): boolean {
  const day = date.day();
  return day === 0 || day === 6; // 일요일(0) 또는 토요일(6)
}

// 공휴일인지 확인
export function isHoliday(date: dayjs.Dayjs): boolean {
  const dateStr = date.format('YYYY-MM-DD');
  return HOLIDAYS[dateStr] !== undefined;
}

// 평일인지 확인 (주말과 공휴일 제외)
export function isWorkingDay(date: dayjs.Dayjs): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

// 시작일과 종료일 사이의 평일 수 계산
export function countWorkingDays(startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): number {
  let count = 0;
  let current = startDate.startOf('day');
  const end = endDate.startOf('day');
  
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    if (isWorkingDay(current)) {
      count++;
    }
    current = current.add(1, 'day');
  }
  
  return count;
}

// 날짜 범위의 모든 날짜 반환
export function getDateRange(startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): dayjs.Dayjs[] {
  const dates: dayjs.Dayjs[] = [];
  let current = startDate.startOf('day');
  const end = endDate.startOf('day');
  
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current);
    current = current.add(1, 'day');
  }
  
  return dates;
}

