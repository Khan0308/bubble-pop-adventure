import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Lock, Play, Star } from 'lucide-react';
import { getLevelsForWorld } from '../data/levels';
import { t } from '../data/i18n';
import { getWorldById, WORLDS } from '../data/worlds';
import { audioManager } from '../systems/audio';
import { getTotalStars } from '../systems/saveManager';
import { SaveData, WorldId } from '../types/game';

interface WorldSelectScreenProps {
  saveData: SaveData;
  onSelectWorld: (worldId: WorldId) => void;
  onBack: () => void;
}

export const WorldSelectScreen: React.FC<WorldSelectScreenProps> = ({
  saveData,
  onSelectWorld,
  onBack,
}) => {
  const totalStars = getTotalStars(saveData);
  const lang = saveData.settings.language;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      <header className="px-4 py-3.5 bg-slate-900/90 border-b border-white/10 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => {
            audioManager.playClick();
            onBack();
          }}
          className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-black">{t(lang, 'worlds')}</h2>
        <div className="flex items-center gap-1 text-xs font-bold text-amber-300 tabular-nums">
          <Star className="w-4 h-4 fill-amber-300" />
          <span>{totalStars}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto game-scroll p-4 space-y-3.5">
        {WORLDS.map((world) => {
          const isUnlocked =
            saveData.unlockedLevel >= world.unlockLevel || totalStars >= world.unlockStars;
          const [startLv, endLv] = world.levelRange;
          let completedInWorld = 0;
          let starsInWorld = 0;
          for (let lv = startLv; lv <= endLv; lv++) {
            const p = saveData.completedLevels[lv];
            if (p) {
              completedInWorld++;
              starsInWorld += p.stars;
            }
          }

          return (
            <button
              key={world.id}
              type="button"
              onClick={() => {
                audioManager.playClick();
                if (isUnlocked) onSelectWorld(world.id);
              }}
              className={`relative w-full h-36 rounded-3xl overflow-hidden border text-left transition-all shadow-xl ${
                isUnlocked
                  ? 'border-white/25 hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                  : 'border-white/10 opacity-75 cursor-not-allowed'
              }`}
            >
              <img
                src={world.backgroundUrl}
                alt={world.name}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-slate-950/25" />

              <div className="relative z-10 h-full p-4 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold text-amber-300">{world.badgeText}</div>
                    <h3 className="text-xl font-black text-white mt-0.5">{world.name}</h3>
                    <p className="text-xs text-slate-200/90 line-clamp-1 mt-0.5">{world.subtitle}</p>
                  </div>
                  {!isUnlocked ? (
                    <div className="w-10 h-10 rounded-2xl bg-slate-950/80 border border-white/15 flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5 text-slate-300" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow">
                      <Play className="w-5 h-5 fill-current" />
                    </div>
                  )}
                </div>

                {isUnlocked ? (
                  <div className="flex items-center justify-between text-xs font-bold text-white/95">
                    <span className="tabular-nums">{completedInWorld}/50 Cleared</span>
                    <span className="flex items-center gap-1 text-amber-300 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-amber-300" />
                      {starsInWorld}/150
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold text-amber-200">
                    Reach Level {world.unlockLevel} or collect {world.unlockStars} stars to unlock
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface LevelSelectScreenProps {
  saveData: SaveData;
  initialWorldId: WorldId;
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
}

export const LevelSelectScreen: React.FC<LevelSelectScreenProps> = ({
  saveData,
  initialWorldId,
  onSelectLevel,
  onBack,
}) => {
  const [selectedWorld, setSelectedWorld] = useState<WorldId>(initialWorldId);
  const lang = saveData.settings.language;
  const world = getWorldById(selectedWorld);
  const totalStars = getTotalStars(saveData);

  const levels = useMemo(() => getLevelsForWorld(selectedWorld), [selectedWorld]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-950">
      <img
        src={world.backgroundUrl}
        alt={world.name}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
      />
      <div className="absolute inset-0 bg-slate-950/65 pointer-events-none" />

      <header className="relative z-10 px-4 py-3.5 bg-slate-950/75 backdrop-blur-md border-b border-white/10 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => {
            audioManager.playClick();
            onBack();
          }}
          className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-black text-white">{world.name}</h2>
          <div className="text-[11px] text-amber-300 font-semibold">{world.badgeText}</div>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-amber-300 tabular-nums">
          <Star className="w-4 h-4 fill-amber-300" />
          <span>{totalStars}</span>
        </div>
      </header>

      {/* World Filter Tabs */}
      <div className="relative z-10 px-3 pt-2.5 pb-2 flex items-center gap-1.5 bg-slate-950/60 border-b border-white/10 shrink-0">
        {WORLDS.map((w) => {
          const active = w.id === selectedWorld;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                audioManager.playClick();
                setSelectedWorld(w.id);
              }}
              className={`flex-1 h-10 rounded-xl text-[11px] font-bold transition-all cursor-pointer truncate px-1.5 ${
                active
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              {w.name.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* 50-Level Grid for Selected World */}
      <div className="relative z-10 flex-1 overflow-y-auto game-scroll p-4">
        <div className="grid grid-cols-5 gap-2.5">
          {levels.map((lv) => {
            const progress = saveData.completedLevels[lv.id];
            const worldUnlocked =
              saveData.unlockedLevel >= world.unlockLevel || totalStars >= world.unlockStars;
            const isUnlocked =
              (lv.id <= saveData.unlockedLevel && worldUnlocked) || Boolean(progress);
            const isCurrent = lv.id === saveData.unlockedLevel;

            return (
              <button
                key={lv.id}
                type="button"
                disabled={!isUnlocked}
                onClick={() => {
                  audioManager.playClick();
                  onSelectLevel(lv.id);
                }}
                className={`relative h-16 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-b from-amber-400 to-orange-500 text-slate-950 border-white shadow-lg scale-[1.04] cursor-pointer'
                    : progress
                      ? 'bg-emerald-600/80 hover:bg-emerald-500/90 text-white border-emerald-300/40 cursor-pointer'
                      : isUnlocked
                        ? 'bg-indigo-600/80 hover:bg-indigo-500 text-white border-white/25 cursor-pointer'
                        : 'bg-slate-900/75 text-slate-500 border-white/10 cursor-not-allowed'
                }`}
              >
                {isUnlocked ? (
                  <>
                    <span className="text-sm font-black tabular-nums leading-none">{lv.id}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-2.5 h-2.5 ${
                            progress && s <= progress.stars
                              ? isCurrent
                                ? 'text-slate-950 fill-slate-950'
                                : 'text-amber-300 fill-amber-300'
                              : isCurrent
                                ? 'text-slate-950/30'
                                : 'text-white/25'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-bold tabular-nums">{lv.id}</span>
                  </>
                )}

                {progress && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 text-center text-[11px] text-slate-400">
          {t(lang, 'levels')}: 1–200 playable campaign levels
        </div>
      </div>
    </div>
  );
};
