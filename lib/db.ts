import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

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

