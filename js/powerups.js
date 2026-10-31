'use strict';
/* More power-ups.
   Timed buffs join BUFFS / BASE_BUFFS, so braziers, shrines, crypt chests and shops all hand them out with no extra wiring.
   Rare pickups are one-shot items that drop from props, elites and bosses: a tome, an ice bomb, a phoenix feather and a storm flask. */

/* ---------- Art ---------- */
Object.assign(ICON_ROWS, {
  gale: ['..0000....', '.0lllG0...', '0l0000lG0.', '.00..0lG0.', '.0000lGG0.', '0lllllG00.', '0G0000G0..', '.00..0G0..', '.0lllG0...', '..0000....'],
  giant: ['....00....', '...0WW0...', '..0W55W0..', '.0W5555W0.', '0WW0W50WW0', '..0.W5.0..', '..0.W5.0..', '..0.W5.0..', '..0.WW.0..', '..000000..'],
  tempest: ['...000000.', '..0cccc50.', '..0cc5c0..', '.0cc5c0...', '.0ccccc0..', '..0000c50.', '....0c5c0.', '...0c5c0..', '..0c5c0...', '..000.....'],
  inferno: ['....0.....', '...0o0....', '..0oyo.0..', '.0ooyo0o0.', '.0oyYyoo0.', '0ooyYYyoo0', '0oyYYYyoR0', '0ooyYYyoR0', '.0oooyoRR0', '..0000000.'],
  quake: ['..........', '.0000000..', '0kKKKKKk0.', '0KkkKkKK0.', '00kK00kK00', '.0k0KK0k0.', '..00kk00..', '.0kK0K0k0.', '0kKk00kKk0', '.00000000.'],
  chill: ['....00....', '...0cc0...', '0..0c50..0', '.0c0cc0c0.', '..0ccBcc0.', '0cc5cBc5cc', '..0BcBcB0.', '.0c0cc0c0.', '0..0c50..0', '....00....'],
});
for (const k of ['gale', 'giant', 'tempest', 'inferno', 'quake', 'chill']) { ICON[k] = makeSprite(ICON_ROWS[k]); ICON_URL[k] = ICON[k].c.toDataURL(); }

// New buffs are faceted crystals, so they read differently from the round orbs of the first four
const CRYSTAL = mirror(['...0', '..0X', '.0X5', '0X5X', '0XXX', '.0xX', '..0x', '...0']);
Object.assign(SPR.buff, {
  gale: makeSprite(CRYSTAL, { X: 'l', x: 'G' }),
  giant: makeSprite(CRYSTAL, { X: '4', x: '3' }),
  fortune: makeSprite(CRYSTAL, { X: 'Y', x: 'y' }),
  leech: makeSprite(CRYSTAL, { X: 'm', x: 'P' }),
  tempest: makeSprite(CRYSTAL, { X: 'c', x: 'B' }),
  inferno: makeSprite(CRYSTAL, { X: 'o', x: 'R' }),
  quake: makeSprite(CRYSTAL, { X: 'K', x: 'k' }),
  chill: makeSprite(CRYSTAL, { X: '5', x: 'c' }),
});
SPR.tome = makeSprite(['.000000.', '0PPPPPP0', '0P5mm5P0', '0Pm55mP0', '0P5mm5P0', '0PPPPPP0', '0yyyyyy0', '.000000.']);
SPR.icebomb = makeSprite(['..0000..', '.0cccc0.', '0c5cccc0', '0cc5ccc0', '0cccBcc0', '.0cBBc0.', '..0BB0..', '...00...']);
SPR.phoenix = makeSprite(['......0y', '.....0yo', '....0yYo', '...0yYoR', '..0yYoR0', '.0oYoR0.', '0kyoR0..', '0k00....']);
SPR.storm = makeSprite(['...00...', '..0cc0..', '..0cc0..', '.0PPPP0.', '0PmYYmP0', '0PYYYYP0', '.0PYYP0.', '..0000..']);

