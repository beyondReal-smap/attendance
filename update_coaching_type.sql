-- ============================================
-- 근태 유형 "코칭"을 "동석(코칭)"으로 변경하는 업데이트 스크립트
-- ============================================

-- atnd_attendance 테이블에서 "코칭"을 "동석(코칭)"으로 업데이트
UPDATE atnd_attendance
SET type = '동석(코칭)'
WHERE type = '코칭';

-- 업데이트된 행 수 확인
SELECT
  CONCAT('총 ', COUNT(*), '개의 근태 기록이 "코칭"에서 "동석(코칭)"으로 업데이트되었습니다.') as update_status
FROM atnd_attendance
WHERE type = '동석(코칭)';

-- 완료 메시지
SELECT '근태 유형 업데이트가 완료되었습니다!' as status;
