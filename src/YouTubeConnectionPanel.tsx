import { useEffect, useState } from 'react';
import { api } from './api';

type Channel = { id: string; title: string; connectedAt: string };

export default function YouTubeConnectionPanel() {
    const [configured, setConfigured] = useState(false);
    const [connected, setConnected] = useState(false);
    const [channel, setChannel] = useState<Channel | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('Checking YouTube connection…');

    const refresh = async () => {
        try {
            const response = await api.get('/api/youtube/status');
            setConfigured(Boolean(response.data?.configured));
            setConnected(Boolean(response.data?.connected));
            setChannel(response.data?.channel || null);
            setMessage(response.data?.connected ? 'YouTube account connected.' : response.data?.configured ? 'Ready for Google authorization.' : 'Google OAuth credentials still need to be configured.');
        } catch {
            setMessage('Could not check the YouTube connection status.');
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const youtubeStatus = params.get('youtube');
        const callbackMessage = params.get('message');
        if (youtubeStatus === 'connected') setMessage(callbackMessage || 'YouTube account connected.');
        else if (youtubeStatus === 'error') setMessage(callbackMessage || 'YouTube authorization did not complete.');
        void refresh();
        if (youtubeStatus) window.history.replaceState({}, '', window.location.pathname);
    }, []);

    const connect = async () => {
        setBusy(true);
        setMessage('Preparing secure Google authorization…');
        try {
            const response = await api.get('/api/youtube/connect');
            const url = String(response.data?.authorizationUrl || '');
            if (!url) throw new Error('No authorization URL returned.');
            window.open(url, '_blank', 'noopener,noreferrer');
            setMessage('Google authorization opened in a new tab. Finish it there, then return here and refresh.');
        } catch (requestError: any) {
            setMessage(requestError?.response?.data?.error || 'YouTube OAuth is not configured yet.');
        } finally {
            setBusy(false);
        }
    };

    return <article className="studio-card" style={{marginTop:16}}>
        <span className="card-label">YOUTUBE CONNECTION CENTER</span>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div>
                <h3>{connected ? channel?.title || 'YouTube channel connected' : 'Connect one YouTube channel'}</h3>
                <p style={{maxWidth:720}}>JARVIS uses Google's official OAuth flow. No Google password is stored in JARVIS. Publishing stays behind the existing approval gate.</p>
            </div>
            <span className="office-lock">{connected ? 'CONNECTED' : configured ? 'AUTH READY' : 'SETUP REQUIRED'}</span>
        </div>
        {connected && channel && <div className="forest-rules" style={{marginTop:10}}><span>Channel ID: {channel.id}</span><span>OAuth: active</span><span>Analytics: requested</span><span>Upload permission: requested</span></div>}
        <div className="empire-actions" style={{marginTop:12}}><button onClick={connect} disabled={busy || connected}>{connected ? 'YouTube Connected' : busy ? 'Preparing…' : 'Connect YouTube with Google'}</button><button onClick={() => void refresh()} disabled={busy}>Refresh Status</button></div>
        <small style={{display:'block',marginTop:8,color:'#7faebd'}}>{message}</small>
        <small style={{display:'block',marginTop:6,color:'#8ea8b2'}}>Account authorization must be completed by the account owner or another adult authorized to manage the channel. JARVIS does not bypass Google's age, identity, or account rules.</small>
    </article>;
}
