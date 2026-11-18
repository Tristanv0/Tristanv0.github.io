import { COURT, advanceShuttle, clamp, hasWon, landingWinner, launchPlayerShot, launchShot, segmentDistance, servicePosition, type Point, type Shuttle, type Side } from './badminton-physics';
import { advanceNpc, launchNpcReturn, planNpcResponse, type NpcResponse } from './badminton-opponent';

const WIDTH = 640, HEIGHT = 600;
const COURT_SCALE = 1.089;
type Phase = 'idle' | 'countdown' | 'rally' | 'between' | 'serve' | 'paused' | 'finished';
const GREEN = '#058e47', INK = '#395044', PAPER = '#faf8f3';
const scaleCourtPoint = (x: number, y: number) => ({ x: 320 + (x - 320) * COURT_SCALE, y: 300 + (y - 300) * COURT_SCALE });
const project = (x: number, y: number, z = 0) => scaleCourtPoint(320 + x * (52 + y * 1.5), 74 + y * 30 - z * 28);
const floorPoint = (point: Point) => {
  const y = ((point.y - 300) / COURT_SCALE + 300 - 74) / 30;
  return { x: (point.x - 320) / COURT_SCALE / (52 + y * 1.5), y };
};

export function initBadmintonGame() {
  const root = document.querySelector<HTMLElement>('[data-badminton-game]');
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const canvas = root.querySelector<HTMLCanvasElement>('[data-game-canvas]')!;
  const home = root.closest<HTMLElement>('#home') ?? root;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const overlay = root.querySelector<HTMLElement>('[data-game-overlay]')!;
  const message = root.querySelector<HTMLElement>('[data-game-message]')!;
  const overline = root.querySelector<HTMLElement>('[data-game-overline]')!;
  const status = root.querySelector<HTMLElement>('[data-game-status]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-game-play]')!;
  const stop = root.querySelector<HTMLButtonElement>('[data-game-stop]')!;
  const playerScore = root.querySelector<HTMLElement>('[data-player-score]')!;
  const npcScore = root.querySelector<HTMLElement>('[data-npc-score]')!;
  const leaveCountdown = root.querySelector<HTMLElement>('[data-game-leave-countdown]')!;
  const leaveSeconds = root.querySelector<HTMLElement>('[data-game-leave-seconds]')!;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const { signal } = abort;
  let phase: Phase = 'idle', savedPhase: Phase = 'serve';
  let scores = { player: 0, npc: 0 }, server: Side = 'npc';
  let shuttle: Shuttle | null = null;
  let npc = { x: -1.3, y: 3.2 };
  let npcResponse: NpcResponse = { target: { ...npc }, reaction: 0, speed: 3 };
  let racket: Point = project(1.3, 11, 1);
  let previousRacket = { ...racket }, swingVelocity: Point = { x: 0, y: 0 };
  let pointerTime = 0, pointerInside = false, keyboard = false;
  let countdown = 3, timer = 0, lastTime = 0, accumulator = 0, frame = 0;
  let enabled = true, serveReady = 0, rallyHits = 0, hitFlash = 0;
  let trail: Point[] = [], keys = new Set<string>();
  let mousePointer = false;
  let leaveTimer = 0, leaveDeadline = 0;

  function cancelLeaveCountdown() {
    window.clearTimeout(leaveTimer); leaveTimer = 0; leaveDeadline = 0;
    leaveCountdown.hidden = true;
  }

  function startLeaveCountdown() {
    if (!mousePointer || keyboard || pointerInside || leaveTimer || phase === 'idle' || phase === 'paused' || phase === 'finished') return;
    leaveDeadline = performance.now() + 2000;
    leaveCountdown.hidden = false;
    function update() {
      leaveTimer = 0;
      if (pointerInside || keyboard || phase === 'idle' || phase === 'paused' || phase === 'finished') { cancelLeaveCountdown(); return; }
      const remaining = leaveDeadline - performance.now();
      if (remaining <= 0) { pause(); return; }
      const seconds = String(Math.ceil(remaining / 1000));
      if (leaveSeconds.textContent !== seconds) leaveSeconds.textContent = seconds;
      leaveTimer = window.setTimeout(update, Math.min(100, remaining));
    }
    update();
  }

  function setStatus(text: string) { if (status.textContent !== text) status.textContent = text; }
  function show(text: string, eyebrow = '', button = false) {
    overlay.hidden = false;
    message.textContent = text;
    overline.textContent = eyebrow;
    overline.hidden = !eyebrow;
    play.hidden = !button;
    play.textContent = phase === 'finished' ? 'Play again' : phase === 'paused' ? 'Resume rally' : 'Play badminton';
  }
  function activeCursor(active: boolean) { canvas.dataset.playing = String(active); stop.hidden = !active; }

  function prepareServe() {
    shuttle = null; trail = []; rallyHits = 0; serveReady = 0;
    npc = servicePosition('npc', scores[server]);
    npcResponse = { target: { ...npc }, reaction: 0, speed: 3 };
    phase = 'serve'; timer = 0;
    overlay.hidden = true;
    const even = scores[server] % 2 === 0;
    setStatus(server === 'npc' ? `NPC serving · ${even ? 'right / even' : 'left / odd'} court`
      : `Your serve · move into the ${even ? 'right' : 'left'} service box.`);
  }

  function begin() {
    updateHomeVisibility();
    if (!enabled || document.hidden || document.querySelector('dialog[open]')) return;
    if (phase !== 'idle' && phase !== 'paused' && phase !== 'finished') return;
    cancelLeaveCountdown();
    if (phase !== 'paused') {
      scores = { player: 0, npc: 0 }; server = 'npc'; shuttle = null;
      playerScore.textContent = npcScore.textContent = '0';
      npc = servicePosition('npc', 0);
      npcResponse = { target: { ...npc }, reaction: 0, speed: 3 };
      savedPhase = 'serve';
    }
    phase = 'countdown'; timer = 0; countdown = 3;
    swingVelocity = { x: 0, y: 0 }; previousRacket = { ...racket };
    show('3', savedPhase === 'serve' ? server === 'npc' ? 'Ready? NPC serves.' : 'Ready? Your serve.' : 'Back in the rally');
    setStatus('Get your racket ready.');
    activeCursor(true);
    schedule();
  }

  function pause() {
    if (phase === 'idle' || phase === 'paused' || phase === 'finished') return;
    cancelLeaveCountdown();
    savedPhase = phase === 'countdown' ? savedPhase : phase;
    phase = 'paused'; keys.clear();
    window.cancelAnimationFrame(frame); frame = 0;
    swingVelocity = { x: 0, y: 0 };
    show('Taking a breather', 'Your score is saved', true);
    setStatus('');
    activeCursor(false);
    draw();
  }

  function updateHomeVisibility() {
    const bounds = home.getBoundingClientRect();
    const headerBottom = document.querySelector('body > header')?.getBoundingClientRect().bottom ?? 0;
    enabled = bounds.bottom > headerBottom + 1 && bounds.top < window.innerHeight;
    if (!enabled) pause();
  }

  function point(winner: Side, reason: string) {
    scores[winner]++;
    playerScore.textContent = String(scores.player); npcScore.textContent = String(scores.npc);
    server = winner; timer = 0; trail = [];
    if (hasWon(scores[winner], scores[winner === 'player' ? 'npc' : 'player'])) {
      cancelLeaveCountdown();
      phase = 'finished';
      show(winner === 'player' ? 'Nicely played!' : 'Good game!', `${scores.player} : ${scores.npc}`, true);
      setStatus(winner === 'player' ? 'You win. Up for a rematch?' : 'NPC wins. One more?');
      canvas.dataset.playing = 'false';
    } else {
      phase = 'between';
      show(winner === 'player' ? 'Your point!' : 'NPC scores', reason);
      setStatus(`${scores.player} : ${scores.npc} · ${winner === 'player' ? 'You serve next.' : 'NPC serves next.'}`);
    }
  }

  function serve() {
    const from = servicePosition(server, scores[server]);
    const receiving = servicePosition(server === 'player' ? 'npc' : 'player', scores[server]);
    // Right/left are relative to each server, so these boxes are diagonal.
    shuttle = launchShot({ ...from, z: .95 }, { x: receiving.x, y: server === 'npc' ? 11.7 : 1.7 }, 10.8, server);
    phase = 'rally'; timer = 0;
    setStatus('Keep it in the lines.');
    if (server === 'player') predictNpc();
  }

  function predictNpc() {
    if (!shuttle) return;
    npcResponse = planNpcResponse(shuttle);
  }

  function tick(dt: number) {
    timer += dt; hitFlash = Math.max(0, hitFlash - dt);
    if (phase === 'countdown') {
      const remaining = Math.max(1, 3 - Math.floor(timer));
      if (remaining !== countdown) { countdown = remaining; show(String(countdown), 'Get ready'); }
      if (timer >= 3) {
        overlay.hidden = true;
        if (savedPhase === 'serve') { prepareServe(); if (server === 'npc') serve(); }
        else { phase = savedPhase; timer = 0; setStatus('Back to it.'); }
      }
      return;
    }
    if (phase === 'between') { if (timer >= 1.4) prepareServe(); return; }
    if (phase === 'serve') {
      if (server === 'npc') { if (timer >= .8) serve(); }
      else {
        const position = floorPoint(racket), box = servicePosition('player', scores.player);
        const inBox = position.x * box.x > 0 && Math.abs(position.x) < COURT.singlesHalfWidth
          && position.y >= COURT.netY + COURT.serviceOffset && position.y <= COURT.length;
        serveReady = inBox ? serveReady + dt : 0;
        if (serveReady >= .55) serve();
      }
      return;
    }
    if (phase !== 'rally' || !shuttle) return;
    const oldX = shuttle.x, oldY = shuttle.y, oldZ = shuttle.z;
    advanceShuttle(shuttle, dt);
    if ((oldY - COURT.netY) * (shuttle.y - COURT.netY) <= 0 && oldY !== shuttle.y) {
      const netZ = oldZ + (shuttle.z - oldZ) * (COURT.netY - oldY) / (shuttle.y - oldY);
      const netX = oldX + (shuttle.x - oldX) * (COURT.netY - oldY) / (shuttle.y - oldY);
      if (Math.abs(netX) <= COURT.halfWidth + .2 && netZ < COURT.netHeight) { point(shuttle.hitter === 'player' ? 'npc' : 'player', 'Caught the net'); return; }
    }
    if (shuttle.z <= 0) {
      shuttle.z = 0;
      const out = Math.abs(shuttle.x) > COURT.singlesHalfWidth || shuttle.y < 0 || shuttle.y > COURT.length;
      point(landingWinner(shuttle), out ? 'Just outside the lines' : 'Shuttle down'); return;
    }
    advanceNpc(npc, npcResponse, dt);

    const screen = project(shuttle.x, shuttle.y, shuttle.z);
    // Swept racket contact avoids missing fast mouse movements between frames.
    if (shuttle.hitter === 'npc' && shuttle.y > COURT.netY + .12
      && segmentDistance(screen, previousRacket, racket) < 27) {
      const swing = performance.now() - pointerTime < 140 ? swingVelocity : { x: 0, y: 0 };
      shuttle = launchPlayerShot(shuttle, swing);
      const power = Math.hypot(shuttle.vx, shuttle.vy);
      hitFlash = .2; rallyHits++; trail = []; predictNpc();
      setStatus(`${rallyHits} ${rallyHits === 1 ? 'return' : 'returns'} · ${power > 13 ? 'Quick swing!' : 'Nice return.'}`);
    } else if (shuttle.hitter === 'player' && shuttle.y < COURT.netY - .3
      && npcResponse.reaction <= 0 && shuttle.vz < 0 && shuttle.z < 2.25
      && Math.hypot(shuttle.x - npc.x, shuttle.y - npc.y) < .5) {
      shuttle = launchNpcReturn(shuttle);
      npcResponse = { target: { x: 0, y: 3.3 }, reaction: 0, speed: 2.7 }; hitFlash = .15; trail = [];
    }
    // An escaped shot still ends, even if it has flown beyond the canvas.
    if (timer > 30 || shuttle.z > 20) point(shuttle.hitter === 'player' ? 'npc' : 'player', 'Out');
  }

  function line(a: Point, b: Point, color: string, width = 1) {
    ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(b.x, b.y); ctx!.strokeStyle = color; ctx!.lineWidth = width; ctx!.stroke();
  }
  // Cache the static court. Only the rackets, shuttle and service marker move.
  const court = document.createElement('canvas'); court.width = WIDTH * 2; court.height = HEIGHT * 2;
  const courtCtx = court.getContext('2d')!;
  function drawCourt() {
    courtCtx.scale(2, 2);
    const corners = [project(-3.05, 0), project(3.05, 0), project(3.05, 13.4), project(-3.05, 13.4)];
    courtCtx.beginPath(); corners.forEach((p, i) => i ? courtCtx.lineTo(p.x, p.y) : courtCtx.moveTo(p.x, p.y));
    courtCtx.closePath(); courtCtx.fillStyle = '#05a74f06'; courtCtx.fill();
    courtCtx.lineWidth = 1.4; courtCtx.strokeStyle = '#058e4766';
    const path = (x1: number, y1: number, x2: number, y2: number) => {
      const a = project(x1, y1), b = project(x2, y2);
      courtCtx.beginPath(); courtCtx.moveTo(a.x, a.y); courtCtx.lineTo(b.x, b.y); courtCtx.stroke();
    };
    [-3.05, -2.59, 2.59, 3.05].forEach(x => path(x, 0, x, 13.4));
    [0, .76, 4.72, 8.68, 12.64, 13.4].forEach(y => path(-3.05, y, 3.05, y));
    path(0, 0, 0, 4.72); path(0, 8.68, 0, 13.4);
    courtCtx.font = '11px monospace'; courtCtx.textAlign = 'center'; courtCtx.fillStyle = '#73716899';
    const npcLabel = scaleCourtPoint(320, 46), playerLabel = scaleCourtPoint(320, 535);
    courtCtx.fillText('NPC', npcLabel.x, Math.max(20, npcLabel.y));
    courtCtx.fillText('YOU', playerLabel.x, Math.min(HEIGHT - 40, playerLabel.y));
  }

  function drawRacket(p: Point, color: string, angle: number, flash = false) {
    ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(angle);
    if (flash && !reducedMotion.matches) {
      ctx!.beginPath(); ctx!.arc(0, 0, 29 + (1 - hitFlash / .2) * 12, 0, Math.PI * 2);
      ctx!.strokeStyle = '#05a74f44'; ctx!.lineWidth = 1; ctx!.stroke();
    }
    line({ x: 0, y: 21 }, { x: 0, y: 48 }, color, 2.4);
    line({ x: 0, y: 43 }, { x: 0, y: 54 }, color, 5);
    ctx!.beginPath(); ctx!.ellipse(0, 0, 16, 22, 0, 0, Math.PI * 2);
    ctx!.fillStyle = '#faf8f3e8'; ctx!.fill(); ctx!.strokeStyle = color; ctx!.lineWidth = 2.4; ctx!.stroke();
    ctx!.save(); ctx!.clip();
    for (let n = -18; n <= 18; n += 6) {
      line({ x: n, y: -24 }, { x: n, y: 24 }, `${color}45`, .7);
      line({ x: -20, y: n }, { x: 20, y: n }, `${color}45`, .7);
    }
    ctx!.restore(); ctx!.restore();
  }

  function drawNet() {
    const left = project(-3.25, 6.7), right = project(3.25, 6.7);
    const top = project(-3.25, 6.7, COURT.netHeight);
    for (let i = 0; i <= 30; i++) {
      const x = left.x + (right.x - left.x) * i / 30;
      line({ x, y: top.y }, { x, y: left.y - 3 }, '#24533e24', .65);
    }
    for (let i = 0; i < 5; i++) line({ x: left.x, y: top.y + i * 8 }, { x: right.x, y: top.y + i * 8 }, '#24533e24', .65);
    line(top, { x: right.x, y: top.y }, '#517563', 2);
    [left.x, right.x].forEach(x => {
      line({ x, y: top.y - 5 }, { x, y: left.y + 3 }, GREEN, 2.6);
      line({ x: x - 5, y: left.y + 4 }, { x: x + 5, y: left.y + 4 }, GREEN, 2);
    });
  }

  function draw() {
    ctx!.clearRect(0, 0, WIDTH, HEIGHT);
    ctx!.drawImage(court, 0, 0, WIDTH, HEIGHT);
    if (phase === 'serve' && server === 'player') {
      const box = servicePosition('player', scores.player);
      const marker = project(box.x, box.y);
      ctx!.beginPath(); ctx!.ellipse(marker.x, marker.y, 35, 18, 0, 0, Math.PI * 2);
      ctx!.fillStyle = '#05a74f16'; ctx!.fill(); ctx!.strokeStyle = '#058e4788'; ctx!.setLineDash([3, 5]); ctx!.stroke(); ctx!.setLineDash([]);
    }
    drawRacket(project(npc.x, npc.y, 1.4), INK, Math.PI + .35, hitFlash > 0 && shuttle?.hitter === 'npc');
    drawNet();
    drawRacket(racket, GREEN, -.35, hitFlash > 0 && shuttle?.hitter === 'player');
    if (!shuttle) return;
    const p = project(shuttle.x, shuttle.y, shuttle.z), shadow = project(shuttle.x, shuttle.y);
    ctx!.beginPath(); ctx!.ellipse(shadow.x, shadow.y, 5 + shuttle.z, 2.5, 0, 0, Math.PI * 2);
    ctx!.fillStyle = '#24533e23'; ctx!.fill();
    if (!reducedMotion.matches && phase === 'rally') {
      trail.forEach((dot, i) => {
        ctx!.beginPath(); ctx!.arc(dot.x, dot.y, 1.5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(5, 142, 71, ${i / trail.length * .25})`; ctx!.fill();
      });
    }
    const next = project(shuttle.x + shuttle.vx * .02, shuttle.y + shuttle.vy * .02, shuttle.z + shuttle.vz * .02);
    ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(Math.atan2(next.y - p.y, next.x - p.x) - Math.PI / 2);
    ctx!.beginPath(); ctx!.moveTo(-3, 0); ctx!.lineTo(-8, -15); ctx!.quadraticCurveTo(0, -19, 8, -15); ctx!.lineTo(3, 0); ctx!.closePath();
    ctx!.fillStyle = PAPER; ctx!.fill(); ctx!.strokeStyle = '#688271'; ctx!.lineWidth = 1; ctx!.stroke();
    [-4, 0, 4].forEach(x => line({ x: 0, y: 0 }, { x, y: -15 }, '#68827177', .7));
    ctx!.beginPath(); ctx!.arc(0, 1, 3.5, 0, Math.PI * 2); ctx!.fillStyle = GREEN; ctx!.fill(); ctx!.restore();
  }

  function schedule() {
    if (!frame) { lastTime = performance.now(); accumulator = 0; frame = requestAnimationFrame(render); }
  }
  function render(time: number) {
    frame = 0;
    // Suspend simulation in a hidden tab or behind a dialog without changing
    // the game state, and never accumulate a large catch-up step on return.
    if (document.hidden || document.querySelector('dialog[open]')) {
      lastTime = time; frame = requestAnimationFrame(render); return;
    }
    const dt = Math.min((time - lastTime) / 1000, .05); lastTime = time;
    if (keyboard) {
      const dx = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
      const dy = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
      if (dx || dy) {
        racket.x = clamp(racket.x + dx * dt * 500, 75, 565);
        racket.y = clamp(racket.y + dy * dt * 500, 230, 485);
        swingVelocity = { x: dx * 500, y: dy * 500 };
        pointerTime = time;
      }
    }
    accumulator += dt;
    const steps = Math.floor(accumulator * 120);
    const start = { ...previousRacket }, end = { ...racket };
    for (let i = 0; i < steps; i++) {
      previousRacket = { x: start.x + (end.x - start.x) * i / steps, y: start.y + (end.y - start.y) * i / steps };
      racket = { x: start.x + (end.x - start.x) * (i + 1) / steps, y: start.y + (end.y - start.y) * (i + 1) / steps };
      tick(1 / 120); accumulator -= 1 / 120;
    }
    racket = end; previousRacket = { ...racket };
    if (shuttle && phase === 'rally') { trail.push(project(shuttle.x, shuttle.y, shuttle.z)); if (trail.length > 9) trail.shift(); }
    draw();
    if (phase !== 'idle' && phase !== 'paused' && phase !== 'finished') frame = requestAnimationFrame(render);
  }

  function move(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const next = { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT };
    const now = performance.now(), elapsed = (now - pointerTime) / 1000;
    if (elapsed > 0 && elapsed < .15) {
      const vx = (next.x - racket.x) / Math.max(.004, elapsed), vy = (next.y - racket.y) / Math.max(.004, elapsed);
      const scale = Math.min(1, 2500 / (Math.hypot(vx, vy) || 1));
      swingVelocity = { x: vx * scale, y: vy * scale };
    } else { swingVelocity = { x: 0, y: 0 }; }
    racket = next; pointerTime = now; keyboard = false;
    if (phase === 'idle' || phase === 'paused') { previousRacket = { ...racket }; draw(); }
  }
  canvas.addEventListener('pointerenter', event => {
    cancelLeaveCountdown();
    mousePointer = event.pointerType === 'mouse' || event.pointerType === 'pen';
    pointerInside = true; move(event);
    previousRacket = { ...racket }; swingVelocity = { x: 0, y: 0 };
  }, { signal });
  canvas.addEventListener('pointermove', move, { signal });
  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    startLeaveCountdown();
  }, { signal });
  canvas.addEventListener('pointerdown', event => {
    cancelLeaveCountdown();
    event.preventDefault();
    if (document.activeElement === canvas) canvas.blur();
    move(event); pointerInside = true;
    if (event.pointerType === 'touch') { canvas.setPointerCapture(event.pointerId); mousePointer = false; }
  }, { signal });
  canvas.addEventListener('pointercancel', () => { pointerInside = false; }, { signal });
  canvas.addEventListener('pointerup', event => { if (event.pointerType === 'touch') pointerInside = false; }, { signal });
  play.addEventListener('click', event => {
    keyboard = event.detail === 0; pointerInside = false;
    racket = project(1.3, 11, 1); previousRacket = { ...racket };
    if (keyboard) canvas.focus({ preventScroll: true });
    begin();
  }, { signal });
  stop.addEventListener('click', pause, { signal });
  canvas.addEventListener('keydown', event => {
    if (phase === 'idle' || phase === 'paused' || phase === 'finished') return;
    if (event.key.startsWith('Arrow')) {
      cancelLeaveCountdown();
      event.preventDefault(); keyboard = true; keys.add(event.key);
    }
  }, { signal });
  window.addEventListener('keyup', event => keys.delete(event.key), { signal });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && phase !== 'idle' && phase !== 'paused' && phase !== 'finished'
      && !document.querySelector('dialog[open]')) { event.preventDefault(); pause(); }
  }, { signal });
  canvas.addEventListener('blur', () => { keys.clear(); keyboard = false; }, { signal });
  window.addEventListener('blur', () => keys.clear(), { signal });
  window.addEventListener('scroll', updateHomeVisibility, { passive: true, signal });
  function resize() {
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * density; canvas.height = HEIGHT * density;
    ctx!.setTransform(density, 0, 0, density, 0, 0); updateHomeVisibility(); draw();
  }
  drawCourt(); resize();
  window.addEventListener('resize', resize, { passive: true, signal });
  document.addEventListener('astro:before-swap', () => {
    cancelLeaveCountdown(); window.cancelAnimationFrame(frame); abort.abort();
  }, { once: true });
}
