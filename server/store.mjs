const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const configured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const memory = {
  oauth: new Map(),
  youtube: null,
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
