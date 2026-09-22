import { router, json, error, secrets, ai, db } from '@appdeploy/sdk';

const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';
const HF_MODEL = 'openai/gpt-oss-120b:fastest';

function extractJson(text: string): unknown {
    const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try { return JSON.parse(cleaned); } catch {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
        throw new Error('The Story Director returned invalid JSON.');
    }
}

function normalizePlan(raw: any, input: { title: string; topic: string; duration: number; style: string; character: string; platform: string }) {
    const characters = Array.isArray(raw?.characters) ? raw.characters : [];
    const scenes = Array.isArray(raw?.scenes) ? raw.scenes : [];
    if (!characters.length || !scenes.length) throw new Error('The Story Director returned an incomplete project.');
    const ids = new Set<string>();
    const normalizedCharacters = characters.slice(0, 8).map((item: any, index: number) => {
        const name = String(item?.name || `Character ${index + 1}`).trim();
        if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) throw new Error('Character names must use English letters and punctuation only.');
        const id = String(item?.id || `char_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || index + 1}`);
        if (ids.has(id)) throw new Error('Character IDs must be unique.');
        ids.add(id);
        return { id, name, role: String(item?.role || 'supporting character'), appearance: String(item?.appearance || 'consistent original appearance'), personality: String(item?.personality || 'distinct personality'), voiceProfile: String(item?.voiceProfile || 'natural English voice') };
    });
    const characterIds = new Set(normalizedCharacters.map(item => item.id));
    const normalizedScenes = scenes.slice(0, 8).map((scene: any, index: number) => ({
        scene: index + 1,
        duration: Math.max(2, Math.round(Number(scene?.duration) || Math.max(2, input.duration / Math.max(1, scenes.length)))),
        narration: String(scene?.narration || ''),
        visualPrompt: String(scene?.visualPrompt || ''),
        actionDirection: String(scene?.actionDirection || 'Natural movement appropriate to the scene.'),
        cameraMotion: String(scene?.cameraMotion || 'Slow cinematic camera movement.'),
        audio: String(scene?.audio || 'Natural ambience and subtle original sound design.'),
        cast: Array.isArray(scene?.cast) ? scene.cast.filter((id: unknown) => characterIds.has(String(id))).map(String) : [],
        dialogue: Array.isArray(scene?.dialogue) ? scene.dialogue.map((line: any) => ({ characterId: String(line?.characterId || ''), characterName: String(line?.characterName || ''), line: String(line?.line || '') })).filter((line: any) => characterIds.has(line.characterId) && line.line) : [],
    }));
    return {
        title: String(raw?.title || input.title),
        hook: String(raw?.hook || input.topic),
        narration: String(raw?.narration || normalizedScenes.map(scene => scene.narration).join(' ')),
        characterBible: String(raw?.characterBible || normalizedCharacters.map(item => `${item.name}: ${item.appearance}; ${item.personality}.`).join(' ')),
        voiceDirection: String(raw?.voiceDirection || 'Each character keeps one consistent natural English voice across every scene.'),
        musicDirection: String(raw?.musicDirection || 'Original cinematic music matched to the scene mood.'),
        style: input.style,
        platform: input.platform,
        characters: normalizedCharacters,
        scenes: normalizedScenes,
        continuityRules: ['Keep character IDs permanent within this project.', 'Keep names, facial features, wardrobe, age, proportions and personality consistent.', 'Use English-only character names.', 'Keep each character voice identity consistent across scenes.', 'Do not invent missing cast members between scenes.'],
    };
}

const JARVIS_APP_URL = 'https://saviour-s-jarvis-1xvud3.v2.appdeploy.ai/';

const redirectToJarvis = (status: 'connected' | 'error', message?: string) => {
    const params = new URLSearchParams({ youtube: status });
    if (message) params.set('message', message.slice(0, 240));
    return {
        statusCode: 302,
        headers: { Location: `${JARVIS_APP_URL}?${params.toString()}` },
        body: '',
    };
};

