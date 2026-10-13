import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createEntryServer } from '../ops/http-entry.mjs';

test('HTML stays buffered until complete, with exact length for hosting transformation', async () => {
  let complete, started;
  const waiting = new Promise(resolve => { started = resolve; });
  const origin = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type':'text/html', 'Set-Cookie':'test=value; HttpOnly' });
    res.write('<!doctype html><html><head><title>Store</title>');
    complete = () => res.end('</head><body>Catalog</body></html>');
    started();
  });
  await new Promise(resolve => origin.listen(0, '127.0.0.1', resolve));
  const entry = createEntryServer(origin.address().port);
  await new Promise(resolve => entry.listen(0, '127.0.0.1', resolve));
  try {
    let headersReceived = false;
    const result = new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${entry.address().port}/`, res => {
        headersReceived = true;
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ headers:res.headers, body:Buffer.concat(chunks) }));
      }).on('error', reject);
    });
    await waiting;
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(headersReceived, false, 'incomplete HTML reached the hosting proxy');
    complete();
    const response = await result;
    assert.equal(Number(response.headers['content-length']), response.body.length);
    assert.equal(response.headers['transfer-encoding'], undefined);
    assert.deepEqual(response.headers['set-cookie'], ['test=value; HttpOnly']);
    assert.match(response.body.toString(), /<body>Catalog<\/body><\/html>$/);
    // Actual hosting transformation duplicates its disclosure after </title>.
    const disclosure = '<div data-hosting-disclosure="true">Hosted app</div>';
    const publicHtml = response.body.toString()
      .replace('</title>', '</title>' + disclosure)
      .replace('</body>', disclosure + '</body>');
    assert.equal(publicHtml.split(disclosure).length - 1, 1,
      'hosting injected a duplicate disclosure into the document head');
    assert.equal(publicHtml.slice(0, publicHtml.indexOf('</head>')).includes(disclosure), false);
  } finally {
    complete?.();
    await Promise.all([new Promise(r => entry.close(r)), new Promise(r => origin.close(r))]);
  }
});
