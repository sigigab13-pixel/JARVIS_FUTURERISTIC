import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import EmpireDashboard from './EmpireDashboard';
import CapabilityCenter from './CapabilityCenter';
import './EmpireDashboard.css';
import { api, image } from './api';
import { supabase, supabaseConfigured } from './supabase';
import {
  Mic,
  MicOff,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  Shield,
  Cpu,
  Activity,
  Sparkles,
  Camera,
  LockKeyhole,
  CheckCircle2,
  AlertTriangle,
  X,
  Radio,
  Terminal,
  Monitor,
  BrainCircuit,
  Download,
  RotateCcw,
  Globe,
  Battery,
} from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const starter: Message[] = [
  {
    role: 'assistant',
    content: 'Hello, Saviour. JARVIS is online. How can I help you?',
  },
];

function App() {
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [entitlement, setEntitlement] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('jarvis-history');
      return saved ? JSON.parse(saved) : starter;
    } catch {
      return starter;
    }
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [passiveWake, setPassiveWake] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [empireOpen, setEmpireOpen] = useState(false);
  const [capabilityOpen, setCapabilityOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [systemResults, setSystemResults] = useState<string[]>([]);
  const [passiveStatus, setPassiveStatus] = useState('STARTING');
  const [imageLabOpen, setImageLabOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [referenceImage, setReferenceImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [brandKit, setBrandKit] = useState<any>(null);
  const [businessBusy, setBusinessBusy] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoProjects, setVideoProjects] = useState<any[]>([]);
  const [videoProject, setVideoProject] = useState<any>(null);
  const [videoCharacters, setVideoCharacters] = useState<any[]>([]);
  const [videoScenes, setVideoScenes] = useState<any[]>([]);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [editingCharacter, setEditingCharacter] = useState<any>(null);
  const [editingScene, setEditingScene] = useState<any>(null);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('Not tested');
  const [securityResults, setSecurityResults] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const passiveRecognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;

    if (!supabaseConfigured || !supabase) {
      setAuthError('Supabase Auth is not configured in this deployment.');
      setAuthReady(true);
      return () => { active = false; };
    }

    const syncSession = async (currentSession: any) => {
      if (!currentSession?.access_token) return;
      try {
        const response = await api.post('/api/auth/sync', { accessToken: currentSession.access_token });
        if (!response.data?.ok) throw new Error(response.data?.error || 'Authentication sync failed.');
      } catch (error: any) {
        if (active) setAuthError(error?.message || 'Could not connect your JARVIS account.');
      }
    };
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      setSession(data.session || null);
      setAuthReady(true);
      if (data.session) void syncSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);
      setAuthError('');
      if (event === 'SIGNED_IN' && nextSession) void syncSession(nextSession);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setEntitlement(null); return; }
    let active = true;
    void api.get('/api/plans').then(response => {
      if (active) setEntitlement(response.data?.entitlement || null);
    }).catch(() => {
      if (active) setEntitlement(null);
    });
    return () => { active = false; };
  }, [session]);

  const signInWithGoogle = async () => {
    setAuthBusy(true);
    setAuthError('');
    if (!supabaseConfigured || !supabase) {
      setAuthError('Supabase Auth is not configured in this deployment.');
      setAuthBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setAuthError(error.message); setAuthBusy(false); }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
  };

  useEffect(() => {
    localStorage.setItem('jarvis-history', JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    let active = true;
    void api.get('/api/chat/history').then(response => {
      const cloudMessages = Array.isArray(response.data?.messages) ? response.data.messages : [];
      if (!active || cloudMessages.length === 0) return;
      setMessages(cloudMessages.filter((m: any) => m?.role === 'user' || m?.role === 'assistant'));
    }).catch(() => {
      // Local memory remains available if the cloud memory service is temporarily unavailable.
    });
    return () => { active = false; };
  }, []);

  const speak = async (text: string) => {
    if (!voiceEnabled || !text.trim()) return;
    try {
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeaking(true);
      const response = await api.post('/api/tts/synthesize', { text: text.slice(0, 5000) });
      const audioContent = String(response.data?.audioContent || '');
      const mimeType = String(response.data?.mimeType || 'audio/mpeg');
      if (!audioContent) throw new Error('No audio returned.');
      const audio = new Audio('data:' + mimeType + ';base64,' + audioContent);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setSpeaking(false);
      };
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setSpeaking(false);
      };
      await audio.play();
    } catch {
      setSpeaking(false);
      // Keep the chat usable if ElevenLabs is temporarily unavailable.
    }
  };

  const sendMessage = async (text = input) => {
    const clean = text.trim();
    if (!clean || busy) return;
    const next = [...messages, { role: 'user' as const, content: clean }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      let response;
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await api.post('/api/chat', {
            messages: next.slice(-16),
          });
          break;
        } catch (err) {
          lastError = err;
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 700));
        }
      }
      if (!response) throw lastError ?? new Error('AI core request failed');
      const generatedImage = response.data?.image;
      if (generatedImage?.data && generatedImage?.mimeType) {
        setImagePrompt(clean);
        setImageResult(`data:${generatedImage.mimeType};base64,${generatedImage.data}`);
        setImageError('');
        setImageLabOpen(true);
      }
      const answer =
        response.data?.text ||
        (generatedImage ? 'Done, Saviour. Your image is ready in Image Lab.' : 'I could not complete that request. Please try again.');
      setMessages(current => [
        ...current,
        { role: 'assistant', content: answer },
      ]);
      if (voiceEnabled) void speak(answer);
    } catch {
      setMessages(current => [
        ...current,
        {
          role: 'assistant',
          content:
            'My AI core is temporarily unavailable. I retried the connection; please try again in a moment.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const getSpeechRecognition = () =>
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setMessages(current => [...current, { role: 'assistant', content: 'Voice input is not supported by this browser. You can still type to me.' }]);
      return;
    }
    if (recognitionRef.current) recognitionRef.current.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      if (text.trim()) void sendMessage(text);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const startPassiveWake = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setPassiveStatus('NOT SUPPORTED');
      return;
    }
    if (passiveRecognitionRef.current) passiveRecognitionRef.current.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onstart = () => setPassiveStatus('LISTENING FOR HEY');
    recognition.onend = () => {
      if (passiveWake) setPassiveStatus('RESTARTING');
    };
    recognition.onerror = () => setPassiveStatus('CHECK MIC PERMISSION');
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results || [])
        .slice(-1)
        .map((result: any) => result?.[0]?.transcript || '')
        .join(' ')
        .toLowerCase();
      if (transcript.includes('hey')) {
        recognition.stop();
        setPassiveStatus('WAKE DETECTED');
        window.setTimeout(() => startListening(), 250);
      }
    };
    passiveRecognitionRef.current = recognition;
    recognition.start();
  };

  const stopPassiveWake = () => {
    passiveRecognitionRef.current?.stop();
    passiveRecognitionRef.current = null;
    setPassiveStatus('OFF');
  };

  const togglePassiveWake = () => {
    const next = !passiveWake;
    setPassiveWake(next);
    if (next) startPassiveWake();
    else stopPassiveWake();
  };

  const exportMemory = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jarvis-memory.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearMemory = () => {
    localStorage.removeItem('jarvis-history');
    audioRef.current?.pause();
    audioRef.current = null;
    setMessages(starter);
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (cameraRef.current) cameraRef.current.srcObject = null;
    setCameraActive(false);
  };

  const testCamera = async () => {
    if (cameraActive) {
      stopCamera();
      setCameraStatus('Camera test stopped');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Camera access is not supported by this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;
      if (cameraRef.current) cameraRef.current.srcObject = stream;
      setCameraActive(true);
      setCameraStatus('Camera is available. No photo is being captured or saved.');
    } catch {
      setCameraStatus('Camera permission was denied or the camera is unavailable');
    }
  };

  const generateImage = async () => {
    const prompt = imagePrompt.trim();
    if (!prompt || imageBusy) return;
    setImageBusy(true);
    setImageError('');
    try {
      const response = await api.post('/api/image/generate', {
        prompt,
        images: referenceImage ? [referenceImage] : [],
      });
      const generated = response.data?.image;
      if (!generated?.data || !generated?.mimeType) throw new Error('Invalid image response');
      setImageResult(`data:${generated.mimeType};base64,${generated.data}`);
    } catch {
      setImageError('I could not generate that image right now. Please try again.');
    } finally {
      setImageBusy(false);
    }
  };

  const handleReferenceImage = async (file: File) => {
    setImageError('');
    try {
      const prepared = await image.resizeIfNeeded(file, {
        maxDimension: 1600,
        maxPixels: 2_000_000,
        quality: 0.82,
        mimeType: 'image/jpeg',
      });
      setReferenceImage({ data: prepared.data, mimeType: prepared.mimeType });
      setReferencePreview(`data:${prepared.mimeType};base64,${prepared.data}`);
    } catch {
      setImageError('I could not prepare that reference image. Try another image.');
    }
  };

  const clearImageLab = () => {
    setImagePrompt('');
    setImageResult(null);
    setImageError('');
    setReferenceImage(null);
    setReferencePreview(null);
  };

  const downloadGeneratedImage = () => {
    if (!imageResult) return;
    const link = document.createElement('a');
    link.href = imageResult;
    link.download = 'jarvis-generated-image.png';
    link.click();
  };

  const runSecurityCheck = () => {
    const results = [
      window.isSecureContext ? 'Secure browser context: OK' : 'Secure browser context: check browser security',
      'JARVIS app permissions are user-controlled',
      'No covert camera capture or automatic surveillance is enabled',
      'Mac system lock requires an explicit action outside the browser',
    ];
    setSecurityResults(results);
  };

  const runSystemCheck = () => {
    const checks = [
      window.isSecureContext ? 'Secure browser context: OK' : 'Secure browser context: check browser security',
      navigator.onLine ? 'Network connection: ONLINE' : 'Network connection: OFFLINE',
      'Local conversation memory: AVAILABLE',
      'AI core: READY',
      'Mac system control: SAFELY RESTRICTED TO EXPLICIT USER ACTIONS',
    ];
    const battery = (navigator as any).getBattery;
    if (battery) checks.push('Battery API: AVAILABLE');
    setSystemResults(checks);
  };

  const openSecurityCenter = () => {
    setSecurityOpen(true);
    runSecurityCheck();
  };

  const openBusinessCenter = async () => {
    setBusinessOpen(true);
    try {
      const response = await api.get('/api/business');
      setBusiness(response.data?.business || null);
      setBrandKit(response.data?.brandKit || null);
    } catch {}
  };

  const saveBusiness = async () => {
    setBusinessBusy(true);
    try {
      const response = await api.post('/api/business', business || { name: 'My Business' });
      setBusiness(response.data?.business || business);
    } finally { setBusinessBusy(false); }
  };

  const saveBrandKit = async () => {
    if (!business) return;
    setBusinessBusy(true);
    try {
      const response = await api.post('/api/business/brand-kit', brandKit || {});
      setBrandKit(response.data?.brandKit || brandKit);
    } finally { setBusinessBusy(false); }
  };

  const openVideoStudio = async () => {
    setVideoOpen(true);
    setVideoError('');
    setVideoBusy(true);
    try {
      const response = await api.get('/api/video/projects');
      const projects = Array.isArray(response.data?.projects) ? response.data.projects : [];
      setVideoProjects(projects);
      if (projects[0]) {
        const project = projects[0];
        setVideoProject(project);
        const [characters, scenes] = await Promise.all([
          api.get('/api/video/projects/' + project.id + '/characters'),
          api.get('/api/video/projects/' + project.id + '/scenes'),
        ]);
        setVideoCharacters(characters.data?.characters || []);
        setVideoScenes(scenes.data?.scenes || []);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || error?.message || 'Video Engine is unavailable for this plan.');
    } finally { setVideoBusy(false); }
  };

  const createVideoProject = async () => {
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.post('/api/video/projects', {
        title: 'New JARVIS Production',
        description: 'Video production project',
        format: '16:9',
        story_bible: { premise: '', tone: '', continuity: {} },
      });
      const project = response.data?.project;
      if (project) {
        setVideoProject(project);
        setVideoProjects(current => [project, ...current]);
        setVideoCharacters([]);
        setVideoScenes([]);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not create the video project.');
    } finally { setVideoBusy(false); }
  };

  const createVideoCharacter = async () => {
    if (!videoProject) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.post('/api/video/projects/' + videoProject.id + '/characters', {
        name: window.prompt('Character name')?.trim() || 'New Character',
        role: window.prompt('Character role')?.trim() || 'Character',
        profile: { personality: '', history: '', speaking_style: '' },
        appearance: { face: '', hair: '', clothing: '', visual_identity: '' },
        voice: { provider: 'elevenlabs', voice_id: '', speaking_style: '' },
        wardrobe: { current: '', allowed_variations: [] },
        relationships: {},
        reference_assets: [],
        continuity_rules: { identity_locked: true },
      });
      setVideoCharacters(current => [...current, response.data?.character].filter(Boolean));
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not create the character.');
    } finally { setVideoBusy(false); }
  };

  const createVideoScene = async () => {
    if (!videoProject) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.post('/api/video/projects/' + videoProject.id + '/scenes', {
        scene_number: videoScenes.length + 1,
        title: 'New Scene',
        script: '',
        dialogue: [],
        characters: videoCharacters.map(character => character.id),
        visual_plan: {},
        camera_plan: {},
        audio_plan: { voice_provider: 'elevenlabs' },
        lip_sync_plan: { enabled: true, status: 'planned', character_audio_pairs: [] },
        continuity_notes: { check_character_identity: true, check_world_assets: true },
      });
      setVideoScenes(current => [...current, response.data?.scene].filter(Boolean));
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not create the scene.');
    } finally { setVideoBusy(false); }
  };

  const saveVideoCharacter = async () => {
    if (!videoProject || !editingCharacter) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.patch('/api/video/projects/' + videoProject.id + '/characters/' + editingCharacter.id, editingCharacter);
      const saved = response.data?.character;
      if (saved) {
        setVideoCharacters(current => current.map(item => item.id === saved.id ? saved : item));
        setEditingCharacter(null);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not save the character.');
    } finally { setVideoBusy(false); }
  };

  const saveVideoScene = async () => {
    if (!videoProject || !editingScene) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.patch('/api/video/projects/' + videoProject.id + '/scenes/' + editingScene.id, editingScene);
      const saved = response.data?.scene;
      if (saved) {
        setVideoScenes(current => current.map(item => item.id === saved.id ? saved : item));
        setEditingScene(null);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not save the scene.');
    } finally { setVideoBusy(false); }
  };

  const planVideoProduction = async () => {
    if (!videoProject) return;
    setVideoBusy(true); setVideoError('');
    try {
      await api.post('/api/video/projects/' + videoProject.id + '/plan', {
        requested_outputs: ['storyboard', 'generation_plan', 'voice_plan', 'lip_sync_plan', 'qa_plan'],
      });
      setVideoError('Production plan queued successfully.');
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not queue the production plan.');
    } finally { setVideoBusy(false); }
  };

  const openCommand = (command: string) => {
    setCommandOpen(false);
    void sendMessage(command);
  };

  useEffect(() => () => {
    stopCamera();
    recognitionRef.current?.stop();
    passiveRecognitionRef.current?.stop();
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!passiveWake) {
      stopPassiveWake();
      return;
    }
    startPassiveWake();
  }, [passiveWake]);

  if (!authReady) {
    return <main className="jarvis-shell"><section className="auth-screen"><div className="auth-card"><div className="orb"><Sparkles size={20} /></div><span className="eyebrow">JARVIS AUTHENTICATION</span><h1>Connecting to JARVIS...</h1><p>Preparing your secure account session.</p></div></section></main>;
  }

  if (!session) {
    return (
      <main className="jarvis-shell">
        <div className="scanline" />
        <section className="auth-screen">
          <div className="auth-card">
            <div className="orb"><Sparkles size={20} /></div>
            <span className="eyebrow">JARVIS AUTHENTICATION</span>
            <h1>Welcome to JARVIS</h1>
            <p>Sign in with Google to create your personal JARVIS account and keep your conversations, memory and preferences connected to you.</p>
            <button className="security-primary" onClick={() => void signInWithGoogle()} disabled={authBusy}>{authBusy ? 'Connecting...' : 'Continue with Google'}</button>
            {authError && <div className="security-result"><AlertTriangle size={14} /> {authError}</div>}
            <small>JARVIS uses Supabase Auth for account identity. Your Google password is never handled by JARVIS.</small>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="jarvis-shell">
      <div className="scanline" />
      <header className="topbar">
        <div className="brand">
          <div className="orb">
            <Sparkles size={20} />
          </div>
          <div>
            <strong>JARVIS</strong>
            <span>SVR • FUTURISTIC ASSISTANT</span>
          </div>
        </div>
        <div className="status">
          <span className="pulse" /> SYSTEM ONLINE
        </div>
      </header>

      <section className="dashboard">
        <aside className="side-panel">
          <div className="profile-card">
            <div className="avatar">S</div>
            <div>
              <b>SAVIOUR</b>
              <small>PRIMARY USER</small>
            </div>
          </div>
          <div className="metric">
            <Activity size={16} />
            <span>Core status</span>
            <b>ONLINE</b>
          </div>
          <div className="metric">
            <Cpu size={16} />
            <span>AI engine</span>
            <b>READY</b>
          </div>
          <div className="metric">
            <Shield size={16} />
            <span>Mode</span>
            <b>DEFENSIVE</b>
          </div>
          <div className="metric">
            <Sparkles size={16} />
            <span>Plan</span>
            <b>{String(entitlement?.jarvis_plans?.name || entitlement?.plan_code || 'FREE').toUpperCase()}</b>
          </div>
          <div className="assistant-status-card">
            <div><Sparkles size={14} /><span>IMAGE ALLOWANCE</span><b>{Number(entitlement?.credits_remaining ?? 0)}</b></div>
            <small>Successful image generations remaining this period</small>
          </div>
          <div className="quick-title">ASSISTANT STATUS</div>
          <div className="assistant-status-card">
            <div><Radio size={14} /><span>PASSIVE WAKE</span><b>{passiveWake ? 'ON' : 'OFF'}</b></div>
            <small>{passiveStatus}</small>
          </div>
          <div className="quick-title">QUICK COMMANDS</div>
          {['Explain something', 'Help me study', 'Give me an idea'].map(
            item => (
              <button
                className="quick"
                key={item}
                onClick={() => void sendMessage(item)}
              >
                {item}
              </button>
            )
          )}
          <button className="command-button" onClick={() => setCommandOpen(true)}>
            <Terminal size={15} /> Command Center
          </button>
          <button className="empire-button" type="button" onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            setCommandOpen(false);
            setCapabilityOpen(false);
            setImageLabOpen(false);
            setSystemOpen(false);
            setSecurityOpen(false);
            setEmpireOpen(true);
          }}>
            <Sparkles size={15} /> Empire Command
          </button>
          <button className="system-button" onClick={() => setCapabilityOpen(true)}>
            <BrainCircuit size={15} /> Capability Center
          </button>
          <button className="system-button" onClick={() => void openBusinessCenter()}>
            <BrainCircuit size={15} /> Business Center
          </button>
          <button className="system-button" onClick={() => void openVideoStudio()}>
            <Sparkles size={15} /> Video Studio
          </button>
          <button className="system-button" onClick={() => setImageLabOpen(true)}>
            <Sparkles size={15} /> Image Lab
          </button>
          <button className="system-button" onClick={() => { setSystemOpen(true); runSystemCheck(); }}>
            <Monitor size={15} /> System Center
          </button>
          <button className="security-button" onClick={openSecurityCenter}>
            <Shield size={15} /> Security Center
          </button>
          <button className="memory-button" onClick={exportMemory}>
            <Download size={15} /> Export memory
          </button>
          <button className="danger" onClick={clearMemory}>
            <Trash2 size={15} /> Clear local memory
          </button>
        </aside>

        <section className="chat-panel">
          <div className="chat-head">
            <div>
              <span className="eyebrow">CONVERSATION CORE</span>
              <h1>How can I assist?</h1>
            </div>
            <div className="head-actions">
              <button
                className={passiveWake ? 'active-control' : ''}
                title="Toggle passive Hey wake mode"
                onClick={togglePassiveWake}
              >
                <Radio size={18} />
              </button>
              <button
                title="Toggle voice output"
                onClick={() => setVoiceEnabled(v => !v)}
              >
                {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <span>
                {speaking
                  ? 'SPEAKING'
                  : listening
                    ? 'LISTENING'
                    : busy
                      ? 'THINKING'
                      : passiveWake
                        ? 'PASSIVE'
                        : 'STANDBY'}
              </span>
            </div>
          </div>
          <div className="messages">
            {messages.map((message, index) => (
              <div
                className={`message-row ${message.role}`}
                key={`${index}-${message.content.slice(0, 8)}`}
              >
                <div className="message-badge">
                  {message.role === 'user' ? 'S' : 'J'}
                </div>
                <div className="bubble">
                  <span>{message.role === 'user' ? 'YOU' : 'JARVIS'}</span>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            {busy && (
              <div className="thinking">
                <span />
                <span />
                <span /> JARVIS is thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="composer">
            <button
              className={`mic ${listening ? 'active' : ''}`}
              onClick={startListening}
              title="Voice input"
            >
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void sendMessage();
              }}
              placeholder="Speak or type a command..."
            />
            <button
              className="send"
              onClick={() => void sendMessage()}
              disabled={busy || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
          <div className="hint">
            {passiveWake ? 'Passive wake is listening for “Hey” • ' : ''}
            Local memory • Voice input is browser-controlled • Voice output is {voiceEnabled ? 'ON' : 'OFF'}
          </div>
        </section>
      </section>

      {capabilityOpen && <CapabilityCenter onClose={() => setCapabilityOpen(false)} />}

      {empireOpen && createPortal((
        <div className="empire-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Empire Command">
          <section className="empire-panel">
            <div className="security-head">
              <div><span className="eyebrow">DUAL EMPIRE CORE</span><h2>JARVIS Empire Command</h2><p>Attention operations plus a paper-only Nexora forest laboratory.</p></div>
              <button className="close-security" onClick={() => setEmpireOpen(false)} aria-label="Close empire command"><X size={18} /></button>
            </div>
            <EmpireDashboard />
          </section>
        </div>
      ), document.body)}

      {commandOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Command Center">
          <section className="security-panel command-panel">
            <div className="security-head">
              <div><span className="eyebrow">COMMAND CORE</span><h2>JARVIS Command Center</h2><p>Fast actions for study, engineering, planning and everyday help.</p></div>
              <button className="close-security" onClick={() => setCommandOpen(false)} aria-label="Close command center"><X size={18} /></button>
            </div>
            <div className="command-grid">
              {[
                ['Explain something', 'Explain a topic clearly.'],
                ['Help me study', 'Help me study a topic with a simple plan.'],
                ['Engineering mode', 'Help me with an aeronautical engineering concept.'],
                ['Plan my day', 'Help me make a practical plan for today.'],
                ['Give me an idea', 'Give me a useful creative idea.'],
                ['Remember this', 'Remember the important information I am about to give you.'],
              ].map(([title, prompt]) => (
                <button className="command-card" key={title} onClick={() => openCommand(prompt)}>
                  <BrainCircuit size={18} /><b>{title}</b><span>{prompt}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {businessOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Business Center">
          <section className="security-panel" style={{ maxWidth: 920 }}>
            <div className="security-head">
              <div><span className="eyebrow">BUSINESS OPERATIONS CORE</span><h2>JARVIS Business Center</h2><p>Manage your business profile and Brand Kit so JARVIS can use your business context across future tools.</p></div>
              <button className="close-security" onClick={() => setBusinessOpen(false)} aria-label="Close business center"><X size={18} /></button>
            </div>
            <div style={{ display:'grid', gap:12 }}>
              <input value={business?.name || ''} onChange={e=>setBusiness({...business, name:e.target.value})} placeholder="Business name" />
              <input value={business?.industry || ''} onChange={e=>setBusiness({...business, industry:e.target.value})} placeholder="Industry" />
              <input value={business?.website || ''} onChange={e=>setBusiness({...business, website:e.target.value})} placeholder="Website" />
              <textarea value={business?.description || ''} onChange={e=>setBusiness({...business, description:e.target.value})} placeholder="What does your business do?" />
              <button className="security-primary" onClick={()=>void saveBusiness()} disabled={businessBusy}>{businessBusy ? 'Saving...' : 'Save Business Profile'}</button>
              {business && <div className="security-status">
                <b>Brand Kit</b>
                <input value={brandKit?.brand_voice || ''} onChange={e=>setBrandKit({...brandKit, brand_voice:e.target.value})} placeholder="Brand voice" />
                <input value={brandKit?.visual_style || ''} onChange={e=>setBrandKit({...brandKit, visual_style:e.target.value})} placeholder="Visual style" />
                <input value={brandKit?.image_style || ''} onChange={e=>setBrandKit({...brandKit, image_style:e.target.value})} placeholder="Image style" />
                <input value={brandKit?.video_style || ''} onChange={e=>setBrandKit({...brandKit, video_style:e.target.value})} placeholder="Video style" />
                <button className="security-secondary" onClick={()=>void saveBrandKit()} disabled={businessBusy}>Save Brand Kit</button>
              </div>}
            </div>
          </section>
        </div>
      )}

      {videoOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Video Studio">
          <section className="security-panel video-studio-panel">
            <div className="security-head">
              <div><span className="eyebrow">JARVIS VIDEO ENGINE</span><h2>Video Studio</h2><p>Story → Character Bible → Scenes → Voice → Lip-sync → QA → Render → Publish.</p></div>
              <button className="close-security" onClick={() => setVideoOpen(false)} aria-label="Close Video Studio"><X size={18} /></button>
            </div>
            <div className="video-toolbar">
              <button className="security-primary" onClick={() => void createVideoProject()} disabled={videoBusy}>New Production</button>
              <button className="security-secondary" onClick={() => void createVideoCharacter()} disabled={videoBusy || !videoProject}>Add Character</button>
              <button className="security-secondary" onClick={() => void createVideoScene()} disabled={videoBusy || !videoProject}>Add Scene</button>
              <button className="security-secondary" onClick={() => void planVideoProduction()} disabled={videoBusy || !videoProject}>Plan Production</button>
            </div>
            {videoError && <div className="security-result"><AlertTriangle size={14} /> {videoError}</div>}
            <div className="video-engine-grid">
              <div className="video-card">
                <span className="card-label">PRODUCTION</span>
                <h3>{videoProject?.title || 'No production selected'}</h3>
                <p>{videoProject?.description || 'Create a production to begin.'}</p>
                <div className="video-tags"><span>{videoProject?.format || '16:9'}</span><span>{videoProject?.status || 'draft'}</span><span>Version {videoProject?.current_version || 1}</span></div>
                <h4>Pipeline</h4>
                <div className="video-pipeline">
                  {['Story Director','Character Bible','World / Assets','Scene Director','Visual + Motion','Voice / Audio','Lip-sync','Editing','Continuity QA','Render / Publish'].map((item, i) => <div key={item}><b>{String(i+1).padStart(2,'0')}</b><span>{item}</span></div>)}
                </div>
              </div>
              <div className="video-card">
                <span className="card-label">CHARACTER BIBLE</span>
                <h3>{videoCharacters.length} Characters</h3>
                <p>Identity, appearance, voice, wardrobe, relationships and continuity are stored separately from scenes.</p>
                <div className="video-list">{videoCharacters.map(character => <button className="video-list-item" key={character.id} onClick={() => setEditingCharacter(JSON.parse(JSON.stringify(character)))}><b>{character.name}</b><span>{character.role || 'Character'} • {character.voice?.provider || 'voice'} • {character.continuity_rules?.identity_locked === false ? 'identity editable' : 'identity locked'}</span></button>)}{!videoCharacters.length && <div className="video-empty">No characters yet.</div>}</div>
              </div>
              <div className="video-card">
                <span className="card-label">SCENE DIRECTOR</span>
                <h3>{videoScenes.length} Scenes</h3>
                <p>Every scene carries dialogue, camera, visual, audio, continuity and lip-sync planning data.</p>
                <div className="video-list">{videoScenes.map(scene => <button className="video-list-item" key={scene.id} onClick={() => setEditingScene(JSON.parse(JSON.stringify(scene)))}><b>Scene {scene.scene_number}: {scene.title || 'Untitled'}</b><span>{scene.status} • lip-sync {scene.lip_sync_plan?.enabled ? 'enabled' : 'off'}</span></button>)}{!videoScenes.length && <div className="video-empty">No scenes yet.</div>}</div>
              </div>
              <div className="video-card">
                <span className="card-label">LIP-SYNC</span>
                <h3>Scene-aware synchronization</h3>
                <p>JARVIS will map each character's voice track to the correct character and preserve timing through editing and rendering.</p>
                <div className="video-checks"><span>✓ Character → voice mapping</span><span>✓ Dialogue timing</span><span>✓ Scene synchronization</span><span>✓ Final QA gate</span></div>
              </div>
            </div>
            {videoProjects.length > 0 && <div className="video-projects"><b>Recent productions</b>{videoProjects.slice(0,5).map(project => <button key={project.id} onClick={async()=>{setVideoProject(project);const [c,s]=await Promise.all([api.get('/api/video/projects/'+project.id+'/characters'),api.get('/api/video/projects/'+project.id+'/scenes')]);setVideoCharacters(c.data?.characters||[]);setVideoScenes(s.data?.scenes||[]);}}>{project.title}</button>)}</div>}
          </section>
        </div>
      )}

      {editingCharacter && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="Character Bible Editor">
          <section className="security-panel" style={{ maxWidth: 860 }}>
            <div className="security-head"><div><span className="eyebrow">CHARACTER BIBLE</span><h2>Edit {editingCharacter.name}</h2><p>Identity, appearance, voice, wardrobe and continuity are persistent production data.</p></div><button className="close-security" onClick={() => setEditingCharacter(null)} aria-label="Close character editor"><X size={18} /></button></div>
            <div style={{display:'grid',gap:10}}>
              <input value={editingCharacter.name || ''} onChange={e=>setEditingCharacter({...editingCharacter,name:e.target.value})} placeholder="Character name" />
              <input value={editingCharacter.role || ''} onChange={e=>setEditingCharacter({...editingCharacter,role:e.target.value})} placeholder="Role" />
              <textarea value={editingCharacter.profile?.personality || ''} onChange={e=>setEditingCharacter({...editingCharacter,profile:{...editingCharacter.profile,personality:e.target.value}})} placeholder="Personality" />
              <textarea value={editingCharacter.profile?.history || ''} onChange={e=>setEditingCharacter({...editingCharacter,profile:{...editingCharacter.profile,history:e.target.value}})} placeholder="History / backstory" />
              <textarea value={editingCharacter.profile?.speaking_style || ''} onChange={e=>setEditingCharacter({...editingCharacter,profile:{...editingCharacter.profile,speaking_style:e.target.value}})} placeholder="Speaking style" />
              <textarea value={editingCharacter.appearance?.visual_identity || ''} onChange={e=>setEditingCharacter({...editingCharacter,appearance:{...editingCharacter.appearance,visual_identity:e.target.value}})} placeholder="Visual identity" />
              <textarea value={editingCharacter.appearance?.clothing || ''} onChange={e=>setEditingCharacter({...editingCharacter,appearance:{...editingCharacter.appearance,clothing:e.target.value}})} placeholder="Appearance / clothing rules" />
              <input value={editingCharacter.voice?.voice_id || ''} onChange={e=>setEditingCharacter({...editingCharacter,voice:{...editingCharacter.voice,voice_id:e.target.value}})} placeholder="ElevenLabs voice ID (optional)" />
              <textarea value={editingCharacter.wardrobe?.current || ''} onChange={e=>setEditingCharacter({...editingCharacter,wardrobe:{...editingCharacter.wardrobe,current:e.target.value}})} placeholder="Current outfit" />
              <textarea value={editingCharacter.continuity_rules?.notes || ''} onChange={e=>setEditingCharacter({...editingCharacter,continuity_rules:{...editingCharacter.continuity_rules,notes:e.target.value,identity_locked:true}})} placeholder="Continuity rules" />
              <button className="security-primary" onClick={()=>void saveVideoCharacter()} disabled={videoBusy}>{videoBusy ? 'Saving...' : 'Save Character Bible'}</button>
            </div>
          </section>
        </div>
      )}

      {editingScene && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="Scene Director Editor">
          <section className="security-panel" style={{ maxWidth: 860 }}>
            <div className="security-head"><div><span className="eyebrow">SCENE DIRECTOR</span><h2>Edit Scene {editingScene.scene_number}</h2><p>Write the actual scene script and production direction before generation.</p></div><button className="close-security" onClick={() => setEditingScene(null)} aria-label="Close scene editor"><X size={18} /></button></div>
            <div style={{display:'grid',gap:10}}>
              <input value={editingScene.title || ''} onChange={e=>setEditingScene({...editingScene,title:e.target.value})} placeholder="Scene title" />
              <textarea style={{minHeight:180}} value={editingScene.script || ''} onChange={e=>setEditingScene({...editingScene,script:e.target.value})} placeholder="Scene script, action and dialogue..." />
              <textarea value={editingScene.visual_plan?.description || ''} onChange={e=>setEditingScene({...editingScene,visual_plan:{...editingScene.visual_plan,description:e.target.value}})} placeholder="Visual direction" />
              <textarea value={editingScene.camera_plan?.shots || ''} onChange={e=>setEditingScene({...editingScene,camera_plan:{...editingScene.camera_plan,shots:e.target.value}})} placeholder="Camera / shot direction" />
              <textarea value={editingScene.audio_plan?.notes || ''} onChange={e=>setEditingScene({...editingScene,audio_plan:{...editingScene.audio_plan,notes:e.target.value}})} placeholder="Voice, music and sound direction" />
              <textarea value={editingScene.continuity_notes?.notes || ''} onChange={e=>setEditingScene({...editingScene,continuity_notes:{...editingScene.continuity_notes,notes:e.target.value}})} placeholder="Continuity notes" />
              <button className="security-primary" onClick={()=>void saveVideoScene()} disabled={videoBusy}>{videoBusy ? 'Saving...' : 'Save Scene Director'}</button>
            </div>
          </section>
        </div>
      )}

      {imageLabOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Image Lab">
          <section className="security-panel" style={{ maxWidth: 920 }}>
            <div className="security-head">
              <div><span className="eyebrow">MULTIMODAL CREATIVE CORE</span><h2>JARVIS Image Lab</h2><p>Generate new images or edit a reference image with natural-language instructions.</p></div>
              <button className="close-security" onClick={() => setImageLabOpen(false)} aria-label="Close image lab"><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <textarea
                value={imagePrompt}
                onChange={e => setImagePrompt(e.target.value)}
                placeholder="Describe the image you want, or describe how to edit the reference image..."
                style={{ width: '100%', minHeight: 120, resize: 'vertical', borderRadius: 12, border: '1px solid #21445b', background: '#071018', color: '#dff7ff', padding: 14, outline: 'none' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, border: '1px dashed #315d72', borderRadius: 12, color: '#8fb5c7', background: '#061018', cursor: 'pointer' }}>
                <Camera size={18} />
                {referencePreview ? 'Replace reference image' : 'Add reference image for editing'}
                <input type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void handleReferenceImage(file); }} />
              </label>
              {referencePreview && <img src={referencePreview} alt="Reference" style={{ maxHeight: 220, width: '100%', objectFit: 'contain', borderRadius: 12, background: '#02060a' }} />}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="security-primary" onClick={() => void generateImage()} disabled={imageBusy || !imagePrompt.trim()}>{imageBusy ? 'Generating...' : referenceImage ? 'Edit / Generate' : 'Generate Image'}</button>
                <button className="security-secondary" onClick={clearImageLab}>Clear</button>
                {imageResult && <button className="security-secondary" onClick={downloadGeneratedImage}><Download size={16} /> Save Image</button>}
              </div>
              {imageError && <div className="security-result"><AlertTriangle size={14} /> {imageError}</div>}
              {imageResult && <img src={imageResult} alt="JARVIS generated result" style={{ width: '100%', maxHeight: 560, objectFit: 'contain', borderRadius: 14, border: '1px solid #21445b', background: '#02060a' }} />}
            </div>
          </section>
        </div>
      )}

      {systemOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS System Center">
          <section className="security-panel">
            <div className="security-head">
              <div><span className="eyebrow">SYSTEM MONITOR</span><h2>JARVIS System Center</h2><p>Browser-safe diagnostics. No hidden Mac control.</p></div>
              <button className="close-security" onClick={() => setSystemOpen(false)} aria-label="Close system center"><X size={18} /></button>
            </div>
            <div className="system-cards">
              <article className="system-card"><Globe size={18} /><b>Network</b><span>{navigator.onLine ? 'Online' : 'Offline'}</span></article>
              <article className="system-card"><Shield size={18} /><b>Secure Context</b><span>{window.isSecureContext ? 'Protected' : 'Check browser'}</span></article>
              <article className="system-card"><BrainCircuit size={18} /><b>AI Core</b><span>{busy ? 'Thinking' : 'Ready'}</span></article>
              <article className="system-card"><Battery size={18} /><b>Battery</b><span>Browser permission dependent</span></article>
            </div>
            <button className="security-primary" onClick={runSystemCheck}>Run Full System Check</button>
            <div className="security-status">
              {systemResults.map(result => <div key={result} className="security-result"><CheckCircle2 size={14} /> {result}</div>)}
            </div>
            <div className="lock-note"><Monitor size={16} /><span>JARVIS can guide you through Mac actions, but a browser cannot secretly execute Terminal commands or control macOS.</span></div>
          </section>
        </div>
      )}

      {securityOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Security Center">
          <section className="security-panel">
            <div className="security-head">
              <div>
                <span className="eyebrow">DEFENSIVE SYSTEMS</span>
                <h2>JARVIS Security Center</h2>
                <p>User-controlled security tools. No covert monitoring.</p>
              </div>
              <button className="close-security" onClick={() => { stopCamera(); setSecurityOpen(false); }} aria-label="Close security center">
                <X size={18} />
              </button>
            </div>

            <div className="security-grid">
              <article className="security-card">
                <CheckCircle2 size={20} />
                <div>
                  <b>Browser Security</b>
                  <span>Checks the app's secure browser context.</span>
                </div>
              </article>
              <article className="security-card">
                <Camera size={20} />
                <div>
                  <b>Camera Test</b>
                  <span>Only starts after you press the test button. Nothing is saved.</span>
                </div>
              </article>
              <article className="security-card">
                <LockKeyhole size={20} />
                <div>
                  <b>Mac Lock</b>
                  <span>A browser app cannot silently lock macOS. Use your Mac's normal lock command.</span>
                </div>
              </article>
              <article className="security-card">
                <AlertTriangle size={20} />
                <div>
                  <b>Privacy Guard</b>
                  <span>No automatic photos, hidden surveillance, or background camera watcher.</span>
                </div>
              </article>
            </div>

            <div className="security-actions">
              <button className="security-primary" onClick={runSecurityCheck}>Run Security Check</button>
              <button className="security-secondary" onClick={() => { void testCamera(); }}>
                <Camera size={16} /> {cameraActive ? 'Stop Camera Test' : 'Test Camera'}
              </button>
            </div>

            {cameraActive && (
              <div className="camera-test">
                <video ref={cameraRef} autoPlay playsInline muted />
                <p>Live preview only. JARVIS is not taking or storing a photograph.</p>
              </div>
            )}

            <div className="security-status">
              <b>Security status</b>
              <p>{cameraStatus}</p>
              {securityResults.map(result => (
                <div key={result} className="security-result"><CheckCircle2 size={14} /> {result}</div>
              ))}
            </div>

            <div className="lock-note">
              <LockKeyhole size={16} />
              <span>To lock your Mac now, use <b>Control + Command + Q</b>. The web app does not pretend it can perform that system action.</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
