# ASP Study Hub Product Policies

## 1. Policy Goals

이 문서는 ASP Study Hub가 실제 팀 운영 도구로 쓰이기 위해 필요한 로그인, 권한, 편집, 검수, 보안, 사용 정책을 정의한다. 기본 원칙은 다음과 같다.

1. 공개 정보는 누구나 읽을 수 있어야 한다.
2. 편집 권한은 GitHub organization `team-ASP` 멤버에게만 부여한다.
3. 모든 중요한 변경은 작성자, 시간, 변경 대상, 검수 상태가 남아야 한다.
4. API key, GitHub token, 비공개 자료는 브라우저 번들에 들어가면 안 된다.
5. 빠른 의견 교환은 허용하되, 공개 아카이브 품질은 리뷰와 정책으로 유지한다.

## 2. Roles and Permissions

현재 배포 구현은 역할을 `viewer`, `developer`, `admin` 세 단계로 단순화한다.

- `viewer`: 로그인하지 않은 사용자. 공개 프로젝트, 로그, 아카이브를 읽을 수 있으나 쓰기 API를 사용할 수 없다.
- `developer`: GitHub 로그인과 `team-ASP` organization membership이 확인된 사용자. 프로젝트 생성, 백로그 CRUD, draft 작성/삭제, review 처리, archive artifact 관리를 수행한다.
- `admin`: Developer 권한 전체에 더해 정적 seed task/review/archive checklist 숨김, 감사 로그 확인, 시스템 정책 관리를 수행한다.

과거 설계의 `Editor`와 `Project Maintainer`는 현재 구현에서 `developer`로 매핑한다. 기존 세부 정책 문구는 장기 확장 아이디어로 남기되, 실제 API 권한 판단은 위 세 역할을 기준으로 한다.

### Viewer

대상:

- 로그인하지 않은 방문자
- 로그인했지만 `team-ASP` organization 멤버로 확인되지 않은 사용자

권한:

- 공개 Dashboard, Projects, Sessions summary, Logs, Archive, Members 조회
- 공개 repository, 발표 자료, 데모 링크 이동
- 검색과 필터 사용

제한:

- 데이터 생성, 수정, 삭제 불가
- 내부 메모, draft, private feedback 조회 불가
- 멤버 전용 회의록이나 미공개 발표 자료 조회 불가

### Authenticated Non-member

대상:

- GitHub 로그인은 완료했지만 `team-ASP` 멤버가 아닌 사용자

권한:

- Viewer와 동일
- 선택 정책으로 외부 피드백 제출 가능. 단, 기본값은 GitHub Issue 또는 별도 contact link로 우회한다.

제한:

- 사이트 내부 편집 권한 없음
- 멤버 목록, 내부 draft, admin API 접근 불가

### Editor

대상:

- GitHub 로그인 완료
- `team-ASP` organization membership이 확인된 사용자

권한:

- 프로젝트, 세션, 태스크, 로그, 자료 링크 생성
- 본인이 작성한 draft 수정
- 프로젝트별 discussion/comment 작성
- task status 업데이트
- 실험 로그와 회고 초안 작성

제한:

- completed/archived 상태 전환은 Project Maintainer 또는 Admin 승인 필요
- 다른 사용자의 published content 직접 삭제 불가
- 권한, 멤버, 시스템 설정 변경 불가
- 보안/개인정보/외부 공개 위험이 있는 항목은 review 상태로만 제출 가능

### Project Maintainer

대상:

- 특정 프로젝트의 owner 또는 maintainer로 지정된 `team-ASP` 멤버

권한:

- 담당 프로젝트의 planning, milestone, session, task, log 검수 및 publish
- 담당 프로젝트의 archive checklist 승인
- 프로젝트별 announcement 작성
- 부정확하거나 중복된 content의 수정 요청

제한:

- 전체 사이트 권한 정책 변경 불가
- 다른 프로젝트 maintainer 권한 변경 불가

### Admin

대상:

