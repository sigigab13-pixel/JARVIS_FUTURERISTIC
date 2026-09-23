import crypto from 'node:crypto';
import { dequeueJob, isRedisConfigured } from './queue.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);
}

async function rpc(name, body) {
  if (!configured()) throw new Error('Supabase worker persistence is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVER_KEY,
      Authorization: `Bearer ${SUPABASE_SERVER_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase worker RPC failed (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

export function createWorkerId(prefix = 'jarvis-worker') {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function claimNextJob(workerId) {
  const rows = await rpc('worker_claim_next_job', { p_worker_id: workerId });
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

export async function claimJob(jobId, workerId) {
  if (!jobId) return null;
  const rows = await rpc('worker_claim_job', { p_job_id: jobId, p_worker_id: workerId });
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

export async function heartbeatJob(jobId, workerId) {
  return rpc('worker_heartbeat_job', { p_job_id: jobId, p_worker_id: workerId });
}

export async function finishJob(jobId, workerId, result) {
  return rpc('worker_finish_job', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_result: result,
  });
}

export async function failJob(jobId, workerId, error) {
  return rpc('worker_fail_job', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_error: {
      message: String(error?.message || error || 'Worker execution failed.').slice(0, 2000),
      name: String(error?.name || 'Error').slice(0, 200),
    },
  });
}

export async function executeJob(job) {
  const type = String(job?.type || '');
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};

  if (type === 'video_pipeline') {
    return {
      accepted: true,
      type,
      operation: String(payload.operation || 'unknown'),
      projectId: payload.project_id || null,
      status: 'worker_received',
      message: 'Durable worker received the video job. Generation/rendering adapters remain a later pipeline milestone.',
    };
  }

  if (type === 'memory_maintenance') {
    return {
      accepted: true,
      type,
      status: 'worker_received',
      message: 'Durable worker received the memory maintenance job.',
    };
  }

  return {
    accepted: true,
    type: type || 'unknown',
    status: 'worker_received',
    message: 'Durable worker recorded the job without executing an unregistered job type.',
  };
}

export async function runWorker({ workerId = createWorkerId(), once = false, pollMs = 5000, logger = console } = {}) {
  if (!configured()) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY are required.');

  let processed = 0;
  while (true) {
    let job;
    try {
      const queued = isRedisConfigured() ? await dequeueJob() : null;
      job = queued?.jobId ? await claimJob(queued.jobId, workerId) : await claimNextJob(workerId);
      // If a stale/duplicate Redis message was consumed, recover any other queued Supabase job.
      if (!job && queued?.jobId) job = await claimNextJob(workerId);
    } catch (error) {
      logger.error?.('[JARVIS worker] claim failed:', error);
      if (once) throw error;
      await new Promise(resolve => setTimeout(resolve, pollMs));
      continue;
    }

    if (!job) {
      if (once) return { workerId, processed };
      await new Promise(resolve => setTimeout(resolve, pollMs));
      continue;
    }

    try {
      await heartbeatJob(job.id, workerId);
      const result = await executeJob(job);
      await finishJob(job.id, workerId, result);
      processed += 1;
      logger.info?.(`[JARVIS worker] completed ${job.id} (${job.type})`);
    } catch (error) {
      logger.error?.(`[JARVIS worker] failed ${job.id}:`, error);
      try {
        await failJob(job.id, workerId, error);
      } catch (failureError) {
        logger.error?.('[JARVIS worker] failed to persist failure:', failureError);
      }
      if (once) throw error;
    }

    if (once) return { workerId, processed };
  }
}

if (process.argv[1] && process.argv[1].endsWith('/worker.mjs')) {
  runWorker().catch(error => {
    console.error('[JARVIS worker] fatal:', error);
    process.exitCode = 1;
  });
}
