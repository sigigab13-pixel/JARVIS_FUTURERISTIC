import crypto from 'node:crypto';

const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const bucket = String(process.env.SUPABASE_MEDIA_BUCKET || 'jarvis-media').trim();

export function isSupabaseStorageConfigured() {
  return Boolean(supabaseUrl && supabaseKey && bucket);
}

function safeSegment(value, fallback = 'unknown') {
  const clean = String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || fallback;
}

export function createMediaKey({ userId, kind = 'media', extension = 'bin', id }) {
  const date = new Date().toISOString().slice(0, 10);
  return `jarvis/${safeSegment(userId)}/${safeSegment(kind)}/${date}/${safeSegment(id || crypto.randomUUID())}.${safeSegment(extension, 'bin')}`;
}

export async function putMedia({ key, body, contentType = 'application/octet-stream', metadata = {} }) {
  if (!isSupabaseStorageConfigured()) throw new Error('Supabase Storage is not configured.');
  if (!key) throw new Error('Media object key is required.');
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
      'cache-control': '31536000',
      ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`x-${safeSegment(k, 'meta')}`, String(v)])),
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Supabase Storage upload failed (${response.status}): ${String(data?.message || data?.error || 'unknown error').slice(0, 500)}`);
  return { key, bucket, contentType, path: key, stored: true };
}

export { bucket as supabaseMediaBucket };