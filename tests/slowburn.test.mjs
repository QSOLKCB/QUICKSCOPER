import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {Game, RULES} from '../src/game.js';
import {FrameGate} from '../src/frame-gate.js';
import {RIFLE_SKINS, BOT_SKINS, DEFAULT_SKINS, normalizeSkins, weaponPattern} from '../src/skins.js';
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const advance = (g, n, input = {}) => { for (let i = 0; i < n; i++) g.step(1/120, input); };
const bot = (id, z, extra = {}) => ({id, x:0, y:0, z, alive:true, hp:100, yaw:0, wait:999, charge:0, flash:0, phase:0, homeX:0, homeZ:z, think:99, moveX:0, moveZ:0, turn:99, ...extra});
// One target straight ahead; aim at the head (eye height 1.93) or torso (1.2).
function range({head = true, adsTime = 0.2, bots = [8], options = {}} = {}) {
  const g = new Game('practice', 23, options);
  g.world.solids = []; g.player.pitch = 0; g.player.y = head ? 1.93 - 1.68 : 1.2 - 1.68;
  g.bots = bots.map((z, id) => bot(id, z));
  g.weapon.aiming = true; g.weapon.adsTime = adsTime;
  return g;
}

test('a quickscope headshot opens a slow-motion moment on the world clock only', () => {
  const g = range(); g.shoot();
  assert.ok(g.slowmo > 0); near(g.timeScale, RULES.slowmoScale);
  assert.equal(g.drainEvents().find(e => e.type === 'slowmo').reason, 'quickscope');
  // Bots move at 30% speed while the moment lasts...
  const normal = range({head:false, adsTime:0.8, bots:[]});
  for (const game of [g, normal]) game.bots = [bot(9, -20, {moveX:1, role:0})];
  advance(g, 24); advance(normal, 24);
  near(g.bots[0].x/normal.bots[0].x, RULES.slowmoScale, 0.02);
  // ...but the bolt, scope and clock run in real time, so timing windows are untouched.
  near(g.weapon.bolt, RULES.bolt - 24/120, 1e-6); near(g.time, 24/120, 1e-9);
  advance(g, 120*1.5); near(g.timeScale, 1, 1e-3);
});

test('collaterals trigger slow motion; slow body kills and the opt-out do not', () => {
  const collateral = range({head:false, adsTime:0.8, bots:[8, 3]}); collateral.shoot();
  assert.equal(collateral.stats.collaterals, 1); assert.ok(collateral.slowmo > 0);
  const plain = range({head:false, adsTime:0.8}); plain.shoot();
  assert.equal(plain.stats.kills, 1); assert.equal(plain.slowmo, 0);
  const off = range({options:{slowmo:false}}); off.shoot();
  assert.equal(off.stats.kills, 1); assert.equal(off.slowmo, 0); assert.equal(off.timeScale, 1);
});

test('the Circuit timer and quickscope scoring are identical with and without slow motion', () => {
  const on = range(), off = range({options:{slowmo:false}});
  for (const g of [on, off]) { g.mode = 'run'; g.shoot(); advance(g, 600); }
  assert.equal(on.stats.score, off.stats.score); near(on.remaining, off.remaining, 1e-9);
});

test('damage reports the shooter position for the directional indicator', () => {
  const g = new Game('run', 3); g.player.invulnerable = 0; g.damage(18, [4, -6]);
  assert.deepEqual(g.drainEvents().find(e => e.type === 'damage').from, [4, -6]);
  const h = new Game('run', 3); h.player.invulnerable = 0; h.damage(18);
  assert.equal(h.drainEvents().find(e => e.type === 'damage').from, null);
});

test('VANILLAJS FrameGate skips identical static frames and redraws on any change', () => {
  const gate = new FrameGate(); let draws = 0; const draw = () => { draws++; };
  const frame = {key:'paused', width:1440, height:900, contextEpoch:0};
  assert.equal(gate.present(frame, draw), true); assert.equal(gate.present(frame, draw), false);
  gate.invalidate(); assert.equal(gate.present(frame, draw), true);
  assert.equal(gate.present({...frame, width:1280}, draw), true);
  assert.equal(gate.present({...frame, width:1280, contextEpoch:1}, draw), true);
  assert.equal(gate.present({...frame, width:1280, contextEpoch:1, key:'results'}, draw), true);
  assert.equal(draws, 5); assert.equal(gate.stats().skipped, 1);
});

test('skin assets are complete, validated, cached offline and well-formed', async () => {
  const color = c => Array.isArray(c) && c.length === 3 && c.every(v => Number.isFinite(v) && v >= 0 && v <= 2);
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const [id, s] of Object.entries(RIFLE_SKINS)) {
    for (const key of ['metal','edge','stock','accent','lens']) assert.ok(color(s[key]), `${id}.${key}`);
    const decals = []; weaponPattern(s.pattern, [0, 0, 0, 0.13, 0.11, 0.4], s.accent, (...a) => decals.push(a));
    assert.equal(decals.length > 0, s.pattern !== 'none', `${id} pattern`);
    assert.ok(sw.includes(`rifle-${id}.svg`));
  }
  for (const [id, s] of Object.entries(BOT_SKINS)) {
    assert.equal(s.roles.length, 3); for (const c of [...s.roles, s.metal, s.sand, s.visor, s.stripe]) assert.ok(color(c), id);
    assert.ok(sw.includes(`bots-${id}.svg`));
  }
  assert.deepEqual(normalizeSkins({rifle:'ember', bots:'nope'}), {...DEFAULT_SKINS, rifle:'ember'});
  assert.deepEqual(normalizeSkins(null), DEFAULT_SKINS);
  const dir = new URL('../assets/skins/', import.meta.url), files = await readdir(dir);
  assert.equal(files.length, Object.keys(RIFLE_SKINS).length + Object.keys(BOT_SKINS).length);
  for (const name of files) {
    const text = await readFile(new URL(name, dir), 'utf8');
    assert.ok(text.startsWith('<svg') && text.trim().endsWith('</svg>'), name);
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|#)/.test(text), `${name} has an unescaped ampersand`);
  }
});

// OPT-BUDGET-001: a generous, regression-only budget for a whole simulated
// Circuit (10,800 fixed ticks with six live bots), plus deterministic replay.
test('a full 90-second Circuit simulates deterministically within its CPU budget', () => {
  const run = () => {
    const g = new Game('run', 77); g.player.invulnerable = 1e9;
    const start = performance.now();
    for (let i = 0; i < 90*120 + 2; i++) {
      if (i % 240 === 120) { g.weapon.aiming = true; g.weapon.adsTime = 0.2; g.shoot(); }
      g.step(1/120, {forward:i % 600 < 300, aim:false});
    }
    return {ms:performance.now() - start, finished:g.finished, state:JSON.stringify([g.stats, g.bots.map(b => [b.x.toFixed(6), b.z.toFixed(6), b.alive])])};
  };
  const a = run(), b = run();
  assert.equal(a.finished, true); assert.equal(a.state, b.state, 'same seed and inputs must replay identically');
  assert.ok(a.ms < 4000, `simulation took ${a.ms.toFixed(0)} ms (budget 4000 ms)`);
  console.log(`# full Circuit simulated in ${a.ms.toFixed(0)} ms`);
});