export const handler = router({
    'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
    'GET /api/youtube/status': [async () => {
        const names = await secrets.listSecretNames();
        const configured = names.includes('GOOGLE_YOUTUBE_CLIENT_ID') && names.includes('GOOGLE_YOUTUBE_CLIENT_SECRET');
        const { items } = await db.list<{ channelId: string; channelTitle: string; connectedAt: string }>('youtube_connection', { limit: 1 });
        const connection = items[0];
        return json({ configured, connected: Boolean(connection), channel: connection ? { id: connection.channelId, title: connection.channelTitle, connectedAt: connection.connectedAt } : null });
    }],
    'GET /api/youtube/connect': [async () => {
        let clientId: string;
        try {
            clientId = await secrets.readSecret('GOOGLE_YOUTUBE_CLIENT_ID');
            await secrets.readSecret('GOOGLE_YOUTUBE_CLIENT_SECRET');
        } catch {
            return error('YouTube OAuth is not configured yet. Add GOOGLE_YOUTUBE_CLIENT_ID and GOOGLE_YOUTUBE_CLIENT_SECRET in AppDeploy secrets.', 503);
        }
        const state = crypto.randomUUID();
        const redirectUri = 'https://saviour-s-jarvis-1xvud3.v2.appdeploy.ai/api/youtube/callback';
        const [id] = await db.add('youtube_oauth_state', [{ state, redirectUri, createdAt: new Date().toISOString() }]);
        if (!id) return error('Could not start the YouTube authorization session.', 500);
        const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly', state });
        return json({ authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    }],
    'GET /api/youtube/callback': [async ({ query }) => {
        const code = String(query.code || '');
        const state = String(query.state || '');
        const oauthError = String(query.error || '');
        if (oauthError) return redirectToJarvis('error', `Google authorization was not completed: ${oauthError}.`);
        if (!code || !state) return redirectToJarvis('error', 'Missing YouTube OAuth code or state. Start the connection again.');
        const { items } = await db.list<{ state: string; redirectUri: string; createdAt: string }>('youtube_oauth_state', { limit: 20 });
        const pending = items.find(item => item.state === state);
        if (!pending) return redirectToJarvis('error', 'This YouTube authorization session is invalid or expired. Start the connection again.');
        const createdAt = Date.parse(pending.createdAt);
        if (!Number.isFinite(createdAt) || Date.now() - createdAt > 10 * 60 * 1000) return redirectToJarvis('error', 'This YouTube authorization session has expired. Start again from JARVIS.');
        let clientId: string;
        let clientSecret: string;
        try {
            clientId = await secrets.readSecret('GOOGLE_YOUTUBE_CLIENT_ID');
            clientSecret = await secrets.readSecret('GOOGLE_YOUTUBE_CLIENT_SECRET');
        } catch { return redirectToJarvis('error', 'YouTube OAuth credentials are not configured in AppDeploy.'); }
        try {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: pending.redirectUri, grant_type: 'authorization_code' }) });
            const tokenData = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
            if (!tokenResponse.ok || !tokenData.access_token) return redirectToJarvis('error', tokenData.error_description || tokenData.error || 'Google token exchange failed.');
            const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
            const channelData = await channelResponse.json() as any;
            const channel = channelData?.items?.[0];
            if (!channel?.id) return redirectToJarvis('error', 'Google authorization succeeded, but no YouTube channel was returned for this account.');
            const existing = await db.list<{ channelId: string; channelTitle: string; refreshToken?: string; accessToken?: string; expiresAt?: string; connectedAt: string }>('youtube_connection', { limit: 10 });
            const record = { channelId: String(channel.id), channelTitle: String(channel.snippet?.title || 'YouTube Channel'), refreshToken: String(tokenData.refresh_token || existing.items[0]?.refreshToken || ''), accessToken: String(tokenData.access_token), expiresAt: new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000).toISOString(), connectedAt: existing.items[0]?.connectedAt || new Date().toISOString() };
            if (existing.items[0]) await db.update('youtube_connection', [{ id: existing.items[0].id, record }]);
            else await db.add('youtube_connection', [record]);
            await db.delete('youtube_oauth_state', [pending.id]);
            return redirectToJarvis('connected', `YouTube connected: ${record.channelTitle}.`);
        } catch (requestError) {
            console.error('JARVIS YouTube OAuth callback error:', requestError);
            return redirectToJarvis('error', 'JARVIS could not finish the YouTube connection. Please try again.');
        }
    }],
    'POST /api/image/generate': [async ({ body }) => {
        const input = body as { prompt?: string; images?: Array<{ data?: string; mimeType?: string }> };
        const prompt = String(input.prompt || '').trim();
        if (!prompt) return error('An image prompt is required.', 400);
        if (prompt.length > 6000) return error('Image prompts are limited to 6,000 characters.', 400);
        const images = Array.isArray(input.images)
            ? input.images
                .filter(item => typeof item?.data === 'string' && item.data.length > 0 && typeof item?.mimeType === 'string' && item.mimeType.startsWith('image/'))
                .slice(0, 5)
                .map(item => ({ data: String(item.data), mimeType: String(item.mimeType) }))
            : [];
        try {
            const result = await ai.imageGen({ prompt, images, maxOutputBytes: 1000000 });
            if (!result?.image?.data || !result?.image?.mimeType) return error('The image service returned an empty image.', 502);
            return json({ image: result.image, provider: 'AppDeploy Gemini Image Generation' });
        } catch (requestError) {
            console.error('JARVIS Image Lab error:', requestError);
            return error('JARVIS Image Lab could not generate the image right now. Please try again.', 502);
        }
    }],
    'POST /api/chat': [async ({ body }) => {
        const input = body as { messages?: Array<{ role?: string; content?: string }> };
        const messages = Array.isArray(input.messages)
            ? input.messages
                .filter(message => ['user', 'assistant', 'system', 'model'].includes(String(message?.role)) && String(message?.content || '').trim())
                .slice(-16)
                .map(message => ({ role: message.role as 'user' | 'assistant' | 'system' | 'model', content: String(message.content).trim() }))
            : [];
        if (!messages.length) return error('A message is required.', 400);
        try {
            const result = await ai.generate({
                system: 'You are JARVIS, Saviour\'s helpful AI assistant. Be accurate, concise, friendly, and honest about capabilities. Do not claim an action happened unless the connected service confirms it. For security topics, stay defensive and educational. For NEXORA, keep trading simulated/paper-only.',
                messages,
                maxTokens: 1200,
                temperature: 0.7,
                thinkingMode: 'FAST',
            });
            const text = String(result.text || '').trim();
            if (!text) return error('The AI core returned an empty response.', 502);
            return json({ text, provider: 'AppDeploy AI' });
        } catch (requestError) {
            console.error('JARVIS AI core error:', requestError);
            return error('JARVIS AI core is temporarily unavailable. Please try again.', 502);
        }
    }],
    'GET /api/tts/status': [async () => {
        const names = await secrets.listSecretNames();
        return json({ configured: names.includes('GOOGLE_CLOUD_TTS_API_KEY'), provider: 'Google Cloud Text-to-Speech' });
    }],
    'POST /api/tts/synthesize': [async ({ body }) => {
        const input = body as { text?: string; voice?: string; languageCode?: string; speakingRate?: number; pitch?: number };
        const text = String(input.text || '').trim();
        const voice = String(input.voice || 'en-US-Chirp3-HD-Achird');
        const languageCode = String(input.languageCode || 'en-US');
        if (!text) return error('Text is required.', 400);
        if (text.length > 5000) return error('Text is limited to 5,000 characters per synthesis request.', 400);
        let apiKey: string;
        try { apiKey = await secrets.readSecret('GOOGLE_CLOUD_TTS_API_KEY'); } catch { return error('Google Cloud TTS is not configured yet. Add GOOGLE_CLOUD_TTS_API_KEY in AppDeploy secrets.', 503); }
        const response = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: { text }, voice: { languageCode, name: voice }, audioConfig: { audioEncoding: 'MP3', speakingRate: Math.min(1.25, Math.max(0.75, Number(input.speakingRate) || 0.96)), pitch: Math.min(6, Math.max(-6, Number(input.pitch) || 0)) } }),
        });
        const data = await response.json() as { audioContent?: string; error?: { message?: string } };
        if (!response.ok || !data.audioContent) return error(data.error?.message || `Google TTS request failed with status ${response.status}.`, response.status >= 400 && response.status < 500 ? 400 : 502);
        return json({ audioContent: data.audioContent, mimeType: 'audio/mpeg', voice, languageCode });
    }],
    'POST /api/video/plan': [async ({ body }) => {
        const input = body as { title?: string; topic?: string; duration?: number; style?: string; character?: string; platform?: string };
        const title = String(input.title || 'Untitled JARVIS Video').trim();
        const topic = String(input.topic || '').trim();
        const duration = Math.min(600, Math.max(15, Number(input.duration) || 60));
        const style = String(input.style || 'cinematic documentary').trim();
        const character = String(input.character || 'original English-named characters').trim();
        const platform = String(input.platform || 'YouTube 16:9').trim();
        if (!topic) return error('A video topic is required.', 400);
        let hfToken: string;
        try { hfToken = await secrets.readSecret('HUGGINGFACE_API_TOKEN'); } catch { return error('Hugging Face is not connected. Add the secure HUGGINGFACE_API_TOKEN in AppDeploy secrets.', 503); }
        const system = `You are JARVIS Story Director. Build original video production plans. Character names MUST be English-only and fictional unless the user explicitly asks for a documented real person. Every character gets a permanent unique id used unchanged across the entire project. Never change a character identity between scenes. Return ONLY valid JSON with keys title, hook, narration, characterBible, voiceDirection, musicDirection, characters, scenes. characters is an array of {id,name,role,appearance,personality,voiceProfile}. scenes is an array of {scene,duration,narration,visualPrompt,actionDirection,cameraMotion,audio,cast,dialogue}. dialogue is an array of {characterId,characterName,line}. Make scenes add up approximately to the requested runtime. Keep content original and production-ready. Do not claim that generated still images are real video.`;
        const user = JSON.stringify({ title, topic, requestedDurationSeconds: duration, style, characterBrief: character, platform, requirements: ['persistent character identities', 'English-only character names', 'distinct natural voice profiles', 'dialogue and action direction', 'dynamic camera direction', 'moving environment direction', 'music and sound effects direction', 'continuity checks'] });
        try {
            const response = await fetch(HF_CHAT_URL, { method: 'POST', headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: HF_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.65, max_tokens: 7000 }) });
            const data = await response.json() as any;
            if (!response.ok) return error(data?.error?.message || `Hugging Face request failed with status ${response.status}.`, response.status >= 400 && response.status < 500 ? 400 : 502);
            const text = String(data?.choices?.[0]?.message?.content || '').trim();
            if (!text) return error('Hugging Face returned no Story Director output.', 502);
            const plan = normalizePlan(extractJson(text), { title, topic, duration, style, character, platform });
            return json({ plan, provider: 'Hugging Face Inference Providers', model: HF_MODEL });
        } catch (requestError) {
            return error(requestError instanceof Error ? requestError.message : 'Hugging Face Story Director failed.', 502);
        }
    }],
});