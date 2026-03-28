const crypto = require("crypto");
const { AUTH_SECRET, AUTH_TOKEN_TTL_SECONDS } = require("../config/env");

function encodeBase64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64Url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payloadPart) {
  return crypto.createHmac("sha256", AUTH_SECRET).update(payloadPart).digest("base64url");
}

function createAuthToken(user, ttlSeconds = AUTH_TOKEN_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.id),
    role: user.role,
    email: user.email,
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadPart = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(payloadPart);
  return `${payloadPart}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    throw new Error("Invalid token format");
  }

  const [payloadPart, receivedSignature] = token.split(".");
  if (!payloadPart || !receivedSignature) {
    throw new Error("Invalid token format");
  }

  const expectedSignature = sign(payloadPart);
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    throw new Error("Invalid token signature");
  }

  let payload;
  try {
    payload = JSON.parse(decodeBase64Url(payloadPart));
  } catch (_) {
    throw new Error("Invalid token payload");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    throw new Error("Token expired");
  }

  return payload;
}

module.exports = {
  createAuthToken,
  verifyAuthToken,
};
