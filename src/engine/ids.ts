let counter = 0;
export function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  counter += 1;
  return `${prefix}_${rand}${counter.toString(36)}`;
}
