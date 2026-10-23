const { createPublicKey, verify } = require('node:crypto');

function validPublicKey(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function verifyDiscordSignature(signature, timestamp, body, publicKey, now = Date.now()) {
  if (!validPublicKey(publicKey) || typeof signature !== 'string' ||
      !/^[a-f0-9]{128}$/i.test(signature) || typeof timestamp !== 'string' ||
      !/^\d{1,12}$/.test(timestamp) || !Buffer.isBuffer(body)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(now / 1000 - seconds) > 300) return false;
  try {
    const key = createPublicKey({ format: 'der', type: 'spki', key: Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'hex'),
    ]) });
    return verify(null, Buffer.concat([Buffer.from(timestamp, 'utf8'), body]), key,
      Buffer.from(signature, 'hex'));
  } catch { return false; }
}

module.exports = { validPublicKey, verifyDiscordSignature };
