import { SaveData } from '../types/game';

const SAVE_KEY = 'bubble_pop_adventure_save_v1';

export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createDefaultSave(): SaveData {
  return {
    version: 1,
    unlockedLevel: 1,
    completedLevels: {},
    coins: 200,
    inventory: {
      rainbow: 2,
      bomb: 2,
      lightning: 1,
      fire: 1,
      color_changer: 2,
      extra_shots: 2,
    },
    purchasedCosmetics: ['theme_classic', 'launcher_royal', 'bg_world'],
    equipped: {
      bubbleTheme: 'classic',
      launcher: 'royal',
      background: 'world',
    },
    dailyRewards: {
      lastClaimDate: null,
      streakDay: 0,
    },
    missions: {
      date: getTodayKey(),
      progress: {
        popped: 0,
        levels: 0,
        score: 0,
        powerups: 0,
        three_stars: 0,
      },
      claimed: [],
    },
    achievements: {},
    stats: {
      totalPopped: 0,
      levelsCompleted: 0,
      threeStarLevels: 0,
      powerUpsUsed: 0,
      totalScore: 0,
      worldsUnlocked: 1,
    },
    settings: {
      music: true,
      sound: true,
      musicVolume: 0.45,
      soundVolume: 0.75,
      vibration: true,
      language: 'en',
      handedness: 'right',
    },
  };
}

function sanitizeSave(raw: unknown): SaveData {
  const def = createDefaultSave();
  if (!raw || typeof raw !== 'object') return def;
  const obj = raw as Record<string, unknown>;

  const merged: SaveData = {
    version: 1,
    unlockedLevel:
      typeof obj.unlockedLevel === 'number' && obj.unlockedLevel >= 1 && obj.unlockedLevel <= 200
        ? Math.floor(obj.unlockedLevel)
        : def.unlockedLevel,
    completedLevels: {},
    coins:
      typeof obj.coins === 'number' && Number.isFinite(obj.coins) && obj.coins >= 0
        ? Math.floor(obj.coins)
        : def.coins,
    inventory: {
      ...def.inventory,
      ...(typeof obj.inventory === 'object' && obj.inventory ? (obj.inventory as Record<string, number>) : {}),
    },
    purchasedCosmetics: Array.isArray(obj.purchasedCosmetics)
      ? Array.from(new Set([...def.purchasedCosmetics, ...obj.purchasedCosmetics.filter((x) => typeof x === 'string')]))
      : def.purchasedCosmetics,
    equipped: {
      ...def.equipped,
      ...(typeof obj.equipped === 'object' && obj.equipped ? (obj.equipped as SaveData['equipped']) : {}),
    },
    dailyRewards: {
      ...def.dailyRewards,
      ...(typeof obj.dailyRewards === 'object' && obj.dailyRewards
        ? (obj.dailyRewards as SaveData['dailyRewards'])
        : {}),
    },
    missions: def.missions,
    achievements:
      typeof obj.achievements === 'object' && obj.achievements
        ? (obj.achievements as SaveData['achievements'])
        : {},
    stats: {
      ...def.stats,
      ...(typeof obj.stats === 'object' && obj.stats ? (obj.stats as SaveData['stats']) : {}),
    },
    settings: {
      ...def.settings,
      ...(typeof obj.settings === 'object' && obj.settings ? (obj.settings as SaveData['settings']) : {}),
    },
  };

  // Validate completedLevels
  if (obj.completedLevels && typeof obj.completedLevels === 'object') {
    for (const [k, v] of Object.entries(obj.completedLevels as Record<string, unknown>)) {
      const id = Number(k);
      if (id >= 1 && id <= 200 && v && typeof v === 'object') {
        const entry = v as Record<string, unknown>;
        const stars = entry.stars === 3 ? 3 : entry.stars === 2 ? 2 : 1;
        const bestScore =
          typeof entry.bestScore === 'number' && Number.isFinite(entry.bestScore)
            ? Math.max(0, Math.floor(entry.bestScore))
            : 0;
        merged.completedLevels[id] = { stars, bestScore };
      }
    }
  }

  // Daily missions reset if date changed
  const today = getTodayKey();
  if (obj.missions && typeof obj.missions === 'object') {
    const m = obj.missions as SaveData['missions'];
    if (m.date === today) {
      merged.missions = {
        date: today,
        progress: {
          ...def.missions.progress,
          ...(m.progress || {}),
        },
        claimed: Array.isArray(m.claimed) ? m.claimed : [],
      };
    }
  }

  // Recompute derived stats accurately from completedLevels
  const completedEntries = Object.values(merged.completedLevels);
  merged.stats.levelsCompleted = completedEntries.length;
  merged.stats.threeStarLevels = completedEntries.filter((e) => e.stars === 3).length;

  const totalStars = getTotalStars(merged);
  let worldsUnlocked = 1;
  if (merged.unlockedLevel >= 51 || totalStars >= 40) worldsUnlocked = 2;
  if (merged.unlockedLevel >= 101 || totalStars >= 95) worldsUnlocked = 3;
  if (merged.unlockedLevel >= 151 || totalStars >= 160) worldsUnlocked = 4;
  merged.stats.worldsUnlocked = Math.max(merged.stats.worldsUnlocked, worldsUnlocked);

  return merged;
}

export function getTotalStars(save: SaveData): number {
  return Object.values(save.completedLevels).reduce((acc, item) => acc + item.stars, 0);
}

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultSave();
    const parsed = JSON.parse(raw);
    return sanitizeSave(parsed);
  } catch {
    return createDefaultSave();
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function resetSaveData(): SaveData {
  const fresh = createDefaultSave();
  persistSaveData(fresh);
  return fresh;
}
