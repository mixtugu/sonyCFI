# Independent role previews

| Route | Starting role | Opponent |
| --- | --- | --- |
| `/test/1` | Parent | CPU child |
| `/test/2` | Child | CPU parent |
| `/test` | Existing free-play sandbox | CPU / role selector |
| `/` | Existing online lobby | Another player |

Open either role URL directly. No room creation, invitation code, second browser or connected player is required. Trailing slashes work too. The initial screen is the same role tutorial used in an online room, followed by confirmation, ready, a three-second countdown and play.

The match keeps the online two-round flow: roles swap after round one, the new role has its own tutorial, and the final report totals both rounds. Replay returns to the route's original starting role. Ending or leaving opens a local test landing screen with restart and links to the other role, sandbox and multiplayer lobby. Reloading starts a fresh test.

The CPU automatically confirms, readies and accepts a requested replay. During play, it controls only the opposite role. Parent testing therefore has a moving CPU child; child testing has a CPU placing walls. Both keyboard/pointer and PlayStation controller guidance and controls use the shared UI.

The test preserves role-specific information and permissions. In particular, `/test/2` starts in the guest seat, so match settings are read-only, just as in an online room. `/test/1` can change match settings before the first round; doing so restarts its tutorial confirmation. Wall appearance remains a personal preference for either role.

## Architecture

- `src/maze-room.js` contains the shared room lifecycle, actions and private view projection. Random codes, tokens and seeds use Web Crypto, supported by the browser, Node and Workers.
- `server/maze-rooms.js` re-exports that engine, preserving the existing Node server and Worker import contract.
- `src/maze-solo.js` provides an in-memory transport with a human seat and an automated partner. It uses the shared room protocol and the existing CPU simulation in `src/maze.js`.
- `src/maze-main.js` selects the transport by route and renders the same ready, tutorial, countdown, playing, result and ending components.

The role previews do not make room API or WebSocket requests, allocate server rooms, or read/overwrite `maze-session` in session storage. They remain independent of online matches and of each other. These routes reproduce gameplay and UI; network latency and reconnection still require the online two-browser tests.

## Validation

```sh
npm test
npm run build
node scripts/check-role-previews.mjs
node scripts/check-tutorial-passages.mjs
node scripts/check-ready-screen.mjs
node scripts/check-maze-network.mjs
node scripts/check-gamepad.mjs
npm run worker:check
```

Run browser scripts sequentially. Unit coverage checks both starting seats, private information, role permissions, CPU actions, pause/countdown, role swapping, totals, replay and exit. The browser script verifies both direct routes, preserved online session storage, zero room requests, controller use and the complete parent-starting match flow. It writes `artifacts/test-1-parent.png` and `artifacts/test-2-child.png`.

The explorer's second tutorial step marks the newly opened path with the same glowing, animated dotted line as secret passages in the game. The passage appears only after the wall appears and disappears when the exercise resets. The focused passage check verifies the rendering, traversal and reset, and writes `artifacts/tutorial-explorer-passage.png`.

The explorer's third tutorial step adds a speech bubble below the encyclopedia's stars explaining rarity: more stars mean rarer creatures. The same focused check verifies its visibility and placement on desktop and mobile, and that it is hidden on earlier steps.

The third step also counts down the oxygen timer from 30 seconds and shrinks its gauge, using the same countdown rendering for both roles. In the explorer's collection demo, the timer and gauge reset together with the repeating demo. The focused check verifies both the countdown and refill.

After the tutorial, the role confirmation screen has no explanatory comment. Its buttons are `もう一度チュートリアルを見る` and `ゲームスタート！`. Once ready, the disabled start button reads `ゲームがもう少しで始まります…` while waiting for the other player; both players must still be ready before the existing three-second countdown. The ready-screen check covers both solo roles, reviewing the tutorial, countdown and online waiting. Pause/resume labels are unchanged.

Both roles have a `戻る` button while waiting after pressing start. It cancels only that player's readiness and returns to the role confirmation without leaving the room or clearing tutorial completion. Controller/keyboard focus moves to `戻る` while waiting and back to `ゲームスタート！` after cancellation. A cancellation arriving during the countdown stops it; a fresh full countdown begins once both players are ready again. The ready-screen check verifies cancellation for both online roles.
