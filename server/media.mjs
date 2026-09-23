import crypto from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const accountId = String(process.env.R2_ACCOUNT_ID || '').trim();
const endpoint = String(process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')).replace(/\/$/, '');
const bucket = String(process.env.R2_BUCKET_NAME || '').trim();
const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || '').trim();
const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
const publicBaseUrl = String(process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');

export function isR2Configured() {
  return Boolean(endpoint && bucket && accessKeyId && secretAccessKey);
}

function client() {
  if (!isR2Configured()) throw new Error('Cloudflare R2 is not configured.');
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
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
  if (!key) throw new Error('R2 object key is required.');
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: Object.fromEntries(Object.entries(metadata).map(([k, v]) => [safeSegment(k, 'meta'), String(v)])),
  });
  await client().send(command);
  return {
    key,
    bucket,
    contentType,
    url: publicBaseUrl ? `${publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}` : null,
  };
}

export function r2PublicUrl(key) {
  if (!publicBaseUrl || !key) return null;
  return `${publicBaseUrl}/${String(key).split('/').map(encodeURIComponent).join('/')}`;
}

export { bucket as r2Bucket };
