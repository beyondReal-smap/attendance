-- ============================================
-- 연차/체휴 사용량 즉시 초기화 (간단 버전)
-- atnd_attendance 테이블이 비어있을 때 사용
-- ============================================

-- 모든 사용자의 연차/체휴 사용량을 0으로 초기화
UPDATE atnd_users SET annual_leave_used = 0;
UPDATE atnd_users SET comp_leave_used = 0;

-- 확인
SELECT 
  id,
  username,
  name,
  annual_leave_total,
  annual_leave_used,
  annual_leave_total - annual_leave_used as annual_leave_remaining,
  comp_leave_total,
  comp_leave_used,
  comp_leave_total - comp_leave_used as comp_leave_remaining
FROM atnd_users
ORDER BY name;

