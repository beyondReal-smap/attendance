# 근태 관리 시스템

Next.js 기반 모바일 웹 근태 관리 애플리케이션입니다.

## 기능

- 사용자 로그인/로그아웃
- 개인 근태 캘린더 조회
- 관리자 페이지에서 근태 관리
- 근태 유형: 연차, 체휴, 근무, 시차

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 Vercel Postgres 연결 정보를 입력하세요:

```
POSTGRES_URL="your_postgres_url"
POSTGRES_USER="your_postgres_user"
POSTGRES_HOST="your_postgres_host"
POSTGRES_PASSWORD="your_postgres_password"
POSTGRES_DATABASE="your_postgres_database"
```

### 3. 데이터베이스 초기화

개발 서버를 실행한 후 브라우저에서 다음 URL을 방문하여 데이터베이스를 초기화하세요:

```
http://localhost:3000/api/init
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 기본 계정

- 아이디: `admin`
- 비밀번호: `admin123`

## 배포

### Vercel 배포

1. GitHub에 프로젝트를 푸시합니다.
2. [Vercel](https://vercel.com)에 로그인하고 새 프로젝트를 생성합니다.
3. GitHub 저장소를 연결합니다.
4. Vercel 대시보드에서 Postgres 데이터베이스를 생성하고 연결합니다.
5. 환경 변수를 설정합니다.
6. 배포 후 `/api/init` 엔드포인트를 호출하여 데이터베이스를 초기화합니다.

## 기술 스택

- Next.js 16
- TypeScript
- Tailwind CSS
- Vercel Postgres
- date-fns
# attendance
# attendance