/* ---------- Definitions ---------- */
Object.assign(BUFFS, {
  gale: { name: 'Gale', desc: 'move 50% faster', icon: 'gale', color: '#a6e05a', dur: 14 },
  giant: { name: 'Titan Might', desc: 'bigger, harder-hitting attacks', icon: 'giant', color: '#c9c2e0', dur: 14 },
  fortune: { name: 'Fortune', desc: 'luck soars and gold doubles', icon: 'luck', color: '#ffd35a', dur: 20 },
  leech: { name: 'Bloodlust', desc: 'every kill heals you', icon: 'blood', color: '#e27bf0', dur: 15 },
  tempest: { name: 'Tempest', desc: 'lightning smites your foes', icon: 'tempest', color: '#8ff0ff', dur: 12 },
  inferno: { name: 'Inferno', desc: 'a ring of fire burns all near you', icon: 'inferno', color: '#e8742c', dur: 12 },
  quake: { name: 'Quake', desc: 'the ground heaves around you', icon: 'quake', color: '#9a6a42', dur: 12 },
  chill: { name: "Winter's Breath", desc: 'foes near you slow to a crawl', icon: 'chill', color: '#c9f7ff', dur: 14 },
});
BASE_BUFFS.push('gale', 'giant', 'fortune', 'leech', 'tempest', 'inferno', 'quake', 'chill');

const RARES = {
  tome: { name: 'Tome of Knowledge', color: '#e27bf0', w: 4 },
  icebomb: { name: 'Frost Bomb', color: '#c9f7ff', w: 4 },
  phoenix: { name: 'Phoenix Feather', color: '#ffd35a', w: 2 },
  storm: { name: 'Storm Flask', color: '#8ff0ff', w: 3 },
};
function dropRare(x, y) {
  const k = weighted(Object.fromEntries(Object.entries(RARES).map(([id, r]) => [id, r.w])));
  G.items.push({ k, x, y, ph: 0 });
}

/* ---------- Effects ---------- */
const foes = (x, y, r) => query(x, y, r).filter(e => !e.prop && !e.dead);
function smite(e, dmg) {
  const x = e.x + rand(-6, 6), pts = [[x, e.y - 150]];
  for (let i = 1; i < 6; i++) pts.push([x + rand(-14, 14), e.y - 150 + i * 25]);
  pts.push([e.x, e.y]);
  G.fx.push({ k: 'bolt', pts, t: 0, dur: 0.28 });
  for (const o of foes(e.x, e.y, 22)) hitEnemy(o, dmg, null, o.x - e.x, o.y - e.y, 40);
  burst(e.x, e.y, '#8ff0ff', 8, 80);
  Snd.play('nova');
}
const onScreenFoes = () => G.enemies.filter(e => !e.dead && !e.prop && e.dawn === undefined && Math.abs(e.x - ME.x) < W / 2 + 10 && Math.abs(e.y - ME.y) < H / 2 + 10);

