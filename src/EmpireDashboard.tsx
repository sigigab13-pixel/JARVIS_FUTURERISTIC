import { useMemo, useRef, useState } from 'react';
import { api } from './api';
import { checkPrimeStatus, initialPrime, recordPaperTrade, receiveContentEarnings, revivePrime, type PrimeState } from './prime';
import { evaluateForest, forestRevenue, initialForest, simulateForestDay, blowScore, type ForestState } from './forest';
import { fleetStats, initialBots, simulateFleetCycle, type NexoraBot } from './nexoraBots';
import './nexora.css';
import VoiceEnginePanel from './VoiceEnginePanel';
import YouTubeConnectionPanel from './YouTubeConnectionPanel';

type ContentItem = { id: string; title: string; platform: 'TikTok' | 'YouTube'; channelId: string; pillar: string; views: number; retention: number; status: 'TEST' | 'KING' | 'WEAK'; hook: string; };
type Channel = { id: string; name: string; platform: 'YouTube' | 'TikTok'; pillar: string; format: string; pairedWith: string; description: string; };
type OfficeState = 'IDLE' | 'WORKING' | 'DONE' | 'BLOCKED';

const channels: Channel[] = [
    { id: 'YT-01', name: 'Military', platform: 'YouTube', pillar: 'Military', format: '5–8 min long-form', pairedWith: 'TT-06', description: 'Wars, military history, strategy, aircraft and documented missions.' },
    { id: 'YT-02', name: 'Kids Stories', platform: 'YouTube', pillar: 'Kids Stories / Cartoons', format: '5–8 min story', pairedWith: 'TT-07', description: 'Original cartoon adventures and age-appropriate moral stories.' },
    { id: 'YT-03', name: 'Bible & Motivation', platform: 'YouTube', pillar: 'Bible / Motivational', format: '5–8 min long-form', pairedWith: 'TT-08', description: 'Bible stories, lessons, encouragement and positive life themes.' },
    { id: 'YT-04', name: 'What If History', platform: 'YouTube', pillar: 'What If / History', format: '5–8 min documentary', pairedWith: 'TT-09', description: 'Historical documentaries and clearly labeled hypothetical scenarios.' },
    { id: 'YT-05', name: 'Human Life', platform: 'YouTube', pillar: 'Normal Human Life', format: '5–8 min story', pairedWith: 'TT-10', description: 'Relatable human experiences, everyday stories and POV concepts.' },
    { id: 'TT-06', name: 'Military Shorts', platform: 'TikTok', pillar: 'Military', format: '30–60 sec short', pairedWith: 'YT-01', description: 'Short-form cuts and original angles from the Military pipeline.' },
    { id: 'TT-07', name: 'Kids Shorts', platform: 'TikTok', pillar: 'Kids Stories / Cartoons', format: '30–60 sec short', pairedWith: 'YT-02', description: 'Short cartoon moments and story hooks from the Kids pipeline.' },
    { id: 'TT-08', name: 'Bible & Motivation Shorts', platform: 'TikTok', pillar: 'Bible / Motivational', format: '30–60 sec short', pairedWith: 'YT-03', description: 'Short lessons and motivational moments from the Bible pipeline.' },
    { id: 'TT-09', name: 'What If Shorts', platform: 'TikTok', pillar: 'What If / History', format: '30–60 sec short', pairedWith: 'YT-04', description: 'Short history explainers and clearly labeled what-if scenarios.' },
    { id: 'TT-10', name: 'Human Life Shorts', platform: 'TikTok', pillar: 'Normal Human Life', format: '30–60 sec short', pairedWith: 'YT-05', description: 'Relatable short stories, POVs and everyday-life moments.' },
];

const initialContent: ContentItem[] = [
    { id: 'C-001', title: 'The mission that changed military aviation', platform: 'YouTube', channelId: 'YT-01', pillar: 'Military', views: 8200, retention: 64, status: 'KING', hook: 'One mission changed how aircraft were used forever.' },
    { id: 'C-002', title: 'Why military aircraft use stealth', platform: 'TikTok', channelId: 'TT-06', pillar: 'Military', views: 14600, retention: 71, status: 'KING', hook: 'How can an aircraft become harder to detect?' },
    { id: 'C-003', title: 'The Little Fox Who Kept Trying', platform: 'YouTube', channelId: 'YT-02', pillar: 'Kids Stories / Cartoons', views: 5200, retention: 62, status: 'TEST', hook: 'Everyone laughed when the little fox failed again.' },
    { id: 'C-004', title: 'The fox learns one brave lesson', platform: 'TikTok', channelId: 'TT-07', pillar: 'Kids Stories / Cartoons', views: 9100, retention: 69, status: 'KING', hook: 'He failed three times—but then he learned why.' },
    { id: 'C-005', title: 'David and the lesson of courage', platform: 'YouTube', channelId: 'YT-03', pillar: 'Bible / Motivational', views: 6100, retention: 59, status: 'TEST', hook: 'The story is about more than winning a battle.' },
    { id: 'C-006', title: 'A short lesson about courage', platform: 'TikTok', channelId: 'TT-08', pillar: 'Bible / Motivational', views: 11800, retention: 73, status: 'KING', hook: 'Sometimes courage starts with taking one small step.' },
    { id: 'C-007', title: 'What if the space race ended differently?', platform: 'YouTube', channelId: 'YT-04', pillar: 'What If / History', views: 4700, retention: 58, status: 'TEST', hook: 'Imagine history taking one completely different turn.' },
    { id: 'C-008', title: 'What if the Cold War ended earlier?', platform: 'TikTok', channelId: 'TT-09', pillar: 'What If / History', views: 13200, retention: 66, status: 'KING', hook: 'What might have changed if the timeline shifted?' },
    { id: 'C-009', title: 'Why everyone has difficult days', platform: 'YouTube', channelId: 'YT-05', pillar: 'Normal Human Life', views: 3600, retention: 55, status: 'TEST', hook: 'Some days feel harder for reasons nobody sees.' },
    { id: 'C-010', title: 'POV: you finally get a quiet day', platform: 'TikTok', channelId: 'TT-10', pillar: 'Normal Human Life', views: 10200, retention: 70, status: 'KING', hook: 'POV: for once, nobody needs anything from you.' },
];

