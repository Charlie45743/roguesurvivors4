'use strict';
/* Game data: weapons, passives, enemies, characters, waves, events, altar.
   Weapon level deltas: dmg/amount/pierce add; area adds to a 1.0 base; cd/speed/dur multiply by (1 + x). */

const WEAPONS = {
  bolt: {
    name: 'Ember Bolt', unit: 'bolt', desc: 'Hurls fireballs at the nearest foe.',
    evo: 'haste', evoName: 'Phoenix Barrage', evoDesc: 'A ceaseless volley of fireballs that burst on impact.',
    base: { dmg: 12, cd: 1.05, amount: 1, area: 1, speed: 230, pierce: 1, dur: 1.6 },
    lv: [{ amount: 1 }, { dmg: 6 }, { cd: -0.15 }, { amount: 1 }, { pierce: 1 }, { dmg: 8 }, { amount: 1 }],
    evoStats: { dmg: 30, cd: 0.42, amount: 5, pierce: 3, area: 1.3, speed: 280 },
  },
  scythe: {
    name: 'Grave Scythe', unit: 'swing', desc: 'Reaps everything in a wide arc ahead of you.',
    evo: 'might', evoName: "Reaper's Crescent", evoDesc: 'A full circle of death. Each kill mends you.',
    base: { dmg: 20, cd: 1.35, amount: 1, area: 1, speed: 1, pierce: 0, dur: 1 },
    lv: [{ amount: 1 }, { dmg: 10 }, { area: 0.15 }, { dmg: 10 }, { cd: -0.15 }, { area: 0.2 }, { dmg: 15 }],
    evoStats: { dmg: 75, cd: 0.85, amount: 2, area: 1.75 },
  },
  wisps: {
    name: 'Soul Wisps', unit: 'wisp', desc: 'Spirits circle you, burning whatever they touch.',
    evo: 'duration', evoName: 'Spirit Halo', evoDesc: 'The halo never fades. Six wisps, forever.',
    base: { dmg: 9, cd: 3.2, amount: 2, area: 1, speed: 3.4, pierce: 0, dur: 3.2 },
    lv: [{ amount: 1 }, { dmg: 5 }, { dur: 0.3 }, { amount: 1 }, { speed: 0.25 }, { dmg: 7 }, { amount: 1 }],
    evoStats: { dmg: 32, cd: 0.1, amount: 6, area: 1.35, speed: 5.2, dur: 99999 },
  },
  nova: {
    name: 'Hex Nova', unit: 'ring', desc: 'Periodic shockwave that hurls enemies away.',
    evo: 'area', evoName: 'Cataclysm', evoDesc: 'Triple shockwaves that leave survivors crawling.',
    base: { dmg: 16, cd: 2.6, amount: 1, area: 1, speed: 1, pierce: 0, dur: 1 },
    lv: [{ dmg: 6 }, { area: 0.15 }, { cd: -0.1 }, { dmg: 8 }, { area: 0.15 }, { cd: -0.15 }, { dmg: 10 }],
    evoStats: { dmg: 55, cd: 1.6, amount: 3, area: 1.9 },
  },
  chain: {
    name: 'Storm Chain', unit: 'strike', desc: 'Lightning strikes a foe and leaps to others.',
    evo: 'amount', evoName: 'Thunderlord', evoDesc: 'The sky itself turns on your enemies.',
    base: { dmg: 15, cd: 1.8, amount: 1, area: 1, speed: 1, pierce: 3, dur: 1 },
    lv: [{ dmg: 6 }, { pierce: 1 }, { amount: 1 }, { cd: -0.15 }, { pierce: 1 }, { dmg: 10 }, { amount: 1 }],
    evoStats: { dmg: 45, cd: 0.9, amount: 6, pierce: 7 },
  },
  frost: {
    name: 'Rime Shards', unit: 'shard', desc: 'A ring of ice shards that slows what they pierce.',
    evo: 'armor', evoName: 'Absolute Zero', evoDesc: 'Shards freeze enemies solid.',
    base: { dmg: 10, cd: 1.7, amount: 6, area: 1, speed: 170, pierce: 1, dur: 1.4 },
    lv: [{ amount: 2 }, { dmg: 5 }, { pierce: 1 }, { amount: 2 }, { cd: -0.15 }, { dmg: 7 }, { amount: 2 }],
    evoStats: { dmg: 34, cd: 1.0, amount: 24, pierce: 4, speed: 200 },
  },
  glaive: {
    name: 'Moon Glaive', unit: 'glaive', desc: 'A spinning blade that returns to your hand.',
    evo: 'speed', evoName: 'Eclipse Glaive', evoDesc: 'Golden glaives that carve the whole battlefield.',
    base: { dmg: 14, cd: 1.6, amount: 1, area: 1, speed: 200, pierce: 0, dur: 1 },
    lv: [{ dmg: 6 }, { amount: 1 }, { speed: 0.2 }, { area: 0.2 }, { dmg: 8 }, { amount: 1 }, { dmg: 10 }],
    evoStats: { dmg: 40, cd: 1.0, amount: 5, area: 1.6, speed: 280 },
  },
  cinder: {
    name: 'Cinder Flask', unit: 'flask', desc: 'Lobs flasks that leave pools of fire.',
    evo: 'vitality', evoName: 'Hellfire Garden', evoDesc: 'Huge, lasting blazes that also slow the damned.',
    base: { dmg: 6, cd: 2.4, amount: 1, area: 1, speed: 1, pierce: 0, dur: 2.6 },
    lv: [{ amount: 1 }, { dmg: 3 }, { area: 0.2 }, { dur: 0.3 }, { amount: 1 }, { dmg: 5 }, { area: 0.2 }],
    evoStats: { dmg: 16, cd: 1.6, amount: 5, area: 1.9, dur: 4.5 },
  },
  starfall: {
    name: 'Starfall', unit: 'star', desc: 'Calls burning stars down on distant foes.',
    evo: 'luck', evoName: 'Cataclysmic Rain', evoDesc: 'The sky empties itself onto the battlefield.',
    base: { dmg: 30, cd: 2.4, amount: 1, area: 1, speed: 1, pierce: 0, dur: 1 },
    lv: [{ amount: 1 }, { dmg: 12 }, { area: 0.2 }, { cd: -0.15 }, { amount: 1 }, { dmg: 15 }, { area: 0.2 }],
    evoStats: { dmg: 70, cd: 1.4, amount: 6, area: 1.6 },
  },
  lance: {
    name: 'Bone Lance', unit: 'lance', desc: 'Fires piercing lances the way you are moving.',
    evo: 'blood', evoName: 'Impaler', evoDesc: 'Lances pierce everything, and every kill feeds you.',
    base: { dmg: 14, cd: 0.9, amount: 1, area: 1, speed: 300, pierce: 3, dur: 0.9 },
    lv: [{ amount: 1 }, { dmg: 6 }, { pierce: 2 }, { cd: -0.15 }, { amount: 1 }, { dmg: 8 }, { pierce: 3 }],
    evoStats: { dmg: 40, cd: 0.5, amount: 4, pierce: 999, speed: 380, dur: 1.1 },
  },
  aura: {
    name: 'Thorn Aura', unit: 'thorn', desc: 'A ring of thorns that bites anything close.',
    evo: 'thorns', evoName: 'Bramble Crown', evoDesc: 'A vast briar that shreds and slows the horde.',
    base: { dmg: 5, cd: 0.55, amount: 0, area: 1, speed: 1, pierce: 0, dur: 1 },
    lv: [{ area: 0.15 }, { dmg: 3 }, { cd: -0.1 }, { area: 0.15 }, { dmg: 4 }, { cd: -0.1 }, { area: 0.2 }],
    evoStats: { dmg: 18, cd: 0.35, area: 1.9 },
  },
  totem: {
    name: 'Ember Totem', unit: 'totem', desc: 'Plants totems that shoot at nearby enemies.',
    evo: 'magnet', evoName: 'Siege Pylon', evoDesc: 'Pylons that hammer the horde with triple volleys.',
    base: { dmg: 10, cd: 6, amount: 1, area: 1, speed: 220, pierce: 1, dur: 5 },
    lv: [{ dur: 0.3 }, { dmg: 4 }, { amount: 1 }, { cd: -0.15 }, { dmg: 6 }, { dur: 0.3 }, { amount: 1 }],
    evoStats: { dmg: 24, cd: 4.5, amount: 3, dur: 9, pierce: 2 },
  },
};
const WEAPON_MAX = id => WEAPONS[id].lv.length + 1;

