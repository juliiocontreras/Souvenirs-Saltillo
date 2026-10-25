import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileCatalogRepository } from "../packages/core/repository.mjs";
import { importSummary } from "../packages/core/imports.mjs";

test("pending imports survive reopening storage, exclude applied drafts and never become public products", async () => {
  const folder = await mkdtemp(join(tmpdir(), "saltillo-imports-"));
  try {
    const file = join(folder, "catalog.json"), first = new FileCatalogRepository(file);
    await first.saveDraft({id:"older",status:"preview",createdAt:"2026-10-24T00:00:00Z",options:[{title:"Old"}]});
    await first.saveDraft({id:"newer",status:"preview",createdAt:"2026-10-25T00:00:00Z",options:[{title:"Termo",supplierCost:100,currency:"MXN",deliveryDays:null,images:[],evidence:{private:"CANARY"}}]});
    await first.saveDraft({id:"applied",status:"applied",createdAt:"2026-10-26T00:00:00Z",options:[{title:"Applied"}]});
    const reopened = new FileCatalogRepository(file), inbox = await reopened.listPendingImports();
    assert.deepEqual(inbox.map(d=>d.id),["newer","older"]);
    assert.deepEqual(inbox[0].missing,["imagen","entrega"]);
    assert.ok(!JSON.stringify(inbox).includes("CANARY"));
    assert.ok(!JSON.stringify(inbox).includes("supplierCost"));
    assert.equal((await reopened.getDraft("newer")).options[0].supplierCost,100);
    assert.deepEqual(await reopened.listPublicProducts(),[]);
    assert.equal(await reopened.getDraft("__proto__"),null);
    assert.equal(await reopened.getDraft("constructor"),null);
    assert.equal(await reopened.getDraft("missing"),null);
  } finally { await rm(folder,{recursive:true,force:true}); }
});

test("selected variant determines missing fields and zero is a known value", () => {
  const summary = importSummary({id:"variants",selection:1,options:[{title:"Incomplete"},{title:"Second",images:["https://images.example/a.jpg"],supplierCost:0,currency:"MXN",deliveryDays:0}]});
  assert.equal(summary.title,"Second");assert.equal(summary.optionCount,2);
  assert.deepEqual(summary.missing,[]);
});
