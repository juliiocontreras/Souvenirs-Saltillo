import { randomUUID } from "node:crypto";
import { scrapeSupplierOptions } from "./supplier-scraper.mjs";
import {
  identityKey,
  alternativeIdentity,
} from "../packages/core/supplier.mjs";
import { findAlternativeQuery } from "../packages/core/catalog.mjs";
import {
  nextReviewAt,
  classifySupplierCheck,
} from "../packages/core/monitor.mjs";
import { publicFetch } from "./public-fetch.mjs";
import { ApiError } from "./admin-auth.mjs";
import { createImport } from "./catalog-service.mjs";

export async function searchAlternatives(product) {
  if (process.env.SEARCH_PROVIDER !== "brave" || !process.env.SEARCH_API_KEY)
    return { status: "unconfigured", urls: [] };
  const query = findAlternativeQuery(product);
  const url =
    "https://api.search.brave.com/res/v1/web/search?" +
    new URLSearchParams({ q: query.slice(0, 300), count: "5" });
  const response = await publicFetch(url, {
    redirects: 0,
    maxBytes: 500000,
    headers: {
      "X-Subscription-Token": process.env.SEARCH_API_KEY,
      accept: "application/json",
    },
  });
  if (response.status !== 200) return { status: "unavailable", urls: [] };
  try {
    const data = JSON.parse(response.text);
    return {
      status: "ok",
      urls: (data.web?.results || [])
        .map((row) => row.url)
        .filter((url) => typeof url === "string")
        .slice(0, 3),
    };
  } catch {
    return { status: "unavailable", urls: [] };
  }
}
export async function addAlternative(
  repository,
  productId,
  url,
  { scrape = scrapeSupplierOptions } = {},
) {
  const product = await repository.getProduct(productId);
  if (!product) throw new ApiError("Producto no encontrado.", 404);
  let sourceUrl;
  try {
    sourceUrl = new URL(url).href;
  } catch {
    throw new ApiError("Enlace alternativo inválido.");
  }
  if (sourceUrl === product.supplierUrl)
    throw new ApiError("Este enlace ya es el proveedor principal.");
  const result = await scrape(url),
    matching = result.options.filter((candidate) =>
      alternativeIdentity(product, candidate),
    );
  const candidate = matching.length === 1 ? matching[0] : result.options[0];
  const verified =
    matching.length === 1 &&
    candidate.supplierCost !== null &&
    Boolean(candidate.currency);
  return repository.saveAlternative(productId, {
    url: result.sourceUrl,
    identityKey: identityKey(candidate),
    observed: candidate,
    matchStatus: verified ? "verified" : "candidate",
    sourceStatus: "ok",
    checkedAt: new Date().toISOString(),
    nextCheckAt: nextReviewAt(),
    comparison:
      "Confirma cantidad, moneda, flete, impuestos y entrega antes de comparar el costo total.",
  });
}
export async function alternativeImport(
  repository,
  productId,
  alternativeId,
  options = {},
) {
  const product = await repository.getProduct(productId),
    alternatives = await repository.listAlternatives(productId),
    alternative = alternatives.find((a) => a.id === alternativeId);
  if (
    !product ||
    !alternative ||
    (alternative.matchStatus !== "verified" &&
      options.identityConfirmed !== true) ||
    !["ok", "changed"].includes(alternative.sourceStatus) ||
    Date.now() - Date.parse(alternative.checkedAt) > 4 * 3600000
  )
    throw new ApiError(
      "Revisa el enlace: solo se puede elegir una alternativa verificada y consultada en las últimas cuatro horas.",
    );
  const draft = await createImport(repository, alternative.url, options);
  const match = draft.options.findIndex((candidate) =>
    alternativeIdentity(product, candidate),
  );
  if (match < 0 && options.identityConfirmed !== true)
    throw new ApiError(
      "La alternativa cambió de identidad; no se cambió el proveedor.",
    );
  const original = { gtin: product.gtin || product.sourceOriginal?.gtin };
  if (
    draft.options.every(
      (candidate) =>
        original.gtin && candidate.gtin && original.gtin !== candidate.gtin,
    )
  )
    throw new ApiError(
      "Los GTIN no coinciden; esta ficha no puede sustituir al mismo artículo.",
    );
  return repository.saveDraft({
    ...draft,
    productId,
    alternativeId,
    selection: match >= 0 ? match : 0,
    manualIdentityConfirmed: options.identityConfirmed === true,
  });
}

