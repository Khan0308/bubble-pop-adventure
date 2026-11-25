import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Check,
  Coins,
  Gift,
  ShieldCheck,
  ShoppingBag,
  Target,
} from 'lucide-react';
import { t } from '../data/i18n';
import {
  ACHIEVEMENTS,
  DAILY_MISSIONS,
  DAILY_REWARD_DAYS,
  SHOP_ITEMS,
} from '../data/progression';
import { audioManager } from '../systems/audio';
import { getTodayKey } from '../systems/saveManager';
import {
  GameSettings,
  LanguageCode,
  SaveData,
  ShopItem,
} from '../types/game';

interface HeaderBarProps {
  title: string;
  coins: number;
  onBack: () => void;
}

const ScreenHeader: React.FC<HeaderBarProps> = ({ title, coins, onBack }) => (
  <header className="px-4 py-3.5 bg-slate-900/95 border-b border-white/10 flex items-center justify-between shrink-0">
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
    <h2 className="text-lg font-black text-white truncate">{title}</h2>
    <div className="flex items-center gap-1.5 bg-slate-950 border border-amber-300/30 rounded-2xl px-3 py-1.5">
      <Coins className="w-4 h-4 text-amber-400" />
      <span className="text-xs font-extrabold text-white tabular-nums">{coins}</span>
    </div>
  </header>
);

