import crypto from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WORKER_ID = process.env.JARVIS_WORKER_ID || `video-worker-${crypto.randomUUID()}`;
const POLL_MS = Math.max(1000, Number(process.env.JARVIS_WORKER_POLL_MS || 5000));
const LOCK_SECONDS = Math.max(30, Number(process.env.JARVIS_JOB_LOCK_SECONDS || 300));
const JOB_TYPES = (process.env.JARVIS_JOB_TYPES || 'video_pipeline').split(',').map(s => s.trim()).filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.');
}

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Supabase RPC ${name} failed (${response.status}): ${raw.slice(0, 500)}`);
  return raw ? JSON.parse(raw) : null;
}

async function rest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Supabase REST failed (${response.status}): ${raw.slice(0, 500)}`);
  return raw ? JSON.parse(raw) : null;
}

async function claimJob() {
  const rows = await rpc('claim_jarvis_job', {
    p_worker_id: WORKER_ID,
    p_types: JOB_TYPES,
    p_lock_seconds: LOCK_SECONDS,
  });
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

async function heartbeat(jobId) {
  await rpc('heartbeat_jarvis_job', { p_job_id: jobId, p_worker_id: WORKER_ID });
}

async function complete(jobId, result) {
  return rpc('complete_jarvis_job', {
    p_job_id: jobId,
    p_worker_id: WORKER_ID,
    p_result: result,
  });
}

async function fail(jobId, error, retry = true) {
  return rpc('fail_jarvis_job', {
    p_job_id: jobId,
    p_worker_id: WORKER_ID,
    p_error: { message: String(error?.message || error), name: String(error?.name || 'WorkerError') },
    p_retry: retry,
  });
}

async function updateProject(projectId, patch) {
  if (!projectId) return null;
  const rows = await rest(
    `jarvis_video_projects?id=eq.${encodeURIComponent(projectId)}`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) },
  );
  return rows?.[0] || null;
}

async function executeVideoPipeline(job) {
  const payload = job.payload || {};
  const projectId = payload.project_id;
  if (!projectId) throw new Error('Video job is missing project_id.');

  // This worker owns durable orchestration. Provider-specific generation adapters
  // can be added without changing the queue/locking/recovery layer.
  await updateProject(projectId, { status: 'processing', updated_at: new Date().toISOString() });

  const pipeline = [
    'story_director',
    'character_bible',
    'world_asset_bible',
    'scene_director',
    'storyboard_cost_gate',
    'visual_generation',
    'motion',
    'voice_audio',
    'lip_sync',
    'editing',
    'subtitles',
    'continuity_brand_qa',
    'repair_recovery',
    'render',
    'final_qa',
    'publish',
  ];

  // The first production worker pass records an auditable execution plan.
  // Media-provider adapters are intentionally separate from queue execution.
  const result = {
    worker_id: WORKER_ID,
    project_id: projectId,
    pipeline,
    mode: 'orchestration_plan',
    message: 'Pipeline claimed and validated. Provider adapters/rendering run in subsequent worker stages.',
    completed_at: new Date().toISOString(),
  };

  await updateProject(projectId, { status: 'review', updated_at: new Date().toISOString() });
  return result;
}

async function processJob(job) {
  const heartbeatTimer = setInterval(() => {
    heartbeat(job.id).catch(error => console.error('[heartbeat]', error.message));
  }, Math.max(10_000, Math.floor(LOCK_SECONDS * 1000 / 3)));

  try {
    if (job.type === 'video_pipeline') {
      const result = await executeVideoPipeline(job);
      await complete(job.id, result);
    } else {
      throw new Error(`Unsupported job type: ${job.type}`);
    }
  } catch (error) {
    console.error('[job]', job.id, error);
    await fail(job.id, error, true);
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function run() {
  console.log(`JARVIS worker ${WORKER_ID} listening for: ${JOB_TYPES.join(', ')}`);
  while (true) {
    try {
      const job = await claimJob();
      if (job) {
        console.log(`[claim] ${job.id} ${job.type}`);
        await processJob(job);
      } else {
        await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
    } catch (error) {
      console.error('[worker]', error.message);
      await new Promise(resolve => setTimeout(resolve, Math.max(POLL_MS, 5000)));
    }
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
