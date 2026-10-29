# v0.2.0 — Chain Reaction

- Scope animation and accuracy now settle together at 150 ms. Scope rises during the final 150 ms of the bolt cycle; a bounded 180 ms trigger buffer accepts slightly early clicks. One press still means one shot.
- Penetrating shots can hit multiple aligned bots. Hard cover stops the bullet. Multi-kills add collateral bonuses, distinct feedback and results statistics; shot accuracy remains capped at 100%.
- Bots dissolve into a burst of glowing data dust. Reduced-motion and low-quality settings reduce density.
- Original 108 BPM mathematical soundtrack: Euclidean rhythms, modular pentatonic melodies, equal-tempered pitches and extra layers during streaks. Independent music volume, pause-safe scheduling, no samples or network assets.
- Xbox profile: analog movement, curved aim response, radial deadzone, adjustable look speed, LT/RT aiming and firing, A jump, B/RS crouch, X reload, LS sprint, Menu pause. D-pad/A/B menu support, disconnect pause and neutral-input guards.
- Bots navigate around cover, approach distant players, retreat at close range, vary strafing and dodge surviving hits. They retain visible attack wind-up and a fresh muzzle-occlusion check before firing.
- Reusable typed mesh buffers, direct cube vertex writes, separate persistent GPU buffers, pooled particles, in-place effect expiry, 20 Hz HUD updates and 5 Hz tactical decisions reduce per-frame work.
- Expanded deterministic tests and Chromium checks, including standard gamepad emulation, offline subpath boot, data dust, audio lifecycle and WebGL 1 fallback. No runtime dependencies added.

Existing offline tabs keep their current version until all game tabs close. Close and reopen to pick up the new cache. Physical Xbox hardware has not been tested in the automated environment.

# v0.1.0 — Enter the Switchyard

First playable QUICKSCOPER release: an original, offline-ready quickscoping game built with vanilla HTML/CSS/JavaScript, raw WebGL, Canvas 2D, Pointer Lock, and Web Audio.

- The Circuit: 90-second score runs with moving, telegraphing training bots, health regeneration, respawns, and local records.
- Free Range: untimed, damage-free practice.
- Original Switchyard arena and QS–01 bolt-action rifle, including scope transitions, five-round magazines, reload and bolt animations.
- Quickscope and headshot bonuses, streak multipliers, precise hit regions, solid cover, hitmarkers, fragments, and synthesized sound.
- Sprint, jump, crouch, mouse sensitivity, inverted aim, mute, reduced motion and lower render resolution settings.
- Safe pause/resume, focus-loss handling, fresh restarts, and an end-of-run breakdown.
- Relative-path static packaging, offline caching, regression tests, Chromium smoke checks and test-gated GitHub Pages deployment.

Requires a desktop keyboard/mouse and WebGL. Single-player only; no accounts, imported game assets, frameworks, or runtime package dependencies.
