import { useEffect, useState } from 'react';
import { api } from './api';

type Props = { text: string };

const voices = [
    ['en-US-Chirp3-HD-Achird', 'Chirp 3 HD · Achird · Male'],
    ['en-US-Chirp3-HD-Charon', 'Chirp 3 HD · Charon · Male'],
    ['en-US-Chirp-HD-D', 'Chirp HD · D · Male'],
    ['en-US-Chirp-HD-F', 'Chirp HD · F · Female'],
    ['en-US-Neural2-D', 'Neural2 · D · Male'],
    ['en-US-Neural2-I', 'Neural2 · I · Male'],
    ['en-US-Studio-Q', 'Studio · Q · Male'],
    ['en-US-Wavenet-D', 'WaveNet · D · Male'],
    ['en-US-Wavenet-I', 'WaveNet · I · Male'],
];

export default function VoiceEnginePanel({ text }: Props) {
    const [voice, setVoice] = useState('en-US-Chirp3-HD-Achird');
    const [rate, setRate] = useState(0.96);
    const [pitch, setPitch] = useState(0);
    const [configured, setConfigured] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('Checking Google Cloud TTS…');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    useEffect(() => {
        void api.get('/api/tts/status').then(response => {
            const ready = Boolean(response.data?.configured);
            setConfigured(ready);
            setMessage(ready ? 'Google Cloud TTS connected.' : 'Google Cloud TTS needs its secure API key. Browser fallback is available.');
        }).catch(() => setMessage('TTS status unavailable. Browser fallback is available.'));
        return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    }, [audioUrl]);

    const browserFallback = () => {
        if (!text || !('speechSynthesis' in window)) { setMessage('No browser speech engine is available.'); return; }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const browserVoice = window.speechSynthesis.getVoices().find(item => /^en(-|_)/i.test(item.lang));
        if (browserVoice) utterance.voice = browserVoice;
        utterance.lang = browserVoice?.lang || 'en-US';
        utterance.rate = 0.92;
        utterance.pitch = 0.98;
        window.speechSynthesis.speak(utterance);
        setMessage('Playing browser fallback voice.');
    };

    const generate = async () => {
        if (!text) { setMessage('Generate a video plan first.'); return; }
        setBusy(true);
        setMessage('Google Cloud TTS is generating natural speech…');
        try {
            const response = await api.post('/api/tts/synthesize', { text, voice, languageCode: 'en-US', speakingRate: rate, pitch });
            const data = response.data;
            if (!data?.audioContent) throw new Error(data?.error || 'Google TTS returned no audio.');
            const binary = atob(data.audioContent);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            const nextUrl = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/mpeg' }));
            setAudioUrl(nextUrl);
            setMessage(`Ready · ${voice} · ${rate.toFixed(2)}x speed`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Google Cloud TTS failed.');
        } finally { setBusy(false); }
    };

    return <article className="studio-card">
        <span className="card-label">02 · VOICE ENGINE</span>
        <h3>Google Cloud TTS</h3>
        <p>Natural English narration with selectable Google voices. The API key stays on the server and is never sent to the browser.</p>
        <label style={{ display: 'grid', gap: 5, color: '#7faebd', fontSize: 8 }}>VOICE
            <select value={voice} onChange={event => setVoice(event.target.value)} style={{ background: '#07131b', border: '1px solid #244758', color: '#d6edf5', borderRadius: 7, padding: 8 }}>
                {voices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
        </label>
        <label style={{ display: 'grid', gap: 5, color: '#7faebd', fontSize: 8, marginTop: 8 }}>SPEED · {rate.toFixed(2)}x
            <input type="range" min="0.75" max="1.25" step="0.01" value={rate} onChange={event => setRate(Number(event.target.value))} />
        </label>
        <label style={{ display: 'grid', gap: 5, color: '#7faebd', fontSize: 8, marginTop: 8 }}>PITCH · {pitch > 0 ? '+' : ''}{pitch.toFixed(1)}
            <input type="range" min="-6" max="6" step="0.5" value={pitch} onChange={event => setPitch(Number(event.target.value))} />
        </label>
        <div className="studio-list" style={{ marginTop: 10 }}>
            <span>{configured ? '✓ Google Cloud TTS connected' : '○ Google Cloud TTS not configured'}</span>
            <span>✓ MP3 output for video production</span>
            <span>✓ Server-side secret protection</span>
            <span>✓ Browser fallback</span>
        </div>
        <div className="empire-actions">
            <button onClick={generate} disabled={busy || !text}>{busy ? 'Generating voice…' : 'Generate Google voice'}</button>
            <button onClick={browserFallback} disabled={!text}>Browser fallback</button>
        </div>
        <p>{message}</p>
        {audioUrl && <audio controls src={audioUrl} style={{ width: '100%', marginTop: 8 }} />}
    </article>;
}
