'use strict';
/* Story mode: dialogue, title cards and boss intros. The campaign, "The Last Dawn", is in cine.js and lastdawn.js. */

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

/* ---------- Chapters ----------
   The campaign itself ("The Last Dawn") lives in cine.js (the cinematic engine) and lastdawn.js (the chapters).
   STORY holds the chapter list; startChapter, chapterDone and openStory are defined there. */
const STORY = [];
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
      $('btnAgain').onclick = () => { Snd.play('select'); if (G && G.local) restartLocal(); else if (ch) startChapter(idx); else newRun(lastChar); };
    }, 0);
    return false;
  },
  state(s) { if (s === 'menu') $('objective').classList.add('hidden'); },
});

/* ---------- Cinematics ---------- */
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
