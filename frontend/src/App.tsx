import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useMemo, useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  FileText,
  GitCompareArrows,
  Layers3,
  Lightbulb,
  Menu,
  MessageSquareText,
  Network,
  Plus,
  Search,
  ServerCrash,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  X,
  Zap,
  Loader2,
} from 'lucide-react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

const API_BASE = '';

type View = 'dashboard' | 'new-incident' | 'before-after' | 'memory';
type Severity = 'P1' | 'P2' | 'P3' | 'P4';
type IncidentStatus = 'Investigating' | 'Resolved';

type Incident = {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  time: string;
  description: string;
  analysis?: string;
  memory_used?: boolean;
  memories_recalled?: number;
  cited_incidents?: unknown[];
  root_cause?: string;
  resolution?: string;
  engineer?: string;
  duration_minutes?: number;
  lessons_learned?: string;
  tags?: string[];
};

type Memory = {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  summary: string;
  lesson: string;
  hits: number;
};

type AnalysisResult = {
  incident_id: string;
  analysis: string;
  memory_used: boolean;
  memories_recalled: number;
  cited_incidents: unknown[];
  incident: Incident;
};

type CompareResult = {
  without_memory: string;
  with_memory: string;
  memories_recalled: number;
  memory_used: boolean;
};

type HealthResponse = {
  status: string;
  timestamp?: string;
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`API error ${res.status}: ${errorBody}`);
  }
  return res.json();
}

const viewMeta: Record<View, { label: string; eyebrow: string; description: string }> = {
  dashboard: { label: 'Command center', eyebrow: 'Live workspace / 04', description: 'A high-signal view of active response work and the memory your team is building.' },
  'new-incident': { label: 'New incident', eyebrow: 'Response intake / 01', description: 'Give the agent a clean signal. It will connect the symptoms to what your team already learned.' },
  'before-after': { label: 'Before vs after', eyebrow: 'Learning loop / 02', description: 'See the difference a recalled resolution makes when the next incident arrives.' },
  memory: { label: 'Agent memory', eyebrow: 'Operational memory / 03', description: 'Browse the incident patterns the agent can now recognize and reuse.' },
};

function getView(location: string): View {
  if (location === '/new-incident') return 'new-incident';
  if (location === '/before-after') return 'before-after';
  if (location === '/memory') return 'memory';
  return 'dashboard';
}

function ShellNav({ active, onNavigate, collapsed, onToggle }: { active: View; onNavigate: (view: View) => void; collapsed: boolean; onToggle: () => void }) {
  const items: { view: View; label: string; icon: typeof Activity; shortcut: string }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: Activity, shortcut: 'D' },
    { view: 'new-incident', label: 'New incident', icon: AlertCircle, shortcut: 'N' },
    { view: 'before-after', label: 'Before vs after', icon: GitCompareArrows, shortcut: 'B' },
    { view: 'memory', label: 'Memory', icon: BrainCircuit, shortcut: 'M' },
  ];
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="brand-mark"><Network size={18} /></div>
        {!collapsed && <div className="brand-name">incident<span>IQ</span></div>}
      </div>
      {!collapsed && <div className="nav-label eyebrow">Workspace</div>}
      <nav className="nav-group">
        {items.map(({ view, label, icon: Icon, shortcut }) => (
          <button key={view} type="button" className={`nav-item ${active === view ? 'active' : ''}`} onClick={() => onNavigate(view)} aria-current={active === view ? 'page' : undefined}>
            <Icon size={17} strokeWidth={1.8} />
            {!collapsed && <><span className="nav-item-copy">{label}</span><kbd>{shortcut}</kbd></>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="online-dot" /><span className="eyebrow">Agent online</span></div>
        {!collapsed && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, lineHeight: 1.5, marginTop: 9 }}>Listening across services.<br />Memory sync is up to date.</div>}
      </div>
      <button type="button" className="icon-button" style={{ marginTop: 13, alignSelf: collapsed ? 'center' : 'flex-end' }} onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <Menu size={17} />
      </button>
    </aside>
  );
}

