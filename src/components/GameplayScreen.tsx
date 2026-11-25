import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  Hammer,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  Zap,
  Bomb,
  Home,
  ArrowRight,
  Music,
  Palette,
} from 'lucide-react';
import { colsInRow, DANGER_ROW, getHexNeighbors, getLevelConfig } from '../data/levels';
import { t } from '../data/i18n';
import { POWERUP_INFO } from '../data/progression';
import { getWorldById } from '../data/worlds';
import {
  ARENA_H,
  ARENA_W,
  BUBBLE_R,
  cellCenter,
  clampAimAngle,
  findColorCluster,
  findFloatingCells,
  findSnapCell,
  getRemainingBoardColors,
  LAUNCHER_X,
  LAUNCHER_Y,
  Point,
  PROJECTILE_SPEED,
  TOP_MARGIN,
  traceShotPath,
} from '../engine/bubblePhysics';
import {
  BUBBLE_PALETTE,
  drawBubble,
  drawLauncher,
  FallingBubble,
  FloatingText,
  PopParticle,
} from '../engine/bubbleRenderer';
import { audioManager } from '../systems/audio';
import {
  BubbleColor,
  CellData,
  GameSettings,
  LevelConfig,
  PowerUpType,
  SaveData,
  SpecialKind,
} from '../types/game';

interface GameplayScreenProps {
  levelId: number;
  saveData: SaveData;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onUsePowerUp: (type: PowerUpType) => boolean;
  onLevelWin: (result: {
    levelId: number;
    score: number;
    stars: 1 | 2 | 3;
    coinsEarned: number;
    poppedCount: number;
  }) => void;
  onLevelFail: (poppedCount: number, score: number) => void;
  onExitToMenu: () => void;
  onGoToLevel: (nextId: number) => void;
}

interface ShooterBubble {
  color: BubbleColor;
  kind: SpecialKind;
}

interface ActiveProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: BubbleColor;
  kind: SpecialKind;
  passedKeys: Set<string>;
}

