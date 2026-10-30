'use strict';
/* Story mode: "The Long Night". Six chapters, each with its own wanderer, scenes and goal. */

const SPEAKERS = {
  lamplighter: { name: 'The Lamplighter', spr: () => NPC_SPR.lamplighter[0], color: '#ffd35a' },
  witch: { name: 'The Bog Witch', spr: () => NPC_SPR.witch[0], color: '#a6e05a' },
  watcher: { name: 'The Watcher', spr: () => SPR.swarmeye[0], color: '#e27bf0' },
  herald: { name: 'The Eclipse', spr: () => NPC_SPR.lamplighter[0], color: '#e27bf0' },
  villager: { name: 'A villager', spr: () => NPC_SPR.villager[0], color: '#c9c2e0' },
  narrator: { name: '', spr: () => NPC_SPR.villager[0], color: '#a59cc4' },
  wren: { char: 'wren' }, morrow: { char: 'morrow' }, isolde: { char: 'isolde' }, pell: { char: 'pell' },
  nyx: { char: 'nyx' }, brask: { char: 'brask' }, sable: { char: 'sable' }, vesper: { char: 'vesper' },
};
const portraitCache = {};
function portraitOf(who) {
  if (portraitCache[who]) return portraitCache[who];
  const s = SPEAKERS[who];
  const spr = s.char ? charFrames(s.char)[0] : s.spr();
  return (portraitCache[who] = spr.c.toDataURL());
}
const speakerName = who => SPEAKERS[who].name || (CHARS.find(c => c.id === SPEAKERS[who].char).name);

/* ---------- Dialogue ---------- */
let DLG = null;
SCREENS.push('dialogue', 'story');
HUD_STATES.add('dialogue');
function say(lines, then) {
  DLG = { lines, i: 0, shown: 0, then, from: state === 'dialogue' ? DLG?.from || 'play' : state };
  setState('dialogue');
  showLine();
}
function showLine() {
  const [who, text] = DLG.lines[DLG.i];
  const narr = who === 'narrator';
  $('dialogue').classList.toggle('narr', narr);
  if (!narr) $('dlgPortrait').src = portraitOf(who);
  $('dlgPortrait').classList.remove('talk'); void $('dlgPortrait').offsetWidth; $('dlgPortrait').classList.add('talk');
  $('dlgName').textContent = narr ? '' : speakerName(who);
  $('dlgName').style.color = SPEAKERS[who].color || '#f2eee6';
  DLG.shown = 0;
  $('dlgText').textContent = '';
  Snd.play('select');
}
function advanceDialogue() {
  if (!DLG) return;
  const text = DLG.lines[DLG.i][1];
  if (DLG.shown < text.length) { DLG.shown = text.length; $('dlgText').textContent = text; return; }
  DLG.i++;
  if (DLG.i < DLG.lines.length) { showLine(); return; }
  const then = DLG.then, from = DLG.from;
  DLG = null;
  setState(from === 'dialogue' ? 'play' : from);
  if (then) then();
}
$('dialogue').addEventListener('click', advanceDialogue);