const PASSIVES = {
  might: { name: 'Ember Sigil', desc: '+10% damage', max: 5 },
  haste: { name: 'Clockwork Tome', desc: '-8% weapon cooldowns', max: 5 },
  area: { name: 'Wide Lens', desc: '+10% attack area', max: 5 },
  amount: { name: 'Echo Charm', desc: '+1 projectile on every weapon', max: 2 },
  duration: { name: 'Hourglass', desc: '+12% effect duration', max: 5 },
  speed: { name: 'Wingboots', desc: '+10% move speed', max: 5 },
  vitality: { name: 'Heart Vessel', desc: '+20 max HP, +0.3 HP/s regen', max: 5 },
  magnet: { name: 'Lodestone', desc: '+35% pickup range', max: 5 },
  growth: { name: "Scholar's Crown", desc: '+10% experience', max: 5 },
  armor: { name: 'Iron Plate', desc: '+1 armor (less damage per hit)', max: 5 },
  luck: { name: "Gambler's Die", desc: '+1 luck: more crits, better chests and shrines', max: 5 },
  blood: { name: 'Bloodthirst', desc: 'Every kill heals 0.12 HP', max: 5 },
  thorns: { name: 'Thorn Mail', desc: 'When hit, lash out at everything nearby', max: 5 },
  midas: { name: 'Midas Ring', desc: '+25% gold, and enemies drop more coins', max: 5 },
};

