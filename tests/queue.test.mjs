import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueueMessage } from '../server/queue.mjs';

test('Redis queue messages carry a stable job reference', () => {
  const message = createQueueMessage('job-123', 'video_pipeline');
  assert.equal(message.jobId, 'job-123');
  assert.equal(message.type, 'video_pipeline');
  assert.match(message.id, /^[0-9a-f-]{36}$/i);
  assert.ok(message.enqueuedAt);
});