/* ---------- Chapters ---------- */
const STORY = [
  {
    id: 'ch1', title: 'I · Embers', char: 'wren', blurb: 'Wren wakes in the moss, under a sky with no sun.',
    intro: [
      ['lamplighter', 'Easy now. You were lying in the moss so long the ash had started to settle on you.'],
      ['wren', 'Where is the sun? I remember the sun.'],
      ['lamplighter', 'Then you remember more than most. It was swallowed, a hundred years ago. This land has been night ever since. Cinderwake, they call it now.'],
      ['lamplighter', 'Its light did not vanish, though. It shattered. The shards are held by things that should have died long ago.'],
      ['wren', 'And you want me to take them back.'],
      ['lamplighter', 'I want you to survive. The rest follows. Your fire acts on its own; you only need to move. Gather the gems the dead leave behind. They will make you stronger.'],
    ],
    goal: st => st.stage === 0 ? `Survive until the Colossus wakes (${fmtTime(150 - G.t)})` : 'Destroy the Bone Colossus',
    update(st) {
      if (st.stage === 0 && G.t > 60 && !st.tip) { st.tip = true; say([['lamplighter', 'Good. Each level you gain lets you choose a new weapon or relic. Weapons at full strength can evolve, if you hold the right relic.']]); }
      if (st.stage === 0 && G.t >= 150) {
        st.stage = 1;
        say([['lamplighter', 'Feel that? The ground is shaking. Something old is climbing out of it.'], ['wren', 'Is that one of your shards?'], ['lamplighter', 'In its ribs. Break it open.']], () => {
          const [x, y] = edgePos(30);
          makeBoss('colossus', x, y, { hpMul: 0.7, onDeath: () => chapterDone([
            ['wren', 'It is warm. Like holding a coal that does not burn.'],
            ['lamplighter', 'The first shard. Give it here; my lantern will keep it safe.'],
            ['wren', '...Fine. But I am keeping count.'],
          ]) });
        });
      }
    },
  },
  {
    id: 'ch2', title: "II · The Gravekeeper's Debt", char: 'morrow', blurb: 'Morrow owes the dead a debt, and the dead have come to collect.',
    intro: [
      ['morrow', 'Three bells in the old yard. Ring them all and the keeper before me wakes.'],
      ['lamplighter', 'And he carries the second shard. He swallowed it the night the sun fell, and it has kept him walking since.'],
      ['morrow', 'He was a kind man, once. He buried my father.'],
      ['lamplighter', 'Then give him the rest he gave others. Find the bells, gravekeeper.'],
    ],
    goal: st => st.stage === 0 ? `Ring the grave bells (${st.rung || 0}/3)` : 'Lay the Gravekeeper to rest',
    setup(st) {
      st.bells = [0, 1, 2].map(i => { const a = i / 3 * TAU + 0.5; return { x: Math.cos(a) * 380, y: Math.sin(a) * 300, rung: false }; });
    },
    update(st) {
      if (st.stage !== 0) return;
      for (const b of st.bells) {
        if (b.rung || !G.players.some(p => Math.hypot(p.x - b.x, p.y - b.y) < 18)) continue;
        b.rung = true; st.rung = (st.rung || 0) + 1;
        Snd.play('chest'); G.shake = 4;
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; spawnEnemy('skel', b.x + Math.cos(a) * 120, b.y + Math.sin(a) * 90); }
        if (st.rung === 3) {
          st.stage = 1;
          say([['morrow', 'There. He hears it.'], ['lamplighter', 'Careful. Your lantern is not the only light in this yard.'], ['morrow', '...Your lantern burns brighter every time we take a shard, old man. Why is that?']], () => {
            const [x, y] = edgePos(20);
            makeBoss('gravekeeper', x, y, { hpMul: 1.4, onDeath: () => chapterDone([
              ['morrow', 'Rest now. I will finish the digging.'],
              ['lamplighter', 'The second shard. Into the lantern with it.'],
              ['morrow', 'It is warm in there, is it not? Warmer than it should be.'],
            ]) });
          });
        }
      }
    },
    draw(st, now) {
      for (const b of st.bells) {
        if (!onScreen(b.x, b.y, 20)) continue;
        const sx = Math.round(b.x - camX), sy = Math.round(b.y - camY);
        ctx.fillStyle = '#5a3a28'; ctx.fillRect(sx - 6, sy - 18, 2, 18); ctx.fillRect(sx + 5, sy - 18, 2, 18); ctx.fillRect(sx - 6, sy - 19, 13, 2);
        const sw = b.rung ? Math.sin(now * 10) * 2 : 0;
        ctx.fillStyle = '#0b0a12'; ctx.fillRect(sx - 4 + sw, sy - 16, 9, 9);
        ctx.fillStyle = b.rung ? '#ffd35a' : '#9a6a42'; ctx.fillRect(sx - 3 + sw, sy - 15, 7, 8);
        light(b.x, b.y - 12, 40, 0.8); glowAt(b.x, b.y - 12, 12, '#ffd35a', b.rung ? 0.6 : 0.25);
      }
    },
    pointers(st, list) { for (const b of st.bells) if (!b.rung && !onScreen(b.x, b.y, 10)) list.push({ x: b.x, y: b.y, pcolor: '#ffd35a', picon: ICON.duration }); },
  },
  {
    id: 'ch3', title: 'III · Storm Over the Bog', char: 'isolde', blurb: "Isolde's village burns. A witch in the reeds knows why.",
    intro: [
      ['villager', 'Lady Isolde! They came out of the water, hundreds of them!'],
      ['isolde', 'Get behind me. All of you.'],
      ['lamplighter', 'Hold them back, stormcaller. A village saved is worth more than any shard.'],
    ],
    goal: st => ['Save the villagers', 'Speak with the witch', 'Enter the Frozen Expanse', 'Slay the Frost Wyrm', 'Return through the golden portal'][st.stage] || '',
    setup(st) {
      const v = { x: 0, y: 220, type: 'village', ruined: false };
      G.ev = { kind: 'siege', t: 0, v, x: v.x, y: v.y, dur: 45, name: 'Village Siege', spawnT: 0, folk: [] };
      for (let i = 0; i < 5; i++) { const n = makeNpc(i % 2 ? 'villager2' : 'villager', v.x + rand(-30, 30), v.y + rand(-20, 20)); n.villager = true; G.ev.folk.push(n); }
      st.v = v;
    },
    update(st) {
      if (st.stage === 0 && !G.ev) {
        st.stage = 1;
        say([
          ['witch', st.v.ruined ? 'Too late for them, little storm. Too late for most things.' : 'Neatly done, little storm. They will remember your name.'],
          ['witch', 'Now listen, for I say this once. That old man with the lantern. Do you know what he does with the shards?'],
          ['isolde', 'He keeps them safe until the dawn.'],
          ['witch', 'He keeps them. Full stop. A shard does not make a dawn; it feeds whoever carries it.'],
          ['witch', 'The third shard sleeps inside a wyrm in a frozen world. Take it before he does.'],
        ], () => { st.stage = 2; spawnPortal('frozen', ME.x + 60, ME.y - 40); });
      }
    },
    enteredDim(st) { if (st.stage === 2) st.stage = 3; },
    dimConquered(st) { st.stage = 4; },
    leftDim(st) {
      chapterDone([
        ['isolde', 'I have the shard. It is mine to keep, this time.'],
        ['lamplighter', 'Of course, of course. Though it would be safer in the lantern.'],
        ['isolde', 'Then it will be in danger with me. I will take that risk.'],
      ]);
    },
  },
  {
    id: 'ch4', title: 'IV · The Forge of the Sun', char: 'pell', blurb: 'Pell studies the shards, and finds a fingerprint.',
    intro: [
      ['pell', 'Fascinating. Each shard is a piece of the same light. But look here. Scorch marks, from the inside.'],
      ['pell', 'The sun was not swallowed whole. It was broken first, in a forge, deliberately.'],
      ['lamplighter', 'Idle theories, alchemist.'],
      ['pell', 'Then you will not mind if I visit the forge. The Infernal Rift. A Cinder Titan works the bellows, they say.'],
    ],
    goal: st => ['Find the portal to the Rift', 'Slay the Cinder Titan', 'Return through the golden portal'][st.stage] || '',
    setup(st) { spawnPortal('rift', 160, 0); },
    enteredDim(st) { st.stage = 1; },
    dimConquered(st) { st.stage = 2; },
    leftDim() {
      chapterDone([
        ['pell', 'The anvil in the Rift bears a sigil. A lantern, with a flame inside an eye.'],
        ['lamplighter', 'Many people carry lanterns.'],
        ['pell', 'Not many carry yours.'],
      ]);
    },
  },
  {
    id: 'ch5', title: 'V · What the Watcher Saw', char: 'sable', blurb: 'In the Void Garden, a witness older than the night is waiting.',
    intro: [
      ['sable', 'The Watcher saw the sun die. It sees everything, and it forgets nothing.'],
      ['sable', 'If I put out its eye, it will tell me what it saw. Hexes are funny that way.'],
    ],
    goal: st => ['Find the portal to the Void Garden', 'Defeat the Watcher', 'Return through the golden portal'][st.stage] || '',
    setup(st) { spawnPortal('void', -160, 0); },
    enteredDim(st) { st.stage = 1; },
    dimConquered(st) {
      st.stage = 2;
      say([
        ['watcher', 'You want to know who ate your sun, little hexer.'],
        ['watcher', 'The one who carries the lantern. He broke it in the forge and drank it shard by shard. He is not a man. He is the Eclipse.'],
        ['watcher', 'And every shard you have brought him has made him stronger.'],
      ]);
    },
    leftDim() {
      chapterDone([
        ['lamplighter', 'So. The eye talked.'],
        ['sable', 'You. All this time, we were carrying your meals to you.'],
        ['lamplighter', 'And you carried them so well. I have what I need. Come to the Drowned Isle, if you want them back. Come and watch the last light go out.'],
      ]);
    },
  },
  {
    id: 'ch6', title: 'VI · Dawn', char: 'vesper', blurb: 'Vesper was his apprentice once. Now the apprentice ends it.',
    intro: [
      ['vesper', 'I carried his lantern for forty years. He took my face, my name and my warmth, and filled the hollow with his light.'],
      ['vesper', 'I know the way to the Drowned Isle. I know what guards it. And I know what he is.'],
      ['vesper', 'Wren, Morrow, Isolde, Pell, Sable. Thank you. This last part is mine.'],
    ],
    goal: st => ['Find the portal to the Drowned Isle', 'Defeat the Leviathan', 'Destroy the Eclipse', 'Walk into the dawn'][st.stage] || '',
    setup(st) { spawnPortal('island', 0, -150); },
    enteredDim(st) { st.stage = 1; },
    update(st) { if (st.stage === 1 && G.dim === 'island' && G.dimBossIdx === 1 && !st.heraldTalk) { st.heraldTalk = true; st.stage = 2; say([['herald', 'Little hollow thing. I made you. Do you really think you can unmake me?'], ['vesper', 'You made me empty. Empty things are very good at holding light.']]); } },
    dimConquered(st) { st.stage = 3; },
    leftDim() {
      chapterDone([
        ['vesper', 'The shards are rising. Look, all of you. Look east.'],
        ['lamplighter', '...'],
        ['vesper', 'It is not much yet. A grey line. But it is ours.'],
        ['vesper', 'Dawn breaks over Cinderwake.'],
      ], true);
    },
  },
];

