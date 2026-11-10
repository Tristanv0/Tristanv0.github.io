import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARCADE_MAZE, INTRO_ROUTE, CHASE_ROUTE, CHASE_LEAD, GHOST_GAPS, INTRO_DISTANCE, INTRO_PELLET_DISTANCES, isMazeCorridor, routeLength, sampleRoute, mazeWallPath } from './arcade-maze.ts';

test('classic maze preserves the playfield, four energizers, pen and side tunnels', () => {
  assert.equal(ARCADE_MAZE.length, 31);
  assert.ok(ARCADE_MAZE.every(row => row.length === 28));
  const tiles = [...ARCADE_MAZE.join('')];
  assert.equal(tiles.filter(tile => tile === '.').length, 240);
  assert.equal(tiles.filter(tile => tile === 'o').length, 4);
  assert.equal(ARCADE_MAZE[12].slice(13, 15), '--');
  assert.equal(isMazeCorridor(0, 14), true);
  assert.equal(isMazeCorridor(27, 14), true);
  assert.equal(isMazeCorridor(0, 13), false);
  assert.equal(isMazeCorridor(13, 14), false);
});

test('the finishing run and four pursuing ghosts stay in corridors and never collide', () => {
  assert.deepEqual(INTRO_ROUTE.at(-1), { x: 1, y: 1 });
  const start = sampleRoute(CHASE_ROUTE, CHASE_LEAD);
  assert.equal(start.x, INTRO_ROUTE[0].x); assert.equal(start.y, INTRO_ROUTE[0].y);
  for (const route of [INTRO_ROUTE, CHASE_ROUTE]) {
    for (let distance = 0; distance <= routeLength(route); distance += .05) {
      const point = sampleRoute(route, distance);
      assert.ok(isMazeCorridor(Math.round(point.x), Math.round(point.y)), `Actor entered a wall near ${point.x}, ${point.y}`);
    }
  }
  for (let distance = 0; distance <= INTRO_DISTANCE; distance += .05) {
    const player = sampleRoute(INTRO_ROUTE, distance);
    const ghosts = GHOST_GAPS.map(gap => sampleRoute(CHASE_ROUTE, CHASE_LEAD + distance - gap));
    const actors = [player, ...ghosts];
    actors.forEach((actor, index) => actors.slice(index + 1).forEach(other => {
      assert.ok(Math.hypot(actor.x - other.x, actor.y - other.y) > .9, 'Actors overlap during the final chase');
    }));
  }
});

test('remaining pellets fill consecutive original dot tiles and end in the upper-left corner', () => {
  assert.equal(INTRO_PELLET_DISTANCES.length, INTRO_DISTANCE);
  INTRO_PELLET_DISTANCES.forEach((distance, index) => assert.equal(distance, index + 1));
  for (const distance of INTRO_PELLET_DISTANCES) {
    const point = sampleRoute(INTRO_ROUTE, distance);
    assert.ok(Number.isInteger(point.x) && Number.isInteger(point.y));
    assert.equal(ARCADE_MAZE[point.y][point.x], '.');
  }
  assert.equal(INTRO_PELLET_DISTANCES.at(-1), INTRO_DISTANCE);
});

test('wall tracing produces closed, finite outlines rather than individual wall tiles', () => {
  const path = mazeWallPath();
  assert.ok(path.startsWith('M'));
  assert.ok(path.endsWith('Z'));
  assert.doesNotMatch(path, /NaN|Infinity|undefined/);
  assert.equal((path.match(/M/g) ?? []).length, (path.match(/Z/g) ?? []).length);
  assert.ok((path.match(/M/g) ?? []).length < 60);
});
