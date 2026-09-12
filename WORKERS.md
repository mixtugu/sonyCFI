# Cloudflare Workers 배포

공개 게임: https://sony-cfi-between-paths.timmy0079.workers.dev

일본어 미로 게임과 2인 방을 하나의 Workers 주소에서 제공합니다. 상대에게 초대 링크를 보내고 두 사람 모두 준비 완료를 누르면 됩니다. 같은 Wi-Fi에 있을 필요가 없습니다.

## 실행 및 재배포

```sh
npm install
npm run worker:dev
```

로컬 Workers 주소는 `http://localhost:8787`입니다. 기존 Node 개발 서버는 `npm run dev`로 실행할 수 있습니다.

```sh
npx wrangler login
npm run worker:check
npm run deploy
```

최초 로그인 이후에는 `npm run deploy`로 화면 빌드와 서버 배포를 함께 수행합니다. `wrangler.jsonc`의 Worker 이름과 Durable Objects 마이그레이션을 유지하세요. SQLite 기반 `MazeRoom`이 방마다 생성되며 별도 Redis·DB 서비스는 필요하지 않습니다.

## 상태와 비용

- 방 상태, 난수 상태, 점수, 참가 토큰을 Durable Objects의 SQLite에 저장합니다. 연결이 끊기면 일시정지하고 같은 브라우저의 참여 정보를 이용해 복귀합니다.
- WebSocket Hibernation API를 사용합니다. CPU 없는 2인 게임은 입력 시 상태를 갱신하고, 진행 중에는 약 1초 간격의 alarm으로 시간을 동기화합니다. 대기 중 상시 타이머는 없습니다.
- 마지막 활동 이후 24시간이 지나면 방 데이터와 연결을 정리합니다. 만료된 방은 새로 만들어 주세요.
- SQLite 기반 Durable Objects는 Workers Free에서도 지원됩니다. 무료 사용량 한도를 넘으면 해당 작업이 실패하며, 유료 플랜 계정은 해당 플랜의 과금 규칙을 따릅니다. 이 배포 과정에서 플랜 변경은 하지 않습니다.
- 공개 Workers 배포는 새 미로 게임을 제공합니다. 이전 바다 프로토타입은 Node 로컬 서버의 `/?online=1`에 남아 있습니다.

공식 안내: https://developers.cloudflare.com/durable-objects/platform/pricing/

## 검증

```sh
npm test
npm run worker:types
npm run worker:check
```

`npm run worker:dev`를 실행한 상태에서:

```sh
node scripts/check-worker.mjs
```

공개 주소를 대상으로 검증하려면 PowerShell에서:

```powershell
$env:WORKER_URL = 'https://sony-cfi-between-paths.timmy0079.workers.dev'
node scripts/check-worker.mjs
```

테스트는 두 브라우저로 임시 방을 만들어 이동·벽·시점 분리·재접속·시간 종료·재시작·모바일 화면을 확인한 뒤 퇴장합니다.
