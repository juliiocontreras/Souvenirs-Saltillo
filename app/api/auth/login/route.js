import { NextResponse } from "next/server";
import {
  timingSafePasswordMatch,
  authConfigured,
  SESSION_COOKIE,
} from "../../../../packages/core/auth.mjs";
import {
  assertOrigin,
  jsonBody,
  newSession,
  cookieOptions,
  ApiError,
} from "../../../../lib/admin-auth.mjs";
import { catalogRepository } from "../../../../lib/catalog-store.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    assertOrigin(request);
    if (!authConfigured())
      throw new ApiError(
        "El administrador aún no ha configurado el acceso en el servidor.",
        503,
      );
    const { password } = await jsonBody(request);
    if (typeof password !== "string" || password.length > 1024)
      throw new ApiError("Contraseña inválida.");
    if (!(await catalogRepository.loginAttempt("admin-login")))
      throw new ApiError(
        "Demasiados intentos. Vuelve a intentarlo en 15 minutos.",
        429,
      );
    if (!timingSafePasswordMatch(password, process.env.ADMIN_PASSWORD))
      throw new ApiError("Contraseña incorrecta.", 401);
    const token = await newSession();
    await catalogRepository.mutate((state) => {
      delete state.attempts["admin-login"];
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, cookieOptions());
    return response;
  } catch (error) {
    return apiError(error);
  }
}
