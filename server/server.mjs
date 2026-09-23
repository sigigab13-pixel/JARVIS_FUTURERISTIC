import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {
  ensureJarvisUser,
  getConversationMessages,
  appendConversationMessages,
  saveOAuthState,
  getOAuthState,
  deleteOAuthState,
  getYouTubeConnection,
  saveYouTubeConnection,
  ensureJarvisAuthUser,
  searchSemanticMemories,
  saveSemanticMemory,
  getJarvisPreferences,
  updateJarvisPreferences,
  ensureJarvisEntitlement,
  getJarvisEntitlement,
  consumeImageGeneration,
  getBusinessForUser,
  createBusinessForUser,
  updateBusinessForUser,
  getBrandKitForUser,
  upsertBrandKitForUser,
  createVideoProjectForUser,
  getVideoProjectsForUser,
  getVideoProjectForUser,
  addVideoCharacterForUser,
  updateVideoCharacterForUser,
  getVideoCharactersForUser,
  addVideoSceneForUser,
  updateVideoSceneForUser,
  getVideoScenesForUser,
  queueVideoJobForUser,
} from './store.mjs';
import { enqueueJob, isRedisConfigured } from './queue.mjs';
import { createMediaKey, isR2Configured, putMedia } from './media.mjs';

const PORT = Number(process.env.PORT || 10000);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';
const HF_MODEL = process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';
const HF_IMAGE_MODEL = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
const HF_IMAGE_EDIT_MODEL = process.env.HF_IMAGE_EDIT_MODEL || 'black-forest-labs/FLUX.2-klein-9B';
const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const ELEVENLABS_VOICES_URL = 'https://api.elevenlabs.io/v2/voices';
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const ELEVENLABS_DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const YOUTUBE_CLIENT_ID = process.env.GOOGLE_YOUTUBE_CLIENT_ID || '';
const YOUTUBE_CLIENT_SECRET = process.env.GOOGLE_YOUTUBE_CLIENT_SECRET || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

async function generateHuggingFaceImage(prompt, model = HF_IMAGE_MODEL, inputImage = null) {
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || '';
  if (!token) throw Object.assign(new Error('Hugging Face image generation is not configured.'), { statusCode: 503 });
  const { InferenceClient } = await import('@huggingface/inference');
  const client = new InferenceClient(token);
  if (inputImage) {
    const binary = Buffer.from(String(inputImage.data || ''), 'base64');
    const blob = new Blob([binary], { type: String(inputImage.mimeType || 'image/jpeg') });
    return client.imageToImage({
      model,
      inputs: blob,
      prompt,
      provider: 'auto',
    });
  }
  return client.textToImage({ model, inputs: prompt, provider: 'auto' });
}

async function imageResponse(res, blob) {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return json(res, 200, {
    image: { data: buffer.toString('base64'), mimeType: blob.type || 'image/png' },
  });
}


function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || '');
  const pair = header.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
}

function getJarvisUserId(req) {
  const value = readCookie(req, 'jarvis_user_id');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : '';
}

function jarvisCookie(userId) {
  return `jarvis_user_id=${encodeURIComponent(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000; Secure`;
}

