import {
  BubbleColor,
  CellData,
  LevelConfig,
  LevelObjective,
  WorldId,
} from '../types/game';

export const GRID_COLS = 11;
export const MAX_GRID_ROWS = 13;
export const DANGER_ROW = 11;

const ALL_COLORS: BubbleColor[] = [
  'red',
  'blue',
  'yellow',
  'purple',
  'green',
  'orange',
];

const PATTERNS = [
  'Honeycomb Wave',
  'Twin Pillars',
  'Diamond Cluster',
  'Candy Archway',
  'Funnel Siege',
  'Hanging Vines',
  'Star Vault',
  'Spiral Crown',
  'Stone Bastion',
  'Cascade Pyramid',
  'Checkerboard Core',
  'Galactic Ring',
];

function createSeededRng(seed: number): () => number {
  let state = (seed * 2654435761 + 1013904223) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function colsInRow(row: number): number {
  return row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
}

export function getHexNeighbors(row: number, col: number): [number, number][] {
  const offsets: [number, number][] =
    row % 2 === 0
      ? [
          [0, -1],
          [0, 1],
          [-1, -1],
          [-1, 0],
          [1, -1],
          [1, 0],
        ]
      : [
          [0, -1],
          [0, 1],
          [-1, 0],
          [-1, 1],
          [1, 0],
          [1, 1],
        ];

  const out: [number, number][] = [];
  for (const [dr, dc] of offsets) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < MAX_GRID_ROWS && nc >= 0 && nc < colsInRow(nr)) {
      out.push([nr, nc]);
    }
  }
  return out;
}

function ensureCeilingConnected(rows: (CellData | null)[][]): void {
  const visited = new Set<string>();
  const queue: [number, number][] = [];

  for (let c = 0; c < colsInRow(0); c++) {
    if (rows[0][c]) {
      visited.add(`0,${c}`);
      queue.push([0, c]);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const [r, c] = queue[head++];
    for (const [nr, nc] of getHexNeighbors(r, c)) {
      const key = `${nr},${nc}`;
      if (!visited.has(key) && rows[nr]?.[nc]) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] && !visited.has(`${r},${c}`)) {
        rows[r][c] = null;
      }
    }
  }
}

function getWorldForLevel(id: number): WorldId {
  if (id <= 50) return 'candy';
  if (id <= 100) return 'forest';
  if (id <= 150) return 'ocean';
  return 'space';
}

