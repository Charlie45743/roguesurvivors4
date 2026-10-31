'use strict';
/* THE LAST DAWN, chapters V to VIII: the long walk, the fall of Veyra, the Ashen Knight's truth, and the Black Sun. */

function scaleSprite(spr, k) {
  const c = document.createElement('canvas'); c.width = spr.w * k; c.height = spr.h * k;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(spr.c, 0, 0, c.width, c.height);
  return { c, w: c.width, h: c.height, sil: {}, meta: { glows: spr.meta.glows.map(([x, y, col]) => [x * k, y * k, col]), smoke: [], top: 0 } };
}
// The party gathers around a fire: everyone walks to a place on the ring and turns inward
function* gather(c, x, y, o = {}) {
  const ring = [ME, ...allyList().filter(a => a.key && !a.down)];
  ring.forEach((p, i) => { const a = i / ring.length * TAU + 0.5; p.goal = { x: x + Math.cos(a) * 34, y: y + 6 + Math.sin(a) * 24, spd: 46 }; });
  yield c.until(() => ring.every(p => !p.goal));
  for (const p of ring) c.face(p, x - p.x < 0 ? -1 : 1);
}
function* rest(c, x, lines) { yield c.cine(true); yield c.cam(x, 0, 1.2); c.zoom(1.3, 1.4); yield* gather(c, x, 0); yield* c.convo(lines); yield c.cine(false); }

/* ---------- V · Five Wanderers ---------- */
function buildWilds() {
  biomeOverride = x => (x < 900 ? 'moss' : x < 1900 ? 'ash' : x < 2800 ? 'grave' : 'bog'); resetWorldCache();
  scnBlock(-140, -40, 3600, 40);
  scnGround(-160, -26, 3800, 52, [[-160, -26, 3800, 52, ...DIRT]], 71);
  const W5 = G.ld.place = { camps: [800, 1750, 2650] };
  for (const x of W5.camps) { scnProp('brazier', x, 0, 5); for (const [dx, dy] of [[-48, -52], [50, -48], [-40, 56]]) scnProp('bench', x + dx, dy, 0); scnProp('tent', x + 80, -64, 14); scnProp('crate', x - 70, 50, 5); }
  for (const x of [300, 1250, 2200, 3000]) { scnProp('skullpost', x, -34, 3); scnProp('banner', x + 120, 40, 3); }
  // the drowned shrine
  scnGround(3140, -150, 420, 300, [[3140, -150, 420, 300, '#10202c', ['#0c1820', '#1a3a4c']]], 72);
  for (const [x, y] of [[3200, -100], [3200, 100], [3340, -120], [3340, 120], [3480, -100], [3480, 100]]) scnProp('column', x, y, 8);
  W5.altar = scnProp('statue', 3340, -10, 8);
  scnProp('brazier', 3280, 0, 4); scnProp('brazier', 3400, 0, 4);
}
const wildsOpening = function* (c) {
  Cine.fade = 1;
  yield c.cine(true);
  c.party(0, 0, { gap: 22 });
  const orin = c.reg('orin', c.who('orin'));
  const seren = c.actor('seren', 'seren', -80, 4, { name: 'Seren' }), lyra = LDS().rescued.includes('Lyra') ? c.actor('lyra', 'lyra', -100, 18, { name: 'Lyra' }) : null;
  c.snap(-40, 0); c.music(3);
  yield c.fade(0, 2); yield c.title('V · Five Wanderers', 'Five shards. Five people. One road.');
  yield* c.convo([
    ['seren', 'Veyra will keep the lamps burning for you. Come back, and tell us what the sun looks like.'],
    ['elara', 'If it comes back, you will not need me to tell you.'],
  ].concat(lyra ? [['lyra', 'I made you something. It is a bad drawing of a sunrise. Please do not laugh.']] : []));
  c.remove(seren); if (lyra) c.remove(lyra);
  c.party(0, 0, { walk: true, spd: 36 });
  yield c.wait(1.4);
  yield c.cine(false);
};
const wildsPlay = function* (c) {
  const L = LDS(), W5 = G.ld.place;
  const strike = (types, n) => c.wave(types, n, [[ME.x + 320, rand(-80, 80)], [ME.x + 320, rand(-80, 80)]], { gap: 0.5, ai: false });
  c.objective('Walk the long road'); c.point(3200, 0);
  // Kael
  yield c.reachX(300);
  c.bark('kael', 'Orin, is it true engineers dream in gears?', 3.4); yield c.wait(3.8);
  c.bark('orin', 'Only the good ones. The bad ones dream of paperwork.', 3.4); yield c.wait(3.8);
  yield c.reachX(640); strike(['wraith', 'skel', 'ghoul'], 10); yield c.clear(1);
  yield* rest(c, 800, [
    ['kael', 'You ever think about what you\'ll do if the sun comes back?'],
    ['elara', 'No.'],
    ['kael', 'Why?'],
    ['elara', 'Because I\'ve never seen tomorrow.'],
    ['kael', '...Right. I had a brother, you know. Tarn. He used to say the first thing he would do is lie in a field and let it burn his face.'],
    ['kael', 'He was fourteen on the first night. I told him to stay behind me. He did, for a while.'],
    ['bram', 'You never said.'],
    ['kael', 'I am saying now. Do not make it weird.'],
    ['bram', 'I would never.'],
    ['kael', 'You are already making it weird.'],
  ]);
  c.rel('kael', 1);
  // Mira
  c.objective('Walk the long road'); c.point(3200, 0);
  yield c.reachX(1300);
  c.bark('mira', 'The old stones here were set by the Keepers. See how they face the same way?', 4); yield c.wait(4.4);
  yield c.reachX(1650); strike({ ghoul: 2, wraith: 2, bat: 3 }, 12); yield c.clear(1);
  yield* rest(c, 1750, [
    ['kael', 'Mira. You know more about this than you say.'],
    ['mira', 'I know what I was taught.'],
    ['kael', 'By whom?'],
    ['mira', 'By the Keepers. I was one. The order that tended the Dawn Engines before they went silent.'],
    ['kael', 'And you did not think to mention it, say, in Haven?'],
    ['mira', 'I was ashamed. We kept the lamps lit for three hundred years, and when the sun went out we ran.'],
    ['bram', 'Everyone runs the first time.'],
    ...(L.choices.abandoned ? [['mira', 'I have not forgiven myself for running. I have not forgiven you for the camp, Elara. But I will walk with you.'], ['elara', 'That is fair.']] : [['mira', 'Elara. At the camp, you stopped. That is why I stayed.'], ['elara', 'It was the only choice I could live with.']]),
  ]);
  c.rel('mira', 1);
  // Bram and Orin
  c.objective('Walk the long road'); c.point(3200, 0);
  yield c.reachX(2350);
  strike({ skel: 3, ghoul: 2, wraith: 2 }, 14); yield c.clear(1);
  yield* rest(c, 2650, [
    ['bram', 'You want that sword fixed?'],
    ['elara', 'Can you?'],
    ['bram', 'I can fix anything.'],
    ['kael', 'Except your personality.'],
    ['bram', 'I can fix that too.'],
    ['orin', 'I used to build clocks, you know. Before the engines. Everything I made, I made to be wrong less often.'],
    ['mira', 'And now?'],
    ['orin', 'Now I think the only thing worth building is a way to see the morning.'],
    ['elara', 'My mother had a lantern. I remember its light on her hands. That is all I remember of her.'],
    ['elara', 'I think I have been looking for that light ever since.'],
  ]);
  G.pending++; banner('Bram reforges your weapon', 'Choose an upgrade', '#e0707a'); Snd.play('evolve');
  c.rel('bram', 1);
  // the drowned shrine
  c.objective('Reach the Drowned Shrine'); c.point(3300, 0);
  yield c.reachX(3120);
  yield c.cine(true);
  c.music(3);
  yield c.all(c.cam(3340, 0, 2), c.zoom(1.2, 2));
  const kn = c.actor('ashen', 'ashen', 3640, -170, { name: 'Ashen Knight', sc: 1.4, glow: 34, color: '#e8742c', face: -1 });
  yield c.wait(1.2);
  yield c.cam(3640, -150, 1.6);
  yield* c.convo([['kael', 'There. On the ridge. Is that...'], ['elara', 'He is only watching.'], ['mira', 'He has been watching since Haven.']]);
  yield c.walk(kn, 3760, -240, 26);
  c.remove(kn);
  yield c.all(c.cam(3340, 0, 1.4), c.zoom(1, 1));
  c.shake(5, 1.2); c.sfx('rumble');
  const b = c.boss('gTide', 3340, -20);
  c.music(2);
  yield c.cine(false);
  c.objective('Defeat the Guardian of Tide');
  yield c.bossDead(b);
  c.endBoss(b); L.bosses.gTide = true;
  yield c.cine(true);
  yield c.all(c.camTo(b, 1), c.zoom(1.3, 1));
  c.explode(b.x, b.y, 50);
  yield c.wait(1.2);
  c.shard(2);
  yield* c.convo([['orin', 'Two of five. The pattern is a ring. I think they sit around a door.'], ['kael', 'Then let\'s find the door.'], ['elara', 'The sun is on the other side of it.']]);
  yield c.cine(false);
  yield* finishChapter(c, 4, 'The second Dawn Shard is yours. Around the fires you learned who Kael lost, what Mira hid, why Bram builds, and who Elara has been looking for. A figure in black armour watched from the ridge.');
};

