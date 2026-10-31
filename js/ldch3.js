'use strict';
/* THE LAST DAWN, chapters III and IV: the raid on Veyra, and the city beneath it. */

/* ---------- Veyra ---------- */
function makeEngine(lit) {
  return canvasSprite(96, 112, lit ? 2 : 1, (px, r, g, meta) => {
    px(6, 94, '#0b0a12', 84, 16); px(8, 96, '#4a4658', 80, 12); px(8, 96, '#6a6678', 80, 2);
    for (const x of [12, 72]) { px(x, 26, '#0b0a12', 14, 70); px(x + 1, 27, '#5e557f', 12, 68); px(x + 1, 27, '#8a87a0', 3, 68); for (let y = 34; y < 90; y += 10) px(x + 3, y, lit ? '#ffd35a' : '#36304f', 8, 2); }
    for (let i = 14; i < 82; i++) { const t = (i - 48) / 34, y = 20 + Math.round(t * t * 12); px(i, y, '#0b0a12', 1, 8); px(i, y + 1, '#8a87a0', 1, 6); }
    const cx = 48, cy = 58, R = 19;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > R) continue;
      px(cx + x, cy + y, d > R - 2 ? '#0b0a12' : d > R - 5 ? (lit ? '#ffd35a' : '#3a3a58') : d > R - 10 ? (lit ? '#fff3b0' : '#2a2a44') : (lit ? '#ffffff' : '#1c1c30'));
    }
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; px(cx + Math.round(Math.cos(a) * 24), cy + Math.round(Math.sin(a) * 24), lit ? '#ffd35a' : '#5e557f', 3, 3); }
    meta.glows.push([48, 58, lit ? '#ffd35a' : '#8ff0ff']);
  });
}
function buildVeyra(o = {}) {
  biomeOverride = () => 'moss'; resetWorldCache();
  scnBlock(-60, -330, 1780, 330);
  scnGround(-80, -310, 1900, 620, [[-80, -310, 1900, 620, '#1a1812', ['#100e0a', '#26231a']], [0, -26, 1720, 52, ...COBBLE], [290, -300, 26, 600, ...COBBLE], [690, -300, 26, 600, ...COBBLE],
    [1110, -300, 26, 600, ...COBBLE], [760, -130, 380, 260, ...COBBLE], [1250, -125, 300, 250, ...COBBLE]], 41);
  const V = G.ld.place = { houses: [], stalls: [], walls: [], towers: [] };
  V.walls.push(...scnWall(0, -300, 0, -40), ...scnWall(0, 40, 0, 300), ...scnWall(0, -300, 1720, -300), ...scnWall(0, 300, 1720, 300));
  V.gate = scnAdd(cached('vey-gate', () => makeGate(9)), 0, 8, { solids: [[-38, -2, 9], [38, -2, 9]], hp: 700, tgt: true, name: 'Veyra Gate' });
  for (const [x, y] of [[0, -304], [0, 304], [1720, -304], [1720, 304]]) V.towers.push(scnAdd(cached('vey-wt', () => makeWatchtower(7)), x, y, { solids: [[0, -2, 12]] }));
  const kinds = ['cottage', 'house2', 'longhouse', 'inn', 'cottage', 'house2'];
  let n = 0;
  for (const y of [-124, 150, -222, 238]) for (let x = 150; x <= 650; x += 112) {
    const p = scnHouse(x + (n % 3) * 6, y, kinds[n % kinds.length], n * 7 + 3);
    if (o.burned && n % 2) { p.spr = p.ruinedSpr; p.light = false; }
    V.houses.push(p); n++;
  }
  for (const [x, y] of [[1640, -124], [1640, 150], [1250, -250], [1450, 260]]) V.houses.push(scnHouse(x, y, kinds[n++ % kinds.length], n * 5));
  scnProp('fountain', 950, 6, 16);
  [[800, -92], [884, -100], [1016, -98], [1100, -90], [800, 104], [884, 112], [1016, 108], [1100, 98]].forEach(([x, y], i) => V.stalls.push(scnAdd(cached('vey-stall' + i, () => makeStall(i + 1, i % 2 ? '#d8354a' : '#3f8ee0', '#f2eee6')), x, y, { solids: [[0, -2, 10]] })));
  V.tower = scnAdd(cached('vey-tower', () => makeTower(3)), 1400, -24, { solids: [[0, -2, 16]], name: 'Central Tower' });
  if (o.palace) V.palace = scnAdd(cached('vey-palace', () => makeMansion(5)), 1560, -150, { solids: [[-30, -2, 14], [0, -2, 14], [30, -2, 14]], name: 'Palace' });
  sideLamps(40, 1700, -36, 80); sideLamps(40, 1700, 36, 80);
  for (const x of [200, 520, 900, 1250]) scnProp('banner', x, -44, 3);
  if (o.burned) for (const [x, y] of [[180, 10], [420, -10], [560, 40], [830, 20]]) scnProp('brazier', x, y, 4);
  return V;
}
const pieceOf = (V, i) => V.houses[i];

