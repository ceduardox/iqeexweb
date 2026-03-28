const { promisify } = require("util");
const crypto = require("crypto");

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string" || !storedHash.includes(":")) {
    return false;
  }

  const [salt, hashHex] = storedHash.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const key = await scryptAsync(password, salt, KEY_LENGTH);

  if (expected.length !== key.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, key);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
