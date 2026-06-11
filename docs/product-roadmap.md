# ASP Study Hub Product Roadmap

## 1. Product Direction

현재 사이트는 `src/data.js`의 mock 데이터와 `src/app.js`의 범용 카드/목록 UI로 구성된 프로토타입이다. 앞으로의 사이트는 ASP 팀이 진행하는 스터디와 프로젝트를 다음 흐름으로 운영하는 작업 공간이 되어야 한다.

1. 플래닝: 주제, 목표, 기간, 멤버, 산출물, 실험 가설, 마일스톤을 등록한다.
2. 진행 관리: 주차별 세션, 태스크, 의사결정, 실험 로그, 리스크를 누적한다.
3. 결과 정리: 데모, 발표 자료, 회고, 배운 점, 코드/문서 링크를 정리한다.
4. 아카이빙: 완료된 프로젝트를 검색 가능한 포트폴리오와 지식베이스로 남긴다.

초기 구현은 정적 사이트 형태를 유지하되, 데이터 구조를 실제 운영 가능한 형태로 바꾸는 것을 우선한다. 다만 GitHub 로그인, organization membership 검증, 사이트 내 편집, review queue, audit log가 핵심 요구사항이므로 장기 hosting target은 Vercel 기반 동적 사이트로 둔다. GitHub Pages는 public snapshot 또는 fallback으로 유지할 수 있다.

운영 단계에서는 GitHub 로그인을 도입해 `team-ASP` organization 멤버가 사이트 안에서 직접 데이터를 작성, 수정, 검수할 수 있어야 한다. 로그인하지 않은 사용자는 Viewer로 두고, 로그인했지만 organization 멤버가 아닌 사용자는 공개 조회만 허용한다. 세부 정책은 `docs/product-policies.md`를 기준으로 한다.

## 2. Core Information Architecture

### Primary Navigation

- Dashboard: 지금 진행 중인 스터디/프로젝트, 이번 주 일정, 막힌 항목, 발표 예정 항목을 보여준다.
- Projects: 프로젝트와 스터디의 목록, 상태, 진행률, 마일스톤, 산출물을 관리한다.
- Sessions: 주차별 세션, 발표, 실습, 회의록을 관리한다.
- Tasks: 프로젝트별 backlog, 담당자, 상태, due date, dependency를 추적한다.
- Logs: 실험 결과, 의사결정 기록, 회고, 문제 해결 노트를 누적한다.
- Archive: 완료 프로젝트의 최종 결과, 발표 자료, 데모 링크, 소스 링크, 회고를 탐색한다.
- Members: 멤버별 역할, 관심사, 참여 프로젝트, 담당 태스크를 보여준다.
- Review Queue: Editor가 제출한 변경 요청을 Project Maintainer와 Admin이 검수한다.
- Admin Guide: 데이터 업데이트 규칙, release checklist, GitHub 연동 방식을 문서화한다.

### Data Model MVP

```js
project = {
  id,
  title,
  type, // study | project | research
  status, // planning | active | paused | completed | archived
  period: { start, end },
  summary,
  goals: [],
  successCriteria: [],
  repositoryUrl,
  demoUrl,
  presentationUrl,
  members: [{ id, role }],
  milestones: [{ id, week, title, status, deliverables: [] }],
  tasks: [{ id, title, status, ownerId, due, milestoneId, links: [] }],
  sessions: [{ id, date, title, agenda: [], notes, recordingUrl, slidesUrl }],
  logs: [{ id, date, type, title, summary, links: [] }],
  outcomes: [{ type, title, url, description }],
  risks: [{ title, impact, mitigation, status }],
};
```

## 3. Governance and Editing Policy

ASP Study Hub는 공개 아카이브이면서 팀 내부 운영 도구다. 따라서 읽기와 쓰기 권한을 명확히 분리한다.

Roles:

