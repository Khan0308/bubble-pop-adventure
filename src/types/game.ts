export type BubbleColor = 'red' | 'blue' | 'yellow' | 'purple' | 'green' | 'orange';

export type SpecialKind =
  | 'normal'
  | 'rainbow'
  | 'bomb'
  | 'lightning'
  | 'fire'
  | 'star_trap'
  | 'stone';

export type PowerUpType =
  | 'rainbow'
  | 'bomb'
  | 'lightning'
  | 'fire'
  | 'color_changer'
  | 'extra_shots';

export type WorldId = 'candy' | 'forest' | 'ocean' | 'space';

export type ObjectiveType =
  | 'clear_all'
  | 'collect_color'
  | 'rescue_stars'
  | 'clear_obstacles';

export type LanguageCode = 'en' | 'es' | 'fr' | 'ar';

export type ScreenId =
  | 'splash'
  | 'menu'
  | 'worlds'
  | 'levels'
  | 'gameplay'
  | 'shop'
  | 'daily'
  | 'missions'
  | 'achievements'
  | 'settings';

export interface CellData {
  color: BubbleColor;
  kind: SpecialKind;
}

export interface LevelObjective {
  type: ObjectiveType;
  targetColor?: BubbleColor;
  targetCount: number;
}

export interface LevelConfig {
  id: number; // 1..200
  worldId: WorldId;
  levelInWorld: number; // 1..50
  title: string;
  availableColors: BubbleColor[];
  shots: number;
  objective: LevelObjective;
  starThresholds: [number, number, number];
  coinReward: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  layoutPattern: string;
  rows: (CellData | null)[][];
}

export interface WorldInfo {
  id: WorldId;
  name: string;
  subtitle: string;
  levelRange: [number, number];
  unlockLevel: number;
  unlockStars: number;
  backgroundUrl: string;
  accentHex: string;
  panelBgClass: string;
  gradientClass: string;
  badgeText: string;
}

export interface ShopItem {
  id: string;
  category: 'powerup' | 'bubble_theme' | 'launcher' | 'background';
  name: string;
  description: string;
  price: number;
  powerUpType?: PowerUpType;
  grantAmount?: number;
  cosmeticKey?: string;
}

export interface MissionDef {
  id: string;
  title: string;
  target: number;
  rewardCoins: number;
  statKey: 'popped' | 'levels' | 'score' | 'powerups' | 'three_stars';
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  target: number;
  rewardCoins: number;
  statKey:
    | 'totalPopped'
    | 'levelsCompleted'
    | 'threeStarLevels'
    | 'powerUpsUsed'
    | 'worldsUnlocked';
}

export interface LevelProgress {
  stars: 1 | 2 | 3;
  bestScore: number;
}

export interface GameSettings {
  music: boolean;
  sound: boolean;
  musicVolume: number;
  soundVolume: number;
  vibration: boolean;
  language: LanguageCode;
  handedness: 'right' | 'left';
}

export interface SaveData {
  version: number;
  unlockedLevel: number;
  completedLevels: Record<number, LevelProgress>;
  coins: number;
  inventory: Record<PowerUpType, number>;
  purchasedCosmetics: string[];
  equipped: {
    bubbleTheme: string;
    launcher: string;
    background: string;
  };
  dailyRewards: {
    lastClaimDate: string | null;
    streakDay: number;
  };
  missions: {
    date: string;
    progress: Record<string, number>;
    claimed: string[];
  };
  achievements: Record<string, { claimed: boolean }>;
  stats: {
    totalPopped: number;
    levelsCompleted: number;
    threeStarLevels: number;
    powerUpsUsed: number;
    totalScore: number;
    worldsUnlocked: number;
  };
  settings: GameSettings;
}
