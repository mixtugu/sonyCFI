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
node scripts/check-maze-network.mjs
node scripts/check-gamepad.mjs
npm run worker:check
```

Run browser scripts sequentially. Unit coverage checks both starting seats, private information, role permissions, CPU actions, pause/countdown, role swapping, totals, replay and exit. The browser script verifies both direct routes, preserved online session storage, zero room requests, controller use and the complete parent-starting match flow. It writes `artifacts/test-1-parent.png` and `artifacts/test-2-child.png`.