function startChapter(i) {
  const ch = STORY[i];
  Snd.init();
  newRun(ch.char, { story: { chapter: i, noPortals: true } });
  G.evIdx = EVENTS.length;
  G.eventT = Infinity;
  G.storyState = { stage: 0 };
  if (ch.setup) ch.setup(G.storyState);
  titleCard(ch.title, ch.blurb);
  setTimeout(() => { if (G && G.story && state === 'play') say([...NARRATION[i].map(t => ['narrator', t]), ...ch.intro]); }, 3200);
}
function chapterDone(lines, final) {
  const i = G.story.chapter;
  if (final) G.dawnT = 0.001;
  say(lines, () => {
    save.story = save.story || {};
    save.story[STORY[i].id] = true;
    save.gold += 150;
    const next0 = STORY[i + 1];
    if (next0) save.unlocked[next0.char] = true;
    persist();
    Snd.play('win');
    const next = STORY[i + 1];
    openModal({
      title: final ? 'The Long Night is over' : 'Chapter complete', color: '#ffd35a', sub: STORY[i].title + ' · +150 gold' + (next ? ` · ${CHARS.find(c => c.id === next.char).name} joins your roster` : ''),
      body: final ? '<p class="flavor">The shards climb into the sky and knit together. For the first time in a hundred years, the light in Cinderwake does not come from fire.</p><p>Thank you for playing.</p>' : `<p class="flavor">Next: ${next.title}. ${next.blurb}</p>`,
      buttons: [...(next ? [{ label: 'Next chapter', primary: true, act: () => startChapter(i + 1) }] : []), { label: 'Return to the menu', act: () => openMenu() }],
    });
  });
}
function openStory() {
  setState('story');
  const box = $('storyList');
  box.innerHTML = '';
  STORY.forEach((ch, i) => {
    const open = i === 0 || save.story?.[STORY[i - 1].id];
    const done = save.story?.[ch.id];
    const b = document.createElement('button');
    b.className = 'card char' + (open ? '' : ' locked');
    b.style.animationDelay = i * 0.05 + 's';
    b.innerHTML = `<img class="portrait" src="${portraitOf(ch.char)}" alt="">
      <div><div class="name">${ch.title}</div><div class="title2">${CHARS.find(c => c.id === ch.char).name}</div></div>
      <div class="desc">${open ? ch.blurb : 'Finish the chapter before this one.'}</div>${done ? '<div class="price">Completed</div>' : ''}`;
    b.onclick = () => { if (open) { Snd.play('select'); startChapter(i); } else Snd.play('hurt'); };
    b.onmouseenter = () => Snd.play('hover');
    box.appendChild(b);
  });
}
$('btnStory').onclick = () => { Snd.play('select'); openStory(); };

