# Ocean presentation

The lobby, preparation, exploration, pause, and return screens share a procedural Canvas ocean. The game uses no new image assets or runtime dependencies. Japanese player-facing copy is retained.

## Modules

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

Initial rules are fixed at 30 HP, 10 default walls, creature damage caps 2/3/4, and wall damage 2 (`WALL_DAMAGE`). Actual fish damage is a uniformly sampled integer from zero through the revealed creature's risk cap, not the silhouette's cap. It is seeded at maze creation and persisted, so reconnect cannot reroll it; hidden damage stays private until contact. The room-creation ocean reuses the current top-down explorer's shared artwork, with active alternating kicks and wake effects while swimming.

Explorer size headings include the maze's shared glowing fish icon at the matching large/medium/small scale, without risk marks. Per-size discovered counters use a 16px scaled font.

The safety heading auto-fits its available width on one line, including after font loading or sidebar resizing. Its subtitle is `魚に会う、壁を立てることでHPが減ります`. Damage rows reuse the maze's glowing fish renderer with 1/2/3 risk marks and the sidebar's wall SVG instead of text-only labels.

Default wall stock is 10. The navigator shows a single dynamic heading `壁 remaining / limit 枚` and one row of wall icons, without a duplicate count. Wall and safety headings share the HP heading's font family, 30px scaled size, weight and color. The bottom section `安全にGOALまで進めよう` has a top divider, the subtitle `HP減少量`, and values 0–2 / 0–3 / 0–4 HP loss for silhouette tiers, and 2 HP for walls. No explanatory footer is shown. HP starts at 30, shown as two rows of fifteen hearts. Sidebar hearts and walls use shaded SVG artwork (glossy gold hearts and beveled blue-gray masonry) rather than platform emoji; depleted hearts/walls remain dimmed, with partial HP clipping preserved.

Navigator sidebar order is HP text, heart meter, remaining wall stock/icons, then the risk explanation. The redundant placed-wall count beneath HP is omitted.

Catalog names have a second line of rarity stars, including undiscovered entries. Reference values: shark 4, mermaid 5, squid 4; all medium species 3; clownfish/shrimp 1, jellyfish 2, seahorse/stonefish 3. Rarity is display metadata independent of risk and does not change encounter probabilities or damage.

Maze fin tempo eases between 7 and 3.5 radians/second with a 0.3-second exponential time constant (about 0.9 seconds to settle 95%). Each canvas integrates a continuous kick phase, preventing leg-position jumps when movement starts or stops. Both phase and tempo freeze on pause.

The explorer uses the latest straight top-down illustration supplied by the user (yellow helmet, silver tank, yellow/black fins), with its background removed into three transparent PNG layers under `src/assets/explorer`. Its approximately 51-pixel logical length (before caller scaling) preserves the enlarged display size. Body/helmet/tank pixels retain the original shading; separate fins pivot at their ankles using the existing swim/idle cadence. Heading interpolation, hover, torch and reduced-motion behavior remain unchanged. Shared lobby/result diver artwork uses the same character. `scripts/extract-explorer-alpha.ps1 -InputPath <reference.png>` reproduces the masks from the latest 214×395 reference without modifying the source image.

The explorer's straight source pose aligns to the travel heading without shear or off-axis body sway. Moving kicks alternate fin extension, fore/aft displacement and rotation at 7 radians/second (about 0.9 seconds per cycle). Each cell move keeps the moving cadence active for 0.95 seconds (rather than only the 0.2-second position interpolation), so a complete alternating stroke remains visible between steps. While stationary during play, fins keep the same stroke amplitude at exactly half speed (3.5 radians/second). The game clock alone drives kicks; pause freezes them and reduced motion disables them. Movement-only trailing bubbles and curved water streaks follow the heading, while idle and reduced-motion rendering omit them. The maze's existing forward torch cone supplies the reference's headlight effect.

Revealed creatures on both maze boards use their species size: small fits 23.2×20, medium 29×25, and large 40.6×35 logical pixels, preserving image aspect ratio. Large artwork is 40% larger than medium. Contact checkmarks/damage labels shift down when needed to clear taller artwork. Pre-contact silhouettes and gameplay hit detection are unchanged.

The explorer catalog is species-based: large (squid, shark, mermaid) in 3 columns, medium (turtle, octopus, lionfish, butterflyfish) in 4, small (clownfish, shrimp, jellyfish, seahorse, stonefish) in 5. The large row uses the user's revised order; encounter selection order is unchanged. Images scale with card width, so large-species artwork is larger. Undiscovered entries show a dark silhouette and `？？？`, never a visible name. Discovery reveals the original-color transparent image and name. Duplicate encounters unlock only one species slot; the header counts distinct species out of 12. The final report separately labels the existing contact count as encounters, not catalog species. All discoveries reset per round and restore from taken items on reconnect.

Maze coordinates remain 36 pixels per cell with 14 pixels of padding. Pointer hit testing, collision, movement intervals, networking, and server-side role filtering retain their existing behavior. Points are replaced by a 12-species explorer catalog and navigator HP (30 initially). Actual low/medium/high risk creatures consume 2/3/4 HP; four silhouettes per maximum-risk tier bound fish-only damage at 36, so collecting every fish can exhaust HP. Successful wall placements consume 2 HP each; failed placements consume none. Both damage sources floor HP at zero. Zero HP does not end the timed round or block movement, collection, or wall placement. Contact is processed once per location; HP and catalog reset on role exchange. Final reports keep each person's navigator HP and explorer encounter count separate rather than summing them. The drawn diver interpolates only between adjacent cell centers; interrupted turns finish the preceding cell rather than cutting a corner. Reconnect jumps and resets do not produce long wakes.