- `teamASP.github.io` repository 관리자
- `team-ASP` organization owner 또는 운영 책임자

권한:

- 권한 매핑과 role assignment 관리
- OAuth/GitHub App 설정 관리
- 배포, 데이터 스키마, validation rule 변경
- 비상 롤백, content 숨김, abuse 대응
- archive final approval

제한:

- Admin도 audit log 없이 production 데이터를 직접 덮어쓰지 않는다.
- 보안 secret은 GitHub repository/organization secrets 또는 배포 플랫폼 secret store에만 둔다.

## 3. Authentication and Authorization Policy

### Recommended Architecture

Target architecture는 Vercel 기반 동적 사이트다. GitHub Pages는 초기 public snapshot 또는 비상 fallback으로 유지할 수 있지만, 로그인과 쓰기 기능은 Vercel server-side API 계층에서 처리한다.

Recommended stack:

- Frontend: Next.js on Vercel
- Auth: GitHub App user authorization 또는 OAuth web application flow
- Backend/API: Next.js Route Handlers 또는 Server Actions on Vercel
- Storage: DB for drafts/comments/audit logs, GitHub repository data files for published snapshots, GitHub Issues/Projects sync as optional integration
- Deployment: Vercel Git integration for Preview/Production Deployments, GitHub Actions for validation and automation

정책상 브라우저에서 GitHub client secret, app private key, long-lived token을 직접 보관하거나 호출하지 않는다. GitHub OAuth의 authorization code 교환과 GitHub App token 발급은 서버 측에서 처리한다.

Official basis:

- GitHub OAuth web application flow는 사용자를 GitHub로 redirect하고 callback code를 access token으로 교환하는 흐름을 사용한다.
- GitHub App user access token은 app 권한과 사용자 권한의 교집합으로 제한된다.
- Organization membership 확인 API는 read 권한이 필요하며, private membership까지 확인하려면 인증된 서버 측 호출이 필요하다.
- GitHub Actions secrets는 repository, environment, organization 단위로 관리할 수 있으나 클라이언트 번들에 노출하면 안 된다.
- Vercel Git integration은 GitHub branch/PR push마다 Preview Deployment를 만들고 production branch 병합 시 Production Deployment를 만들 수 있다.
- Vercel environment variables는 Production, Preview, Development 환경별로 분리해 관리한다.

References:

- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- https://docs.github.com/en/rest/orgs/members
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- https://vercel.com/docs/git/vercel-for-github
- https://vercel.com/docs/environment-variables

### Login Flow

1. Viewer가 `Sign in with GitHub`를 누른다.
2. Frontend가 auth API에서 state, nonce, PKCE challenge를 발급받는다.
3. 사용자는 GitHub authorization page로 이동한다.
4. GitHub가 callback URL로 code와 state를 전달한다.
5. Backend가 state를 검증하고 code를 token으로 교환한다.
6. Backend가 GitHub API로 사용자 identity와 organization membership을 확인한다.
7. Backend가 ASP Study Hub session을 발급한다.
8. Frontend는 `/me` API로 role과 editable scope를 가져온다.

### Authorization Rules

- 기본 role은 Viewer다.
- 로그인 성공 후 organization membership이 확인되면 Editor가 된다.
- `members[].siteRole` 또는 별도 role mapping에서 maintainer/admin을 부여한다.
- 권한은 UI 표시만으로 판단하지 않고 모든 write API에서 서버 측으로 재검증한다.
- membership cache TTL은 10분에서 1시간 사이로 둔다. 권한 박탈 대응이 필요한 경우 Admin이 cache purge를 실행할 수 있어야 한다.
- organization에서 제거된 사용자는 다음 session refresh 또는 cache 만료 시 Editor 권한을 잃는다.

## 4. Editing Model

### Content Types

