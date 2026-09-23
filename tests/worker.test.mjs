import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerId, executeJob } from '../server/worker.mjs';

test('worker creates unique stable ids', () => {
  const a = createWorkerId();
  const b = createWorkerId();
  assert.match(a, /^jarvis-worker-/);
  assert.notEqual(a, b);
});

test('worker handles video jobs without pretending generation is complete', async () => {
  const result = await executeJob({
    type: 'video_pipeline',
    payload: { operation: 'plan', project_id: 'project-1' },
  });
  assert.equal(result.accepted, true);
  assert.equal(result.status, 'worker_received');
  assert.equal(result.projectId, 'project-1');
  assert.match(result.message, /later pipeline milestone/);
});

test('worker safely records unknown job types', async () => {
  const result = await executeJob({ type: 'future_capability', payload: {} });
  assert.equal(result.accepted, true);
  assert.equal(result.type, 'future_capability');
  assert.match(result.message, /unregistered job type/);
});
