# Supabase 설정 가이드

## Supabase와 함께 사용하기

현재 프로젝트는 `@vercel/postgres`를 사용하며, Supabase Postgres와 완벽하게 호환됩니다.

## 데이터베이스 초기화 방법

### 방법 1: 애플리케이션 API 사용 (권장)

1. 개발 서버 실행:
```bash
npm run dev
```

2. 브라우저에서 다음 URL 방문:
```
http://localhost:3000/api/init
```

3. 성공 메시지 확인:
```json
{
  "success": true,
  "message": "Database initialized"
}
```

### 방법 2: Supabase 대시보드 SQL Editor 사용

1. [Supabase 대시보드](https://supabase.com/dashboard)에 로그인
2. 프로젝트 선택
3. 왼쪽 메뉴에서 "SQL Editor" 클릭
4. 다음 SQL을 실행:

```sql
-- Users 테이블 생성
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance 테이블 생성
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('연차', '체휴', '근무', '시차')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

-- 기본 관리자 계정 생성 (비밀번호: admin123)
-- bcrypt 해시는 애플리케이션에서 생성해야 하므로, 방법 1을 권장합니다.
```

## 환경 변수 확인

`.env.local` 파일에 다음 변수들이 설정되어 있는지 확인하세요:
- `POSTGRES_URL` (필수)
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

## 테스트

1. 개발 서버 실행: `npm run dev`
2. 브라우저에서 `http://localhost:3000` 접속
3. 로그인:
   - 아이디: `admin`
   - 비밀번호: `admin123`

## Vercel 배포 시

Vercel 대시보드의 "Settings" → "Environment Variables"에 Supabase 환경 변수들을 추가하세요.
배포 후 `/api/init` 엔드포인트를 호출하여 데이터베이스를 초기화하세요.

