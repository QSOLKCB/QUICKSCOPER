# QUICKSCOPER engineering rules

Read the opening design brief in IMPLEMENTATION.md and the current README before changing gameplay. IMPLEMENTATION.md contains an unfinished historical sketch, not executable source.

- Preserve the feel: quick ADS, an accurate settled scope, one-click bolt-action shots, readable hit feedback, quickscope rewards, and short replayable runs.
- Runtime is vanilla HTML/CSS/JavaScript, raw WebGL (WebGL 2 with WebGL 1 fallback), Canvas 2D, Pointer Lock, and synthesized Web Audio. No frameworks, game engines, CDNs, remote fonts, imported game assets, or runtime npm dependencies.
- Keep this an original, single-player game. Do not use proprietary maps, audio, textures, names, characters, weapon branding, or logos.
- Simulation lives in src/game.js; browser input, presentation, and effects live outside it. Keep the fixed simulation step, diagonal speed normalization, bounded frame backlog, and seeded gameplay randomness.
- Collision and shot occlusion must agree with world geometry. Bot hit volumes rotate with the model. Neither side may shoot through cover.
- Pause, lost focus, pointer-unlock in mouse mode, controller disconnect in Xbox mode, and hidden tabs stop simulation and clear held inputs. Restart creates a fresh simulation without adding listeners or animation loops.
- Preserve one-shot trigger edges, bounded fire buffering, neutral-controller guards and wall-blocked collateral tracing. Keep musical sequencing deterministic and stop scheduled music on pause.
- Optional audio, storage, and offline caching must fail gracefully. Unsupported graphics must show an actionable message, never a silent blank game.
- Keep all runtime paths relative for /QUICKSCOPER/ Pages hosting. Update sw.js REVISION when cached assets change. Only remove this game's scope-specific caches.
- Run npm test, npm run check, and npm run build. The CI browser smoke test validates the packaged game under the repository subpath, including offline reload.
- Deploy only the tested dist/ artifact. Keep Pages write and OIDC permissions restricted to the deployment job. Pin the runner OS; do not add scheduled workflows.