// Temporary world power-ups (dropped by braziers, rarely by enemies, and from shrines)
const BUFFS = {
  rage: { name: 'Rage', desc: 'double damage', icon: 'might', color: '#d8354a', dur: 12 },
  frenzy: { name: 'Frenzy', desc: 'weapons fire 80% faster', icon: 'chain', color: '#ffd35a', dur: 12 },
  aegis: { name: 'Aegis', desc: 'you cannot be hurt', icon: 'armor', color: '#3f8ee0', dur: 8 },
  timestop: { name: 'Timestop', desc: 'enemies and bullets freeze', icon: 'duration', color: '#8ff0ff', dur: 6 },
};

// Shrine of Fortune: one outcome is rolled, and the reels show its symbol three times
const SHRINE_OUTCOMES = [
  { id: 'nothing', w: 32, sym: null, title: 'Nothing', color: '#a59cc4' },
  { id: 'gold', w: 14, sym: 'gold', title: 'Fortune returns', color: '#ffd35a' },
  { id: 'heal', w: 10, sym: 'heal', title: 'Blessed', color: '#a6e05a' },
  { id: 'buff', w: 12, sym: 'rune', title: 'Empowered', color: '#e27bf0' },
  { id: 'upgrade', w: 16, sym: 'star', title: 'A gift', color: '#8ff0ff' },
  { id: 'curse', w: 10, sym: 'skull', title: 'Cursed!', color: '#d8354a' },
  { id: 'jackpot', w: 6, sym: 'growth', title: 'Jackpot!', color: '#ffd35a' },
];
const SHRINE_SYMS = ['gold', 'heal', 'rune', 'star', 'skull', 'growth'];

