# Vercel Hosting and Automation Plan

## 1. Decision Summary

ASP Study Hub의 장기 운영 목표는 GitHub Pages 기반 정적 사이트가 아니라 Vercel 기반 동적 사이트로 전환하는 것이다. 이유는 다음과 같다.

- GitHub 로그인과 organization membership 검증은 server-side boundary가 필요하다.
- Editor, Project Maintainer, Admin 권한을 write API에서 검증해야 한다.
- draft, review queue, comment, audit log 같은 기능은 동적 저장소와 API가 있어야 자연스럽다.
- Preview Deployment와 Production Deployment를 분리하면 팀원이 변경 사항을 배포 전 확인하기 쉽다.
- GitHub Actions를 validation, data sync, test, deployment gate로 사용하면 운영 자동화를 만들 수 있다.

GitHub Pages는 초기 public snapshot 또는 비상 fallback으로 유지할 수 있지만, 제품의 기본 hosting target은 Vercel로 둔다.

## 2. Official Vercel Capabilities to Use

Vercel Git integration:

- GitHub repository를 Vercel project에 연결한다.
- PR과 non-production branch push마다 Preview Deployment를 생성한다.
- production branch, 기본값은 `main`, 병합 시 Production Deployment를 생성한다.
- 각 deployment는 고유 URL을 갖기 때문에 review와 QA에 쓸 수 있다.

Vercel environments:

- Production: 실제 사용자에게 공개되는 배포.
- Preview: PR과 feature branch 검증용 배포.
- Development: local development와 `vercel dev`용 설정.
- 환경별 environment variables를 분리한다.

Vercel CLI and GitHub Actions:

- Git integration만으로도 자동 배포가 가능하다.
- 더 엄격한 CI/CD가 필요하면 GitHub Actions에서 `vercel pull`, `vercel build`, `vercel deploy --prebuilt`를 실행한다.
- Production 배포는 branch protection, required checks, optional manual approval을 통과한 뒤 진행한다.

References:

- https://vercel.com/docs/git/vercel-for-github
- https://vercel.com/docs/git
- https://vercel.com/docs/deployments
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/deployments/promoting-a-deployment

## 3. Target Architecture

### Application

Recommended target:

- Framework: Next.js on Vercel
- Frontend: React pages/components
- Backend: Route Handlers or Server Actions for auth/write APIs
- Auth: GitHub App user authorization or OAuth App web flow
- Storage:
  - MVP dynamic path: GitHub repository content files plus PR automation
  - Product path: database for draft/comment/audit log, published JSON snapshot for public rendering
  - Optional: GitHub Issues/Projects sync for task state

Why Next.js:

- Vercel first-class support
- Server-side API routes for GitHub OAuth code exchange and membership verification
- Environment variable separation between server-only secrets and public config
- Static rendering for public archive pages, dynamic rendering for authenticated editor pages

### Public and Private Boundaries

Public:

- Dashboard summary
- Published project/session/log/archive data
- Public presentation and demo links
- Member public profiles

Authenticated API:

- `/api/auth/start`
- `/api/auth/callback`
- `/api/me`
- `/api/logout`
- `/api/projects/:id/drafts`
- `/api/review-queue`
- `/api/comments`
- `/api/audit-log`

Server-only secrets:

- `GITHUB_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `DATABASE_URL`
- `SESSION_SECRET`
- `VERCEL_TOKEN`, only in GitHub Actions if Actions deploys to Vercel

Client-exposed config:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GITHUB_ORG=team-ASP`
- `NEXT_PUBLIC_AUTH_ENABLED=true`

## 4. Deployment Models

### Model A. Vercel Git Integration First

Use when:

- The team wants the simplest deployment path.
- Vercel should create Preview Deployments automatically for PRs.
- GitHub Actions should run validation and tests, but not deploy manually.

Flow:

1. Developer opens a PR.
2. GitHub Actions runs lint, tests, schema validation, secret scan, link checks.
3. Vercel Git integration creates Preview Deployment.
4. PR shows Actions checks and Vercel preview URL.
5. Maintainer reviews both code and preview.
6. Merge to `main`.
7. Vercel creates Production Deployment.

Pros:

- Simple setup
- Excellent PR preview workflow
- Fewer CI secrets

Cons:

- Production deployment is tied to merge behavior unless Vercel production promotion settings are customized.
- Some teams may want stronger release gates than automatic production deployment.

### Model B. GitHub Actions Controlled Vercel Deploy

Use when:

- The team wants GitHub Actions to be the deployment orchestrator.
- Production deploy should happen only after all custom automation passes.
- The team wants `vercel build` and `vercel deploy --prebuilt` in CI.

Required GitHub Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Preview flow:

1. PR opens or updates.
2. GitHub Actions checks out code.
3. Actions runs validation, tests, and build.
4. Actions runs `vercel pull --environment=preview`.
5. Actions runs `vercel build`.
6. Actions runs `vercel deploy --prebuilt`.
7. Actions comments the preview URL on the PR.

Production flow:

1. Merge to `main` or release workflow dispatch.
2. Actions runs full validation.
3. Actions runs `vercel pull --environment=production`.
4. Actions runs `vercel build --prod`.
5. Actions runs `vercel deploy --prebuilt --prod`.
6. Optional: require GitHub Environment approval before production deploy.

Pros:

- Maximum control over gates and automation
- CI build artifact is exactly what gets deployed
- Easier to add migrations, schema checks, content exports, and release notes

Cons:

- Requires Vercel deploy token in GitHub Actions secrets
- More workflow maintenance
- Duplicates some of Vercel Git integration behavior

### Recommended Path

Adopt Model A first, with GitHub Actions as required validation. Move to Model B only when production promotion needs stronger manual gates or prebuilt deploy reproducibility.

