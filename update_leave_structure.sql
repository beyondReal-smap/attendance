-- ============================================
-- 연차/체휴 구조 변경 스크립트
-- atnd_users 테이블에서 연차/체휴 컬럼 제거 및 leave_balances 테이블 사용
-- ============================================

-- 1. 현재 데이터 백업 (안전하게 진행하기 위해)
-- 연차/체휴 데이터를 leave_balances 테이블로 마이그레이션

-- 현재 년도 설정
SET @current_year = YEAR(CURDATE());

-- 기존 leave_balances 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS leave_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  year INT NOT NULL COMMENT '관리 년도 (예: 2024)',
  leave_type ENUM('annual', 'compensatory') NOT NULL COMMENT '연차/체휴 구분',
  total DECIMAL(4,2) DEFAULT 0 COMMENT '부여된 휴가 수',
  used DECIMAL(4,2) DEFAULT 0 COMMENT '사용한 휴가 수',
  remaining DECIMAL(4,2) DEFAULT 0 COMMENT '잔여 휴가 수',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES atnd_users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_year_type (user_id, year, leave_type)
);

-- 기존 atnd_users 데이터를 leave_balances로 마이그레이션 (연차)
INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
SELECT
  id as user_id,
  @current_year as year,
  'annual' as leave_type,
  COALESCE(annual_leave_total, 15) as total,
  COALESCE(annual_leave_used, 0) as used,
  COALESCE(annual_leave_total - annual_leave_used, 15) as remaining
FROM atnd_users
WHERE NOT EXISTS (
  SELECT 1 FROM leave_balances
  WHERE leave_balances.user_id = atnd_users.id
  AND leave_balances.year = @current_year
  AND leave_balances.leave_type = 'annual'
);

-- 기존 atnd_users 데이터를 leave_balances로 마이그레이션 (체휴)
INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
SELECT
  id as user_id,
  @current_year as year,
  'compensatory' as leave_type,
  COALESCE(comp_leave_total, 0) as total,
  COALESCE(comp_leave_used, 0) as used,
  COALESCE(comp_leave_total - comp_leave_used, 0) as remaining
FROM atnd_users
WHERE NOT EXISTS (
  SELECT 1 FROM leave_balances
  WHERE leave_balances.user_id = atnd_users.id
  AND leave_balances.year = @current_year
  AND leave_balances.leave_type = 'compensatory'
);

-- 2. atnd_users 테이블에서 연차/체휴 컬럼 제거
-- 컬럼 존재 여부 확인 후 제거

-- annual_leave_total 컬럼 제거
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'atnd_users'
      AND COLUMN_NAME = 'annual_leave_total'
    ),
    'ALTER TABLE atnd_users DROP COLUMN annual_leave_total;',
    'SELECT "Column annual_leave_total does not exist" as status;'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- annual_leave_used 컬럼 제거
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'atnd_users'
      AND COLUMN_NAME = 'annual_leave_used'
    ),
    'ALTER TABLE atnd_users DROP COLUMN annual_leave_used;',
    'SELECT "Column annual_leave_used does not exist" as status;'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- comp_leave_total 컬럼 제거
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'atnd_users'
      AND COLUMN_NAME = 'comp_leave_total'
    ),
    'ALTER TABLE atnd_users DROP COLUMN comp_leave_total;',
    'SELECT "Column comp_leave_total does not exist" as status;'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- comp_leave_used 컬럼 제거
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'atnd_users'
      AND COLUMN_NAME = 'comp_leave_used'
    ),
    'ALTER TABLE atnd_users DROP COLUMN comp_leave_used;',
    'SELECT "Column comp_leave_used does not exist" as status;'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 완료 메시지
SELECT
  '연차/체휴 구조 변경이 완료되었습니다.' as status,
  CONCAT('마이그레이션된 사용자 수: ',
    (SELECT COUNT(DISTINCT user_id) FROM leave_balances WHERE year = @current_year)
  ) as info,
  CONCAT('연차 레코드 수: ',
    (SELECT COUNT(*) FROM leave_balances WHERE year = @current_year AND leave_type = 'annual')
  ) as annual_records,
  CONCAT('체휴 레코드 수: ',
    (SELECT COUNT(*) FROM leave_balances WHERE year = @current_year AND leave_type = 'compensatory')
  ) as comp_records;

-- 4. 데이터 검증
SELECT
  '데이터 검증 결과:' as validation,
  COUNT(*) as total_leave_records,
  SUM(CASE WHEN leave_type = 'annual' THEN 1 ELSE 0 END) as annual_records,
  SUM(CASE WHEN leave_type = 'compensatory' THEN 1 ELSE 0 END) as compensatory_records
FROM leave_balances
WHERE year = @current_year;
