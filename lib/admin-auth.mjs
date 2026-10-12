import { randomBytes } from "node:crypto";
import {
  authConfigured,
  validSessionToken,
  sessionHash,
  credentialVersion,
  SESSION_COOKIE,
  SESSION_MS,
  sessionToken,
} from "../packages/core/auth.mjs";
import { catalogRepository } from "./catalog-store.mjs";

export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export async function requestSession(request) {
  if (!authConfigured()) return null;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!validSessionToken(token, process.env.AUTH_SECRET)) return null;
  const session = await catalogRepository.getSession(sessionHash(token));
  if (
    !session ||
    session.expiresAt <= Date.now() ||
    session.credentialVersion !== credentialVersion()
  )
    return null;
  return { ...session, hash: sessionHash(token) };
}
export async function tokenSession(token) {
  return requestSession({ cookies: { get: () => ({ value: token }) } });
}
export async function requireAdmin(request, { write = false } = {}) {
  if (!authConfigured())
    throw new ApiError(
      "El acceso administrativo aún no está configurado en el servidor.",
      503,
    );
  const session = await requestSession(request);
  if (!session) throw new ApiError("Inicia sesión para acceder al panel.", 401);
  if (write) assertOrigin(request);
  return session;
}
export function assertOrigin(request) {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== expected)
    throw new ApiError("La solicitud no proviene del panel autorizado.", 403);
}
export async function newSession() {
  const expiresAt = Date.now() + SESSION_MS;
  const token = sessionToken(process.env.AUTH_SECRET, expiresAt);
  await catalogRepository.saveSession(sessionHash(token), {
    expiresAt,
    credentialVersion: credentialVersion(),
    createdAt: new Date().toISOString(),
  });
  return token;
}
export function loginNonce() {
  return randomBytes(24).toString("hex");
}
export async function jsonBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Faltan datos.");
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 100000) {
        await reader.cancel();
        throw new ApiError("La solicitud es demasiado grande.", 413);
      }
      chunks.push(Buffer.from(value));
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!result || Array.isArray(result) || typeof result !== "object")
      throw new Error();
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Datos inválidos.");
  }
}
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MS / 1000,
  };
}