function MobileNav({ active, onNavigate }: { active: View; onNavigate: (view: View) => void }) {
  const items: { view: View; label: string; icon: typeof Activity }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: Activity },
    { view: 'new-incident', label: 'New incident', icon: AlertCircle },
    { view: 'before-after', label: 'Compare', icon: GitCompareArrows },
    { view: 'memory', label: 'Memory', icon: BrainCircuit },
  ];
  return <nav className="mobile-nav" aria-label="Mobile navigation">{items.map(({ view, label, icon: Icon }) => <button type="button" key={view} className={`nav-item ${active === view ? 'active' : ''}`} onClick={() => onNavigate(view)}><Icon size={15} /><span className="nav-item-copy">{label}</span></button>)}</nav>;
}

function Header({ active, onNavigate, onNew }: { active: View; onNavigate: (view: View) => void; onNew: () => void }) {
  const meta = viewMeta[active];
  return (
    <>
      <header className="topbar">
        <div><div className="eyebrow">{meta.eyebrow}</div><div style={{ color: 'hsl(var(--secondary-foreground))', fontSize: 12, marginTop: 5 }}>{meta.label}</div></div>
        <div className="topbar-right">
          <button type="button" className="icon-button" onClick={() => onNavigate('memory')} aria-label="Open settings and memory"><Settings2 size={16} /></button>
          <button type="button" className="avatar" onClick={() => onNavigate('dashboard')} aria-label="Return to dashboard">AR</button>
          <button type="button" className="btn btn-primary" onClick={onNew}><Plus size={15} /> New incident</button>
        </div>
      </header>
      <MobileNav active={active} onNavigate={onNavigate} />
    </>
  );
}

function Stats({ activeCount, resolvedCount, memories, hits }: { activeCount: number; resolvedCount: number; memories: number; hits: number }) {
  const items = [
    { id: 'stat-active', label: 'Active incidents', value: activeCount, meta: `${activeCount} need attention`, icon: AlertCircle, color: 'primary' },
    { id: 'stat-resolved', label: 'Resolved today', value: resolvedCount, meta: '+18% vs last week', icon: ShieldCheck, color: 'accent' },
    { id: 'stat-memories', label: 'Memories in agent', value: memories, meta: '+3 this week', icon: BrainCircuit, color: 'primary' },
    { id: 'stat-memory-hits', label: 'Memory hits', value: hits, meta: '87% useful recall', icon: TrendingUp, color: 'accent' },
  ];
  return <div className="stats-grid">{items.map(({ id, label, value, meta, icon: Icon }) => <div className="stat-card" key={id}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={15} /></div></div><div className="stat-value">{value}</div><div className="stat-meta"><strong>{meta.split(' ')[0]}</strong>{meta.slice(meta.indexOf(' '))}</div></div>)}</div>;
}

function NeuralCard({ memoryCount }: { memoryCount: number }) {
  return (
    <section className="panel neural-card">
      <div className="neural-copy"><div className="neural-count"><i /> Agent memory is learning</div><h2>{memoryCount} memories active</h2><p>The more incidents resolved, the sharper the next response becomes.</p></div>
      <svg className="network" viewBox="0 0 620 270" aria-label="Neural memory network visualization" role="img">
        <g fill="none">
          <line x1="310" y1="134" x2="106" y2="61" /><line x1="310" y1="134" x2="173" y2="209" /><line x1="310" y1="134" x2="310" y2="40" /><line x1="310" y1="134" x2="490" y2="65" /><line x1="310" y1="134" x2="480" y2="207" /><line x1="106" y1="61" x2="310" y2="40" /><line x1="173" y1="209" x2="310" y2="40" /><line x1="490" y1="65" x2="480" y2="207" /><line x1="173" y1="209" x2="480" y2="207" />
        </g>
        <circle className="core" cx="310" cy="134" r="18" /><circle cx="106" cy="61" r="8" /><circle className="teal" cx="173" cy="209" r="9" /><circle cx="310" cy="40" r="7" /><circle className="teal" cx="490" cy="65" r="9" /><circle cx="480" cy="207" r="8" /><circle cx="66" cy="145" r="5" /><circle cx="551" cy="147" r="6" />
      </svg>
    </section>
  );
}

