# v0.3.0 — Slow Burn

**Land the shot. Watch it hang.**

QUICKSCOPER v0.3.0 brings ideas from its sibling QSOL projects to the Switchyard: slow-motion kill moments from [Bullet-Time](https://github.com/QSOLKCB/Bullet-Time), a skins locker, a directional damage arc, glowing tracers, [VANILLAJS](https://github.com/QSOLKCB/VANILLAJS) frame gating and an [OPT](https://github.com/QSOLKCB/OPT) performance budget. The quickscope rhythm hasn't changed: every timing window and score is the same as in v0.2.0.

[Play QUICKSCOPER](https://qsolkcb.github.io/QUICKSCOPER/)

## Slow-motion kill moments

- A **quickscope headshot** or a **collateral** drops the world to **30% speed** for 0.45 s, then eases back.
- Only the world slows: bots, their charge bars and respawns, data dust and tracers. Your aim, the **150 ms** scope settle, the **820 ms** bolt, the **180 ms** fire buffer and the Circuit timer stay real-time. Scores and timing windows are identical with the effect on or off.
- Warm colour grade, a shockwave ring, air ripples along your tracer and a low-pass sweep over the whole mix. Turn it off with **Settings → Slow-motion kill moments**.

## The locker

- Six QS–01 finishes: **Switchyard**, **Ivory & Brass** (engraved), **Ember** (glowing inlay), **Chrome Noir** (racing stripe), **Jade** (gilt bands) and **Tiger Stripe**.
- Four bot looks: **Training Bots**, **Chrome Units**, **Night Shift** and **Hazard Crew**. Flankers keep a distinct cool tone in every look.
- Open it from **◈** on the menu or **Skins** in the pause menu. Cosmetic only: hitboxes never change. Choices are saved on your device and cached for offline play.

## Readability and performance

- A **directional damage arc** points at the bot that hit you.
- Tracers now render in an additive glow pass.
- Paused and results screens no longer redraw every display refresh (VANILLAJS `FrameGate`).
- A new performance budget test simulates a full 90-second Circuit (about 0.3 s locally) and checks the replay is deterministic.

## Compatibility

- The default skins (Switchyard and Training Bots) reproduce the v0.2.0 look exactly.
- Saved settings and personal bests carry over.
- The offline cache revision is now `v0.3.0-1`. If you still see v0.2.0, reload once while online, close every QUICKSCOPER tab, then reopen it.

## Verification

53 automated tests and the packaged Chromium browser checks pass: rendering, offline subpath reload, mouse and Xbox flows, skins locker, slow-motion clock after a controller collateral, paused-frame gating, WebGL 1 fallback and the unsupported-graphics message. Real GPU performance and controller feel vary by device.

# v0.2.0 — Chain Reaction

**Snap in. Line them up. Turn them into data dust.**

QUICKSCOPER v0.2.0 brings smoother quickscoping, collateral kills, Xbox controls, procedural music and smarter opponents to the Switchyard. An original single-player browser game, built with vanilla HTML/CSS/JavaScript, raw WebGL, Canvas 2D and Web Audio. No engine, frameworks or runtime dependencies.

[Play QUICKSCOPER](https://qsolkcb.github.io/QUICKSCOPER/)

## Smoother scope-to-shot timing

- Scope animation and accuracy now settle together in **150 ms**.
- A **180 ms input buffer** accepts slightly early trigger presses.
- Holding scope raises the rifle during the final **150 ms** of the bolt cycle.
- Quickscope bonuses apply from **150–550 ms** of continuous aiming. One click or trigger pull still produces one shot.
- Improved rifle/scope transitions and corrected tracer clipping near the camera.

## Collaterals and data dust

- One bullet can hit multiple aligned enemies. Solid cover stops penetration.
- Two or more kills with one round earn **+150 points per extra kill**, alongside normal kill and chain points.
- Enemies dissolve into glowing data dust, with distinct collateral feedback and sound.
- Results now track collaterals, your largest collateral and total targets hit. Accuracy counts successful rounds and cannot exceed 100%.

## Xbox controller profile

- Analog movement and look, adjustable sensitivity, radial deadzones and slower scoped aiming.
- **LT** scope, **RT** fire, **A** jump, **B / right stick click** crouch, **X** reload, **left stick click** sprint and **Menu** pause.
- D-pad menu navigation, A to select and B to close dialogs.
- Disconnect/replacement pause and neutral-input guards prevent held controls from carrying across resumes and restarts.

## Mathematical music and smarter bots

- Original **108 BPM** soundtrack generated from Euclidean rhythms, modular pentatonic melodies and equal-tempered pitches.
- Extra musical layers follow your streak, with independent music volume and pause handling.
- Bots navigate around cover, approach distant players, retreat at close range, vary their strafing and evade after surviving a hit.
- Attacks retain visible wind-up and a fresh line-of-sight check before firing.

## Performance and verification

- Reusable CPU/GPU mesh buffers, pooled point particles, fewer HUD updates and less frequent tactical decisions reduce per-frame work.
- Reduced-motion and lower-quality options adjust effects and rendering load.
- **46 automated tests passed**, plus Chromium checks covering gameplay, emulated Xbox input, data dust, audio lifecycle, offline reload and WebGL 1 fallback.
- Xbox automation uses emulated inputs; physical controller hardware was not available for testing.

Both **The Circuit** and **Free Range** remain available, with offline play, local settings and personal bests. The project retains its **Apache-2.0 license**.

**Updating an offline copy:** reload once while online, close all QUICKSCOPER tabs, then reopen. The menu footer should show **v0.2.0**.

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
