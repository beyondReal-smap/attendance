import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

// 환경 변수에서 DB 정보 가져오기
const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || process.env.DB_PORT) || 3306,
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'attendance',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
};

// DB 연결 풀 생성
const pool = mysql.createPool(dbConfig);

// SQL 쿼리 헬퍼 함수 (@vercel/postgres와 호환)
export async function sql(strings: TemplateStringsArray, ...values: any[]) {
  try {
    // 템플릿 리터럴을 실제 SQL 쿼리로 변환
    let query = strings[0];
    const params: any[] = [];
    for (let i = 0; i < values.length; i++) {
      params.push(values[i]);
      query += '?' + strings[i + 1];
    }
    const [rows] = await pool.query(query, params);
    return { rows: rows as any[] };
  } catch (error) {
    console.error('SQL query error:', error);
    throw error;
  }
}

export async function initDatabase() {
  try {
    // Users 테이블 생성
    await sql`
      CREATE TABLE IF NOT EXISTS atnd_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        department VARCHAR(100) COMMENT '부서',
        role VARCHAR(20) DEFAULT 'user' COMMENT '역할 (user, manager, admin)',
        is_admin TINYINT(1) DEFAULT 0,
        is_temp_password TINYINT(1) DEFAULT 0 COMMENT '임시비밀번호 여부',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // 기존 atnd_users 테이블에 컬럼 추가 (이미 존재하는 경우)
    try {
      await sql`ALTER TABLE atnd_users ADD COLUMN is_admin TINYINT(1) DEFAULT 0`;
    } catch (e: any) {
      if (!e.message?.includes('Duplicate column')) console.error('is_admin column add error:', e);
    }
    try {
      await sql`ALTER TABLE atnd_users ADD COLUMN department VARCHAR(100) COMMENT '부서'`;
    } catch (e: any) {
      if (!e.message?.includes('Duplicate column')) console.error('Column add error:', e);
    }
    try {
      await sql`ALTER TABLE atnd_users ADD COLUMN role VARCHAR(20) DEFAULT 'user' COMMENT '역할 (user, manager, admin)'`;
    } catch (e: any) {
      if (!e.message?.includes('Duplicate column')) console.error('Column add error:', e);
    }
    try {
      await sql`ALTER TABLE atnd_users ADD COLUMN is_temp_password TINYINT(1) DEFAULT 0 COMMENT '임시비밀번호 여부'`;
    } catch (e: any) {
      // MySQL 중복 컬럼 에러 무시 (에러 코드 1060 또는 메시지 확인)
      const isDuplicateError = e.code === 1060 ||
                               e.code === 'ER_DUP_FIELDNAME' ||
                               e.message?.includes('Duplicate column name') ||
                               e.message?.includes('already exists');
      if (!isDuplicateError) {
        console.error('is_temp_password column add error:', e);
      }
    }

    // 연차/체휴 관리 테이블 생성
    await sql`
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
      )
    `;

    // Attendance 테이블 생성
    await sql`
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
      )
    `;
    
    // 기존 atnd_attendance 테이블에 컬럼 추가 (이미 존재하는 경우)
    try {
      await sql`ALTER TABLE atnd_attendance ADD COLUMN reason TEXT COMMENT '근태사유'`;
    } catch (e: any) {
      if (!e.message?.includes('Duplicate column')) console.error('Column add error:', e);
    }
    
    try {
      await sql`ALTER TABLE atnd_attendance ADD COLUMN start_time TIME COMMENT '시작시간'`;
    } catch (e: any) {
      if (!e.message?.includes('Duplicate column')) console.error('Column add error:', e);
    }
    
    try {
      await sql`ALTER TABLE atnd_attendance ADD COLUMN end_time TIME COMMENT '종료시간'`;
    } catch (e: any) {
      if (!e.message?.includes('Duplicate column')) console.error('Column add error:', e);
    }
    
    // UNIQUE KEY 제거 (같은 날짜에 여러 근태 등록 가능하도록)
    try {
      await sql`ALTER TABLE atnd_attendance DROP INDEX unique_user_date`;
    } catch (e: any) {
      if (!e.message?.includes('check that it exists')) console.error('Index drop error:', e);
    }

    // 기본 관리자 계정 생성 (username: admin, password: admin123)
    const adminExists = await sql`
      SELECT id FROM atnd_users WHERE username = 'admin'
    `;

    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);

      // 관리자 계정 생성
      await sql`
        INSERT INTO atnd_users (username, password, name, role, is_admin)
        VALUES ('admin', ${hashedPassword}, '관리자', 'admin', 1)
      `;

      // 새로 생성된 관리자의 ID 가져오기
      const adminResult = await sql`
        SELECT id FROM atnd_users WHERE username = 'admin'
      `;
      const adminId = adminResult.rows[0].id;
      const currentYear = new Date().getFullYear();

      // 관리자의 연차/체휴 초기 데이터 생성
      await sql`
        INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
        VALUES
          (${adminId}, ${currentYear}, 'annual', 15, 0, 15),
          (${adminId}, ${currentYear}, 'compensatory', 0, 0, 0)
      `;
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}