/* ---------- III · Veyra ---------- */
const veyraOpening = function* (c) {
  Cine.fade = 1;
  yield c.cine(true);
  const V = G.ld.place;
  c.party(-640, 0, { gap: 22 });
  c.snap(-560, 0); c.music(3); c.sfx('wind');
  yield c.all(c.fade(0, 2.4), c.cam(-560, 0, 1));
  yield c.title('III · Veyra', 'The last great city under the dead sky.');
  yield c.all(c.cam(300, 0, 6, 'inout'), c.zoom(1.1, 3));
  yield c.wait(1);
  yield* c.convo([['kael', 'That is a lot of lights.'], ['mira', 'Veyra. They kept the lamps burning all this time.']]);
  yield c.all(c.cam(-120, 0, 2.2), c.zoom(1, 1.5));
  c.sfx('rumble');
  // the gates open and a crowd runs out
  V.gate.spr = prop('arch'); V.gate.big = false; c.sfx('bigboom');
  const crowd = c.crowd(30, 90, 0, 60, { keys: ['refugee', 'refugee2', 'survivor', 'villager2'] });
  yield c.wait(0.6);
  yield c.all(...crowd.map(a => c.walk(a, -380 + rand(-60, 20), rand(-80, 80), 52 + rand(0, 12))));
  yield* c.convo([['mira', 'How many people are in there?'], ['bram', 'Enough to make this interesting.']]);
  c.sfx('bell'); yield c.wait(1.3); c.sfx('bell'); yield c.wait(1.1); c.sfx('bell');
  c.shake(5, 1);
  yield c.all(c.cam(-30, -60, 1.2), c.zoom(1.3, 1.2));
  for (let i = 0; i < 7; i++) { const e = c.foe(i % 2 ? 'ghoul' : 'wraith', rand(-60, 40), (i % 2 ? -310 : 310)); e.goal = { x: e.x - 90, y: e.y > 0 ? 160 : -160, spd: 60 }; e.siege = true; }
  yield c.wait(0.5);
  const tomas = c.reg('tomas', unit('tomas', -40, -30, { key: 'tomas', name: 'Tomas', face: -1 }));
  tomas.cine = true;
  yield* c.convo([['tomas', 'Monsters on the walls! Everyone through the gate and keep the gate shut!'], ['elara', 'We hold it. Then we see to the rest.']]);
  for (const e of G.enemies) if (e.siege && !e.dead) { e.goal = null; e.ai = siegeAI; e.anchored = true; }
  tomas.cine = false;
  for (const a of crowd) { a.civ = false; a.goal = { x: 90 + rand(-20, 40), y: rand(-90, 90), spd: 60 }; }
  c.later(4, () => { for (const a of crowd) c.remove(a); });
  yield c.all(c.zoom(1, 0.8), c.cine(false));
};
const veyraPlay = function* (c) {
  const V = G.ld.place, L = LDS(), tomas = c.who('tomas');
  const guards = [];
  // phase 1: the gates
  c.objective('Hold the gates of Veyra');
  tomas.post = { x: -44, y: -26, leash: 70 };
  for (let i = 0; i < 6; i++) guards.push(unit('guard', -72 + (i % 3) * 28, -60 + Math.floor(i / 3) * 112, { post: [-72 + (i % 3) * 28, -60 + Math.floor(i / 3) * 112] }));
  for (let i = 0; i < 6; i++) unit('gbow', 6, (i < 3 ? -1 : 1) * (80 + (i % 3) * 52), { post: [6, (i < 3 ? -1 : 1) * (80 + (i % 3) * 52)] });
  c.bar('gate', 'Veyra Gate', () => (V.gate.fallen ? 0 : V.gate.hp / V.gate.maxHp), '#e8742c');
  const out = [[-560, -70], [-560, 0], [-560, 70]];
  c.bark('tomas', 'Archers on the wall, volley on my mark!', 3);
  c.wave(['ghoul', 'ghoul', 'skel', 'bat'], 14, out, { gap: 0.6 }); yield c.clear(0);
  c.bark('seren', 'More coming from the east road! Hold!', 3); yield c.wait(4);
  c.wave(['ghoul', 'skel', 'wraith', 'bat'], 20, out, { gap: 0.45 }); yield c.clear(1);
  yield c.wait(3);
  c.wave({ ghoul: 3, wraith: 2, skel: 2 }, 22, out, { gap: 0.4, elite: false }); yield c.clear(2);
  // the gate falls
  c.bar('gate');
  yield c.cine(true);
  yield c.all(c.cam(-30, 0, 1), c.zoom(1.3, 1));
  c.sfx('rumble'); c.shake(8, 1.4);
  yield c.wait(1.4);
  c.explode(0, 10, 70); if (!V.gate.fallen) scnCollapse(V.gate, { rubble: true, shake: 10 });
  yield* c.convo([['tomas', 'HOLD THE...!'], ['elara', 'Tomas!']]);
  L.dead.tomas = true; tomas.gone = true; burst(tomas.x, tomas.y, '#d8354a', 24, 90);
  const seren = c.reg('seren', unit('seren', -20, 60, { key: 'seren', name: 'Seren' }));
  yield* c.convo([['seren', 'He bought us time. Do not waste it. Fall back to the market square, all of you!']]);
  yield c.cine(false);
  // phase 2: the lower district
  c.objective('Retreat through the lower district'); c.point(860, 0);
  for (const a of allyList()) a.post = null;
  const flee = () => { for (const a of c.crowd(6, 40, 0, 40, { keys: ['refugee', 'refugee2', 'survivor'] })) a.goal = { x: 1120, y: rand(-80, 80), spd: 60 + rand(0, 14) }; };
  const collapsing = [V.houses[1], V.houses[7], V.houses[12]];
  const trigger = [180, 420, 620];
  c.later(0.5, flee); c.later(3, flee); c.later(6, flee);
  c.wave(['ghoul', 'skel', 'bat', 'wraith'], 24, [[-30, -20], [-30, 24]], { gap: 0.9, ai: false });
  c.bark('seren', 'Fall back! Fall back to the square!', 3);
  for (let i = 0; i < 3; i++) {
    yield c.reachX(trigger[i]);
    const p = collapsing[i];
    hz({ k: 'circle', x: p.x, y: p.y - 6, r: 64, warn: 1.3, life: 0.3, dmg: 24, boom: 7, color: '#e8742c' });
    p.shake = 1.3; c.sfx('rumble'); c.bark('bram', 'WATCH THE BUILDING!', 2.2);
    c.later(1.3, () => scnCollapse(p, { shake: 9 }));
    if (i === 1) c.wave(['ghoul', 'wraith'], 10, [[ME.x - 260, -30], [ME.x - 260, 30]], { gap: 0.4, ai: false });
  }
  yield c.reachX(780);
  // phase 3: the market square
  c.objective('The City Eater');
  const wallbits = nearPieces(950, 300, 80).filter(p => p.solid.length || true);
  yield c.cine(true);
  yield c.all(c.cam(950, 150, 1.6), c.zoom(1.15, 1.6));
  c.music(3); c.sfx('rumble'); c.shake(7, 2);
  yield c.wait(1.6);
  for (const p of Scn.pieces) if (!p.fallen && p.y > 280 && Math.abs(p.x - 950) < 90 && p.spr.h < 40) scnCollapse(p, { rubble: true, shake: 8 });
  c.explode(950, 300, 70);
  const b = c.boss('ceater', 950, 360);
  c.music(2);
  yield c.wait(1.2);
  yield* c.convo([['seren', 'By the saints... what is that?'], ['kael', 'It eats cities. That is what that is.'], ['elara', 'Seren! Bring everyone you have!']]);
  for (let i = 0; i < 8; i++) unit(i % 3 ? 'guard' : 'gbow', 760 + i * 20, -120 + (i % 2) * 40);
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  c.bark('seren', 'Archers on the rooftops! Shields on the left!', 3.4);
  yield c.bossBelow(b, 0.55);
  // phase 4: it makes for the tower
  yield c.cine(true);
  const brain = b.ai; b.ai = () => {};
  yield c.all(c.camTo(b, 0.8), c.zoom(1.2, 1));
  c.sfx('roar'); c.shake(9, 1.4);
  yield c.wait(1.2);
  yield* c.convo([['mira', 'Elara! The tower!'], ['elara', 'Everyone with me!']]);
  b.goal = { x: 1330, y: 0, spd: 150 };
  c.follow(b);
  for (const p of V.stalls) { c.later(rand(0.2, 1.2), () => scnCollapse(p, { shake: 5 })); }
  yield c.until(() => !b.goal || Camp.skipping);
  if (b.goal) { b.x = 1330; b.y = 0; b.goal = null; }
  c.follow(null);
  yield c.party(1250, 0, { walk: false });
  b.ai = brain;
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  c.objective('Bring the City Eater down');
  const towerMax = 100; V.tower.hp = V.tower.maxHp = towerMax;
  c.bar('tower', 'Central Tower', () => V.tower.fallen ? 0 : V.tower.hp / towerMax, '#9fc0ff');
  c.later(0, function drain() { if (b.dead || V.tower.fallen) return; V.tower.hp -= 0.9; if (V.tower.hp <= 0) { scnCollapse(V.tower, { shake: 12 }); L.city = 'tower-lost'; } c.later(1, drain); });
  yield c.bossDead(b);
  c.bar('tower'); c.endBoss(b);
  if (!L.city || L.city === 'unknown') L.city = 'standing';
  L.bosses.ceater = true;
  yield c.cine(true);
  c.music(3);
  yield c.all(c.camTo(b, 1), c.zoom(1.3, 1));
  c.shake(10, 1.5); c.explode(b.x, b.y, 60);
  yield c.wait(1.5);
  // bram is hurt in the collapse
  const bram = c.who('bram');
  if (bram) { c.hurt(bram); bram.down = true; }
  yield c.cam(1300, 0, 1);
  yield* c.convo([['kael', 'BRAM!'], ['mira', 'Hold still. Do not move that arm.'], ['bram', '...Just a scratch.'], ['mira', 'It is broken in two places.']]);
  L.injured.bram = 3;
  if (bram) { bram.down = false; bram.hp = bram.maxHp * 0.6; }
  yield c.all(c.cam(950, 0, 2), c.zoom(1.1, 2));
  yield c.wait(0.8);
  c.sfx('rumble'); c.shake(4, 2.2);
  try { BossFx.addDecal(950, 6, { kind: 'fissure', ang: 0.4, len: 140, env: BossFx.ENVS.light, life: 9999 }); } catch (e) { /* decals are optional */ }
  yield c.wait(1.6);
  const orin = c.actor('orin', 'orin', 880, 70, { name: 'Orin', glow: 28, color: '#ff9a4a' });
  yield c.walk(orin, 930, 40, 40);
  yield* c.convo([
    ['seren', 'The city stands. We owe you everything.'],
    ['orin', 'Captain. Captain! The fountain. It is not leaking. It is humming.'],
    ['mira', '...Something has been awakened underneath Veyra.'],
    ['orin', 'There are stairs. Under the basin. They are older than the city.'],
  ]);
  c.remove(orin);
  yield c.cine(false);
  yield* finishChapter(c, 2, `Veyra stands${L.city === 'tower-lost' ? ', though its central tower has fallen' : ''}. ${G.ld.civSaved || 'Many'} civilians reached shelter. Tomas died at the gate. Bram's arm is broken and he will rest for the next chapter. Something under the fountain is humming.`);
};