- Viewer: 로그인하지 않은 사용자. 공개 콘텐츠 조회, 검색, 링크 이동만 가능하다.
- Authenticated Non-member: GitHub 로그인은 했지만 `team-ASP` 멤버가 아닌 사용자. Viewer와 동일한 권한을 갖는다.
- Editor: GitHub 로그인과 `team-ASP` organization membership이 확인된 사용자. 프로젝트, 세션, 태스크, 로그, 댓글을 작성할 수 있다.
- Project Maintainer: 특정 프로젝트의 owner 또는 maintainer. 담당 프로젝트의 review/publish 권한을 갖는다.
- Admin: repository 또는 organization 운영 책임자. 권한, 배포, 보안, archive finalization을 관리한다.

Editing policy:

- 공개 읽기 기능은 GitHub Pages 정적 사이트에서도 제공한다.
- 안전한 사이트 내 편집을 위해서는 GitHub OAuth 또는 GitHub App 로그인과 서버 측 API가 필요하다.
- 브라우저 번들에는 GitHub client secret, GitHub App private key, deployment token, LLM API key를 포함하지 않는다.
- 모든 write API는 서버에서 session, role, organization membership을 재검증한다.
- comment와 lightweight progress update는 빠른 의견 교환을 위해 즉시 저장할 수 있다.
- project goal, milestone, official session note, experiment result, presentation link, archive summary는 review 후 publish한다.
- 삭제는 기본적으로 hard delete가 아니라 hidden, superseded, archived 상태로 처리한다.
- 모든 중요한 변경은 actor, timestamp, target id, before/after summary, review status를 audit log로 남긴다.

Implementation approach:

- Phase 1은 PR 기반 편집으로 시작한다. GitHub Actions가 schema, broken link, member id, secret pattern을 검증하고 maintainer가 merge한다.
- Phase 2에서 Next.js/Vercel 기반 shell로 이전하고 Preview Deployment를 운영한다.
- Phase 3에서 GitHub login, `/me`, editor UI, draft/review/publish workflow를 도입한다.
- Phase 4에서 role management, audit log viewer, GitHub Issues/Projects sync, incident response workflow를 추가한다.

Full policy:

- `docs/product-policies.md`
- `docs/vercel-hosting-automation-plan.md`

## 4. Epics, User Stories, and Tasks

### Epic 1. Project Planning Workspace

사용자가 새 스터디/프로젝트를 등록하고, 3개월 단위 계획을 볼 수 있어야 한다.

User Stories:

- 팀 리더로서 프로젝트 목표, 기간, 참여자, repository, 최종 산출물을 한 화면에 등록하고 싶다.
- 참여자로서 이번 프로젝트가 어떤 마일스톤과 성공 기준을 갖는지 빠르게 확인하고 싶다.
- 신규 멤버로서 프로젝트 시작 배경과 읽어야 할 자료를 한 곳에서 보고 싶다.

Tasks:

- `src/data.js`의 mock project를 실제 프로젝트 스키마로 교체한다.
- Project detail drawer를 별도 상세 뷰 수준으로 확장한다.
- goals, success criteria, milestones, risks, resources 섹션을 추가한다.
- planning 상태 프로젝트를 Dashboard 상단에 노출한다.

Acceptance Criteria:

- Multi-Agent/MafiaSimulation 프로젝트의 12주 계획이 사이트에 표시된다.
- 프로젝트 카드에서 목표, 현재 단계, 다음 마일스톤, repository 링크를 확인할 수 있다.
- mock label이 사용자 화면에 남지 않는다.

### Epic 2. Weekly Progress and Session Tracking

주차별 진행 상황, 스터디 세션, 회의록, 발표 자료를 누적할 수 있어야 한다.

User Stories:

- 스터디 진행자로서 이번 주 agenda, 사전 준비물, 세션 결과를 등록하고 싶다.
- 참여자로서 놓친 세션의 요약, 결정 사항, 다음 액션을 빠르게 복습하고 싶다.
- 팀 전체로서 프로젝트별 진행률과 지연 리스크를 확인하고 싶다.