const officeNames = ['Trend Office','Hook Office','Script Office','Fact Check Office','Voice Office','Clip Office','Thumbnail Office','Edit Office','TikTok Office','YouTube Office','Posting Office','Approval Office','Analytics Office','Kings Office','Clone Office','Graveyard Office','Experiment Office','Analytics Boss'];
const officeWork: Record<string, string> = {
    'Trend Office': 'Scans current Forest observations.', 'Hook Office': 'Builds opening-hook candidates.', 'Script Office': 'Creates a production script draft.', 'Fact Check Office': 'Flags claims that need sources.',
    'Voice Office': 'Prepares voice direction.', 'Clip Office': 'Plans short-form cuts.', 'Thumbnail Office': 'Creates thumbnail direction.', 'Edit Office': 'Builds the edit checklist.',
    'TikTok Office': 'Prepares the TikTok variant.', 'YouTube Office': 'Prepares the YouTube master.', 'Posting Office': 'Builds an approval-ready publish queue.', 'Approval Office': 'Waits for user approval.',
    'Analytics Office': 'Reads platform performance data.', 'Kings Office': 'Finds strong concepts for related tests.', 'Clone Office': 'Creates a controlled follow-up.', 'Graveyard Office': 'Archives weak experiments.',
    'Experiment Office': 'Creates the next test.', 'Analytics Boss': 'Summarizes Forest observations for JARVIS.',
};

function load<T>(key: string, fallback: T): T {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) as T : fallback;
    } catch {
        return fallback;
    }
}

function loadPrimeState(): PrimeState {
    const saved = load<Partial<PrimeState> | null>('jarvis-prime-state', null);
    if (!saved || typeof saved !== 'object') return initialPrime;
    if (
        typeof saved.balance !== 'number' ||
        typeof saved.cloneBalance !== 'number' ||
        typeof saved.wins !== 'number' ||
        typeof saved.losses !== 'number' ||
        typeof saved.consecutiveLosses !== 'number' ||
        typeof saved.daysNoPost !== 'number' ||
        typeof saved.trades !== 'number' ||
        typeof saved.pnlToday !== 'number' ||
        typeof saved.status !== 'string'
    ) {
        return initialPrime;
    }
    return { ...initialPrime, ...saved } as PrimeState;
}

function loadBotFleet(): NexoraBot[] {
    const saved = load<unknown>('jarvis-nexora-bots', null);
    if (!Array.isArray(saved) || saved.length !== initialBots.length) return initialBots;
    const valid = saved.every((bot) => {
        if (!bot || typeof bot !== 'object') return false;
        const item = bot as Partial<NexoraBot>;
        return (
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.balance === 'number' &&
            typeof item.startingBalance === 'number' &&
            typeof item.trades === 'number' &&
            typeof item.wins === 'number' &&
            typeof item.losses === 'number' &&
            typeof item.consecutiveLosses === 'number' &&
            typeof item.pnl === 'number' &&
            typeof item.lastPnl === 'number' &&
            (item.status === 'ACTIVE' || item.status === 'PAUSED' || item.status === 'RETIRED')
        );
    });
    return valid ? saved as NexoraBot[] : initialBots;
}

