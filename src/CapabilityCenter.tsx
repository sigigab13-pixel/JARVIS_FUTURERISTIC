import { useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, LockKeyhole, Radio, X } from 'lucide-react';
import './capability-center.css';

type CapabilityStatus = 'READY' | 'AUTH REQUIRED' | 'PLANNED' | 'DEMO ONLY';

type Capability = {
  name: string;
  description: string;
  status: CapabilityStatus;
};

const offices: Capability[] = [
  { name: 'Trend Office', description: 'Observes content trends and records ideas worth testing.', status: 'READY' },
  { name: 'Hook Office', description: 'Creates opening hooks and tests alternative angles.', status: 'READY' },
  { name: 'Script Office', description: 'Builds scripts, narration and serialized story parts.', status: 'READY' },
  { name: 'Fact Check Office', description: 'Flags claims that need verification and sources.', status: 'READY' },
  { name: 'Voice Office', description: 'Plans character and narration voice direction.', status: 'READY' },
  { name: 'Clip Office', description: 'Plans Shorts and short-form cuts from longer stories.', status: 'READY' },
  { name: 'Thumbnail Office', description: 'Creates thumbnail concepts and visual direction.', status: 'READY' },
  { name: 'Edit Office', description: 'Builds the edit checklist and delivery package.', status: 'READY' },
  { name: 'TikTok Office', description: 'Prepares TikTok-ready vertical content and captions.', status: 'READY' },
  { name: 'YouTube Office', description: 'Prepares YouTube masters, titles and descriptions.', status: 'READY' },
  { name: 'Posting Office', description: 'Maintains the publishing queue and records real status.', status: 'READY' },
  { name: 'Approval Office', description: 'Keeps publishing behind an explicit approval gate.', status: 'READY' },
  { name: 'Analytics Office', description: 'Reads available performance metrics and trends.', status: 'READY' },
  { name: 'Kings Office', description: 'Finds strong concepts for controlled follow-up experiments.', status: 'READY' },
  { name: 'Clone Office', description: 'Creates related test concepts without declaring them winners.', status: 'READY' },
  { name: 'Graveyard Office', description: 'Archives failed experiments with their final audit notes.', status: 'READY' },
  { name: 'Experiment Office', description: 'Creates the next measurable content or strategy test.', status: 'READY' },
  { name: 'Analytics Boss', description: 'Summarizes Forest observations for the JARVIS core.', status: 'READY' },
];

const capabilities: Capability[] = [
  { name: 'Conversation + Memory', description: 'Chat, local conversation history and user-controlled memory export.', status: 'READY' },
  { name: 'Voice Input + Passive Hey Wake', description: 'Browser-controlled voice input and passive wake workflow.', status: 'READY' },
  { name: 'AI Image Lab', description: 'Generate and edit images through the connected AI image service.', status: 'READY' },
  { name: 'AI Story Director', description: 'Creates structured stories with English-only fictional names and persistent character IDs.', status: 'READY' },
  { name: 'Character Continuity', description: 'Carries character identity, appearance and voice direction across scenes.', status: 'READY' },
  { name: 'Voice Engine', description: 'Google Cloud TTS pipeline with browser fallback when configured.', status: 'READY' },
  { name: 'Lip-Sync Video Layer', description: 'Designed for external video/lip-sync providers; provider availability must be verified before claiming final video.', status: 'PLANNED' },
  { name: 'Forest Daily Content Loop', description: 'Trend → story → parts → write-ups → quality gate → publishing queue → analytics.', status: 'READY' },
  { name: 'YouTube Publishing', description: 'Publishing workflow with status tracking; official account authorization is required.', status: 'AUTH REQUIRED' },
  { name: 'TikTok Publishing', description: 'Publishing workflow with status tracking; official account authorization is required.', status: 'AUTH REQUIRED' },
  { name: 'Facebook Publishing', description: 'Publishing workflow with status tracking; official account authorization is required.', status: 'AUTH REQUIRED' },
  { name: 'NEXORA Strategy Lab', description: 'Paper-only strategy experiments, backtests and trade journals.', status: 'DEMO ONLY' },
  { name: 'NEXORA Bot Life Cycle', description: 'Tracks survival, risk limits and final audit records for simulated bots.', status: 'DEMO ONLY' },
  { name: 'Defensive Security Center', description: 'Browser-safe diagnostics and explicit user-controlled security actions.', status: 'READY' },
  { name: 'System Center', description: 'Browser-safe network, secure-context and AI-core diagnostics.', status: 'READY' },
];

const statusIcon = (status: CapabilityStatus) => {
  if (status === 'READY') return <CheckCircle2 size={14} />;
  if (status === 'AUTH REQUIRED') return <LockKeyhole size={14} />;
  if (status === 'DEMO ONLY') return <Radio size={14} />;
  return <CircleDashed size={14} />;
};

export default function CapabilityCenter({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<'all' | 'ready' | 'attention'>('all');
  const readyCount = capabilities.filter(item => item.status === 'READY').length;
  const attentionCount = capabilities.filter(item => item.status !== 'READY').length;
  const visibleCapabilities = useMemo(() => capabilities.filter(item => filter === 'all' || (filter === 'ready' ? item.status === 'READY' : item.status !== 'READY')), [filter]);

  return (
    <div className="capability-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Capability Center">
      <section className="capability-panel">
        <header className="capability-head">
          <div>
            <span className="eyebrow">SELF-AWARE CONTROL PLANE</span>
            <h2>JARVIS Capability Center</h2>
            <p>JARVIS knows what each office does, what is ready, and what still requires an external connection or authorization.</p>
          </div>
          <button onClick={onClose} aria-label="Close capability center"><X size={18} /></button>
        </header>

        <div className="capability-summary">
          <div><span>CAPABILITIES</span><b>{capabilities.length}</b></div>
          <div><span>READY</span><b>{readyCount}</b></div>
          <div><span>ATTENTION</span><b>{attentionCount}</b></div>
          <div><span>OFFICES</span><b>{offices.length}</b></div>
        </div>

        <div className="capability-filters">
          <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All capabilities</button>
          <button className={filter === 'ready' ? 'selected' : ''} onClick={() => setFilter('ready')}>Ready</button>
          <button className={filter === 'attention' ? 'selected' : ''} onClick={() => setFilter('attention')}>Needs attention</button>
        </div>

        <div className="capability-grid">
          {visibleCapabilities.map(item => (
            <article className="capability-card" key={item.name}>
              <div className="capability-card-top"><b>{item.name}</b><span className={`capability-status ${item.status.toLowerCase().replaceAll(' ', '-')}`}>{statusIcon(item.status)} {item.status}</span></div>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <div className="office-registry">
          <div className="office-registry-head"><div><span className="eyebrow">18-OFFICE REGISTRY</span><h3>Every office has a defined job</h3></div><span className="registry-live">SERIAL WORKFLOW MAP</span></div>
          <div className="office-registry-grid">
            {offices.map((office, index) => (
              <div className="office-registry-item" key={office.name}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><b>{office.name}</b><small>{office.description}</small></div>
              </div>
            ))}
          </div>
        </div>

        <div className="capability-note">
          <b>JARVIS operating rule:</b> it must report the real state of a capability. It cannot claim that a video was generated, a post was published, or a trade happened unless the connected service actually confirms it.
        </div>
      </section>
    </div>
  );
}
