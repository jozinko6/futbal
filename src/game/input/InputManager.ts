/**
 * Configurable input manager. Aggregates a keyboard keymap + an optional
 * gamepad into a single validated InputFrame per frame.
 *
 * Solo play: one manager (P1 keys + gamepad 0).
 * Local 2P: two managers — P1 keys (no gamepad) and P2 keys + gamepad 0.
 *
 * The client sends ONLY these frames to the server (never positions/score).
 */
import { validateInput, type InputFrame } from '@/game/simulation';

export interface KeyMap {
  up: string;
  down: string;
  left: string;
  right: string;
  sprint: string;
  pass: string;
  shoot: string;
  highPass: string;
  switch: string;
}

export const P1_KEYS: KeyMap = {
  up: 'w',
  down: 's',
  left: 'a',
  right: 'd',
  sprint: 'l',
  pass: 'j',
  shoot: 'k',
  highPass: 'i',
  switch: 'q',
};

export const P2_KEYS: KeyMap = {
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  sprint: 'shift',
  pass: ',',
  shoot: '.',
  highPass: '/',
  switch: 'm',
};

export interface TouchState {
  active: boolean;
  moveX: number;
  moveY: number;
  sprint: boolean;
  pass: boolean;
  shootHeld: boolean;
  highPass: boolean;
  switchPlayer: boolean;
}

export interface InputManagerOptions {
  keys: KeyMap;
  gamepadIndex?: number;
  /** When false, this manager never reads the gamepad (used for P1 in 2P). */
  useGamepad?: boolean;
  onPause?: () => void;
}

const MOVE_KEYS = new Set([
  'w', 'a', 's', 'd',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'shift', ' ', '/',
]);

export class InputManager {
  private keys = new Set<string>();
  private touch: TouchState = {
    active: false,
    moveX: 0,
    moveY: 0,
    sprint: false,
    pass: false,
    shootHeld: false,
    highPass: false,
    switchPlayer: false,
  };
  // Edge event queue — events are queued here and consumed one per sim tick.
  private edgeQueue: Array<{
    pass: boolean;
    shootPressed: boolean;
    shootReleased: boolean;
    highPass: boolean;
    switchPlayer: boolean;
  }> = [];
  private shootHeldState = false; // tracked for shootPressed/shootReleased edges
  private seq = 0;
  private opts: InputManagerOptions;

  constructor(opts: InputManagerOptions) {
    this.opts = opts;
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  destroy() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  setTouch(state: Partial<TouchState>) {
    Object.assign(this.touch, state);
    if (state.pass) this.queueEdge({ pass: true, shootPressed: false, shootReleased: false, highPass: false, switchPlayer: false });
    if (state.highPass) this.queueEdge({ pass: false, shootPressed: false, shootReleased: false, highPass: true, switchPlayer: false });
    if (state.switchPlayer) this.queueEdge({ pass: false, shootPressed: false, shootReleased: false, highPass: false, switchPlayer: true });
  }

  consumeTouchEdges() {
    this.touch.pass = false;
    this.touch.highPass = false;
    this.touch.switchPlayer = false;
  }

  /** Queue an edge event to be consumed by the next sim tick. */
  private queueEdge(e: { pass: boolean; shootPressed: boolean; shootReleased: boolean; highPass: boolean; switchPlayer: boolean }): void {
    if (this.edgeQueue.length < 8) this.edgeQueue.push(e);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const km = this.opts.keys;
    const isMine =
      k === km.up || k === km.down || k === km.left || k === km.right ||
      k === km.sprint || k === km.pass || k === km.shoot || k === km.highPass || k === km.switch;
    if (!isMine && !(k === 'escape' && this.opts.onPause)) {
      // Don't preventDefault / capture keys that belong to the other player.
      if (!MOVE_KEYS.has(k)) return;
    }
    if (isMine || MOVE_KEYS.has(k)) e.preventDefault();

    if (k === 'escape' && this.opts.onPause) {
      this.opts.onPause();
      return;
    }
    if (k === km.pass) this.queueEdge({ pass: true, shootPressed: false, shootReleased: false, highPass: false, switchPlayer: false });
    if (k === km.highPass) this.queueEdge({ pass: false, shootPressed: false, shootReleased: false, highPass: true, switchPlayer: false });
    if (k === km.switch) this.queueEdge({ pass: false, shootPressed: false, shootReleased: false, highPass: false, switchPlayer: true });
    if (k === km.shoot && !this.shootHeldState) {
      this.shootHeldState = true;
      this.queueEdge({ pass: false, shootPressed: true, shootReleased: false, highPass: false, switchPlayer: false });
    }
    this.keys.add(k);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const km = this.opts.keys;
    if (k === km.shoot && this.shootHeldState) {
      this.shootHeldState = false;
      this.queueEdge({ pass: false, shootPressed: false, shootReleased: true, highPass: false, switchPlayer: false });
    }
    this.keys.delete(k);
  };

  private onBlur = () => {
    this.keys.clear();
  };

  private keyboardMove(): { x: number; y: number } {
    const km = this.opts.keys;
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.has(km.left)) x -= 1;
    if (k.has(km.right)) x += 1;
    if (k.has(km.up)) y -= 1;
    if (k.has(km.down)) y += 1;
    return { x, y };
  }