/* ---------- VI · The Fall of Veyra ---------- */
function raiseArmy(x, y) {
  const L = LDS(), list = [];
  for (let i = 0; i < 6; i++) list.push(unit('guard', x - 30 + (i % 3) * 18, y - 20 + Math.floor(i / 3) * 40));
  for (let i = 0; i < 4; i++) list.push(unit('gbow', x - 50, y - 40 + i * 26));
  L.rescued.forEach((n, i) => {
    if (i % 4 === 2) { const a = C.actor('rp' + i, 'survivor', x - 70, y - 30 + i * 12, { name: n, civ: true, hp: 80 }); a.repair = true; a.label = n; list.push(a); }
    else { const u = unit(i % 4 === 1 ? 'sbow' : 'sfight', x - 70, y - 30 + i * 12, { name: n }); u.noLose = n === 'Lyra'; list.push(u); }
  });
  return list;
}
let c0 = null;
const fallOpening = function* (c) {
  c0 = c;
  Cine.fade = 1;
  yield c.cine(true);
  const L = LDS();
  c.party(-420, 0, { gap: 22 });
  c.snap(-300, 0); c.music(3); c.sky({ tint: 0.14, tintC: '120,30,20' });
  yield c.fade(0, 2.4);
  yield c.title('VI · The Fall of Veyra', L.choices.saved ? 'Some of the city remembers you.' : 'The city does not know your name.');
  yield c.all(c.cam(300, 0, 4, 'inout'));
  yield* c.convo([['kael', 'It is on fire.'], ['bram', 'They were counting on us coming back.'], ['orin', 'The bells. Listen to the bells.']]);
  c.sfx('bell'); yield c.wait(1.1); c.sfx('bell');
  yield c.cam(-300, 0, 1.4);
  yield c.cine(false);
};
const fallPlay = function* (c) {
  c0 = c;
  const V = G.ld.place, L = LDS();
  scnCollapse(V.gate, { rubble: true, shake: 0 });
  const seren = c.reg('seren', unit('seren', -120, 0, { key: 'seren', name: 'Seren' }));
  const army = raiseArmy(-150, 0);
  // stage 1: the outer walls
  c.objective('Hold the outer walls'); c.point(0, 0);
  const walls = [-70, 0, 70].map(y => scnAdd(prop('palisade'), -40, y + 8, { solids: [[0, -2, 8]], hp: 320, tgt: true, name: 'Wall' }));
  c.bar('walls', 'Outer wall', () => walls.reduce((s, p) => s + (p.fallen ? 0 : p.hp), 0) / 960, '#e8742c');
  for (const a of army) if (a.type) a.post = { x: -90 + rand(-14, 14), y: rand(-90, 90), leash: 50 };
  yield c.reachX(-200, 1);
  const west = [[-520, -80], [-520, 0], [-520, 80]];
  c.bark('seren', 'Walls! Hold the walls! Archers, loose at will!', 3);
  c.wave(['ghoul', 'skel', 'bat'], 16, west, { gap: 0.5 }); yield c.clear(0);
  c.bark('kael', 'There is a second group on the north side!', 2.6);
  c.wave(['wraith', 'ghoul', 'skel'], 20, west.concat([[-300, -260]]), { gap: 0.4 }); yield c.clear(1);
  c.bar('walls');
  // stage 2: the gate district, three siege captains
  c.objective('Break the siege captains'); c.point(300, 0);
  for (const a of army) if (a.type) a.post = null;
  const caps = [[300, -110], [380, 100], [460, 0]].map(([x, y], i) => { const e = spawnEnemy('knight', x, y, { hpMul: 0.45 }); e.elite = true; e.siege = true; e.captain = true; e.rise = 0; return e; });
  c.bar('caps', 'Siege captains', () => caps.filter(e => !e.dead).length / 3, '#d8354a');
  c.bark('seren', 'Their captains are driving this! Take them down!', 3);
  c.wave(['ghoul', 'skel', 'bat'], 18, [[120, -50], [120, 50]], { gap: 0.6 });
  yield c.until(() => LDFAST ? (caps.forEach(e => (e.dead = true)), true) : caps.every(e => e.dead));
  c.bar('caps'); clearFoes();
  // stage 3: the market, an escort
  c.objective('Escort the civilians through the market'); c.point(1160, 0);
  const crowd = c.crowd(14, 760, 0, 50, { keys: ['refugee', 'refugee2', 'survivor', 'villager2'], civ: true });
  for (const a of crowd) { a.hp = a.maxHp = 50; a.escapeTo = { x: 1230, y: 0 }; a.goal = null; }
  c.bar('esc', 'Civilians safe', () => G.ld.civSaved / 14, '#a6e05a');
  const mover = () => { for (const a of crowd) if (!a.gone && !a.goal && a.alpha > 0.9 && a.hp > 0) a.goal = { x: 1230, y: rand(-8, 8), spd: 26 + rand(0, 8) }; };
  c.later(1, function pump() { mover(); if (!Camp.gen) return; c.later(2, pump); });
  yield c.reachX(840);
  c.bark('kael', 'Left side!', 1.8); c.wave(['ghoul', 'wraith', 'bat'], 18, [[760, -280], [760, 280], [1000, -280]], { gap: 0.5 });
  yield c.clear(2);
  c.wave(['ghoul', 'skel'], 12, [[700, -200], [700, 200]], { gap: 0.4 });
  yield c.clear(1);
  yield c.until(() => LDFAST || crowd.every(a => a.gone || a.hp <= 0 || a.dead));
  c.bar('esc');
  if (!L.choices.saved && !seren.down) { /* without the survivors she holds the street alone */ }
  // stage 4: the residential district, three nests
  c.objective('Burn the three nests'); c.point(1180, 0);
  let burned = 0; const nests = [[1120, -170], [1180, 160], [1230, 10]];
  c.bar('nest', 'Nests burned', () => burned / 3, '#e8742c');
  nests.forEach(([x, y]) => {
    const p = scnProp('skullpost', x, y, 3, { name: 'Nest' });
    const sp = c.spot(x, y, 'Burn the nest', () => { burned++; scnCollapse(p, { rubble: true, shake: 4 }); c.explode(x, y, 36); }, { r: 30, color: '#e8742c' });
    const loop = () => { if (sp.off || !Camp.gen) return; c.wave(['ghoul', 'crawler'], 3, [[x, y]], { gap: 0.3, ai: false }); c.later(5, loop); };
    c.later(1, loop);
  });
  c.bark('mira', 'The nests are in the houses! Burn them before they spread!', 3.4);
  yield c.until(() => LDFAST ? (burned = 3, Spots.forEach(s => (s.off = true)), true) : burned >= 3);
  c.bar('nest'); clearFoes();
  // stage 5: the palace
  c.objective('Storm the palace'); c.point(1560, -150);
  yield c.cine(true);
  yield c.all(c.cam(1500, -80, 1.6), c.zoom(1.15, 1.6));
  c.music(2); c.sfx('rumble');
  const champ = c.boss('champion', 1500, -40);
  yield* c.convo([['seren', 'The Royal Champion. He fell on the first night and never stopped walking.'], ['elara', 'Everyone with me!']]);
  for (const a of allyList()) a.post = null;
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  yield c.bossDead(champ);
  c.endBoss(champ);
  const vault = c.spot(1560, -100, 'Open the vault', () => { vault.open = true; }, { r: 34 });
  c.objective('Open the palace vault');
  yield c.until(() => LDFAST ? (vault.off = true, vault.open = true) : vault.open);
  yield c.cine(true);
  yield c.all(c.cam(1560, -100, 1), c.zoom(1.3, 1));
  c.flash('#ffd35a', 1);
  c.shard(3); yield c.wait(1.2); c.shard(4);
  yield* c.convo([['orin', 'Two at once. Four of five.'], ['mira', 'The last one is not in a vault. It is in a person.']]);
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  // stage 6: the central tower
  c.objective('Reach the central tower'); c.point(1400, 0);
  yield c.reachX(1300);
  yield c.cine(true);
  yield c.all(c.cam(1400, 0, 1.4), c.zoom(1.2, 1.4));
  c.sfx('roar'); c.shake(8, 1.4);
  const regent = c.boss('regent', 1400, 90);
  c.music(2);
  yield* c.convo([['bram', 'LEFT SIDE!'], ['kael', 'I SEE THEM!'], ['mira', 'Elara! The tower!'], ['elara', 'Everyone with me!']]);
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  c.wave(['ghoul', 'wraith', 'bat'], 16, [[1250, -240], [1250, 240], [1550, 240]], { gap: 0.6 });
  yield c.bossDead(regent);
  c.endBoss(regent);
  clearFoes();
  // the city falls, but not its people
  const kept = L.rescued.length;
  L.evacuated = 40 + kept * 12 + (G.ld.civSaved || 0);
  L.city = 'fallen';
  yield c.cine(true);
  c.music(3);
  yield c.all(c.cam(900, 0, 2), c.zoom(1.1, 2));
  const evac = c.crowd(26, 960, 0, 70, { keys: ['refugee', 'refugee2', 'survivor', 'villager2'] });
  yield c.all(...evac.map(a => c.walk(a, -200 + rand(-30, 30), rand(-60, 60), 42 + rand(0, 14))));
  for (const [i, p] of V.houses.entries()) if (i % 3 === 0 && !p.fallen) { c.later(rand(0, 2.4), () => scnCollapse(p, { shake: 5 })); }
  if (!L.choices.saved) {
    c.later(0.2, () => { burst(seren.x, seren.y, '#d8354a', 20, 80); });
    L.dead.seren = true; seren.gone = true;
    yield* c.convo([['seren', 'I was never going to leave. Someone has to hold the last door. Go.'], ['elara', 'Seren!'], ['kael', 'She is gone. We have to move.']]);
  } else {
    yield* c.convo([['seren', 'Lyra, the children first. Everyone else, with me. We will find somewhere to rebuild.'], ['lyra', 'We will be waiting for you, Elara.'], ['elara', 'The sun will find you.']]);
  }
  for (const a of evac) c.remove(a);
  yield c.cine(false);
  yield* finishChapter(c, 5, `Veyra is lost, but ${L.evacuated} of its people got out alive${L.choices.saved ? `, led by the survivors you saved on the road` : ', though without the help you might have had'}. You carry four Dawn Shards.`);
};

