import crypto from 'node:crypto';

const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

function configured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

async function redis(command) {
  if (!configured()) throw new Error('Upstash Redis is not configured.');
  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(command),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(`Upstash Redis request failed (${response.status}): ${String(data?.error || 'unknown error').slice(0, 500)}`);
  }
  return data?.result;
}

export function createQueueMessage(jobId, type = 'jarvis') {
  return {
    id: crypto.randomUUID(),
    jobId: String(jobId),
    type: String(type || 'jarvis'),
    enqueuedAt: new Date().toISOString(),
  };
}

export async function enqueueJob(jobId, type = 'jarvis') {
  const message = createQueueMessage(jobId, type);
  await redis(['LPUSH', 'jarvis:jobs', JSON.stringify(message)]);
  return message;
}

export async function dequeueJob() {
  const message = await redis(['RPOP', 'jarvis:jobs']);
  if (!message) return null;
  try {
    return JSON.parse(message);
  } catch {
    return { jobId: null, type: 'invalid', raw: String(message) };
  }
}

export async function queueDepth() {
  return Number(await redis(['LLEN', 'jarvis:jobs']) || 0);
}

export { configured as isRedisConfigured };