/* ---------------- SHOP SCREEN ---------------- */
interface ShopScreenProps {
  saveData: SaveData;
  onPurchaseItem: (item: ShopItem) => boolean;
  onEquipCosmetic: (item: ShopItem) => void;
  onBack: () => void;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({
  saveData,
  onPurchaseItem,
  onEquipCosmetic,
  onBack,
}) => {
  const [tab, setTab] = useState<ShopItem['category']>('powerup');
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lang = saveData.settings.language;

  const items = SHOP_ITEMS.filter((i) => i.category === tab);

  const isEquipped = (item: ShopItem) => {
    if (!item.cosmeticKey) return false;
    if (item.category === 'bubble_theme') return saveData.equipped.bubbleTheme === item.cosmeticKey;
    if (item.category === 'launcher') return saveData.equipped.launcher === item.cosmeticKey;
    if (item.category === 'background') return saveData.equipped.background === item.cosmeticKey;
    return false;
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      <ScreenHeader title={t(lang, 'shop')} coins={saveData.coins} onBack={onBack} />

      <div className="px-3 py-2.5 flex items-center gap-1.5 bg-slate-900/70 border-b border-white/10 shrink-0">
        {(
          [
            ['powerup', 'Power-Ups'],
            ['bubble_theme', 'Bubbles'],
            ['launcher', 'Launchers'],
            ['background', 'Themes'],
          ] as const
        ).map(([cat, label]) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              audioManager.playClick();
              setTab(cat);
            }}
            className={`flex-1 h-10 rounded-xl text-[11px] font-bold transition-colors cursor-pointer truncate px-1 ${
              tab === cat ? 'bg-pink-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs font-bold text-emerald-200 text-center">
          {notice}
        </div>
      )}

      <div className="flex-1 overflow-y-auto game-scroll p-4 space-y-3">
        {items.map((item) => {
          const ownedCosmetic =
            item.category !== 'powerup' && saveData.purchasedCosmetics.includes(item.id);
          const equipped = isEquipped(item);
          const count = item.powerUpType ? saveData.inventory[item.powerUpType] ?? 0 : 0;

          return (
            <div
              key={item.id}
              className="rounded-2xl bg-slate-900 border border-white/10 p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-pink-400 shrink-0" />
                  <h3 className="text-sm font-extrabold text-white truncate">{item.name}</h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">{item.description}</p>
                {item.category === 'powerup' && (
                  <div className="text-[11px] font-bold text-amber-300 mt-1.5 tabular-nums">
                    Owned: {count}
                  </div>
                )}
              </div>

              {ownedCosmetic ? (
                <button
                  type="button"
                  disabled={equipped}
                  onClick={() => {
                    audioManager.playClick();
                    onEquipCosmetic(item);
                    setNotice(`${item.name} equipped!`);
                  }}
                  className={`h-10 px-4 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer ${
                    equipped
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 cursor-default'
                      : 'bg-indigo-500 hover:bg-indigo-400 text-white'
                  }`}
                >
                  {equipped ? t(lang, 'equipped') : t(lang, 'equip')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saveData.coins < item.price}
                  onClick={() => {
                    audioManager.playClick();
                    setConfirmItem(item);
                  }}
                  className={`h-10 px-3.5 rounded-xl text-xs font-black flex items-center gap-1 shrink-0 ${
                    saveData.coins >= item.price
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{item.price}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Purchase Confirmation Modal */}
      {confirmItem && (
        <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-xs rounded-3xl bg-slate-900 border border-white/15 p-5 space-y-4 text-center">
            <h3 className="text-lg font-black text-white">Confirm Purchase</h3>
            <p className="text-xs text-slate-300">
              Buy <strong className="text-white">{confirmItem.name}</strong> for{' '}
              <strong className="text-amber-300">{confirmItem.price} coins</strong>?
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                className="h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok = onPurchaseItem(confirmItem);
                  if (ok) {
                    audioManager.playReward();
                    setNotice(`Purchased ${confirmItem.name}!`);
                  }
                  setConfirmItem(null);
                }}
                className="h-11 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- DAILY REWARDS SCREEN ---------------- */
interface DailyRewardsScreenProps {
  saveData: SaveData;
  onClaimDaily: () => void;
  onBack: () => void;
}

export const DailyRewardsScreen: React.FC<DailyRewardsScreenProps> = ({
  saveData,
  onClaimDaily,
  onBack,
}) => {
  const today = getTodayKey();
  const canClaim = saveData.dailyRewards.lastClaimDate !== today;
  const currentIndex = saveData.dailyRewards.streakDay % 7;
  const lang = saveData.settings.language;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      <ScreenHeader title={t(lang, 'dailyRewards')} coins={saveData.coins} onBack={onBack} />

      <div className="flex-1 overflow-y-auto game-scroll p-4 space-y-4">
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-300/30 p-4 text-center">
          <Gift className="w-8 h-8 text-amber-300 mx-auto mb-1.5" />
          <div className="text-sm font-black text-white">7-Day Adventure Calendar</div>
          <p className="text-xs text-slate-300 mt-0.5">
            {canClaim
              ? 'Today’s reward is ready to collect!'
              : 'Today’s reward claimed. Come back tomorrow!'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {DAILY_REWARD_DAYS.map((entry, idx) => {
            const claimedThisCycle = idx < currentIndex || (!canClaim && idx === currentIndex);
            const isTodayTarget = canClaim && idx === currentIndex;

            return (
              <div
                key={entry.day}
                className={`rounded-2xl p-3.5 border flex flex-col justify-between gap-2 ${
                  idx === 6 ? 'col-span-2' : ''
                } ${
                  isTodayTarget
                    ? 'bg-amber-400/20 border-amber-300 shadow-lg'
                    : claimedThisCycle
                      ? 'bg-emerald-500/15 border-emerald-400/30 opacity-80'
                      : 'bg-slate-900 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300">Day {entry.day}</span>
                  {claimedThisCycle && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="text-sm font-extrabold text-white">{entry.label}</div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!canClaim}
          onClick={() => {
            audioManager.playReward();
            onClaimDaily();
          }}
          className={`w-full h-13 rounded-2xl font-black text-sm transition-all ${
            canClaim
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-lg active:scale-[0.98] cursor-pointer'
              : 'bg-slate-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          {canClaim ? 'Claim Today’s Reward' : 'Claimed for Today'}
        </button>
      </div>
    </div>
  );
};

/* ---------------- DAILY MISSIONS SCREEN ---------------- */
interface MissionsScreenProps {
  saveData: SaveData;
  onClaimMission: (missionId: string) => void;
  onBack: () => void;
}

export const MissionsScreen: React.FC<MissionsScreenProps> = ({
  saveData,
  onClaimMission,
  onBack,
}) => {
  const lang = saveData.settings.language;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      <ScreenHeader title={t(lang, 'missions')} coins={saveData.coins} onBack={onBack} />

      <div className="flex-1 overflow-y-auto game-scroll p-4 space-y-3">
        {DAILY_MISSIONS.map((m) => {
          const val = Math.min(m.target, saveData.missions.progress[m.statKey] ?? 0);
          const pct = Math.round((val / m.target) * 100);
          const claimed = saveData.missions.claimed.includes(m.id);
          const ready = val >= m.target && !claimed;

          return (
            <div
              key={m.id}
              className="rounded-2xl bg-slate-900 border border-white/10 p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="w-4 h-4 text-violet-400 shrink-0" />
                  <h3 className="text-sm font-extrabold text-white truncate">{m.title}</h3>
                </div>
                <span className="text-xs font-black text-amber-300 shrink-0 tabular-nums">
                  +{m.rewardCoins} coins
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold tabular-nums">
                  {val} / {m.target}
                </span>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => {
                    audioManager.playReward();
                    onClaimMission(m.id);
                  }}
                  className={`h-9 px-4 rounded-xl text-xs font-black ${
                    claimed
                      ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                      : ready
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {claimed ? t(lang, 'claimed') : t(lang, 'claim')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------------- ACHIEVEMENTS SCREEN ---------------- */
interface AchievementsScreenProps {
  saveData: SaveData;
  onClaimAchievement: (achievementId: string) => void;
  onBack: () => void;
}

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({
  saveData,
  onClaimAchievement,
  onBack,
}) => {
  const lang = saveData.settings.language;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      <ScreenHeader title={t(lang, 'achievements')} coins={saveData.coins} onBack={onBack} />

      <div className="flex-1 overflow-y-auto game-scroll p-4 space-y-3">
        {ACHIEVEMENTS.map((ach) => {
          const val = Math.min(ach.target, saveData.stats[ach.statKey] ?? 0);
          const pct = Math.round((val / ach.target) * 100);
          const claimed = Boolean(saveData.achievements[ach.id]?.claimed);
          const ready = val >= ach.target && !claimed;

          return (
            <div
              key={ach.id}
              className="rounded-2xl bg-slate-900 border border-white/10 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <Award
                    className={`w-5 h-5 mt-0.5 shrink-0 ${
                      val >= ach.target ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  />
                  <div>
                    <h3 className="text-sm font-extrabold text-white">{ach.title}</h3>
                    <p className="text-xs text-slate-300 mt-0.5">{ach.description}</p>
                  </div>
                </div>
                <span className="text-xs font-black text-amber-300 shrink-0 tabular-nums">
                  +{ach.rewardCoins}
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs text-slate-300 font-semibold tabular-nums">
                  {val} / {ach.target}
                </span>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => {
                    audioManager.playReward();
                    onClaimAchievement(ach.id);
                  }}
                  className={`h-9 px-4 rounded-xl text-xs font-black ${
                    claimed
                      ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                      : ready
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {claimed ? t(lang, 'claimed') : t(lang, 'claim')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------------- SETTINGS SCREEN ---------------- */
interface SettingsScreenProps {
  saveData: SaveData;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResetProgress: () => void;
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  saveData,
  onUpdateSettings,
  onResetProgress,
  onBack,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const s = saveData.settings;
  const lang = s.language;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      <ScreenHeader title={t(lang, 'settings')} coins={saveData.coins} onBack={onBack} />

      <div className="flex-1 overflow-y-auto game-scroll p-4 space-y-3.5">
        {/* Audio Controls */}
        <div className="rounded-2xl bg-slate-900 border border-white/10 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">{t(lang, 'music')}</span>
            <button
              type="button"
              onClick={() => {
                audioManager.playClick();
                onUpdateSettings({ music: !s.music });
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                s.music ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {s.music ? 'ON' : 'OFF'}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.musicVolume}
            onChange={(e) => onUpdateSettings({ musicVolume: Number(e.target.value) })}
            className="w-full accent-emerald-400"
            aria-label="Music volume"
          />

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-sm font-bold text-white">{t(lang, 'sound')}</span>
            <button
              type="button"
              onClick={() => onUpdateSettings({ sound: !s.sound })}
              className={`px-4 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                s.sound ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {s.sound ? 'ON' : 'OFF'}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.soundVolume}
            onChange={(e) => onUpdateSettings({ soundVolume: Number(e.target.value) })}
            className="w-full accent-sky-400"
            aria-label="Sound effects volume"
          />
        </div>

        {/* Vibration & Controls */}
        <div className="rounded-2xl bg-slate-900 border border-white/10 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">{t(lang, 'vibration')}</span>
            <button
              type="button"
              onClick={() => {
                audioManager.playClick();
                onUpdateSettings({ vibration: !s.vibration });
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                s.vibration ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {s.vibration ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-sm font-bold text-white">{t(lang, 'handedness')}</span>
            <div className="flex gap-1.5">
              {(['left', 'right'] as const).map((hand) => (
                <button
                  key={hand}
                  type="button"
                  onClick={() => {
                    audioManager.playClick();
                    onUpdateSettings({ handedness: hand });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    s.handedness === hand
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {hand === 'left' ? t(lang, 'leftHand') : t(lang, 'rightHand')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Language Selection */}
        <div className="rounded-2xl bg-slate-900 border border-white/10 p-4 space-y-2.5">
          <div className="text-sm font-bold text-white">{t(lang, 'language')}</div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['en', 'English'],
                ['es', 'Español'],
                ['fr', 'Français'],
                ['ar', 'العربية'],
              ] as [LanguageCode, string][]
            ).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  audioManager.playClick();
                  onUpdateSettings({ language: code });
                }}
                className={`h-10 rounded-xl text-xs font-bold cursor-pointer ${
                  s.language === code
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy & Reset */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              audioManager.playClick();
              setShowPrivacy((p) => !p);
            }}
            className="w-full h-12 rounded-2xl bg-slate-900 border border-white/10 px-4 flex items-center justify-between text-sm font-bold text-white cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t(lang, 'privacy')}</span>
            </span>
            <span className="text-xs text-slate-400">{showPrivacy ? 'Hide' : 'View'}</span>
          </button>

          {showPrivacy && (
            <div className="rounded-2xl bg-slate-900/90 border border-white/10 p-4 text-xs text-slate-300 leading-relaxed">
              Bubble Pop Adventure runs offline-first. Your campaign levels, stars, coins,
              inventory, missions, achievements, and preferences are stored locally in your
              browser storage and are never transmitted to third-party ad networks.
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              audioManager.playClick();
              setConfirmReset(true);
            }}
            className="w-full h-12 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-300 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{t(lang, 'resetProgress')}</span>
          </button>
        </div>
      </div>

      {confirmReset && (
        <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-xs rounded-3xl bg-slate-900 border border-rose-400/35 p-5 space-y-4 text-center">
            <AlertTriangle className="w-9 h-9 text-rose-400 mx-auto" />
            <h3 className="text-lg font-black text-white">Reset All Progress?</h3>
            <p className="text-xs text-slate-300">
              This clears your unlocked levels, stars, coins, cosmetics, and achievements.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="h-11 rounded-xl bg-white/10 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  audioManager.playClick();
                  onResetProgress();
                  setConfirmReset(false);
                }}
                className="h-11 rounded-xl bg-rose-500 text-white font-black text-xs cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
