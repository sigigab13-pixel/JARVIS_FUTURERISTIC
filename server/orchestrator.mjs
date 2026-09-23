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
}) {
  if (!userId) throw new Error('JARVIS orchestrator requires a user id.');
  if (!hfToken) throw Object.assign(new Error('Hugging Face AI is not configured on this deployment.'), { statusCode: 503 });

  const registry = new JarvisToolRegistry();

  registry.register({
    name: 'chat.generate',
    description: 'Generate a JARVIS response through the configured AI provider.',
    version: '1.0.0',
    capabilities: ['chat', 'reasoning'],
    requiresAuth: false,
    requiresApproval: false,
    inputSchema: { type: 'object', required: ['messages'] },
    outputSchema: { type: 'object', required: ['text'] },
    execute: async (input, context) => {
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
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: systemMessage }, ...input.messages],
            max_tokens: 1200,
            temperature: 0.7,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error?.message || 'Hugging Face AI request failed.');
        }

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

  return {
    registry,

    async run({ message, messages = [] } = {}) {
      const latestMessage = String(message || messages[messages.length - 1]?.content || '').trim();
      if (!latestMessage) throw Object.assign(new Error('A message is required.'), { statusCode: 400 });

      const normalizedMessages = (messages.length ? messages : [{ role: 'user', content: latestMessage }])
        .filter(item => ['user', 'assistant', 'system', 'model'].includes(String(item?.role)) && String(item?.content || '').trim())
        .slice(-16)
        .map(item => ({ role: item.role, content: String(item.content).trim() }));

      const requestId = crypto.randomUUID();
      const plan = {
        intent: 'conversation',
        summary: 'Answer the user through the central JARVIS tool registry.',
        steps: [{
          id: 'step_chat_generate',
          tool: 'chat.generate',
          purpose: 'Generate the assistant response.',
          input: { messageCount: normalizedMessages.length },
          requiresApproval: false,
        }],
        requiresApproval: false,
      };

      const tool = registry.get('chat.generate');
      const result = await tool.execute({ messages: normalizedMessages }, {
        user: { id: userId },
        memories,
        preferences,
      });

      return {
        success: result.success,
        requestId,
        response: result.success ? { text: result.data.text, metadata: { provider: result.data.provider, model: result.data.model } } : undefined,
        execution: { plan, results: [result] },
        error: result.error,
      };
    },
  };
}