- Project: 목표, 기간, 멤버, milestones, success criteria, repository, outcomes
- Session: agenda, notes, decisions, action items, slides, recording
- Task: title, owner, status, due date, linked issue/PR/log
- Log: experiment, decision, issue, retrospective, resource, presentation
- Comment: 프로젝트/세션/로그 단위 의견
- Archive: final summary, demo, final deck, retrospective, follow-up ideas

### Edit Status

- draft: 작성자만 수정 가능. Project Maintainer와 Admin은 조회 가능.
- review: publish 전 검수 대기 상태.
- published: Viewer에게 공개되는 상태.
- changes-requested: 수정 요청 상태.
- archived: 완료 프로젝트의 장기 보존 상태.
- hidden: 정책 위반, 보안, 개인정보 이슈로 임시 비공개 상태.

### Write Paths

#### MVP Path: PR-based Editing

초기에는 사이트 내 editor UI가 없더라도 운영 가능해야 한다.

- 데이터는 repository의 structured files에 저장한다.
- Editor는 GitHub UI 또는 로컬 변경으로 PR을 만든다.
- GitHub Actions가 schema, broken link, member id, status 값을 검증한다.
- Maintainer가 review 후 merge한다.
- Vercel Production Deployment 또는 public snapshot 배포가 완료되면 공개 사이트에 반영된다.

장점:

- 서버 없이 시작 가능
- GitHub audit trail과 review를 바로 활용 가능
- 보안 위험이 낮음

한계:

- 즉각적인 사이트 내 편집 경험은 부족함
- 비개발 팀원이 쓰기 어렵고 모바일 작성성이 낮음

#### Product Path: In-site Editing with Review

프로덕트화 단계에서는 사이트 안에서 편집이 가능해야 한다.

- Editor는 웹 UI에서 content를 생성하거나 수정한다.
- 작은 의견/comment는 즉시 저장한다.
- 공개 페이지에 영향을 주는 project/session/task/log/archive 변경은 review 상태로 생성한다.
- Maintainer가 approve하면 published가 된다.
- Backend는 변경을 DB에 저장하거나 GitHub branch/PR로 변환한다.

Recommended policy:

- Comment와 lightweight progress update는 즉시 반영하되 작성자, 시간, 수정 이력을 남긴다.
- Project goals, milestones, archive summary, presentation link는 review 후 publish한다.
- 삭제는 hard delete가 아니라 hidden 또는 superseded 처리한다.
- 공개 아카이브 변경은 최소 1명 이상의 maintainer approval을 요구한다.

#### Vercel Dynamic Path

Vercel 전환 후에는 다음 write path를 우선한다.

- Draft, comment, audit log는 DB에 저장한다.
- Published public content는 Next.js page cache 또는 public JSON snapshot으로 제공한다.
- 중요한 publish action은 review queue를 통과한다.
- Approved content는 cache revalidation 또는 snapshot export workflow를 트리거한다.
- GitHub Issues/Projects는 task metadata sync 대상으로 두되, 초기에는 단일 source of truth로 강제하지 않는다.

## 5. Review and Publishing Policy

### No-review Allowed

다음 항목은 Editor가 바로 publish할 수 있다.

- 본인 task 상태 변경
- 세션 참석 여부
- 프로젝트 discussion comment
- 오타 수정
- 내부 draft 작성
- 본인이 작성한 unpublished draft 수정

### Maintainer Review Required

다음 항목은 Project Maintainer 승인이 필요하다.

- Project goal, scope, success criteria 변경
- Milestone 추가, 삭제, due date 변경
- Session official notes publish
- Experiment result publish
- Midterm/final presentation link publish
- Project status를 active, paused, completed로 변경

### Admin Review Required

다음 항목은 Admin 승인이 필요하다.

- Project archive finalization
- 멤버 role 변경
- 권한 정책 변경
- 사이트 navigation, data schema, deployment workflow 변경
- 공개 범위 변경
- 보안 사고 대응과 content hidden 처리

## 6. Comment and Feedback Policy

프로젝트 진행 중 즉각적인 의견 교류를 지원하되, 공개 아카이브의 품질을 해치지 않는 구조를 사용한다.

