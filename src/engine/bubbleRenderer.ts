import { BubbleColor, SpecialKind } from '../types/game';
import { BUBBLE_R } from './bubblePhysics';

export const BUBBLE_PALETTE: Record<
  BubbleColor,
  { main: string; light: string; dark: string; rim: string; label: string }
> = {
  red: {
    main: '#ef4444',
    light: '#fca5a5',
    dark: '#991b1b',
    rim: '#fecaca',
    label: 'Red',
  },
  blue: {
    main: '#3b82f6',
    light: '#93c5fd',
    dark: '#1e3a8a',
    rim: '#bfdbfe',
    label: 'Blue',
  },
  yellow: {
    main: '#facc15',
    light: '#fef08a',
    dark: '#a16207',
    rim: '#fef9c3',
    label: 'Yellow',
  },
  purple: {
    main: '#a855f7',
    light: '#d8b4fe',
    dark: '#581c87',
    rim: '#e9d5ff',
    label: 'Purple',
  },
  green: {
    main: '#22c55e',
    light: '#86efac',
    dark: '#14532d',
    rim: '#bbf7d0',
    label: 'Green',
  },
  orange: {
    main: '#f97316',
    light: '#fdba74',
    dark: '#9a3412',
    rim: '#fed7aa',
    label: 'Orange',
  },
};

export interface PopParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface FallingBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: BubbleColor;
  kind: SpecialKind;
  rotation: number;
  vRot: number;
  alpha: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

function drawStarShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points = 5,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: BubbleColor,
  kind: SpecialKind,
  theme = 'classic',
  time = 0,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Soft drop shadow
  ctx.beginPath();
  ctx.arc(x, y + 2.5, r * 0.96, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.fill();

  if (kind === 'stone') {
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.15, x, y, r);
    grad.addColorStop(0, '#94a3b8');
    grad.addColorStop(0.65, '#475569');
    grad.addColorStop(1, '#1e293b');
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    // Stone crack lines
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y - r * 0.2);
    ctx.lineTo(x - r * 0.1, y + r * 0.05);
    ctx.lineTo(x + r * 0.25, y - r * 0.15);
    ctx.moveTo(x - r * 0.1, y + r * 0.05);
    ctx.lineTo(x + r * 0.08, y + r * 0.45);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (kind === 'rainbow') {
    const colors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
    const slice = (Math.PI * 2) / colors.length;
    const rot = time * 1.4;
    for (let i = 0; i < colors.length; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r - 0.5, rot + i * slice, rot + (i + 1) * slice + 0.04);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
    }
    const sheen = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    sheen.addColorStop(0, 'rgba(255,255,255,0.65)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    sheen.addColorStop(1, 'rgba(15,23,42,0.35)');
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();

    drawStarShape(ctx, x, y, r * 0.38, r * 0.16, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    return;
  }

  if (kind === 'bomb') {
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#64748b');
    grad.addColorStop(0.55, '#1e293b');
    grad.addColorStop(1, '#020617');
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    // Glowing fuse spark
    const pulse = 0.65 + 0.35 * Math.sin(time * 8);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
    ctx.restore();
    return;
  }

  if (kind === 'lightning') {
    const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
    grad.addColorStop(0, '#fef9c3');
    grad.addColorStop(0.55, '#eab308');
    grad.addColorStop(1, '#854d0e');
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    // Lightning bolt icon
    ctx.beginPath();
    ctx.moveTo(x + 2, y - r * 0.55);
    ctx.lineTo(x - r * 0.32, y + 1);
    ctx.lineTo(x + 1, y + 1);
    ctx.lineTo(x - 3, y + r * 0.58);
    ctx.lineTo(x + r * 0.35, y - 2);
    ctx.lineTo(x - 1, y - 2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    return;
  }

  if (kind === 'fire') {
    const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.45, '#f97316');
    grad.addColorStop(1, '#b91c1c');
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#fed7aa';
    ctx.stroke();

    // Inner flame silhouette
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.55);
    ctx.quadraticCurveTo(x + r * 0.45, y - r * 0.05, x, y + r * 0.5);
    ctx.quadraticCurveTo(x - r * 0.45, y - r * 0.05, x, y - r * 0.55);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    ctx.restore();
    return;
  }

  // Standard glossy bubble (and star_trap bubble)
  const pal = BUBBLE_PALETTE[color];
  const grad = ctx.createRadialGradient(
    x - r * 0.32,
    y - r * 0.34,
    r * 0.1,
    x,
    y,
    r,
  );
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.2, pal.light);
  grad.addColorStop(0.68, pal.main);
  grad.addColorStop(1, pal.dark);

  ctx.beginPath();
  ctx.arc(x, y, r - 0.6, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Cosmetic theme accents
  if (theme === 'candy_swirl') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y + r * 0.25, r * 0.9, -0.8, 1.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r * 0.25, y - r * 0.25, r * 0.9, 2.3, 4.4);
    ctx.stroke();
    ctx.restore();
  } else if (theme === 'crystal') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.58);
    ctx.lineTo(x + r * 0.5, y);
    ctx.lineTo(x, y + r * 0.58);
    ctx.lineTo(x - r * 0.5, y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.48)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  } else if (theme === 'cosmic') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.78, r * 0.28, -0.45, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Rim highlight
  ctx.beginPath();
  ctx.arc(x, y, r - 0.8, 0, Math.PI * 2);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = pal.rim;
  ctx.stroke();

  // Top-left glossy specular highlight
  ctx.save();
  ctx.translate(x - r * 0.34, y - r * 0.36);
  ctx.rotate(-0.55);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.28, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
  ctx.restore();

  // Trapped star inside star_trap bubble
  if (kind === 'star_trap') {
    drawStarShape(ctx, x, y + 1, r * 0.52, r * 0.23, 5);
    ctx.fillStyle = '#fde047';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#fffbeb';
    ctx.stroke();
  }

  ctx.restore();
}

export function drawLauncher(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  launcherTheme: string,
): void {
  ctx.save();
  ctx.translate(x, y);

  const baseColors: Record<string, { outer: string; inner: string; barrel: string }> = {
    royal: { outer: '#f59e0b', inner: '#78350f', barrel: '#fbbf24' },
    forest_wand: { outer: '#10b981', inner: '#064e3b', barrel: '#34d399' },
    coral: { outer: '#06b6d4', inner: '#164e63', barrel: '#38bdf8' },
    starlight: { outer: '#a855f7', inner: '#3b0764', barrel: '#c084fc' },
  };
  const style = baseColors[launcherTheme] ?? baseColors.royal;

  // Rotating pointer barrel
  ctx.save();
  ctx.rotate(angle + Math.PI / 2);
  ctx.beginPath();
  ctx.roundRect(-11, -38, 22, 34, 8);
  ctx.fillStyle = style.barrel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.stroke();
  ctx.restore();

  // Turret ring base
  ctx.beginPath();
  ctx.arc(0, 0, BUBBLE_R + 9, 0, Math.PI * 2);
  ctx.fillStyle = style.inner;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = style.outer;
  ctx.stroke();

  ctx.restore();
}