Tasks:

- Sessions 페이지를 추가하고 프로젝트별 필터를 제공한다.
- 세션 카드에 agenda, decision, action items, slides link, recording link를 표시한다.
- Dashboard에 current week panel과 overdue tasks panel을 추가한다.
- 진행률 계산을 수동 숫자에서 milestone/task 상태 기반으로 바꾼다.

Acceptance Criteria:

- 각 주차별 세션이 프로젝트 상세와 Sessions 목록 양쪽에서 탐색된다.
- action item의 owner와 due date가 화면에 표시된다.
- 완료/진행/지연 상태가 색과 텍스트로 구분된다.

### Epic 3. Task and Backlog Management

스터디/프로젝트 실행에 필요한 작업을 backlog로 나누고 담당자를 추적할 수 있어야 한다.

User Stories:

- 프로젝트 오너로서 milestone별 task를 나누고 담당자와 마감일을 지정하고 싶다.
- 참여자로서 내가 맡은 작업과 이번 주 우선순위를 보고 싶다.
- 리뷰어로서 blocked task와 의사결정이 필요한 항목을 보고 싶다.

Tasks:

- Tasks 페이지를 추가한다.
- status taxonomy를 `todo`, `in-progress`, `review`, `blocked`, `done`으로 정의한다.
- member filter, project filter, status filter를 구현한다.
- task detail에 GitHub issue/PR 링크, 관련 session/log 링크를 붙인다.

Acceptance Criteria:

- 프로젝트별 backlog와 멤버별 assigned task를 볼 수 있다.
- blocked task가 Dashboard에 노출된다.
- GitHub issue를 아직 연동하지 않아도 정적 데이터로 동일한 UI가 동작한다.

### Epic 4. Research Logs and Knowledge Base

프로젝트 중 발생한 실험, 조사, 의사결정, 문제 해결 과정을 검색 가능한 기록으로 남겨야 한다.

User Stories:

- 연구 담당자로서 실험 가설, 방법, 결과, 다음 액션을 기록하고 싶다.
- 개발자로서 과거에 겪은 Unity/LLM 연동 문제의 해결 과정을 검색하고 싶다.
- 발표 준비자로서 프로젝트 중간 산출물을 모아 발표 narrative를 만들고 싶다.

Tasks:

- 기존 Wiki/Blog를 Logs/Knowledge Base로 재정의한다.
- log type을 `experiment`, `decision`, `issue`, `retrospective`, `resource`, `presentation`으로 나눈다.
- 프로젝트 상세에 관련 log timeline을 표시한다.
- 검색 대상을 project, session, task, log 전체로 확장한다.

Acceptance Criteria:

- MafiaSimulation의 LLM provider 비교, agent prompt 실험, voting behavior 관찰 로그를 등록할 수 있다.
- 로그는 날짜, 작성자, 관련 마일스톤, 링크를 포함한다.
- Archive 상세에서 핵심 로그가 결과물과 함께 노출된다.

### Epic 5. Results, Archive, and Presentation

완료된 프로젝트를 발표 가능한 결과물과 장기 보존 가능한 아카이브로 정리해야 한다.

User Stories:

- 프로젝트 팀으로서 최종 발표 자료, 데모 영상, 코드, 주요 성과, 한계를 한 페이지에 정리하고 싶다.
- 외부 방문자로서 ASP 팀이 어떤 프로젝트를 했고 무엇을 배웠는지 빠르게 이해하고 싶다.
- 후속 팀으로서 이전 프로젝트의 자료를 이어받아 다음 실험을 설계하고 싶다.

Tasks:

- Archive 페이지를 완료 프로젝트 중심으로 재구성한다.
- Project detail에 outcome 섹션을 추가한다.
- Presentation 섹션에 midterm/final deck, demo script, 발표자, 발표일을 표시한다.
- completed 상태로 전환할 때 archive checklist를 통과하도록 문서화한다.