/* ---------- VII · The Ashen Knight ---------- */
function buildSanctum() {
  biomeOverride = () => 'ash'; resetWorldCache();
  scnBlock(5800, -320, 6700, 320);
  scnGround(5820, -280, 860, 560, [[5820, -280, 860, 560, '#16121a', ['#0e0b12', '#241e2e']], [5980, -120, 540, 240, '#2a2638', ['#1c1828', '#3a3650']]], 81);
  const S = G.ld.place = { engine: scnAdd(cached('engine-dark', () => makeEngine(false)), 6250, -20, { solids: [[0, -2, 24]], name: 'Dawn Engine' }) };
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; scnProp('column', 6250 + Math.cos(a) * 190, -10 + Math.sin(a) * 120, 8); }
  for (const [x, y] of [[6080, -80], [6420, -80], [6080, 80], [6420, 80]]) scnProp('brazier', x, y, 4);
  scnProp('statue', 6250, -140, 8); scnProp('rubble', 6100, 140, 0); scnProp('rubble', 6400, 150, 0);
  return S;
}
const ashenOpening = function* (c) {
  Cine.fade = 1;
  yield c.cine(true);
  c.party(5900, 20, { gap: 22 });
  c.snap(6000, 0); c.music(3);
  yield c.fade(0, 2.2);
  yield c.title('VII · The Ashen Knight', 'Everything he let you survive, he did for a reason.');
  yield c.all(c.cam(6250, 0, 3, 'inout'));
  yield* c.convo([['orin', 'That is a Dawn Engine. A whole one. Nobody has touched it in centuries.'], ['mira', 'Someone has. Look at the floor. The dust is swept.']]);
  const kn = c.actor('ashen', 'ashen', 6250, -90, { name: 'Ashen Knight', sc: 1.4, glow: 34, color: '#e8742c' });
  yield c.cam(6150, -30, 1.6);
  yield c.walk(kn, 6130, 6, 20);
  c.sfx('warn');
  yield* c.convo([['kael', 'Elara, behind me.'], ['elara', 'No. He has had a hundred chances. He is not here to kill me.']]);
  yield c.zoom(1.5, 1.2);
  yield* c.convo([['ashen', 'You came. You always do.']]);
  // he lowers his helm
  kn.frames = NPC_SPR.ashenBare; c.sfx('select'); burst(kn.x, kn.y - 8, '#f2eee6', 12, 40);
  yield c.wait(1);
  yield* c.convo([
    ['ashenBare', 'I am older than your city. I was a guardian of this Engine when the Keepers were still children.'],
    ['mira', 'The old texts speak of a Sentinel. A guard who did not sleep.'],
    ['ashenBare', 'I did not steal the sun. I did not kill it. I sealed it away.'],
    ['elara', 'I didn\'t kill the sun.'],
    ['ashenBare', 'I didn\'t kill the sun.'],
    ['elara', 'Then why is the world dark?'],
    ['ashenBare', 'Because I was afraid of what would come through if I didn\'t.'],
    ['elara', 'What?'],
  ]);
  c.sky({ on: true, crack: 0 });
  yield c.zoom(1, 1);
  yield c.say('ashenBare', 'Look up.');
  c.sfx('crack'); G.shake = 8;
  yield tween(Cine.sky, 'crack', 1, 2.4, 'out');
  c.shake(8, 2); c.sfx('crack');
  yield c.wait(0.6);
  yield tween(Cine.sky, 'eye', 1, 2.4, 'out');
  yield* c.convo([['kael', 'Something is moving behind the sky.'], ['mira', 'It is not a monster. It is the thing the monsters come from.']]);
  yield c.flash('#e27bf0', 0.8);
  c.shake(10, 1.6);
  yield c.cine(false);
};
const ashenPlay = function* (c) {
  const L = LDS(), S = G.ld.place;
  const ashen = c.reg('ashen', unit('ashenAlly', 6190, 4, { key: 'ashenally', name: 'The Ashen Knight' }));
  ashen.frames = NPC_SPR.ashenBare;
  c.objective('Fight beside the Ashen Knight');
  c.sky({ on: true, crack: 1, eye: 1 });
  const b = c.boss('veil', 6250, -230);
  c.music(2);
  c.bar('ashen', 'The Ashen Knight', () => ashen.hp / ashen.maxHp, '#e8742c');
  // he stands in front of Elara when she is hurt, and it costs him each time
  let cool = 0;
  const guard = () => {
    if (b.dead || !Camp.gen) return;
    cool -= 0.5;
    if (!ashen.gone && ME.hp < ME.maxHp * 0.4 && cool <= 0) {
      cool = 8;
      ME.hp = Math.min(ME.maxHp, ME.hp + ME.maxHp * 0.4); ashen.hp = Math.max(260, ashen.hp - ashen.maxHp * 0.2);
      G.fx.push({ k: 'ring', x: ME.x, y: ME.y, t: 0, dur: 0.5, r: 60, c: '#e8742c' }); Snd.play('heal');
      pushBark('ashenBare', pick(['BEHIND ME!', 'Not her. Never her.', 'Stay close. I will hold it.']), 2.4);
    }
    ashen.hp = Math.max(ashen.hp, 200);
    c.later(0.5, guard);
  };
  c.later(1, guard);
  yield c.bossBelow(b, 0.3);
  // mortally wounded
  yield c.cine(true);
  const brain = b.ai; b.ai = () => {};
  yield c.all(c.camTo(ashen, 0.8), c.zoom(1.5, 1));
  c.sfx('hurt'); ashen.down = true; c.explode(ashen.x + 10, ashen.y, 20);
  yield c.wait(0.8);
  yield* c.convo([['ashenBare', 'Now...'], ['elara', 'No. No, you stay with me.'], ['ashenBare', '...finish what I couldn\'t.']]);
  c.shard(5);
  yield c.flash('#ffd35a', 1);
  for (let i = 0; i < 30; i++) addPart(ashen.x + rand(-6, 6), ashen.y + rand(-10, 4), rand(-20, 20), rand(-60, -10), rand(0.8, 1.6), pick(['#e8742c', '#ffd35a', '#f2eee6']), 2);
  c.bar('ashen');
  ashen.gone = true; L.dead.ashen = true;
  yield c.wait(1.4);
  yield* c.convo([['mira', 'He kept it for a thousand years.'], ['kael', 'Elara. It is still coming. We have to finish this.']]);
  b.ai = brain;
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  c.objective('Destroy the Veilbreaker');
  yield c.bossDead(b);
  c.endBoss(b); L.bosses.veil = true;
  clearFoes();
  yield c.cine(true);
  c.music(3);
  c.explode(b.x, b.y, 80);
  yield tween(Cine.sky, 'eye', 0, 2, 'out');
  yield tween(Cine.sky, 'crack', 0.35, 2, 'out');
  yield c.wait(1.2);
  yield* c.convo([['orin', 'Five shards. All five.'], ['elara', 'The Ashen Knight is gone.'], ['bram', 'He kept his word, in his own way.'], ['mira', 'The sky is still black. The Engine can answer it, but we need an army to carry us there.']]);
  yield c.cine(false);
  yield* finishChapter(c, 6, 'The Ashen Knight was never your enemy. He guarded the sun for a thousand years, and gave you the last shard with his final breath. You now hold all five.');
};

