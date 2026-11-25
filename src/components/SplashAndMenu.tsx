import React, { useEffect, useState } from 'react';
import {
  Award,
  Calendar,
  Coins,
  Globe2,
  Grid3X3,
  Play,
  Settings,
  ShoppingBag,
  Star,
  Target,
} from 'lucide-react';
import { t } from '../data/i18n';
import { ACHIEVEMENTS, DAILY_MISSIONS } from '../data/progression';
import { GAME_LOGO_URL, getWorldById } from '../data/worlds';
import { audioManager } from '../systems/audio';
import { getTodayKey, getTotalStars } from '../systems/saveManager';
import { SaveData, ScreenId } from '../types/game';

interface SplashScreenProps {
  onDone: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 950;
    let raf = 0;

    const tick = (now: number) => {
      const pct = Math.min(100, Math.round(((now - start) / duration) * 100));
      setProgress(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        window.setTimeout(onDone, 140);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-950 via-blue-950 to-slate-950 overflow-hidden">
      <div className="relative z-10 flex flex-col items-center text-center max-w-xs w-full">
        <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-300/60 mb-6 animate-float-slow bg-blue-900">
          <img
            src={GAME_LOGO_URL}
            alt="Bubble Pop Adventure"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-md text-balance">
          Bubble Pop Adventure
        </h1>
        <p className="text-xs font-medium text-sky-200/80 mt-1.5">
          200 Levels · 4 Worlds · Offline Puzzle Fun
        </p>

        <div className="w-full mt-8">
          <div className="h-3 w-full rounded-full bg-white/15 overflow-hidden border border-white/15 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-pink-400 to-sky-400 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[11px] font-bold text-slate-300 mt-2 tabular-nums">
            Loading {progress}%
          </div>
        </div>
      </div>
    </div>
  );
};

interface MainMenuScreenProps {
  saveData: SaveData;
  onPlayCurrent: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  saveData,
  onPlayCurrent,
  onNavigate,
}) => {
  const lang = saveData.settings.language;
  const totalStars = getTotalStars(saveData);
  const currentWorld = getWorldById(
    saveData.unlockedLevel <= 50
      ? 'candy'
      : saveData.unlockedLevel <= 100
        ? 'forest'
        : saveData.unlockedLevel <= 150
          ? 'ocean'
          : 'space',
  );

  const bgWorld =
    saveData.equipped.background === 'candy'
      ? getWorldById('candy')
      : saveData.equipped.background === 'space'
        ? getWorldById('space')
        : currentWorld;

  const canClaimDaily = saveData.dailyRewards.lastClaimDate !== getTodayKey();
  const claimableMissions = DAILY_MISSIONS.filter(
    (m) =>
      (saveData.missions.progress[m.statKey] ?? 0) >= m.target &&
      !saveData.missions.claimed.includes(m.id),
  ).length;
  const claimableAchievements = ACHIEVEMENTS.filter(
    (a) =>
      (saveData.stats[a.statKey] ?? 0) >= a.target &&
      !saveData.achievements[a.id]?.claimed,
  ).length;

  const menuActions: {
    id: ScreenId;
    label: string;
    icon: React.ReactNode;
    gradient: string;
    badge?: string | number;
  }[] = [
    {
      id: 'worlds',
      label: t(lang, 'worlds'),
      icon: <Globe2 className="w-5 h-5" />,
      gradient: 'from-sky-500 to-blue-600',
    },
    {
      id: 'levels',
      label: t(lang, 'levels'),
      icon: <Grid3X3 className="w-5 h-5" />,
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'daily',
      label: t(lang, 'dailyRewards'),
      icon: <Calendar className="w-5 h-5" />,
      gradient: 'from-amber-400 to-orange-500',
      badge: canClaimDaily ? '!' : undefined,
    },
    {
      id: 'shop',
      label: t(lang, 'shop'),
      icon: <ShoppingBag className="w-5 h-5" />,
      gradient: 'from-pink-500 to-rose-600',
    },
    {
      id: 'missions',
      label: t(lang, 'missions'),
      icon: <Target className="w-5 h-5" />,
      gradient: 'from-violet-500 to-purple-600',
      badge: claimableMissions > 0 ? claimableMissions : undefined,
    },
    {
      id: 'achievements',
      label: t(lang, 'achievements'),
      icon: <Award className="w-5 h-5" />,
      gradient: 'from-indigo-500 to-cyan-600',
      badge: claimableAchievements > 0 ? claimableAchievements : undefined,
    },
  ];

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
      <img
        src={bgWorld.backgroundUrl}
        alt={bgWorld.name}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/35 to-slate-950/85 pointer-events-none" />

      {/* Top Status Strip */}
      <header className="relative z-10 px-4 pt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-md border border-amber-300/30 rounded-2xl px-3 py-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-extrabold text-white tabular-nums">
              {saveData.coins}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-md border border-white/15 rounded-2xl px-3 py-1.5">
            <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span className="text-sm font-extrabold text-white tabular-nums">
              {totalStars}/600
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            audioManager.unlock();
            audioManager.playClick();
            onNavigate('settings');
          }}
          aria-label="Settings"
          className="w-11 h-11 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-white/15 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
        >
          <Settings className="w-5 h-5 text-white" />
        </button>
      </header>

      {/* Center Hero Logo & Play CTA */}
      <main className="relative z-10 px-5 flex flex-col items-center text-center my-auto">
        <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-300/70 mb-4 animate-float-slow bg-blue-900">
          <img
            src={GAME_LOGO_URL}
            alt="Bubble Pop Adventure"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.7)] text-balance leading-tight">
          Bubble Pop Adventure
        </h1>
        <p className="text-xs font-semibold text-amber-200 mt-1.5">
          {currentWorld.name} · Level {saveData.unlockedLevel} of 200
        </p>

        <button
          type="button"
          onClick={() => {
            audioManager.unlock();
            audioManager.playClick();
            onPlayCurrent();
          }}
          className="mt-5 w-full max-w-[260px] h-14 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 text-slate-950 font-black text-lg shadow-[0_8px_24px_rgba(245,158,11,0.45)] border-2 border-amber-200/80 flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform cursor-pointer"
        >
          <Play className="w-6 h-6 fill-current" />
          <span>
            {t(lang, 'play')} Lv.{saveData.unlockedLevel}
          </span>
        </button>
      </main>

      {/* Bottom 2x3 Feature Grid */}
      <nav className="relative z-10 px-4 pb-5">
        <div className="grid grid-cols-3 gap-2.5">
          {menuActions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                audioManager.unlock();
                audioManager.playClick();
                onNavigate(item.id);
              }}
              className="relative h-20 rounded-2xl bg-slate-950/75 hover:bg-slate-900/90 backdrop-blur-md border border-white/15 p-2 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              {item.badge !== undefined && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-slate-950 shadow">
                  {item.badge}
                </span>
              )}
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.gradient} text-white flex items-center justify-center shadow`}
              >
                {item.icon}
              </div>
              <span className="text-[11px] font-bold text-white leading-none truncate max-w-full">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
