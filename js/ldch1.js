'use strict';
/* THE LAST DAWN, chapters I and II: Haven, and the road through the dead country. */

const DIRT = ['#221c14', ['#17120c', '#2e261a']], COBBLE = ['#34303f', ['#262230', '#46425a']];
const folkNames = ['Wick', 'Dorn', 'Edda', 'Marek', 'Ilse', 'Joren', 'Tamsin', 'Cade'];
function* choose(c, def) {
  let picked = -1;
  openModal({ ...def, buttons: def.buttons.map((b, i) => ({ ...b, act: () => { picked = i; } })) }, ME);
  yield c.until(() => picked >= 0);
  return picked;
}
// A short cutscene in the middle of play: the camera goes somewhere, people talk, the game resumes
function* mini(c, target, lines, o = {}) {
  yield c.cine(true);
  if (target) yield c.cam(target.x, target.y, o.pan ?? 1.1);
  yield* c.convo(lines);
  yield c.cine(false);
}
const sideLamps = (x0, x1, y, gap = 70) => { for (let x = x0; x <= x1; x += gap) scnProp('lamp', x, y, 0); };

/* ---------- Haven ---------- */
function buildHaven() {
  biomeOverride = () => 'ash'; resetWorldCache();
  scnBlock(-420, -240, 470, 240);
  scnGround(-440, -240, 920, 480, [[-440, -240, 920, 480, '#1c1710', ['#120f0a', '#2a2318']], [-330, -22, 720, 44, ...DIRT], [-16, -200, 32, 400, ...DIRT], [-250, -112, 330, 20, ...DIRT], [-250, 94, 330, 20, ...DIRT]], 21);
  const H = G.ld.place = { houses: [], barricades: [], civs: [] };
  for (const [x, y, k, s] of [[-130, -84, 'cottage', 3], [-40, -128, 'longhouse', 8], [70, -92, 'cottage', 5], [170, -74, 'house2', 2], [-150, 96, 'cottage', 11], [-44, 108, 'house2', 6], [96, 100, 'longhouse', 4],
    [196, 80, 'cottage', 9], [-216, -106, 'cottage', 14], [-214, 120, 'cottage', 17], [290, -30, 'chapel', 1], [-76, -26, 'smithy', 12]]) H.houses.push(scnHouse(x, y, k, s));
  scnProp('well', 0, 8, 10); scnProp('crate', -100, 30, 5); scnProp('crate', -92, 34, 5); scnProp('barrel', 150, 36, 4); scnProp('cart', 60, 62, 8);
  for (const [x, y] of [[-110, 14], [26, 40], [-200, -26], [150, -30], [250, 30]]) scnProp('brazier', x, y, 4);
  sideLamps(-190, 330, -44, 90);
  // the west wall, with the gate in its gap
  scnWall(-300, -170, -300, -34); scnWall(-300, 34, -300, 180);
  H.gate = scnAdd(cached('ld-gate', () => makeGate(5)), -300, 6, { solids: [[-38, -2, 9], [38, -2, 9]], name: 'Haven Gate' });
  for (const y of [-52, 0, 52]) H.barricades.push(scnAdd(prop('palisade'), -226, y + 8, { solids: [[0, -2, 8]], hp: 260, tgt: true, name: 'Barricade' }));
  H.cellar = scnProp('tent', 392, 22, 10);
  // the folk of Haven
  folkNames.forEach((n, i) => { const a = mkActor('civ' + i, i % 2 ? 'refugee2' : 'refugee', -40 + i * 26, -50 + (i % 3) * 34, { name: n, civ: true, hp: 60 }); a.named = true; H.civs.push(a); });
}
const havenOpening = function* (c) {
  Cine.fade = 1;
  yield c.cine(true);
  const kael = c.who('kael'), mira = c.who('mira'), bram = c.who('bram'), H = G.ld.place;
  const stage = (a, x, y, f) => { if (a) { a.x = x; a.y = y; a.face = f || 1; a.goal = null; a.moving = false; } };
  stage(ME, -20, 24, 1); stage(kael, -264, -60); stage(mira, 40, 46); stage(bram, -150, -4);
  c.snap(90, -70); c.music(3);
  c.sfx('wind');
  yield c.wait(1.6);
  c.sfx('bell');
  yield c.all(c.fade(0, 3.8), c.cam(-10, 6, 5.5, 'out'));
  yield c.walk(ME, -56, 22, 22);
  yield c.wait(0.5);
  yield c.say('elara', 'Day thirty-seven.');
  yield c.wait(0.7);
  c.sfx('bell'); c.face(ME, -1);
  yield c.wait(1.4);
  yield c.all(c.zoom(1.5, 2.2), c.cam(-290, 4, 2.4));
  c.sfx('rumble');
  yield c.wait(0.9);
  c.explode(-300, 6, 64); c.collapse(H.gate, { shake: 6 });
  const foes = [];
  for (let i = 0; i < 8; i++) {
    const e = c.foe(i % 3 ? 'ghoul' : 'skel', -372 - (i % 3) * 22, -26 + i * 8);
    e.goal = { x: -180 + rand(-20, 20), y: e.y + rand(-30, 30), spd: 62 }; e.siege = true; foes.push(e);
  }
  yield c.wait(0.8);
  yield c.cam(-264, -60, 0.9);
  yield c.say('kael', 'HEY!');
  c.face(ME, -1);
  c.shoot(kael, foes[0], { kill: true });
  yield c.wait(0.5);
  yield c.say('kael', 'Save the staring-at-the-sky routine for later!');
  c.shoot(kael, foes[1], { kill: true });
  yield c.wait(0.3);
  yield c.all(c.zoom(1, 0.9), c.cam(-120, 10, 1.2));
  for (const e of foes) if (!e.dead) { e.goal = null; e.ai = siegeAI; e.anchored = true; }
  yield c.cine(false);
};
const havenPlay = function* (c) {
  const H = G.ld.place, kael = c.who('kael'), mira = c.who('mira'), bram = c.who('bram');
  if (kael) kael.post = { x: -258, y: -62, leash: 26 };
  if (bram) bram.post = { x: -206, y: 0, leash: 70 };
  c.objective('Defend Haven');
  c.bar('bar', 'Barricades', () => H.barricades.reduce((s, p) => s + (p.fallen ? 0 : p.hp), 0) / (H.barricades.length * 260), '#e8742c');
  c.bar('folk', 'Villagers safe', () => G.ld.civSaved / folkNames.length, '#a6e05a');
  const gate = [[-350, -26], [-350, 0], [-350, 26]];
  // the villagers run for the cellar in two groups while the wall holds
  c.bark('kael', 'Here they come! Everyone, hold the barricades!', 4);
  for (const a of H.civs.slice(0, 4)) { a.escapeTo = { x: 392, y: 22 }; a.goal = { x: 392, y: 22 + rand(-12, 12), spd: 48 }; }
  c.wave(['ghoul', 'ghoul', 'skel'], 10, gate, { gap: 0.8 });
  yield c.wait(3);
  c.bark('mira', 'Over here! Get the wounded to the cellar!', 3.6);
  for (const a of H.civs.slice(4)) { a.escapeTo = { x: 392, y: 22 }; a.goal = { x: 392, y: 22 + rand(-12, 12), spd: 46 }; }
  yield c.clear(0);
  c.bark('bram', 'The barricade needs work. Give me a minute.', 3.6);
  yield c.wait(5);
  c.wave(['skel', 'skel', 'ghoul', 'bat'], 14, gate, { gap: 0.55 });
  c.bark('kael', 'More of them! Archers, up on the wall!', 3.4);
  yield c.clear(2);
  yield c.wait(1);
  c.bark('mira', 'Elara! Fall back to the well and breathe!', 3);
  yield c.wait(5);
  c.wave({ ghoul: 3, bat: 4, wraith: 1 }, 18, gate, { gap: 0.45 });
  c.wave(['bat'], 6, [[-250, -180], [-250, 180]], { gap: 0.8 });
  c.bark('bram', 'LEFT SIDE!', 2.4);
  yield c.clear(0);
  c.bar('bar'); c.bar('folk');
  // everything goes quiet
  yield c.cine(true);
  c.music(3); c.sfx('wind');
  clearFoes();
  yield c.all(c.cam(-300, 0, 1.6), c.zoom(1.25, 1.6));
  yield c.wait(0.8);
  const kn = c.actor('ashen', 'ashen', -660, 0, { name: 'Ashen Knight', sc: 1.5, glow: 40, color: '#e8742c' });
  yield c.all(c.cam(-420, 0, 2.2), c.walk(kn, -520, 0, 16));
  yield* c.convo([['kael', 'Who is that?'], ['mira', '...Don\'t let him reach the gate.']]);
  yield c.walk(kn, -380, 0, 15);
  c.sfx('warn');
  c.attack(kn); c.shake(8, 0.8);
  yield c.flash('#e8742c', 0.8);
  c.sfx('rumble');
  c.remove(kn);
  const b = c.boss('ashen', -380, 0);
  c.music(2);
  yield c.cine(false);
  c.objective('Hold your ground against the Ashen Knight');
  yield c.bossBelow(b, 0.5);
  // he stops
  yield c.cine(true);
  b.ai = () => {};
  yield c.all(c.camTo(b, 0.8), c.zoom(1.6, 1));
  yield c.wait(0.5);
  yield* c.convo([['ashen', 'You are not ready.'], ['elara', 'Who are you?'], ['ashen', 'You already know.']]);
  burst(b.x, b.y, '#e8742c', 50, 130); burst(b.x, b.y, '#0b0a12', 30, 90);
  yield c.flash('#0b0a12', 0.6);
  c.endBoss(b);
  LDS().bosses.ashen1 = true;
  c.music(3);
  yield c.zoom(1, 1);
  yield c.wait(0.6);
  // the morning after
  c.objective('');
  const dead = [H.houses[0], H.houses[4], H.houses[8]];
  yield c.all(c.cam(-150, -80, 1.6), c.walk(ME, -150, 10, 36));
  for (const p of dead) { c.shake(6, 0.4); c.collapse(p, { shake: 7 }); yield c.wait(0.7); }
  c.party(-150, 10, { walk: true, spd: 40 });
  yield c.wait(1.8);
  yield c.cam(-110, 0, 1.2);
  yield* c.convo([
    ['bram', 'We can\'t stay here.'],
    ['mira', 'Then we find the Dawn Engine.'],
    ['elara', 'And the sun?'],
    ['mira', 'If the stories are true...'],
  ]);
  c.sky({ on: true, eye: 0, crack: 0 });
  yield c.cam(-110, -20, 1);
  yield c.say('mira', '...they\'re the same problem.');
  yield c.cine(false);
  yield* finishChapter(c, 0, `Haven stands, scarred and half burned. ${G.ld.civSaved} of ${folkNames.length} villagers reached the cellar. Something in black armour watched, and chose to let you live.`);
};