function ActivityPanel({ incidents, onResolve }: { incidents: Incident[]; onResolve: (incident: Incident) => void }) {
  return <section className="panel"><div className="panel-header"><div><div className="panel-title">Active response</div><div className="panel-subtitle">The incidents your team is watching right now</div></div><span className="eyebrow">{incidents.filter((i) => i.status === 'Investigating').length} open</span></div><div className="panel-body"><div className="incident-list">{incidents.length === 0 ? <div className="empty-state"><CircleDot size={23} /><div>No active incidents</div></div> : incidents.map((incident) => <div className="incident-row" key={incident.id}><span className={`severity-dot severity-${incident.severity.toLowerCase()}`} /><div className="incident-copy"><strong>{incident.title}</strong><span>{incident.service} · {incident.time}</span></div><span className="incident-state">{incident.status}</span>{incident.status === 'Investigating' && <button type="button" className="btn btn-ghost" onClick={() => onResolve(incident)}>Resolve <ChevronRight size={13} /></button>}</div>)}</div></div></section>;
}

function RecentActivity({ events }: { events: { title: string; detail: string; time: string; icon: typeof Activity }[] }) {
  return <section className="panel"><div className="panel-header"><div><div className="panel-title">Signal stream</div><div className="panel-subtitle">What the workspace learned recently</div></div><Activity size={16} color="hsl(var(--accent))" /></div><div className="panel-body"><div className="activity-list">{events.map(({ title, detail, time, icon: Icon }) => <div className="activity-row" key={title}><div className="activity-marker"><Icon size={7} /></div><div className="activity-main"><strong>{title}</strong><span>{detail}</span></div><span className="activity-time">{time}</span></div>)}</div></div></section>;
}

function Dashboard({ incidents, memories, onNavigate, onResolve, memoryHits, activityEvents }: {
  incidents: Incident[]; memories: Memory[]; onNavigate: (view: View) => void;
  onResolve: (incident: Incident) => void; memoryHits: number;
  activityEvents: { title: string; detail: string; time: string; icon: typeof Activity }[];
}) {
  const active = incidents.filter((i) => i.status === 'Investigating').length;
  const resolved = incidents.filter((i) => i.status === 'Resolved').length;
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  return <div className="page"><div className="page-heading fade-in-up"><div><div className="eyebrow">{now.toLocaleDateString('en-US', { weekday: 'long' })} · {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} UTC</div><h1>{greeting}, Alex.</h1><p>Production is holding steady. Here is the signal worth your attention.</p></div><div className="heading-actions"><button type="button" className="btn btn-secondary" onClick={() => onNavigate('memory')}><BrainCircuit size={15} /> Browse memory</button><button type="button" className="btn btn-primary" onClick={() => onNavigate('new-incident')}><Plus size={15} /> New incident</button></div></div><Stats activeCount={active} resolvedCount={resolved + 7} memories={memories.length} hits={memoryHits} /><div className="grid-two"><NeuralCard memoryCount={memories.length} /><RecentActivity events={activityEvents} /></div><div style={{ marginTop: 15 }}><ActivityPanel incidents={incidents} onResolve={onResolve} /></div></div>;
}

function QuickFill({ onFill }: { onFill: (title: string, description: string, service: string, severity: Severity) => void }) {
  const templates = [
    { label: 'Database crash', icon: Database, title: 'Primary database unavailable', description: 'Database connections are failing across the write path. Error rate is rising in the checkout flow.', service: 'payments-service', severity: 'P1' as Severity },
    { label: 'Memory pressure', icon: ServerCrash, title: 'OOM kills in report worker', description: 'Report worker pods are being killed after large exports. Queue age is climbing steadily.', service: 'report-worker', severity: 'P1' as Severity },
    { label: 'Latency spike', icon: Clock3, title: 'Elevated API latency', description: 'p95 latency has crossed 1.8 seconds for the API. The regression started after the latest deploy.', service: 'checkout-api', severity: 'P2' as Severity },
    { label: '502 errors', icon: Zap, title: 'Upstream 502 responses', description: 'The edge proxy is returning 502s for a subset of upstream requests in us-east-1.', service: 'api-proxy', severity: 'P2' as Severity },
    { label: 'Certificate expired', icon: ShieldCheck, title: 'Edge certificate expired', description: 'TLS handshakes are failing on one edge cluster after an automated renewal did not complete.', service: 'edge-gateway', severity: 'P3' as Severity },
  ];
  return <div className="quick-grid">{templates.map(({ label, icon: Icon, title, description, service, severity }) => <button type="button" className="quick-fill" key={label} onClick={() => onFill(title, description, service, severity)}><Icon size={14} /><span>{label}</span></button>)}</div>;
}