/* ---------- VIII · The Black Sun ---------- */
function buildBattlefield() {
  biomeOverride = () => 'grave'; resetWorldCache();
  scnBlock(8700, -420, 9700, 420);
  scnGround(8720, -380, 960, 760, [[8720, -380, 960, 760, '#120f18', ['#0c0a12', '#201a2a']], [9100, -160, 400, 320, '#241f32', ['#181426', '#352f48']]], 91);
  const B = G.ld.place = { engine: scnAdd(scaleSprite(cached('engine-dark', () => makeEngine(false)), 2), 9300, 20, { solids: [[0, -4, 44]], hp: 600, tgt: false, name: 'The Dawn Engine' }) };
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; scnProp('column', 9300 + Math.cos(a) * 280, 10 + Math.sin(a) * 180, 8); }
  for (const [x, y] of [[9120, -110], [9480, -110], [9120, 130], [9480, 130]]) scnProp('brazier', x, y, 4);
  return B;
}
const blackOpening = function* (c) {
  c0 = c;
  Cine.fade = 1;
  yield c.cine(true);
  const L = LDS();
  c.party(8860, 0, { gap: 22 });
  // the army gathers
  const army = [];
  for (let i = 0; i < 12; i++) army.push(c.actor('sd' + i, i % 3 ? 'guard' : 'guardbow', 8800 - (i % 4) * 18, -90 + Math.floor(i / 4) * 80 + (i % 4) * 8, { name: 'Soldier' }));
  const names = L.rescued.length ? L.rescued : [];
  names.forEach((n, i) => army.push(c.actor('sv' + i, 'survivor', 8780 - (i % 3) * 14, -60 + i * 22, { name: n })));
  for (let i = 0; i < 10; i++) army.push(c.actor('rf' + i, i % 2 ? 'refugee' : 'refugee2', 8740 - (i % 3) * 14, -120 + i * 24, { name: 'Veyran' }));
  c.snap(8800, 0); c.music(3);
  yield c.fade(0, 2.4);
  yield c.title('VIII · The Black Sun', 'Thirty-seven days. Tonight, it ends.');
  yield c.all(c.cam(9040, 0, 5, 'inout'), c.zoom(1.05, 5));
  yield c.wait(0.4);
  const B = G.ld.place;
  yield c.cam(9300, 20, 3, 'inout');
  yield c.wait(1);
  yield* c.convo([['bram', 'Look at it. A whole Engine.'], ['kael', 'Look at all of them.'], ['orin', 'It needs time to charge. A few minutes, if we are very lucky.'], ['mira', 'We will not be lucky.']]);
  yield c.cam(8960, 0, 2.2);
  c.sfx('rumble');
  c.sky({ on: true, crack: 1 });
  yield c.wait(0.6);
  c.sfx('crack'); c.shake(9, 2);
  yield tween(Cine.sky, 'sun', 1, 5, 'inout');
  c.flash('#e8742c', 1.2);
  yield* c.convo([['elara', 'Hold the line. Whatever happens, hold the line until the Engine wakes.'], ['kael', 'Thirty-seven days, Elara.'], ['elara', 'Thirty-eight, if we are good.']]);
  for (const a of army) c.remove(a);
  yield c.cine(false);
};
const blackPlay = function* (c) {
  c0 = c;
  const B = G.ld.place, L = LDS(), E = B.engine;
  c.sky({ on: true, crack: 1, sun: 1 });
  const army = raiseArmy(8860, 0);
  for (const a of army) if (a.type) a.post = null;
  // stage 1: through the armies
  c.objective('Fight through the enemy armies'); c.point(9100, 0);
  const push = (x, types, n, hp = 1) => { c.wave(types, n, [[x + 300, -120], [x + 300, 0], [x + 300, 120]], { gap: 0.35, hpMul: hp }); };
  yield c.reachX(8900); c.bark('bram', 'HERE THEY COME!', 2.2); push(8900, ['ghoul', 'skel', 'bat', 'wraith'], 26);
  yield c.clear(2);
  yield c.reachX(9000); c.bark('kael', 'There are more of them than stars!', 2.8); push(9000, ['ghoul', 'wraith', 'stalker'], 28, 1.1);
  yield c.clear(2);
  yield c.reachX(9080); c.wave(['knight'], 3, [[9300, -140], [9300, 140], [9360, 0]], { gap: 1, hpMul: 0.5, elite: true });
  c.bark('mira', 'Their captains! Break them and the line breaks!', 3);
  yield c.clear(0);
  // stage 2: protect the engine while it charges
  c.objective('Protect the Dawn Engine'); c.point(9300, 20);
  const orin = c.who('orin'); if (orin) { orin.post = { x: 9270, y: 70, leash: 20 }; orin.repairs = true; }
  E.tgt = true; E.hp = E.maxHp = 600;
  let charge = 0; const CHG = LDFAST ? 2 : 70;
  c.bar('chg', 'Engine charge', () => charge / CHG, '#ffd35a'); c.bar('eng', 'Dawn Engine', () => (E.fallen ? 0 : E.hp / E.maxHp), '#e8742c');
  c.later(0, function tickCharge() { if (!Camp.gen) return; if (state === 'play') charge += 0.5; c.later(0.5, tickCharge); });
  c.bark('orin', 'It is waking! I need a little longer!', 3);
  const sides = [[9300, -330], [9300, 330], [9700, 0], [8960, -200], [8960, 200]];
  const surge = () => { if (charge >= CHG || !Camp.gen) return; c.wave(['ghoul', 'wraith', 'skel', 'bat'], 10, sides, { gap: 0.45 }); c.later(11, surge); };
  surge();
  yield c.until(() => charge >= CHG);
  c.bar('chg'); c.bar('eng'); E.tgt = false;
  c.flash('#ffd35a', 1); c.sfx('chest'); c.shake(6, 1);
  c.bark('orin', 'It is awake! It needs the shards!', 3); clearFoes();
  // stage 3: five guardians
  c.objective('Defeat the five guardians');
  const guardians = [['gGale', 8960, -200], ['gTide', 9640, -200], ['gEmber', 8960, 200], ['gStone', 9640, 200], ['gDawn', 9300, -260]];
  for (const [id, x, y] of guardians) {
    yield c.cine(true);
    const g = c.boss(id, x, y, { hpMul: 0.5 });
    yield c.all(c.camTo(g, 1), c.zoom(1.2, 1));
    c.music(2); c.sfx('roar');
    yield c.wait(1.1);
    yield c.all(c.zoom(1, 0.7), c.cine(false));
    yield c.bossDead(g);
    c.endBoss(g); clearFoes();
    c.bark(pick(['kael', 'bram', 'mira']), pick(['One down.', 'Next!', 'Keep moving!']), 1.8);
    yield c.wait(1.2);
  }
  // stage 4: the Black Sun descends
  yield c.cine(true);
  c.music(3);
  yield c.all(c.cam(9300, -40, 1.6), c.zoom(1.1, 1.6));
  c.sfx('rumble'); c.shake(9, 3); c.flash('#4a2470', 1);
  c.sky({ tint: 0.22, tintC: '74,36,112' });
  yield tween(Cine.sky, 'sun', 1.5, 3, 'inout');
  yield* c.convo([['mira', 'The sun is falling.'], ['kael', 'It is not just the sun, the ground is moving!'], ['orin', 'Gravity. It is dragging everything toward the middle.']]);
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  G.ld.gravity = { ang: 0, force: 34, t: 0, period: 7 };
  c.objective('Survive the descent');
  const wavesLeft = LDFAST ? 1 : 4;
  for (let i = 0; i < wavesLeft; i++) { c.wave(['wraith', 'stalker', 'ghoul', 'bat'], 14, sides, { gap: 0.4 }); yield c.clear(2); yield c.wait(LDFAST ? 0.1 : 5); }
  clearFoes();
  // the Eclipse
  yield c.cine(true);
  c.sfx('crack'); c.flash('#ffffff', 1.4);
  const ec = c.boss('eclipse', 9300, -90, { hpMul: 0.6 + 0.04 });
  G.ld.arena = { x: 9300, y: 10, R: 360, min: 360, shrink: 0 };
  yield c.all(c.camTo(ec, 1.2), c.zoom(1.15, 1.2));
  yield* c.convo([['eclipse', 'You carried them all this way. How thoughtful. Now give me the light.'], ['elara', 'It was never yours.']]);
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  c.music(2); c.objective('Destroy the Eclipse');
  // phase 2: the arena changes
  yield c.until(() => LDFAST ? (ec.hp = ec.maxHp * 0.79, ec.phase = Math.max(ec.phase, 1), true) : ec.phase >= 1);
  G.ld.gravity = null;
  c.bark('mira', 'The ground is closing in! Stay inside the ring!', 3.2);
  G.ld.arena.shrink = 5; G.ld.arena.min = 230;
  // phase 3: it destroys the battlefield
  yield c.until(() => LDFAST ? (ec.hp = ec.maxHp * 0.59, ec.phase = Math.max(ec.phase, 2), true) : ec.phase >= 2);
  for (const p of Scn.pieces) if (!p.fallen && p.spr.h > 40 && p !== E) { c.later(rand(0.2, 2.5), () => scnCollapse(p, { shake: 6 })); }
  c.bark('bram', 'IT IS TEARING THE GROUND APART!', 2.8);
  // phase 4: inside the black sun
  yield c.until(() => LDFAST ? (ec.hp = ec.maxHp * 0.39, ec.phase = Math.max(ec.phase, 3), true) : ec.phase >= 3);
  yield c.cine(true);
  const brain = ec.ai; ec.ai = () => {};
  yield c.all(c.camTo(ec, 0.8), c.zoom(1.3, 0.8));
  c.sfx('roar'); c.flash('#ffd35a', 1.6); c.shake(10, 2);
  yield c.wait(1.2);
  yield* c.convo([['eclipse', 'COME INTO THE LIGHT.']]);
  c.teleport(9300, -40); ec.x = 9300; ec.y = -100;
  G.ld.arena = { x: 9300, y: -40, R: 250, min: 250, shrink: 0, sun: true };
  c.sky({ tint: 0.3, tintC: '232,116,44' });
  ec.ai = brain;
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  c.bark('kael', 'We are inside it! It is all fire!', 2.8);
  // phase 5: everyone helps
  yield c.until(() => LDFAST ? (ec.hp = ec.maxHp * 0.19, ec.phase = Math.max(ec.phase, 4), true) : ec.phase >= 4);
  c.sfx('warn'); c.flash('#fff3b0', 0.8);
  for (let i = 0; i < 6; i++) unit(i % 2 ? 'sfight' : 'gbow', 9300 + rand(-80, 80), -20 + rand(-60, 60));
  for (const a of allyList()) { a.hp = a.maxHp; a.down = false; }
  c.bark('kael', 'EVERYONE! ALL OF YOU! NOW!', 2.6); c.bark('mira', 'Elara, the light is with you!', 2.6); c.bark('bram', 'FOR VEYRA!', 2.4);
  yield c.until(() => ec.hp / ec.maxHp < 0.1 || ec.dead || LDFAST);
  // the engine
  yield c.cine(true);
  ec.ai = () => {};
  c.explode(ec.x, ec.y, 60);
  c.endBoss(ec); clearFoes(); G.ld.arena = null;
  yield c.all(c.cam(9300, 20, 1.4), c.zoom(1.2, 1.4));
  c.sky({ tint: 0 });
  c.teleport(9300, 90);
  yield* c.convo([['mira', 'It is wounded. It is open. Elara, the Engine!'], ['elara', 'Five shards. Five places.']]);
  yield c.cine(false);
  c.objective('Place the five Dawn Shards in the Engine');
  let placed = 0;
  for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4 * Math.PI * 0.5 + i * 0.1; const sx = 9300 + Math.cos(Math.PI * (0.15 + i * 0.175)) * 74, sy = 90 + Math.sin(Math.PI * (0.15 + i * 0.175)) * 28; c.spot(sx, sy, `Place Dawn Shard ${i + 1}/5`, () => { placed++; c.flash('#ffd35a', 0.5); Snd.play('chest'); G.shake = 4; light(sx, sy, 50, 1); }, { r: 24, color: '#ffd35a' }); }
  yield c.until(() => LDFAST ? (Spots.forEach(s => (s.off = true)), placed = 5, true) : placed >= 5);
  // the ending
  yield c.cine(true);
  c.music(0);
  yield c.all(c.cam(9300, -20, 1.2), c.zoom(1.3, 1.2));
  E.spr = scaleSprite(cached('engine-lit', () => makeEngine(true)), 2);
  c.sfx('pulse'); c.flash('#ffffff', 2.4); c.shake(5, 2);
  yield c.wait(1.6);
  Snd.music(1);
  yield c.say('narrator', 'Everything became silent.', { auto: true });
  yield c.all(tween(Cine.sky, 'sun', 0.25, 3, 'inout'), tween(Cine.sky, 'tint', 0, 2));
  c.sfx('crack'); yield c.wait(1.2);
  yield tween(Cine.sky, 'crack', 0, 2.4, 'out');
  yield c.wait(0.8);
  c.sfx('sunrise'); c.music(4);
  yield tween(Cine.sky, 'sun', 0, 1.8, 'out');
  Cine.sky.on = false;
  G.dawnT = 0.001; G.darkMul = 0.5;
  yield c.wait(4.6);
  yield c.say('narrator', 'For the first time in thirty-seven days... sunrise.', { auto: true });
  yield c.zoom(1, 1);
  const k = c.who('kael'), m = c.who('mira'), br = c.who('bram');
  yield c.all(c.cam(9300, 60, 2));
  if (k) c.face(k, 1);
  yield c.say('kael', '...I forgot it was supposed to look like that.');
  c.sfx('select'); yield c.wait(0.8);
  c.bark('bram', 'Ha! Hahaha! HA!', 2.4);
  yield c.wait(2);
  if (m) { c.sfx('heal'); }
  yield c.wait(1.4);
  yield c.say('mira', '...', { auto: true });
  yield c.wait(1.4);
  const frag = c.actor('frag', makeFragFrames(), ME.x + 60, ME.y - 240, { name: 'fragment', glow: 14, color: '#e27bf0' });
  yield c.all(c.cam(ME.x + 40, ME.y - 60, 1.2));
  yield c.walk(frag, ME.x + 22, ME.y - 4, 60);
  c.sfx('pulse');
  yield c.wait(0.4);
  yield c.walk(ME, ME.x + 18, ME.y - 2, 22);
  c.remove(frag);
  c.sfx('pulse'); yield c.wait(0.8); c.sfx('pulse'); c.flash('#e27bf0', 0.6);
  yield c.wait(1.4);
  yield c.fade(1, 1.6);
  L.done.ch8 = true; save.story = save.story || {}; save.story.ch8 = true; L.shards = 5; save.gold += 300; persist();
  titleCard('THE NIGHT WAS NEVER THE ENEMY.', '');
  yield c.wait(4.4);
  titleCard('ROGUE SURVIVORS 3', 'THE LAST DAWN');
  yield c.wait(4.6);
  yield* rollCredits(c);
  Cine.fade = 0;
  openMenu();
  yield c.until(() => false);
};
function makeFragFrames() { const f = makeSprite(['..0..', '.050.', '0m0m0', '.0m0.', '..0..'].map(r => r.replace(/5/g, 'm'))); return [f, f, f, f]; }

