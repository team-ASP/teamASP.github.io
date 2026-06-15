# ASP Study Hub

ASP 팀의 스터디와 프로젝트를 계획, 진행, 정리, 아카이빙하기 위한 운영 허브입니다. 현재 코드는 Vercel 배포를 목표로 하는 Next.js App Router 구조로 전환 중입니다.

## 로컬 확인

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000/`을 열면 됩니다.

## 구조

- `src/app`: Next.js App Router 페이지와 API route
- `src/components/study-hub.jsx`: 공개 운영 대시보드 UI
- `src/lib/data.js`: 프로젝트, 세션, 태스크, 로그, 권한 정책 데이터
- `src/lib/auth.js`: GitHub OAuth, signed session, role/scope 판정 유틸리티
- `src/lib/rate-limit.js`: 쓰기 API abuse 방지를 위한 서버 측 요청 제한
- `DESIGN.md`: 워크스페이스 UX, 템플릿 콘텐츠, 화면 설계 원칙
- `scripts/validate-data.mjs`: 도메인 데이터 검증 스크립트
- `scripts/scan-public-content.mjs`: 공개 콘텐츠 secret pattern scan
- `scripts/security-check.mjs`: CSRF, rate limit, 보안 헤더 등 회귀 검사
- `.github/workflows/validate.yml`: PR/push 검증 workflow
- `src/legacy`: 이전 정적 프로토타입 백업
- `docs/product-roadmap.md`: 스터디/프로젝트 운영 허브로 전환하기 위한 Epic, User Story, Task, MafiaSimulation 3개월 예시 계획
- `docs/product-policies.md`: GitHub 로그인, 권한, 편집, 검수, 보안, 감사 로그, 사용 정책
- `docs/vercel-hosting-automation-plan.md`: Vercel 호스팅, GitHub Actions 자동화, Preview/Production 배포 전략
- `docs/deployment-plan.md`: 현재 정적 프로토타입에서 Vercel 기반 동적 사이트로 전환하는 배포 계획
- `docs/github-member-sync.md`: GitHub organization 멤버 동기화 방식

## 주요 경로

- `/`: 프로젝트 디렉터리와 최근 운영 기록을 보여주는 공개 허브
- `/workspace`: 사이드바 기반 팀 워크스페이스. Overview, Planning board, Editor, Review, Archive를 분리하고 Developer/Admin은 프로젝트 운영 CRUD를 수행할 수 있습니다.
- `/projects`, `/projects/mafia-simulation`: 프로젝트 목록과 상세 계획
- `/sessions`, `/tasks`, `/logs`, `/archive`: 운영 기록 화면
- `/governance`, `/review`: 권한 정책과 검수 큐
- `/admin/audit`: Admin 감사 로그
- `/api/me`: 현재 세션과 권한 조회
- `/api/auth/start`: GitHub OAuth 시작. 환경 변수가 없으면 503을 반환합니다.
- `/api/health/db`: DB 연결과 schema 준비 상태 확인
- `/api/projects`, `/api/comments`, `/api/drafts`, `/api/backlog-items`, `/api/roadmap-items`, `/api/decision-records`, `/api/archive-items`, `/api/content-overrides`, `/api/static-content/promote`, `/api/task-updates`, `/api/review-queue`, `/api/audit-events`: 프로젝트 생성, 편집, 로드맵, 의사결정, 검수, 템플릿 콘텐츠 전환, 아카이브, 감사 API

## 다음 단계

1. Vercel project를 `team-ASP/teamASP.github.io`에 연결
2. GitHub Actions validation을 branch protection required check로 설정
3. GitHub App 또는 OAuth App 등록
4. Vercel environment variables에 server-only secret 등록
5. Editor UI, Review Queue, audit log 저장소 구현

## 검증 명령

```bash
npm run validate:data
npm run scan:public-content
npm run test:security
npm run build
```
