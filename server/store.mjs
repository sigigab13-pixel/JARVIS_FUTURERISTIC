const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_SERVER_KEY = SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);

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
      apikey: SUPABASE_SERVER_KEY,
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

export async function ensureJarvisAuthUser(authUser) {
  const authUserId = String(authUser?.id || '').trim();
  if (!validUuid(authUserId)) throw new Error('Invalid Supabase auth user id.');
  const email = String(authUser?.email || '').trim() || null;
  const metadata = authUser?.user_metadata || {};
  const name = String(metadata.full_name || metadata.name || email || 'JARVIS User').trim().slice(0, 200) || 'JARVIS User';
  if (!configured) {
    const id = crypto.randomUUID();
    memory.users.set(id, { id, name, email, auth_user_id: authUserId });
    return memory.users.get(id);
  }
  const existing = await request('jarvis_users?select=id,name,email,preferences,auth_user_id&auth_user_id=eq.' + encodeURIComponent(authUserId) + '&limit=1');
  if (existing?.[0]) {
    await request('jarvis_users?auth_user_id=eq.' + encodeURIComponent(authUserId), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ name, email, updated_at: new Date().toISOString() }),
    });
    return { ...existing[0], name, email };
  }
  const id = crypto.randomUUID();
  const rows = await request('jarvis_users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ id, name, email, auth_user_id: authUserId, preferences: {} }),
  });
  return rows?.[0] || { id, name, email, auth_user_id: authUserId, preferences: {} };
}

export async function getJarvisPreferences(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) return memory.users.get(userId)?.preferences || {};
  const rows = await request(`jarvis_users?select=preferences&id=eq.${encodeURIComponent(userId)}&limit=1`);
  return rows?.[0]?.preferences || {};
}