const pw = { tempest: 0, inferno: 0, quake: 0 };
Mods.add({
  // gale, giant and fortune change a player's stats, so they re-run recalc
  recalc(p) {
    const b = G && G.buffs;
    if (!b) return;
    if (b.gale > 0) p.speed *= 1.5;
    if (b.giant > 0) { p.area *= 1.35; p.might *= 1.25; }
    if (b.fortune > 0) { p.luck += 4; p.greed *= 2; }
  },
  kill(e) {
    if (G.buffs.leech > 0 && !e.prop) { const heal = e.boss ? 20 : 3; P.hp = Math.min(P.maxHp, P.hp + heal); addText(e.x, e.y - 10, '+' + heal, false, '#e27bf0'); }
  },
  update(dt) {
    const b = G.buffs, st = G.pwOn = G.pwOn || {};
    let changed = false;
    for (const k of ['gale', 'giant', 'fortune']) if ((b[k] > 0) !== !!st[k]) { st[k] = b[k] > 0; changed = true; }
    if (changed) { for (const pl of G.players) { P = pl; recalc(); } P = ME; }

    if (b.tempest > 0) {
      pw.tempest -= dt;
      if (pw.tempest <= 0) {
        pw.tempest = 0.3;
        const pool = G.enemies.filter(e => !e.dead && !e.prop && e.dawn === undefined && G.players.some(pl => !pl.down && Math.hypot(e.x - pl.x, e.y - pl.y) < 200));
        if (pool.length) smite(pick(pool), 30 + G.level * 6);
      }
    }
    for (const pl of G.players) {
      if (pl.down) continue;
      if (b.inferno > 0) {
        if (Math.random() < dt * 60) { const a = rand(0, TAU); addPart(pl.x + Math.cos(a) * 42, pl.y + 2 + Math.sin(a) * 30, rand(-6, 6), rand(-34, -14), rand(0.3, 0.55), pick(['#ffd35a', '#e8742c', '#d8354a']), Math.random() < 0.3 ? 2 : 1, 0, 2); }
      }
      if (b.chill > 0) {
        if (Math.random() < dt * 30) { const a = rand(0, TAU); addPart(pl.x + Math.cos(a) * rand(20, 90), pl.y + Math.sin(a) * rand(14, 60), rand(-10, 10), rand(8, 24), rand(0.5, 0.9), pick(['#c9f7ff', '#f2eee6', '#8ff0ff']), 1, 0, 1); }
        for (const e of foes(pl.x, pl.y, 90)) if (!e.boss) e.slow = Math.max(e.slow || 0, 0.25);
      }
    }
    if (b.inferno > 0) {
      pw.inferno -= dt;
      if (pw.inferno <= 0) {
        pw.inferno = 0.25;
        for (const pl of G.players) { if (pl.down) continue; P = pl; for (const e of foes(pl.x, pl.y, 44)) hitEnemy(e, 6 + G.level * 1.5, null, e.x - pl.x, e.y - pl.y, 12); }
        P = ME;
      }
    }
    if (b.quake > 0) {
      pw.quake -= dt;
      if (pw.quake <= 0) {
        pw.quake = 1.5;
        for (const pl of G.players) {
          if (pl.down) continue;
          P = pl;
          for (const e of foes(pl.x, pl.y, 90)) hitEnemy(e, 14 + G.level * 3, null, e.x - pl.x, e.y - pl.y, 140);
          G.fx.push({ k: 'shock', x: pl.x, y: pl.y + 4, t: 0, dur: 0.45, r: 90 });
          G.fx.push({ k: 'ring', x: pl.x, y: pl.y + 6, t: 0, dur: 0.4, r: 90, c: '#9a6a42' });
          BossFx.addDecal(pl.x, pl.y + 6, { kind: 'crater', r: 30, env: BossFx.ENVS.dust, life: 3 });
          BossFx.dust(pl.x, pl.y + 6, BossFx.ENVS.dust, 14, 2);
        }
        P = ME;
        G.shake = Math.max(G.shake, 3);
        Snd.play('boom');
      }
    }
  },
  drawGround() {
    if (!G.buffs.inferno) return;
    for (const pl of G.players) if (!pl.down && G.buffs.inferno > 0) { light(pl.x, pl.y, 54, 0.8); glowAt(pl.x, pl.y, 30, '#e8742c', 0.3); }
  },
  // Rare pickups
  pickup(it) {
    const r = RARES[it.k];
    if (!r) return;
    addText(P.x, P.y - 18, r.name, false, r.color);
    G.fx.push({ k: 'ring', x: P.x, y: P.y, t: 0, dur: 0.45, r: 56, c: r.color });
    Snd.play('buff');
    switch (it.k) {
      case 'tome': gainXp((G.xpNext - G.xp) / P.growth + 0.01); Snd.play('levelup'); break;
      case 'icebomb':
        for (const e of onScreenFoes()) { if (e.boss) e.slow = Math.max(e.slow || 0, 4); else e.freeze = 5; burst(e.x, e.y, '#c9f7ff', 6, 70); }
        G.whiteFlash = 0.6; G.shake = Math.max(G.shake, 4); Snd.play('nova'); break;
      case 'phoenix': G.revivals++; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.4); break;
      case 'storm': {
        const dmg = 120 + G.level * 8;
        for (const e of onScreenFoes().sort(() => Math.random() - 0.5).slice(0, 14)) smite(e, e.boss ? dmg * 2 : dmg);
        G.whiteFlash = 0.5; G.shake = Math.max(G.shake, 5); break;
      }
    }
  },
  // Rare pickups glow in their own colour
  ents() {
    for (const it of G.items) if (RARES[it.k] && onScreen(it.x, it.y, 12)) { glowAt(it.x, it.y, 16, RARES[it.k].color, 0.45 + Math.sin(performance.now() / 160) * 0.2); if (Math.random() < 0.06) addPart(it.x + rand(-4, 4), it.y - 4, 0, -16, 0.5, RARES[it.k].color); }
  },
});
