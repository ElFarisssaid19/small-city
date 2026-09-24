import { CONFIG } from './config';
import { capacityOf } from './zones';
import type { SimState, Tile } from './types';

export interface JobReport {
  workforce: number;
  employed: number;
  commercialJobs: number;
  industrialJobs: number;
}

/** Jobs a tile offers: only developed commercial and industrial buildings employ people. */
export function jobCapacity(tile: Tile): number {
  if (tile.kind !== 'zone' || tile.stage !== 'developed' || tile.fire > 0) return 0;
  if (tile.zone !== 'commercial' && tile.zone !== 'industrial') return 0;
  return capacityOf(tile.zone, tile.level);
}

/** Residents of a tile who look for work. */
export function workforceOf(tile: Tile): number {
  return Math.floor(tile.residents * CONFIG.population.workforceRatio);
}

/**
 * Assigns job seekers to workplaces within `commuteRadius`, nearest first.
 * Workplaces are bucketed into a coarse grid so each home only looks at the
 * buckets its commute radius overlaps instead of scanning the whole map.
 * Recomputed from scratch each day, homes in index order, so it is deterministic.
 */
export function matchJobs(state: SimState): JobReport {
  const { width, height, tiles } = state;
  const { commuteRadius, bucketSize } = CONFIG.jobs;
  const cols = Math.ceil(width / bucketSize);
  const rows = Math.ceil(height / bucketSize);
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  const openJobs = new Int32Array(tiles.length);
  const report: JobReport = { workforce: 0, employed: 0, commercialJobs: 0, industrialJobs: 0 };

  tiles.forEach((tile, i) => {
    tile.workers = 0;
    tile.employed = 0;
    const jobs = jobCapacity(tile);
    if (jobs === 0) return;
    openJobs[i] = jobs;
    if (tile.zone === 'commercial') report.commercialJobs += jobs;
    else report.industrialJobs += jobs;
    const x = i % width;
    const y = (i - x) / width;
    buckets[Math.floor(y / bucketSize) * cols + Math.floor(x / bucketSize)].push(i);
  });

  const candidates: { index: number; distance: number }[] = [];
  tiles.forEach((home, h) => {
    const seekers = workforceOf(home);
    if (seekers === 0) return;
    report.workforce += seekers;

    const hx = h % width;
    const hy = (h - hx) / width;
    const bx0 = Math.max(0, Math.floor((hx - commuteRadius) / bucketSize));
    const bx1 = Math.min(cols - 1, Math.floor((hx + commuteRadius) / bucketSize));
    const by0 = Math.max(0, Math.floor((hy - commuteRadius) / bucketSize));
    const by1 = Math.min(rows - 1, Math.floor((hy + commuteRadius) / bucketSize));

    candidates.length = 0;
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        for (const j of buckets[by * cols + bx]) {
          if (openJobs[j] === 0) continue;
          const jx = j % width;
          const distance = Math.abs(jx - hx) + Math.abs((j - jx) / width - hy);
          if (distance <= commuteRadius) candidates.push({ index: j, distance });
        }
      }
    }
    candidates.sort((a, b) => a.distance - b.distance || a.index - b.index);

    let unemployed = seekers;
    for (const { index } of candidates) {
      if (unemployed === 0) break;
      const hired = Math.min(unemployed, openJobs[index]);
      openJobs[index] -= hired;
      tiles[index].workers += hired;
      unemployed -= hired;
    }
    home.employed = seekers - unemployed;
    report.employed += home.employed;
  });

  return report;
}