export async function updateJarvisPreferences(userId, preferences) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const safePreferences = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
  if (!configured) {
    const user = memory.users.get(userId) || { id: userId, name: 'Guest' };
    user.preferences = safePreferences;
    memory.users.set(userId, user);
    return safePreferences;
  }
  await request(`jarvis_users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ preferences: safePreferences, updated_at: new Date().toISOString() }),
  });
  return safePreferences;
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
      apikey: SUPABASE_SERVER_KEY,
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
      apikey: SUPABASE_SERVER_KEY,
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


export async function getActivePlan(code = 'free') {
  if (!configured) return { code, name: 'JARVIS Free', monthly_image_generations: 10 };
  const rows = await request(
    'jarvis_plans?select=*&code=eq.' + encodeURIComponent(code) + '&active=eq.true&limit=1'
  );
  return rows?.[0] || null;
}

export async function ensureJarvisEntitlement(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) {
    return { user_id: userId, plan_code: 'free', status: 'active', credits_remaining: 10 };
  }

  const existing = await request(
    'jarvis_entitlements?select=*,jarvis_plans(code,name,monthly_image_generations,features)&user_id=eq.' +
    encodeURIComponent(userId) + '&limit=1'
  );
  if (existing?.[0]) return existing[0];

  const plan = await getActivePlan('free');
  if (!plan?.id) throw new Error('JARVIS Free plan is not configured.');

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const rows = await request('jarvis_entitlements', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      plan_id: plan.id,
      status: 'active',
      credits_remaining: Number(plan.monthly_image_generations || 0),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    }),
  });
  return rows?.[0] || null;
}

export async function getJarvisEntitlement(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) return { user_id: userId, plan_code: 'free', status: 'active', credits_remaining: 10 };
  const rows = await request(
    'jarvis_entitlements?select=*,jarvis_plans(code,name,monthly_image_generations,features)&user_id=eq.' +
    encodeURIComponent(userId) + '&limit=1'
  );
  return rows?.[0] || null;
}

export async function consumeImageGeneration(userId, metadata = {}) {
  const entitlement = await ensureJarvisEntitlement(userId);
  const plan = entitlement?.jarvis_plans || {};
  const limit = Number(plan.monthly_image_generations || 0);
  const remaining = Number(entitlement?.credits_remaining ?? 0);
  if (remaining <= 0) {
    throw Object.assign(new Error('Your image-generation allowance is used up for this billing period.'), {
      statusCode: 402,
      code: 'IMAGE_ALLOWANCE_EXHAUSTED',
    });
  }

  if (!configured) {
    return { ...entitlement, credits_remaining: remaining - 1 };
  }

  const nextRemaining = remaining - 1;
  await request(
    'jarvis_entitlements?user_id=eq.' + encodeURIComponent(userId),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        credits_remaining: nextRemaining,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  await request('jarvis_usage_ledger', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      operation: 'image_generation',
      units: 1,
      credits_charged: 1,
      metadata,
    }),
  });

  return { ...entitlement, credits_remaining: nextRemaining };
}


export async function getBusinessForUser(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) return null;
  const rows = await request('jarvis_businesses?select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=created_at.asc&limit=1');
  return rows?.[0] || null;
}

export async function createBusinessForUser(userId, data = {}) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const business = {
    user_id: userId,
    name: String(data.name || 'My Business').trim().slice(0, 200),
    description: String(data.description || '').trim().slice(0, 2000) || null,
    industry: String(data.industry || '').trim().slice(0, 200) || null,
    website: String(data.website || '').trim().slice(0, 500) || null,
  };
  if (!configured) return { id: crypto.randomUUID(), ...business };
  const rows = await request('jarvis_businesses', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(business),
  });
  return rows?.[0] || null;
}

export async function updateBusinessForUser(userId, businessId, data = {}) {
  if (!validUuid(userId) || !validUuid(businessId)) throw new Error('Invalid business identity.');
  if (!configured) return { id: businessId, ...data };
  const payload = {};
  for (const key of ['name','description','industry','website','status']) {
    if (data[key] !== undefined) payload[key] = String(data[key] || '').trim().slice(0, 2000);
  }
  payload.updated_at = new Date().toISOString();
  const rows = await request('jarvis_businesses?id=eq.' + encodeURIComponent(businessId) + '&user_id=eq.' + encodeURIComponent(userId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

export async function getBrandKitForUser(userId, businessId) {
  if (!validUuid(userId) || !validUuid(businessId)) throw new Error('Invalid business identity.');
  if (!configured) return null;
  const rows = await request('jarvis_brand_kits?select=*&business_id=eq.' + encodeURIComponent(businessId) + '&limit=1');
  return rows?.[0] || null;
}

export async function upsertBrandKitForUser(userId, businessId, data = {}) {
  if (!validUuid(userId) || !validUuid(businessId)) throw new Error('Invalid business identity.');
  if (!configured) return { business_id: businessId, ...data };
  const payload = {
    business_id: businessId,
    logo_url: String(data.logo_url || '').trim().slice(0, 1000) || null,
    colors: data.colors && typeof data.colors === 'object' ? data.colors : {},
    fonts: data.fonts && typeof data.fonts === 'object' ? data.fonts : {},
    visual_style: String(data.visual_style || '').trim().slice(0, 500) || null,
    brand_voice: String(data.brand_voice || '').trim().slice(0, 1000) || null,
    business_description: String(data.business_description || '').trim().slice(0, 2000) || null,
    products_services: Array.isArray(data.products_services) ? data.products_services : [],
    social_handles: data.social_handles && typeof data.social_handles === 'object' ? data.social_handles : {},
    image_style: String(data.image_style || '').trim().slice(0, 500) || null,
    video_style: String(data.video_style || '').trim().slice(0, 500) || null,
    intro_outro: data.intro_outro && typeof data.intro_outro === 'object' ? data.intro_outro : {},
    character_bible: data.character_bible && typeof data.character_bible === 'object' ? data.character_bible : {},
    updated_at: new Date().toISOString(),
  };
  const rows = await request('jarvis_brand_kits?business_id=eq.' + encodeURIComponent(businessId), {
    method: 'GET',
  });
  if (rows?.[0]?.id) {
    const updated = await request('jarvis_brand_kits?id=eq.' + encodeURIComponent(rows[0].id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    return updated?.[0] || null;
  }
  const created = await request('jarvis_brand_kits', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return created?.[0] || null;
}


export async function createVideoProjectForUser(userId, data = {}) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const project = {
    user_id: userId,
    business_id: validUuid(data.business_id) ? data.business_id : null,
    title: String(data.title || 'Untitled JARVIS Video').trim().slice(0, 200),
    description: String(data.description || '').trim().slice(0, 4000) || null,
    format: ['16:9', '9:16', '1:1'].includes(String(data.format)) ? String(data.format) : '16:9',
    status: 'draft',
    story_bible: data.story_bible && typeof data.story_bible === 'object' ? data.story_bible : {},
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
  };
  if (!configured) return { id: crypto.randomUUID(), ...project };
  const rows = await request('jarvis_video_projects', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(project),
  });
  return rows?.[0] || null;
}

export async function getVideoProjectsForUser(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) return [];
  return await request('jarvis_video_projects?select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=updated_at.desc&limit=50');
}

export async function getVideoProjectForUser(userId, projectId) {
  if (!validUuid(userId) || !validUuid(projectId)) throw new Error('Invalid video project identity.');
  if (!configured) return null;
  const rows = await request('jarvis_video_projects?select=*&id=eq.' + encodeURIComponent(projectId) + '&user_id=eq.' + encodeURIComponent(userId) + '&limit=1');
  return rows?.[0] || null;
}

export async function addVideoCharacterForUser(userId, projectId, data = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  const character = {
    project_id: projectId,
    name: String(data.name || 'Unnamed Character').trim().slice(0, 200),
    role: String(data.role || '').trim().slice(0, 200) || null,
    profile: data.profile && typeof data.profile === 'object' ? data.profile : {},
    appearance: data.appearance && typeof data.appearance === 'object' ? data.appearance : {},
    voice: data.voice && typeof data.voice === 'object' ? data.voice : {},
    wardrobe: data.wardrobe && typeof data.wardrobe === 'object' ? data.wardrobe : {},
    relationships: data.relationships && typeof data.relationships === 'object' ? data.relationships : {},
    reference_assets: Array.isArray(data.reference_assets) ? data.reference_assets : [],
    continuity_rules: data.continuity_rules && typeof data.continuity_rules === 'object' ? data.continuity_rules : {},
  };
  if (!configured) return { id: crypto.randomUUID(), ...character };
  const rows = await request('jarvis_video_characters', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(character),
  });
  return rows?.[0] || null;
}

export async function updateVideoCharacterForUser(userId, projectId, characterId, data = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  if (!validUuid(characterId)) throw new Error('Invalid character identity.');
  if (!configured) return { id: characterId, project_id: projectId, ...data };
  const payload = {};
  for (const key of ['name','role']) {
    if (data[key] !== undefined) payload[key] = String(data[key] || '').trim().slice(0, 200) || null;
  }
  for (const key of ['profile','appearance','voice','wardrobe','relationships','continuity_rules']) {
    if (data[key] !== undefined) payload[key] = data[key] && typeof data[key] === 'object' ? data[key] : {};
  }
  if (data.reference_assets !== undefined) payload.reference_assets = Array.isArray(data.reference_assets) ? data.reference_assets : [];
  payload.version = 'version + 1';
  payload.updated_at = new Date().toISOString();
  const rows = await request('jarvis_video_characters?id=eq.' + encodeURIComponent(characterId) + '&project_id=eq.' + encodeURIComponent(projectId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

export async function getVideoCharactersForUser(userId, projectId) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  if (!configured) return [];
  return await request('jarvis_video_characters?select=*&project_id=eq.' + encodeURIComponent(projectId) + '&order=created_at.asc');
}

export async function addVideoSceneForUser(userId, projectId, data = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  const scene = {
    project_id: projectId,
    scene_number: Math.max(1, Number(data.scene_number) || 1),
    title: String(data.title || '').trim().slice(0, 200) || null,
    script: String(data.script || '').trim().slice(0, 12000) || null,
    dialogue: Array.isArray(data.dialogue) ? data.dialogue : [],
    characters: Array.isArray(data.characters) ? data.characters : [],
    visual_plan: data.visual_plan && typeof data.visual_plan === 'object' ? data.visual_plan : {},
    camera_plan: data.camera_plan && typeof data.camera_plan === 'object' ? data.camera_plan : {},
    audio_plan: data.audio_plan && typeof data.audio_plan === 'object' ? data.audio_plan : {},
    lip_sync_plan: data.lip_sync_plan && typeof data.lip_sync_plan === 'object' ? data.lip_sync_plan : {},
    continuity_notes: data.continuity_notes && typeof data.continuity_notes === 'object' ? data.continuity_notes : {},
  };
  if (!configured) return { id: crypto.randomUUID(), ...scene };
  const rows = await request('jarvis_video_scenes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(scene),
  });
  return rows?.[0] || null;
}

export async function updateVideoSceneForUser(userId, projectId, sceneId, data = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  if (!validUuid(sceneId)) throw new Error('Invalid scene identity.');
  if (!configured) return { id: sceneId, project_id: projectId, ...data };
  const payload = {};
  if (data.scene_number !== undefined) payload.scene_number = Math.max(1, Number(data.scene_number) || 1);
  if (data.title !== undefined) payload.title = String(data.title || '').trim().slice(0, 200) || null;
  if (data.script !== undefined) payload.script = String(data.script || '').trim().slice(0, 12000) || null;
  for (const key of ['dialogue','characters']) if (data[key] !== undefined) payload[key] = Array.isArray(data[key]) ? data[key] : [];
  for (const key of ['visual_plan','camera_plan','audio_plan','lip_sync_plan','continuity_notes']) {
    if (data[key] !== undefined) payload[key] = data[key] && typeof data[key] === 'object' ? data[key] : {};
  }
  payload.version = Number(data.version || 1) + 1;
  payload.updated_at = new Date().toISOString();
  const rows = await request('jarvis_video_scenes?id=eq.' + encodeURIComponent(sceneId) + '&project_id=eq.' + encodeURIComponent(projectId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

export async function getVideoScenesForUser(userId, projectId) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  if (!configured) return [];
  return await request('jarvis_video_scenes?select=*&project_id=eq.' + encodeURIComponent(projectId) + '&order=scene_number.asc,version.asc');
}

export async function queueVideoJobForUser(userId, projectId, payload = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  const jobPayload = { project_id: projectId, pipeline: 'jarvis_video_engine', ...payload };
  if (!configured) return { id: crypto.randomUUID(), user_id: userId, type: 'video_pipeline', status: 'queued', payload: jobPayload };
  const rows = await request('jobs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      type: 'video_pipeline',
      status: 'queued',
      priority: Number(payload.priority || 5),
      payload: jobPayload,
      attempts: 0,
      max_attempts: 3,
      scheduled_at: new Date().toISOString(),
    }),
  });
  return rows?.[0] || null;
}