### Comment Scope

- Project comment: 방향성, 제안, 질문
- Session comment: 회의 후 보충 의견
- Task comment: 구현/리뷰 논의
- Log comment: 실험 해석, 재현 질문, 후속 아이디어
- Archive comment: 완료 후 후속 연구 제안

### Visibility

- public: 누구나 조회 가능
- team-only: 로그인한 `team-ASP` 멤버만 조회 가능
- maintainer-only: maintainer/admin만 조회 가능

기본값:

- 일반 프로젝트 comment는 team-only
- published log와 archive comment는 public 가능
- API key, 미공개 연구 자료, 개인정보, 내부 비용 정보가 포함된 comment는 public 금지

### Moderation

- 작성자는 본인 comment를 수정할 수 있다.
- 작성자는 본인 comment를 삭제 요청할 수 있다.
- Maintainer/Admin은 comment를 hidden 처리할 수 있다.
- hidden 처리 시 사유와 처리자가 audit log에 남아야 한다.

## 7. Security Policy

### Secrets

- GitHub client secret, GitHub App private key, deployment token, LLM API key는 client-side code에 포함하지 않는다.
- secrets는 GitHub Actions secrets, organization secrets, environment secrets, 또는 배포 플랫폼 secret store에 저장한다.
- production과 development secret을 분리한다.
- secret 접근 권한은 Admin으로 제한한다.

### API Security

- 모든 write API는 session과 role을 서버에서 검증한다.
- CSRF 방지를 위해 OAuth state, session cookie SameSite 설정, write request CSRF token을 사용한다.
- CORS는 production domain과 local development origin으로 제한한다.
- rate limit을 둔다.
- user input은 저장 전 sanitization하고, 표시 전 escaping한다.
- URL 필드는 allowlist 또는 safe protocol 검증을 통과해야 한다.

### Data Exposure

- public bundle에는 public data만 포함한다.
- team-only data는 authenticated API로만 내려준다.
- private membership 정보를 public member list로 노출하지 않는다.
- 발표 전 자료, 내부 회고, 비용 정보, token fragment, 개인 이메일은 public archive에 포함하지 않는다.

### Incident Response

1. 문제가 되는 content를 hidden 처리한다.
2. 관련 session/token을 revoke한다.
3. GitHub secret 또는 deployment secret을 rotate한다.
4. audit log와 git history를 확인한다.
5. 재발 방지 rule을 validation 또는 review checklist에 추가한다.

## 8. Data Governance

### Source of Truth

Phase 1:

- Git repository의 data files가 source of truth다.
- 모든 publish 변경은 PR과 Git history로 추적한다.

Phase 2:

- DB 또는 headless CMS가 draft/comment source of truth가 된다.
- Published snapshot은 Vercel public rendering 또는 정적 JSON snapshot으로 export한다.

Phase 3:

- GitHub Issues/Projects와 sync한다.
- Task는 GitHub Issue와 연결 가능해야 하며, 사이트 status와 GitHub status 간 충돌 정책을 정의한다.

### Audit Log

모든 write action은 다음 정보를 남긴다.

- actor GitHub login
- role at action time
- action type
- target content id
- before/after summary
- timestamp
- request id
- review status
- reviewer, if any

Audit log는 public data가 아니며 Admin만 조회한다. 단, 공개 콘텐츠의 작성자와 마지막 수정일은 Viewer에게 표시할 수 있다.

### Retention

- published content는 영구 보존을 기본으로 한다.
- draft는 180일 동안 변경이 없으면 작성자에게 정리 알림을 보낸다.
- hidden content는 Admin 검토 후 archive 또는 permanent delete를 결정한다.
- audit log는 최소 1년 보존한다.

## 9. Content Quality Policy

### Required Fields

Project:

- title, summary, status, period, owner, goals, repositoryUrl 또는 reasonNoRepository

Session:

- date, projectId, title, agenda, owner

Task:

- title, projectId, status, ownerId, milestoneId 또는 noMilestoneReason