const chapter = () => (G && G.story ? STORY[G.story.chapter] : null);
Mods.add({
  frame(st, dt) {
    if (st !== 'dialogue' || !DLG) return;
    const text = DLG.lines[DLG.i][1];
    if (DLG.shown < text.length) {
      DLG.shown = Math.min(text.length, DLG.shown + dt * 55);
      $('dlgText').textContent = text.slice(0, Math.floor(DLG.shown));
      if (Math.floor(DLG.shown) % 3 === 0) Snd.play('tick');
    }
  },
  key(e) {
    if (state !== 'dialogue') return false;
    if (['Enter', 'Space', 'KeyE', 'Escape'].includes(e.code)) { e.preventDefault(); advanceDialogue(); }
    return true;
  },
  update(dt) {
    if (!G.story) return;
    G.eventT = Infinity; // chapters script their own events
    const ch = chapter();
    if (ch && ch.update && state === 'play') ch.update(G.storyState, dt);
  },
  enteredDim(d) { const ch = chapter(); if (ch && ch.enteredDim) ch.enteredDim(G.storyState, d); },
  dimConquered(d) { const ch = chapter(); if (ch && ch.dimConquered) ch.dimConquered(G.storyState, d); },
  leftDim(d) { const ch = chapter(); if (ch && ch.leftDim) ch.leftDim(G.storyState, d); },
  drawGround(now) { const ch = chapter(); if (ch && ch.draw) ch.draw(G.storyState, now); },
  pointers(list) { const ch = chapter(); if (ch && ch.pointers) ch.pointers(G.storyState, list); },
  hud() {
    const ch = chapter(), txt = ch ? ch.goal(G.storyState) : '';
    if (hudLast.goal !== txt) { hudLast.goal = txt; $('objective').textContent = txt; $('objective').classList.toggle('hidden', !txt); }
  },
  gameOver() {
    const ch = chapter(), idx = G.story?.chapter;
    setTimeout(() => {
      $('btnAgain').textContent = ch ? 'Retry chapter' : 'Rise again';
      $('btnAgain').onclick = () => { Snd.play('select'); if (ch) startChapter(idx); else newRun(lastChar); };
    }, 0);
    return false;
  },
  state(s) { if (s === 'menu') $('objective').classList.add('hidden'); },
});

