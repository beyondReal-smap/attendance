-- ============================================
-- DB 테이블명 마이그레이션 스크립트
-- 기존 테이블: users, attendance
-- 새로운 테이블: atnd_users, atnd_attendance
-- ============================================

-- 1. 기존 테이블이 있는지 확인하고 새 테이블 생성
-- 2. 기존 데이터 마이그레이션
-- 3. 기존 테이블 백업 (선택사항)

-- ============================================
-- Step 1: 새 테이블 생성
-- ============================================

-- atnd_users 테이블 생성
CREATE TABLE IF NOT EXISTS atnd_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_admin TINYINT(1) DEFAULT 0,
  annual_leave_total INT DEFAULT 15 COMMENT '부여된 연차 수',
  annual_leave_used DECIMAL(4,2) DEFAULT 0 COMMENT '사용한 연차 수',
  comp_leave_total INT DEFAULT 0 COMMENT '부여된 체휴 수',
  comp_leave_used DECIMAL(4,2) DEFAULT 0 COMMENT '사용한 체휴 수',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- atnd_attendance 테이블 생성
CREATE TABLE IF NOT EXISTS atnd_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL,
  reason TEXT COMMENT '근태사유',
  start_time TIME COMMENT '시작시간',
  end_time TIME COMMENT '종료시간',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES atnd_users(id) ON DELETE CASCADE
);

-- ============================================
-- Step 2: 기존 데이터 마이그레이션 (기존 테이블이 있는 경우)
-- ============================================

-- users 테이블 데이터를 atnd_users로 마이그레이션
INSERT INTO atnd_users (
  id, username, password, name, is_admin, 
  annual_leave_total, annual_leave_used, 
  comp_leave_total, comp_leave_used, created_at
)
SELECT 
  id, username, password, name, is_admin,
  COALESCE(annual_leave_total, 15) as annual_leave_total,
  COALESCE(annual_leave_used, 0) as annual_leave_used,
  COALESCE(comp_leave_total, 0) as comp_leave_total,
  COALESCE(comp_leave_used, 0) as comp_leave_used,
  created_at
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM atnd_users WHERE atnd_users.id = users.id
);

-- attendance 테이블 데이터를 atnd_attendance로 마이그레이션
INSERT INTO atnd_attendance (
  id, user_id, date, type, reason, start_time, end_time, created_at
)
SELECT 
  id, user_id, date, type, 
  COALESCE(reason, NULL) as reason,
  COALESCE(start_time, NULL) as start_time,
  COALESCE(end_time, NULL) as end_time,
  created_at
FROM attendance
WHERE NOT EXISTS (
  SELECT 1 FROM atnd_attendance WHERE atnd_attendance.id = attendance.id
);

-- ============================================
-- Step 3: AUTO_INCREMENT 값 동기화
-- ============================================

-- users 테이블이 존재하는 경우 AUTO_INCREMENT 값 동기화
SET @max_id = (SELECT IFNULL(MAX(id), 0) FROM atnd_users);
SET @sql = CONCAT('ALTER TABLE atnd_users AUTO_INCREMENT = ', @max_id + 1);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @max_id = (SELECT IFNULL(MAX(id), 0) FROM atnd_attendance);
SET @sql = CONCAT('ALTER TABLE atnd_attendance AUTO_INCREMENT = ', @max_id + 1);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- Step 4: 기존 테이블 백업 (선택사항 - 주석 해제하여 사용)
-- ============================================

-- 기존 테이블을 백업 테이블로 이름 변경
-- RENAME TABLE users TO users_backup;
-- RENAME TABLE attendance TO attendance_backup;

-- 또는 기존 테이블 삭제 (주의: 데이터 손실 위험)
-- DROP TABLE IF EXISTS attendance;
-- DROP TABLE IF EXISTS users;

-- ============================================
-- 완료 메시지
-- ============================================
SELECT 'Migration completed successfully!' as status;