function failureStatus(error) {
  return (
    {
      SUPPLIER_REMOVED: "removed",
      SUPPLIER_BLOCKED: "blocked",
      SUPPLIER_RATE_LIMIT: "rate_limited",
      SUPPLIER_ROBOTS_DENIED: "restricted",
      SUPPLIER_EXTRACTION: "extraction_failed",
      SUPPLIER_VARIANT: "identity_review",
      SUPPLIER_UNSAFE_URL: "unsafe_url",
    }[error.code] || "transient_error"
  );
}
function dueJobs(state, force, now) {
  const jobs = [];
  for (const product of Object.values(state.products)) {
    if (!product.supplierUrl) continue;
    if (force || !product.nextCheckAt || Date.parse(product.nextCheckAt) <= now)
      jobs.push({
        kind: "primary",
        product,
        url: product.supplierUrl,
        nextCheckAt: product.nextCheckAt || "",
      });
    for (const alternative of state.alternatives[product.id] || [])
      if (
        force ||
        !alternative.nextCheckAt ||
        Date.parse(alternative.nextCheckAt) <= now
      )
        jobs.push({
          kind: "alternative",
          product,
          alternative,
          url: alternative.url,
          nextCheckAt: alternative.nextCheckAt || "",
        });
  }
  return jobs.sort((a, b) => a.nextCheckAt.localeCompare(b.nextCheckAt));
}
export async function runSupplierMonitor(
  repository,
  {
    force = false,
    scrape = scrapeSupplierOptions,
    search = searchAlternatives,
    batchSize = Number(process.env.MONITOR_BATCH_SIZE || 2),
  } = {},
) {
  const id = randomUUID();
  if (!(await repository.acquireLease("supplier-monitor", id)))
    return { status: "already_running", remaining: 0 };
  const run = {
    id,
    startedAt: new Date().toISOString(),
    status: "running",
    checked: 0,
    issues: [],
    search: [],
    added: 0,
    remaining: 0,
  };
  const timer = setInterval(
    () => repository.renewLease("supplier-monitor", id).catch(() => {}),
    30000,
  );
  timer.unref?.();
  try {
    await repository.saveRun(run);
    const all = dueJobs(await repository.read(), force, Date.now()),
      limit = Math.min(
        5,
        Math.max(1, Number.isInteger(batchSize) ? batchSize : 2),
      ),
      jobs = all.slice(0, limit);
    for (const job of jobs) {
      const checkedAt = new Date().toISOString();
      let observed = null,
        status = "ok",
        message = null;
      try {
        const result = await scrape(job.url);
        const expected =
          job.kind === "primary"
            ? job.product.sourceIdentity
            : job.alternative.identityKey;
        observed = result.options.find(
          (candidate) => identityKey(candidate) === expected,
        );
        if (!observed) {
          status = "identity_review";
          message = "La identidad o variante de la ficha cambió.";
        } else if (observed.supplierCost === null || !observed.currency) {
          status = "incomplete";
          message = "El proveedor dejó de publicar costo o moneda confirmados.";
        } else if (
          observed.currency !==
          (job.kind === "primary"
            ? job.product.sourceOriginal?.currency || job.product.currency
            : job.alternative.observed.currency)
        ) {
          status = "currency_review";
          message = "La moneda cambió; requiere aprobación.";
        } else {
          const previous =
            job.kind === "primary"
              ? job.product.sourceOriginal?.supplierCost
              : job.alternative.observed.supplierCost;
          status = classifySupplierCheck(
            { ok: true, price: observed.supplierCost },
            previous,
          ).status;
          const baseline = job.product.sourceOriginal || job.product;
          if (
            job.kind === "primary" &&
            (observed.title !== baseline.title ||
              observed.deliveryDays !== baseline.deliveryDays ||
              JSON.stringify(observed.images) !==
                JSON.stringify(baseline.images) ||
              observed.description !== baseline.description ||
              observed.stockStatus !== baseline.stockStatus)
          )
            status = "changed";
        }
      } catch (error) {
        status = failureStatus(error);
        message = error.message;
      }
      await repository.mutate((state) => {
        if (job.kind === "primary") {
          const current = state.products[job.product.id];
          if (
            current?.supplierUrl !== job.url ||
            current?.sourceIdentity !== job.product.sourceIdentity ||
            current?.updatedAt !== job.product.updatedAt
          )
            return;
          // Published fields stay approved. Observations are proposals shown in the admin panel.
          Object.assign(current, {
            sourceStatus: status,
            sourceObservation: observed,
            sourceMessage: message,
            lastCheckedAt: checkedAt,
            nextCheckAt: nextReviewAt(),
          });
        } else {
          const alternative = state.alternatives[job.product.id]?.find(
            (a) => a.id === job.alternative.id,
          );
          if (!alternative) return;
          Object.assign(alternative, {
            sourceStatus: status,
            checkedAt,
            nextCheckAt: nextReviewAt(),
            message,
          });
          if (observed && ["ok", "changed"].includes(status)) {
            alternative.observed = observed;
            alternative.matchStatus = alternativeIdentity(
              state.products[job.product.id] || job.product,
              observed,
            )
              ? "verified"
              : "candidate";
          }
        }
        const list = (state.checks[job.product.id] ||= []);
        list.push({
          id: randomUUID(),
          runId: id,
          kind: job.kind,
          url: job.url,
          status,
          observedPrice: observed?.supplierCost ?? null,
          observed: observed
            ? Object.fromEntries(
                [
                  "supplierCost",
                  "currency",
                  "deliveryDays",
                  "deliveryMinDays",
                  "gtin",
                  "sku",
                  "mpn",
                  "variant",
                  "stockStatus",
                  "method",
                ].map((key) => [key, observed[key] ?? null]),
              )
            : null,
          checkedAt,
          message,
        });
        state.checks[job.product.id] = list.slice(-200);
      });
      run.checked++;
      if (status !== "ok")
        run.issues.push({ productId: job.product.id, status, kind: job.kind });
      if (job.kind === "primary") {
        try {
          const result = await search(job.product);
          run.search.push({ productId: job.product.id, status: result.status });
          const existing = await repository.listAlternatives(job.product.id);
          for (const url of result.urls.slice(0, 3)) {
            try {
              if (
                new URL(url).hostname === new URL(job.url).hostname ||
                existing.some((a) => a.url === url)
              )
                continue;
              await addAlternative(repository, job.product.id, url, { scrape });
              run.added++;
            } catch {
              /* A failed candidate is not a verified alternative. */
            }
          }
        } catch {
          run.search.push({ productId: job.product.id, status: "unavailable" });
        }
      }
      await repository.saveRun(run);
    }
    run.remaining = dueJobs(await repository.read(), false, Date.now()).length;
    // For a manual forced review, subsequent batches process the remaining original jobs.
    if (force && all.length > jobs.length) {
      const outstanding = all.slice(jobs.length);
      await repository.mutate((state) => {
        for (const job of outstanding) {
          if (job.kind === "primary" && state.products[job.product.id])
            state.products[job.product.id].nextCheckAt = new Date(
              0,
            ).toISOString();
          else {
            const alt = state.alternatives[job.product.id]?.find(
              (a) => a.id === job.alternative.id,
            );
            if (alt) alt.nextCheckAt = new Date(0).toISOString();
          }
        }
      });
      run.remaining = outstanding.length;
    }
    run.status = "completed";
  } catch {
    run.status = "failed";
    run.message =
      "La revisión no pudo completarse; consulta la configuración del servidor.";
  } finally {
    clearInterval(timer);
    run.finishedAt = new Date().toISOString();
    await repository.saveRun(run);
    await repository.releaseLease("supplier-monitor", id);
  }
  return run;
}