Reason:

- ASP Study Hub is still early-stage.
- Fast preview feedback is more valuable than complex release orchestration at first.
- The team can still add protected branches and required GitHub Actions checks.
- Vercel environment variables can hold runtime secrets while GitHub Actions only needs validation secrets.

## 5. GitHub Actions Automation

### Required Workflows

`validate.yml`:

- Runs on pull requests and pushes to `main`.
- Installs dependencies.
- Runs lint and tests.
- Validates data schema.
- Checks broken internal references.
- Scans public content for secret-like patterns.
- Fails if memberId, projectId, milestoneId, status enum, or URL format is invalid.

`preview-comment.yml`, if Model B is used:

- Deploys Preview Deployment through Vercel CLI.
- Comments preview URL on PR.

`production-deploy.yml`, if Model B is used:

- Runs on push to `main`, release tag, or manual dispatch.
- Uses GitHub Environment approval for production.
- Builds and deploys prebuilt artifact to Vercel production.

`data-sync.yml`, later:

- Syncs GitHub Issues/Projects into task data.
- Syncs repository metadata into project data.
- Exports published DB content to static JSON snapshot if the DB path is used.

### Example Validation Workflow

```yaml
name: Validate

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run validate:data
      - run: npm run scan:public-content
```

### Example Controlled Vercel Deploy

```yaml
name: Deploy to Vercel

on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run validate:data
      - run: npm install -g vercel
      - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

## 6. Product Automation Workflows

### Auth and Membership

- User signs in with GitHub.
- Vercel API route exchanges the OAuth/GitHub App code server-side.
- API checks `team-ASP` organization membership.
- API assigns Viewer, Editor, Project Maintainer, or Admin role.
- Session is stored in secure HTTP-only cookie.

### Edit and Review

- Editor creates draft from the website.
- Draft is stored in DB or repository branch.
- Review Queue shows submitted changes.
- Maintainer approves or requests changes.
- Approved content becomes published.
- Published content triggers cache revalidation or JSON snapshot export.

### Comment and Feedback

- Team-only comments are stored through authenticated API.
- Public comments require moderation policy.
- Hidden comments remain in audit trail.

### Archive Automation

- When project status changes to completed, archive checklist opens.
- Required fields are validated.
- Final deck, demo, repository, retrospective, and outcome summary are required.
- Admin approves archive finalization.
- Public archive page is revalidated and deployed.

## 7. Migration Plan

### Phase 0. Keep Static MVP, Prepare Data

- Continue current static app briefly.
- Define domain data schema.
- Add validation scripts.
- Keep PR-based data updates.
- Do not add write auth yet.

### Phase 1. Migrate to Vite or Next.js Shell

- If only static UI is needed, Vite is enough.
- If authenticated editing is required, move directly to Next.js.
- Preserve current IA and data model.
- Add routes for Dashboard, Projects, Sessions, Tasks, Logs, Archive, Members, Review Queue.

Recommendation:

- Choose Next.js because authenticated editing and server-side GitHub membership checks are core product requirements.

### Phase 2. Vercel Project Setup

- Create Vercel project linked to `team-ASP/teamASP.github.io`.
- Configure production branch as `main`.
- Add custom domain if needed.
- Configure Preview and Production environment variables.
- Add Vercel project settings for framework and build command.
- Enable automatic Preview Deployments.

### Phase 3. GitHub Actions Validation

- Add `validate.yml`.
- Make validation required in branch protection.
- Add PR template requiring preview check and data policy checklist.
- Add content validation and public secret scan.

### Phase 4. Authenticated Editing MVP

- Add GitHub App or OAuth App.
- Implement auth API routes.
- Implement `/api/me`.
- Implement Editor UI for draft sessions, tasks, logs, and comments.
- Implement Review Queue.
- Store draft/comment/audit data in selected storage.

### Phase 5. Production Automation

- Add data sync from GitHub Issues/Projects if useful.
- Add scheduled validation.
- Add archive finalization automation.
- Add release notes and deployment notifications.
- Decide whether to keep Vercel Git integration or move production deploy to GitHub Actions controlled prebuilt deploys.

## 8. Storage Options

### Option A. GitHub Repository as Storage

Use repository files as source of truth.

Good for:

- Published content
- Reviewable changes
- Early MVP

Weak for:

- Frequent comments
- Draft autosave
- Fine-grained permissions
- Audit search

### Option B. Database as Storage

Use a DB for drafts, comments, review queue, audit logs.

Good for:

- In-site editing
- Fast comment exchange
- Role-specific data access
- Audit history

Weak for:

- Requires migrations, backup, and DB operations
- Public static archive export needs a pipeline

### Recommended Hybrid

- DB: draft, comment, review queue, audit log, team-only content
- Git/data JSON: published public snapshot and long-term archive
- GitHub Issues/Projects: optional task sync, not the only source of truth at first

## 9. Security Requirements

- No server secret in browser bundle.
- No token in `NEXT_PUBLIC_*`.
- GitHub OAuth state and PKCE are required.
- Session cookie must be HTTP-only, secure, and SameSite.
- All write APIs re-check membership and role server-side.
- Production environment variables are separate from Preview and Development.
- GitHub Actions `VERCEL_TOKEN` is only required for Model B.
- Vercel runtime secrets live in Vercel environment variables.
- GitHub branch protection requires validation checks before merge.

## 10. Open Decisions

- Use Vercel Git integration only, or GitHub Actions controlled Vercel deploy?
- Use GitHub App or OAuth App for login?
- Use Next.js immediately, or perform an intermediate Vite migration?
- Which DB should store drafts/comments/audit logs?
- Should published public data be exported to repository JSON snapshots?
- Should GitHub Issues/Projects be authoritative for tasks, or only synced as linked metadata?
