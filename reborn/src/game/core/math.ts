/** Vector math helpers. */
export interface Vec2 { x: number; y: number }
export interface Vec3 { x: number; y: number; z: number }

export function len(x: number, y: number): number { return Math.sqrt(x * x + y * y); }
export function dist(ax: number, ay: number, bx: number, by: number): number { return Math.hypot(bx - ax, by - ay); }
export function clamp(v: number, min: number, max: number): number { return v < min ? min : v > max ? max : v; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function angleTo(fx: number, fy: number, tx: number, ty: number): number { return Math.atan2(ty - fy, tx - fx); }

export function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function approachAngle(current: number, target: number, maxStep: number): number {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}
