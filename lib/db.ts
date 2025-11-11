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
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        is_admin TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Attendance 테이블 생성
    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('연차', '체휴', '근무', '시차')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_date (user_id, date)
      )
    `;

    // 기본 관리자 계정 생성 (username: admin, password: admin123)
    const adminExists = await sql`
      SELECT id FROM users WHERE username = 'admin'
    `;
    
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await sql`
        INSERT INTO users (username, password, name, is_admin)
        VALUES ('admin', ${hashedPassword}, '관리자', 1)
      `;
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}
