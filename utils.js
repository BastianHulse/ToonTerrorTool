export function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function randomInt(min, max) {
  const lo = Number(min);
  const hi = Number(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

export function rollPercent() {
  return randomInt(1, 100);
}

export function pickRandom(items = [], count = 1, predicate = () => true) {
  const pool = items.filter(predicate);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function byKey(list, key) {
  return Object.fromEntries(list.map((item) => [item[key], item]));
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}

export function titleCase(value = '') {
  return String(value)
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
