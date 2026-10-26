// Only public arena summaries belong here; account and bot source requests never do.
const cache = new Map();
const pending = new Map();
const TTL_MS = 10_000;
let generation = 0;

export function peekPublicData(path) {
  return cache.get(path)?.data;
}

export function invalidatePublicData() {
  generation += 1;
  cache.clear();
  pending.clear();
}

export function getPublicData(path, { force = false, timeoutMs = 12000 } = {}) {
  const entry = cache.get(path);
  if (!force && entry && Date.now() - entry.updatedAt < TTL_MS) {
    return Promise.resolve(entry.data);
  }
  if (pending.has(path)) return pending.get(path);

  const requestGeneration = generation;
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Máy chủ phản hồi chậm. Vui lòng thử lại.'));
    }, timeoutMs);
  });
  const request = Promise.race([(async () => {
    const response = await fetch(path, { signal: controller.signal });
    const result = await response.json();
    if (!response.ok || result.success === false) {
      throw new Error(result.message || 'Không tải được dữ liệu. Vui lòng thử lại.');
    }
    const data = result.data || [];
    if (!controller.signal.aborted && generation === requestGeneration) {
      cache.set(path, { data, updatedAt: Date.now() });
      // Keep the cache bounded if additional public screens use this helper later.
      if (cache.size > 20) cache.delete(cache.keys().next().value);
    }
    return data;
  })(), timeout]).finally(() => {
    clearTimeout(timer);
    if (pending.get(path) === request) pending.delete(path);
  });
  pending.set(path, request);
  return request;
}
