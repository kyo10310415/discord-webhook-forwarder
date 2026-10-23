const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const app = require('../index');
const { verifyDiscordSignature } = require('../signature');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const key = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
let server, base;
test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { delete process.env.DISCORD_PUBLIC_KEY; await new Promise(resolve => server.close(resolve)); });
function signed(body, timestamp = String(Math.floor(Date.now() / 1000))) {
  return { 'Content-Type': 'application/json', 'X-Signature-Timestamp': timestamp,
    'X-Signature-Ed25519': sign(null, Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]), privateKey).toString('hex') };
}
function post(body, headers = signed(body)) {
  return fetch(base + '/discord', { method: 'POST', headers, body });
}
test('missing or malformed public key fails closed before accepting PING', async () => {
  for (const value of ['', 'invalid']) {
    process.env.DISCORD_PUBLIC_KEY = value;
    assert.equal((await post('{"type":1}')).status, 503);
  }
});
test('unsigned and malformed signatures are rejected', async () => {
  process.env.DISCORD_PUBLIC_KEY = key;
  assert.equal((await post('{"type":1}', { 'Content-Type': 'application/json' })).status, 401);
  const headers = signed('{"type":1}'); headers['X-Signature-Ed25519'] = '00';
  assert.equal((await post('{"type":1}', headers)).status, 401);
});
test('correct raw-body signature preserves Discord PING', async () => {
  process.env.DISCORD_PUBLIC_KEY = key;
  const response = await post(' { "type": 1 } ');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { type: 1 });
});
test('body or timestamp alteration is rejected', async () => {
  process.env.DISCORD_PUBLIC_KEY = key;
  assert.equal((await post('{"type":2}', signed('{"type":1}'))).status, 401);
  const headers = signed('{"type":1}');
  headers['X-Signature-Timestamp'] = String(Number(headers['X-Signature-Timestamp']) - 1);
  assert.equal((await post('{"type":1}', headers)).status, 401);
});
test('stale and future signed messages fail freshness validation', async () => {
  process.env.DISCORD_PUBLIC_KEY = key;
  for (const delta of [-600, 600]) {
    assert.equal((await post('{"type":1}', signed('{"type":1}', String(Math.floor(Date.now() / 1000) + delta)))).status, 401);
  }
});
test('signed malformed JSON returns 400, not a handler response', async () => {
  process.env.DISCORD_PUBLIC_KEY = key;
  for (const body of ['not-json', 'null', '[]']) assert.equal((await post(body)).status, 400);
});
test('valid command still gets the existing menu without external transmission', async () => {
  process.env.DISCORD_PUBLIC_KEY = key;
  const response = await post('{"type":2,"data":{"name":"test-command"},"user":{"id":"synthetic-user"}}');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).type, 4);
});
test('health is public and verifier rejects non-buffer/invalid timestamps', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal(verifyDiscordSignature('0'.repeat(128), 'not-time', Buffer.from('{}'), key), false);
  assert.equal(verifyDiscordSignature('0'.repeat(128), String(Math.floor(Date.now() / 1000)), '{}', key), false);
});