Acceptance Criteria:

- 프로젝트 완료 후 summary, demo, slides, repository, retrospective가 한 화면에 정리된다.
- 발표 자료가 없는 프로젝트는 missing 상태로 표시된다.
- Archive에서 기술 태그, 기간, 프로젝트 타입으로 탐색할 수 있다.

### Epic 6. Data Operations and GitHub Integration

정적 사이트를 유지하면서도 운영 데이터 업데이트 비용을 줄여야 한다.

User Stories:

- 운영자로서 Vercel Preview/Production Deployment를 활용해 안전하게 배포하고 싶다.
- 운영자로서 멤버/프로젝트 데이터가 커져도 파일 구조가 깨지지 않게 관리하고 싶다.
- 개발자로서 추후 GitHub Issues/Projects와 연동할 수 있는 구조를 미리 갖추고 싶다.

Tasks:

- `src/data.js`를 도메인별 파일로 분리한다: `projects.js`, `members.js`, `sessions.js`, `tasks.js`, `logs.js`.
- JSON schema 또는 lightweight validator를 추가한다.
- GitHub Actions로 데이터 검증, secret pattern scan, link check를 수행한다.
- Vercel Git integration 또는 GitHub Actions controlled deploy로 Preview/Production Deployment를 구성한다.
- 장기적으로 GitHub Issues label과 project task 상태를 JSON으로 export하는 sync workflow를 검토한다.

Acceptance Criteria:

- 잘못된 status, 깨진 URL, 없는 member id를 배포 전에 검출한다.
- PR마다 Preview Deployment에서 UI와 데이터 변경을 확인할 수 있다.
- GitHub token이 클라이언트 코드에 노출되지 않는다.

### Epic 7. Authenticated Editing and Governance

GitHub 로그인을 통해 팀원이 사이트에서 직접 작성하고, 중요한 변경은 검수 후 공개할 수 있어야 한다.

User Stories:

- 팀원으로서 GitHub 로그인만 하면 내가 속한 프로젝트의 세션 노트, 태스크, 실험 로그를 웹에서 바로 작성하고 싶다.
- 프로젝트 maintainer로서 변경 요청을 review queue에서 확인하고 approve 또는 changes-requested를 남기고 싶다.
- 운영자로서 누가 언제 어떤 데이터를 바꿨는지 audit log로 확인하고 싶다.
- 방문자로서 로그인하지 않아도 공개 프로젝트와 아카이브를 읽고 싶다.

Tasks:

- GitHub App 또는 OAuth App 기반 login flow를 설계한다.
- auth backend를 추가해 authorization code 교환, session 발급, organization membership 확인을 처리한다.
- role model을 구현한다: Viewer, Authenticated Non-member, Editor, Project Maintainer, Admin.
- write API에서 role과 membership을 서버 측으로 검증한다.
- draft, review, published, changes-requested, hidden, archived 상태를 content model에 추가한다.
- Review Queue 페이지를 추가한다.
- comment, lightweight progress update, official publish 대상의 review rule을 분리한다.
- audit log schema와 incident response checklist를 추가한다.

Acceptance Criteria:

- 로그인하지 않은 사용자는 Viewer로만 동작한다.
- 로그인했지만 `team-ASP` 멤버가 아닌 사용자는 편집 버튼을 사용할 수 없다.
- `team-ASP` 멤버는 Editor 권한으로 draft와 comment를 작성할 수 있다.
- 공식 프로젝트 계획, 세션 기록, 결과 아카이브는 maintainer/admin review 후 publish된다.
- secret이나 private token이 client-side bundle에 들어가지 않는다.
- 모든 write action은 audit log에 남는다.

## 5. MafiaSimulation 3-Month Example Plan

Project Profile:

