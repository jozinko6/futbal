/**
 * Asset manifest — describes the sprite sheets the renderer can load.
 *
 * The procedural generator (spriteSheet.ts) is used as the default placeholder.
 * Real local PNG sheets can be dropped into /public/sprites/ and referenced
 * here; the renderer picks them up via `loadSheet()`. Every entry defines the
 * frame size, direction count, animation list, frame counts, foot pivot and
 * FPS so the renderer can blit any sheet uniformly.
 */

export interface AnimSpec {
  name: string;
  /** Row index in the sheet. */
  row: number;
  /** Number of frames in this animation. */
  frames: number;
  /** Animation FPS (frames per second). */
  fps: number;
  /** Whether this animation loops. */
  loop: boolean;
}

export interface SheetManifest {
  /** File path under /public/ (or null for the procedural placeholder). */
  src: string | null;
  frameW: number;
  frameH: number;
  directions: number;
  /** Foot pivot within the frame (x from left, y from top). */
  pivotX: number;
  pivotY: number;
  animations: AnimSpec[];
}

/** The canonical animation set every sheet should provide. */
export const ANIMATION_NAMES = [
  'idle', 'walk', 'run', 'sprint', 'dribble', 'receiveBall', 'badFirstTouch',
  'shortPass', 'drivenPass', 'lobPass', 'placedShot', 'powerShot', 'firstTimeShot',
  'pokeTackle', 'standingTackle', 'slideTackle', 'hit', 'fall', 'recover',
  'celebrate',
  'goalkeeperIdle', 'goalkeeperMove', 'goalkeeperCatch',
  'goalkeeperLowDive', 'goalkeeperHighDive', 'goalkeeperFootSave', 'goalkeeperParry',
] as const;

/** Default manifest: procedural placeholder, 32×40, 8 directions, 16 anims × 4 frames. */
export const DEFAULT_MANIFEST: SheetManifest = {
  src: null, // null → use procedural spriteSheet.ts
  frameW: 32,
  frameH: 40,
  directions: 8,
  pivotX: 16,
  pivotY: 39,
  animations: [
    { name: 'idle', row: 0, frames: 4, fps: 3, loop: true },
    { name: 'walk', row: 1, frames: 4, fps: 8, loop: true },
    { name: 'run', row: 2, frames: 4, fps: 12, loop: true },
    { name: 'sprint', row: 3, frames: 4, fps: 14, loop: true },
    { name: 'dribble', row: 4, frames: 4, fps: 10, loop: true },
    { name: 'pass', row: 5, frames: 4, fps: 12, loop: false },
    { name: 'shoot', row: 6, frames: 4, fps: 12, loop: false },
    { name: 'lobPass', row: 7, frames: 4, fps: 10, loop: false },
    { name: 'tackle', row: 8, frames: 4, fps: 12, loop: false },
    { name: 'hit', row: 9, frames: 4, fps: 8, loop: false },
    { name: 'header', row: 10, frames: 4, fps: 10, loop: false },
    { name: 'celebrate', row: 11, frames: 4, fps: 8, loop: true },
    { name: 'gkIdle', row: 12, frames: 4, fps: 3, loop: true },
    { name: 'gkRun', row: 13, frames: 4, fps: 10, loop: true },
    { name: 'gkCatch', row: 14, frames: 4, fps: 10, loop: false },
    { name: 'gkDive', row: 15, frames: 4, fps: 12, loop: false },
  ],
};
