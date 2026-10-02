# 사이의 길 · Between Paths

**Cloudflare Workers 배포:** https://sony-cfi-between-paths.timmy0079.workers.dev

공개 주소에서 일본어 미로 게임을 2명이 동시에 플레이할 수 있습니다. 재배포는 `npm run deploy`, Workers 로컬 실행은 `npm run worker:dev`입니다. 자세한 내용은 [WORKERS.md](WORKERS.md)를 참고하세요.

기본 게임을 `test_coding`의 파이썬 게임을 참고한 **부모·아이 두 시점의 미로 게임**으로 개편했습니다. `npm run dev` 실행 후 `http://localhost:5173`에서 바로 플레이할 수 있습니다. 부모/아이/CPU 모드, 벽과 비밀 통로, 점수, 미로·시간·아이템 설정을 지원합니다.

새 미로도 **두 사람이 각자 브라우저에서 동시에 플레이**할 수 있습니다. 화면 위에서 방을 만들고 초대 링크 또는 코드를 공유한 뒤, 두 사람 모두 준비 완료를 누르세요. 부모는 벽을 설치하고 아이는 이동하며, 역할별 화면과 비밀 통로가 분리됩니다. 방에 들어가지 않으면 CPU와 혼자 연습할 수 있습니다.

새 게임의 조작법과 검증 방법은 [MAZE.md](MAZE.md)를 참고하세요. 바다 도입부, 다이버와 수중 효과의 구현 및 검증 안내는 [OCEAN.md](OCEAN.md)에 있습니다.
