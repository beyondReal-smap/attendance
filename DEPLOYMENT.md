# GitHub 저장소 설정 가이드

## 1. GitHub 저장소 생성

1. GitHub에 로그인하고 새 저장소를 생성합니다.
2. 저장소 이름을 입력합니다 (예: `attendance-system`).
3. Public 또는 Private로 설정합니다.

## 2. 로컬 저장소 초기화 및 푸시

```bash
# Git 초기화
git init

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: 근태 관리 시스템"

# GitHub 저장소 연결 (YOUR_USERNAME과 YOUR_REPO_NAME을 실제 값으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 메인 브랜치로 푸시
git branch -M main
git push -u origin main
```

## 3. Vercel 배포

1. [Vercel](https://vercel.com)에 로그인합니다.
2. "Add New Project"를 클릭합니다.
3. GitHub 저장소를 선택하고 Import합니다.
4. 프로젝트 설정:
   - Framework Preset: Next.js (자동 감지됨)
   - Root Directory: `./`
   - Build Command: `npm run build` (기본값)
   - Output Directory: `.next` (기본값)
5. "Deploy"를 클릭합니다.

## 4. Vercel Postgres 데이터베이스 설정

1. Vercel 대시보드에서 프로젝트를 선택합니다.
2. "Storage" 탭으로 이동합니다.
3. "Create Database" → "Postgres"를 선택합니다.
4. 데이터베이스 이름을 입력하고 생성합니다.
5. "Settings" → "Environment Variables"에서 다음 변수들을 추가합니다:
   - `POSTGRES_URL`
   - `POSTGRES_USER`
   - `POSTGRES_HOST`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DATABASE`
   
   (Vercel Postgres를 생성하면 자동으로 환경 변수가 설정됩니다)

## 5. 데이터베이스 초기화

배포가 완료된 후, 브라우저에서 다음 URL을 방문하여 데이터베이스를 초기화합니다:

```
https://YOUR_PROJECT_NAME.vercel.app/api/init
```

초기화가 완료되면 기본 관리자 계정이 생성됩니다:
- 아이디: `admin`
- 비밀번호: `admin123`

## 6. 자동 배포 설정

GitHub에 푸시하면 Vercel이 자동으로 배포합니다. 수동 배포는 Vercel 대시보드에서 "Redeploy"를 클릭하면 됩니다.

