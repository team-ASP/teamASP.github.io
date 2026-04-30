# title_mockA

React 기반으로 작성한 다중 페이지 정보 교류 허브 템플릿입니다. 실제 콘텐츠 값은 `title_mockA`, `description_mockA`, `category_mockA` 같은 교체용 mock 값으로 구성했습니다.

## 로컬 확인

`index.html`을 브라우저에서 바로 열 수 있습니다.

또는 간단한 정적 서버로 확인할 수 있습니다.

```bash
python3 -m http.server 5173
```

브라우저에서 `http://127.0.0.1:5173/`을 열면 됩니다.

## 구조

- `index.html`: React UMD CDN과 앱 진입점
- `src/data.js`: 페이지, 카드, 일정, 자료, 멤버, 뱃지 mock 데이터
- `src/app.js`: React 컴포넌트와 페이지 전환, 검색, 모달, 상세 패널 동작
- `src/styles.css`: 레이아웃과 반응형 스타일
- `docs/deployment-plan.md`: GitHub 업로드 및 GitHub Pages 배포 계획
- `docs/github-member-sync.md`: GitHub organization 멤버 동기화 방식

## 다음 단계

최종 컨펌 이후:

1. `team-ASP` 조직에 새 repository 생성
2. 현재 폴더를 repository root로 정리
3. `main` 브랜치 push
4. GitHub Pages를 `main` branch 또는 GitHub Actions로 활성화
5. 필요 시 커스텀 도메인 연결