const ENEMIES = {
  bat: { hp: 7, spd: 62, dmg: 6, xp: 1, r: 5, spr: 'bat', anim: 0.11, color: '#5e557f' },
  slime: { hp: 16, spd: 32, dmg: 8, xp: 1, r: 6, spr: 'slime', anim: 0.28, color: '#4fa04a' },
  skel: { hp: 32, spd: 40, dmg: 10, xp: 2, r: 6, spr: 'skel', anim: 0.22, color: '#f2eee6' },
  eye: { hp: 28, spd: 42, dmg: 8, xp: 2, r: 6, spr: 'eye', anim: 0.9, color: '#3f8ee0', shoot: 3.4 },
  ghoul: { hp: 70, spd: 36, dmg: 14, xp: 3, r: 7, spr: 'ghoul', anim: 0.25, color: '#a6e05a', kb: 0.6 },
  wraith: { hp: 110, spd: 58, dmg: 16, xp: 4, r: 6, spr: 'wraith', anim: 0.2, color: '#a59cc4', kb: 0.7 },
  knight: { hp: 650, spd: 34, dmg: 22, xp: 30, r: 9, spr: 'knight', anim: 0.3, color: '#b5b2c4', kb: 0.15, elite: true },
};

const BOSSES = [
  { name: 'Bone Colossus', hp: 3000, spd: 40, bullets: 14, swap: { r: '2', R: '3', y: 'c', o: 'B', Y: '5' }, color: '#a59cc4' },
  { name: 'The Rotting Mother', hp: 11000, spd: 46, bullets: 20, swap: { r: 'g', R: 'G', y: 'l', o: 'G', Y: 'Y' }, color: '#4fa04a' },
  { name: 'The Ashen Maw', hp: 32000, spd: 50, bullets: 28, swap: null, color: '#d8354a' },
];

const CHARS = [
  { id: 'wren', name: 'Wren', title: 'the Ashwalker', weapon: 'bolt', desc: '+10% move speed.', mods: { speed: 0.1 } },
  { id: 'morrow', name: 'Morrow', title: 'the Gravekeeper', weapon: 'scythe', desc: '+30 max HP, +1 armor.', mods: { maxHp: 30, armor: 1 } },
  { id: 'isolde', name: 'Isolde', title: 'the Stormcaller', weapon: 'chain', desc: '+15% attack area.', mods: { area: 0.15 } },
  { id: 'pell', name: 'Pell', title: 'the Alchemist', weapon: 'cinder', desc: '+20% duration, +1 luck.', mods: { duration: 0.2, luck: 1 }, cost: 250 },
  { id: 'nyx', name: 'Nyx', title: 'the Frostborn', weapon: 'frost', desc: '-10% cooldowns.', mods: { cooldown: 0.1 }, cost: 300 },
  { id: 'brask', name: 'Brask', title: 'the Ironclad', weapon: 'glaive', desc: '+2 armor, +20 max HP, -10% speed.', mods: { armor: 2, maxHp: 20, speed: -0.1 }, cost: 350 },
  { id: 'sable', name: 'Sable', title: 'the Hexer', weapon: 'nova', desc: '+15% damage, +30% pickup range.', mods: { might: 0.15, magnet: 0.3 }, cost: 450 },
  { id: 'vesper', name: 'Vesper', title: 'the Hollow', weapon: 'wisps', desc: '+1 projectile, -30 max HP.', mods: { amount: 1, maxHp: -30 }, cost: 600 },
];

