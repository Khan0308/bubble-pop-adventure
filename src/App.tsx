import { useCallback, useEffect, useState } from 'react';
import { GameplayScreen } from './components/GameplayScreen';
import {
  AchievementsScreen,
  DailyRewardsScreen,
  MissionsScreen,
  SettingsScreen,
  ShopScreen,
} from './components/MetaScreens';
import { MainMenuScreen, SplashScreen } from './components/SplashAndMenu';
import { LevelSelectScreen, WorldSelectScreen } from './components/WorldAndLevelScreens';
import { ACHIEVEMENTS, DAILY_MISSIONS, DAILY_REWARD_DAYS } from './data/progression';
import { getWorldById } from './data/worlds';
import { audioManager } from './systems/audio';
import {
  getTodayKey,
  getTotalStars,
  loadSaveData,
  persistSaveData,
  resetSaveData,
} from './systems/saveManager';
import {
  GameSettings,
  PowerUpType,
  SaveData,
  ScreenId,
  ShopItem,
  WorldId,
} from './types/game';

function getWorldForLevelId(levelId: number): WorldId {
  if (levelId <= 50) return 'candy';
  if (levelId <= 100) return 'forest';
  if (levelId <= 150) return 'ocean';
  return 'space';
}

export default function App() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<ScreenId>('splash');
  const [activeLevelId, setActiveLevelId] = useState<number>(() => saveData.unlockedLevel);
  const [selectedWorldId, setSelectedWorldId] = useState<WorldId>(() =>
    getWorldForLevelId(saveData.unlockedLevel),
  );

  // Persist save changes & sync audio settings
  useEffect(() => {
    persistSaveData(saveData);
    audioManager.updateSettings(saveData.settings);
  }, [saveData]);

  // Switch music context based on current screen
  useEffect(() => {
    if (screen === 'splash') {
      audioManager.setMusicContext('none');
    } else if (screen === 'gameplay') {
      audioManager.setMusicContext(getWorldForLevelId(activeLevelId));
    } else {
      audioManager.setMusicContext('menu');
    }
  }, [screen, activeLevelId]);

  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSaveData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
    }));
  }, []);

  const handleUsePowerUp = useCallback((type: PowerUpType): boolean => {
    let allowed = false;
    setSaveData((prev) => {
      const current = prev.inventory[type] ?? 0;
      if (current <= 0) return prev;
      allowed = true;
      const today = getTodayKey();
      const missions =
        prev.missions.date === today
          ? prev.missions
          : { date: today, progress: {}, claimed: [] };
      return {
        ...prev,
        inventory: {
          ...prev.inventory,
          [type]: current - 1,
        },
        missions: {
          ...missions,
          progress: {
            ...missions.progress,
            powerups: (missions.progress.powerups ?? 0) + 1,
          },
        },
        stats: {
          ...prev.stats,
          powerUpsUsed: prev.stats.powerUpsUsed + 1,
        },
      };
    });
    return allowed;
  }, []);

  const handleLevelWin = useCallback(
    (result: {
      levelId: number;
      score: number;
      stars: 1 | 2 | 3;
      coinsEarned: number;
      poppedCount: number;
    }) => {
      setSaveData((prev) => {
        const existing = prev.completedLevels[result.levelId];
        const bestStars: 1 | 2 | 3 = existing
          ? (Math.max(existing.stars, result.stars) as 1 | 2 | 3)
          : result.stars;
        const bestScore = existing ? Math.max(existing.bestScore, result.score) : result.score;

        const nextCompleted = {
          ...prev.completedLevels,
          [result.levelId]: { stars: bestStars, bestScore },
        };
        const nextUnlocked = Math.min(200, Math.max(prev.unlockedLevel, result.levelId + 1));
        const completedEntries = Object.values(nextCompleted);
        const totalStars = completedEntries.reduce((s, e) => s + e.stars, 0);

        let worldsUnlocked = 1;
        if (nextUnlocked >= 51 || totalStars >= 40) worldsUnlocked = 2;
        if (nextUnlocked >= 101 || totalStars >= 95) worldsUnlocked = 3;
        if (nextUnlocked >= 151 || totalStars >= 160) worldsUnlocked = 4;

        const today = getTodayKey();
        const baseMissions =
          prev.missions.date === today
            ? prev.missions
            : { date: today, progress: {}, claimed: [] };

        return {
          ...prev,
          unlockedLevel: nextUnlocked,
          completedLevels: nextCompleted,
          coins: prev.coins + result.coinsEarned,
          missions: {
            ...baseMissions,
            progress: {
              ...baseMissions.progress,
              popped: (baseMissions.progress.popped ?? 0) + result.poppedCount,
              levels: (baseMissions.progress.levels ?? 0) + 1,
              score: (baseMissions.progress.score ?? 0) + result.score,
              three_stars:
                (baseMissions.progress.three_stars ?? 0) + (result.stars === 3 ? 1 : 0),
            },
          },
          stats: {
            ...prev.stats,
            totalPopped: prev.stats.totalPopped + result.poppedCount,
            levelsCompleted: completedEntries.length,
            threeStarLevels: completedEntries.filter((e) => e.stars === 3).length,
            totalScore: prev.stats.totalScore + result.score,
            worldsUnlocked: Math.max(prev.stats.worldsUnlocked, worldsUnlocked),
          },
        };
      });
    },
    [],
  );

  const handleLevelFail = useCallback((poppedCount: number, score: number) => {
    if (poppedCount <= 0 && score <= 0) return;
    setSaveData((prev) => {
      const today = getTodayKey();
      const baseMissions =
        prev.missions.date === today
          ? prev.missions
          : { date: today, progress: {}, claimed: [] };
      return {
        ...prev,
        missions: {
          ...baseMissions,
          progress: {
            ...baseMissions.progress,
            popped: (baseMissions.progress.popped ?? 0) + poppedCount,
            score: (baseMissions.progress.score ?? 0) + score,
          },
        },
        stats: {
          ...prev.stats,
          totalPopped: prev.stats.totalPopped + poppedCount,
          totalScore: prev.stats.totalScore + score,
        },
      };
    });
  }, []);

  const handlePurchaseItem = useCallback((item: ShopItem): boolean => {
    let success = false;
    setSaveData((prev) => {
      if (prev.coins < item.price) return prev;
      if (item.category !== 'powerup' && prev.purchasedCosmetics.includes(item.id)) return prev;
      success = true;

      if (item.category === 'powerup' && item.powerUpType && item.grantAmount) {
        return {
          ...prev,
          coins: prev.coins - item.price,
          inventory: {
            ...prev.inventory,
            [item.powerUpType]: (prev.inventory[item.powerUpType] ?? 0) + item.grantAmount,
          },
        };
      }

      const nextEquipped = { ...prev.equipped };
      if (item.cosmeticKey) {
        if (item.category === 'bubble_theme') nextEquipped.bubbleTheme = item.cosmeticKey;
        if (item.category === 'launcher') nextEquipped.launcher = item.cosmeticKey;
        if (item.category === 'background') nextEquipped.background = item.cosmeticKey;
      }

      return {
        ...prev,
        coins: prev.coins - item.price,
        purchasedCosmetics: [...prev.purchasedCosmetics, item.id],
        equipped: nextEquipped,
      };
    });
    return success;
  }, []);

  const handleEquipCosmetic = useCallback((item: ShopItem) => {
    if (!item.cosmeticKey) return;
    setSaveData((prev) => {
      const nextEquipped = { ...prev.equipped };
      if (item.category === 'bubble_theme') nextEquipped.bubbleTheme = item.cosmeticKey!;
      if (item.category === 'launcher') nextEquipped.launcher = item.cosmeticKey!;
      if (item.category === 'background') nextEquipped.background = item.cosmeticKey!;
      return { ...prev, equipped: nextEquipped };
    });
  }, []);

  const handleClaimDaily = useCallback(() => {
    const today = getTodayKey();
    setSaveData((prev) => {
      if (prev.dailyRewards.lastClaimDate === today) return prev;
      const dayIdx = prev.dailyRewards.streakDay % 7;
      const reward = DAILY_REWARD_DAYS[dayIdx];
      const nextInv = { ...prev.inventory };
      if (reward.bonus) {
        nextInv[reward.bonus] = (nextInv[reward.bonus] ?? 0) + 1;
      }
      return {
        ...prev,
        coins: prev.coins + reward.coins,
        inventory: nextInv,
        dailyRewards: {
          lastClaimDate: today,
          streakDay: prev.dailyRewards.streakDay + 1,
        },
      };
    });
  }, []);

  const handleClaimMission = useCallback((missionId: string) => {
    const def = DAILY_MISSIONS.find((m) => m.id === missionId);
    if (!def) return;
    setSaveData((prev) => {
      if (prev.missions.claimed.includes(missionId)) return prev;
      if ((prev.missions.progress[def.statKey] ?? 0) < def.target) return prev;
      return {
        ...prev,
        coins: prev.coins + def.rewardCoins,
        missions: {
          ...prev.missions,
          claimed: [...prev.missions.claimed, missionId],
        },
      };
    });
  }, []);

  const handleClaimAchievement = useCallback((achievementId: string) => {
    const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!def) return;
    setSaveData((prev) => {
      if (prev.achievements[achievementId]?.claimed) return prev;
      if ((prev.stats[def.statKey] ?? 0) < def.target) return prev;
      return {
        ...prev,
        coins: prev.coins + def.rewardCoins,
        achievements: {
          ...prev.achievements,
          [achievementId]: { claimed: true },
        },
      };
    });
  }, []);

  const handleResetProgress = useCallback(() => {
    const fresh = resetSaveData();
    setSaveData(fresh);
    setActiveLevelId(1);
    setSelectedWorldId('candy');
    setScreen('menu');
  }, []);

  const launchLevel = useCallback((levelId: number) => {
    setActiveLevelId(levelId);
    setSelectedWorldId(getWorldForLevelId(levelId));
    setScreen('gameplay');
  }, []);

  const ambientWorld = getWorldById(
    screen === 'gameplay' ? getWorldForLevelId(activeLevelId) : selectedWorldId,
  );
  const totalStars = getTotalStars(saveData);

  return (
    <div
      dir={saveData.settings.language === 'ar' ? 'rtl' : 'ltr'}
      className="relative w-screen h-[100dvh] bg-slate-950 flex items-center justify-center overflow-hidden"
    >
      {/* Desktop/Tablet atmospheric outer backdrop */}
      <img
        src={ambientWorld.backgroundUrl}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className="hidden sm:block absolute inset-0 w-full h-full object-cover opacity-25 blur-2xl scale-110 pointer-events-none"
      />

      {/* Portrait 9:16 Game Viewport */}
      <div className="relative w-full h-full sm:w-auto sm:aspect-[9/16] sm:h-[min(95dvh,860px)] sm:rounded-[34px] sm:border-[3px] sm:border-white/20 sm:shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden bg-slate-950">
        {screen === 'splash' && <SplashScreen onDone={() => setScreen('menu')} />}

        {screen === 'menu' && (
          <MainMenuScreen
            saveData={saveData}
            onPlayCurrent={() => launchLevel(saveData.unlockedLevel)}
            onNavigate={(next) => {
              if (next === 'levels') {
                setSelectedWorldId(getWorldForLevelId(saveData.unlockedLevel));
              }
              setScreen(next);
            }}
          />
        )}

        {screen === 'worlds' && (
          <WorldSelectScreen
            saveData={saveData}
            onSelectWorld={(worldId) => {
              setSelectedWorldId(worldId);
              setScreen('levels');
            }}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'levels' && (
          <LevelSelectScreen
            saveData={saveData}
            initialWorldId={selectedWorldId}
            onSelectLevel={(id) => launchLevel(id)}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'gameplay' && (
          <GameplayScreen
            levelId={activeLevelId}
            saveData={saveData}
            onUpdateSettings={updateSettings}
            onUsePowerUp={handleUsePowerUp}
            onLevelWin={handleLevelWin}
            onLevelFail={handleLevelFail}
            onExitToMenu={() => setScreen('menu')}
            onGoToLevel={(nextId) => launchLevel(nextId)}
          />
        )}

        {screen === 'shop' && (
          <ShopScreen
            saveData={saveData}
            onPurchaseItem={handlePurchaseItem}
            onEquipCosmetic={handleEquipCosmetic}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'daily' && (
          <DailyRewardsScreen
            saveData={saveData}
            onClaimDaily={handleClaimDaily}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'missions' && (
          <MissionsScreen
            saveData={saveData}
            onClaimMission={handleClaimMission}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'achievements' && (
          <AchievementsScreen
            saveData={saveData}
            onClaimAchievement={handleClaimAchievement}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'settings' && (
          <SettingsScreen
            saveData={saveData}
            onUpdateSettings={updateSettings}
            onResetProgress={handleResetProgress}
            onBack={() => setScreen('menu')}
          />
        )}
      </div>

      {/* Subtle desktop-only side summary so wide viewports look balanced */}
      <aside className="hidden lg:flex flex-col gap-3 ml-6 w-60 rounded-3xl bg-slate-900/75 backdrop-blur-md border border-white/10 p-5 text-slate-200">
        <div className="text-sm font-black text-white">Campaign Progress</div>
        <div className="text-xs text-slate-300 space-y-1.5 tabular-nums">
          <div className="flex justify-between">
            <span>Unlocked Level</span>
            <strong className="text-amber-300">{saveData.unlockedLevel} / 200</strong>
          </div>
          <div className="flex justify-between">
            <span>Total Stars</span>
            <strong className="text-amber-300">{totalStars} / 600</strong>
          </div>
          <div className="flex justify-between">
            <span>Coins</span>
            <strong className="text-amber-300">{saveData.coins}</strong>
          </div>
          <div className="flex justify-between">
            <span>Bubbles Popped</span>
            <strong className="text-white">{saveData.stats.totalPopped}</strong>
          </div>
        </div>
        <div className="pt-3 border-t border-white/10 text-[11px] text-slate-400 leading-relaxed">
          Drag anywhere on the board to aim off walls, then release to shoot. Tap the launcher or
          Next slot to swap bubbles.
        </div>
      </aside>
    </div>
  );
}