/* ---------- The road of the dead ---------- */
function buildRoad() {
  biomeOverride = (x, y) => (x < 700 ? 'moss' : x < 1450 ? 'ash' : x < 2250 ? 'grave' : x < 3000 ? 'moss' : 'ash'); resetWorldCache();
  scnBlock(-140, -34, 4000, 34);
  scnGround(-160, -26, 4200, 52, [[-160, -26, 4200, 52, ...DIRT]], 31);
  const R = G.ld.place = { camp: null, survivors: [], farmX: 2950 };
  scnProp('signpost', 300, -34, 0); scnProp('cart', 520, 40, 8); scnProp('deadtree', 560, -46, 4);
  // the burned village
  [[800, -80, 'cottage', 21], [900, 90, 'house2', 22], [1000, -86, 'longhouse', 23], [1100, 96, 'cottage', 24], [1210, -80, 'cottage', 25], [1300, 90, 'house2', 26]].forEach(([x, y, k, s]) => { const p = scnHouse(x, y, k, s); p.spr = p.ruinedSpr; p.light = false; });
  for (const x of [850, 1050, 1250]) scnProp('brazier', x, 36, 4);
  scnProp('rubble', 950, -30, 0); scnProp('rubble', 1160, 30, 0);
  // the abandoned road
  for (const [x, y] of [[1560, 44], [1720, -48], [1900, 46], [2080, -44]]) scnProp('cart', x, y, 8);
  for (const x of [1480, 1640, 1820, 2000, 2150]) scnProp('skullpost', x, x % 2 ? -36 : 38, 3);
  scnProp('banner', 1760, -50, 3); scnProp('banner', 2030, 52, 3);
  // the camp
  R.camp = { x: 2540, y: 0 };
  scnProp('brazier', 2540, 4, 5);
  for (const [x, y] of [[2480, -70], [2600, -76], [2470, 76], [2610, 80]]) scnProp('tent', x, y, 14);
  scnProp('crate', 2560, 48, 5); scnProp('barrel', 2500, 36, 4);
  // the farm
  for (const [x, y] of [[3050, -60], [3150, 70], [3300, -70], [3420, 64]]) scnProp('hay', x, y, 8);
  [[3200, -110, 'cottage', 31], [3380, 120, 'longhouse', 32]].forEach(([x, y, k, s]) => { const p = scnHouse(x, y, k, s); p.spr = p.ruinedSpr; p.light = false; });
  for (let x = 3000; x < 3500; x += 26) { scnProp('fence', x, -40, 0); scnProp('fence', x, 40, 0); }
  // lights on the horizon
  for (let i = 0; i < 60; i++) scnProp(i % 3 ? 'lamp' : 'brazier', 3760 + rand(0, 380), rand(-210, 210), 0);
  for (let i = 0; i < 10; i++) scnProp('lamp', 3600 + i * 12, -60 - i * 14, 0);
}
const roadOpening = function* (c) {
  Cine.fade = 1;
  yield c.cine(true);
  const kael = c.who('kael'), mira = c.who('mira'), bram = c.who('bram');
  c.party(0, 0, { gap: 22 });
  const folk = [];
  for (let i = 0; i < 6; i++) { const a = c.actor('hv' + i, i % 2 ? 'refugee2' : 'refugee', -140 - i * 18, rand(-22, 22), { name: folkNames[i] }); folk.push(a); }
  c.snap(-60, 0); c.music(3); c.sfx('wind');
  yield c.all(c.fade(0, 2.6), c.cam(10, 0, 4, 'out'));
  yield c.title('II · Road of the Dead', 'Three days east, if Veyra still stands.');
  yield c.walkAll(folk, 120, 0, 28, 20);
  yield* c.convo([
    ['elara', 'Thirty-seven days.'],
    ['kael', 'What?'],
    ['elara', 'That\'s how long we\'ve been walking beneath a dead sky.'],
    ['kael', 'Then let\'s make sure it doesn\'t become thirty-eight.'],
  ]);
  c.party(0, 0, { walk: true, spd: 36 });
  yield c.cam(80, 0, 1.4);
  for (const a of folk) c.remove(a);
  yield c.cine(false);
};
const roadPlay = function* (c) {
  const R = G.ld.place, L = LDS();
  c.objective('Follow the road east'); c.point(3700, 0);
  const strike = (types, n, ahead = 320) => c.wave(types, n, [[ME.x + ahead, rand(-90, 90)], [ME.x + ahead, rand(-90, 90)]], { gap: 0.5, ai: false });
  // Ghouls and skeletons are slower than you, so a fight can be outrun. Once the party is well past it the stragglers are dismissed,
  // so the road never waits on foes that are left behind.
  const clearOrLeave = max => {
    const from = ME.x;
    return c.until(() => {
      if (LDFAST) { Camp.timers.forEach(t => (t.t = 0)); for (const e of G.enemies) if (e.siege && !e.dead && !e.boss) e.dead = true; }
      const left = G.players.every(p => p.x > from + 500);
      if (left) for (const e of G.enemies) if (e.siege && !e.dead && !e.boss) { e.dead = true; burst(e.x, e.y, '#a59cc4', 6, 50); }
      return left || (!(Camp.pend > 0) && foesAlive() <= max);
    });
  };
  // the forest
  yield c.reachX(380);
  c.bark('kael', 'You know, I used to like forests.', 3.4); yield c.wait(3.6);
  c.bark('mira', 'The trees are thinner here. They were cut down in a hurry.', 3.8); yield c.wait(4);
  strike(['skel', 'ghoul'], 6); yield clearOrLeave(1);
  // the burned village
  yield c.reachX(840);
  yield* mini(c, { x: 980, y: -10 }, [
    ['mira', 'These ruins aren\'t dead.'],
    ['kael', 'Everything here looks dead.'],
    ['mira', 'That\'s what worries me.'],
  ]);
  strike({ ghoul: 3, skel: 2, bat: 3 }, 10); yield clearOrLeave(1);
  c.bark('bram', 'Someone lived here. There is a child\'s boot by the door.', 4); yield c.wait(4.4);
  // the abandoned road
  yield c.reachX(1500);
  c.bark('kael', 'Tell me you have a plan.', 3);
  yield c.wait(3.2);
  c.bark('elara', 'I do.', 2); yield c.wait(2);
  c.bark('kael', 'Good.', 1.6); yield c.wait(1.8);
  c.bark('elara', 'We run.', 2); yield c.wait(2);
  c.bark('kael', '...That\'s not a plan.', 2.4); yield c.wait(2.6);
  c.bark('elara', 'It is tonight.', 2.6);
  strike({ wraith: 2, skel: 3, ghoul: 3 }, 12); yield clearOrLeave(1);
  c.bark('bram', 'Keep your voices down. Sound carries on a dead road.', 3.6);
  // the camp: someone is being attacked
  yield c.reachX(2200);
  c.objective('Reach the camp');
  yield c.cine(true);
  const camp = R.camp, names = ['Lyra', 'Fenn', 'Nessa', 'Pike', 'Tam', 'Roswyn'];
  const surv = names.map((n, i) => { const a = c.actor('sv' + i, n === 'Lyra' ? 'lyra' : i % 2 ? 'survivor' : 'refugee2', camp.x + rand(-40, 40), camp.y + rand(-50, 50), { name: n, civ: true, hp: 80 }); a.named = true; a.escapeTo = null; return a; });
  R.survivors = surv;
  yield c.all(c.cam(camp.x, camp.y, 2.2), c.zoom(1.35, 2.2));
  const ghouls = [];
  for (let i = 0; i < 6; i++) { const e = c.foe('ghoul', camp.x + 200 + i * 10, camp.y + rand(-60, 60)); e.goal = { x: camp.x + 30, y: camp.y + rand(-30, 30), spd: 46 }; e.siege = true; ghouls.push(e); }
  yield c.wait(0.8);
  yield* c.convo([['lyra', 'HELP! Please, somebody!'], ['kael', 'Elara...'], ['bram', 'There are children in that camp.']]);
  for (const e of ghouls) { e.goal = null; e.ai = siegeAI; e.anchored = true; }
  yield c.all(c.zoom(1, 0.8), c.cine(false));
  const ix = yield* choose(c, {
    title: 'The camp is under attack', color: '#e8742c', sub: 'Lyra and five others, and the dark is on them.',
    body: '<p class="flavor">Saving them costs time, blood and arrows. Leaving them costs something else.</p>',
    buttons: [{ label: 'SAVE THEM', desc: 'Fight for the camp. The survivors will remember.', primary: true }, { label: 'KEEP MOVING', desc: 'Reach the next area faster. They will not be there for you later.' }],
  });
  if (ix === 0) {
    L.choices.saved = true;
    c.objective('Save the survivors'); c.bar('sv', 'Survivors alive', () => surv.filter(a => a.hp > 0 && !a.dead).length / surv.length, '#a6e05a');
    c.bark('elara', 'Everyone with me!', 2.4);
    c.wave(['ghoul', 'ghoul', 'skel', 'wraith'], 12, [[camp.x + 230, camp.y - 40], [camp.x + 230, camp.y + 40], [camp.x - 230, camp.y]], { gap: 0.9 });
    yield c.clear(0);
    c.bar('sv');
    const alive = surv.filter(a => a.hp > 0 && !a.dead);
    L.rescued = alive.map(a => a.name);
    L.lost.push(...surv.filter(a => !alive.includes(a)).map(a => a.name));
    yield c.cine(true);
    yield c.camTo(alive[0] || camp, 1);
    if (alive.find(a => a.name === 'Lyra')) {
      yield* c.convo([['lyra', 'You came back for us. Nobody comes back.'], ['elara', 'Get to Veyra. Tell them we are coming.'], ['lyra', 'I will. All of us will. We will not forget this.']]);
    } else yield* c.convo([['bram', 'We were too slow for some of them.'], ['mira', 'We saved those we could. Remember that.']]);
    c.rel('mira', 1); c.rel('kael', 1);
    for (const a of alive) { a.goal = { x: camp.x + 900, y: rand(-12, 12), spd: 34 }; }
    yield c.wait(1.2);
    yield c.cine(false);
    for (const a of alive) c.remove(a);
    c.objective('Follow the road east'); c.point(3700, 0);
    // the ruined farm
    yield c.reachX(3000);
    strike({ ghoul: 3, wraith: 2, skel: 2 }, 12); c.bark('kael', 'Hay, fences, broken windows. I have seen better farms in nightmares.', 4); yield clearOrLeave(1);
  } else {
    L.choices.abandoned = true; c.rel('mira', -2); c.rel('kael', -1);
    for (const e of G.enemies) if (e.siege) e.siege = false;
    yield c.cine(true);
    yield* c.convo([['mira', 'Elara. You cannot mean it.'], ['elara', 'We keep moving.'], ['kael', '...Fine. Fine! You are the one who has to carry that.']]);
    c.sfx('hurt');
    yield c.fade(1, 1.2);
    for (const a of surv) c.remove(a);
    clearFoes();
    c.teleport(2980, 0);
    yield c.fade(0, 1.4);
    yield c.say('narrator', 'Behind them the screaming stopped. It was a long time before anyone spoke.', { auto: true });
    yield c.cine(false);
  }
  // Veyra on the horizon
  c.objective('Reach Veyra'); c.point(3700, 0);
  yield c.reachX(3560);
  yield c.cine(true);
  c.music(3);
  yield c.all(c.cam(3900, 0, 4, 'inout'), c.zoom(1.2, 3));
  yield c.wait(0.6);
  yield* c.convo([['mira', 'There. The lights.'], ['kael', 'There must be thousands of them.'], ['bram', 'Thousands of people, thousands of problems.']]);
  yield c.cine(false);
  yield* finishChapter(c, 1, L.choices.saved ? `You saved ${L.rescued.length} survivors from the camp. They are walking to Veyra ahead of you.` : 'You walked on. The camp is silent now. Veyra\'s lights are close, and nobody is talking.');
};

STORY.push(
  { id: 'ch1', title: 'I · The Night That Never Ends', sub: 'Haven', blurb: 'Day thirty-seven. A village gate explodes, and a stranger in black armour waits beyond it.', goal: () => Camp.objective, pointers() {}, build: buildHaven, opening: havenOpening, play: havenPlay },
  { id: 'ch2', title: 'II · Road of the Dead', sub: 'The road east', blurb: 'Forests, burned villages and a camp under attack. What you do on this road will follow you.', goal: () => Camp.objective, pointers() {}, build: buildRoad, opening: roadOpening, play: roadPlay },
);
