export const ORES = {
  coal:        { id: 'coal',        name: 'Coal',         value: 5,     color: 0x1a1a1a, rarity: 'common'    },
  copper:      { id: 'copper',      name: 'Copper',       value: 12,    color: 0xb87333, rarity: 'common'    },
  iron:        { id: 'iron',        name: 'Iron',         value: 25,    color: 0x9e9e9e, rarity: 'common'    },
  gold:        { id: 'gold',        name: 'Gold',         value: 60,    color: 0xffd700, rarity: 'uncommon'  },
  crystal:     { id: 'crystal',     name: 'Crystal',      value: 100,   color: 0xb39ddb, rarity: 'uncommon'  },
  amethyst:    { id: 'amethyst',    name: 'Amethyst',     value: 200,   color: 0x9c27b0, rarity: 'rare'      },
  sapphire:    { id: 'sapphire',    name: 'Sapphire',     value: 400,   color: 0x2196f3, rarity: 'rare'      },
  emerald:     { id: 'emerald',     name: 'Emerald',      value: 800,   color: 0x4caf50, rarity: 'epic'      },
  diamond:     { id: 'diamond',     name: 'Diamond',      value: 2000,  color: 0xb9f6ca, rarity: 'epic'      },
  ruby:        { id: 'ruby',        name: 'Ruby',         value: 2500,  color: 0xe53935, rarity: 'epic'      },
  lavaCrystal: { id: 'lavaCrystal', name: 'Lava Crystal', value: 5000,  color: 0xff5722, rarity: 'legendary' },
  voidStone:   { id: 'voidStone',   name: 'Void Stone',   value: 10000, color: 0xede7f6, rarity: 'legendary' },
};

export const ORE_IDS = Object.keys(ORES);
