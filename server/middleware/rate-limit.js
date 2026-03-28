function nowMs() {
  return Date.now();
}

function safePositiveNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }

  return Math.round(num);
}

function normalizeIp(ip) {
  return String(ip || "").trim() || "unknown-ip";
}

function createRateLimiter(options = {}) {
  const windowMs = safePositiveNumber(options.windowMs, 60000);
  const maxRequests = safePositiveNumber(options.max, 100);
  const message = String(options.message || "Too many requests, try again later");
  const keyFn =
    typeof options.keyFn === "function"
      ? options.keyFn
      : (req) => normalizeIp(req.ip || req.headers["x-forwarded-for"]);

  const state = new Map();

  function cleanup(currentTime) {
    for (const [key, entry] of state.entries()) {
      if (currentTime - entry.windowStart >= windowMs) {
        state.delete(key);
      }
    }
  }

  return function rateLimitMiddleware(req, res, next) {
    const currentTime = nowMs();
    if (state.size > 5000) {
      cleanup(currentTime);
    }

    const keyValue = String(keyFn(req) || "unknown-key");
    const existing = state.get(keyValue);

    if (!existing || currentTime - existing.windowStart >= windowMs) {
      state.set(keyValue, { windowStart: currentTime, count: 1 });
      return next();
    }

    existing.count += 1;
    if (existing.count <= maxRequests) {
      return next();
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (currentTime - existing.windowStart)) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      status: "error",
      message,
    });
  };
}

module.exports = {
  createRateLimiter,
};
