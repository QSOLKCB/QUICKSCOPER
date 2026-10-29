# QUICKSCOPER

**Snap in. Take the shot.** An original single-player quickscoping game, built directly on the web platform. No game engine. No frameworks. No runtime dependencies.

[Play QUICKSCOPER](https://qsolkcb.github.io/QUICKSCOPER/)

The first release turns the design brief in [IMPLEMENTATION.md](IMPLEMENTATION.md) into a complete game. That document is preserved as the original concept and unfinished sketch; the playable implementation lives in `index.html`, `style.css`, and `src/`.

## The game

- **The Circuit:** a 90-second score attack against six moving voxel training bots. Watch their orange charge bars, dodge shots, use cover, and chain eliminations.
- **Free Range:** unlimited practice with incoming fire disabled.
- **The Switchyard:** an original industrial arena with three connected lanes, containers, crates, low cover, gantries, and distant skyline geometry.
- **QS–01:** a five-round bolt-action rifle with a 190 ms visual scope-in, 820 ms bolt cycle, 1.85-second reload, and unlimited reserve magazines.
- Precise head, torso, and limb hits; solid cover; normalized movement, sprinting, jumping, and crouching.
- Synthesized weapon and hit sounds, animated rifle and bolt, hitmarkers, voxel fragments, tracers, combo feedback, a results screen, and a local personal best.

### Find the rhythm

Hold right mouse to raise the scope, line up, and click left. Shots become accurate after **160 ms** of uninterrupted scope time. A kill between **160–550 ms** earns a quickscope bonus. Holding the scope longer stays accurate; hip-fire has spread. The rifle lowers during cycling and reloads. A held right button raises it again once the bolt is ready.

A torso or head hit eliminates a bot; limbs take two hits. Base elimination: **100 points**, headshot: **+50**, quickscope: **+100**. Eliminations within **3.1 seconds** extend a chain, multiplying points up to **5×**. In the Circuit, being downed costs **200 points** and respawns you with a loaded rifle and brief protection. Health regenerates after **3.5 seconds** without damage.

## Controls

Desktop keyboard and mouse are required. Touch and gamepad controls are not included.

| Action | Input |
| --- | --- |
| Move | WASD or arrow keys |
| Look | Mouse |
| Fire | Left click; one shot per click when bolt is ready |
| Hold scope | Right mouse button |
| Sprint | Shift |
| Jump | Space |
| Crouch | Hold C or Ctrl |
| Reload | R |
| Mute | M |
| Pause / release mouse | Esc or P |

Losing focus, changing tabs, or releasing pointer lock pauses the simulation. Resume requires a deliberate click. Settings include mouse sensitivity, inverted vertical aim, sound volume, reduced motion/flashes, and lower render resolution. Settings and the Circuit best score are stored only on your device.

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

`dist/` contains only the distributable game and license. `scripts/browser-check.cjs` uses Playwright as isolated CI tooling, not a game dependency. The workflow runs Chromium rendering/input tests, captures screenshots, and checks offline reload at `/QUICKSCOPER/` before deploying.

## GitHub Pages

Set **Settings → Pages → Build and deployment → Source → GitHub Actions** once. The included workflow tests pull requests and deploys a tested artifact on pushes to `main`. It pins Ubuntu 24.04, keeps deployment permissions separate, and has no scheduled jobs. Workflow-level concurrency is acquired before tests so delayed old check jobs do not replace newer queued deployment jobs.

## Source layout

| File | Responsibility |
| --- | --- |
| `src/math.js` | Column-major matrices, vectors, seeded RNG, ray/box intersection |
| `src/world.js` | Original arena geometry and collision boxes |
| `src/game.js` | Pure fixed-step simulation, movement, weapon, scoring, bots |
| `src/renderer.js` | Raw WebGL shaders, batched geometry, voxel models and rifle |
| `src/audio.js` | Local Web Audio synthesis |
| `src/app.js` | Input, lifecycle, Canvas overlay, HUD, settings and effects |
| `sw.js` | Scope-isolated offline cache |

See [engineering rules](AGENTS.md) and [design notes](docs/DESIGN.md).

## Original work and license

QUICKSCOPER is an independent QSOL–IMC project. The arena, voxel geometry, rifle design, graphics, UI, and synthesized audio are original to this implementation. It is not affiliated with Activision or Call of Duty, and includes none of their assets or maps. The supplied [Apache-2.0 license](LICENSE) is retained.
