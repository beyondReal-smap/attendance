-- ============================================
-- 연차 사용량 재계산 쿼리
-- 기존 데이터의 연차 사용량을 실제 근태 데이터를 기반으로 재계산합니다
-- ============================================

-- 1. 모든 사용자의 연차 사용량을 0으로 초기화
UPDATE atnd_users SET annual_leave_used = 0;
UPDATE atnd_users SET comp_leave_used = 0;

-- 2. 실제 근태 데이터를 기반으로 연차 사용량 재계산
-- 연차 사용량 재계산 (근태가 있는 사용자만)
UPDATE atnd_users u
INNER JOIN (
  SELECT 
    user_id,
    SUM(
      CASE 
        WHEN type = '연차' THEN 1.0
        WHEN type IN ('오전반차', '오후반차') THEN 0.5
        WHEN type IN ('오전반반차A', '오전반반차B', '오후반반차A', '오후반반차B') THEN 0.25
        ELSE 0
      END
    ) as total_usage
  FROM atnd_attendance
  WHERE type IN ('연차', '오전반차', '오후반차', '오전반반차A', '오전반반차B', '오후반반차A', '오후반반차B')
    AND DAYOFWEEK(date) NOT IN (1, 7)  -- 주말 제외 (1=일요일, 7=토요일)
  GROUP BY user_id
) a ON u.id = a.user_id
SET u.annual_leave_used = COALESCE(a.total_usage, 0);

-- 체휴 사용량 재계산 (근태가 있는 사용자만)
UPDATE atnd_users u
INNER JOIN (
  SELECT 
    user_id,
    COUNT(*) as total_usage
  FROM atnd_attendance
  WHERE type = '체휴'
    AND DAYOFWEEK(date) NOT IN (1, 7)  -- 주말 제외
  GROUP BY user_id
) a ON u.id = a.user_id
SET u.comp_leave_used = COALESCE(a.total_usage, 0);

-- 3. 근태가 없는 사용자는 확실히 0으로 설정
-- (이미 위에서 0으로 초기화했지만, 혹시 모를 경우를 대비)
UPDATE atnd_users 
SET annual_leave_used = 0 
WHERE annual_leave_used IS NULL OR annual_leave_used != 0
  AND id NOT IN (
    SELECT DISTINCT user_id FROM atnd_attendance 
    WHERE type IN ('연차', '오전반차', '오후반차', '오전반반차A', '오전반반차B', '오후반반차A', '오후반반차B')
      AND DAYOFWEEK(date) NOT IN (1, 7)
  );

UPDATE atnd_users 
SET comp_leave_used = 0 
WHERE comp_leave_used IS NULL OR comp_leave_used != 0
  AND id NOT IN (
    SELECT DISTINCT user_id FROM atnd_attendance 
    WHERE type = '체휴'
      AND DAYOFWEEK(date) NOT IN (1, 7)
  );

-- ============================================
-- 확인 쿼리
-- ============================================
SELECT 
  id,
  username,
  name,
  annual_leave_total,
  annual_leave_used,
  annual_leave_total - annual_leave_used as annual_leave_remaining,
  comp_leave_total,
  comp_leave_used,
  comp_leave_total - comp_leave_used as comp_leave_remaining,
  (SELECT COUNT(*) FROM atnd_attendance WHERE user_id = atnd_users.id) as attendance_count
FROM atnd_users
ORDER BY name;