- Title: Multi-Agent Mafia Simulation
- Repository: `https://github.com/team-ASP/MafiaSimulation`
- Type: research project
- Status: planning
- Duration: 12 weeks
- Product Goal: Unity 환경에서 LLM 기반 에이전트들이 마피아 게임을 수행하며, 기억, 대화, 투표, 거짓말, 사회적 추론 행동을 관찰할 수 있는 시뮬레이션을 만든다.
- Success Criteria:
  - 6명 이상 에이전트가 day/meeting/voting/night cycle을 완주한다.
  - OpenAI/Ollama/Claude 등 provider별 실행을 비교할 수 있다.
  - 주요 게임 로그가 관찰자 UI와 아카이브 문서로 남는다.
  - 최종 발표에서 demo 영상, architecture diagram, 실험 결과, 한계와 후속 과제를 제시한다.

### Month 1. Planning and Baseline Simulation

Weeks 1-2:

- 프로젝트 charter 작성: 연구 질문, scope, 금지 범위, 산출물 정의.
- 현재 Unity 구조 조사: `GameManager`, `AgentController`, `TurnScheduler`, `UnifiedCloudConnector`, `ObserverUIController`.
- MVP 시나리오 정의: 4-6 agents, 1 mafia, fixed phase duration, text log 중심 관찰.
- 사이트에 planning page, milestone, task backlog 등록.

Weeks 3-4:

- LLM provider config와 prompt template 정리.
- agent memory model과 log visibility 기준 문서화.
- 첫 내부 demo: day/meeting/voting/night cycle이 끊기지 않는지 확인.
- 실험 로그 1: provider별 응답 안정성, JSON parse 실패율, latency 기록.

Expected Site Artifacts:

- Project planning page
- Week 1-4 sessions
- Baseline architecture note
- Provider comparison experiment log
- MVP demo checklist

### Month 2. Multi-Agent Behavior and Observability

Weeks 5-6:

- persona별 행동 차이가 실제 토론/투표에 반영되는지 실험한다.
- 마피아 agent의 deception prompt, 시민 agent의 suspicion prompt를 비교한다.
- observer UI에서 phase, alive agents, public/discussion/private log를 구분해 볼 수 있게 개선한다.
- 사이트에 prompt experiment log와 issue log를 누적한다.

Weeks 7-8:

- voting tie, invalid target, dead agent handling 등 edge case를 테스트한다.
- 실험 반복성을 위해 seed/config preset을 설계한다.
- 중간 발표 deck 작성: 목표, 현재 구조, 관찰된 문제, 다음 단계.
- 중간 데모 영상 또는 GIF를 아카이브 draft에 연결한다.

Expected Site Artifacts:

- Prompt experiment timeline
- Behavior observation notes
- Edge case task board
- Midterm presentation page
- Demo media link

### Month 3. Result Quality, Presentation, and Archive

Weeks 9-10:

- 실험 run을 여러 번 수행하고 결과 비교표를 만든다.
- provider/model별 비용, 지연, JSON 안정성, 행동 품질을 정리한다.
- 코드 정리 task: config 관리, log export, prompt template 정리, UI polish.
- 최종 발표 narrative를 확정한다.

Weeks 11-12:

- 최종 demo scenario를 고정한다.
- 최종 발표 자료와 demo script를 완성한다.
- retrospective 작성: 잘 된 점, 실패한 가설, 후속 연구 주제.
- 사이트에서 프로젝트 상태를 completed로 바꾸고 Archive checklist를 통과시킨다.

Expected Site Artifacts:

- Final result summary
- Final deck
- Demo video or executable build link
- Experiment result table
- Retrospective
- Follow-up project ideas

## 6. Product Code Update Plan

### Phase 0. Cleanup and Baseline

- Replace all `*_mock*` labels with ASP domain copy.
- Reduce nav to MVP IA: Dashboard, Projects, Sessions, Tasks, Logs, Archive, Members, Admin Guide.
- Keep current React UMD setup to avoid build migration risk during first content pass.
- Add one real project: MafiaSimulation.

Deliverable:

- A usable static MVP with real copy and real data.

### Phase 1. Domain Data Refactor

