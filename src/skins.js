// Skin assets for the QS–01 rifle and the Switchyard bots (adapted from
// QSOLKCB/Bullet-Time). Original, data-driven and procedural: each skin is a
// palette plus a surface pattern the renderer turns into decal geometry.
// Colours whose RGB sum exceeds 2.6 render as emissive (glowing).
// scripts/skins.mjs renders the matching SVG swatches into assets/skins/.

export const RIFLE_SKINS = Object.freeze({
  yard:{name:'SWITCHYARD', note:'Factory teal steel, sand stock.', metal:[0.15,0.20,0.21], edge:[0.27,0.32,0.31], stock:[0.47,0.44,0.30], accent:[0.86,0.88,0.47], lens:[0.15,0.39,0.42], pattern:'none'},
  ivory:{name:'IVORY & BRASS', note:'Engraved brass, ivory furniture.', metal:[0.56,0.43,0.18], edge:[0.74,0.62,0.34], stock:[0.86,0.82,0.72], accent:[0.32,0.22,0.08], lens:[0.35,0.28,0.12], pattern:'engrave'},
  ember:{name:'EMBER', note:'Blackened steel, molten inlay.', metal:[0.06,0.055,0.05], edge:[0.14,0.13,0.12], stock:[0.1,0.08,0.07], accent:[1.7,0.62,0.18], lens:[0.5,0.18,0.06], pattern:'inlay'},
  chrome:{name:'CHROME NOIR', note:'Mirror chrome, black racing stripe.', metal:[0.6,0.63,0.68], edge:[0.84,0.86,0.9], stock:[0.08,0.08,0.09], accent:[0.07,0.07,0.08], lens:[0.2,0.3,0.45], pattern:'stripe'},
  jade:{name:'JADE', note:'Lacquered green with gilt bands.', metal:[0.1,0.3,0.22], edge:[0.24,0.5,0.38], stock:[0.09,0.1,0.09], accent:[0.9,0.72,0.3], lens:[0.2,0.45,0.3], pattern:'bands'},
  tiger:{name:'TIGER STRIPE', note:'Hand-painted hazard stripes.', metal:[0.12,0.1,0.09], edge:[0.92,0.6,0.2], stock:[0.82,0.44,0.1], accent:[0.06,0.05,0.04], lens:[0.45,0.3,0.1], pattern:'tiger'}
});
export const RIFLE_SKIN_IDS = Object.freeze(Object.keys(RIFLE_SKINS));

// roles: [standard, flanker, heavy-gait] body colours. Flankers keep a distinct
// cool tone in every skin so roles stay readable.
export const BOT_SKINS = Object.freeze({
  training:{name:'TRAINING BOTS', note:'The Switchyard regulars.', detail:'none',
    roles:[[0.23,0.49,0.45],[0.38,0.48,0.63],[0.47,0.53,0.28]], metal:[0.12,0.18,0.19], sand:[0.64,0.65,0.52], visor:[0.97,0.64,0.27], stripe:[0.89,0.87,0.42]},
  chrome:{name:'CHROME UNITS', note:'Polished shells, glowing optics.', detail:'plates',
    roles:[[0.62,0.65,0.68],[0.45,0.55,0.72],[0.7,0.62,0.45]], metal:[0.2,0.21,0.24], sand:[0.32,0.34,0.38], visor:[0.3,1.3,1.4], stripe:[0.3,1.3,1.4]},
  nightshift:{name:'NIGHT SHIFT', note:'Riot armour, red optics.', detail:'armor',
    roles:[[0.1,0.105,0.12],[0.12,0.16,0.24],[0.17,0.17,0.15]], metal:[0.04,0.04,0.045], sand:[0.2,0.21,0.24], visor:[1.6,0.22,0.15], stripe:[0.6,0.12,0.1]},
  hazard:{name:'HAZARD CREW', note:'Yard-yellow plating, chevrons.', detail:'chevrons',
    roles:[[0.82,0.64,0.14],[0.3,0.5,0.72],[0.72,0.44,0.12]], metal:[0.1,0.1,0.1], sand:[0.16,0.15,0.13], visor:[0.25,0.9,0.75], stripe:[0.08,0.08,0.08]}
});
export const BOT_SKIN_IDS = Object.freeze(Object.keys(BOT_SKINS));
export const DEFAULT_SKINS = Object.freeze({rifle:'yard', bots:'training'});

export function normalizeSkins(value) {
  const out = {...DEFAULT_SKINS};
  if (!value || typeof value !== 'object') return out;
  if (Object.hasOwn(RIFLE_SKINS, value.rifle)) out.rifle = value.rifle;
  if (Object.hasOwn(BOT_SKINS, value.bots)) out.bots = value.bots;
  return out;
}

// Decals for one rifle panel [x,y,z,w,h,d] (length along Z). draw(x,y,z,w,h,d,color).
export function weaponPattern(pattern, panel, accent, draw) {
  const [x, y, z, w, h, d] = panel, e = 0.002;
  switch (pattern) {
    case 'engrave':
      for (const side of [-1, 1]) { draw(x + side*(w/2 + e), y + h*0.22, z, 0.003, h*0.08, d*0.86, accent); draw(x + side*(w/2 + e), y - h*0.22, z, 0.003, h*0.08, d*0.86, accent); }
      for (let i = -1; i <= 1; i++) for (const side of [-1, 1]) draw(x + side*(w/2 + e), y, z + i*d*0.25, 0.003, h*0.26, h*0.26, accent);
      break;
    case 'inlay':
      for (const side of [-1, 1]) draw(x + side*(w/2 + e), y, z, 0.003, Math.max(0.004, h*0.1), d*0.9, accent);
      break;
    case 'stripe':
      draw(x, y + h/2 + e, z, w*0.32, 0.003, d*0.98, accent);
      break;
    case 'bands':
      for (const t of [-0.32, 0, 0.32]) draw(x, y, z + t*d, w + 2*e, h + 2*e, Math.min(0.02, d*0.07), accent);
      break;
    case 'tiger':
      for (let i = 0; i < 5; i++) draw(x, y + h*0.12, z + (-0.4 + i*0.2)*d, w + 2*e, h*0.6, Math.min(0.025, d*0.08), accent);
      break;
  }
}
