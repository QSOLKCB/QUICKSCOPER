# QUICKSCOPER

**Snap in. Take the shot.** An original single-player quickscoping game, built directly on the web platform. No game engine. No frameworks. No runtime dependencies.

[Play QUICKSCOPER](https://qsolkcb.github.io/QUICKSCOPER/)

The game turns the design brief in [IMPLEMENTATION.md](IMPLEMENTATION.md) into a complete game. That document is preserved as the original concept and unfinished sketch; the playable implementation lives in `index.html`, `style.css`, and `src/`.

## The game

- **The Circuit:** a 90-second score attack against six moving voxel training bots. Watch their orange charge bars, dodge shots, use cover, and chain eliminations.
- **Free Range:** unlimited practice with incoming fire disabled.
- **The Switchyard:** an original industrial arena with three connected lanes, containers, crates, low cover, gantries, and distant skyline geometry.
- **QS–01:** a five-round bolt-action rifle with a 150 ms scope-in, 820 ms bolt cycle, 1.85-second reload, and unlimited reserve magazines.
- Precise head, torso, and limb hits; solid cover; normalized movement, sprinting, jumping, and crouching.
- Collateral hits through aligned bots, multi-kill bonuses, digital dust explosions, tracers, hitmarkers and local records.
- Original procedural music at 108 BPM: Euclidean rhythms and modular minor-pentatonic melodies. Streaks add layers; music has its own volume control.
- Xbox controller profile with analog movement, adjustable look speed/deadzone, slower scoped aim and controller-operated menus.
- Bots close distance, strafe, find routes around cover and dodge after surviving a hit. Flankers move faster, with distinct blue armor.

### Find the rhythm

Hold right mouse to raise the scope, line up, and click left. The visual scope and shot accuracy settle together after **150 ms** of uninterrupted scope time. A kill between **150–550 ms** earns a quickscope bonus. Holding the scope longer stays accurate; hip-fire has spread. The rifle lowers during cycling and reloads, then starts raising during the final 150 ms of the bolt cycle if scope is held. A trigger press up to **180 ms** early can wait for readiness. Releasing scope, pausing, reloading or respawning cancels a pending shot. Holding fire never repeats shots automatically.

A torso or head hit eliminates a bot; limbs take two hits. Bullets pass through every intersected bot, hitting each once, and stop at the first solid surface. Two or more kills with one round earn a **collateral bonus of 150 points per extra kill**. Accuracy counts successful shots, so a collateral cannot inflate it above 100%. Base elimination: **100 points**, headshot: **+50**, quickscope: **+100**. Eliminations within **3.1 seconds** extend a chain, multiplying points up to **5×**. In the Circuit, being downed costs **200 points** and respawns you with a loaded rifle and brief protection. Health regenerates after **3.5 seconds** without damage.

## Controls

Choose **Keyboard + mouse** or **Xbox controller** above the start button or in Settings. Xbox uses the browser's standard Gamepad mapping over USB or Bluetooth. Connect it, press a button to expose it to the browser, then release the controls. Unmapped devices are not guessed. Touch controls are not included.

| Action | Keyboard + mouse | Xbox profile |
| --- | --- | --- |
| Move | WASD / arrows | Left stick, analog |
| Look | Mouse | Right stick |
| Fire | Left click | RT, one shot per pull |
| Hold scope | Right mouse | LT |
| Hold sprint | Shift | Left stick click |
| Jump | Space | A |
| Hold crouch | C / Ctrl | B / right stick click |
| Reload | R | X |
| Pause / resume | Esc or P / click Resume | Menu / A on Resume |
| Navigate menus | Mouse / Tab | D-pad up/down; A selects; B closes dialogs |
| Change sliders / profile | Mouse / arrows | D-pad left/right |
| Mute | M | Master volume in Settings |

Losing focus or changing tabs pauses the simulation. Mouse mode also pauses on pointer unlock; Xbox mode does not require mouse capture and pauses on controller disconnect. Resume is deliberate, and controller inputs must return to neutral to prevent held triggers carrying into the next screen. Click the page once to enable audio if the browser blocks controller-only activation.

Settings include separate mouse/controller sensitivities, stick deadzone, inverted look, master volume, music volume, reduced motion/flashes and lower render resolution/particle count. Settings and the Circuit best score stay on your device.

## Offline play

Visit the HTTPS Pages site once and wait for **OFFLINE READY** in the menu. The service worker caches every runtime file, so the same address can reopen without a network connection. Browser storage can be cleared or evicted; the status is confirmation of a completed cache, not a guarantee of permanent storage. Updates activate after all old game tabs close.

There are no accounts, analytics, multiplayer services, remote assets, or external runtime requests. WebGL is required. Unsupported graphics show an explanation; audio, local storage, and offline caching are optional and fail gracefully.

## Run and check locally

Any static HTTP server works; opening `file://` is not supported because the game uses ES modules. For example:

```sh
python3 -m http.server 8000
# Open http://localhost:8000
```

Node 22 or newer is needed only for development checks and packaging. No `npm install` is necessary:

```sh
npm test
npm run check
npm run build
```

`dist/` contains only the distributable game and license. `npm run benchmark` measures CPU mesh construction (not GPU FPS). `scripts/browser-check.cjs` uses Playwright as isolated CI tooling, not a game dependency. The workflow runs Chromium rendering/input tests, captures screenshots, and checks offline reload at `/QUICKSCOPER/` before deploying. It also emulates Xbox inputs through the real app, verifies collateral scoring/data-dust rendering and music lifecycle, and checks WebGL 1 fallback. Physical controller hardware and real GPU performance still need human playtesting.

## GitHub Pages

Set **Settings → Pages → Build and deployment → Source → GitHub Actions** once. The included workflow tests pull requests and deploys a tested artifact on pushes to `main`. It pins Ubuntu 24.04, keeps deployment permissions separate, and has no scheduled jobs. Workflow-level concurrency is acquired before tests so delayed old check jobs do not replace newer queued deployment jobs.

## Source layout

| File | Responsibility |
| --- | --- |
| `src/math.js` | Column-major matrices, vectors, seeded RNG, ray/box intersection |
| `src/world.js` | Original arena geometry and collision boxes |
| `src/game.js` | Pure fixed-step simulation, movement, weapon, scoring, bots |
| `src/renderer.js` | Raw WebGL shaders, batched geometry, voxel models and rifle |
| `src/controller.js` | Standard Xbox mapping, radial deadzones and edge detection |
| `src/navigation.js` | Shared cached flow field for cover navigation |
| `src/audio.js`, `src/music.js` | Local sound synthesis and mathematical music sequencing |
| `src/app.js` | Input, lifecycle, Canvas overlay, HUD, settings and effects |
| `sw.js` | Scope-isolated offline cache |

See [engineering rules](AGENTS.md) and [design notes](docs/DESIGN.md).

## Original work and license

QUICKSCOPER is an independent QSOL–IMC project. The arena, voxel geometry, rifle design, graphics, UI, and synthesized audio are original to this implementation. It is not affiliated with Activision or Call of Duty, and includes none of their assets or maps. The supplied [Apache-2.0 license](LICENSE) is retained.
