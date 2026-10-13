import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {MemoryCatalogRepository, FileCatalogRepository} from '../packages/core/repository.mjs';
import {searchAlternatives, searchSummary} from '../lib/supplier-search.mjs';
import {runSupplierMonitor} from '../lib/supplier-monitor.mjs';
import {identityKey} from '../packages/core/supplier.mjs';

const env = {SEARCH_PROVIDER:'tavily', SEARCH_API_KEY:'test-key-not-real', SEARCH_MONTHLY_LIMIT:'2'};
const now = Date.parse('2026-10-13T18:00:00Z');
const product = {id:'test-search',title:'Taza',gtin:'7501234567890',supplierUrl:'https://supplier.example/item'};

test('Tavily requests one basic search without generated answers, extraction or redirects', async () => {
  const repository = new MemoryCatalogRepository();
  const result = await searchAlternatives(product,{repository,env,now,fetchPage:async(url, options) => {
    assert.equal(url,'https://api.tavily.com/search');
    assert.equal(options.method,'POST');
    assert.equal(options.redirects,0);
    assert.equal(options.headers.Authorization,'Bearer test-key-not-real');
    const body=JSON.parse(options.body);
    assert.equal(body.search_depth,'basic');
    assert.equal(body.auto_parameters,false);
    assert.equal(body.include_answer,false);
    assert.equal(body.include_raw_content,false);
    assert.match(body.query,/7501234567890/);
    return {status:200,text:JSON.stringify({results:[{url:'https://other.example/item'},{url:'http://127.0.0.1/private'},{url:'https://other.example/item'}]})};
  }});
  assert.deepEqual(result,{status:'ok',urls:['https://other.example/item']});
  const summary=await searchSummary(repository,env,now);
  assert.equal(summary.used,1);
  assert.equal(summary.remaining,1);
  assert.equal(JSON.stringify(summary).includes(env.SEARCH_API_KEY),false);
});

test('search reservations prevent concurrent calls above the monthly budget and failed calls are not retried', async () => {
  const repository = new MemoryCatalogRepository();let calls=0;
  const options={repository,env,now,fetchPage:async()=>{calls++;throw new Error('timeout');}};
  const results=await Promise.all(Array.from({length:8},()=>searchAlternatives(product,options)));
  assert.equal(calls,2);
  assert.equal(results.filter(r=>r.status==='budget_exhausted').length,6);
  assert.equal((await searchSummary(repository,env,now)).remaining,0);
});

test('monthly counter survives repository restart and resets only in a new UTC month', async () => {
  const directory=await mkdtemp(join(tmpdir(),'saltillo-search-'));
  try {
    const file=join(directory,'catalog.json');
    const options={env,now,fetchPage:async()=>({status:200,text:'{"results":[]}'})};
    await searchAlternatives(product,{...options,repository:new FileCatalogRepository(file)});
    assert.equal((await searchSummary(new FileCatalogRepository(file),env,now)).used,1);
    const nextMonth=Date.parse('2026-11-01T00:00:00Z');
    assert.equal((await searchSummary(new FileCatalogRepository(file),env,nextMonth)).used,0);
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('missing credentials and zero budget do not contact Tavily; configured limit cannot exceed the free safety cap', async () => {
  const repository=new MemoryCatalogRepository();
  const fetchPage=async()=>{throw new Error('network must not be called');};
  assert.equal((await searchAlternatives(product,{repository,env:{SEARCH_PROVIDER:'tavily'},now,fetchPage})).status,'unconfigured');
  assert.equal((await searchAlternatives(product,{repository,env:{...env,SEARCH_MONTHLY_LIMIT:'0'},now,fetchPage})).status,'budget_exhausted');
  assert.equal((await searchSummary(repository,{...env,SEARCH_MONTHLY_LIMIT:'5000'},now)).limit,900);
});

test('Tavily key and quota errors become explicit review statuses without forwarding the API response', async () => {
  for (const [status,expected] of [[401,'invalid_key'],[429,'rate_limited'],[432,'quota_exhausted']]) {
    const result=await searchAlternatives(product,{repository:new MemoryCatalogRepository(),env,now,
      fetchPage:async()=>({status,text:'secret provider response'})});
    assert.deepEqual(result,{status:expected,urls:[]});
  }
});

test('exhausted search budget does not stop supplier monitoring or change the approved price', async () => {
  const repository=new MemoryCatalogRepository();
  const observed={title:'Taza',gtin:'7501234567890',supplierCost:100,currency:'MXN',images:[]};
  await repository.saveProduct({...product,sourceIdentity:identityKey(observed),sourceOriginal:observed,
    supplierCost:100,currency:'MXN',publicPrice:200,status:'published'});
  const run=await runSupplierMonitor(repository,{force:true,
    scrape:async()=>({options:[observed]}),
    search:entry=>searchAlternatives(entry,{repository,env:{...env,SEARCH_MONTHLY_LIMIT:'0'},now,
      fetchPage:async()=>{throw new Error('network must not be called');}})});
  assert.equal(run.status,'completed');
  assert.equal(run.checked,1);
  assert.equal(run.search[0].status,'budget_exhausted');
  assert.equal((await repository.getProduct(product.id)).publicPrice,200);
  assert.ok((await repository.listSupplierChecks(product.id)).length);
});
