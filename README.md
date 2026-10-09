# YOU SEE / I SEE · Between Tides

**Cloudflare Workers 배포:** https://sony-cfi-between-paths.timmy0079.workers.dev

공개 주소에서 일본어 미로 게임을 2명이 동시에 플레이할 수 있습니다. 재배포는 `npm run deploy`, Workers 로컬 실행은 `npm run worker:dev`입니다. 자세한 내용은 [WORKERS.md](WORKERS.md)를 참고하세요.

기본 게임을 `test_coding`의 파이썬 게임을 참고한 **내비게이터·탐험가 두 시점의 미로 게임**으로 개편했습니다. `npm run dev` 실행 후 `http://localhost:5173`에서 바로 플레이할 수 있습니다. 내비게이터/탐험가/CPU 모드, 벽과 비밀 통로, 점수, 미로·시간·아이템 설정을 지원합니다.

새 미로도 **두 사람이 각자 브라우저에서 동시에 플레이**할 수 있습니다. 화면 위에서 방을 만들고 초대 링크 또는 코드를 공유한 뒤, 두 사람 모두 준비 완료를 누르세요. 내비게이터는 벽을 설치하고 탐험가는 이동하며, 역할별 화면과 비밀 통로가 분리됩니다. 방에 들어가지 않으면 CPU와 혼자 연습할 수 있습니다.

새 게임의 조작법과 검증 방법은 [MAZE.md](MAZE.md)를 참고하세요. 바다 도입부, 다이버와 수중 효과의 구현 및 검증 안내는 [OCEAN.md](OCEAN.md)에 있습니다.

컨트롤러 연결 시 PlayStation 그림·버튼 안내로 전환되며, 방 코드 입력부터 설정·튜토리얼·종료까지 컨트롤러로 조작할 수 있습니다. 구현과 검증 안내는 [CONTROLLER.md](CONTROLLER.md)에 있습니다.

방이나 상대 없이 실제 진행을 테스트하려면 **`/test/1`(내비게이터로 시작)** 또는 **`/test/2`(탐험가로 시작)**에 접속하세요. 상대는 CPU이며, 튜토리얼부터 카운트다운·2라운드 역할 교대·최종 결과까지 진행됩니다. 기존 `/test` 자유 테스트도 유지됩니다. 자세한 내용은 [ROLE-TESTS.md](ROLE-TESTS.md)를 참고하세요.