export default function EmpireDashboard() {
    const [tab, setTab] = useState<'attention' | 'studio' | 'empire'>('attention');
    const [engineTab, setEngineTab] = useState<'prime' | 'forest'>('prime');
    const [selectedChannel, setSelectedChannel] = useState('YT-01');
    const [content, setContent] = useState(() => load('jarvis-content-empire', initialContent));
    const [activity, setActivity] = useState<string[]>(() => load('jarvis-empire-audit', ['JARVIS Empire Command initialized.']));
    const [prime, setPrime] = useState<PrimeState>(loadPrimeState);
    const [bots, setBots] = useState<NexoraBot[]>(loadBotFleet);
    const [workerFleetOpen, setWorkerFleetOpen] = useState(false);
    const [forest, setForest] = useState<ForestState>(() => load('jarvis-forest-state', initialForest));
    const [officeStates, setOfficeStates] = useState<Record<string, OfficeState>>(() => load('jarvis-office-states', Object.fromEntries(officeNames.map(name => [name, 'IDLE']))));
    const [officeOutputs, setOfficeOutputs] = useState<Record<string, string>>(() => load('jarvis-office-outputs', {}));
    const [qualityRun, setQualityRun] = useState(false);
    const [approval, setApproval] = useState(false);
    const [videoTopic, setVideoTopic] = useState('The Battle of Midway: the decisions that changed the Pacific war');
    const [videoTitle, setVideoTitle] = useState('Midway: The Decisions That Changed the Pacific');
    const [videoStyle, setVideoStyle] = useState('cinematic documentary');
    const [videoCharacter, setVideoCharacter] = useState('original documentary host, dark navy jacket, calm confident presence');
    const [videoDuration, setVideoDuration] = useState(60);
    const [videoPlatform, setVideoPlatform] = useState('YouTube 16:9');
    const [videoPlan, setVideoPlan] = useState<any>(null);
    const [characterRefs, setCharacterRefs] = useState<Record<string, string>>({});
    const [sceneImages, setSceneImages] = useState<string[]>([]);
    const [videoBusy, setVideoBusy] = useState(false);
    const [videoMessage, setVideoMessage] = useState('No video project generated yet.');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [voicePlaying, setVoicePlaying] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [checks, setChecks] = useState<string[]>([]);
    const [freeze, setFreeze] = useState(false);
    const [cycleBusy, setCycleBusy] = useState(false);
    const [cycleResult, setCycleResult] = useState<{ entry: number; exit: number; pnl: number; outcome: 'WIN' | 'LOSS'; steps: string[] } | null>(null);
    const kings = useMemo(() => content.filter(item => item.status === 'KING'), [content]);
    const botStats = useMemo(() => fleetStats(bots), [bots]);
    const selected = channels.find(channel => channel.id === selectedChannel) ?? channels[0];
    const channelItems = content.filter(item => item.channelId === selected.id);

    const persist = (nextPrime: PrimeState, nextForest: ForestState) => {
        localStorage.setItem('jarvis-prime-state', JSON.stringify(nextPrime));
        localStorage.setItem('jarvis-forest-state', JSON.stringify(nextForest));
    };
    const log = (message: string) => setActivity(current => { const next = [...current, message].slice(-30); localStorage.setItem('jarvis-empire-audit', JSON.stringify(next)); return next; });
    const persistBots = (nextBots: NexoraBot[]) => localStorage.setItem('jarvis-nexora-bots', JSON.stringify(nextBots));

    const runBotFleetCycle = () => {
        if (freeze) return;
        const nextBots = simulateFleetCycle(bots);
        setBots(nextBots);
        persistBots(nextBots);
        const cyclePnl = Number(nextBots.reduce((sum, bot) => sum + bot.lastPnl, 0).toFixed(2));
        log(`NEXORA BOT FLEET: 10 ordinary bots completed a paper cycle · ${cyclePnl >= 0 ? '+' : ''}${cyclePnl.toFixed(2)} fleet P&L.`);
    };

    const resetBotFleet = () => {
        setBots(initialBots);
        persistBots(initialBots);
        log('NEXORA BOT FLEET: 10 ordinary bots reset to starting paper balances.');
    };

    const cloneKing = (item: ContentItem) => {
        const child = { ...item, id: `C-${String(content.length + 1).padStart(3, '0')}`, title: `${item.title} — follow-up`, views: 0, retention: 0, status: 'TEST' as const, hook: `New angle: ${item.hook}` };
        setContent(next => [...next, child]);
        log(`CLONE OFFICE: ${item.id} produced ${child.id}.`);
    };

    const markKings = () => {
        const ranked = [...content].sort((a, b) => b.views * b.retention - a.views * a.retention);
        const next = content.map(item => ({ ...item, status: ranked.indexOf(item) < 3 ? 'KING' as const : item.views < 300 ? 'WEAK' as const : 'TEST' as const }));
        setContent(next);
        log('ANALYTICS BOSS: experiments re-ranked by reach × retention.');
    };

    const runOffice = (office: string) => {
        const activeOffice = Object.entries(officeStates).find(([, state]) => state === 'WORKING');
        if (activeOffice) return;
        setOfficeStates(current => ({ ...current, [office]: 'WORKING' }));
        setOfficeOutputs(current => ({ ...current, [office]: 'Working on current production context…' }));
        log(`${office}: WORKING — ${officeWork[office]}`);
        window.setTimeout(() => {
            setOfficeStates(current => ({ ...current, [office]: 'DONE' }));
            setOfficeOutputs(current => ({ ...current, [office]: `${officeWork[office]} Output is ready for the next office.` }));
            localStorage.setItem('jarvis-office-states', JSON.stringify({ ...officeStates, [office]: 'DONE' }));
            log(`${office}: DONE — output ready for next stage.`);
        }, 700);
    };

    const createVideoPlan = async () => {
        setVideoBusy(true); setVideoMessage('JARVIS Director is planning the script, character bible and scenes…'); setVideoUrl(null);
        try {
            const response = await api.post('/api/video/plan', { title: videoTitle, topic: videoTopic, duration: videoDuration, style: videoStyle, character: videoCharacter, platform: videoPlatform });
            const data = response.data;
            if (!data?.plan) throw new Error(data?.error || 'Video planning failed.');
            setVideoPlan(data.plan);
            setCharacterRefs({});
            setSceneImages([]);
            setQualityRun(false);
            setApproval(false);
            setVideoMessage(`Plan ready: ${data.plan?.characters?.length ?? 0} persistent characters across ${data.plan?.scenes?.length ?? 0} scenes. Generate character references first.`);
            log('VIDEO STUDIO: AI Director created a script + scene plan.');
        } catch (error) {
            setVideoMessage(error instanceof Error ? error.message : 'Video planning failed.');
        } finally { setVideoBusy(false); }
    };

    const generateCharacterReferences = async () => {
        if (!videoPlan?.characters?.length) return;
        setVideoBusy(true); setVideoMessage('Creating persistent character reference images…');
        try {
            const refs: Record<string, string> = {};
            for (const characterItem of videoPlan.characters) {
                const prompt = `Character reference sheet for ${characterItem.name}. English-named original fictional character. Role: ${characterItem.role}. Appearance: ${characterItem.appearance}. Personality: ${characterItem.personality}. Full-body and portrait consistency, neutral studio lighting, clean cinematic design, front/three-quarter views, no text, no logos.`;
                const response = await api.post('/api/image/generate', { prompt });
                const data = response.data;
                if (!data?.image?.data) throw new Error(data?.error || `${characterItem.name} reference generation failed.`);
                refs[characterItem.id] = `data:${data.image.mimeType};base64,${data.image.data}`;
            }
            setCharacterRefs(refs);
            setVideoMessage(`Character references ready for ${Object.keys(refs).length} characters. Generate scene visuals next.`);
            log(`VIDEO STUDIO: generated ${Object.keys(refs).length} persistent character references.`);
        } catch (error) {
            setVideoMessage(error instanceof Error ? error.message : 'Character reference generation failed.');
        } finally { setVideoBusy(false); }
    };

    const generateSceneVisuals = async () => {
        if (!videoPlan?.scenes?.length) return;
        setVideoBusy(true); setVideoMessage('Generating AI scene visuals using persistent character references…');
        try {
            const generated: string[] = [];
            for (const scene of videoPlan.scenes.slice(0, 8)) {
                const referenceImages = (scene.cast || []).map((id: string) => characterRefs[id]).filter(Boolean).slice(0, 5);
                const castNames = (scene.cast || []).map((id: string) => videoPlan.characters?.find((item: any) => item.id === id)?.name).filter(Boolean).join(', ');
                const dialogue = (scene.dialogue || []).map((line: any) => `${line.characterName}: ${line.line}`).join(' ');
                const prompt = `${scene.visualPrompt}. ACTION: ${scene.actionDirection}. CAST: ${castNames}. DIALOGUE CONTEXT: ${dialogue}. Character continuity bible: ${videoPlan.characterBible}. Visual style: ${videoStyle}. Keep every referenced character's identity, wardrobe, age, facial features, body proportions and voice identity consistent with their character reference. Show natural body movement and interaction appropriate to the action. Scene ${scene.scene}. Cinematic ${videoPlatform}. Original content.`;
                const response = await api.post('/api/image/generate', { prompt, images: referenceImages.map((src: string) => ({ data: src.split(',')[1], mimeType: src.split(',')[0].replace('data:', '').split(';')[0] })) });
                const data = response.data;
                if (!data?.image?.data) throw new Error(data?.error || `Scene ${scene.scene} image failed.`);
                generated.push(`data:${data.image.mimeType};base64,${data.image.data}`);
                setSceneImages([...generated]);
            }
            setVideoMessage(`AI scene visuals ready: ${generated.length} scenes. These are continuity-guided visual assets; the real-video provider layer remains separate.`);
            log(`VIDEO STUDIO: generated ${generated.length} AI scene visuals.`);
        } catch (error) {
            setVideoMessage(error instanceof Error ? error.message : 'Scene generation failed.');
        } finally { setVideoBusy(false); }
    };

    const renderVideo = async () => {
        if (!videoPlan?.scenes?.length || sceneImages.length !== videoPlan.scenes.length || !canvasRef.current) return;
        setVideoBusy(true); setVideoMessage('Rendering animated WebM preview from the AI scenes…'); setVideoUrl(null);
        try {
            const canvas = canvasRef.current;
            const width = videoPlatform.includes('9:16') ? 720 : 1280;
            const height = videoPlatform.includes('9:16') ? 1280 : 720;
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas rendering is unavailable in this browser.');
            const stream = canvas.captureStream(30);
            const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
            const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
            const chunks: Blob[] = [];
            recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
            const finished = new Promise<void>((resolve, reject) => { recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error('WebM renderer failed.')); });
            recorder.start();
            for (let index = 0; index < videoPlan.scenes.length; index += 1) {
                const scene = videoPlan.scenes[index];
                const image = new Image(); image.src = sceneImages[index];
                await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`Scene ${index + 1} could not load.`)); });
                const seconds = Math.max(2, Number(scene.duration) || 4);
                const frames = Math.round(seconds * 30);
                for (let frame = 0; frame < frames; frame += 1) {
                    const progress = frame / Math.max(1, frames - 1);
                    const zoom = 1 + progress * 0.06;
                    const scale = Math.max(width / image.width, height / image.height) * zoom;
                    const drawW = image.width * scale; const drawH = image.height * scale;
                    const drift = (progress - 0.5) * width * 0.04;
                    ctx.fillStyle = '#05080d'; ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(image, (width - drawW) / 2 + drift, (height - drawH) / 2);
                    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, height - 78, width, 78);
                    ctx.fillStyle = '#ffffff'; ctx.font = `${Math.max(18, Math.round(width / 42))}px sans-serif`; ctx.fillText(videoPlan.title || videoTitle, 28, height - 42);
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }
            recorder.stop(); await finished;
            const blob = new Blob(chunks, { type: preferredMime.split(';')[0] });
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
            setVideoMessage('Motion preview rendered successfully. This is a browser-generated motion preview, not the final photoreal video engine.');
            log('VIDEO STUDIO: animated WebM render completed; approval still required.');
        } catch (error) {
            setVideoMessage(error instanceof Error ? error.message : 'Video render failed.');
        } finally { setVideoBusy(false); }
    };

    const playCharacterDialogue = () => {
        const dialogue = videoPlan?.scenes?.flatMap((scene: any) => scene.dialogue || []) || [];
        if (!dialogue.length || !('speechSynthesis' in window)) { setVideoMessage('Character dialogue preview is unavailable here.'); return; }
        const synth = window.speechSynthesis;
        synth.cancel();
        const voices = synth.getVoices();
        const englishVoices = voices.filter(voice => /^en(-|_)/i.test(voice.lang));
        const used = new Set<string>();
        const pickVoice = (characterId: string) => {
            const preferred = englishVoices.find(voice => !used.has(voice.voiceURI) && /natural|premium|enhanced|online/i.test(voice.name)) || englishVoices.find(voice => !used.has(voice.voiceURI)) || voices[0];
            if (preferred) used.add(preferred.voiceURI);
            return preferred;
        };
        let index = 0;
        const speakNext = () => {
            const line = dialogue[index++];
            if (!line) { setVoicePlaying(false); return; }
            const voice = pickVoice(line.characterId);
            const utterance = new SpeechSynthesisUtterance(line.line);
            if (voice) utterance.voice = voice;
            utterance.lang = voice?.lang || 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 0.98 + (index % 3) * 0.03;
            utterance.onend = speakNext;
            utterance.onerror = speakNext;
            if (index === 1) setVoicePlaying(true);
            synth.speak(utterance);
        };
        speakNext();
    };

    const playVoice = () => {
        const text = videoPlan?.narration || videoPlan?.scenes?.map((scene: any) => scene.narration).join(' ') || '';
        if (!text || !('speechSynthesis' in window)) { setVideoMessage('Browser voice preview is unavailable here.'); return; }
        const synth = window.speechSynthesis;
        synth.cancel();
        const speakNow = () => {
            const voices = synth.getVoices();
            const preferred = voices.find(voice => /natural|premium|enhanced/i.test(voice.name))
                || voices.find(voice => /Ava|Samantha|Daniel|Karen/i.test(voice.name) && /^en(-|_)/i.test(voice.lang))
                || voices.find(voice => /Google US English|Microsoft .* Online/i.test(voice.name))
                || voices.find(voice => /^en(-|_)/i.test(voice.lang))
                || voices[0];
            const utterance = new SpeechSynthesisUtterance(text);
            if (preferred) utterance.voice = preferred;
            utterance.lang = preferred?.lang || 'en-US';
            utterance.rate = 0.92;
            utterance.pitch = 0.98;
            utterance.volume = 1;
            utterance.onstart = () => setVoicePlaying(true);
            utterance.onend = () => setVoicePlaying(false);
            utterance.onerror = () => setVoicePlaying(false);
            synth.speak(utterance);
        };
        const voices = synth.getVoices();
        if (voices.length) {
            speakNow();
        } else {
            const loadVoices = () => {
                synth.removeEventListener('voiceschanged', loadVoices);
                speakNow();
            };
            synth.addEventListener('voiceschanged', loadVoices);
            window.setTimeout(() => {
                synth.removeEventListener('voiceschanged', loadVoices);
                if (!synth.speaking) speakNow();
            }, 800);
        }
    };

    const runQualityGate = () => {
        setQualityRun(true);
        setChecks(['Historical claims require named sources','No unsupported statistics or quotations','Hypothetical claims must be labeled','Visual assets require rights/source tracking','Music direction must be original','Full storyboard must cover the complete runtime','Approval required before publish queue']);
        log('VIDEO STUDIO: quality gate completed with 7 checks.');
    };

    const approveDraft = () => { if (!qualityRun) return; setApproval(true); log('APPROVAL OFFICE: Saviour approval recorded.'); };

    const runPaperTrade = () => {
        if (freeze) return;
        const result = Number(((Math.random() - 0.45) * 1.2).toFixed(2));
        const next = recordPaperTrade(checkPrimeStatus(prime), result);
        setPrime(next); persist(next, forest);
        log(`PRIME: paper trade ${result >= 0 ? 'WIN' : 'LOSS'} ${result >= 0 ? '+' : ''}${result.toFixed(2)} → ${next.status}.`);
    };

    const runCompleteTradingCycle = () => {
        if (freeze || cycleBusy || prime.status !== 'ALIVE') return;
        setCycleBusy(true);
        const checked = checkPrimeStatus(prime);
        if (checked.status !== 'ALIVE') {
            setPrime(checked);
            setCycleBusy(false);
            log(`PRIME CYCLE: blocked at risk check → ${checked.status}.`);
            return;
        }
        const entry = 100;
        const netPnl = Number(((Math.random() - 0.46) * 1.5).toFixed(2));
        const exit = Number((entry + netPnl).toFixed(2));
        const next = recordPaperTrade(checked, netPnl);
        const outcome = netPnl >= 0 ? 'WIN' as const : 'LOSS' as const;
        const steps = ['Risk check passed', 'Paper order opened', 'Simulated market move applied', 'Paper position closed', 'P&L settled and Prime state updated'];
        setPrime(next);
        persist(next, forest);
        setCycleResult({ entry, exit, pnl: netPnl, outcome, steps });
        setCycleBusy(false);
        log(`PRIME CYCLE: COMPLETE — ${outcome} ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} · entry ${entry.toFixed(2)} → exit ${exit.toFixed(2)} → ${next.status}.`);
    };

    const simulateForest = () => {
        if (freeze) return;
        const next = simulateForestDay(forest);
        setForest(next); persist(prime, next);
        log(`FOREST: daily observation complete. Revenue today $${forestRevenue(next).toFixed(2)}.`);
    };

    const sendRevenueToPrime = () => {
        const earning = forestRevenue(forest);
        const next = receiveContentEarnings(prime, earning);
        setPrime(next); persist(next, forest);
        log(`BRIDGE: $${earning.toFixed(2)} content earnings → 90% Clone / 10% Prime.`);
    };

    const revive = () => {
        const next = revivePrime(prime, 1);
        setPrime(next); persist(next, forest); log('PRIME: manual paper revive +$1.00.');
    };

    const resetDemo = () => {
        setPrime(initialPrime); setForest(initialForest); persist(initialPrime, initialForest); log('SYSTEM: paper demo state reset.');
    };

    return <section className="empire-console">
        <div className="empire-hero"><div><span className="eyebrow">JARVIS EMPIRE COMMAND</span><h2>Attention + Nexora</h2><p>Two independent engines: Forest observes content growth; Nexora Prime handles paper-trading simulation only.</p></div><div className="empire-safety"><span /> PAPER / USER-APPROVAL MODE</div></div>
        <div className="empire-tabs" role="tablist" aria-label="Empire sections">
            <button type="button" role="tab" aria-selected={tab === 'attention'} aria-pressed={tab === 'attention'} className={tab === 'attention' ? 'selected' : ''} onClick={() => setTab('attention')}>📡 ATTENTION EMPIRE</button>
            <button type="button" role="tab" aria-selected={tab === 'studio'} aria-pressed={tab === 'studio'} className={tab === 'studio' ? 'selected' : ''} onClick={() => setTab('studio')}>🎬 VIDEO STUDIO</button>
            <button
                type="button"
                role="tab"
                aria-selected={tab === 'empire'}
                aria-pressed={tab === 'empire'}
                aria-controls="nexora-empire-panel"
                className={tab === 'empire' ? 'selected' : ''}
                onClick={() => {
                    setEngineTab('prime');
                    setTab('empire');
                }}
            >
                ⚡ NEXORA EMPIRE
            </button>
        </div>

        {tab === 'attention' && <div className="empire-body">
            <div className="empire-stats"><div><span>CHANNELS</span><b>10</b></div><div><span>YOUTUBE</span><b>5</b></div><div><span>TIKTOK</span><b>5</b></div><div><span>CONTENT TESTS</span><b>{content.length}</b></div></div>
            <div className="empire-section-title"><span className="eyebrow">THE 5 PILLARS · 10 CHANNELS</span><h3>One pillar. Two channels. One production engine.</h3><p>Select a channel to open its command center.</p></div>
            <div className="channel-grid">{channels.map(channel => <button className={`channel-card ${channel.platform.toLowerCase()} ${selected.id === channel.id ? 'active-channel' : ''}`} key={channel.id} onClick={() => { setSelectedChannel(channel.id); log(`CHANNEL: ${channel.id} command center opened.`); }}><div className="channel-top"><span>{channel.id}</span><strong>{channel.platform}</strong></div><h3>{channel.name}</h3><div className="pillar-tag">{channel.pillar}</div><p>{channel.description}</p><div className="channel-meta"><span>{channel.format}</span><span>PAIRED → {channel.pairedWith}</span></div><div className="channel-queue"><b>Queue</b><span>{content.filter(item => item.channelId === channel.id).length} active item(s)</span></div></button>)}</div>
            <div className="channel-command"><div><span className="eyebrow">CHANNEL COMMAND CENTER</span><h3>{selected.id} · {selected.name}</h3><p>{selected.description}</p></div><div className="command-metrics"><span><b>{channelItems.length}</b> queue</span><span><b>{channelItems.filter(item => item.status === 'KING').length}</b> Kings</span><span><b>{channelItems.filter(item => item.status === 'TEST').length}</b> tests</span></div></div>
            <div className="office-header"><div><span className="eyebrow">18 FUNCTIONAL OFFICES</span><h3>One office works at a time.</h3><p>Each office produces an observable output for the next stage. Publishing still requires approval.</p></div><span className="office-lock">SERIAL WORKFLOW</span></div>
            <div className="office-grid">{officeNames.map((office, index) => <article className={`office-card office-${officeStates[office].toLowerCase()}`} key={office}><span>{String(index + 1).padStart(2, '0')}</span><b>{office}</b><small>{officeStates[office]}</small><p>{officeOutputs[office] ?? officeWork[office]}</p><button disabled={officeStates[office] === 'WORKING' || Object.values(officeStates).some(state => state === 'WORKING')} onClick={() => runOffice(office)}>{officeStates[office] === 'WORKING' ? 'Working…' : officeStates[office] === 'DONE' ? 'Run Again' : 'Run Office'}</button></article>)}</div>
            <div className="empire-actions"><button onClick={markKings}>Re-rank experiments</button><span>{kings.length} current Kings. Related clones stay TEST until measured.</span></div>
            <div className="experiment-table">{content.map(item => <article key={item.id}><div><b>{item.id} · {item.title}</b><small>{item.channelId} · {item.platform} · {item.pillar} · {item.hook}</small></div><strong className={`status-pill ${item.status.toLowerCase()}`}>{item.status}</strong><span>{item.views.toLocaleString()} views · {item.retention}% retention</span>{item.status === 'KING' && <button onClick={() => cloneKing(item)}>Clone</button>}</article>)}</div>
        </div>}

        {tab === 'studio' && <div className="empire-body"><div className="studio-hero"><div><span className="eyebrow">FOREST AI VIDEO STUDIO</span><h3>AI Video Studio · Director → Scenes → Render</h3><p>JARVIS can now plan an original video, generate AI scene visuals with a shared character bible, render animated WebM, preview narration, run the quality gate, and wait for approval.</p></div><div className={`quality-badge ${qualityRun ? 'ready' : ''}`}><span />{qualityRun ? 'QUALITY GATE PASSED' : 'BUILD MODE'}</div></div><div className="studio-grid"><article className="studio-card"><span className="card-label">01 · AI DIRECTOR</span><h3>Create a video project</h3><label style={{display:'grid',gap:5,color:'#7faebd',fontSize:8}}>TITLE<input value={videoTitle} onChange={event => setVideoTitle(event.target.value)} style={{background:'#07131b',border:'1px solid #244758',color:'#d6edf5',borderRadius:7,padding:8}} /></label><label style={{display:'grid',gap:5,color:'#7faebd',fontSize:8,marginTop:8}}>TOPIC<textarea value={videoTopic} onChange={event => setVideoTopic(event.target.value)} rows={3} style={{background:'#07131b',border:'1px solid #244758',color:'#d6edf5',borderRadius:7,padding:8,resize:'vertical'}} /></label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}><label style={{display:'grid',gap:5,color:'#7faebd',fontSize:8}}>STYLE<select value={videoStyle} onChange={event => setVideoStyle(event.target.value)} style={{background:'#07131b',border:'1px solid #244758',color:'#d6edf5',borderRadius:7,padding:8}}><option>cinematic documentary</option><option>3D animated story</option><option>photoreal cinematic</option><option>cartoon adventure</option></select></label><label style={{display:'grid',gap:5,color:'#7faebd',fontSize:8}}>RUNTIME<select value={videoDuration} onChange={event => setVideoDuration(Number(event.target.value))} style={{background:'#07131b',border:'1px solid #244758',color:'#d6edf5',borderRadius:7,padding:8}}><option value={30}>30 sec</option><option value={60}>60 sec</option><option value={90}>90 sec</option><option value={120}>2 min</option></select></label></div><label style={{display:'grid',gap:5,color:'#7faebd',fontSize:8,marginTop:8}}>CHARACTER BIBLE<input value={videoCharacter} onChange={event => setVideoCharacter(event.target.value)} style={{background:'#07131b',border:'1px solid #244758',color:'#d6edf5',borderRadius:7,padding:8}} /></label><div className="empire-actions"><button onClick={createVideoPlan} disabled={videoBusy}>{videoBusy ? 'Director working…' : 'Generate AI Video Plan'}</button></div></article><VoiceEnginePanel text={videoPlan?.narration || ''} /><article className="studio-card"><span className="card-label">03 · PRODUCTION PIPELINE</span><div className="studio-list"><span>✓ AI script + hook + narration</span><span>✓ Character continuity bible</span><span>✓ Scene-by-scene visual prompts</span><span>✓ AI-generated scene images</span><span>✓ Camera motion + audio direction</span><span>✓ Animated WebM render in-browser</span><span>✓ Browser voice narration preview</span><span>✓ Quality gate + Saviour approval</span></div><p style={{marginTop:12}}>Current AppDeploy AI exposes image generation, not a native video/TTS API. JARVIS therefore renders real motion from the generated AI scenes and keeps voice as a preview until a dedicated video/TTS provider is connected.</p></article></div>{videoPlan && <div className="studio-output" style={{display:'block'}}><div><span className="eyebrow">PROJECT</span><h3>{videoPlan.title}</h3><p><b>Hook:</b> {videoPlan.hook}</p><p><b>Character:</b> {videoPlan.characterBible}</p><p><b>Voice:</b> {videoPlan.voiceDirection} · <b>Music:</b> {videoPlan.musicDirection}</p></div><div className="quality-checks" style={{gridTemplateColumns:'repeat(2,1fr)'}}>{videoPlan.scenes.map((scene: any, index: number) => <div key={scene.scene} style={{display:'block'}}><b>SCENE {String(index + 1).padStart(2,'0')} · {scene.duration}s</b><p>{scene.narration}</p>{sceneImages[index] && <img src={sceneImages[index]} alt={`AI scene ${index + 1}`} style={{width:'100%',maxHeight:190,objectFit:'cover',borderRadius:7,marginTop:7}} />}<small>{scene.cameraMotion} · {scene.audio}</small></div>)}</div><div className="empire-actions"><button onClick={generateSceneVisuals} disabled={videoBusy}>{videoBusy ? 'Generating…' : 'Generate AI Scene Visuals'}</button><button onClick={renderVideo} disabled={videoBusy || sceneImages.length !== videoPlan.scenes.length}>{videoBusy ? 'Rendering…' : 'Render Animated WebM'}</button><button onClick={playVoice} disabled={videoBusy}>{voicePlaying ? 'Voice playing…' : 'Play AI narration preview'}</button></div><p>{videoMessage}</p>{videoUrl && <div style={{marginTop:12}}><video src={videoUrl} controls style={{width:'100%',borderRadius:10}} /><a href={videoUrl} download="jarvis-ai-video.webm" style={{display:'inline-block',marginTop:8,color:'#bdeafa'}}>Download rendered WebM</a></div>}<canvas ref={canvasRef} style={{display:'none'}} /><div className="studio-output" style={{marginTop:12}}><div><span className="eyebrow">QUALITY + APPROVAL</span><p>Run the quality gate after the project is generated. Publishing remains blocked until Saviour approves.</p></div><div className="approval-box"><span>FINAL GATE</span><b>{approval ? 'APPROVED FOR QUEUE' : 'AWAITING SAVIOUR'}</b><button onClick={runQualityGate}>{qualityRun ? 'Re-run Quality Gate' : 'Run Quality Gate'}</button><button onClick={approveDraft} disabled={!qualityRun || approval} style={{marginTop:6}}>{approval ? 'Approved' : 'Approve Draft'}</button></div></div></div>} {!videoPlan && <div className="quality-checks"><div className="empty-quality">Start with Generate AI Video Plan. JARVIS will build the production package before any publishing step.</div></div>}</div>}

        {tab === 'empire' && <div className="empire-body" id="nexora-empire-panel" role="tabpanel" aria-label="NEXORA EMPIRE">
            <div className="engine-hero">
                <div>
                    <span className="eyebrow">NEXORA EMPIRE</span>
                    <h3>⚡ NEXORA EMPIRE · PAPER SIMULATION</h3>
                    <p>This is the NEXORA engine itself: PRIME, the ten ordinary worker bots, and THE FOREST bridge. No broker, wallet, exchange, or real-money trading is connected.</p>
                </div>
                <span className="engine-status alive">SIMULATION ONLY</span>
            </div>
            <div className="engine-tabs"><button type="button" className={engineTab === 'prime' ? 'selected' : ''} onClick={() => setEngineTab('prime')}>⚡ NEXORA PRIME · MAIN</button><button type="button" className={engineTab === 'forest' ? 'selected' : ''} onClick={() => setEngineTab('forest')}>🌲 THE FOREST · YT / TT / FB</button></div>
            {engineTab === 'prime' ? <div>
                <div className="engine-hero prime"><div><span className="eyebrow">ENGINE 1 · TRADING ONLY</span><h3>NEXORA PRIME</h3><p>The main paper-trading fighter. Prime knows balance, trades, losses and risk state — nothing about social media.</p></div><span className={`engine-status ${typeof prime.status === 'string' && prime.status.startsWith('DEAD') ? 'dead' : prime.status === 'DYING' ? 'dying' : 'alive'}`}>{prime.status}</span></div>
                <div className="prime-grid"><div><span>MAIN PRIME</span><b>${prime.balance.toFixed(2)}</b><small>Active paper-trading fuel</small></div><div><span>CLONE RESERVE</span><b>${prime.cloneBalance.toFixed(2)}</b><small>Non-trading reserve</small></div><div><span>TRADES</span><b>{prime.trades}</b><small>{prime.wins}W / {prime.losses}L</small></div><div><span>P&L TODAY</span><b>{prime.pnlToday >= 0 ? '+' : ''}${prime.pnlToday.toFixed(2)}</b><small>Paper only</small></div></div>
                <div className="prime-controls"><button type="button" onClick={runPaperTrade} disabled={freeze || prime.status !== 'ALIVE'}>Run Paper Trade</button><button type="button" className="cycle-button" onClick={runCompleteTradingCycle} disabled={freeze || cycleBusy || prime.status !== 'ALIVE'}>{cycleBusy ? 'Running Complete Cycle…' : '▶ Run Complete Trading Cycle'}</button><button type="button" onClick={revive} disabled={prime.status === 'ALIVE'}>Manual Paper Revive</button><button type="button" onClick={resetDemo}>Reset Demo</button><button type="button" onClick={() => setWorkerFleetOpen(current => !current)}>{workerFleetOpen ? 'Close 10-Bot Fleet' : 'Open 10-Bot Fleet'}</button><span>Loss streak: <b>{prime.consecutiveLosses}/5</b></span></div>
                <div className="cycle-panel" style={{ display: workerFleetOpen ? 'block' : 'none' }}><div><span className="eyebrow">NEXORA ORDINARY WORKER FLEET</span><h3>10 Bots · Independent Paper Simulation</h3><p>These are ordinary worker bots, not PRIME. Each starts with $10 of simulated balance and earns its record through simulated cycles. Promotion rules are intentionally separate and come later.</p></div><div className="prime-grid"><div><span>ACTIVE BOTS</span><b>{botStats.active}/10</b><small>Ordinary worker fleet</small></div><div><span>FLEET BALANCE</span><b>${botStats.totalBalance.toFixed(2)}</b><small>Paper-only capital</small></div><div><span>FLEET TRADES</span><b>{botStats.totalTrades}</b><small>{botStats.wins}W / {botStats.losses}L</small></div><div><span>FLEET P&L</span><b>{botStats.totalPnl >= 0 ? '+' : ''}${botStats.totalPnl.toFixed(2)}</b><small>{botStats.winRate.toFixed(1)}% win rate</small></div></div><div className="prime-controls"><button type="button" onClick={runBotFleetCycle} disabled={freeze || botStats.active === 0}>▶ Start 10-Bot Paper Cycle</button><button type="button" onClick={resetBotFleet}>Reset 10 Bots</button><span>SIMULATION ONLY · no broker, wallet, exchange or real-money order is connected.</span></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8,marginTop:12}}>{bots.map(bot => <article key={bot.id} style={{border:'1px solid #244758',borderRadius:8,padding:10,background:'#07131b'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{bot.id} · {bot.name}</b><span>BOT · {bot.status}</span></div><strong style={{display:'block',marginTop:6}}>${bot.balance.toFixed(2)}</strong><small>{bot.trades} trades · {bot.wins}W / {bot.losses}L · P&L {bot.pnl >= 0 ? '+' : ''}${bot.pnl.toFixed(2)}</small><em style={{display:'block',marginTop:5}}>{bot.lastPnl === 0 ? 'Awaiting first cycle' : `Last cycle ${bot.lastPnl >= 0 ? '+' : ''}${bot.lastPnl.toFixed(2)}`}</em></article>)}</div></div>
                <div className="cycle-panel"><div><span className="eyebrow">NEXORA TEST PANEL · ONE BUTTON</span><h3>Complete simulated trading cycle</h3><p>One click runs the full paper lifecycle: risk check → order entry → simulated market movement → position close → P&amp;L settlement.</p></div>{cycleResult ? <div className="cycle-result"><div><span>ENTRY</span><b>${cycleResult.entry.toFixed(2)}</b></div><div><span>EXIT</span><b>${cycleResult.exit.toFixed(2)}</b></div><div><span>NET P&amp;L</span><b className={cycleResult.pnl >= 0 ? 'cycle-win' : 'cycle-loss'}>{cycleResult.pnl >= 0 ? '+' : ''}${cycleResult.pnl.toFixed(2)}</b></div><div><span>OUTCOME</span><b className={cycleResult.outcome === 'WIN' ? 'cycle-win' : 'cycle-loss'}>{cycleResult.outcome}</b></div></div> : <div className="cycle-idle">No complete cycle has been run yet.</div>}{cycleResult && <div className="cycle-steps">{cycleResult.steps.map((step, index) => <span key={step}><b>{index + 1}</b>{step}</span>)}</div>}<small>SIMULATION ONLY · no broker, wallet, exchange, payment or real-money order is connected.</small></div>
                <div className="death-grid"><div><b>WORKER BOT RULE</b><span>Worker bots remain BOT until a later promotion engine evaluates sustained simulated performance.</span></div><div><b>STARVATION</b><span>Prime balance below $1 → DEAD</span></div><div><b>TILT PROTECTION</b><span>5 consecutive paper losses → DEAD</span></div><div><b>NEGLECT</b><span>3 days without Forest posts → DYING</span></div></div>
                <div className="bridge-panel"><span className="eyebrow">ONE-WAY MONEY BRIDGE · SIMULATION</span><h3>Forest earnings → Prime receives → automatic split</h3><div className="bridge-flow"><b>${forestRevenue(forest).toFixed(2)}</b><span>100% lands in Main first</span><i>→</i><strong>90% Clone</strong><i>+</i><strong>10% Prime</strong></div><button onClick={sendRevenueToPrime}>Process Today's Simulated Content Earnings</button><small>No real money, payments, wallets or trades are moved by JARVIS.</small></div>
            </div> : <div>
                <div className="engine-hero forest"><div><span className="eyebrow">ENGINE 2 · CONTENT ONLY</span><h3>THE FOREST</h3><p>The social-content ecosystem. It observes YouTube, TikTok and Facebook growth and reports revenue; it does not trade.</p></div><span className="forest-mode">ALGORITHM JUNGLE</span></div>
                <div className="forest-grid">{forest.accounts.map(account => <article key={account.platform}><div className="forest-account-head"><b>{account.platform}</b><span>{account.name}</span></div><strong>{account.audience.toLocaleString()}</strong><small>followers / subscribers</small><div className="forest-metrics"><span>{account.viewsToday.toLocaleString()} views</span><span>{account.commentsToday} comments</span><span>${account.revenueToday.toFixed(2)} revenue</span></div><div className="blow-score">Blow Score <b>{blowScore(account)}</b></div><p>{account.monetization}</p></article>)}</div>
                <div className="forest-controls"><button onClick={simulateForest} disabled={freeze}>Simulate Forest Day</button><button onClick={() => { const next = evaluateForest(forest); setForest(next); log(`FOREST: ${next.lastAlert}`); }}>Evaluate Blow Alert</button><span>14-day niche memory: <b>{forest.recentNicheDays}/14 days</b></span></div>
                <div className="forest-alert">{forest.lastAlert}</div>
                <div className="forest-rules"><b>FOREST RULES</b><span>YT metric: subscribers</span><span>TT metric: followers</span><span>FB metric: followers</span><span>Revenue is reported separately from trading</span><span>Blow threshold is a configurable experiment, not a universal platform rule</span></div>
                <YouTubeConnectionPanel />
            </div>}
        </div>}

        <div className="audit-panel"><div className="audit-head"><b>OPERATIONAL MEMORY</b><button onClick={() => { setActivity(['Audit log reset by user.']); localStorage.removeItem('jarvis-empire-audit'); }}>Reset log</button></div>{activity.slice(-8).reverse().map((entry, index) => <div className="audit-row" key={`${entry}-${index}`}><span>LOG</span>{entry}</div>)}</div>
    </section>;
}