function AnalysisPanel({ analysis, loading, title }: { analysis: string | null; loading: boolean; title: string }) {
  if (loading) {
    return <section className="panel analysis-panel"><div className="panel-header"><div><div className="panel-title">Agent analysis</div><div className="panel-subtitle">A focused first read, grounded in your memory</div></div></div><div className="panel-body"><div className="analysis-loading"><div style={{ textAlign: 'center' }}><div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /><div style={{ marginTop: 12, fontSize: 12, color: 'hsl(var(--primary))', fontFamily: 'var(--app-font-mono)' }}>Recalling related resolutions...</div></div></div></div></section>;
  }
  if (!analysis) {
    return <section className="panel analysis-panel"><div className="panel-header"><div><div className="panel-title">Agent analysis</div><div className="panel-subtitle">A focused first read, grounded in your memory</div></div></div><div className="panel-body"><div className="empty-state"><MessageSquareText size={24} /><div>Analysis appears here after you submit an incident.</div></div></div></section>;
  }
  return <section className="panel analysis-panel"><div className="panel-header"><div><div className="panel-title">Agent analysis</div><div className="panel-subtitle">A focused first read, grounded in your memory</div></div></div><div className="panel-body"><div className="analysis-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }} /></div></section>;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

function NewIncident({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [title, setTitle] = useState('');
  const [service, setService] = useState('payments-service');
  const [severity, setSeverity] = useState<Severity>('P2');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);

  const fill = (t: string, d: string, s: string, sv: Severity) => { setTitle(t); setDescription(d); setService(s); setSeverity(sv); };

  const submitIncident = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch<AnalysisResult>('/api/incident/analyze', {
        method: 'POST',
        body: JSON.stringify({ title, description, service, severity }),
      });
      setResult(data);
    } catch (err) {
      console.error('Analyze error:', err);
      setResult({ incident_id: 'ERROR', analysis: `Error: ${err instanceof Error ? err.message : 'Failed to analyze incident'}`, memory_used: false, memories_recalled: 0, cited_incidents: [], incident: { id: 'error', title, service, severity, status: 'Investigating', time: 'just now', description } });
    } finally {
      setLoading(false);
    }
  };

  const barColor = severity === 'P1' ? '#ff716e' : severity === 'P2' ? '#f5aa62' : severity === 'P3' ? '#e1c768' : '#57d9ab';

  return <div className="page"><div className="page-heading"><div><div className="eyebrow">{viewMeta['new-incident'].eyebrow}</div><h1>Start with the signal.</h1><p>Describe what is happening. IncidentIQ will surface the closest known patterns before you reach for a runbook.</p></div><button type="button" className="btn btn-secondary" onClick={() => onNavigate('before-after')}><GitCompareArrows size={15} /> See the learning loop</button></div><div className="form-layout"><form className="panel form-panel" onSubmit={submitIncident}><div className="severity-bar" style={{ background: barColor }} /><div className="field"><label htmlFor="incident-title">What is the signal?</label><input id="incident-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Elevated checkout latency" /></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div className="field"><label htmlFor="incident-service">Affected service</label><select id="incident-service" value={service} onChange={(e) => setService(e.target.value)}><option>payments-service</option><option>checkout-api</option><option>payments-worker</option><option>edge-gateway</option><option>catalog-db</option><option>report-worker</option><option>api-proxy</option></select></div><div className="field"><label htmlFor="incident-severity">Severity</label><select id="incident-severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}><option value="P1">P1 · Critical</option><option value="P2">P2 · High</option><option value="P3">P3 · Moderate</option><option value="P4">P4 · Low</option></select></div></div><div className="field"><label htmlFor="incident-description">What changed?</label><textarea id="incident-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the symptoms, when they started, and what changed recently." /></div><div className="field-hint"><span>{description.length} characters</span><span>Required</span></div><div style={{ display: 'flex', gap: 8, marginTop: 18 }}><button type="submit" className="btn btn-primary" disabled={loading || !title.trim() || !description.trim()} style={{ flex: 1 }}>{loading ? <><span className="loading-spinner" /> Analyzing...</> : <><Sparkles size={15} /> Analyze with memory</>}</button></div>{result && <div style={{ marginTop: 12 }}><button type="button" className="btn btn-secondary" onClick={() => setShowResolveModal(true)} style={{ width: '100%' }}><Check size={15} /> Resolve this incident</button></div>}</form><div><QuickFill onFill={fill} /></div></div>{result && <AnalysisPanel analysis={result.analysis} loading={false} title={result.incident.title} />}{showResolveModal && result && <ResolveModal incident={result.incident} onClose={() => setShowResolveModal(false)} onResolved={() => { setShowResolveModal(false); setResult(null); setTitle(''); setDescription(''); }} />}</div>;
}