  private gamepadState() {
    if (!this.opts.useGamepad || this.opts.gamepadIndex == null) return null;
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    return navigator.getGamepads()[this.opts.gamepadIndex];
  }

  getInput(): InputFrame {
    let moveX = 0;
    let moveY = 0;
    let sprint = false;
    let shootHeld = false;
    const km = this.opts.keys;

    const kmv = this.keyboardMove();
    moveX += kmv.x;
    moveY += kmv.y;
    if (this.keys.has(km.sprint)) sprint = true;
    if (this.keys.has(km.shoot)) shootHeld = true;

    const pad = this.gamepadState();
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const dz = 0.2;
      if (Math.abs(ax) > dz) moveX += ax;
      if (Math.abs(ay) > dz) moveY += ay;
      if (pad.buttons[14]?.pressed) moveX -= 1;
      if (pad.buttons[15]?.pressed) moveX += 1;
      if (pad.buttons[12]?.pressed) moveY -= 1;
      if (pad.buttons[13]?.pressed) moveY += 1;
      if (pad.buttons[5]?.pressed) sprint = true;
      if (pad.buttons[1]?.pressed) shootHeld = true;
      // Queue gamepad edge events.
      if (pad.buttons[0]?.pressed) this.queueEdge({ pass: true, shootPressed: false, shootReleased: false, highPass: false, switchPlayer: false });
      if (pad.buttons[2]?.pressed) this.queueEdge({ pass: false, shootPressed: false, shootReleased: false, highPass: true, switchPlayer: false });
      if (pad.buttons[4]?.pressed) this.queueEdge({ pass: false, shootPressed: false, shootReleased: false, highPass: false, switchPlayer: true });
    }

    if (this.touch.active) {
      moveX = this.touch.moveX;
      moveY = this.touch.moveY;
      if (this.touch.sprint) sprint = true;
      if (this.touch.shootHeld) shootHeld = true;
    }

    const mag = Math.hypot(moveX, moveY);
    if (mag > 1) {
      moveX /= mag;
      moveY /= mag;
    }

    // Drain one edge event from the queue (or all-false if empty).
    const edge = this.edgeQueue.shift() ?? { pass: false, shootPressed: false, shootReleased: false, highPass: false, switchPlayer: false };

    // Track shoot held state from edges.
    if (edge.shootPressed) this.shootHeldState = true;
    if (edge.shootReleased) this.shootHeldState = false;
    // Use tracked shootHeldState for continuous shootHeld.
    if (this.shootHeldState) shootHeld = true;

    const frame = validateInput({
      seq: this.seq++,
      moveX,
      moveY,
      sprint,
      pass: edge.pass,
      shootHeld,
      highPass: edge.highPass,
      switchPlayer: edge.switchPlayer,
    });

    this.consumeTouchEdges();
    return frame;
  }

  /**
   * Consume input for a simulation tick. Returns continuous state + ONE edge
   * event from the queue. If multiple sim ticks run in one render frame, each
   * gets its own edge (the first tick gets the first edge, subsequent ticks
   * get the next or all-false). This ensures short button presses at 144 FPS
   * are never lost.
   */
  consumeForSimulationTick(): InputFrame {
    return this.getInput();
  }
}
