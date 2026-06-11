# Deployment Plan

## Current State

현재 앱은 빌드 과정 없이 `index.html`, `src/data.js`, `src/app.js`, `src/styles.css`로 실행되는 정적 프로토타입이다. 이 상태에서는 GitHub Pages로 공개 읽기 사이트를 배포할 수 있지만, 안전한 GitHub 로그인, organization membership 검증, 사이트 내 쓰기 권한, review queue, audit log를 구현하기에는 한계가 있다.

## Target State

목표 hosting 환경은 Vercel 기반 동적 사이트다.

- Framework: Next.js on Vercel
- Public pages: published project/session/log/archive data
- Authenticated pages: editor UI, review queue, admin/audit views
- Server-side APIs: GitHub auth callback, organization membership verification, write APIs
- Deployment: Vercel Preview/Production Deployment
- Automation: GitHub Actions validation, data sync, policy checks

세부 계획은 `docs/vercel-hosting-automation-plan.md`를 따른다.

## Hosting Strategy

### Phase 0. GitHub Pages Fallback

GitHub Pages는 초기 public snapshot 또는 fallback으로만 사용한다.

Use cases:

- 정적 MVP를 빠르게 공개
- Vercel 전환 전 임시 공개 URL 제공
- 장애 시 최소한의 public archive 제공

Limits:

- server-side secret을 안전하게 다룰 수 없다.
- GitHub OAuth code exchange를 클라이언트에서 처리하면 안 된다.
- organization private membership 확인과 write API 검증에 부적합하다.

### Phase 1. Vercel Git Integration

Vercel project를 `team-ASP/teamASP.github.io` repository에 연결한다.

Expected flow:

1. PR 생성 또는 branch push
2. GitHub Actions validation 실행
3. Vercel Preview Deployment 생성
4. Maintainer가 PR diff와 preview URL 검토
5. `main` merge
6. Vercel Production Deployment 생성

Required setup:

- Vercel project 생성
- Production branch: `main`
- Preview Deployment 활성화
- Production/Preview/Development environment variables 분리
- GitHub branch protection에서 validation workflow required check 설정

### Phase 2. GitHub Actions Controlled Deploy, Optional

더 강한 release gate가 필요하면 GitHub Actions에서 Vercel CLI를 직접 실행한다.

Required GitHub Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Recommended commands:

```bash
vercel pull --yes --environment=production --token=$VERCEL_TOKEN
vercel build --prod --token=$VERCEL_TOKEN
vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

이 방식은 production 배포 전 GitHub Environment approval, DB migration, content export, release note 생성 같은 자동화를 강제할 때 사용한다.

## Automation Workflows

### Validation

Runs on:

- Pull request
- Push to `main`

Checks:

- lint
- unit tests
- data schema validation
- internal reference validation
- URL format and broken link checks
- public content secret-pattern scan
- role/member/project id validation

### Preview Review

Runs on:

- Pull request

Checks:

- Vercel Preview URL is available
- Reviewer confirms UI is not broken
- Reviewer confirms no private content appears in public pages

### Production

Runs on:

- Merge to `main`, if using Vercel Git integration
- Manual dispatch or push to `main`, if using GitHub Actions controlled deploy

Checks:

- required validation passed
- environment variables configured
- migration/export steps completed, once DB exists
- production deployment smoke check

### Scheduled Data Sync

Runs on:

- schedule
- manual dispatch

Possible jobs:

- GitHub repository metadata sync
- GitHub Issues/Projects task sync
- archive completeness report
- broken external link report
- stale draft notification

## Environment Variables

Vercel runtime secrets:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `SESSION_SECRET`
- `DATABASE_URL`

Public variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GITHUB_ORG`
- `NEXT_PUBLIC_AUTH_ENABLED`

GitHub Actions secrets, only if Actions deploys to Vercel:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Rules:

- Do not commit secrets.
- Do not expose secrets through `NEXT_PUBLIC_*`.
- Keep Production, Preview, Development values separate.
- Rotate secrets after incident response.

## Migration Checklist

1. Keep current static prototype working.
2. Add data schema and validation workflow.
3. Create Vercel project.
4. Decide Next.js migration scope.
5. Add Vercel Preview Deployment to PR review process.
6. Add GitHub auth server-side API.
7. Add membership verification and role mapping.
8. Add editor UI and review queue.
9. Add audit log and DB storage.
10. Decide whether GitHub Actions controlled deploy is necessary.

## References

- `docs/vercel-hosting-automation-plan.md`
- `docs/product-policies.md`
- `docs/product-roadmap.md`