Log:

- type, projectId, date, authorId, summary, relatedMilestoneId

Archive:

- final summary, outcomes, repositoryUrl, presentationUrl 또는 missingReason, retrospective

### Validation Rules

- 모든 id는 kebab-case를 사용한다.
- 날짜는 ISO format `YYYY-MM-DD`를 사용한다.
- status는 정의된 enum만 허용한다.
- memberId는 `members`에 존재해야 한다.
- projectId는 `projects`에 존재해야 한다.
- public URL은 `https://`를 우선한다.
- broken link는 warning 또는 failure로 처리한다.
- public content에 `api_key`, `token`, `secret`, `.env` 패턴이 있으면 publish를 막는다.

## 10. UX Policy

### Viewer Experience

- 로그인하지 않아도 핵심 프로젝트, 진행 상태, 아카이브 결과를 이해할 수 있어야 한다.
- 로그인 버튼은 편집이 필요한 곳에 자연스럽게 노출한다.
- 권한 없는 사용자가 편집 버튼을 눌렀을 때는 GitHub 로그인과 권한 기준을 명확히 설명한다.

### Editor Experience

- 편집 가능한 항목에는 edit affordance를 표시한다.
- 저장 전 validation error를 필드 단위로 보여준다.
- publish가 필요한 변경은 "Submit for review"로 표현한다.
- 본인의 draft, review 대기, changes requested 항목을 Dashboard에 보여준다.

### Maintainer Experience

- 프로젝트별 review queue를 제공한다.
- 변경 diff, 작성자, 관련 milestone/task/log를 한 화면에서 확인한다.
- approve, request changes, hide, merge/publish action을 제공한다.

### Admin Experience

- role mapping, membership sync status, failed login, validation failure, recent hidden content를 확인할 수 있어야 한다.
- dangerous action은 confirmation과 reason 입력을 요구한다.

## 11. Implementation Roadmap

### Policy Phase 0. Static Governance

- Viewer-only public site 유지
- role policy 문서화
- PR template과 content checklist 추가
- data validation script 추가

### Policy Phase 1. GitHub Login Readiness

- GitHub App 또는 OAuth App 등록
- Vercel 기반 callback/API backend 설계
- `/auth/start`, `/auth/callback`, `/me`, `/logout` API 설계
- organization membership verification 설계
- session cookie와 CSRF 정책 설계

### Policy Phase 1.5. Vercel Hosting Readiness

- Next.js migration scope 결정
- Vercel project 생성
- Production branch를 `main`으로 설정
- Preview/Production/Development environment variables 분리
- GitHub Actions validation workflow를 branch protection required check로 등록
- Preview Deployment review rule을 PR template에 추가

### Policy Phase 2. Editor UI MVP

- 로그인 상태 표시
- Editor 전용 draft create/edit UI
- comment 작성
- review queue
- Project Maintainer approve flow

### Policy Phase 3. Operational Hardening

- audit log viewer
- role management UI
- backup/export
- rate limiting
- incident response checklist
- GitHub Issues/Projects sync

Related plan:

- `docs/vercel-hosting-automation-plan.md`

## 12. Open Decisions

- GitHub App과 OAuth App 중 무엇을 1차 구현으로 선택할 것인가?
- Vercel Git integration만 사용할 것인가, GitHub Actions controlled `vercel deploy --prebuilt`를 사용할 것인가?
- Next.js로 바로 전환할 것인가, Vite static MVP를 거칠 것인가?
- draft/comment 저장소를 GitHub repository로 둘 것인가, DB로 둘 것인가?
- 외부 사용자의 feedback 제출을 허용할 것인가?
- team-only content를 어느 배포 환경에서 제공할 것인가?
- Admin role을 GitHub organization owner와 동일하게 둘 것인가, 별도 allowlist로 둘 것인가?
- comment를 GitHub Discussions와 동기화할 것인가, 사이트 내부 데이터로만 관리할 것인가?
