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

test('autonomous planner chains memory.search into chat.generate', async () => {
  let searchedQuery = '';
  const orchestrator = createJarvisOrchestrator({
    userId: 'test-user',
    hfToken: 'test-token',
    model: 'test-model',
    capabilities: {
      searchMemory: async (query) => {
        searchedQuery = query;
        return [{ memory_type: 'project', content: 'JARVIS uses a multi-cloud architecture.' }];
      },
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.messages[0].content.includes('multi-cloud architecture'), true);
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'I found the project memory.' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const result = await orchestrator.run({
      message: 'what do you remember about my JARVIS project?',
    });

    assert.equal(result.success, true);
    assert.equal(result.execution.verified, true);
    assert.deepEqual(
      result.execution.results.map(item => item.tool),
      ['memory.search', 'chat.generate'],
    );
    assert.equal(searchedQuery, 'what do you remember about my JARVIS project?');
    assert.equal(result.execution.plan.steps.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('planner rejects an unregistered tool before execution', async () => {
  const orchestrator = createJarvisOrchestrator({
    userId: 'test-user',
    hfToken: 'test-token',
    model: 'test-model',
  });

  await assert.rejects(
    () => orchestrator.run({
      message: 'hello',
    }).then(() => {
      throw new Error('test should not reach this branch');
    }),
    { message: /Planner selected an unregistered tool/ },
  );
});