/* ---------- IV · The Undercity ---------- */
function buildChamber() {
  biomeOverride = () => 'grave'; resetWorldCache();
  scnBlock(4600, -300, 5500, 300);
  scnGround(4620, -260, 840, 520, [[4620, -260, 840, 520, '#14121c', ['#0e0c14', '#1e1a2a']], [4800, -80, 420, 160, '#2a2638', ['#1c1828', '#3a3650']]], 61);
  const E = G.ld.place = { engine: scnAdd(cached('engine-dark', () => makeEngine(false)), 5000, -10, { solids: [[0, -2, 24]], name: 'Dawn Engine' }) };
  for (const [x, y] of [[4800, -120], [5200, -120], [4800, 120], [5200, 120], [4720, 0], [5280, 0]]) scnProp('column', x, y, 8);
  for (const [x, y] of [[4860, -60], [5140, -60], [4860, 80], [5140, 80]]) scnProp('brazier', x, y, 4);
  return E;
}
const undercityOpening = function* (c) {
  Cine.fade = 1;
  yield c.cine(true);
  yield c.cam(950, 0, 0.1);
  // the stairs under the fountain
  c.party(930, 70, { gap: 20 });
  const orin = c.actor('orin', 'orin', 960, 60, { name: 'Orin', glow: 26, color: '#ff9a4a' });
  c.snap(950, 20); c.music(3);
  yield c.fade(0, 2.4);
  yield c.title('IV · The Undercity', 'Older than the city above it.');
  yield* c.convo([
    ['orin', 'The basin lifts on a counterweight. Nobody has pulled that lever in a thousand years.'],
    ['mira', 'And yet the stone is clean. Something has been tending these stairs.'],
    ['kael', 'Great. Great! Love a haunted staircase.'],
    ['bram', 'Mind the edge. I can manage the steps, one-handed.'],
  ]);
  c.remove(orin);
  yield c.fade(1, 1.2);
  yield c.cine(false);
};
const undercityPlay = function* (c) {
  const L = LDS();
  c.objective('Descend into the Undercity');
  Camp.skipping = false;
  G.ld.cryptPlan = { murals: [
    { dx: 90, lines: [['mira', 'A sun held in chains. They built it to be held, not to hang.'], ['orin', 'The script is older than Veyra. Older than the road.']] },
    { dx: 420, lines: [['orin', 'Five keys. Five shards. This mural shows a lock.'], ['mira', 'A lock, not a lantern. The Engines were never lamps.']] },
    { dx: 740, lines: [['mira', '"We kindled the Engines to keep the Dark outside. We did not know it was already listening."'], ['elara', 'It is warm. The writing is warm.']] },
    { dx: 1090, lines: [['elara', 'A figure in black before the Engine. He is not fighting it. He is guarding it.'], ['orin', 'Whoever he was, he stood here for a very long time.']] },
  ], onEnter() { D.noDeeper = true; banner('The Undercity', 'Strike every lever to open the gate', '#e8742c'); } };
  G.ld.cryptDone = false;
  setTimeout(() => enterCrypt(null, 'temple', { id: 'undercity' }), 400);
  yield c.wait(0.6);
  yield c.until(() => G.ld.cryptDone);
  Cine.fade = 1;
  // the Dawn Engine
  const E = buildChamber();
  c.teleport(4800, 0);
  yield c.cine(true);
  c.snap(4900, 0);
  c.party(4800, 20, { gap: 20 });
  const orin = c.reg('orin', c.actor('orin', 'orin', 4770, 30, { name: 'Orin', glow: 24, color: '#ff9a4a' }));
  yield c.all(c.fade(0, 2), c.cam(5000, 0, 3, 'out'));
  c.sky({ tint: 0.12 });
  yield c.say('narrator', 'Below the city, past the last locked gate, stood the first Dawn Engine.', { auto: true });
  yield c.wait(0.5);
  yield* c.convo([
    ['mira', 'This wasn\'t built to create sunlight.'],
    ['elara', 'Then what was it built for?'],
    ['mira', 'To keep something out.'],
  ]);
  yield c.wait(1.8);
  yield c.say('kael', '...What did we just wake up?');
  c.shake(7, 2); c.sfx('rumble');
  const w = c.boss('warden', 5000, -150);
  c.music(2);
  yield c.all(c.zoom(1.2, 1), c.camTo(w, 1));
  yield c.wait(1.2);
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  c.objective('Defeat the Warden');
  yield c.bossDead(w);
  c.endBoss(w); L.bosses.warden = true;
  yield c.cine(true);
  c.music(3);
  yield c.all(c.camTo(w, 1), c.zoom(1.3, 1));
  c.explode(w.x, w.y, 50);
  yield c.wait(1.4);
  yield c.cam(5000, -10, 1);
  // the first shard
  E.engine.spr = cached('engine-lit', () => makeEngine(true));
  c.flash('#ffd35a', 1.2); c.shake(4, 1);
  yield c.walk(ME, 5000, 60, 28);
  yield c.say('narrator', 'A Dawn Shard rose from the Engine\'s heart and hung in the air, waiting.', { auto: true });
  c.shard(1);
  yield c.flash('#e27bf0', 0.8);
  // the vision
  yield c.fade(1, 0.6);
  c.snap(5000, -20);
  const knight = c.actor('vk', 'ashenBare', 5030, -20, { name: 'The Ashen Knight', glow: 20, color: '#f2eee6', face: -1 });
  const me2 = c.actor('ve', charFrames('elara'), 4980, -20, { name: 'Elara' });
  const keepPos = [ME.x, ME.y]; ME.x += 1500;
  yield c.fade(0, 1.2);
  yield c.zoom(1.5, 1);
  yield* c.convo([['voice', 'You have stood here before, Elara.'], ['elara', 'I have never...'], ['voice', 'Beside me. At the end. You always do.']]);
  c.remove(knight); c.remove(me2); ME.x = keepPos[0]; ME.y = keepPos[1];
  yield c.flash('#ffffff', 0.8);
  yield c.fade(0, 0.1);
  yield c.zoom(1, 0.8);
  yield c.wait(0.6);
  c.rel('kael', 0);
  yield* c.convo([
    ['kael', 'Elara. Elara! You went somewhere.'],
    ['elara', 'I saw myself. Standing beside the Ashen Knight.'],
    ['mira', '...Then it is true. He knows you, and you have never met him.'],
    ['orin', 'The Engine is dark again. But there are four more shards. I can feel the pattern of them.'],
  ]);
  c.sky({ tint: 0 });
  yield c.cine(false);
  L.choices.orinJoined = true;
  yield* finishChapter(c, 3, `The first Dawn Shard is yours. The Warden is destroyed, Orin travels with you now, and you have seen yourself standing beside the one who hunts you.`);
};

STORY.push(
  { id: 'ch3', title: 'III · Veyra', sub: 'The raid on the city', blurb: 'A city of thousands, a gate that will not hold, and a monster that eats buildings.', goal: () => Camp.objective, pointers() {}, build: () => buildVeyra(), opening: veyraOpening, play: veyraPlay },
  { id: 'ch4', title: 'IV · The Undercity', sub: 'Beneath the fountain', blurb: 'Murals, levers, traps and a mechanical guardian. What was this place built to keep out?', goal: () => Camp.objective, pointers() {}, build: () => buildVeyra({ burned: true }), opening: undercityOpening, play: undercityPlay },
);
