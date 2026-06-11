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
- `scripts/validate-data.mjs`: 도메인 데이터 검증 스크립트
- `scripts/scan-public-content.mjs`: 공개 콘텐츠 secret pattern scan
- `.github/workflows/validate.yml`: PR/push 검증 workflow
- `src/legacy`: 이전 정적 프로토타입 백업
- `docs/product-roadmap.md`: 스터디/프로젝트 운영 허브로 전환하기 위한 Epic, User Story, Task, MafiaSimulation 3개월 예시 계획
- `docs/product-policies.md`: GitHub 로그인, 권한, 편집, 검수, 보안, 감사 로그, 사용 정책
- `docs/vercel-hosting-automation-plan.md`: Vercel 호스팅, GitHub Actions 자동화, Preview/Production 배포 전략
- `docs/deployment-plan.md`: 현재 정적 프로토타입에서 Vercel 기반 동적 사이트로 전환하는 배포 계획
- `docs/github-member-sync.md`: GitHub organization 멤버 동기화 방식

## 주요 경로

- `/`: 공개 운영 대시보드
- `/projects`, `/projects/mafia-simulation`: 프로젝트 목록과 상세 계획
- `/sessions`, `/tasks`, `/logs`, `/archive`: 운영 기록 화면
- `/governance`, `/review`: 권한 정책과 검수 큐
- `/api/me`: 현재 세션과 권한 조회
- `/api/auth/start`: GitHub OAuth 시작. 환경 변수가 없으면 503을 반환합니다.

## 다음 단계

1. Vercel project를 `team-ASP/teamASP.github.io`에 연결
2. GitHub Actions validation을 branch protection required check로 설정
3. GitHub App 또는 OAuth App 등록
4. Vercel environment variables에 server-only secret 등록
5. Editor UI, Review Queue, audit log 저장소 구현