/* ---------- The Hollow Regent ---------- */
SPR.regent = recolorAll(SPR.armor, { '#8a87a0': '#3a3544', '#9a4fd0': '#7a1a2a', '#e27bf0': '#ffd35a' });
BOSS_DEFS.regent = {
  name: 'The Hollow Regent', hp: 4600, spd: 40, r: 16, color: '#ffd35a', scale: 3, frames: () => SPR.regent, phases: [0.5], env: 'void', phaseLines: ['His crown burns'],
  attacks: [
    { id: 'rings', w: 2, dur: 2.2, pose: 'cast', wind: 0.6, run: b => A.ring(b, 16, 85, { c: '#ffd35a' }, 2, 0.4) },
    { id: 'court', dur: 1.8, pose: 'roar', wind: 0.7, run: b => A.summon(b, ['skel', 'ghoul', 'wraith'], 6, 60) },
    { id: 'decree', dur: 2, pose: 'slam', wind: 0.7, run: (b, t) => A.slams(b, t, 4, 28, 0.35) },
    { id: 'charge', dur: 2.4, pose: 'crouch', wind: 0.5, run: (b, t) => A.dash(b, t, 2, 340) },
    { id: 'sceptre', phase: 1, dur: 3, pose: 'charge', wind: 0.8, run: b => A.beam(b, 3, 0.8, 2.4) },
  ],
};
BOSS_DEFS.regent.hh = SPR.regent[0].h * 1.5;
BOSS_TITLES['The Hollow Regent'] = 'He ruled Veyra, and Veyra is all he wants to eat';

STORY.push(
  { id: 'ch5', title: 'V · Five Wanderers', sub: 'The long road', blurb: 'Fires, arguments and secrets. Learn who these people really are before the end.', goal: () => Camp.objective, pointers() {}, build: buildWilds, opening: wildsOpening, play: wildsPlay },
  { id: 'ch6', title: 'VI · The Fall of Veyra', sub: 'The second raid', blurb: 'Six stages of a burning city. The survivors you saved are fighting beside you, or they are not.', goal: () => Camp.objective, pointers() {}, build: () => buildVeyra({ burned: true, palace: true }), opening: fallOpening, play: fallPlay },
  { id: 'ch7', title: 'VII · The Ashen Knight', sub: 'The truth', blurb: 'He removes his helmet. The sky cracks. Something enormous is coming through.', goal: () => Camp.objective, pointers() {}, build: buildSanctum, opening: ashenOpening, play: ashenPlay },
  { id: 'ch8', title: 'VIII · The Black Sun', sub: 'The last dawn', blurb: 'Every survivor you have kept alive stands behind you. The sun is waiting.', goal: () => Camp.objective, pointers() {}, build: buildBattlefield, opening: blackOpening, play: blackPlay },
);