export const GameplayScreen: React.FC<GameplayScreenProps> = ({
  levelId,
  saveData,
  onUpdateSettings,
  onUsePowerUp,
  onLevelWin,
  onLevelFail,
  onExitToMenu,
  onGoToLevel,
}) => {
  const levelConfig: LevelConfig = useMemo(() => getLevelConfig(levelId), [levelId]);
  const world = useMemo(() => getWorldById(levelConfig.worldId), [levelConfig.worldId]);
  const lang = saveData.settings.language;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // React HUD states
  const [score, setScore] = useState(0);
  const [shotsLeft, setShotsLeft] = useState(levelConfig.shots);
  const [objectiveProgress, setObjectiveProgress] = useState(0);
  const [objectiveTarget, setObjectiveTarget] = useState(levelConfig.objective.targetCount);
  const [currentBubble, setCurrentBubble] = useState<ShooterBubble>(() => ({
    color: levelConfig.availableColors[0],
    kind: 'normal',
  }));
  const [nextBubble, setNextBubble] = useState<ShooterBubble>(() => ({
    color:
      levelConfig.availableColors[1 % levelConfig.availableColors.length] ??
      levelConfig.availableColors[0],
    kind: 'normal',
  }));
  const [recolorMode, setRecolorMode] = useState(false);
  const [phase, setPhase] = useState<'playing' | 'paused' | 'won' | 'lost'>('playing');
  const [earnedStars, setEarnedStars] = useState<1 | 2 | 3>(1);
  const [earnedCoins, setEarnedCoins] = useState(0);

  // Mutable simulation refs for smooth 60fps loop
  const gridRef = useRef<(CellData | null)[][]>([]);
  const scoreRef = useRef(0);
  const shotsRef = useRef(levelConfig.shots);
  const poppedTotalRef = useRef(0);
  const collectedTargetRef = useRef(0);
  const starsRescuedRef = useRef(0);
  const stonesClearedRef = useRef(0);
  const currentRef = useRef<ShooterBubble>(currentBubble);
  const nextRef = useRef<ShooterBubble>(nextBubble);
  const aimAngleRef = useRef<number | null>(null);
  const isAimingRef = useRef(false);
  const projectileRef = useRef<ActiveProjectile | null>(null);
  const particlesRef = useRef<PopParticle[]>([]);
  const fallingRef = useRef<FallingBubble[]>([]);
  const textsRef = useRef<FloatingText[]>([]);
  const phaseRef = useRef<'playing' | 'paused' | 'won' | 'lost'>('playing');
  const recolorModeRef = useRef(false);
  const comboRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    recolorModeRef.current = recolorMode;
  }, [recolorMode]);

  const pickRandomBoardColor = useCallback(
    (grid: (CellData | null)[][]): BubbleColor => {
      const pool = getRemainingBoardColors(grid, levelConfig.availableColors);
      return pool[Math.floor(Math.random() * pool.length)];
    },
    [levelConfig.availableColors],
  );

  // Initialize / Reset level state cleanly whenever levelId changes
  const initLevel = useCallback(() => {
    const fresh = getLevelConfig(levelId);
    gridRef.current = fresh.rows;
    scoreRef.current = 0;
    shotsRef.current = fresh.shots;
    poppedTotalRef.current = 0;
    collectedTargetRef.current = 0;
    starsRescuedRef.current = 0;
    stonesClearedRef.current = 0;
    projectileRef.current = null;
    particlesRef.current = [];
    fallingRef.current = [];
    textsRef.current = [];
    aimAngleRef.current = null;
    isAimingRef.current = false;
    comboRef.current = 0;

    const c1 = pickRandomBoardColor(fresh.rows);
    const c2 = pickRandomBoardColor(fresh.rows);
    const b1: ShooterBubble = { color: c1, kind: 'normal' };
    const b2: ShooterBubble = { color: c2, kind: 'normal' };
    currentRef.current = b1;
    nextRef.current = b2;

    setCurrentBubble(b1);
    setNextBubble(b2);
    setScore(0);
    setShotsLeft(fresh.shots);
    setObjectiveProgress(0);
    setObjectiveTarget(fresh.objective.targetCount);
    setRecolorMode(false);
    setPhase('playing');
    audioManager.setMusicContext(fresh.worldId);
  }, [levelId, pickRandomBoardColor]);

  useEffect(() => {
    initLevel();
  }, [initLevel]);

  const spawnBurst = useCallback((x: number, y: number, hexColor: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 65 + Math.random() * 145;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 20,
        radius: 3 + Math.random() * 4,
        color: hexColor,
        alpha: 1,
        life: 0,
        maxLife: 0.36 + Math.random() * 0.22,
      });
    }
  }, []);

  const spawnFloatingText = useCallback((x: number, y: number, text: string, color = '#ffffff') => {
    textsRef.current.push({
      x,
      y,
      vy: -42,
      text,
      color,
      life: 0,
      maxLife: 0.85,
      scale: 1,
    });
  }, []);

  const countBoardState = useCallback(() => {
    const grid = gridRef.current;
    let nonStoneCount = 0;
    let starCount = 0;
    let stoneCount = 0;
    let lowestOccupiedRow = -1;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c];
        if (!cell) continue;
        lowestOccupiedRow = Math.max(lowestOccupiedRow, r);
        if (cell.kind === 'stone') stoneCount++;
        else nonStoneCount++;
        if (cell.kind === 'star_trap') starCount++;
      }
    }
    return { nonStoneCount, starCount, stoneCount, lowestOccupiedRow };
  }, []);

  const computeObjectiveProgress = useCallback(() => {
    const obj = levelConfig.objective;
    const { nonStoneCount, starCount, stoneCount } = countBoardState();
    if (obj.type === 'clear_all') {
      return Math.max(0, obj.targetCount - nonStoneCount);
    }
    if (obj.type === 'collect_color') {
      return Math.min(obj.targetCount, collectedTargetRef.current);
    }
    if (obj.type === 'rescue_stars') {
      return Math.max(0, obj.targetCount - starCount);
    }
    if (obj.type === 'clear_obstacles') {
      return Math.max(0, obj.targetCount - stoneCount);
    }
    return 0;
  }, [countBoardState, levelConfig.objective]);

  const removeCells = useCallback(
    (cells: [number, number][], reason: 'pop' | 'drop' | 'blast') => {
      const grid = gridRef.current;
      const queue = [...cells];
      const removedKeys = new Set<string>();
      const triggeredSpecials: [number, number, SpecialKind][] = [];

      while (queue.length > 0) {
        const [r, c] = queue.shift()!;
        const key = `${r},${c}`;
        if (removedKeys.has(key)) continue;
        const cell = grid[r]?.[c];
        if (!cell) continue;

        // Normal pops cannot destroy stone unless blasted or dropped
        if (reason === 'pop' && cell.kind === 'stone') continue;

        removedKeys.add(key);
        const pt = cellCenter(r, c);
        grid[r][c] = null;

        if (cell.kind === 'bomb' || cell.kind === 'lightning') {
          triggeredSpecials.push([r, c, cell.kind]);
        }

        if (cell.kind === 'star_trap') {
          starsRescuedRef.current++;
          spawnFloatingText(pt.x, pt.y - 10, '★ Star Saved!', '#fde047');
        }
        if (cell.kind === 'stone') {
          stonesClearedRef.current++;
        }
        if (
          levelConfig.objective.type === 'collect_color' &&
          cell.kind !== 'stone' &&
          cell.color === levelConfig.objective.targetColor
        ) {
          collectedTargetRef.current++;
        }

        if (reason === 'drop') {
          fallingRef.current.push({
            x: pt.x,
            y: pt.y,
            vx: (Math.random() - 0.5) * 90,
            vy: -40 + Math.random() * 50,
            color: cell.color,
            kind: cell.kind,
            rotation: 0,
            vRot: (Math.random() - 0.5) * 6,
            alpha: 1,
          });
        } else {
          const burstColor =
            cell.kind === 'stone'
              ? '#94a3b8'
              : cell.kind === 'bomb'
                ? '#f97316'
                : BUBBLE_PALETTE[cell.color].light;
          spawnBurst(pt.x, pt.y, burstColor, 10);
        }
      }

      // Chain-trigger any board-embedded bomb or lightning bubbles that got popped
      for (const [sr, sc, skind] of triggeredSpecials) {
        const pt = cellCenter(sr, sc);
        if (skind === 'bomb') {
          audioManager.playBomb();
          const radiusSq = (BUBBLE_R * 4.5) ** 2;
          const extra: [number, number][] = [];
          for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
              if (!grid[r][c]) continue;
              const p2 = cellCenter(r, c);
              if ((p2.x - pt.x) ** 2 + (p2.y - pt.y) ** 2 <= radiusSq) {
                extra.push([r, c]);
              }
            }
          }
          if (extra.length > 0) removeCells(extra, 'blast');
        } else if (skind === 'lightning') {
          audioManager.playLightning();
          const rowCells: [number, number][] = [];
          for (let c = 0; c < colsInRow(sr); c++) {
            if (grid[sr][c]) rowCells.push([sr, c]);
          }
          if (rowCells.length > 0) removeCells(rowCells, 'blast');
        }
      }

      return removedKeys.size;
    },
    [levelConfig.objective.targetColor, levelConfig.objective.type, spawnBurst, spawnFloatingText],
  );

  const checkWinOrFail = useCallback(() => {
    const progress = computeObjectiveProgress();
    setObjectiveProgress(progress);
    const { nonStoneCount, lowestOccupiedRow } = countBoardState();
    const targetMet = progress >= levelConfig.objective.targetCount || nonStoneCount === 0;

    if (targetMet) {
      const remainingBonus = shotsRef.current * 50;
      const finalScore = scoreRef.current + remainingBonus;
      scoreRef.current = finalScore;
      setScore(finalScore);

      if (remainingBonus > 0) {
        spawnFloatingText(LAUNCHER_X, LAUNCHER_Y - 40, `Shots Bonus +${remainingBonus}`, '#4ade80');
      }

      const [s1, s2, s3] = levelConfig.starThresholds;
      const stars: 1 | 2 | 3 = finalScore >= s3 ? 3 : finalScore >= s2 ? 2 : finalScore >= s1 ? 1 : 1;
      const coins = levelConfig.coinReward + stars * 10;

      setEarnedStars(stars);
      setEarnedCoins(coins);
      setPhase('won');
      audioManager.playVictory();
      audioManager.vibrate([40, 30, 60]);
      onLevelWin({
        levelId: levelConfig.id,
        score: finalScore,
        stars,
        coinsEarned: coins,
        poppedCount: poppedTotalRef.current,
      });
      return;
    }

    if (lowestOccupiedRow >= DANGER_ROW || shotsRef.current <= 0) {
      setPhase('lost');
      audioManager.playFail();
      audioManager.vibrate(120);
      onLevelFail(poppedTotalRef.current, scoreRef.current);
    }
  }, [
    computeObjectiveProgress,
    countBoardState,
    levelConfig,
    onLevelFail,
    onLevelWin,
    spawnFloatingText,
  ]);

  const advanceShooterQueue = useCallback(() => {
    const grid = gridRef.current;
    const available = getRemainingBoardColors(grid, levelConfig.availableColors);
    let nextChoice = nextRef.current;
    if (nextChoice.kind === 'normal' && !available.includes(nextChoice.color)) {
      nextChoice = {
        color: available[Math.floor(Math.random() * available.length)],
        kind: 'normal',
      };
    }

    const freshNext: ShooterBubble = {
      color: available[Math.floor(Math.random() * available.length)],
      kind: 'normal',
    };
    currentRef.current = nextChoice;
    nextRef.current = freshNext;
    setCurrentBubble(nextChoice);
    setNextBubble(freshNext);
  }, [levelConfig.availableColors]);

  const resolveShotLanding = useCallback(
    (x: number, y: number, hitCell: [number, number] | null, kind: SpecialKind, color: BubbleColor) => {
      const grid = gridRef.current;
      const snap = findSnapCell(x, y, hitCell, grid);
      if (!snap) {
        advanceShooterQueue();
        checkWinOrFail();
        return;
      }

      const [sr, sc] = snap;
      const snapPt = cellCenter(sr, sc);
      let pointsEarned = 0;
      let poppedCount = 0;

      if (kind === 'bomb') {
        audioManager.playBomb();
        audioManager.vibrate([35, 25, 35]);
        const radiusSq = (BUBBLE_R * 4.6) ** 2;
        const targets: [number, number][] = [];
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < grid[r].length; c++) {
            if (!grid[r][c]) continue;
            const pt = cellCenter(r, c);
            if ((pt.x - snapPt.x) ** 2 + (pt.y - snapPt.y) ** 2 <= radiusSq) {
              targets.push([r, c]);
            }
          }
        }
        poppedCount = removeCells(targets, 'blast');
        pointsEarned = poppedCount * 25 + 60;
        spawnBurst(snapPt.x, snapPt.y, '#f97316', 24);
        spawnFloatingText(snapPt.x, snapPt.y, `BOOM +${pointsEarned}`, '#fb923c');
      } else if (kind === 'lightning') {
        audioManager.playLightning();
        audioManager.vibrate(45);
        const targets: [number, number][] = [];
        const targetRow = hitCell ? hitCell[0] : sr;
        for (let c = 0; c < colsInRow(targetRow); c++) {
          if (grid[targetRow][c]) targets.push([targetRow, c]);
        }
        poppedCount = removeCells(targets, 'blast');
        pointsEarned = poppedCount * 25 + 50;
        spawnBurst(snapPt.x, snapPt.y, '#facc15', 22);
        spawnFloatingText(snapPt.x, snapPt.y, `ZAP +${pointsEarned}`, '#fde047');
      } else if (kind === 'rainbow') {
        // Place temporarily and pop matching cluster of contacted neighbor color
        let targetColor = color;
        if (hitCell && grid[hitCell[0]]?.[hitCell[1]] && grid[hitCell[0]][hitCell[1]]!.kind !== 'stone') {
          targetColor = grid[hitCell[0]][hitCell[1]]!.color;
        } else {
          for (const [nr, nc] of getHexNeighbors(sr, sc)) {
            const nb = grid[nr]?.[nc];
            if (nb && nb.kind !== 'stone') {
              targetColor = nb.color;
              break;
            }
          }
        }
        grid[sr][sc] = { color: targetColor, kind: 'rainbow' };
        const cluster = findColorCluster(grid, sr, sc, targetColor);
        poppedCount = removeCells(cluster, 'pop');
        audioManager.playPop(comboRef.current + 1);
        pointsEarned = poppedCount * 20 + 40;
        spawnFloatingText(snapPt.x, snapPt.y, `RAINBOW +${pointsEarned}`, '#f472b6');
      } else {
        // Standard bubble placement
        grid[sr][sc] = { color, kind: 'normal' };
        const cluster = findColorCluster(grid, sr, sc, color);
        if (cluster.length >= 3) {
          poppedCount = removeCells(cluster, 'pop');
          comboRef.current++;
          audioManager.playPop(comboRef.current);
          audioManager.vibrate(20);
          pointsEarned = 30 + Math.max(0, poppedCount - 3) * 15 + (comboRef.current > 1 ? comboRef.current * 10 : 0);
          spawnFloatingText(
            snapPt.x,
            snapPt.y,
            comboRef.current > 1 ? `Combo x${comboRef.current} +${pointsEarned}` : `+${pointsEarned}`,
            '#ffffff',
          );
        } else {
          comboRef.current = 0;
          audioManager.playAttach();
        }
      }

      // Drop any floating disconnected bubbles
      const floating = findFloatingCells(grid);
      let droppedCount = 0;
      if (floating.length > 0) {
        droppedCount = removeCells(floating, 'drop');
        const dropBonus = droppedCount * 25;
        pointsEarned += dropBonus;
        audioManager.playDrop(droppedCount);
        spawnFloatingText(ARENA_W / 2, snapPt.y + 24, `Drop x${droppedCount} +${dropBonus}`, '#38bdf8');
      }

      if (pointsEarned > 0) {
        scoreRef.current += pointsEarned;
        setScore(scoreRef.current);
      }
      poppedTotalRef.current += poppedCount + droppedCount;

      advanceShooterQueue();
      checkWinOrFail();
    },
    [advanceShooterQueue, checkWinOrFail, removeCells, spawnBurst, spawnFloatingText],
  );

  const fireProjectile = useCallback(
    (angle: number) => {
      if (phaseRef.current !== 'playing' || projectileRef.current || recolorModeRef.current) return;
      if (shotsRef.current <= 0) return;

      audioManager.unlock();
      audioManager.playShoot();

      const active = currentRef.current;
      shotsRef.current -= 1;
      setShotsLeft(shotsRef.current);

      projectileRef.current = {
        x: LAUNCHER_X,
        y: LAUNCHER_Y,
        vx: Math.cos(angle) * PROJECTILE_SPEED,
        vy: Math.sin(angle) * PROJECTILE_SPEED,
        color: active.color,
        kind: active.kind,
        passedKeys: new Set<string>(),
      };
    },
    [],
  );

  const handleSwapBubbles = useCallback(() => {
    if (phaseRef.current !== 'playing' || projectileRef.current) return;
    audioManager.unlock();
    audioManager.playClick();
    const prevCurr = currentRef.current;
    const prevNext = nextRef.current;
    currentRef.current = prevNext;
    nextRef.current = prevCurr;
    setCurrentBubble(prevNext);
    setNextBubble(prevCurr);
  }, []);

  const handleActivatePowerUp = useCallback(
    (type: PowerUpType) => {
      if (phaseRef.current !== 'playing' || projectileRef.current) return;
      audioManager.unlock();

      if (type === 'color_changer') {
        if (recolorModeRef.current) {
          setRecolorMode(false);
          return;
        }
        if ((saveData.inventory.color_changer ?? 0) <= 0) return;
        audioManager.playPowerUp();
        setRecolorMode(true);
        return;
      }

      if (!onUsePowerUp(type)) return;
      audioManager.playPowerUp();
      setRecolorMode(false);

      if (type === 'extra_shots') {
        shotsRef.current += 5;
        setShotsLeft(shotsRef.current);
        spawnFloatingText(LAUNCHER_X, LAUNCHER_Y - 45, '+5 Shots!', '#4ade80');
        return;
      }

      const kindMap: Record<'rainbow' | 'bomb' | 'lightning' | 'fire', SpecialKind> = {
        rainbow: 'rainbow',
        bomb: 'bomb',
        lightning: 'lightning',
        fire: 'fire',
      };
      const updated: ShooterBubble = {
        color: currentRef.current.color,
        kind: kindMap[type],
      };
      currentRef.current = updated;
      setCurrentBubble(updated);
      spawnFloatingText(LAUNCHER_X, LAUNCHER_Y - 45, `${POWERUP_INFO[type].short} Ready!`, '#fef08a');
    },
    [onUsePowerUp, saveData.inventory.color_changer, spawnFloatingText],
  );

  const toArenaCoords = useCallback((clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * ARENA_W,
      y: ((clientY - rect.top) / rect.height) * ARENA_H,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (phaseRef.current !== 'playing' || projectileRef.current) return;
      audioManager.unlock();
      const pt = toArenaCoords(e.clientX, e.clientY);
      if (!pt) return;

      // Color Changer board tap
      if (recolorModeRef.current) {
        const grid = gridRef.current;
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < grid[r].length; c++) {
            const cell = grid[r][c];
            if (!cell || cell.kind === 'stone') continue;
            const center = cellCenter(r, c);
            if ((pt.x - center.x) ** 2 + (pt.y - center.y) ** 2 <= (BUBBLE_R * 1.15) ** 2) {
              if (!onUsePowerUp('color_changer')) {
                setRecolorMode(false);
                return;
              }
              const targetColor = currentRef.current.color;
              const cluster = findColorCluster(grid, r, c, cell.color);
              for (const [cr, cc] of cluster) {
                const targetCell = grid[cr][cc];
                if (targetCell && targetCell.kind !== 'stone') {
                  targetCell.color = targetColor;
                  const cPt = cellCenter(cr, cc);
                  spawnBurst(cPt.x, cPt.y, BUBBLE_PALETTE[targetColor].light, 8);
                }
              }
              audioManager.playPowerUp();
              spawnFloatingText(center.x, center.y, 'Recolored!', '#c084fc');
              setRecolorMode(false);
              return;
            }
          }
        }
        return;
      }

      // Check if user tapped directly on launcher to swap bubbles
      if ((pt.x - LAUNCHER_X) ** 2 + (pt.y - LAUNCHER_Y) ** 2 <= (BUBBLE_R * 1.7) ** 2) {
        handleSwapBubbles();
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      const angle = clampAimAngle(pt.x - LAUNCHER_X, pt.y - LAUNCHER_Y);
      if (angle !== null) {
        isAimingRef.current = true;
        aimAngleRef.current = angle;
      }
    },
    [handleSwapBubbles, onUsePowerUp, spawnBurst, spawnFloatingText, toArenaCoords],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isAimingRef.current || phaseRef.current !== 'playing') return;
      const pt = toArenaCoords(e.clientX, e.clientY);
      if (!pt) return;
      const angle = clampAimAngle(pt.x - LAUNCHER_X, pt.y - LAUNCHER_Y);
      aimAngleRef.current = angle;
    },
    [toArenaCoords],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isAimingRef.current) return;
      isAimingRef.current = false;
      const angle = aimAngleRef.current;
      aimAngleRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (angle !== null && phaseRef.current === 'playing') {
        fireProjectile(angle);
      }
    },
    [fireProjectile],
  );

  // Main 60fps requestAnimationFrame Physics + Canvas 2D Render Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.035, (now - lastTime) / 1000);
      lastTime = now;
      const timeSec = now / 1000;

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = ARENA_W * dpr;
        const targetH = ARENA_H * dpr;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, ARENA_W, ARENA_H);

          // Subtle glass playfield backdrop for high bubble contrast
          const fieldGrad = ctx.createLinearGradient(0, 0, 0, ARENA_H);
          fieldGrad.addColorStop(0, 'rgba(15, 23, 42, 0.56)');
          fieldGrad.addColorStop(0.75, 'rgba(15, 23, 42, 0.36)');
          fieldGrad.addColorStop(1, 'rgba(15, 23, 42, 0.68)');
          ctx.fillStyle = fieldGrad;
          ctx.fillRect(0, 0, ARENA_W, ARENA_H);

          // Top ceiling rail
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(0, TOP_MARGIN - 3, ARENA_W, 3);

          // Danger line indicator
          const dangerY = TOP_MARGIN + DANGER_ROW * (BUBBLE_R * Math.sqrt(3));
          ctx.save();
          ctx.setLineDash([7, 7]);
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(8, dangerY);
          ctx.lineTo(ARENA_W - 8, dangerY);
          ctx.stroke();
          ctx.restore();

          // Update projectile physics if active & playing
          if (phaseRef.current === 'playing' && projectileRef.current) {
            const p = projectileRef.current;
            const totalStep = PROJECTILE_SPEED * dt;
            const subSteps = Math.max(1, Math.ceil(totalStep / 4));
            const stepDt = dt / subSteps;
            let landed = false;

            for (let s = 0; s < subSteps; s++) {
              p.x += p.vx * stepDt;
              p.y += p.vy * stepDt;

              if (p.x <= BUBBLE_R) {
                p.x = BUBBLE_R + (BUBBLE_R - p.x);
                p.vx = Math.abs(p.vx);
                audioManager.playBounce();
              } else if (p.x >= ARENA_W - BUBBLE_R) {
                p.x = ARENA_W - BUBBLE_R - (p.x - (ARENA_W - BUBBLE_R));
                p.vx = -Math.abs(p.vx);
                audioManager.playBounce();
              }

              // Ceiling hit
              if (p.y <= TOP_MARGIN + BUBBLE_R) {
                if (p.kind === 'fire') {
                  // Fire bubble finishes at ceiling, drops floating bubbles & advances
                  const floating = findFloatingCells(gridRef.current);
                  if (floating.length > 0) {
                    const dropped = removeCells(floating, 'drop');
                    const bonus = dropped * 25;
                    scoreRef.current += bonus;
                    setScore(scoreRef.current);
                    poppedTotalRef.current += dropped;
                    audioManager.playDrop(dropped);
                  }
                  projectileRef.current = null;
                  advanceShooterQueue();
                  checkWinOrFail();
                  landed = true;
                  break;
                } else {
                  projectileRef.current = null;
                  resolveShotLanding(p.x, TOP_MARGIN + BUBBLE_R, null, p.kind, p.color);
                  landed = true;
                  break;
                }
              }

              // Bubble collision
              const grid = gridRef.current;
              const hitDistSq = (p.kind === 'fire' ? BUBBLE_R * 1.95 : BUBBLE_R * 1.82) ** 2;
              let collided: [number, number] | null = null;
              for (let r = 0; r < grid.length; r++) {
                for (let c = 0; c < grid[r].length; c++) {
                  if (!grid[r][c]) continue;
                  const cpt = cellCenter(r, c);
                  if ((p.x - cpt.x) ** 2 + (p.y - cpt.y) ** 2 <= hitDistSq) {
                    collided = [r, c];
                    break;
                  }
                }
                if (collided) break;
              }

              if (collided) {
                if (p.kind === 'fire') {
                  const key = `${collided[0]},${collided[1]}`;
                  if (!p.passedKeys.has(key)) {
                    p.passedKeys.add(key);
                    const destroyed = removeCells([collided], 'blast');
                    if (destroyed > 0) {
                      poppedTotalRef.current += destroyed;
                      scoreRef.current += 35;
                      setScore(scoreRef.current);
                      audioManager.playPop(3);
                    }
                  }
                } else {
                  projectileRef.current = null;
                  resolveShotLanding(p.x, p.y, collided, p.kind, p.color);
                  landed = true;
                  break;
                }
              }
            }

            if (!landed && projectileRef.current && projectileRef.current.kind === 'fire') {
              // Trail embers for fire projectile
              particlesRef.current.push({
                x: projectileRef.current.x + (Math.random() - 0.5) * 10,
                y: projectileRef.current.y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 40,
                vy: 40 + Math.random() * 40,
                radius: 3.5,
                color: '#fb923c',
                alpha: 0.9,
                life: 0,
                maxLife: 0.25,
              });
            }
          }

          // Draw grid bubbles
          const grid = gridRef.current;
          const bubbleTheme = saveData.equipped.bubbleTheme;
          for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
              const cell = grid[r][c];
              if (!cell) continue;
              const pt = cellCenter(r, c);
              drawBubble(ctx, pt.x, pt.y, BUBBLE_R, cell.color, cell.kind, bubbleTheme, timeSec);
            }
          }

          // Draw aiming trajectory guide
          if (
            phaseRef.current === 'playing' &&
            isAimingRef.current &&
            aimAngleRef.current !== null &&
            !projectileRef.current
          ) {
            const active = currentRef.current;
            const ray = traceShotPath(
              LAUNCHER_X,
              LAUNCHER_Y,
              aimAngleRef.current,
              grid,
              active.kind === 'fire',
            );
            const guideColor =
              active.kind === 'rainbow'
                ? '#f472b6'
                : active.kind === 'bomb'
                  ? '#ef4444'
                  : active.kind === 'lightning'
                    ? '#facc15'
                    : active.kind === 'fire'
                      ? '#f97316'
                      : BUBBLE_PALETTE[active.color].light;

            ctx.save();
            for (let i = 0; i < ray.points.length - 1; i++) {
              const a = ray.points[i];
              const b = ray.points[i + 1];
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const segLen = Math.hypot(dx, dy);
              const spacing = 14;
              const steps = Math.floor(segLen / spacing);
              for (let k = 1; k <= steps; k++) {
                const tFrac = (k * spacing) / segLen;
                const px = a.x + dx * tFrac;
                const py = a.y + dy * tFrac;
                ctx.beginPath();
                ctx.arc(px, py, 3.2, 0, Math.PI * 2);
                ctx.fillStyle = guideColor;
                ctx.globalAlpha = 0.85;
                ctx.fill();
              }
            }

            // Target ring preview at impact point
            ctx.beginPath();
            ctx.arc(ray.lastPos.x, ray.lastPos.y, BUBBLE_R * 0.72, 0, Math.PI * 2);
            ctx.strokeStyle = guideColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.75;
            ctx.stroke();
            ctx.restore();
          }

          // Draw launcher & active bubble
          const displayAngle = aimAngleRef.current ?? -Math.PI / 2;
          drawLauncher(ctx, LAUNCHER_X, LAUNCHER_Y, displayAngle, saveData.equipped.launcher);

          if (!projectileRef.current) {
            drawBubble(
              ctx,
              LAUNCHER_X,
              LAUNCHER_Y,
              BUBBLE_R,
              currentRef.current.color,
              currentRef.current.kind,
              bubbleTheme,
              timeSec,
            );
          }

          // Draw flying projectile
          if (projectileRef.current) {
            const p = projectileRef.current;
            drawBubble(ctx, p.x, p.y, BUBBLE_R, p.color, p.kind, bubbleTheme, timeSec);
          }

          // Update & draw falling bubbles
          const nextFalling: FallingBubble[] = [];
          for (const fb of fallingRef.current) {
            fb.vy += 680 * dt;
            fb.x += fb.vx * dt;
            fb.y += fb.vy * dt;
            fb.rotation += fb.vRot * dt;
            if (fb.y > ARENA_H - 40) {
              fb.alpha -= dt * 4;
            }
            if (fb.alpha > 0.05 && fb.y < ARENA_H + 30) {
              drawBubble(ctx, fb.x, fb.y, BUBBLE_R * 0.92, fb.color, fb.kind, bubbleTheme, timeSec, fb.alpha);
              nextFalling.push(fb);
            }
          }
          fallingRef.current = nextFalling;

          // Update & draw particles
          const nextParticles: PopParticle[] = [];
          for (const pt of particlesRef.current) {
            pt.life += dt;
            if (pt.life >= pt.maxLife) continue;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vy += 240 * dt;
            pt.alpha = 1 - pt.life / pt.maxLife;
            ctx.save();
            ctx.globalAlpha = pt.alpha;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
            ctx.fillStyle = pt.color;
            ctx.fill();
            ctx.restore();
            nextParticles.push(pt);
          }
          particlesRef.current = nextParticles;

          // Update & draw floating score texts
          const nextTexts: FloatingText[] = [];
          for (const ft of textsRef.current) {
            ft.life += dt;
            if (ft.life >= ft.maxLife) continue;
            ft.y += ft.vy * dt;
            const alpha = 1 - ft.life / ft.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = '800 15px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
            nextTexts.push(ft);
          }
          textsRef.current = nextTexts;

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [
    advanceShooterQueue,
    checkWinOrFail,
    removeCells,
    resolveShotLanding,
    saveData.equipped.bubbleTheme,
    saveData.equipped.launcher,
  ]);

  const objectiveLabel = useMemo(() => {
    const obj = levelConfig.objective;
    switch (obj.type) {
      case 'clear_all':
        return `Clear Bubbles (${objectiveProgress}/${objectiveTarget})`;
      case 'collect_color':
        return `Pop ${BUBBLE_PALETTE[obj.targetColor ?? 'red'].label} (${objectiveProgress}/${objectiveTarget})`;
      case 'rescue_stars':
        return `Rescue Stars (${objectiveProgress}/${objectiveTarget})`;
      case 'clear_obstacles':
        return `Clear Stones (${objectiveProgress}/${objectiveTarget})`;
    }
  }, [levelConfig.objective, objectiveProgress, objectiveTarget]);

  const isLeftHanded = saveData.settings.handedness === 'left';

  const powerUpButtons: { type: PowerUpType; icon: React.ReactNode }[] = [
    { type: 'rainbow', icon: <Sparkles className="w-4 h-4" /> },
    { type: 'bomb', icon: <Bomb className="w-4 h-4" /> },
    { type: 'lightning', icon: <Zap className="w-4 h-4" /> },
    { type: 'fire', icon: <Flame className="w-4 h-4" /> },
    { type: 'color_changer', icon: <Palette className="w-4 h-4" /> },
    { type: 'extra_shots', icon: <Plus className="w-4 h-4" /> },
  ];

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none">
      {/* World artwork backdrop */}
      <img
        src={world.backgroundUrl}
        alt={world.name}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      <div className="absolute inset-0 bg-slate-950/35 pointer-events-none" />

      {/* Top Compact HUD */}
      <header className="relative z-10 px-3 pt-3 pb-2 flex items-center justify-between gap-2 bg-slate-950/65 backdrop-blur-md border-b border-white/10">
        <button
          type="button"
          onClick={() => {
            audioManager.playClick();
            setPhase((p) => (p === 'playing' ? 'paused' : p));
          }}
          aria-label="Pause game"
          className="w-11 h-11 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center transition-all shrink-0 cursor-pointer"
        >
          <Pause className="w-5 h-5 text-white" />
        </button>

        <div className="flex-1 min-w-0 text-center">
          <div className="text-[11px] font-semibold text-amber-300 tracking-wide truncate">
            {t(lang, 'level')} {levelConfig.id} · {world.name}
          </div>
          <div className="text-xs font-bold text-white truncate flex items-center justify-center gap-1.5">
            {levelConfig.objective.type === 'collect_color' && levelConfig.objective.targetColor && (
              <span
                className="inline-block w-3 h-3 rounded-full border border-white/70 shrink-0"
                style={{ backgroundColor: BUBBLE_PALETTE[levelConfig.objective.targetColor].main }}
              />
            )}
            <span>{objectiveLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-slate-300 leading-none">{t(lang, 'score')}</div>
            <div className="text-sm font-extrabold text-white tabular-nums">{score}</div>
          </div>
          <div
            className={`min-w-[48px] h-11 px-2.5 rounded-2xl flex flex-col items-center justify-center border ${
              shotsLeft <= 5
                ? 'bg-rose-500/85 border-rose-300 animate-pulse'
                : 'bg-indigo-600/85 border-indigo-300/40'
            }`}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/80 leading-none">
              {t(lang, 'shots')}
            </span>
            <span className="text-base font-black text-white tabular-nums leading-tight">
              {shotsLeft}
            </span>
          </div>
        </div>
      </header>

      {/* Recolor Mode Prompt Banner */}
      {recolorMode && (
        <div className="relative z-20 mx-3 mt-1.5 px-3 py-2 rounded-xl bg-violet-600/95 border border-violet-300/50 flex items-center justify-between text-xs font-semibold shadow-lg">
          <span>Tap any bubble cluster to turn it {BUBBLE_PALETTE[currentBubble.color].label}</span>
          <button
            type="button"
            onClick={() => setRecolorMode(false)}
            className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Playfield Canvas */}
      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-2 py-1">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full max-h-full aspect-[396/548] rounded-2xl border border-white/15 shadow-2xl touch-none cursor-crosshair"
        />
      </div>

      {/* Bottom Ergonomic Thumb Tray: Next Bubble Swap + Power-ups */}
      <footer
        className={`relative z-10 px-3 pt-2 pb-3 bg-slate-950/80 backdrop-blur-md border-t border-white/10 flex items-center gap-2 ${
          isLeftHanded ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Next Bubble & Swap Button */}
        <button
          type="button"
          onClick={handleSwapBubbles}
          className="h-14 px-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center gap-2 shrink-0 transition-all cursor-pointer"
          title="Swap current & next bubble"
        >
          <div
            className="w-7 h-7 rounded-full border-2 border-white/80 shadow-inner"
            style={{
              background: `radial-gradient(circle at 32% 32%, #fff, ${BUBBLE_PALETTE[nextBubble.color].main} 60%, ${BUBBLE_PALETTE[nextBubble.color].dark})`,
            }}
          />
          <div className="text-left">
            <div className="text-[10px] text-slate-300 leading-none">Next</div>
            <div className="flex items-center gap-0.5 text-[11px] font-bold text-amber-300 mt-0.5">
              <RefreshCw className="w-3 h-3" />
              <span>Swap</span>
            </div>
          </div>
        </button>

        {/* Power-Ups Horizontal Scrollable Strip */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto game-scroll py-0.5">
          {powerUpButtons.map(({ type, icon }) => {
            const count = saveData.inventory[type] ?? 0;
            const info = POWERUP_INFO[type];
            const isActive =
              (type === 'color_changer' && recolorMode) ||
              (type !== 'color_changer' &&
                type !== 'extra_shots' &&
                currentBubble.kind === type);

            return (
              <button
                key={type}
                type="button"
                disabled={count <= 0 && !isActive}
                onClick={() => handleActivatePowerUp(type)}
                className={`relative min-w-[54px] h-14 px-2 rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 border-white shadow-lg scale-[1.03]'
                    : count > 0
                      ? 'bg-white/12 hover:bg-white/22 text-white border-white/20 active:scale-95'
                      : 'bg-white/5 text-white/35 border-white/10 cursor-not-allowed'
                }`}
              >
                {icon}
                <span className="text-[10px] font-bold leading-none whitespace-nowrap">
                  {info.short}
                </span>
                <span
                  className={`text-[10px] font-extrabold tabular-nums leading-none ${
                    isActive ? 'text-slate-900' : 'text-amber-300'
                  }`}
                >
                  x{count}
                </span>
              </button>
            );
          })}
        </div>
      </footer>

      {/* PAUSE OVERLAY */}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-5">
          <div className="w-full max-w-xs rounded-3xl bg-slate-900/95 border border-white/15 p-5 shadow-2xl space-y-4">
            <h2 className="text-2xl font-black text-center text-white">{t(lang, 'paused')}</h2>

            <div className="space-y-3 bg-white/5 rounded-2xl p-3.5 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Music className="w-4 h-4 text-pink-400" />
                  <span>{t(lang, 'music')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playClick();
                    onUpdateSettings({ music: !saveData.settings.music });
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    saveData.settings.music
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {saveData.settings.music ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {saveData.settings.sound ? (
                    <Volume2 className="w-4 h-4 text-sky-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{t(lang, 'sound')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ sound: !saveData.settings.sound });
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    saveData.settings.sound
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {saveData.settings.sound ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  audioManager.playClick();
                  setPhase('playing');
                }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{t(lang, 'resume')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  audioManager.playClick();
                  initLevel();
                }}
                className="w-full h-11 rounded-2xl bg-white/12 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t(lang, 'restart')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  audioManager.playClick();
                  onExitToMenu();
                }}
                className="w-full h-11 rounded-2xl bg-white/8 hover:bg-white/15 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>{t(lang, 'mainMenu')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY OVERLAY */}
      {phase === 'won' && (
        <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-5">
          <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-indigo-900 to-slate-900 border border-amber-300/35 p-6 shadow-2xl text-center space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-300">
              {t(lang, 'level')} {levelConfig.id}
            </div>
            <h2 className="text-2xl font-black text-white">{t(lang, 'levelComplete')}</h2>

            {/* Stars Reveal */}
            <div className="flex items-center justify-center gap-3 py-1">
              {[1, 2, 3].map((idx) => (
                <Star
                  key={idx}
                  className={`w-11 h-11 transition-transform duration-300 ${
                    idx <= earnedStars
                      ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.65)] scale-105'
                      : 'text-slate-600'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5 bg-black/30 rounded-2xl p-3 border border-white/10">
              <div>
                <div className="text-[11px] text-slate-300">{t(lang, 'score')}</div>
                <div className="text-lg font-black text-white tabular-nums">{score}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-300">Coins Earned</div>
                <div className="text-lg font-black text-amber-300 tabular-nums">+{earnedCoins}</div>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {levelConfig.id < 200 && (
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playClick();
                    onGoToLevel(levelConfig.id + 1);
                  }}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] cursor-pointer"
                >
                  <span>{t(lang, 'nextLevel')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playClick();
                    initLevel();
                  }}
                  className="h-11 rounded-2xl bg-white/12 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t(lang, 'replay')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playClick();
                    onExitToMenu();
                  }}
                  className="h-11 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>Menu</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAILED OVERLAY */}
      {phase === 'lost' && (
        <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-5">
          <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 border border-rose-400/35 p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center">
              <Hammer className="w-7 h-7 text-rose-300" />
            </div>
            <h2 className="text-2xl font-black text-white">{t(lang, 'levelFailed')}</h2>
            <p className="text-xs text-slate-300">
              Almost there! Try aiming off the side walls or using a power-up.
            </p>
            <div className="bg-black/30 rounded-2xl p-3 border border-white/10">
              <div className="text-[11px] text-slate-300">{t(lang, 'score')}</div>
              <div className="text-xl font-black text-white tabular-nums">{score}</div>
            </div>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  audioManager.playClick();
                  initLevel();
                }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t(lang, 'retry')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  audioManager.playClick();
                  onExitToMenu();
                }}
                className="w-full h-11 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>{t(lang, 'mainMenu')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