async function requireAuthenticatedJarvisUser(req) {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1]?.trim() || '';
  if (!accessToken) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 });

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseServerKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !supabaseServerKey) {
    throw Object.assign(new Error('Supabase authentication is not configured on this deployment.'), { statusCode: 503 });
  }

  const response = await fetch(supabaseUrl + '/auth/v1/user', {
    headers: { apikey: supabaseServerKey, Authorization: 'Bearer ' + accessToken },
  });
  const user = await response.json().catch(() => ({}));
  if (!response.ok || !user?.id) {
    throw Object.assign(new Error('Your JARVIS session is invalid or expired.'), { statusCode: 401 });
  }

  const jarvisUser = await ensureJarvisAuthUser(user);
  return { authUser: user, jarvisUser };
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 12_000_000) {
        req.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function classifyMemory(text) {
  const value = String(text || '').trim().toLowerCase();
  if (/\\b(call me|my name is|i am|i'm)\\b/.test(value)) return { type: 'identity', importance: 0.95 };
  if (/\\b(i prefer|i like|i love|my favorite|i dislike|i hate|i don't like)\\b/.test(value)) return { type: 'preference', importance: 0.85 };
  if (/\\b(my goal|i plan to|i want to become|i want to build|i'm building|i am building)\\b/.test(value)) return { type: 'goal', importance: 0.9 };
  if (/\\b(we decided|from now on|always|never|use .* instead|the architecture|the plan is)\\b/.test(value)) return { type: 'project_decision', importance: 0.9 };
  if (/\\b(remember|don't forget|do not forget|keep in mind)\\b/.test(value)) return { type: 'instruction', importance: 0.9 };
  return { type: 'chat_memory', importance: 0.7 };
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = decoded === '/' ? '/index.html' : decoded;
  const target = path.normalize(path.join(DIST, requested));
  return target.startsWith(DIST) ? target : null;
}

export async function handleApi(req, res, pathname, url) {
  if (req.method === 'GET' && pathname === '/api/_healthcheck') {
    return json(res, 200, { message: 'Success', service: 'JARVIS', deployment: 'vercel' });
  }

  if (req.method === 'GET' && pathname === '/api/business') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const business = await getBusinessForUser(jarvisUser.id);
    const brandKit = business ? await getBrandKitForUser(jarvisUser.id, business.id) : null;
    return json(res, 200, { business, brandKit });
  }

  if (req.method === 'POST' && pathname === '/api/business') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    const existing = await getBusinessForUser(jarvisUser.id);
    const business = existing
      ? await updateBusinessForUser(jarvisUser.id, existing.id, body)
      : await createBusinessForUser(jarvisUser.id, body);
    return json(res, 200, { business });
  }

  if (req.method === 'POST' && pathname === '/api/business/brand-kit') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    const business = await getBusinessForUser(jarvisUser.id);
    if (!business) return json(res, 400, { error: 'Create your business profile first.' });
    const brandKit = await upsertBrandKitForUser(jarvisUser.id, business.id, body);
    return json(res, 200, { brandKit });
  }

  if (pathname.startsWith('/api/video')) {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const entitlement = await ensureJarvisEntitlement(jarvisUser.id);
    const features = entitlement?.jarvis_plans?.features || {};
    if (features.advanced_video !== true) {
      return json(res, 403, { error: 'Video Engine requires a plan with advanced video access.', code: 'VIDEO_FEATURE_LOCKED' });
    }

    if (req.method === 'GET' && pathname === '/api/video/projects') {
      return json(res, 200, { projects: await getVideoProjectsForUser(jarvisUser.id) });
    }

    if (req.method === 'POST' && pathname === '/api/video/projects') {
      const body = await parseBody(req);
      const project = await createVideoProjectForUser(jarvisUser.id, body);
      return json(res, 201, { project });
    }

    const projectMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})$/i);
    if (req.method === 'GET' && projectMatch) {
      const project = await getVideoProjectForUser(jarvisUser.id, projectMatch[1]);
      if (!project) return json(res, 404, { error: 'Video project not found.' });
      return json(res, 200, { project });
    }

    const charactersMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/characters$/i);
    if (charactersMatch) {
      const projectId = charactersMatch[1];
      if (req.method === 'GET') return json(res, 200, { characters: await getVideoCharactersForUser(jarvisUser.id, projectId) });
      if (req.method === 'POST') {
        const body = await parseBody(req);
        return json(res, 201, { character: await addVideoCharacterForUser(jarvisUser.id, projectId, body) });
      }
    }

    const characterEditMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/characters\/([0-9a-f-]{36})$/i);
    if (req.method === 'PATCH' && characterEditMatch) {
      const body = await parseBody(req);
      return json(res, 200, { character: await updateVideoCharacterForUser(jarvisUser.id, characterEditMatch[1], characterEditMatch[2], body) });
    }

    const scenesMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/scenes$/i);
    if (scenesMatch) {
      const projectId = scenesMatch[1];
      if (req.method === 'GET') return json(res, 200, { scenes: await getVideoScenesForUser(jarvisUser.id, projectId) });
      if (req.method === 'POST') {
        const body = await parseBody(req);
        return json(res, 201, { scene: await addVideoSceneForUser(jarvisUser.id, projectId, body) });
      }
    }

    const sceneEditMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/scenes\/([0-9a-f-]{36})$/i);
    if (req.method === 'PATCH' && sceneEditMatch) {
      const body = await parseBody(req);
      return json(res, 200, { scene: await updateVideoSceneForUser(jarvisUser.id, sceneEditMatch[1], sceneEditMatch[2], body) });
    }

    const planMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/plan$/i);
    if (req.method === 'POST' && planMatch) {
      const projectId = planMatch[1];
      const project = await getVideoProjectForUser(jarvisUser.id, projectId);
      if (!project) return json(res, 404, { error: 'Video project not found.' });
      const [characters, scenes] = await Promise.all([
        getVideoCharactersForUser(jarvisUser.id, projectId),
        getVideoScenesForUser(jarvisUser.id, projectId),
      ]);
      const body = await parseBody(req);
      const job = await queueVideoJobForUser(jarvisUser.id, projectId, {
        operation: 'plan',
        format: project.format,
        title: project.title,
        story_bible: project.story_bible,
        characters,
        scenes,
        request: body,
      });
      let dispatch = { queued: false, provider: 'supabase' };
      if (isRedisConfigured()) {
        try {
          dispatch = { queued: true, provider: 'upstash_redis', message: await enqueueJob(job.id, job.type) };
        } catch (queueError) {
          console.error('JARVIS Redis dispatch error:', queueError);
          dispatch = { queued: false, provider: 'supabase', fallback: 'redis_unavailable' };
        }
      }
      return json(res, 202, {
        job,
        dispatch,
        pipeline: ['story_director','character_bible','world_asset_bible','scene_director','storyboard_cost_gate','visual_generation','motion','voice_audio','lip_sync','editing','subtitles','continuity_brand_qa','repair_recovery','render','final_qa','publish'],
      });
    }

    return json(res, 404, { error: 'Video Engine route not found.' });
  }

  if (req.method === 'GET' && pathname === '/api/plans') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const entitlement = await ensureJarvisEntitlement(jarvisUser.id);
    return json(res, 200, { entitlement });
  }

  if (req.method === 'GET' && pathname === '/api/tts/status') {
    return json(res, 200, {
      configured: Boolean(process.env.ELEVENLABS_API_KEY),
      provider: 'ElevenLabs',
      model: ELEVENLABS_MODEL,
    });
  }

  if (req.method === 'GET' && pathname === '/api/voice/settings') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const preferences = await getJarvisPreferences(jarvisUser.id);
    return json(res, 200, {
      voiceId: String(preferences?.voice_id || ELEVENLABS_DEFAULT_VOICE_ID || ''),
      voiceEnabled: preferences?.voice_enabled !== false,
    });
  }

  if (req.method === 'GET' && pathname === '/api/voices') {
    await requireAuthenticatedJarvisUser(req);
    const apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!apiKey) return json(res, 503, { error: 'ElevenLabs is not configured on this deployment.' });
    const response = await fetch(ELEVENLABS_VOICES_URL + '?page_size=50', {
      headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, response.status >= 400 && response.status < 500 ? 400 : 502, { error: data?.detail?.message || data?.detail || 'ElevenLabs voice list request failed.' });
    const voices = Array.isArray(data?.voices) ? data.voices : [];
    return json(res, 200, {
      voices: voices.map(voice => ({
        voiceId: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description || '',
        labels: voice.labels || {},
        previewUrl: voice.preview_url || null,
      })),
      nextPageToken: data?.next_page_token || null,
    });
  }

  if (req.method === 'POST' && pathname === '/api/voice/select') {
    const input = await parseBody(req);
    const voiceId = String(input.voiceId || '').trim();
    if (!voiceId || !/^[A-Za-z0-9_-]{8,128}$/.test(voiceId)) return json(res, 400, { error: 'A valid ElevenLabs voice ID is required.' });
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!apiKey) return json(res, 503, { error: 'ElevenLabs is not configured on this deployment.' });
    const response = await fetch('https://api.elevenlabs.io/v1/voices/' + encodeURIComponent(voiceId), {
      headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
    });
    const voice = await response.json().catch(() => ({}));
    if (!response.ok || !voice?.voice_id) return json(res, 400, { error: 'That voice is not available to this JARVIS account.' });
    const current = await getJarvisPreferences(jarvisUser.id);
    const preferences = await updateJarvisPreferences(jarvisUser.id, { ...current, voice_id: voiceId });
    return json(res, 200, { ok: true, voiceId: preferences.voice_id, voice: { voiceId: voice.voice_id, name: voice.name, previewUrl: voice.preview_url || null } });
  }

  if (req.method === 'POST' && pathname === '/api/tts/synthesize') {
    const input = await parseBody(req);
    const text = String(input.text || '').trim();
    if (!text) return json(res, 400, { error: 'Text is required.' });
    if (text.length > 5000) return json(res, 400, { error: 'Text is limited to 5,000 characters.' });
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!apiKey) return json(res, 503, { error: 'ElevenLabs is not configured on this deployment.' });
    const preferences = await getJarvisPreferences(jarvisUser.id);
    const voiceId = String(preferences?.voice_id || ELEVENLABS_DEFAULT_VOICE_ID || '').trim();
    if (!voiceId) return json(res, 503, { error: 'No ElevenLabs voice is configured for this JARVIS account.' });
    const response = await fetch(ELEVENLABS_TTS_URL + '/' + encodeURIComponent(voiceId) + '?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: 0.96 },
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return json(res, response.status >= 400 && response.status < 500 ? 400 : 502, { error: errorBody.slice(0, 500) || 'ElevenLabs TTS request failed.' });
    }
    const audio = Buffer.from(await response.arrayBuffer()).toString('base64');
    return json(res, 200, { audioContent: audio, mimeType: 'audio/mpeg', voiceId });
  }
  if (req.method === 'POST' && pathname === '/api/auth/sync') {
    const input = await parseBody(req);
    const accessToken = String(input.accessToken || '').trim();
    if (!accessToken) return json(res, 401, { error: 'Authentication token is required.' });
    const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseServerKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !supabaseServerKey) return json(res, 503, { error: 'Supabase authentication is not configured on this deployment.' });
    const response = await fetch(supabaseUrl + '/auth/v1/user', {
      headers: { apikey: supabaseServerKey, Authorization: 'Bearer ' + accessToken },
    });
    const user = await response.json().catch(() => ({}));
    if (!response.ok || !user?.id) return json(res, 401, { error: 'Your JARVIS session is invalid or expired.' });
    const jarvisUser = await ensureJarvisAuthUser(user);
    return json(res, 200, { ok: true, user: { id: jarvisUser.id, name: jarvisUser.name, email: jarvisUser.email || user.email || null } }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
  }

  if (req.method === 'GET' && pathname === '/api/chat/history') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const history = await getConversationMessages(jarvisUser.id, 100);
    return json(res, 200, { messages: history, persistent: true }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
  }

  if (req.method === 'POST' && pathname === '/api/chat') {
    const input = await parseBody(req);
    const messages = Array.isArray(input.messages)
      ? input.messages.filter(m => ['user', 'assistant', 'system', 'model'].includes(String(m?.role)) && String(m?.content || '').trim()).slice(-16)
      : [];
    if (!messages.length) return json(res, 400, { error: 'A message is required.' });
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const userId = jarvisUser.id;
    const token = process.env.HUGGINGFACE_API_TOKEN;
    if (!token) return json(res, 503, { error: 'Hugging Face AI is not configured on this deployment.' });

    const latestUserMessage = String(messages[messages.length - 1]?.content || '').trim();
    let semanticMemories = [];
    try {
      semanticMemories = await searchSemanticMemories(userId, latestUserMessage, {
        threshold: 0.72,
        count: 8,
      });
    } catch (memoryError) {
      console.error('Semantic memory retrieval error:', memoryError);
    }

    const memoryContext = semanticMemories.length
      ? `Relevant long-term memories for this user, ranked by relevance and importance:\n${semanticMemories.map((m, i) => `${i + 1}. [${String(m.memory_type || 'memory')}] ${String(m.content || '').trim()}`).join('\n')}\nUse only memories that genuinely help answer the current request. Prefer identity, preferences, goals, project decisions, and explicit instructions when relevant. Do not mention the memory system unless asked.`
      : '';

    const systemMessage = [
      "You are JARVIS, Saviour's helpful AI assistant. Be accurate, concise, friendly, and honest about capabilities. Do not claim an action happened unless the connected service confirms it. For security topics, stay defensive and educational. For NEXORA, keep trading simulated/paper-only.",
      memoryContext,
    ].filter(Boolean).join('\n\n');

    const response = await fetch(HF_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          ...messages,
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });
    const data = await response.json();
    if (!response.ok) return json(res, response.status >= 400 && response.status < 500 ? 400 : 502, { error: data?.error?.message || 'Hugging Face AI request failed.' });
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!text) return json(res, 502, { error: 'The AI core returned an empty response.' });
    const shouldRemember = /\b(remember|don't forget|do not forget|keep in mind|i prefer|i like|my favorite|i want|my goal|i plan to|i am building|i'm building|we decided|from now on|call me)\b/i.test(latestUserMessage)
      && latestUserMessage.length >= 12;

    if (shouldRemember) {
      try {
        await saveSemanticMemory(userId, latestUserMessage, {
          source: 'chat',
          importance: /\b(remember|don't forget|do not forget|from now on|call me)\b/i.test(latestUserMessage) ? 0.9 : 0.7,
        }, 'chat_memory');
      } catch (memoryError) {
        console.error('Semantic memory save error:', memoryError);
      }
    }

    await appendConversationMessages(userId, [
      { role: 'user', content: latestUserMessage },
      { role: 'assistant', content: text },
    ]);
    return json(
      res,
      200,
      { text, provider: 'Hugging Face Inference Providers', model: HF_MODEL, persistent: true },
      { 'Set-Cookie': jarvisCookie(userId) },
    );
  }

  if (req.method === 'GET' && pathname === '/api/youtube/status') {
    const connection = await getYouTubeConnection();
    return json(res, 200, {
      configured: Boolean(YOUTUBE_CLIENT_ID && YOUTUBE_CLIENT_SECRET && PUBLIC_URL),
      connected: Boolean(connection),
      channel: connection ? {
        id: connection.channel_id || connection.channelId,
        title: connection.channel_title || connection.channelTitle,
        connectedAt: connection.connected_at || connection.connectedAt,
      } : null,
    });
  }

  if (req.method === 'GET' && pathname === '/api/youtube/connect') {
    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !PUBLIC_URL) {
      return json(res, 503, { error: 'YouTube OAuth is not configured. Add GOOGLE_YOUTUBE_CLIENT_ID, GOOGLE_YOUTUBE_CLIENT_SECRET and PUBLIC_URL.' });
    }
    const state = crypto.randomUUID();
    const redirectUri = `${PUBLIC_URL}/api/youtube/callback`;
    await saveOAuthState(state, redirectUri);
    const params = new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
      state,
    });
    return json(res, 200, { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  }

  if (req.method === 'GET' && pathname === '/api/youtube/callback') {
    const state = String(url.searchParams.get('state') || '');
    const code = String(url.searchParams.get('code') || '');
    const errorMessage = String(url.searchParams.get('error') || '');
    if (errorMessage) return redirect(res, `/?youtube=error&message=${encodeURIComponent('Google authorization was not completed.')}`);
    const pending = await getOAuthState(state);
    if (!pending || !code || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      return redirect(res, '/?youtube=error&message=Authorization%20session%20expired');
    }
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: YOUTUBE_CLIENT_ID,
          client_secret: YOUTUBE_CLIENT_SECRET,
          redirect_uri: pending.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error_description || tokenData.error || 'Google token exchange failed.');
      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const channelData = await channelResponse.json();
      const channel = channelData?.items?.[0];
      if (!channel?.id) throw new Error('No YouTube channel was returned.');
      const youtubeConnection = {
        channelId: String(channel.id),
        channelTitle: String(channel.snippet?.title || 'YouTube Channel'),
        refreshToken: String(tokenData.refresh_token || ''),
        accessToken: String(tokenData.access_token),
        expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
        connectedAt: new Date().toISOString(),
      };
      await saveYouTubeConnection(youtubeConnection);
      await deleteOAuthState(state);
      return redirect(res, `/?youtube=connected&message=${encodeURIComponent(`YouTube connected: ${youtubeConnection.channelTitle}.`)}`);
    } catch (error) {
      console.error('YouTube OAuth callback error:', error);
      return redirect(res, `/?youtube=error&message=${encodeURIComponent(error instanceof Error ? error.message : 'YouTube connection failed.')}`);
    }
  }

  if (req.method === 'POST' && (pathname === '/api/image/generate' || pathname === '/api/image/edit')) {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    const prompt = String(body?.prompt || '').trim();
    if (!prompt) return json(res, 400, { error: 'An image prompt is required.' });
    const reference = body?.referenceImage && typeof body.referenceImage === 'object' ? body.referenceImage : null;
    if (pathname === '/api/image/edit' && !reference?.data) {
      return json(res, 400, { error: 'A reference image is required for image editing.' });
    }
    const entitlement = await getJarvisEntitlement(jarvisUser.id) || await ensureJarvisEntitlement(jarvisUser.id);
    const remainingBefore = Number(entitlement?.credits_remaining ?? 0);
    try {
      const blob = await generateHuggingFaceImage(prompt, pathname.endsWith('/edit') ? HF_IMAGE_EDIT_MODEL : HF_IMAGE_MODEL, pathname.endsWith('/edit') ? reference : null);
      const consumed = await consumeImageGeneration(jarvisUser.id, { prompt: prompt.slice(0, 500), mode: pathname.endsWith('/edit') ? 'edit' : 'generate' });
      const buffer = Buffer.from(await blob.arrayBuffer());
      const mimeType = blob.type || 'image/png';
      let media = null;
      if (isR2Configured()) {
        const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
        try {
          const key = createMediaKey({ userId: jarvisUser.id, kind: pathname.endsWith('/edit') ? 'image-edit' : 'image', extension });
          media = await putMedia({
            key,
            body: buffer,
            contentType: mimeType,
            metadata: { user_id: jarvisUser.id, source: pathname.endsWith('/edit') ? 'image_edit' : 'image_generate' },
          });
        } catch (storageError) {
          console.error('JARVIS R2 media upload error:', storageError);
        }
      }
      return json(res, 200, {
        image: { data: buffer.toString('base64'), mimeType },
        media,
        allowance: { remaining: Number(consumed?.credits_remaining ?? remainingBefore - 1) },
      }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    } catch (error) {
      console.error('JARVIS image generation error:', error);
      return json(res, 502, { error: error instanceof Error ? error.message : 'Image generation failed.' });
    }
  }

  return json(res, 404, { error: 'API route not found.' });
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname, url);

    const file = safePath(url.pathname);
    if (!file) return json(res, 403, { error: 'Forbidden' });
    fs.stat(file, (error, stat) => {
      if (!error && stat.isFile()) {
        res.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-cache' });
        fs.createReadStream(file).pipe(res);
        return;
      }
      const index = path.join(DIST, 'index.html');
      if (fs.existsSync(index)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        fs.createReadStream(index).pipe(res);
      } else {
        json(res, 404, { error: 'JARVIS build not found. Run npm run build first.' });
      }
    });
  } catch (error) {
    console.error('JARVIS server error:', error);
    if (!res.headersSent) json(res, 500, { error: 'Internal server error.' });
  }
});

if (process.env.VERCEL !== '1') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS listening on port ${PORT}`);
  });
}
