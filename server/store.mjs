const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const configured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const memory = {
  oauth: new Map(),
  youtube: null,
  users: new Map(),
  conversations: new Map(),
};

export function persistenceMode() {
  return configured ? 'supabase' : 'memory';
}

async function request(pathname, options = {}) {
  if (!configured) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : null;
}

export async function saveOAuthState(state, redirectUri) {
  if (!configured) {
    memory.oauth.set(state, { redirectUri, createdAt: Date.now() });
    return;
  }
  await request('youtube_oauth_state', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ state, redirect_uri: redirectUri, created_at: new Date().toISOString() }),
  });
}

export async function getOAuthState(state) {
  if (!configured) return memory.oauth.get(state) || null;
  const rows = await request(`youtube_oauth_state?select=state,redirect_uri,created_at&state=eq.${encodeURIComponent(state)}&limit=1`);
  const row = rows?.[0];
  return row ? { redirectUri: row.redirect_uri, createdAt: new Date(row.created_at).getTime() } : null;
}

export async function deleteOAuthState(state) {
  if (!configured) {
    memory.oauth.delete(state);
    return;
  }
  await request(`youtube_oauth_state?state=eq.${encodeURIComponent(state)}`, { method: 'DELETE' });
}

export async function getYouTubeConnection() {
  if (!configured) return memory.youtube;
  const rows = await request('youtube_connection?select=*&id=eq.default&limit=1');
  return rows?.[0] || null;
}

export async function saveYouTubeConnection(connection) {
  if (!configured) {
    memory.youtube = connection;
    return;
  }
  await request('youtube_connection', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: 'default',
      channel_id: connection.channelId,
      channel_title: connection.channelTitle,
      refresh_token: connection.refreshToken,
      access_token: connection.accessToken,
      expires_at: new Date(connection.expiresAt).toISOString(),
      connected_at: connection.connectedAt,
    }),
  });
}


function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureJarvisUser(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) {
    if (!memory.users.has(userId)) memory.users.set(userId, { id: userId, name: 'Guest' });
    return memory.users.get(userId);
  }
  const existing = await request(`jarvis_users?select=id,name,preferences&id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (existing?.[0]) return existing[0];
  const rows = await request('jarvis_users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ id: userId, name: 'Guest', preferences: {} }),
  });
  return rows?.[0] || { id: userId, name: 'Guest', preferences: {} };
}

export async function getOrCreateConversation(userId) {
  if (!configured) {
    if (!memory.conversations.has(userId)) memory.conversations.set(userId, []);
    return { id: userId };
  }
  const rows = await request(`conversations?select=id,title&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1`);
  if (rows?.[0]) return rows[0];
  const created = await request('conversations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, title: 'JARVIS Conversation' }),
  });
  if (!created?.[0]) throw new Error('Could not create JARVIS conversation.');
  return created[0];
}

export async function appendConversationMessages(userId, messages) {
  const conversation = await getOrCreateConversation(userId);
  const normalized = messages
    .filter(m => ['user', 'assistant', 'system'].includes(String(m?.role)) && String(m?.content || '').trim())
    .map(m => ({
      conversation_id: conversation.id,
      role: String(m.role),
      content: String(m.content).trim(),
    }));
  if (!normalized.length) return;
  if (!configured) {
    const current = memory.conversations.get(userId) || [];
    current.push(...normalized.map(m => ({ role: m.role, content: m.content, created_at: new Date().toISOString() })));
    memory.conversations.set(userId, current.slice(-200));
    return;
  }
  await request('conversation_messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(normalized),
  });
  await request(`conversations?id=eq.${encodeURIComponent(conversation.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
}

export async function getConversationMessages(userId, limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const conversation = await getOrCreateConversation(userId);
  if (!configured) {
    return (memory.conversations.get(userId) || []).slice(-safeLimit).map(m => ({
      role: m.role,
      content: m.content,
    }));
  }
  const rows = await request(
    `conversation_messages?select=role,content,created_at&conversation_id=eq.${encodeURIComponent(conversation.id)}&order=created_at.asc&limit=${safeLimit}`
  );
  return (rows || []).map(m => ({ role: m.role, content: m.content }));
}


const EMBEDDING_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/jarvis-embed` : '';

export async function generateJarvisEmbedding(input) {
  const text = String(input || '').trim();
  if (!configured || !EMBEDDING_FUNCTION_URL || !text) return null;
  const response = await fetch(EMBEDDING_FUNCTION_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text.slice(0, 8000) }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Embedding service failed (${response.status}): ${body.slice(0, 500)}`);
  }
  const data = body ? JSON.parse(body) : null;
  return Array.isArray(data?.embedding) && data.embedding.length === 384 ? data.embedding : null;
}

export async function searchSemanticMemories(userId, input, options = {}) {
  if (!configured || !validUuid(userId)) return [];
  const embedding = await generateJarvisEmbedding(input);
  if (!embedding) return [];
  const threshold = Number(options.threshold ?? 0.72);
  const count = Math.min(12, Math.max(1, Number(options.count) || 8));
  const memoryTypes = Array.isArray(options.memoryTypes) && options.memoryTypes.length
    ? options.memoryTypes.map(String)
    : null;
  return await rpc('match_jarvis_memories', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: count,
    filter_user_id: userId,
    filter_memory_types: memoryTypes,
  });
}

export async function saveSemanticMemory(userId, content, metadata = {}, memoryType = 'semantic') {
  if (!configured || !validUuid(userId)) return null;
  const text = String(content || '').trim();
  if (!text) return null;
  const embedding = await generateJarvisEmbedding(text);
  if (!embedding) return null;

  const rows = await rpc('upsert_jarvis_semantic_memory', {
    p_user_id: userId,
    p_content: text.slice(0, 8000),
    p_embedding: embedding,
    p_memory_type: memoryType,
    p_metadata: metadata,
    p_importance: Number(metadata.importance ?? 0.6),
    p_dedupe_threshold: 0.97,
  });
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase RPC failed (${response.status}): ${raw.slice(0, 500)}`);
  }
  return raw ? JSON.parse(raw) : [];
}