- Split `src/data.js` into smaller domain data modules or a structured single object with clear sections.
- Add stable ids for members, projects, milestones, tasks, sessions, and logs.
- Add helper selectors in `src/app.js`: current projects, next sessions, blocked tasks, archive items.
- Add data validation script if Node tooling is introduced.

Deliverable:

- Data can grow without turning `src/data.js` into an unmaintainable blob.

### Phase 2. Page and Component Upgrade

- Replace generic `CollectionPage` with domain-specific pages where needed.
- Build `ProjectDetailPage` or richer drawer with tabs: Overview, Plan, Sessions, Tasks, Logs, Results.
- Add `SessionsPage`, `TasksPage`, `LogsPage`, `ArchivePage`.
- Improve search/filter behavior across project/status/member/tag.

Deliverable:

- Team members can answer "what are we doing now, what happened last week, what is next?" from the site.

### Phase 3. Publishing Workflow

- Add GitHub Actions for validation, content policy checks, and secret pattern scanning.
- Configure Vercel Git integration for automatic Preview Deployments and Production Deployment from `main`.
- Add contributor guide for updating project/session/task/log data.
- Optionally generate data from markdown files or GitHub Issues.

Deliverable:

- Updates become repeatable and reviewable through PRs and Vercel previews.

### Phase 4. Vercel Dynamic Architecture

- Migrate from the current static React UMD prototype to Next.js on Vercel.
- Add Vercel environment variables for GitHub auth, session, and storage secrets.
- Add server-side API routes for auth callback, membership verification, and write operations.
- Add Preview/Production environment separation.
- Decide whether to keep Vercel Git integration or move to GitHub Actions controlled `vercel deploy --prebuilt`.

Deliverable:

- The site has a secure server-side boundary for login and editing.

### Phase 5. Authenticated Editing

- Register a GitHub App or OAuth App for ASP Study Hub.
- Add backend API routes for auth start, callback, session, logout, and `/me`.
- Verify `team-ASP` organization membership server-side.
- Add editor-only UI states and Review Queue.
- Add draft/review/publish workflow for projects, sessions, tasks, logs, and archive entries.
- Add audit logging and role mapping.

Deliverable:

- Organization members can edit from the website, while visitors remain read-only.

### Phase 6. Integration and Automation

- Sync public repository metadata: stars, latest commit, release links, open issues count.
- Optionally sync GitHub Projects/Issues into tasks.
- Generate archive pages from project completion checklist.
- Add presentation asset registry for slides, demo videos, screenshots, and paper notes.

Deliverable:

- The site becomes the public-facing archive and the internal operating dashboard.

## 7. MVP Backlog Order

1. Replace mock content and nav with real ASP study hub language.
2. Add MafiaSimulation project data with 12-week milestones.
3. Implement project detail view with planning/results sections.
4. Add Sessions and Tasks pages.
5. Add Logs page and connect logs to projects.
6. Add Archive page and archive checklist.
7. Add role/editing policy documentation and PR-based contribution workflow.
8. Add data validation and deployment workflow.
9. Configure Vercel project and Preview Deployments.
10. Migrate to Next.js if authenticated editing is accepted as core scope.
11. Design GitHub login and organization membership verification backend.
12. Add in-site editor UI, Review Queue, and audit log.
13. Evaluate GitHub Actions controlled Vercel deploy only after the simple Vercel Git integration path is proven insufficient.

## 8. Definition of Done

- A visitor can understand ASP, active projects, current progress, and archived outcomes without asking a member.
- A participant can identify this week's session, assigned tasks, and project blockers.
- A project owner can update plan/progress/results through a documented data workflow.
- A `team-ASP` member can authenticate with GitHub and receive Editor permissions.
- A non-member cannot edit even after GitHub login.
- Important public changes pass review before publish.
- Write actions leave an audit trail.
- MafiaSimulation has enough structured entries to run a real 3-month study from the site.
- No mock placeholders remain in user-facing UI.
