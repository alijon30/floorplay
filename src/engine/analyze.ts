// src/engine/analyze.ts
import type { Analysis, Room } from './types';
import { computeDaylight } from './daylight';
import { computeMetrics } from './metrics';
import { reachability } from './reach';
import { validateRoom } from './validate';

export { metricsDelta } from './metrics';

export function analyze(room: Room): Analysis {
  const reach = reachability(room);
  const violations = validateRoom(room, reach);
  const daylight = computeDaylight(room, room.daylightHour);
  const metrics = computeMetrics(room, violations, daylight, reach);
  return { violations, metrics, daylight };
}
