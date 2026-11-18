import { advanceShuttle, clamp, COURT, launchShot, type Point, type Shuttle } from './badminton-physics.ts';

export const NPC_MOVEMENT_SPEED_MULTIPLIER = 1.25;
export const NPC_OUT_CHANCE = .05;

export type NpcResponse = { target: Point; reaction: number; speed: number };

export function planNpcResponse(shuttle: Shuttle, random = Math.random): NpcResponse {
  const prediction = { ...shuttle };
  for (let i = 0; i < 400; i++) {
    advanceShuttle(prediction, 1 / 120);
    if ((prediction.y < 6.2 && prediction.vz < 0 && prediction.z < 1.5) || prediction.z <= 0) break;
  }
  // Decide once per incoming shot, rather than rolling for a miss every frame.
  // A flat 10% mistake chance, independent of shot speed and rally length.
  const misread = random() < .1;
  const errorX = misread ? (random() < .5 ? -1 : 1) * (.95 + random() * .4) : (random() - .5) * .3;
  const errorY = (random() - .5) * (misread ? .8 : .3);
  return {
    target: { x: clamp(prediction.x + errorX, -2.8, 2.8), y: clamp(prediction.y + errorY, .4, 6.1) },
    reaction: .14 + random() * .16 + (misread ? .4 : 0),
    speed: 2.7 + random() * .5,
  };
}

export function advanceNpc(position: Point, response: NpcResponse, dt: number) {
  if (response.reaction > 0) {
    const waiting = Math.min(response.reaction, dt);
    response.reaction -= waiting;
    dt -= waiting;
  }
  const dx = response.target.x - position.x, dy = response.target.y - position.y;
  const distance = Math.hypot(dx, dy), step = Math.min(distance, response.speed * NPC_MOVEMENT_SPEED_MULTIPLIER * dt);
  if (distance > .001) { position.x += dx / distance * step; position.y += dy / distance * step; }
}

export function launchNpcReturn(from: Pick<Shuttle, 'x' | 'y' | 'z'>, random = Math.random): Shuttle {
  // Roll only once when the racket makes contact. Errors still fly and land
  // normally, so the player can leave an out ball or choose to return it.
  const out = random() < NPC_OUT_CHANCE;
  const target = { x: (random() - .5) * 4.2, y: 10.8 + random() * 1.6 };
  if (out) {
    if (random() < .5) target.x = (random() < .5 ? -1 : 1) * (COURT.halfWidth + .35 + random() * .5);
    else target.y = COURT.length + .6 + random() * .8;
  }
  return launchShot(from, target, 10 + random() * 2, 'npc');
}
