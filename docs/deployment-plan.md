# Deployment Plan

최종 확인 후 진행할 GitHub 업로드와 GitHub Pages 호스팅 계획입니다.

## Repository

- Organization: `team-ASP`
- Suggested repository name: `asp-study-hub`
- Expected Pages URL: `https://team-asp.github.io/asp-study-hub/`

## Steps

1. GitHub organization에 새 repository 생성
2. 로컬 프로젝트를 해당 repository로 연결
3. `main` 브랜치에 push
4. Repository Settings > Pages에서 배포 소스 설정
5. Pages URL에서 렌더링 확인

## Current Hosting Mode

현재 앱은 빌드 과정 없이 정적 파일로 실행됩니다. 따라서 GitHub Pages의 branch deploy와 잘 맞습니다.

## Future Production Mode

추후 패키지 매니저 환경이 준비되면 Vite 기반으로 전환할 수 있습니다.

```bash
npm create vite@latest asp-study-hub -- --template react
npm install
npm run build
```

그 경우 Pages 배포는 GitHub Actions로 `dist/`를 배포하는 방식이 적합합니다.
