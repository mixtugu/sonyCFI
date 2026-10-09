# Ocean presentation

The lobby, preparation, exploration, pause, and return screens share a procedural Canvas ocean. The game uses no new image assets or runtime dependencies. Japanese player-facing copy is retained.

## Modules

- `src/ocean-title.svg`: YOU SEE / I SEE wordmark used by the lobby and dive introduction.

- `src/ocean-art.js`: reusable water, refraction, particles, plants, the lobby diver, the in-game diver (`drawDiverHD`), the shared tileable caustic texture, and ripple drawing. Rendering does not modify game state.
- `src/ocean-presentation.js`: the lobby's 2D viewport canvas, the automatic 3.2-second dive introduction, and pointer ripples. From the briefing on it cross-fades to the WebGL ocean and drives its camera per phase: shallow briefing, descent during the countdown, deep exploration (darker and red-tinged as oxygen runs out), ascent on the report, and breaking the surface on the ending. Without WebGL the 2D sea covers every phase as before.
- `src/ocean-depths.js`: the full-screen WebGL shader: god rays, caustics, a parallax reef floor with kelp, three-layer marine snow, bubble columns, the surface seen from below, the above-water ending shot, countdown shock rings, and tap ripples. It renders at about half resolution and at most 30 times per second.
- `src/ocean.css`: shared introduction and backdrop styling.
- `src/ocean-game.css`: in-game glass dialogs with moving water light and bubbles, tutorial step transitions, the countdown rings and descent gauge, the board dive-in, score bumps, the report reveal, and the ending splash.
- `src/maze-renderer.js`: the seabed (cached), drifting caustics, extruded rock and coral walls (parent walls rise out of the sand), clams and pearls, kelp, fish schools, a jellyfish, marine snow, the exploration light (unexplored water is murky; visited cells and the diver's torch light it), diver interpolation, and pickup/wall/wake particles. Each canvas has independent visual state in a `WeakMap`, including tutorial canvases.
- `src/result-scene.js`: the report header, where the diver rises toward a sunlit surface.
- `src/maze.css`: interface palettes and responsive layouts.
- `src/entry.js`: starts the shared presentation and observes `ocean-phase`, `ocean-pulse` (countdown ticks) and `ocean-oxygen` events.

## Rendering contracts

Maze coordinates remain 36 pixels per cell with 14 pixels of padding. Pointer hit testing, collision, movement intervals, scoring, networking, and server-side role filtering are unchanged. The drawn diver interpolates only between adjacent cell centers; interrupted turns finish the preceding cell rather than cutting a corner. Reconnect jumps and resets do not produce long wakes.

The navigator retains its destination, public fish size, high-risk warning colors and revealed item risks. Before collection, exact risk values, rewards and fish kinds stay hidden. Secret passages remain dashed and child-only. The presentation only reads the state already provided to each role.

In the maze, gameplay effects (movement, wakes, pickups, wall rises) follow a clock that advances only while playing; ambient water, fish and kelp also move before the round and during the countdown. Pausing freezes the board and the WebGL ocean. Tutorial boards have no game clock: movement applies immediately and only their ambient water animates. The exploration light uses only the visited trail, and fish, kelp and seabed decorations are seeded from cell indices and the visible walls, so neither view reveals hidden item data.

The ambient canvases draw at most 30 times per second, cap their pixel ratio at 1.5, and stop painting in hidden tabs; the 2D sea stops once the WebGL ocean covers it. Particle arrays are bounded (40 maze bubbles, 24 maze ripples, 16 sand puffs, 8 pickup bursts, 8 ambient pointer ripples). `prefers-reduced-motion` disables the intro, parallax, swimming animation, water animation, CSS particles and ripples while keeping positions and state feedback immediate.

## Verification

```sh
npm test
npm run build
node scripts/check-ocean.mjs
node scripts/check-maze.mjs
node scripts/check-maze-network.mjs
node scripts/check-gamepad.mjs
```

The ocean check starts its own development server and covers intro completion/skip, phone/tablet overflow, paused drawing, reduced motion, immediate tutorial movement, rendering purity, and hidden item data. The other checks use the production build and cover CPU rounds, wall placement, score changes, role exchange, multiplayer reconnects, private views, and controller inputs.

For the free-swimming regression, start `npm run dev` and run `node scripts/check-browser.mjs`. Run browser suites individually on slower machines to avoid timing contention. Screenshots are written under `artifacts/`; the ocean-specific files include `ocean-intro.png`, `ocean-lobby.png`, `ocean-mobile.png`, `ocean-exploration.png`, and `ocean-result.png`.

## Two-player match sequence

`ready` (fullscreen tutorial + waiting) → both tutorial confirmations and ready votes → `countdown` (3, 2, 1) → `playing` → automatic role swap → a fresh `ready` briefing → `countdown` → `playing` → final `result` report → `ending` → lobby.

The first leg never triggers a results modal. The final report uses the `summary` presentation phase; its finish button starts `ending`, which returns to the lobby after 5 seconds or immediately via the return button. A partner's departure preserves the remaining player's report. `/test` retains its single-round CPU practice controls.

`MazeRooms` owns tutorial confirmation, readiness, countdown, automatic swapping and totals. The Worker persists the same state and uses the same elapsed-time advance function; countdown seconds do not consume game time. Disconnecting during countdown cancels it and clears both ready votes. Resuming starts a fresh countdown without repeating an already confirmed tutorial.
