// Classic 28 × 31 playfield. Tile centers drive both actors and the last dots.
export const ARCADE_MAZE = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
] as const;

export type MazePoint = { x: number; y: number };
export const INTRO_ROUTE: MazePoint[] = [[6, 8], [1, 8], [1, 5], [6, 5], [6, 1], [1, 1]].map(([x, y]) => ({ x, y }));
export const CHASE_ROUTE: MazePoint[] = [{ x: 12, y: 5 }, { x: 6, y: 5 }, ...INTRO_ROUTE];
export const CHASE_LEAD = 9;
export const GHOST_GAPS = [2, 3.5, 5, 6.5];
export const routeLength = (points: MazePoint[]) => points.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
export const INTRO_DISTANCE = routeLength(INTRO_ROUTE);
export const INTRO_PELLET_DISTANCES = Array.from({ length: INTRO_DISTANCE }, (_, index) => index + 1);
export const POINTS_PER_PELLET = 10;
export const INTRO_START_SCORE = 1000 - INTRO_PELLET_DISTANCES.length * POINTS_PER_PELLET;

export function sampleRoute(points: MazePoint[], distance: number) {
  let remaining = Math.max(0, distance);
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length || index === points.length - 1) {
      const part = Math.min(1, remaining / length);
      return { x: a.x + (b.x - a.x) * part, y: a.y + (b.y - a.y) * part, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    remaining -= length;
  }
  return { ...points[0], angle: 0 };
}

export function isMazeCorridor(x: number, y: number) {
  const tile = ARCADE_MAZE[y]?.[x];
  if (tile === '.' || tile === 'o') return true;
  if (tile !== ' ') return false;
  if (y === 14 && (x < 10 || x > 17)) return true;
  return x >= 6 && x <= 21 && y >= 9 && y <= 19 && !(x >= 10 && x <= 17 && y >= 12 && y <= 16);
}

// Trace only the outside edges of connected wall tiles, avoiding a tiled-grid
// appearance. Each contour becomes one rounded blue arcade-wall outline.
export function mazeWallPath() {
  type Edge = { from: MazePoint; to: MazePoint; used: boolean };
  const edges: Edge[] = [];
  const outgoing = new Map<string, Edge[]>();
  const key = (point: MazePoint) => `${point.x},${point.y}`;
  const wall = (x: number, y: number) => ARCADE_MAZE[y]?.[x] === '#';
  function add(x: number, y: number, endX: number, endY: number) {
    const edge = { from: { x, y }, to: { x: endX, y: endY }, used: false };
    edges.push(edge);
    const bucket = outgoing.get(key(edge.from)) ?? [];
    bucket.push(edge); outgoing.set(key(edge.from), bucket);
  }
  ARCADE_MAZE.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile !== '#') return;
    if (!wall(x, y - 1)) add(x, y, x + 1, y);
    if (!wall(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!wall(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!wall(x - 1, y)) add(x, y + 1, x, y);
  }));
  const paths: string[] = [];
  for (const first of edges) {
    if (first.used) continue;
    const points: MazePoint[] = [];
    let edge: Edge | undefined = first;
    while (edge && !edge.used) {
      edge.used = true;
      points.push(edge.from);
      if (key(edge.to) === key(first.from)) break;
      edge = outgoing.get(key(edge.to))?.find(candidate => !candidate.used);
    }
    const corners = points.filter((point, index) => {
      const previous = points[(index + points.length - 1) % points.length];
      const next = points[(index + 1) % points.length];
      return (point.x - previous.x) * (next.y - point.y) !== (point.y - previous.y) * (next.x - point.x);
    });
    if (corners.length < 3) continue;
    const toward = (from: MazePoint, to: MazePoint) => {
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      return `${(from.x + (to.x - from.x) * .18 / length).toFixed(2)} ${(from.y + (to.y - from.y) * .18 / length).toFixed(2)}`;
    };
    const commands = corners.map((corner, index) => {
      const previous = corners[(index + corners.length - 1) % corners.length];
      const next = corners[(index + 1) % corners.length];
      return `${index === 0 ? 'M' : 'L'}${toward(corner, previous)}Q${corner.x} ${corner.y} ${toward(corner, next)}`;
    });
    paths.push(commands.join('') + 'Z');
  }
  return paths.join('');
}
