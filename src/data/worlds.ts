import { WorldInfo } from '../types/game';

export const GAME_LOGO_URL = '/src/assets/images/game_logo_emblem_1795634724200.jpg';

export const WORLDS: WorldInfo[] = [
  {
    id: 'candy',
    name: 'Candy Land',
    subtitle: 'Frosted peaks, marshmallow skies & sweet pops',
    levelRange: [1, 50],
    unlockLevel: 1,
    unlockStars: 0,
    backgroundUrl: '/src/assets/images/world_candy_land_1795634722520.jpg',
    accentHex: '#ec4899',
    panelBgClass: 'from-pink-500/90 to-rose-600/90',
    gradientClass: 'from-pink-500 via-rose-400 to-amber-300',
    badgeText: 'Levels 1–50',
  },
  {
    id: 'forest',
    name: 'Magic Forest',
    subtitle: 'Glowing mushrooms, enchanted canopies & fireflies',
    levelRange: [51, 100],
    unlockLevel: 51,
    unlockStars: 40,
    backgroundUrl: '/src/assets/images/world_magic_forest_1795634724057.jpg',
    accentHex: '#10b981',
    panelBgClass: 'from-emerald-600/90 to-teal-700/90',
    gradientClass: 'from-emerald-500 via-teal-400 to-lime-300',
    badgeText: 'Levels 51–100',
  },
  {
    id: 'ocean',
    name: 'Ocean World',
    subtitle: 'Sunlit reefs, coral gardens & rising bubbles',
    levelRange: [101, 150],
    unlockLevel: 101,
    unlockStars: 95,
    backgroundUrl: '/src/assets/images/world_ocean_world_1795634723021.jpg',
    accentHex: '#0ea5e9',
    panelBgClass: 'from-sky-600/90 to-blue-700/90',
    gradientClass: 'from-cyan-400 via-sky-500 to-blue-600',
    badgeText: 'Levels 101–150',
  },
  {
    id: 'space',
    name: 'Space Adventure',
    subtitle: 'Starlit nebulas, ringed planets & cosmic bursts',
    levelRange: [151, 200],
    unlockLevel: 151,
    unlockStars: 160,
    backgroundUrl: '/src/assets/images/world_space_adventure_1795634723795.jpg',
    accentHex: '#8b5cf6',
    panelBgClass: 'from-violet-600/90 to-indigo-800/90',
    gradientClass: 'from-violet-500 via-indigo-500 to-cyan-400',
    badgeText: 'Levels 151–200',
  },
];

export function getWorldById(id: WorldInfo['id']): WorldInfo {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
