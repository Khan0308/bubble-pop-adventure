import { colsInRow, getHexNeighbors, MAX_GRID_ROWS } from '../data/levels';
import { BubbleColor, CellData } from '../types/game';

export const ARENA_W = 396;
export const ARENA_H = 548;
export const BUBBLE_R = 18;
export const ROW_H = BUBBLE_R * Math.sqrt(3); // ~31.1769
export const TOP_MARGIN = 18;
export const LAUNCHER_X = ARENA_W / 2;
export const LAUNCHER_Y = ARENA_H - 36;
export const MIN_AIM_ANGLE = -Math.PI + 0.17;
export const MAX_AIM_ANGLE = -0.17;
export const PROJECTILE_SPEED = 920; // logical px per second

export interface Point {
  x: number;
  y: number;
}

export interface RaycastResult {
  points: Point[];
  bounces: number;
  hitCell: [number, number] | null;
  hitCeiling: boolean;
  lastPos: Point;
  passedCells: [number, number][];
}

export function cellCenter(row: number, col: number): Point {
  const offset = row % 2 === 1 ? BUBBLE_R : 0;
  return {
    x: BUBBLE_R + offset + col * (BUBBLE_R * 2),
    y: TOP_MARGIN + BUBBLE_R + row * ROW_H,
  };
}

export function clampAimAngle(dx: number, dy: number): number | null {
  // Require aiming upward above launcher horizon
  if (dy > -16) return null;
  let angle = Math.atan2(dy, dx);
  if (angle > 0) return null;
  if (angle < MIN_AIM_ANGLE) angle = MIN_AIM_ANGLE;
  if (angle > MAX_AIM_ANGLE) angle = MAX_AIM_ANGLE;
  return angle;
}

export function traceShotPath(
  startX: number,
  startY: number,
  angle: number,
  grid: (CellData | null)[][],
  isFire = false,
  maxLength = 1500,
): RaycastResult {
  const step = 4;
  let x = startX;
  let y = startY;
  let vx = Math.cos(angle);
  let vy = Math.sin(angle);
  let bounces = 0;

  const points: Point[] = [{ x, y }];
  const passedSet = new Set<string>();
  const passedCells: [number, number][] = [];

  const hitDistSq = (BUBBLE_R * 1.82) ** 2;
  const fireDistSq = (BUBBLE_R * 1.92) ** 2;

  let traveled = 0;
  while (traveled < maxLength) {
    x += vx * step;
    y += vy * step;
    traveled += step;

    // Bounce off left/right arena walls
    if (x <= BUBBLE_R) {
      x = BUBBLE_R + (BUBBLE_R - x);
      vx = Math.abs(vx);
      bounces++;
      points.push({ x, y });
    } else if (x >= ARENA_W - BUBBLE_R) {
      x = ARENA_W - BUBBLE_R - (x - (ARENA_W - BUBBLE_R));
      vx = -Math.abs(vx);
      bounces++;
      points.push({ x, y });
    }

    // Check ceiling contact
    if (y <= TOP_MARGIN + BUBBLE_R) {
      y = TOP_MARGIN + BUBBLE_R;
      points.push({ x, y });
      return {
        points,
        bounces,
        hitCell: null,
        hitCeiling: true,
        lastPos: { x, y },
        passedCells,
      };
    }

    // Check collision with existing grid bubbles
    const thresholdSq = isFire ? fireDistSq : hitDistSq;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (!grid[r][c]) continue;
        const center = cellCenter(r, c);
        const dx = x - center.x;
        const dy = y - center.y;
        if (dx * dx + dy * dy <= thresholdSq) {
          if (isFire) {
            const key = `${r},${c}`;
            if (!passedSet.has(key)) {
              passedSet.add(key);
              passedCells.push([r, c]);
            }
          } else {
            points.push({ x, y });
            return {
              points,
              bounces,
              hitCell: [r, c],
              hitCeiling: false,
              lastPos: { x, y },
              passedCells,
            };
          }
        }
      }
    }
  }

  points.push({ x, y });
  return {
    points,
    bounces,
    hitCell: null,
    hitCeiling: false,
    lastPos: { x, y },
    passedCells,
  };
}

export function findSnapCell(
  x: number,
  y: number,
  hitCell: [number, number] | null,
  grid: (CellData | null)[][],
): [number, number] | null {
  let candidates: [number, number][] = [];

  if (hitCell) {
    const [hr, hc] = hitCell;
    candidates = getHexNeighbors(hr, hc).filter(([nr, nc]) => !grid[nr]?.[nc]);
  } else {
    // Ceiling hit: check empty cells in row 0
    for (let c = 0; c < colsInRow(0); c++) {
      if (!grid[0][c]) candidates.push([0, c]);
    }
  }

  // Fallback: search all empty cells adjacent to any occupied bubble (or row 0)
  if (candidates.length === 0) {
    for (let r = 0; r < MAX_GRID_ROWS; r++) {
      for (let c = 0; c < colsInRow(r); c++) {
        if (grid[r][c]) continue;
        if (r === 0 || getHexNeighbors(r, c).some(([nr, nc]) => Boolean(grid[nr]?.[nc]))) {
          candidates.push([r, c]);
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestDistSq = Infinity;
  for (const [r, c] of candidates) {
    const pt = cellCenter(r, c);
    const dx = pt.x - x;
    const dy = pt.y - y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = [r, c];
    }
  }
  return best;
}

export function findColorCluster(
  grid: (CellData | null)[][],
  startR: number,
  startC: number,
  targetColor: BubbleColor,
): [number, number][] {
  const visited = new Set<string>();
  const queue: [number, number][] = [[startR, startC]];
  const cluster: [number, number][] = [];
  visited.add(`${startR},${startC}`);

  let head = 0;
  while (head < queue.length) {
    const [r, c] = queue[head++];
    const cell = grid[r]?.[c];
    if (!cell || cell.kind === 'stone') continue;
    if (cell.color !== targetColor && cell.kind !== 'rainbow') continue;

    cluster.push([r, c]);
    for (const [nr, nc] of getHexNeighbors(r, c)) {
      const key = `${nr},${nc}`;
      if (!visited.has(key) && grid[nr]?.[nc]) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }
  return cluster;
}

export function findFloatingCells(grid: (CellData | null)[][]): [number, number][] {
  const visited = new Set<string>();
  const queue: [number, number][] = [];

  for (let c = 0; c < colsInRow(0); c++) {
    if (grid[0][c]) {
      visited.add(`0,${c}`);
      queue.push([0, c]);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const [r, c] = queue[head++];
    for (const [nr, nc] of getHexNeighbors(r, c)) {
      const key = `${nr},${nc}`;
      if (!visited.has(key) && grid[nr]?.[nc]) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  const floating: [number, number][] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] && !visited.has(`${r},${c}`)) {
        floating.push([r, c]);
      }
    }
  }
  return floating;
}

export function getRemainingBoardColors(
  grid: (CellData | null)[][],
  fallback: BubbleColor[],
): BubbleColor[] {
  const present = new Set<BubbleColor>();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell && cell.kind !== 'stone' && cell.kind !== 'rainbow') {
        present.add(cell.color);
      }
    }
  }
  const arr = Array.from(present);
  return arr.length > 0 ? arr : fallback;
}
