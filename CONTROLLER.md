# PlayStation controller support

The Gamepad API is polled in `src/maze-main.js`. Connecting a controller changes the tutorial, help, board accessibility labels and live action bar to PlayStation terminology. Keyboard and pointer controls remain available. The live bar stays visible in immersive mode and is moved inside the active modal.

The layout targets a PlayStation Access controller profile: stick, centre ×, and the D-pad on the up/right/down/left petals (diagonal petals unused). A DualSense works the same way.

| Context | Controls |
| --- | --- |
| Menus, lobby, results | Stick selects, × activates the focused control; hold ← (or press ○) goes back / closes |
| Settings | Stick up/down selects fields, left/right adjusts numbers; × selects or applies; hold ← (or ○) closes |
| Room entry | The join key is fixed to `A`; select Join and press × |
| Navigator practice and play | Left stick selects a cell; tap ↑ → ↓ ← (or the right stick) to aim the wall; × places |
| Explorer practice and play | Left stick moves |
| Tutorial | Hold → to advance or confirm the final step; hold ← to go back (650 ms). Short ← / → taps aim walls on release; ↑ / ↓ aim immediately. Movement stays on the left stick. × and ○ holds do not change tutorial steps |
| Playing / ready | Hold ← (or ○) to pause / start |
| Countdown | Hold ← (or ○ / ×) to return to waiting |
| Ending | × / ○ returns to the lobby |
| Test mode only | OPTIONS start/pause, □ settings, △ immersive, L1 / R1 switch roles, CREATE resets |

Help is also reachable through Settings → 遊び方, including controllers that do not expose touchpad click. Actual browser fullscreen may require browser-granted user activation; the immersive layout still works when that request is denied.

An unplug during play or countdown pauses the round and restores keyboard guidance. Reconnecting restores PlayStation guidance without discarding tutorial progress. The round requires an explicit resume. Browsers may expose a newly connected controller only after its first button press. Standard Gamepad API button/axis mapping is assumed; generic controllers use the same positional mapping and PlayStation labels.

## Implementation

- `src/gamepad.js`: direction dead zone, repeat timing and button edges.
- `src/controller-guide.js`: reusable inline SVG controller drawing, button symbols and action labels.
- `src/controller-ui.js`: visible, enabled control selection, focus indication and room-code keypad. Input stays inside the active modal.
- `src/controller.css`: controller artwork, focus ring and responsive action bars.
- `src/tutorial.js`: input-dependent instructions and identical practice / game mappings.
- `src/maze-main.js`: context routing, hotplug transitions and modal ordering after asynchronous network pauses.

## Verification

```sh
npm test
npm run build
node scripts/check-gamepad.mjs
node scripts/check-controller-flow.mjs
node scripts/check-role-previews.mjs
node scripts/check-maze-network.mjs
```

The controller flow test injects DualSense-shaped Gamepad API snapshots and performs UI actions without mouse clicks or keyboard input. It covers lobby creation/joining, numeric/radio settings, code entry, both role tutorials, mobile layout, countdown cancellation, movement/walls, pause, hotplug, role swap, results, ending and room exit. Server clock advancement is used only to finish rounds. The existing network script retains keyboard/pointer and native fullscreen stacking coverage. Screenshots are written to `artifacts/controller-*.png`.

These are simulated browser checks. Physical DualSense USB/Bluetooth recognition, touchpad mapping and vibration require hardware validation.
