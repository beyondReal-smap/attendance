import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// Supabase 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// SQL 쿼리 헬퍼 함수 (@vercel/postgres와 호환)
export async function sql(strings: TemplateStringsArray, ...values: any[]) {
  const client = await pool.connect();
  try {
    // 템플릿 리터럴을 실제 SQL 쿼리로 변환
    let query = strings[0];
    const params: any[] = [];
    for (let i = 0; i < values.length; i++) {
      params.push(values[i]);
      query += `$${params.length}` + strings[i + 1];
    }
    const result = await client.query(query, params);
    return { rows: result.rows };
  } finally {
    client.release();
  }
}

export async function initDatabase() {
  try {
    // Users 테이블 생성
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Attendance 테이블 생성
    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('연차', '체휴', '근무', '시차')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
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
        VALUES ('admin', ${hashedPassword}, '관리자', TRUE)
      `;
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}
