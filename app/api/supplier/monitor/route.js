import { NextResponse } from "next/server";
import { timingSafePasswordMatch } from "../../../../packages/core/auth.mjs";
import {
  requireAdmin,
  jsonBody,
  ApiError,
} from "../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../lib/catalog-store.mjs";
import { runSupplierMonitor } from "../../../../lib/supplier-monitor.mjs";
import { webMonitorOptions, monitorRunSummary } from "../../../../packages/core/monitor.mjs";
export const maxDuration = 300;
export async function POST(request) {
  try {
    let force = false;
    if (request.headers.has("authorization")) {
      const secret = process.env.MONITOR_SECRET;
      if (!secret || secret.length < 32)
        throw new ApiError("Monitor no configurado.", 503);
      if (
        !timingSafePasswordMatch(
          request.headers.get("authorization"),
          `Bearer ${secret}`,
        )
      )
        throw new ApiError("Acceso al monitor no autorizado.", 401);
    } else {
      await requireAdmin(request, { write: true });
      const body = await jsonBody(request);
      force = body.force === true;
    }
    const run = await runSupplierMonitor(catalogRepository, {
      force,
      ...webMonitorOptions(),
    });
    // Schedulers need counters only, not private supplier evidence or identifiers.
    return NextResponse.json(request.headers.has("authorization") ? monitorRunSummary(run) : run, {
      status:
        run.status === "failed"
          ? 503
          : run.status === "already_running"
            ? 409
            : 200,
    });
  } catch (error) {
    return apiError(error);
  }
}
