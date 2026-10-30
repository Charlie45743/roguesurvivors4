'use strict';
/* Test entry points for headless runs (URL flags). Harmless in normal play.
   goto=<structure>  ev=<event>  dim=<dimension>  theme=<dungeon>  story=<chapter>  boss=<id>
   coophost=<CODE>&char=<id>   coopjoin=<CODE>&char=<id> */
addEventListener('load', () => {
  const q = new URLSearchParams(location.search);
  if (q.get('story') !== null) { startChapter(+q.get('story')); if (q.get('god')) { G.god = true; for (const p of G.players) p.inv = 1e9; } }
  if (!G) {
    if (q.get('coophost') || q.get('coopjoin')) startTestCoop(q);
    return;
  }
  if (q.get('goto')) {
    const want = q.get('goto');
    outer: for (let r = 1; r < 8; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const st = regionStruct(i, j);
      if (st && st.type === want) { if (!st.built) buildStruct(st); for (const p of G.players) { p.x = st.x + (st.door ? 0 : 60); p.y = st.y + (st.door ? 4 : 0); } break outer; }
    }
  }
  if (q.get('ev')) { EVENT_KINDS.length = 0; EVENT_KINDS.push(q.get('ev')); G.eventT = 0.5; }
  if (q.get('dim')) setTimeout(() => enterDimension(q.get('dim')), 200);
  if (q.get('theme')) setTimeout(() => enterCrypt(null, q.get('theme'), { id: 'test' }), 200);
  if (q.get('boss')) { const [x, y] = edgePos(20); makeBoss(q.get('boss'), x, y); }
  if (q.get('relic')) giveRelic(q.get('relic'), ME);
  if (q.get('fuse')) setTimeout(() => {
    const [a, b] = q.get('fuse').split(',');
    for (const id of [a, b]) if (!ME.weapons.find(w => w.id === id)) { P = ME; addWeapon(id); }
    const wa = ME.weapons.find(w => w.id === a), wb = ME.weapons.find(w => w.id === b);
    fuseWeapons(ME, wa, wb, q.get('fail') ? false : true);
  }, +q.get('fuseAt') || 400);
  if (q.get('calm')) { G.xpNext = 1e9; G.eventT = 1e9; G.shrineT = 1e9; G.cryptT = 1e9; }
  if (q.get('modal')) setTimeout(() => openShop(q.get('modal'), null, ME), 300);
});
function startTestCoop(q) {
  Net.myChar = q.get('char') || 'wren';
  if (q.get('coophost')) {
    connect(() => Net.ws.send(JSON.stringify({ t: 'create', code: q.get('coophost') })));
    const iv = setInterval(() => { if (Net.peer && Net.peerChar) { clearInterval(iv); $('btnStartCoop').click(); if (q.get('god')) for (const p of G.players) p.inv = 1e9; } }, 200);
  } else connect(() => Net.ws.send(JSON.stringify({ t: 'join', code: q.get('coopjoin') })));
}
// Headless pilot also clicks through story scenes and dialogs
if (new URLSearchParams(location.search).get('sim')) setInterval(() => {
  if (state === 'dialogue') advanceDialogue();
  else if (state === 'modal' && MODAL) modalPick(0);
}, 300);
