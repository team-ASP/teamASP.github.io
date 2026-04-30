# GitHub Organization Member Sync

ASP Study Hub의 멤버 정보를 GitHub organization과 동기화하는 방법입니다.

## Current Check

- Organization: `team-ASP`
- Public members endpoint: `https://api.github.com/orgs/team-ASP/public_members`
- Current result: `[]`

현재 공개 멤버로 노출된 계정은 없습니다. GitHub 조직 멤버가 실제로 3명이어도 각 멤버가 membership visibility를 public으로 설정하지 않았다면 이 public endpoint에는 나타나지 않습니다.

## Sync Options

### Option A. Public Members Only

인증 없이 사용할 수 있습니다.

```js
const response = await fetch("https://api.github.com/orgs/team-ASP/public_members");
const members = await response.json();
```

장점:
- 토큰이 필요 없습니다.
- GitHub Pages 정적 사이트에서도 바로 호출할 수 있습니다.

한계:
- 공개 멤버만 보입니다.
- 현재 `team-ASP`는 공개 멤버 목록이 비어 있습니다.

### Option B. Full Organization Members

조직 멤버 전체를 가져오려면 GitHub 토큰이 필요합니다.

```bash
curl \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/orgs/team-ASP/members
```

필요 권한:
- Fine-grained token: organization members read 권한
- Classic token: `read:org`

주의:
- GitHub Pages 클라이언트 코드에 토큰을 넣으면 안 됩니다.
- 전체 멤버 동기화는 GitHub Actions, 서버리스 함수, 또는 별도 백엔드에서 수행하고, 결과 JSON만 공개 사이트가 읽도록 구성하는 방식이 안전합니다.

## Recommended Flow

1. GitHub Actions가 일정 주기 또는 수동 실행으로 organization members API를 호출합니다.
2. 결과를 `public/members.json` 또는 별도 데이터 파일로 저장합니다.
3. 사이트는 토큰 없이 해당 JSON만 읽어 멤버 목록을 렌더링합니다.
4. 멤버의 이름, 역할, 소개 등 팀 고유 정보는 `src/data.js`에서 병합하거나 별도 CMS에서 관리합니다.

## MVP Decision

현재 로컬 템플릿은 멤버 3명을 mock 데이터로 유지합니다.

```js
members: [
  { id: "member_mockA", name: "member_mockA", role: "role_mockA", focus: "focus_mockA", points: 0 },
  { id: "member_mockB", name: "member_mockB", role: "role_mockB", focus: "focus_mockB", points: 0 },
  { id: "member_mockC", name: "member_mockC", role: "role_mockC", focus: "focus_mockC", points: 0 },
]
```
