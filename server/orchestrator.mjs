import crypto from 'node:crypto';

const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';

export class JarvisToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    const name = String(tool?.name || '').trim();
    if (!name) throw new Error('Tool name is required.');
    if (this.tools.has(name)) throw new Error(`Tool already registered: ${name}`);
    this.tools.set(name, tool);
  }

  get(name) {
    return this.tools.get(name);
  }

  list() {
    return [...this.tools.values()].map(({ execute, ...tool }) => tool);
  }
}

function toolResult(tool, startedAt, data, error = null) {
  return {
    success: !error,
    tool,
    executionId: crypto.randomUUID(),
    data: error ? undefined : data,
    error: error ? { code: 'TOOL_EXECUTION_FAILED', message: String(error.message || error), retryable: true } : undefined,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

export function createJarvisOrchestrator({
  userId,
  memories = [],
  preferences = {},
  hfToken,
  model,
  capabilities = {},
}) {
  if (!userId) throw new Error('JARVIS orchestrator requires a user id.');
  if (!hfToken) throw Object.assign(new Error('Hugging Face AI is not configured on this deployment.'), { statusCode: 503 });

  const registry = new JarvisToolRegistry();

  registry.register({
    name: 'system.health',
    description: 'Inspect non-secret configuration and runtime readiness for JARVIS services.',
    version: '1.1.0',
    capabilities: ['diagnostics'],
    requiresAuth: true,
    requiresApproval: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['services'] },
    execute: async () => {
      const startedAt = new Date().toISOString();
      const services = {
        supabase: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
        ai: Boolean(process.env.HUGGINGFACE_API_TOKEN),
        redis: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
        mediaStorage: Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET),
      };
      return toolResult('system.health', startedAt, {
        status: Object.values(services).every(Boolean) ? 'ready' : 'partial',
        services,
        checkedAt: new Date().toISOString(),
      });
    },
  });

  registry.register({
    name: 'memory.search',
    description: 'Search JARVIS long-term semantic memory for context relevant to the current request.',
    version: '1.0.0',
    capabilities: ['memory', 'retrieval'],
    requiresAuth: true,
    requiresApproval: false,
    inputSchema: { type: 'object', required: ['query'] },
    outputSchema: { type: 'object', required: ['memories'] },
    execute: async (input) => {
      const startedAt = new Date().toISOString();
      try {
        if (typeof capabilities.searchMemory !== 'function') throw new Error('Memory search capability is not connected.');
        const query = String(input?.query || '').trim();
        if (!query) throw new Error('A memory search query is required.');
        const found = await capabilities.searchMemory(query, { threshold: 0.72, count: Number(input?.count || 8) });
        return toolResult('memory.search', startedAt, { memories: Array.isArray(found) ? found : [] });
      } catch (error) {
        return toolResult('memory.search', startedAt, undefined, error);
      }
    },
  });

  registry.register({
    name: 'image.generate',
    description: 'Generate an image by delegating to JARVIS\' existing Hugging Face image engine.',
    version: '1.0.0',
    capabilities: ['image', 'creative'],
    requiresAuth: true,
    requiresApproval: false,
    inputSchema: { type: 'object', required: ['prompt'] },
    outputSchema: { type: 'object', required: ['image'] },
    execute: async (input) => {
      const startedAt = new Date().toISOString();
      try {
        if (typeof capabilities.generateImage !== 'function') throw new Error('Image generation capability is not connected.');
        const prompt = String(input?.prompt || '').trim();
        if (!prompt) throw new Error('An image prompt is required.');
        const result = await capabilities.generateImage({ prompt, referenceImage: input?.referenceImage || null });
        return toolResult('image.generate', startedAt, result);
      } catch (error) {
        return toolResult('image.generate', startedAt, undefined, error);
      }
    },
  });

  registry.register({
    name: 'video.plan',
    description: 'Create a queued video-planning job by delegating to JARVIS\' existing Video Engine.',
    version: '1.0.0',
    capabilities: ['video', 'planning', 'jobs'],
    requiresAuth: true,
    requiresApproval: false,
    inputSchema: { type: 'object', required: ['projectId'] },
    outputSchema: { type: 'object', required: ['job'] },
    execute: async (input) => {
      const startedAt = new Date().toISOString();
      try {
        if (typeof capabilities.planVideo !== 'function') throw new Error('Video planning capability is not connected.');
        const projectId = String(input?.projectId || '').trim();
        if (!projectId) throw new Error('A video project id is required.');
        const result = await capabilities.planVideo(projectId, input?.request || {});
        return toolResult('video.plan', startedAt, result);
      } catch (error) {
        return toolResult('video.plan', startedAt, undefined, error);
      }
    },
  });

  registry.register({
    name: 'chat.generate',
    description: 'Generate a JARVIS response through the configured AI provider.',
    version: '1.1.0',
    capabilities: ['chat', 'reasoning'],
    requiresAuth: false,
    requiresApproval: false,
    inputSchema: { type: 'object', required: ['messages'] },
    outputSchema: { type: 'object', required: ['text'] },
    execute: async (input) => {
      const startedAt = new Date().toISOString();
      try {
        const memoryContext = memories.length
          ? `Relevant long-term memories for this user, ranked by relevance and importance:\n${memories.map((m, i) => `${i + 1}. [${String(m.memory_type || 'memory')}] ${String(m.content || '').trim()}`).join('\n')}\nUse only memories that genuinely help answer the current request. Do not mention the memory system unless asked.`
          : '';

        const identity = preferences?.name ? `The user's preferred name is ${String(preferences.name)}.\n` : '';
        const systemMessage = [
          "You are JARVIS, Saviour's helpful AI assistant. Be accurate, concise, friendly, and honest about capabilities. Do not claim an action happened unless the connected service confirms it. For security topics, stay defensive and educational. For NEXORA, keep trading simulated/paper-only.",
          identity + memoryContext,
        ].filter(Boolean).join('\n\n');

        const response = await fetch(HF_CHAT_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: systemMessage }, ...input.messages],
            max_tokens: 1200,
            temperature: 0.7,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error?.message || 'Hugging Face AI request failed.');

        const text = String(data?.choices?.[0]?.message?.content || '').trim();
        if (!text) throw new Error('The AI core returned an empty response.');

        return toolResult('chat.generate', startedAt, {
          text,
          provider: 'Hugging Face Inference Providers',
          model,
        });
      } catch (error) {
        return toolResult('chat.generate', startedAt, undefined, error);
      }
    },
  });

  async function executeTool(toolName, input = {}, context = {}, options = {}) {
    const tool = registry.get(toolName);
    if (!tool) throw new Error(`JARVIS tool is not registered: ${toolName}`);
    const maxAttempts = Math.min(Math.max(Number(options.retries ?? 1) + 1, 1), 3);
    let lastResult;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      lastResult = await tool.execute(input, context);
      if (lastResult?.success) return { ...lastResult, attempt, attempts: maxAttempts };
      if (lastResult?.error?.retryable === false || attempt === maxAttempts) break;
    }
    return { ...lastResult, attempt: maxAttempts, attempts: maxAttempts };
  }

  function verifyResult(result) {
    if (!result || typeof result !== 'object') return { ok: false, reason: 'Tool returned no structured result.' };
    if (result.success !== true) return { ok: false, reason: result.error?.message || 'Tool execution failed.' };
    return { ok: true };
  }

  async function executePlan(steps, context = {}) {
    if (!Array.isArray(steps) || steps.length === 0) throw Object.assign(new Error('Execution plan must contain at least one step.'), { statusCode: 400 });
    if (steps.length > 8) throw Object.assign(new Error('Execution plan is limited to 8 steps.'), { statusCode: 400 });
    const results = [];
    for (const step of steps) {
      const toolName = String(step?.tool || '').trim();
      if (!toolName) throw new Error('Every execution step requires a tool.');
      const result = await executeTool(toolName, step?.input || {}, context, { retries: step?.retries ?? 1 });
      const verification = verifyResult(result);
      results.push({ ...result, verification });
      if (!verification.ok && step?.continueOnError !== true) break;
    }
    return results;
  }

  return {
    registry,

    async run({
      message,
      messages = [],
      action = 'auto',
      imagePrompt,
      referenceImage,
      videoProjectId,
      videoRequest = {},
    } = {}) {
      const latestMessage = String(message || messages[messages.length - 1]?.content || '').trim();
      if (!latestMessage) throw Object.assign(new Error('A message is required.'), { statusCode: 400 });

      const normalizedMessages = (messages.length ? messages : [{ role: 'user', content: latestMessage }])
        .filter(item => ['user', 'assistant', 'system', 'model'].includes(String(item?.role)) && String(item?.content || '').trim())
        .slice(-16)
        .map(item => ({ role: item.role, content: String(item.content).trim() }));

      const lower = latestMessage.toLowerCase();
      const requestedAction = String(action || 'auto').toLowerCase();
      const wantsImage = requestedAction === 'image'
        || (requestedAction === 'auto' && /\b(generate|create|make|draw)\b.{0,30}\b(image|picture|photo|artwork|logo)\b/i.test(lower));
      const wantsVideo = requestedAction === 'video'
        || (requestedAction === 'auto' && /\b(plan|create|make|generate)\b.{0,30}\b(video|film|short|episode)\b/i.test(lower));

      let selectedTool = 'chat.generate';
      let toolInput = { messages: normalizedMessages };
      let intent = 'conversation';

      if (wantsImage) {
        const prompt = String(imagePrompt || latestMessage).trim();
        if (!prompt) throw Object.assign(new Error('An image prompt is required.'), { statusCode: 400 });
        selectedTool = 'image.generate';
        intent = 'image_generation';
        toolInput = { prompt, referenceImage };
      } else if (wantsVideo) {
        if (!videoProjectId) {
          throw Object.assign(new Error('A video project id is required for video planning.'), { statusCode: 400 });
        }
        selectedTool = 'video.plan';
        intent = 'video_planning';
        toolInput = { projectId: videoProjectId, request: videoRequest };
      }

      const requestId = crypto.randomUUID();
      const plan = {
        intent,
        summary: selectedTool === 'chat.generate'
          ? 'Answer the user through the central JARVIS tool registry.'
          : `Route the request to the ${selectedTool} capability through the central JARVIS tool registry.`,
        steps: [{
          id: `step_${selectedTool.replace(/[^a-z0-9]+/gi, '_')}`,
          tool: selectedTool,
          purpose: selectedTool === 'chat.generate' ? 'Generate the assistant response.' : 'Execute the requested JARVIS capability.',
          input: selectedTool === 'chat.generate'
            ? { messageCount: normalizedMessages.length }
            : { delegated: true },
          requiresApproval: false,
        }],
        requiresApproval: false,
      };

      const tool = registry.get(selectedTool);
      if (!tool) throw new Error(`JARVIS tool is not registered: ${selectedTool}`);
      const results = await executePlan(plan.steps.map(step => ({
        ...step,
        input: selectedTool === 'chat.generate' ? { messages: normalizedMessages } : toolInput,
        retries: 1,
      })), {
        user: { id: userId },
        memories,
        preferences,
      });

      const result = results[results.length - 1];
      const verified = results.every(item => item.verification?.ok);
      const responseData = result?.data;

      return {
        success: Boolean(verified && result?.success),
        requestId,
        response: verified && responseData?.text ? { text: responseData.text, metadata: { provider: responseData.provider, model: responseData.model } } : undefined,
        capability: verified && responseData && !responseData.text ? responseData : undefined,
        execution: { plan, results, verified },
        error: verified ? undefined : result?.error || { code: 'EXECUTION_VERIFICATION_FAILED', message: 'JARVIS could not verify the execution result.' },
      };
    },
  };
}
