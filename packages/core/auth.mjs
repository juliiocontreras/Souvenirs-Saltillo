import crypto from "node:crypto";
export const SESSION_COOKIE = "ss_admin";
export const SESSION_MS = 8 * 60 * 60 * 1000;
const digest = (text) =>
  crypto.createHash("sha256").update(String(text)).digest();
export const sessionHash = (token) => digest(token).toString("hex");
export function timingSafePasswordMatch(input, expected) {
  return crypto.timingSafeEqual(digest(input), digest(expected));
}
export function authConfigured(env = process.env) {
  return (
    typeof env.ADMIN_PASSWORD === "string" &&
    env.ADMIN_PASSWORD.length >= 12 &&
    typeof env.AUTH_SECRET === "string" &&
    env.AUTH_SECRET.length >= 32
  );
}
export function sessionToken(secret, expiresAt = Date.now() + SESSION_MS) {
  if (!secret || secret.length < 32)
    throw new Error("Authentication secret is not configured");
  const body = crypto.randomBytes(32).toString("hex") + "." + expiresAt;
  return (
    body + "." + crypto.createHmac("sha256", secret).update(body).digest("hex")
  );
}
export function validSessionToken(token, secret, now = Date.now()) {
  if (
    !secret ||
    secret.length < 32 ||
    typeof token !== "string" ||
    token.length > 200
  )
    return false;
  const [nonce, expires, signature, extra] = token.split(".");
  if (
    extra ||
    !/^[a-f0-9]{64}$/.test(nonce || "") ||
    !/^\d{13}$/.test(expires || "") ||
    Number(expires) <= now ||
    !/^[a-f0-9]{64}$/.test(signature || "")
  )
    return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(nonce + "." + expires)
    .digest("hex");
  return timingSafePasswordMatch(signature, expected);
}
export function credentialVersion(env = process.env) {
  return sessionHash(env.AUTH_SECRET + "|" + env.ADMIN_PASSWORD);
}
