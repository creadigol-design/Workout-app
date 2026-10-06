/* ROUND ONE — pixel art. Sprites are ASCII grids painted onto a canvas once and
 * served as data-URL <img>s (image-rendering: pixelated keeps them crisp). */
(function (root) {
  'use strict';
  const FW = (root.FW = root.FW || {});

  const PAL = {
    K: '#14142b', H: '#2a1810', h: '#f2c84b', R: '#e63946', r: '#a3202c', S: '#f6c394', T: '#d68f5c',
    W: '#f8f8f4', w: '#c3c8d6', B: '#2f6fda', b: '#1c3f8f', Y: '#ffd23f', y: '#c9961f', G: '#9aa0b4',
    g: '#5a6078', N: '#4fd37a', n: '#2a8f50', O: '#ff8c1a', P: '#8a4fff', C: '#5ee2ff',
  };

  // Face-on fighter portraits (20 x 20). Colour keys are swapped per fighter.
  const FIGHTER = [
    '....................',
    '......KKKKKKKK......',
    '.....KHHHHHHHHK.....',
    '....KHHHHHHHHHHK....',
    '....KHHHHHHHHHHK....',
    '...KRRRRRRRRRRRRK...',
    '...KRRRRRRRRRRRRKRR.',
    '....KSSSSSSSSSSK.RR.',
    '....KSKKSSSSKKSK....',
    '....KSKWKSSKWKSK....',
    '....KSSSSSSSSSSK....',
    '....KSSSSTTSSSSK....',
    '.....KSSKKKKSSK.....',
    '.....KSSSSSSSSK.....',
    '......KKSSSSKK......',
    '...KKKKKWWSSWWKKKK..',
    '..KWWWWWWWWWWWWWWK..',
    '.KWWWWWWKWWKWWWWWWK.',
    '.KWWWWWWKRRKWWWWWWK.',
    '.KKKKKKKKKKKKKKKKKK.',
  ];

  const ICONS = {
    barbell: [
      '..............',
      '.KK........KK.',
      'KYYK.KKKK.KYYK',
      'KYYKKGGGGKKYYK',
      'KYYKKGGGGKKYYK',
      'KYYK.KKKK.KYYK',
      '.KK........KK.',
      '..............',
    ],
    dumbbell: [
      '..............',
      '..KK......KK..',
      '.KGGK....KGGK.',
      'KGGGKKKKKKGGGK',
      'KGGGKggggKGGGK',
      '.KGGKKKKKKGGK.',
      '..KK......KK..',
      '..............',
    ],
    kettlebell: [
      '....KKKKKK....',
      '...KG....GK...',
      '...KG....GK...',
      '..KKKKKKKKKK..',
      '.KRRRRRRRRRRK.',
      '.KRRrRRRRRRRK.',
      '.KRRRRRRRRRRK.',
      '..KRRRRRRRRK..',
      '...KKKKKKKK...',
    ],
    bench: [
      '..............',
      '..............',
      'KKKKKKKKKKKKK.',
      'KRRRRRRRRRRRK.',
      'KKKKKKKKKKKKK.',
      '..KG......KG..',
      '..KG......KG..',
      '.KKKK....KKKK.',
    ],
    rack: [
      'KG..........GK',
      'KG..........GK',
      'KGKK......KKGK',
      'KG..........GK',
      'KG..KKKKKK..GK',
      'KG..........GK',
      'KG..........GK',
      'KKKK......KKKK',
    ],
    plate: [
      '....KKKKKK....',
      '..KKYYYYYYKK..',
      '.KYYYYYYYYYYK.',
      '.KYYYKKKKYYYK.',
      'KYYYKKggKKYYYK',
      'KYYYKKggKKYYYK',
      '.KYYYKKKKYYYK.',
      '.KYYYYYYYYYYK.',
      '..KKYYYYYYKK..',
      '....KKKKKK....',
    ],
    pullup: [
      'KKKKKKKKKKKKKK',
      'KGGGGGGGGGGGGK',
      'KKKKKKKKKKKKKK',
      '.K..........K.',
      '.K...KKKK...K.',
      '.K..KSSSSK..K.',
      '.K...KKKK...K.',
      '.....KWWK.....',
      '.....KWWK.....',
    ],
    bands: [
      '...KKKKKKK....',
      '..KPPPPPPPK...',
      '.KPP.....PPK..',
      '.KP.......PK..',
      '.KPP.....PPK..',
      '..KPPPPPPPK...',
      '...KKKKKKK....',
    ],
    cable: [
      'KKKKKKKKKK....',
      'KGGGGGGGGK....',
      'KG.KK.KK.K....',
      'KG.KK.KK.K....',
      'KGGGGGGGGK.KK.',
      'KG......G.KGGK',
      'KG......GKKGGK',
      'KKKKKKKKKK.KK.',
    ],
    wheel: [
      '..............',
      '....KKKKKK....',
      '..KKGGGGGGKK..',
      '.KGGGKKKKGGGK.',
      '.KGGKKggKKGGK.',
      '.KGGGKKKKGGGK.',
      '..KKGGGGGGKK..',
      '....KKKKKK....',
    ],
    box: [
      '..KKKKKKKKKK..',
      '.KOOOOOOOOOOK.',
      'KOOOOOOOOOOOOK',
      'KKKKKKKKKKKKKK',
      'KOOOOKKKOOOOOK',
      'KOOOOKKKOOOOOK',
      'KOOOOOOOOOOOOK',
      '.KKKKKKKKKKKK.',
    ],
    camera: [
      '..............',
      '....KKKK......',
      'KKKKGGGGKKKKK.',
      'KGGGGGGGGGGGK.',
      'KGGGKKKKGGGGK.',
      'KGGKCCCCKGGGK.',
      'KGGKCCCCKGGGK.',
      'KGGGKKKKGGGGK.',
      'KKKKKKKKKKKKK.',
    ],
    lock: [
      '...KKKKKK...',
      '..KGGGGGGK..',
      '..KG....GK..',
      '..KG....GK..',
      '.KKKKKKKKKK.',
      '.KYYYYYYYYK.',
      '.KYYYKKYYYK.',
      '.KYYYKKYYYK.',
      '.KYYYYYYYYK.',
      '.KKKKKKKKKK.',
    ],
    flame: [
      '.....K......',
      '....KOK.....',
      '...KOOK..K..',
      '...KOYOK.KK.',
      '..KOOYOKKOK.',
      '.KOOYYYOOOK.',
      '.KOYYYYYYOK.',
      '.KOYYWWYYOK.',
      '..KOYYYYOK..',
      '...KKKKKK...',
    ],
    star: [
      '.....KK.....',
      '....KYYK....',
      '....KYYK....',
      'KKKKKYYKKKKK',
      'KYYYYYYYYYYK',
      '.KYYYYYYYYK.',
      '..KYYYYYYK..',
      '..KYYKKYYK..',
      '.KYYK..KYYK.',
      '.KKK....KKK.',
    ],
    heart: [
      '.KKK..KKK.',
      'KRRRKKRRRK',
      'KRWRRRRRRK',
      'KRRRRRRRRK',
      '.KRRRRRRK.',
      '..KRRRRK..',
      '...KRRK...',
      '....KK....',
    ],
    trophy: [
      'KKKKKKKKKKKK',
      'KYYYYYYYYYYK',
      'KYYYYYYYYYYK',
      '.KYYYYYYYYK.',
      '..KYYYYYYK..',
      '...KYYYYK...',
      '....KYYK....',
      '....KYYK....',
      '...KKKKKK...',
      '..KYYYYYYK..',
      '..KKKKKKKK..',
    ],
    fist: [
      '..KKKKKKK...',
      '.KSSKSSKSK..',
      'KSSKSSKSSKK.',
      'KSSSSSSSSSSK',
      'KSSSSSSSSSSK',
      'KRRRRRRRRRRK',
      'KRRRRRRRRRRK',
      '.KRRRRRRRRK.',
      '.KKKKKKKKKK.',
    ],
    food: [
      '....KK.KK...',
      '...KNNKNNK..',
      '..KRRRRRRRK.',
      '.KRRRRRRRRRK',
      '.KRRWRRRRRRK',
      '.KRRRRRRRRRK',
      '..KRRRRRRRK.',
      '...KKKKKKK..',
    ],
  };

  const cache = new Map();

  function paint(grid, swap, scale) {
    const h = grid.length, w = Math.max(...grid.map((r) => r.length));
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = h * scale;
    const x = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < grid[y].length; i++) {
        const ch = grid[y][i];
        if (ch === '.') continue;
        x.fillStyle = (swap && swap[ch]) || PAL[ch] || '#f0f';
        x.fillRect(i * scale, y * scale, scale, scale);
      }
    }
    return c.toDataURL();
  }

  const SWAPS = [
    null, // fighter 0: black hair, red headband, white gi
    { H: '#f2c84b', R: '#2f6fda', r: '#1c3f8f', W: '#e8eef8' }, // fighter 1: blond, blue
    { H: '#8a2be2', R: '#4fd37a', r: '#2a8f50', W: '#fff2cf' }, // fighter 2: purple hair, green
  ];

  function fighterUrl(i) {
    const k = 'f' + i;
    if (!cache.has(k)) cache.set(k, paint(FIGHTER, SWAPS[i % SWAPS.length], 8));
    return cache.get(k);
  }
  function iconUrl(name, scale) {
    scale = scale || 3;
    const k = name + scale;
    if (!cache.has(k)) cache.set(k, paint(ICONS[name] || ICONS.box, null, scale));
    return cache.get(k);
  }
  const icon = (name, scale, cls) => '<img class="px ' + (cls || '') + '" alt="" src="' + iconUrl(name, scale) + '">';

  FW.sprites = { fighterUrl, iconUrl, icon, ICONS };
})(window);