/* ---------- Cinematics ---------- */
const NARRATION = [
  ['A hundred years have passed since anyone saw a sunrise.', 'The land forgot the colour of morning. The dead did not forget the way out of their graves.', 'In the moss of a nameless forest, something stirs.'],
  ['The old yard behind the chapel has three bells and no bell-ringer.', 'Morrow has dug every grave in it. Tonight, he digs one more.'],
  ['The bog villages built their houses on stilts to keep the water out.', 'It was not the water they should have feared.'],
  ['Pell has never trusted anything that glows on its own.', 'The shards glow. So does the old man\'s lantern.'],
  ['There is a garden at the edge of the void where nothing grows except attention.', 'Something there has been watching since the sun went out.'],
  ['The last of the shards has been taken across the drowned sea.', 'Vesper has crossed it once before, carrying a lantern, in another life.'],
];
const BOSS_TITLES = {
  'Bone Colossus': 'Warden of the First Shard', 'The Gravekeeper': 'He buried them all, and then himself',
  'The Frost Wyrm': 'Asleep beneath a hundred winters', 'The Cinder Titan': 'The hammer that broke the sun',
  'The Watcher': 'It saw everything. It forgot nothing', 'The Leviathan': 'The tide that guards the isle',
  'The Eclipse Herald': 'The Lamplighter, unmasked',
};
function titleCard(title, sub, cls = '') {
  const el = $('titlecard');
  const [num, name] = title.includes(' · ') ? title.split(' · ') : ['', title];
  el.className = cls;
  el.innerHTML = `${num ? `<div class="tc-num">Chapter ${num}</div>` : ''}<div class="tc-title">${name}</div><div class="tc-sub">${sub}</div>`;
  void el.offsetWidth;
  el.classList.add('show');
  Snd.play(cls === 'boss' ? 'warn' : 'shrine');
}
const storyMakeBoss = makeBoss;
makeBoss = function (id, x, y, o = {}) {
  const b = storyMakeBoss(id, x, y, o);
  if (G && G.story && !o.minor) {
    titleCard(b.name, BOSS_TITLES[b.name] || 'It has been waiting for you', 'boss');
    G.slowT = Math.max(G.slowT, 1.4); G.shake = Math.max(G.shake, 6);
  }
  return b;
};
Mods.add({
  drawOverlay(now) {
    if (!G || !G.dawnT) return;
    G.dawnT = Math.min(1, G.dawnT + 0.004);
    const k = G.dawnT, g = ctx.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0, `rgba(255,200,120,${0.55 * k})`); g.addColorStop(0.5, `rgba(232,116,44,${0.25 * k})`); g.addColorStop(1, `rgba(120,90,160,${0.1 * k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    pxDisc(W / 2, H + 30 - k * 60, 40, `rgba(255,243,176,${0.8 * k})`, 1);
    G.darkMul = Math.max(0.05, 1 - k);
  },
});
