import { NextResponse } from "next/server";
import { ApiError } from "./admin-auth.mjs";
export function apiError(error) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error?.code?.startsWith("SUPPLIER_"))
    return NextResponse.json(
      { error: error.message, status: error.code },
      { status: 422 },
    );
  console.error(
    "Catalog request failed:",
    error?.code || error?.name || "Error",
  );
  return NextResponse.json(
    {
      error:
        "No fue posible completar la operación. Revisa la configuración del servidor e inténtalo de nuevo.",
    },
    { status: 503 },
  );
}