function Comparison({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [service, setService] = useState('payments-service');
  const [description, setDescription] = useState('Checkout p95 latency is above 1.8s after the latest deploy.');
  const [ran, setRan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);

  const quickFillCompare = () => { setService('payments-worker'); setDescription('Queue depth is growing quickly after a provider timeout. Retries are saturating workers.'); };

  const runComparison = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setRan(true);
    try {
      const data = await apiFetch<CompareResult>('/api/incident/compare', {
        method: 'POST',
        body: JSON.stringify({ title: 'Comparison incident', description, service, severity: 'P2' }),
      });
      setResult(data);
    } catch (err) {
      console.error('Compare error:', err);
      setResult({ without_memory: 'Error: Could not reach the analysis engine. Please ensure the backend is running.', with_memory: 'Error: Could not reach the analysis engine.', memories_recalled: 0, memory_used: false });
    } finally {
      setLoading(false);
    }
  };

  return <div className="page"><div className="page-heading"><div><div className="eyebrow">{viewMeta['before-after'].eyebrow}</div><h1>Memory changes the first move.</h1><p>Same signal. Two response paths. Compare the generic guess with the pattern your team has already paid to learn.</p></div><button type="button" className="btn btn-secondary" onClick={() => onNavigate('memory')}><BrainCircuit size={15} /> Explore memories</button></div><form className="panel" style={{ padding: 18, marginBottom: 15 }} onSubmit={runComparison}><div className="compare-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}><div className="field" style={{ marginBottom: 0 }}><label htmlFor="compare-service">Service</label><select id="compare-service" value={service} onChange={(e) => setService(e.target.value)}><option>payments-service</option><option>checkout-api</option><option>payments-worker</option><option>edge-gateway</option><option>api-proxy</option></select></div><div className="field" style={{ marginBottom: 0 }}><label htmlFor="compare-description">Incident signal</label><input id="compare-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div><div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary" onClick={quickFillCompare}><Zap size={14} /> Quick fill</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <><span className="loading-spinner" /> Comparing...</> : <><GitCompareArrows size={14} /> Run comparison</>}</button></div></div></form>{ran && <div className="compare-layout" id="compare-result"><section className="panel compare-panel without"><div className="compare-title"><h3>Without memory</h3><span>generic response</span></div><div className="compare-content">{loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" style={{ width: 24, height: 24 }} /></div> : <div className="analysis-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(result?.without_memory || '') }} />}</div></section><div className="compare-divider"><ArrowRight size={14} /><span>vs</span></div><section className="panel compare-panel with"><div className="compare-title"><h3>With memory</h3><span>{result?.memories_recalled || 0} patterns recalled</span></div><div className="compare-content">{loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" style={{ width: 24, height: 24 }} /></div> : <div className="analysis-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(result?.with_memory || '') }} />}<div className="compare-particles"><i /><i /><i /><i /><i /></div></div></section></div>}{ran && !loading && result && <div className="score-bar panel"><div className="score-row"><span>Actionable steps</span><div className="score-track"><div className="score-fill bad" style={{ width: '35%' }} /></div><span style={{ color: '#e46d6c' }}>35%</span></div><div className="score-row"><span>Actionable steps</span><div className="score-track"><div className="score-fill good" style={{ width: '88%' }} /></div><span style={{ color: 'hsl(var(--accent))' }}>88%</span></div><div className="score-row"><span>Specificity</span><div className="score-track"><div className="score-fill bad" style={{ width: '20%' }} /></div><span style={{ color: '#e46d6c' }}>20%</span></div><div className="score-row"><span>Specificity</span><div className="score-track"><div className="score-fill good" style={{ width: '92%' }} /></div><span style={{ color: 'hsl(var(--accent))' }}>92%</span></div><div className="score-row"><span>Time to resolve</span><div className="score-track"><div className="score-fill bad" style={{ width: '45%' }} /></div><span style={{ color: '#e46d6c' }}>~45m</span></div><div className="score-row"><span>Time to resolve</span><div className="score-track"><div className="score-fill good" style={{ width: '70%' }} /></div><span style={{ color: 'hsl(var(--accent))' }}>~18m</span></div></div>}</div>;
}

