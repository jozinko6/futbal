/**
 * Kačanovská FIFA — original player sprite-sheet generator.
 *
 * Produces a single PNG sprite sheet of all player animations at the unified
 * visual spec:
 *   - frame: 32 × 40 px
 *   - 8 directions (E, SE, S, SW, W, NW, N, NE)
 *   - 16 animation states (idle, walk, run, sprint, dribble, pass, shoot,
 *     lobPass, tackle, hit, header, celebrate, gkIdle, gkRun, gkCatch, gkDive)
 *   - transparent background (alpha)
 *   - foot pivot at bottom-centre (x=16, y=39)
 *   - consistent drop shadow
 *   - limited 16-bit palette, original jerseys (no real club logos/identity)
 *
 * The sheet is rendered procedurally to an offscreen canvas — every pixel is
 * original. No third-party sprite is copied. The output is a PNG data URL the
 * renderer blits with nearest-neighbour scaling (imageSmoothingEnabled=false).
 *
 * Layout: columns = directions (8), rows = animations (16) × frames-per-anim.
 * Each animation has FRAMES frames cycled by the renderer.
 */
import { TEAM_COLORS } from '@/game/simulation';

export const FRAME_W = 32;
export const FRAME_H = 40;
export const DIRECTIONS = 8;
/** Animation names in sheet row order. */
export const ANIMATIONS = [
  'idle',
  'walk',
  'run',
  'sprint',
  'dribble',
  'pass',
  'shoot',
  'lobPass',
  'tackle',
  'hit',
  'header',
  'celebrate',
  'gkIdle',
  'gkRun',
  'gkCatch',
  'gkDive',
] as const;
export type AnimationName = (typeof ANIMATIONS)[number];
export const FRAMES = 4; // frames per animation

// 16-bit palette (per team). Original — no real club colours/logos.
const PALETTE = {
  skin: '#f1c27d',
  skinShade: '#d9a65e',
  hair: '#3b2a1a',
  boot: '#20242b',
  bootLace: '#e8e8e8',
  shadow: 'rgba(0,0,0,0.32)',
  outline: '#1a1a1a',
};

export interface SpriteSheet {
  canvas: HTMLCanvasElement;
  frameW: number;
  frameH: number;
  directions: number;
  animations: readonly AnimationName[];
  frames: number;
}

/**
 * Build the sprite sheet for a team (0 = home red, 1 = away blue).
 * Call once per team; cache the result.
 */
export function createPlayerSheet(team: 0 | 1): SpriteSheet {
  const cols = DIRECTIONS;
  const rows = ANIMATIONS.length * FRAMES;
  const c = document.createElement('canvas');
  c.width = cols * FRAME_W;
  c.height = rows * FRAME_H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const jersey = team === 0 ? TEAM_COLORS.home : TEAM_COLORS.away;

  for (let a = 0; a < ANIMATIONS.length; a++) {
    const anim = ANIMATIONS[a];
    for (let f = 0; f < FRAMES; f++) {
      for (let d = 0; d < DIRECTIONS; d++) {
        const x = d * FRAME_W;
        const y = (a * FRAMES + f) * FRAME_H;
        drawFrame(ctx, x, y, anim, f, d, jersey, team);
      }
    }
  }

  return {
    canvas: c,
    frameW: FRAME_W,
    frameH: FRAME_H,
    directions: DIRECTIONS,
    animations: ANIMATIONS,
    frames: FRAMES,
  };
}