The navigator sees each uncollected fish's maximum risk as `!` / `!!` / `!!!` (low / medium / high). All fish use the same cyan glowing outline and pale yellow marks; neither outline color nor mark color encodes risk. Small/medium/large scales remain 1 / 1.4 / 1.8. The explorer sees only the outline and size, never risk marks. The server sends `riskLevel` (1–3) only to the navigator; it sends no uncollected creature identity, actual damage, or category. After contact, both roles see the creature illustration on the board, and the explorer's catalog records its picture and name. Secret passages remain dashed and explorer-only.

`src/creatures.js` defines twelve creatures from the supplied illustration sheet. `src/assets/creatures/transparent/` preserves the original detailed artwork with the blue rectangular background removed. `src/creature-art.js` loads these transparent PNGs for both the board and catalog; the simplified vector redraws are no longer used. To regenerate alpha masks from the cropped originals, run `scripts/extract-creature-alpha.ps1` from the project root on Windows. The extraction keeps the largest connected foreground, preserves enclosed dark markings, and softens boundary alpha. Desktop image checks verify transparent corners and substantial transparent areas for every creature.

Creature selection is uniform among candidates of the same size with risk no higher than the silhouette's maximum, and is seeded at maze creation so reconnect/reset cannot reroll outcomes. Large candidates are shark, mermaid, and giant squid, all high-risk, so large silhouettes only occur with `!!!`. Medium: turtle/butterflyfish (low), octopus (medium), lionfish (high). Small: clownfish/shrimp/seahorse (low), jellyfish (medium), stonefish (high). Damage uses the revealed creature's risk (2 / 3 / 4), not the silhouette's maximum. Four silhouettes per maximum-risk tier remain. Species can repeat at different encounter locations but share a single catalog slot. Existing persisted rooms with unsupported legacy creature IDs or old damage values restart at the briefing with an explicit update notice.

In the maze, gameplay effects (movement, wakes, pickups, wall rises) follow a clock that advances only while playing; ambient water, fish and kelp also move before the round and during the countdown. Pausing freezes the board and the WebGL ocean. Tutorial boards have no game clock: movement applies immediately and only their ambient water animates. The exploration light uses only the visited trail, and fish, kelp and seabed decorations are seeded from cell indices and the visible walls, so neither view reveals hidden item data.

Fish outlines are slightly elongated horizontally (1.15× horizontal / 1.1× vertical shape factors, retaining the three relative sizes). Navigator risk marks fade between 20% and 100% opacity over a 3.2-second cosine cycle, retaining a faint afterimage; outlines stay visible. The existing ambient clock freezes the fade when paused. Reduced-motion mode keeps marks fully visible.

The ambient canvases draw at most 30 times per second, cap their pixel ratio at 1.5, and stop painting in hidden tabs; the 2D sea stops once the WebGL ocean covers it. Particle arrays are bounded (40 maze bubbles, 24 maze ripples, 16 sand puffs, 8 pickup bursts, 8 ambient pointer ripples). `prefers-reduced-motion` disables the intro, parallax, swimming animation, water animation, CSS particles and ripples while keeping positions and state feedback immediate.

## Verification

```sh
npm test
npm run build
node scripts/check-ocean.mjs
node scripts/check-maze.mjs
node scripts/check-maze-network.mjs
node scripts/check-gamepad.mjs
node scripts/check-fish-icons.mjs
```

The ocean check starts its own development server and covers intro completion/skip, phone/tablet overflow, paused drawing, reduced motion, immediate tutorial movement, rendering purity, and hidden item data. The other checks use the production build and cover CPU rounds, wall placement, HP/catalog changes, role exchange, multiplayer reconnects, private views, and controller inputs.

For the free-swimming regression, start `npm run dev` and run `node scripts/check-browser.mjs`. Run browser suites individually on slower machines to avoid timing contention. Screenshots are written under `artifacts/`; the ocean-specific files include `ocean-intro.png`, `ocean-lobby.png`, `ocean-mobile.png`, `ocean-exploration.png`, and `ocean-result.png`.

## Two-player match sequence

`ready` (fullscreen tutorial + waiting) → both tutorial confirmations and ready votes → `countdown` (3, 2, 1) → `playing` → automatic role swap → a fresh `ready` briefing → `countdown` → `playing` → final `result` report → `ending` → lobby.

The first leg never triggers a results modal. The final report uses the `summary` presentation phase; its finish button starts `ending`, which returns to the lobby after 5 seconds or immediately via the return button. A partner's departure preserves the remaining player's report. `/test` retains its single-round CPU practice controls.

`MazeRooms` owns tutorial confirmation, readiness, countdown, automatic swapping and role-specific reports. The Worker persists the same state and uses the same elapsed-time advance function; countdown seconds do not consume game time. Previously persisted points-based rooms restart from the first briefing with an explicit rule-update notice. Disconnecting during countdown cancels it and clears both ready votes. Resuming starts a fresh countdown without repeating an already confirmed tutorial.