function generateLevel(id: number): LevelConfig {
  const rng = createSeededRng(id * 97 + 13);
  const worldId = getWorldForLevel(id);
  const levelInWorld = ((id - 1) % 50) + 1;

  // Progressive color count: 3 early -> 4 -> 5 -> 6 in late worlds
  let colorCount = 3;
  if (id > 8 && id <= 40) colorCount = 4;
  else if (id > 40 && id <= 110) colorCount = 5;
  else if (id > 110) colorCount = 6;

  // Shuffle color palette deterministically per level
  const palettePool = [...ALL_COLORS];
  for (let i = palettePool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [palettePool[i], palettePool[j]] = [palettePool[j], palettePool[i]];
  }
  const availableColors = palettePool.slice(0, colorCount);

  const patternIdx = (id - 1 + Math.floor(id / 12)) % PATTERNS.length;
  const layoutPattern = PATTERNS[patternIdx];

  // Number of filled initial rows scales smoothly 4..8
  const rowDepth = Math.min(8, 4 + Math.floor(levelInWorld / 14) + (id > 100 ? 1 : 0));

  const rows: (CellData | null)[][] = Array.from({ length: MAX_GRID_ROWS }, (_, r) =>
    Array.from({ length: colsInRow(r) }, () => null),
  );

  // Choose objective type
  let objectiveType: LevelObjective['type'] = 'clear_all';
  if (id >= 6 && id % 5 === 0) {
    objectiveType = 'rescue_stars';
  } else if (id >= 12 && id % 4 === 2) {
    objectiveType = 'collect_color';
  } else if (id >= 26 && id % 7 === 0) {
    objectiveType = 'clear_obstacles';
  }

  // Helper to pick clustered colors so formations feel hand-crafted & playable
  const pickColor = (r: number, c: number): BubbleColor => {
    const neighbors = getHexNeighbors(r, c);
    for (const [nr, nc] of neighbors) {
      const nb = rows[nr]?.[nc];
      if (nb && nb.kind === 'normal' && rng() < 0.48) {
        return nb.color;
      }
    }
    return availableColors[Math.floor(rng() * availableColors.length)];
  };

  for (let r = 0; r < rowDepth; r++) {
    const cols = colsInRow(r);
    const center = (cols - 1) / 2;
    for (let c = 0; c < cols; c++) {
      let place = true;
      const distFromCenter = Math.abs(c - center);

      switch (patternIdx) {
        case 0: // Honeycomb Wave
          place = r < rowDepth - 1 || c % 2 === 0;
          break;
        case 1: // Twin Pillars
          place = r === 0 || distFromCenter >= 1.2 || r >= rowDepth - 2;
          break;
        case 2: // Diamond Cluster
          place = r === 0 || distFromCenter <= rowDepth - Math.abs(r - Math.floor(rowDepth / 2));
          break;
        case 3: // Candy Archway
          place = r < 2 || distFromCenter >= 1.8;
          break;
        case 4: // Funnel Siege
          place = distFromCenter <= Math.max(2.2, (cols / 2) - r * 0.45);
          break;
        case 5: // Hanging Vines
          place = r === 0 || c % 3 !== 1 || r < 3;
          break;
        case 6: // Star Vault
          place = r === 0 || distFromCenter <= 3.5;
          break;
        case 7: // Spiral Crown
          place = (r + c) % 4 !== 3 || r < 2;
          break;
        case 8: // Stone Bastion
          place = r === 0 || distFromCenter >= 0.8;
          break;
        case 9: // Cascade Pyramid
          place = distFromCenter <= cols / 2 - r * 0.35;
          break;
        case 10: // Checkerboard Core
          place = r < 2 || (r + c) % 2 === 0 || distFromCenter <= 2;
          break;
        case 11: // Galactic Ring
          place = r === 0 || r === rowDepth - 1 || distFromCenter >= 2 || r === 1;
          break;
      }

      // Guarantee row 0 has solid anchor clusters
      if (r === 0 && !place && c % 2 === 0) place = true;

      if (place) {
        rows[r][c] = {
          color: pickColor(r, c),
          kind: 'normal',
        };
      }
    }
  }

  ensureCeilingConnected(rows);

  // Inject special level features based on objective & world progression
  const occupied: [number, number][] = [];
  for (let r = 0; r < rowDepth; r++) {
    for (let c = 0; c < colsInRow(r); c++) {
      if (rows[r][c]) occupied.push([r, c]);
    }
  }

  let starsPlaced = 0;
  let stonesPlaced = 0;

  if (objectiveType === 'rescue_stars') {
    const desiredStars = Math.min(4, 2 + Math.floor(id / 65));
    const midCells = occupied.filter(([r]) => r >= 1 && r <= Math.max(2, rowDepth - 2));
    for (let i = 0; i < desiredStars && midCells.length > 0; i++) {
      const idx = Math.floor(rng() * midCells.length);
      const [sr, sc] = midCells.splice(idx, 1)[0];
      const cell = rows[sr][sc];
      if (cell) {
        cell.kind = 'star_trap';
        starsPlaced++;
      }
    }
    if (starsPlaced === 0) objectiveType = 'clear_all';
  }

  if (objectiveType === 'clear_obstacles' || (id >= 30 && id % 9 === 0)) {
    const desiredStones = objectiveType === 'clear_obstacles' ? Math.min(5, 2 + Math.floor(id / 55)) : 2;
    const lowerCells = occupied.filter(([r]) => r >= 2 && r <= rowDepth - 1);
    for (let i = 0; i < desiredStones && lowerCells.length > 0; i++) {
      const idx = Math.floor(rng() * lowerCells.length);
      const [sr, sc] = lowerCells.splice(idx, 1)[0];
      const cell = rows[sr][sc];
      if (cell && cell.kind === 'normal') {
        cell.kind = 'stone';
        stonesPlaced++;
      }
    }
    if (objectiveType === 'clear_obstacles' && stonesPlaced === 0) {
      objectiveType = 'clear_all';
    }
  }

  // Sprinkle helpful board special bubbles (bomb/lightning) occasionally in mid-late levels
  if (id >= 15 && id % 6 === 3) {
    const candidate = occupied.filter(([r, c]) => r >= 2 && rows[r][c]?.kind === 'normal');
    if (candidate.length > 0) {
      const [br, bc] = candidate[Math.floor(rng() * candidate.length)];
      const cell = rows[br][bc];
      if (cell) cell.kind = id % 12 === 3 ? 'bomb' : 'lightning';
    }
  }

  // Count total bubbles & color distribution
  let poppableCount = 0;
  const colorCounts: Record<BubbleColor, number> = {
    red: 0,
    blue: 0,
    yellow: 0,
    purple: 0,
    green: 0,
    orange: 0,
  };

  for (let r = 0; r < rowDepth; r++) {
    for (let c = 0; c < colsInRow(r); c++) {
      const cell = rows[r][c];
      if (cell && cell.kind !== 'stone') {
        poppableCount++;
        colorCounts[cell.color]++;
      }
    }
  }

  let objective: LevelObjective = {
    type: objectiveType,
    targetCount: poppableCount,
  };

  if (objectiveType === 'collect_color') {
    let bestColor = availableColors[0];
    let bestCount = 0;
    for (const col of availableColors) {
      if (colorCounts[col] > bestCount) {
        bestCount = colorCounts[col];
        bestColor = col;
      }
    }
    const targetCount = Math.max(5, Math.min(bestCount, Math.ceil(bestCount * 0.78)));
    objective = {
      type: 'collect_color',
      targetColor: bestColor,
      targetCount,
    };
  } else if (objectiveType === 'rescue_stars') {
    objective = {
      type: 'rescue_stars',
      targetCount: starsPlaced,
    };
  } else if (objectiveType === 'clear_obstacles') {
    objective = {
      type: 'clear_obstacles',
      targetCount: stonesPlaced,
    };
  }

  // Shot budget calibrated cleanly so every level is fair & winnable
  const difficultyFactor =
    id <= 20 ? 1.0 : id <= 75 ? 0.92 : id <= 140 ? 0.86 : 0.82;
  const baseShots = Math.round(
    Math.max(16, Math.min(36, (poppableCount * 0.56 + 10) * difficultyFactor)),
  );

  const difficulty: LevelConfig['difficulty'] =
    id <= 35 ? 'easy' : id <= 95 ? 'medium' : id <= 155 ? 'hard' : 'expert';

  const baseScoreEstimate = poppableCount * 22 + 250;
  const starThresholds: [number, number, number] = [
    Math.round(baseScoreEstimate * 0.7),
    Math.round(baseScoreEstimate * 1.15),
    Math.round(baseScoreEstimate * 1.65),
  ];

  const coinReward = 25 + Math.floor(id / 8) * 3;

  return {
    id,
    worldId,
    levelInWorld,
    title: `${layoutPattern}`,
    availableColors,
    shots: baseShots,
    objective,
    starThresholds,
    coinReward,
    difficulty,
    layoutPattern,
    rows,
  };
}

const LEVEL_CACHE: LevelConfig[] = Array.from({ length: 200 }, (_, i) =>
  generateLevel(i + 1),
);

export function getLevelConfig(levelId: number): LevelConfig {
  const clamped = Math.max(1, Math.min(200, Math.floor(levelId)));
  const cached = LEVEL_CACHE[clamped - 1];
  // Return a deep clone of rows so gameplay mutates a fresh grid
  return {
    ...cached,
    availableColors: [...cached.availableColors],
    objective: { ...cached.objective },
    starThresholds: [...cached.starThresholds] as [number, number, number],
    rows: cached.rows.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
  };
}

export function getLevelsForWorld(worldId: WorldId): LevelConfig[] {
  return LEVEL_CACHE.filter((l) => l.worldId === worldId);
}
