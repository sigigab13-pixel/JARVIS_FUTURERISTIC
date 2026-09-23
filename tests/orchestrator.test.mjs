import assert from 'node:assert/strict';
import testRunner from 'node:test';
import { createJarvisOrchestrator } from '../server/orchestrator.mjs';

const test = testRunner;

test('JARVIS registers the core capability tools', () => {
  const orchestrator = createJarvisOrchestrator({
    userId: 'test-user',
    hfToken: 'test-token',
    model: 'test-model',
  });

  const names = orchestrator.registry.list().map(tool => tool.name);
  assert.deepEqual(names, [
    'system.health',
    'memory.search',
    'image.generate',
    'video.plan',
    'chat.generate',
  ]);
});

test('explicit image action routes to image.generate', async () => {
  let receivedPrompt = '';
  const orchestrator = createJarvisOrchestrator({
    userId: 'test-user',
    hfToken: 'test-token',
    model: 'test-model',
    capabilities: {
      generateImage: async ({ prompt }) => {
        receivedPrompt = prompt;
        return { image: { data: 'fake', mimeType: 'image/png' } };
      },
    },
  });

  const result = await orchestrator.run({
    message: 'make a futuristic JARVIS logo',
    action: 'image',
  });

  assert.equal(result.success, true);
  assert.equal(result.execution.results[0].tool, 'image.generate');
  assert.equal(result.execution.plan.intent, 'image_generation');
  assert.equal(receivedPrompt, 'make a futuristic JARVIS logo');
});

test('explicit video action requires a project id instead of silently chatting', async () => {
  const orchestrator = createJarvisOrchestrator({
    userId: 'test-user',
    hfToken: 'test-token',
    model: 'test-model',
    capabilities: {
      planVideo: async () => ({ job: { id: 'job-1' } }),
    },
  });

  await assert.rejects(
    () => orchestrator.run({ message: 'create my episode', action: 'video' }),
    /video project id is required/i,
  );
});


test('execution engine verifies successful tool execution', async () => {
  const orchestrator = createJarvisOrchestrator({
    userId: 'test-user',
    hfToken: 'test-token',
    model: 'test-model',
    capabilities: {
      generateImage: async ({ prompt }) => ({ image: { data: prompt, mimeType: 'image/png' } }),
    },
  });

  const result = await orchestrator.run({
    message: 'create an image of a JARVIS core',
    action: 'image',
  });

  assert.equal(result.success, true);
  assert.equal(result.execution.verified, true);
  assert.equal(result.execution.results[0].verification.ok, true);
});
