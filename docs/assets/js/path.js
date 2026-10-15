// Wegsuche für den Rundgang: A* auf einem 0,2-m-Raster (Hindernisse um den Körperradius vergrößert), danach
// Sichtlinien-Glättung. Koordinaten wie im Layouter (Meter, Stand von 0..W × 0..D, Gänge außerhalb).
export function makeGrid(bounds, rects, radius = .45, cell = .2) {
  const nx = Math.ceil((bounds.x1 - bounds.x0) / cell), nz = Math.ceil((bounds.z1 - bounds.z0) / cell);
  const blocked = new Uint8Array(nx * nz);
  for (const r of rects) {
    const i0 = Math.max(0, Math.floor((r.x0 - radius - bounds.x0) / cell)), i1 = Math.min(nx - 1, Math.floor((r.x1 + radius - bounds.x0) / cell));
    const j0 = Math.max(0, Math.floor((r.z0 - radius - bounds.z0) / cell)), j1 = Math.min(nz - 1, Math.floor((r.z1 + radius - bounds.z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * nx + i] = 1;
  }
  return { bounds, cell, nx, nz, blocked };
}

const cellOf = (g, x, z) => [Math.min(g.nx - 1, Math.max(0, Math.floor((x - g.bounds.x0) / g.cell))), Math.min(g.nz - 1, Math.max(0, Math.floor((z - g.bounds.z0) / g.cell)))];
const center = (g, i, j) => [g.bounds.x0 + (i + .5) * g.cell, g.bounds.z0 + (j + .5) * g.cell];

// nächste freie Zelle (Breitensuche), falls Start/Ziel auf einem Hindernis liegt
function nearestFree(g, i, j) {
  if (!g.blocked[j * g.nx + i]) return [i, j];
  const seen = new Set([j * g.nx + i]); const q = [[i, j]];
  for (let h = 0; h < q.length && h < 20000; h++) {
    const [a, b] = q[h];
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = a + da, y = b + db; if (x < 0 || y < 0 || x >= g.nx || y >= g.nz) continue;
      const k = y * g.nx + x; if (seen.has(k)) continue; seen.add(k);
      if (!g.blocked[k]) return [x, y];
      q.push([x, y]);
    }
  }
  return [i, j];
}

// Zielpunkt fürs Hintippen: liegt er frei, genau dort, sonst Mitte der nächsten freien Zelle
export function freePoint(g, x, z) {
  const [i, j] = cellOf(g, x, z), [fi, fj] = nearestFree(g, i, j), b = g.bounds;
  if (fi === i && fj === j && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return [x, z];
  return center(g, fi, fj);
}

function lineFree(g, a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / (g.cell * .5));
  for (let s = 0; s <= n; s++) {
    const t = n ? s / n : 0; const [i, j] = cellOf(g, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    if (g.blocked[j * g.nx + i]) return false;
  }
  return true;
}

export function findPath(g, from, to) {
  let [si, sj] = nearestFree(g, ...cellOf(g, from[0], from[1]));
  let [ti, tj] = nearestFree(g, ...cellOf(g, to[0], to[1]));
  const N = g.nx * g.nz, start = sj * g.nx + si, goal = tj * g.nx + ti;
  const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  // binärer Heap
  const heap = [], hf = [];
  const push = (k, f) => { heap.push(k); hf.push(f); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; } };
  const pop = () => { const k = heap[0]; const lk = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lk; hf[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m; } } return k; };
  const h = (k) => { const i = k % g.nx, j = (k / g.nx) | 0; return Math.hypot(i - ti, j - tj); };
  gs[start] = 0; push(start, h(start));
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = false;
  while (heap.length) {
    const k = pop(); if (closed[k]) continue; closed[k] = 1;
    if (k === goal) { found = true; break; }
    const i = k % g.nx, j = (k / g.nx) | 0;
    for (const [di, dj, c] of nb) {
      const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= g.nx || y >= g.nz) continue;
      const n = y * g.nx + x; if (g.blocked[n] || closed[n]) continue;
      if (di && dj && (g.blocked[j * g.nx + x] || g.blocked[y * g.nx + i])) continue;   // nicht über Ecken schneiden
      const ng = gs[k] + c; if (ng < gs[n]) { gs[n] = ng; came[n] = k; push(n, ng + h(n)); }
    }
  }
  if (!found) return [from, to];
  const cells = []; for (let k = goal; k !== -1; k = came[k]) cells.push(k);
  cells.reverse();
  const pts = cells.map(k => center(g, k % g.nx, (k / g.nx) | 0));
  pts[0] = from; pts[pts.length - 1] = to;
  // Glätten: so weit wie möglich geradeaus
  const out = [pts[0]]; let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !lineFree(g, pts[a], pts[b])) b--;
    out.push(pts[b]); a = b;
  }
  return out;
}
