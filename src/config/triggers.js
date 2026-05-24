// PRD 4-3, 4-4 기준 후원/채팅 트리거 목록 (시청자 안내용)
// type: 'donate' | 'chat' | 'sub'
// 라이브 화면 하단 패널에서 시청자가 무엇을 할 수 있는지 보여준다.

export const TRIGGERS = [
  // 폭발 계열
  { type: 'donate', label: 'BOMB',       price: '$1',   effect: '3×3 explosion',   icon: 'bomb',     color: 0xFFC107 },
  { type: 'donate', label: 'ULTRA BOMB', price: '$3',   effect: '5×5 + FX',         icon: 'bomb2',    color: 0xFF9800 },
  { type: 'donate', label: 'MEGA BLAST', price: '$5',   effect: '7×7 dynamite',     icon: 'dynamite', color: 0xF44336 },
  { type: 'donate', label: 'NUKE',       price: '$20',  effect: 'Half-screen blast',icon: 'nuke',     color: 0xE91E63 },

  // 드릴 계열
  { type: 'donate', label: 'DRILL UP',   price: '$2',   effect: '+1 power 30s',     icon: 'drillUp',  color: 0xCDDC39 },
  { type: 'donate', label: 'TURBO',      price: '$5',   effect: '3× speed 15s',     icon: 'turbo',    color: 0x4CAF50 },
  { type: 'donate', label: 'OVERDRIVE',  price: '$10',  effect: '5× speed 20s',     icon: 'overdrive',color: 0x00BCD4 },

  // 광물 계열
  { type: 'donate', label: 'GOLD RUSH',  price: '$3',   effect: 'Gold layer',       icon: 'gold',     color: 0xFFD700 },
  { type: 'donate', label: 'GEM DROP',   price: '$5',   effect: 'Gem cluster',      icon: 'gem',      color: 0x2196F3 },
  { type: 'donate', label: 'DIAMOND',    price: '$10',  effect: '3 diamonds + FX',  icon: 'diamond',  color: 0xB9F6CA },
  { type: 'donate', label: 'SPECIAL',    price: '$15',  effect: 'Biome ore',        icon: 'special',  color: 0xBA68C8 },

  // 채팅 (무료)
  { type: 'chat',   label: '!fast',      price: 'CHAT', effect: 'Drill ×1.5 / 10s', icon: 'chat',     color: 0xFFFFFF },
  { type: 'chat',   label: '!boss',      price: 'CHAT', effect: 'Next boss info',   icon: 'info',     color: 0xFFFFFF },

  // 구독/멤버십
  { type: 'sub',    label: 'SUB',        price: 'NEW',  effect: 'Special ore',      icon: 'sub',      color: 0xF06292 },
  { type: 'sub',    label: 'MEMBER',     price: 'JOIN', effect: 'DIAMOND + name',   icon: 'member',   color: 0xAB47BC },
];
