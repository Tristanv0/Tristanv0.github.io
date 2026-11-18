// Metres and seconds, with a quadratic horizontal drag term for feather drag.
export const COURT = { halfWidth: 3.05, singlesHalfWidth: 2.59, length: 13.4, netY: 6.7, netHeight: 1.524, serviceOffset: 1.98 };
export const DRAG = .115;
export const SHUTTLE_SPEED_MULTIPLIER = 1.5;
const VERTICAL_DRAG = .42;
const GRAVITY = 9.81;
export type Side = 'player' | 'npc';
export type Shuttle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; hitter: Side };
export type Point = { x: number; y: number };
export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function servicePosition(side: Side, score: number): Point {
  const right = score % 2 === 0;
  return { x: (side === 'player' ? 1 : -1) * (right ? 1.3 : -1.3), y: side === 'player' ? 10.2 : 3.2 };
}

export function launchShot(from: Pick<Shuttle, 'x' | 'y' | 'z'>, target: Point, speed: number, hitter: Side): Shuttle {
  const dx = target.x - from.x, dy = target.y - from.y;
  const distance = Math.max(.1, Math.hypot(dx, dy));
  // Exact planar flight time with quadratic drag, then solve the vertical arc
  // to reach floor level at that time. A minimum lift clears the net safely.
  const duration = Math.expm1(DRAG * distance) / (DRAG * speed);
  const verticalVelocity = (GRAVITY * duration / VERTICAL_DRAG - from.z) * VERTICAL_DRAG
    / (1 - Math.exp(-VERTICAL_DRAG * duration)) - GRAVITY / VERTICAL_DRAG;
  const crossesNet = (from.y - COURT.netY) * (target.y - COURT.netY) < 0;
  const netDistance = crossesNet ? distance * Math.abs((COURT.netY - from.y) / (target.y - from.y)) : 0;
  const netTime = Math.expm1(DRAG * netDistance) / (DRAG * speed);
  const netLift = netTime > .02 ? (COURT.netHeight + .22 + GRAVITY * netTime / VERTICAL_DRAG - from.z)
    * VERTICAL_DRAG / (1 - Math.exp(-VERTICAL_DRAG * netTime)) - GRAVITY / VERTICAL_DRAG : 0;
  return { ...from, vx: dx / distance * speed, vy: dy / distance * speed, vz: Math.max(verticalVelocity, netLift), hitter };
}

export function launchPlayerShot(from: Pick<Shuttle, 'x' | 'y' | 'z'>, swing: Point): Shuttle {
  const swingSpeed = Math.hypot(swing.x, swing.y);
  const power = 8.8 + Math.min(swingSpeed, 2000) * .0038;
  // Undo the court's perspective projection to map screen movement onto the
  // court plane. No aim correction or boundary clamp: sideways/backward swings
  // can go wide or long. A still racket gives a gentle forward block.
  const dy = swingSpeed > 40 ? swing.y / 30 : -1;
  const dx = swingSpeed > 40 ? (swing.x - 1.5 * from.x * dy) / (52 + from.y * 1.5) : 0;
  const length = Math.hypot(dx, dy);
  return { ...from, vx: dx / length * power, vy: dy / length * power, vz: 3.8, hitter: 'player' };
}

export function advanceShuttle(shuttle: Shuttle, dt: number) {
  // Speed up the whole flight so serves and returns retain their arc and drag.
  dt *= SHUTTLE_SPEED_MULTIPLIER;
  const decay = 1 / (1 + DRAG * Math.hypot(shuttle.vx, shuttle.vy) * dt);
  shuttle.vx *= decay;
  shuttle.vy *= decay;
  shuttle.vz += (-GRAVITY - VERTICAL_DRAG * shuttle.vz) * dt;
  shuttle.x += shuttle.vx * dt;
  shuttle.y += shuttle.vy * dt;
  shuttle.z += shuttle.vz * dt;
}

export function landingWinner(shuttle: Shuttle): Side {
  const out = Math.abs(shuttle.x) > COURT.singlesHalfWidth || shuttle.y < 0 || shuttle.y > COURT.length;
  if (out) return shuttle.hitter === 'player' ? 'npc' : 'player';
  return shuttle.y < COURT.netY ? 'player' : 'npc';
}

export function hasWon(score: number, opponent: number) {
  return score >= 30 || (score >= 21 && score - opponent >= 2);
}

export function segmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}
