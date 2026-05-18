// Per-IP daily rate limiter (in-memory, resets at midnight UTC)

interface RateLimitEntry {
  count: number;
  day: number; // UTC day of year
}

const store = new Map<string, RateLimitEntry>();

function getDay(): number {
  const now = new Date();
  const start = new Date(now.getUTCFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

export function checkRateLimit(ip: string, route: string, limit: number): { allowed: boolean; remaining: number } {
  const key = `${ip}:${route}`;
  const today = getDay();
  const entry = store.get(key);

  if (!entry || entry.day !== today) {
    store.set(key, { count: 1, day: today });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

export function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