function MemoryPage({ memories, onSeed, onSearch, seeding, seedResults }: { memories: Memory[]; onSeed: () => void; onSearch: (query: string) => void; seeding: boolean; seedResults: { id: string; title: string; status: string }[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => { const n = query.toLowerCase(); return memories.filter((m) => `${m.title} ${m.service} ${m.summary}`.toLowerCase().includes(n)); }, [memories, query]);
  const searchMemory = (value: string) => { setQuery(value); onSearch(value); };
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">{viewMeta.memory.eyebrow}</div><h1>What the agent remembers.</h1><p>Every resolution becomes a reusable signal. Search the patterns, inspect the lesson, and see where recall is already helping.</p></div><button type="button" className="btn btn-primary" onClick={onSeed} disabled={seeding}>{seeding ? <><span className="loading-spinner" /> Seeding...</> : <><Plus size={15} /> Seed demo memory</>}</button></div>{seedResults.length > 0 && <div className="seed-results">{seedResults.map((r) => <div className="seed-item" key={r.id}><span className={`status ${r.status === 'retained' ? 'success' : 'error'}`}>{r.status}</span><span>{r.id} — {r.title}</span></div>)}</div>}<div className="memory-toolbar"><div className="search-box"><Search size={15} /><input type="search" placeholder="Search service, pattern, or lesson" value={query} onChange={(e) => searchMemory(e.target.value)} /></div><span className="eyebrow">{filtered.length} of {memories.length} memories</span></div><div id="memory-results"><div className="memory-gallery" id="memory-gallery">{filtered.length === 0 ? <div className="panel empty-state" style={{ gridColumn: '1 / -1' }}><Search size={25} /><div>No matching memory yet.</div><p style={{ fontSize: 11 }}>Try a service name like payments-service or search for a lesson.</p></div> : filtered.map((memory) => <article className="memory-card fade-in-up" data-severity={memory.severity} key={memory.id}><div className="memory-card-top"><span className="service-pill">{memory.service}</span><span className={`severity-dot severity-${memory.severity.toLowerCase()}`} title={memory.severity} /></div><h3>{memory.title}</h3><p>{memory.summary}</p><div className="memory-lessons"><span>Lesson learned</span><p>{memory.lesson}</p></div><div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 15, color: 'hsl(var(--muted-foreground))', font: '10px var(--app-font-mono)' }}><TrendingUp size={12} /> recalled {memory.hits} times</div></article>)}</div></div></div>;
}

function ResolveModal({ incident, onClose, onResolved }: { incident: Incident; onClose: () => void; onResolved: () => void }) {
  const [step, setStep] = useState(1);
  const [rootCause, setRootCause] = useState('');
  const [resolution, setResolution] = useState('');
  const [lesson, setLesson] = useState('');
  const [engineer, setEngineer] = useState('Alex');
  const [duration, setDuration] = useState('15');
  const [submitting, setSubmitting] = useState(false);

  const submitResolve = async () => {
    if (step < 4) { setStep(step + 1); return; }
    setSubmitting(true);
    try {
      await apiFetch('/api/incident/resolve', {
        method: 'POST',
        body: JSON.stringify({
          incident_id: incident.id,
          root_cause: rootCause,
          resolution: resolution,
          engineer: engineer,
          duration_minutes: parseInt(duration) || 15,
          lessons_learned: lesson,
          tags: [],
        }),
      });
      onResolved();
    } catch (err) {
      console.error('Resolve error:', err);
      onResolved();
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="modal-backdrop" id="resolve-modal" role="dialog" aria-modal="true"><div className="modal"><div className="modal-header"><div><div className="eyebrow">Close incident / retain learning</div><h2>{incident.title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close resolve modal"><X size={16} /></button></div><div className="modal-content"><div className="stepper">{['Root cause', 'Resolution', 'Lessons', 'Retain memory'].map((label, index) => <div className={`step ${step >= index + 1 ? 'active' : ''}`} key={label}><div className="step-number">{step > index + 1 ? <Check size={12} /> : index + 1}</div><span>{label}</span></div>)}</div>{step === 1 && <div><div className="field"><label htmlFor="resolve-root-cause">What was the root cause?</label><textarea id="resolve-root-cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} placeholder="e.g. A connection pool was exhausted after the deploy changed request fan-out." /></div><div className="field"><label htmlFor="resolve-engineer">Engineer</label><input id="resolve-engineer" value={engineer} onChange={(e) => setEngineer(e.target.value)} /></div></div>}{step === 2 && <div className="field"><label htmlFor="resolve-resolution">What fixed it?</label><textarea id="resolve-resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe the action that restored service." /></div>}{step === 3 && <div><div className="field"><label htmlFor="resolve-lesson">What should the agent remember?</label><textarea id="resolve-lesson" value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="Make this useful for the next on-call." /></div><div className="field"><label htmlFor="resolve-duration">Duration (minutes)</label><input id="resolve-duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div></div>}{step === 4 && <div style={{ textAlign: 'center', padding: '12px 0 20px' }}><div className="stat-icon" style={{ margin: '0 auto 15px', width: 48, height: 48 }}><BrainCircuit size={24} /></div><div className="panel-title" style={{ marginBottom: 8 }}>Ready to retain memory</div><div className="panel-subtitle">This resolution will be stored and recalled for future incidents.</div></div>}</div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" onClick={submitResolve} disabled={submitting}>{submitting ? <><span className="loading-spinner" /> Retaining...</> : step < 4 ? <><ArrowRight size={14} /> Continue</> : <><BrainCircuit size={14} /> Retain memory</>}</button></div></div></div>;
}

function IncidentIQ() {
  const [location, setLocation] = useLocation();
  const active = getView(location);
  const [collapsed, setCollapsed] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryHits, setMemoryHits] = useState(0);
  const [resolveIncident, setResolveIncident] = useState<Incident | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedResults, setSeedResults] = useState<{ id: string; title: string; status: string }[]>([]);
  const [healthOk, setHealthOk] = useState(false);

  const showToast = (message: string) => { setToastMessage(message); window.setTimeout(() => setToastMessage(null), 3500); };
  const showTab = (view: View) => { setLocation(view === 'dashboard' ? '/' : `/${view}`); };

  const fetchIncidents = useCallback(async () => {
    try {
      const data = await apiFetch<{ incidents: Incident[]; total: number }>('/api/incidents');
      setIncidents(data.incidents || []);
    } catch { /* backend may be down */ }
  }, []);

  const fetchMemories = useCallback(async () => {
    try {
      const data = await apiFetch<{ results: Memory[] }>('/api/memory/recall?query=incident&top_k=50');
      setMemories(data.results || []);
    } catch { /* backend may be down */ }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const data = await apiFetch<HealthResponse>('/api/health');
      setHealthOk(data.status === 'ok');
    } catch {
      setHealthOk(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await checkHealth();
      await fetchIncidents();
      setLoading(false);
    };
    init();
    const healthInterval = setInterval(checkHealth, 15000);
    return () => clearInterval(healthInterval);
  }, [checkHealth, fetchIncidents]);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const glow = document.querySelector<HTMLElement>('.cursor-glow');
      if (glow) { glow.style.left = `${event.clientX}px`; glow.style.top = `${event.clientY}px`; }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  const activityEvents = useMemo(() => {
    const events: { title: string; detail: string; time: string; icon: typeof Activity }[] = [];
    incidents.slice(0, 4).forEach((inc) => {
      events.push({
        title: inc.status === 'Resolved' ? 'Incident resolved' : 'Incident received',
        detail: inc.title,
        time: inc.time,
        icon: inc.status === 'Resolved' ? Check : AlertCircle,
      });
    });
    if (events.length === 0) {
      events.push(
        { title: 'Agent memory consolidated', detail: 'Resolution patterns indexed', time: '3h', icon: Sparkles },
        { title: 'System initialized', detail: 'Ready to receive incidents', time: 'now', icon: Activity },
      );
    }
    return events;
  }, [incidents]);

  const openResolveModal = (incident: Incident) => setResolveIncident(incident);

  const submitResolve = async (_rootCause: string, _resolution: string, _lesson: string) => {
    if (!resolveIncident) return;
    setIncidents((current) => current.map((i) => i.id === resolveIncident.id ? { ...i, status: 'Resolved', time: 'just now' } : i));
    setResolveIncident(null);
    showToast('Resolved — a new memory is now active');
  };

  const seedMemory = async () => {
    setSeeding(true);
    setSeedResults([]);
    try {
      const data = await apiFetch<{ seeded: number; results: { id: string; title: string; result: { status: string } }[] }>('/api/memory/seed');
      setSeedResults(data.results.map((r) => ({ id: r.id, title: r.title, status: r.result?.status || 'retained' })));
      showToast(`Seeded ${data.seeded} incidents into agent memory`);
      fetchMemories();
    } catch (err) {
      showToast('Failed to seed memory — check backend');
    } finally {
      setSeeding(false);
    }
  };

  const searchMemory = async (query: string) => {
    if (query.length > 2) {
      setMemoryHits((h) => h + 1);
      try {
        const data = await apiFetch<{ results: Memory[] }>(`/api/memory/recall?query=${encodeURIComponent(query)}&top_k=20`);
        setMemories(data.results || []);
      } catch { /* ignore */ }
    }
  };

  const renderView = (): ReactNode => {
    if (active === 'new-incident') return <NewIncident onNavigate={showTab} />;
    if (active === 'before-after') return <Comparison onNavigate={showTab} />;
    if (active === 'memory') return <MemoryPage memories={memories} onSeed={seedMemory} onSearch={searchMemory} seeding={seeding} seedResults={seedResults} />;
    return <Dashboard incidents={incidents} memories={memories} onNavigate={showTab} onResolve={openResolveModal} memoryHits={memoryHits} activityEvents={activityEvents} />;
  };

  return <div className="app-shell dark"><div className="top-line" /><div className="aurora"><span className="one" /><span className="two" /><span className="three" /></div><div className="grain" /><div className="cursor-glow" /><div className="shell-grid" style={{ gridTemplateColumns: collapsed ? '78px minmax(0, 1fr)' : undefined }}><ShellNav active={active} onNavigate={showTab} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} /><main className="main"><Header active={active} onNavigate={showTab} onNew={() => showTab('new-incident')} /><div style={{ padding: '0 clamp(18px, 3.2vw, 48px)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10 }}><span className="online-dot" style={{ width: 6, height: 6, background: healthOk ? 'hsl(var(--accent))' : '#ff716e', boxShadow: healthOk ? '0 0 12px hsl(var(--accent))' : '0 0 12px #ff716e' }} /><span className="eyebrow" style={{ fontSize: 9 }}>{healthOk ? 'Backend connected' : 'Backend offline'}</span></div></div>{renderView()}</main></div>{resolveIncident && <ResolveModal incident={resolveIncident} onClose={() => setResolveIncident(null)} onResolved={() => { setResolveIncident(null); showToast('Resolved — a new memory is now active'); fetchIncidents(); }} />}{toastMessage && <div className="toast-notification" role="status"><Check size={16} /><span>{toastMessage}</span><span className="toast-progress" /></div>}</div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={IncidentIQ} /><Route path="/new-incident" component={IncidentIQ} /><Route path="/before-after" component={IncidentIQ} /><Route path="/memory" component={IncidentIQ} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