// One entry per minute of the run (15 minutes)
const WAVES = [
  { types: { bat: 4, slime: 2 }, rate: 1.4 },
  { types: { bat: 3, slime: 4 }, rate: 2.2 },
  { types: { bat: 2, slime: 3, skel: 3 }, rate: 3.2 },
  { types: { skel: 4, eye: 2, bat: 2 }, rate: 4.2 },
  { types: { skel: 3, eye: 2, ghoul: 2, bat: 2 }, rate: 5.2 },
  { types: { ghoul: 3, skel: 3, eye: 2 }, rate: 5.5 },
  { types: { ghoul: 4, eye: 3, bat: 4 }, rate: 7 },
  { types: { ghoul: 3, wraith: 2, eye: 2, skel: 2 }, rate: 8 },
  { types: { wraith: 3, ghoul: 3, bat: 5 }, rate: 9.5 },
  { types: { wraith: 4, eye: 3, ghoul: 3 }, rate: 10.5 },
  { types: { wraith: 4, ghoul: 4, skel: 4 }, rate: 11 },
  { types: { wraith: 5, eye: 4, bat: 6 }, rate: 13 },
  { types: { wraith: 5, ghoul: 5, skel: 3 }, rate: 15 },
  { types: { wraith: 6, eye: 4, ghoul: 4 }, rate: 17 },
  { types: { wraith: 6, ghoul: 6, bat: 8 }, rate: 20 },
];

const EVENTS = [
  { t: 45, k: 'swarm', type: 'bat', n: 24 },
  { t: 100, k: 'elite', n: 1 },
  { t: 150, k: 'ring', type: 'slime', n: 36 },
  { t: 200, k: 'swarm', type: 'bat', n: 40 },
  { t: 240, k: 'elite', n: 1 },
  { t: 290, k: 'warn', tier: 0 },
  { t: 300, k: 'boss', tier: 0 },
  { t: 370, k: 'ring', type: 'skel', n: 44 },
  { t: 420, k: 'elite', n: 2 },
  { t: 480, k: 'swarm', type: 'bat', n: 60 },
  { t: 540, k: 'ring', type: 'ghoul', n: 48 },
  { t: 590, k: 'warn', tier: 1 },
  { t: 600, k: 'boss', tier: 1 },
  { t: 660, k: 'elite', n: 2 },
  { t: 720, k: 'ring', type: 'wraith', n: 56 },
  { t: 780, k: 'swarm', type: 'bat', n: 80 },
  { t: 820, k: 'elite', n: 3 },
  { t: 860, k: 'ring', type: 'ghoul', n: 60 },
  { t: 890, k: 'warn', tier: 2 },
  { t: 900, k: 'boss', tier: 2 },
];
const RUN_LENGTH = 900;

const ALTAR = [
  { id: 'might', name: 'Might', desc: '+5% damage per rank', max: 5, base: 80, icon: 'might' },
  { id: 'vit', name: 'Vitality', desc: '+10 max HP per rank', max: 5, base: 60, icon: 'vitality' },
  { id: 'haste', name: 'Haste', desc: '-3% cooldowns per rank', max: 3, base: 120, icon: 'haste' },
  { id: 'swift', name: 'Swiftness', desc: '+4% move speed per rank', max: 3, base: 70, icon: 'speed' },
  { id: 'magnet', name: 'Reach', desc: '+15% pickup range per rank', max: 3, base: 50, icon: 'magnet' },
  { id: 'growth', name: 'Insight', desc: '+5% experience per rank', max: 5, base: 90, icon: 'growth' },
  { id: 'greed', name: 'Greed', desc: '+10% gold per rank', max: 5, base: 60, icon: 'gold' },
  { id: 'reroll', name: 'Fortune', desc: '+1 reroll per run', max: 3, base: 100, icon: 'amount' },
  { id: 'fate', name: 'Fate', desc: '+1 luck per rank', max: 3, base: 110, icon: 'luck' },
  { id: 'revival', name: 'Second Dawn', desc: 'Rise once after falling', max: 1, base: 700, icon: 'heal' },
];
const altarCost = (a, rank) => Math.round(a.base * (1 + rank * 0.9));

function xpFor(level) {
  if (level < 20) return 5 + (level - 1) * 10;
  if (level < 40) return 195 + (level - 20) * 13;
  return 455 + (level - 40) * 16;
}
