// Renders the skin swatches in assets/skins/ from src/skins.js so menu
// previews always match the in-game palettes, and keeps sw.js in sync.
// Run: npm run skins
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {RIFLE_SKINS, BOT_SKINS} from '../src/skins.js';
const out = new URL('../assets/skins/', import.meta.url);
const hex = c => '#' + c.map(v => Math.round(Math.min(1, Math.max(0, v))*255).toString(16).padStart(2, '0')).join('');
const xml = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const glows = c => c[0] + c[1] + c[2] > 2.6;
const GLOW = '<filter id="g" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';

function rifleSvg(s) {
  const a = hex(s.accent), f = glows(s.accent) ? ' filter="url(#g)"' : '';
  const stock = {x:66, y:28, w:30, h:12}, body = {x:30, y:26, w:38, h:10}, fore = {x:14, y:28, w:18, h:8};
  const decal = r => {
    switch (s.pattern) {
      case 'engrave': return `<path d="M${r.x + 2} ${r.y + 2.5} H${r.x + r.w - 2} M${r.x + 2} ${r.y + r.h - 2.5} H${r.x + r.w - 2}" stroke="${a}" stroke-width="0.8"/>`;
      case 'inlay': return `<path d="M${r.x + 1} ${r.y + r.h/2} H${r.x + r.w - 1}" stroke="${a}" stroke-width="1.4"${f}/>`;
      case 'stripe': return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="2.4" fill="${a}"/>`;
      case 'bands': return [0.2, 0.5, 0.8].map(t => `<rect x="${(r.x + t*r.w - 1).toFixed(1)}" y="${r.y - 0.5}" width="2" height="${r.h + 1}" fill="${a}"/>`).join('');
      case 'tiger': return [0.15, 0.4, 0.65, 0.9].map(t => { const x = r.x + t*r.w; return `<path d="M${x.toFixed(1)} ${r.y} h3 l-3 ${r.h} h-3 z" fill="${a}"/>`; }).join('');
      default: return '';
    }
  };
  const box = (r, c) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${hex(c)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" role="img" aria-label="${xml(s.name)} rifle finish">
<defs>${GLOW}</defs><rect width="100" height="60" rx="5" fill="#101b19"/>
<rect x="2" y="30" width="14" height="2.4" fill="${hex(s.metal)}"/>
${box(fore, s.stock)}${box(body, s.metal)}${box(stock, s.stock)}
<path d="M58 36 L64 36 L61 48 L55 48 Z" fill="${hex(s.stock)}"/><path d="M46 36 Q50 44 55 36" fill="none" stroke="${hex(s.edge)}" stroke-width="1.6"/>
<rect x="34" y="17" width="26" height="6" rx="3" fill="${hex(s.metal)}"/><rect x="58" y="16" width="5" height="8" rx="2" fill="${hex(s.edge)}"/><rect x="62.5" y="17.5" width="1.2" height="5" fill="${hex(s.lens)}"/>
<rect x="40" y="23" width="3" height="3" fill="${hex(s.edge)}"/><rect x="52" y="23" width="3" height="3" fill="${hex(s.edge)}"/>
${decal(fore)}${decal(body)}${decal(stock)}
</svg>
`;
}

function bot(x, k, body, s) {
  const r = (px, py, w, h, c, extra = '') => `<rect x="${(x + (px - w/2)*k).toFixed(1)}" y="${(56 - (py + h/2)*k).toFixed(1)}" width="${(w*k).toFixed(1)}" height="${(h*k).toFixed(1)}" fill="${hex(c)}"${extra}/>`;
  const visor = glows(s.visor) ? ' filter="url(#g)"' : '';
  const parts = [r(-4.5, 7, 5.5, 14, s.metal), r(4.5, 7, 5.5, 14, s.metal), r(-4.5, 1.5, 6.5, 3, s.sand), r(4.5, 1.5, 6.5, 3, s.sand),
    r(0, 24, 15, 19, body), r(0, 26, 11.5, 8.5, s.sand), r(0, 26.5, 5, 1.6, s.stripe),
    r(-10, 23.5, 4.5, 14, body), r(10, 23.5, 4.5, 14, body), r(0, 38.5, 10, 10, body), r(0, 44, 11.5, 1.6, s.metal), r(0, 39, 9, 2.4, s.visor, visor)];
  if (s.detail === 'plates') parts.push(r(0, 18, 14, 1, s.metal), r(0, 31, 14, 1, s.metal), r(0, 45.5, 7, 0.6, s.visor, visor));
  if (s.detail === 'armor') parts.push(r(-10, 30.5, 6.5, 3.2, s.metal), r(10, 30.5, 6.5, 3.2, s.metal), r(0, 43, 12, 4, s.metal), r(-4.5, 9, 4.8, 3.2, s.metal), r(4.5, 9, 4.8, 3.2, s.metal));
  if (s.detail === 'chevrons') for (let i = 0; i < 4; i++) parts.push(r(-5.4 + i*3.6, 17, 1.6, 3.6, s.stripe));
  return parts.join('');
}
function botsSvg(s) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" role="img" aria-label="${xml(s.name)} bot skin">
<defs>${GLOW}</defs><rect width="100" height="60" rx="5" fill="#101b19"/><rect y="56" width="100" height="4" fill="#0a1311"/>
${bot(22, 0.82, s.roles[1], s)}${bot(78, 0.82, s.roles[2], s)}${bot(50, 0.98, s.roles[0], s)}
</svg>
`;
}

await mkdir(out, {recursive:true});
const written = [];
for (const [id, s] of Object.entries(RIFLE_SKINS)) { const name = `rifle-${id}.svg`; await writeFile(new URL(name, out), rifleSvg(s)); written.push(name); }
for (const [id, s] of Object.entries(BOT_SKINS)) { const name = `bots-${id}.svg`; await writeFile(new URL(name, out), botsSvg(s)); written.push(name); }
const swUrl = new URL('../sw.js', import.meta.url), sw = await readFile(swUrl, 'utf8');
const list = written.map(n => `'./assets/skins/${n}'`).join(',');
if (!/const SKIN_FILES=\[[^\]]*\];/.test(sw)) throw new Error('sw.js is missing its SKIN_FILES list');
await writeFile(swUrl, sw.replace(/const SKIN_FILES=\[[^\]]*\];/, `const SKIN_FILES=[${list}];`));
console.log(`Wrote ${written.length} skin swatches to assets/skins/ and updated sw.js.`);