/** Map a facing angle (radians) to one of 8 sheet directions (0..7). */
export function angleToDirection(facing: number): number {
  // 0 = E, increasing clockwise: SE, S, SW, W, NW, N, NE
  const norm = ((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const idx = Math.round(norm / (Math.PI / 4)) % 8;
  return idx;
}

/** Draw a single animation frame at (ox, oy). */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  anim: AnimationName,
  frame: number,
  dir: number,
  jersey: { jersey: string; shorts: string; trim: string; skin: string },
  team: 0 | 1,
): void {
  ctx.save();
  ctx.translate(ox, oy);

  // Foot pivot at bottom-centre (16, 39). Body drawn above.
  const cx = 16;
  const footY = 36;

  // Drop shadow (consistent ellipse under feet).
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, footY + 2, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Phase 0..1 cycling across FRAMES.
  const phase = frame / FRAMES;
  const swing = Math.sin(phase * Math.PI * 2); // -1..1 walk cycle

  // Per-animation posture tweaks.
  let bodyY = footY - 22;
  let legSwing = 0;
  let armSwing = 0;
  let leanX = 0;
  let armRaise = 0; // 0..1 for pass/shoot/celebrate
  let diveX = 0;
  let diveY = 0;
  let isGK = anim.startsWith('gk');

  switch (anim) {
    case 'idle':
      bodyY += Math.sin(phase * Math.PI * 2) * 0.5;
      break;
    case 'walk':
      legSwing = swing * 2;
      armSwing = swing * 1.5;
      break;
    case 'run':
      legSwing = swing * 3;
      armSwing = swing * 2.5;
      leanX = 2;
      break;
    case 'sprint':
      legSwing = swing * 4;
      armSwing = swing * 3;
      leanX = 3;
      break;
    case 'dribble':
      legSwing = swing * 2.5;
      armSwing = swing * 2;
      leanX = 2;
      break;
    case 'pass':
      armRaise = frame === 1 || frame === 2 ? 1 : 0.3;
      legSwing = 1;
      break;
    case 'shoot':
      armRaise = frame >= 1 ? 1 : 0.3;
      legSwing = 2;
      leanX = 2;
      break;
    case 'lobPass':
      armRaise = frame >= 1 ? 0.8 : 0.3;
      legSwing = 1;
      break;
    case 'tackle':
      // Sliding: body low and extended.
      bodyY += 8;
      leanX = 4;
      legSwing = 3;
      break;
    case 'hit':
      bodyY += 2;
      armRaise = 0.6;
      break;
    case 'header':
      bodyY -= 4;
      leanX = 2;
      break;
    case 'celebrate':
      armRaise = frame % 2 === 0 ? 1 : 0.7;
      bodyY += Math.sin(phase * Math.PI * 2) * -2;
      break;
    case 'gkIdle':
      bodyY += Math.sin(phase * Math.PI * 2) * 0.5;
      armSwing = 0;
      break;
    case 'gkRun':
      legSwing = swing * 2.5;
      armSwing = swing * 2;
      break;
    case 'gkCatch':
      armRaise = frame >= 1 ? 0.9 : 0.4;
      bodyY -= 1;
      break;
    case 'gkDive':
      diveX = dir < 4 ? 3 : -3;
      diveY = 0;
      bodyY += 4;
      armRaise = 0.8;
      break;
  }

  // --- Legs ---
  ctx.fillStyle = PALETTE.boot;
  // Back leg
  ctx.fillRect(cx - 4, footY - 8 - legSwing, 3, 8 + legSwing);
  // Front leg
  ctx.fillRect(cx + 1, footY - 8 + legSwing, 3, 8 - legSwing);
  // Boot accent
  ctx.fillStyle = PALETTE.bootLace;
  ctx.fillRect(cx - 4, footY - 1 - legSwing, 3, 1);
  ctx.fillRect(cx + 1, footY - 1 + legSwing, 3, 1);

  // --- Shorts ---
  ctx.fillStyle = jersey.shorts;
  ctx.fillRect(cx - 5, bodyY + 6, 10, 5);
  // Shorts trim
  ctx.fillStyle = jersey.trim;
  ctx.fillRect(cx - 5, bodyY + 10, 10, 1);

  // --- Jersey body ---
  ctx.fillStyle = jersey.jersey;
  roundRect(ctx, cx - 6 + leanX, bodyY, 12, 8, 2);
  ctx.fill();
  // Trim stripe
  ctx.fillStyle = jersey.trim;
  ctx.fillRect(cx - 6 + leanX, bodyY + 4, 12, 1);

  // --- Arms ---
  ctx.fillStyle = jersey.jersey;
  // Back arm
  const armY1 = bodyY + 2 - armSwing;
  ctx.fillRect(cx - 8 + leanX, armY1, 2, 5 - armRaise * 2);
  // Front arm
  const armY2 = bodyY + 2 + armSwing;
  if (armRaise > 0.5) {
    // Raised arm (pass/shoot/celebrate/catch)
    ctx.fillRect(cx + 6 + leanX, bodyY - 1, 2, 4 - armRaise * 2);
    ctx.fillRect(cx + 5 + leanX, bodyY - 3, 3, 2);
  } else {
    ctx.fillRect(cx + 6 + leanX, armY2, 2, 5 - armRaise * 2);
  }

  // --- Head ---
  ctx.fillStyle = PALETTE.skin;
  ctx.beginPath();
  ctx.arc(cx + leanX, bodyY - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  // Hair / cap
  ctx.fillStyle = PALETTE.hair;
  ctx.fillRect(cx + leanX - 4, bodyY - 8, 8, 2);
  ctx.fillRect(cx + leanX - 3, bodyY - 9, 6, 1);
  // Facing nose (direction hint)
  const nx = Math.cos((dir / 8) * Math.PI * 2);
  const ny = Math.sin((dir / 8) * Math.PI * 2);
  ctx.fillStyle = PALETTE.skinShade;
  ctx.fillRect(Math.round(cx + leanX + nx * 3 - 0.5), Math.round(bodyY - 4 + ny * 3 - 0.5), 2, 2);

  // GK gloves (yellow)
  if (isGK) {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(cx - 9 + leanX, armY1 + 3, 2, 2);
    if (armRaise > 0.5) {
      ctx.fillRect(cx + 5 + leanX, bodyY - 4, 3, 2);
    } else {
      ctx.fillRect(cx + 6 + leanX, armY2 + 3, 2, 2);
    }
  }

  // Dive translation overlay (gkDive): redraw gloves forward
  if (anim === 'gkDive') {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(cx + leanX + diveX + 4, bodyY + diveY, 3, 3);
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Row index for an animation in the sheet. */
export function animationRow(anim: AnimationName): number {
  return ANIMATIONS.indexOf(anim);
}

/** Map a PlayerStateName to the best sprite animation. */
export function stateToAnim(state: string, role: string, moving: boolean): AnimationName {
  if (role === 'GK') {
    if (state === 'goalkeeperDive') return 'gkDive';
    if (state === 'stunned') return 'gkIdle';
    if (state === 'celebrate') return 'celebrate';
    if (moving) return 'gkRun';
    return 'gkIdle';
  }
  switch (state) {
    case 'idle':
      return moving ? 'walk' : 'idle';
    case 'run':
      return 'run';
    case 'sprint':
      return 'sprint';
    case 'pass':
      return 'pass';
    case 'shoot':
      return 'shoot';
    case 'tackle':
      return 'tackle';
    case 'stunned':
      return 'hit';
    case 'celebrate':
      return 'celebrate';
    default:
      return moving ? 'walk' : 'idle';
  }
}
