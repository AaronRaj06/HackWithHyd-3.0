// ─── Config ────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:8000';

// ─── State ─────────────────────────────────────────────────────────────────
let sessionIncidents = [];
let memoryHits = 0;
let resolvedCount = 0;

// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  loadSeedData();
  setInterval(checkHealth, 15000);
});

// ─── Tab Navigation ─────────────────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-content-${name}`).classList.add('active');
  document.getElementById(`tab-${name}`).classList.add('active');

  if (name === 'memory') loadMemoryGallery();
}

// ─── Health Check ────────────────────────────────────────────────────────────
async function checkHealth() {
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      dot.className = 'status-dot online';
      text.textContent = 'API Online';
    } else throw new Error();
  } catch {
    dot.className = 'status-dot offline';
    text.textContent = 'API Offline';
  }
}

// ─── Load Seed Data (for display) ───────────────────────────────────────────
async function loadSeedData() {
  try {
    const res = await fetch(`${API_BASE}/api/seed-data`);
    const data = await res.json();
    renderSeedGrid(data.incidents, 'seed-incidents-grid');
    updateStats();
  } catch {
    document.getElementById('seed-incidents-grid').innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">API not reachable</div><div class="empty-subtitle">Make sure the backend is running on port 8000</div></div>`;
  }
}

function renderSeedGrid(incidents, containerId) {
  const container = document.getElementById(containerId);
  if (!incidents || incidents.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No data</div></div>';
    return;
  }
  container.innerHTML = incidents.map(inc => `
    <div class="seed-card">
      <div class="seed-card-id">${inc.id} · ${severityBadge(inc.severity)}</div>
      <div class="seed-card-title">${escHtml(inc.title)}</div>
      <div class="seed-card-service">${escHtml(inc.service)}</div>
      <div class="seed-card-meta">📅 ${formatDate(inc.timestamp)}</div>
      <div class="seed-card-duration">⏱ Resolved in ${inc.duration_minutes} min · ${escHtml(inc.engineer)}</div>
    </div>
  `).join('');
}

// ─── Incident Analysis ───────────────────────────────────────────────────────
async function submitIncident(e) {
  e.preventDefault();

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> Querying Memory & Analyzing...`;

  const panel = document.getElementById('analysis-result-panel');
  panel.innerHTML = `
    <div class="result-placeholder">
      <div class="memory-pulse" style="width:40px;height:40px;"></div>
      <div class="result-placeholder-title">Agent is thinking...</div>
      <div class="result-placeholder-text">Recalling relevant past incidents from Hindsight memory</div>
    </div>`;

  const payload = {
    title: document.getElementById('inc-title').value,
    description: document.getElementById('inc-description').value,
    service: document.getElementById('inc-service').value,
    severity: document.getElementById('inc-severity').value,
    reporter: document.getElementById('inc-reporter').value || 'Anonymous',
  };

  try {
    const res = await fetch(`${API_BASE}/api/incident/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || 'API error');

    // Update state
    sessionIncidents.unshift(data.incident);
    if (data.memory_used) memoryHits++;
    updateStats();
    renderSessionIncidents();

    // Render result
    renderAnalysisResult(data);
    showToast(`Analysis complete · ${data.memories_recalled} memories recalled`, 'success');

  } catch (err) {
    panel.innerHTML = `
      <div class="result-placeholder">
        <div class="empty-icon">❌</div>
        <div class="result-placeholder-title">Error</div>
        <div class="result-placeholder-text">${err.message}</div>
      </div>`;
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analyze with Memory`;
  }
}

function renderAnalysisResult(data) {
  const panel = document.getElementById('analysis-result-panel');
  const memUsed = data.memory_used;

  panel.innerHTML = `
    <div class="result-content">
      <div class="result-header">
        <div>
          <div class="result-title">${escHtml(data.incident.title)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">
            ${data.incident.id} · ${escHtml(data.incident.service)} · ${severityBadge(data.incident.severity)}
          </div>
        </div>
        <div class="result-memory-badge ${memUsed ? 'hit' : 'miss'}">
          ${memUsed ? '🧠' : '◯'} ${memUsed ? `${data.memories_recalled} memories recalled` : 'No memory match'}
        </div>
      </div>
      <div class="result-analysis">${formatMarkdown(data.analysis)}</div>
      <div class="result-actions">
        <button class="btn btn-success btn-sm" onclick="openResolveModal('${data.incident_id}')">
          ✓ Resolve & Retain Memory
        </button>
        <button class="btn btn-ghost btn-sm" onclick="copyToClipboard(\`${escJs(data.analysis)}\`)">
          📋 Copy Analysis
        </button>
      </div>
    </div>`;
}

// ─── Resolve Modal ───────────────────────────────────────────────────────────
function openResolveModal(incidentId) {
  document.getElementById('resolve-incident-id').value = incidentId;
  document.getElementById('resolve-modal').classList.add('open');
}

function closeResolveModal(event) {
  if (event.target.id === 'resolve-modal') closeModal();
}

function closeModal() {
  document.getElementById('resolve-modal').classList.remove('open');
}

async function submitResolve() {
  const incId = document.getElementById('resolve-incident-id').value;
  const tagsRaw = document.getElementById('resolve-tags').value;

  const payload = {
    incident_id: incId,
    root_cause: document.getElementById('resolve-root-cause').value,
    resolution: document.getElementById('resolve-resolution').value,
    engineer: document.getElementById('resolve-engineer').value || 'Anonymous',
    duration_minutes: parseInt(document.getElementById('resolve-duration').value) || 0,
    lessons_learned: document.getElementById('resolve-lessons').value,
    tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
    runbook_used: '',
  };

  if (!payload.root_cause || !payload.resolution) {
    showToast('Root cause and resolution are required', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/incident/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    // Update session
    const idx = sessionIncidents.findIndex(i => i.id === incId);
    if (idx >= 0) { sessionIncidents[idx].status = 'resolved'; resolvedCount++; }
    updateStats();
    renderSessionIncidents();
    closeModal();
    showToast('🧠 Incident resolved & retained in Hindsight memory!', 'success');

    // Update memory count
    const el = document.getElementById('stat-memories');
    if (el) el.textContent = parseInt(el.textContent || '12') + 1;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Before/After Comparison ─────────────────────────────────────────────────
async function runComparison() {
  const btn = document.getElementById('compare-btn');
  const title = document.getElementById('cmp-title').value;
  const desc = document.getElementById('cmp-description').value;
  const service = document.getElementById('cmp-service').value;

  if (!title || !desc || !service) {
    showToast('Please fill in all fields', 'error'); return;
  }

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> Comparing...`;

  try {
    const res = await fetch(`${API_BASE}/api/incident/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc, service, severity: document.getElementById('cmp-severity').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    document.getElementById('compare-result').style.display = 'grid';
    document.getElementById('compare-without').textContent = data.without_memory;
    document.getElementById('compare-with').innerHTML = formatMarkdown(data.with_memory);
    document.getElementById('compare-stats').innerHTML =
      `🧠 ${data.memories_recalled} past incidents recalled · Response is memory-grounded and specific`;

    showToast('Comparison ready!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Run Comparison`;
  }
}

// ─── Memory Tab ──────────────────────────────────────────────────────────────
async function searchMemory() {
  const query = document.getElementById('memory-query').value.trim();
  if (!query) { showToast('Enter a query to search', 'error'); return; }

  const btn = document.getElementById('search-btn');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div>`;

  const container = document.getElementById('memory-results');
  container.innerHTML = '<div class="loading-shimmer" style="height:80px;border-radius:12px;"></div>'.repeat(3);

  try {
    const res = await fetch(`${API_BASE}/api/memory/recall?query=${encodeURIComponent(query)}&top_k=6`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">No memories found</div>
          <div class="empty-subtitle">Try different keywords, or seed memory first</div>
        </div>`;
      return;
    }

    container.innerHTML = data.results.map((m, i) => `
      <div class="memory-card">
        <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px;">Memory ${i+1} · Score: ${m.score ? m.score.toFixed(3) : 'N/A'}</div>
        <div class="memory-card-content">${escHtml(m.content || m.text || JSON.stringify(m))}</div>
      </div>
    `).join('');

    showToast(`${data.results.length} memories found`, 'info');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">${err.message}</div></div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Search`;
  }
}

function loadMemoryGallery() {
  fetch(`${API_BASE}/api/seed-data`)
    .then(r => r.json())
    .then(data => renderSeedGrid(data.incidents, 'memory-gallery'))
    .catch(() => {});
}

// ─── Seed Memory ─────────────────────────────────────────────────────────────
async function seedMemory() {
  const btn = document.getElementById('seed-btn') || document.getElementById('seed-btn-memory');
  if (btn) { btn.disabled = true; btn.textContent = 'Seeding...'; }
  showToast('Seeding Hindsight memory with 12 incidents...', 'info');

  try {
    const res = await fetch(`${API_BASE}/api/memory/seed`, { method: 'POST' });
    const data = await res.json();
    showToast(`✅ ${data.seeded} incidents seeded into memory!`, 'success');
  } catch (err) {
    showToast('Seed error: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Seed Memory'; }
  }
}

// ─── Quick Fill Templates ─────────────────────────────────────────────────────
const TEMPLATES = {
  db: {
    title: 'Database connection pool exhausted — API returning 500',
    service: 'payments-service',
    severity: 'P1',
    description: 'All API endpoints returning 500 errors. PostgreSQL logs show "too many connections". Connection pool appears full. Started after today\'s 2AM deployment of v2.4.0.'
  },
  memory: {
    title: 'OOMKilled pods crashing every 2 hours',
    service: 'order-worker',
    severity: 'P2',
    description: 'Kubernetes pods for order-worker are being OOMKilled repeatedly. Memory grows linearly from 400MB to 3GB before crashing. Started after v2.1.0 deployment last week.'
  },
  latency: {
    title: 'Redis cache miss rate spiked to 85% — API latency 5s+',
    service: 'product-catalog-api',
    severity: 'P1',
    description: 'p99 latency jumped from 90ms to 5200ms. Redis cache hit rate dropped suddenly. Database CPU at 98%. Appears to have started after the 00:00 cache refresh job ran.'
  },
  '502': {
    title: 'API gateway returning 502 for 35% of requests',
    service: 'api-gateway',
    severity: 'P1',
    description: 'Massive traffic spike causing gateway to return 502 Bad Gateway for 35% of requests. Backend services appear healthy. Gateway logs show upstream timeout errors.'
  },
  cert: {
    title: 'TLS certificate expired — authentication failing',
    service: 'auth-service',
    severity: 'P1',
    description: 'All OAuth token validations failing. Users are being logged out. Browser console shows "certificate expired". Started at approximately 3:00 AM.'
  }
};

function quickFill(type) {
  const t = TEMPLATES[type];
  if (!t) return;
  document.getElementById('inc-title').value = t.title;
  document.getElementById('inc-service').value = t.service;
  document.getElementById('inc-severity').value = t.severity;
  document.getElementById('inc-description').value = t.description;
}

function quickFillCompare(type) {
  const map = { db: 'db', oom: 'memory', latency: 'latency' };
  const t = TEMPLATES[map[type]];
  if (!t) return;
  document.getElementById('cmp-title').value = t.title;
  document.getElementById('cmp-service').value = t.service;
  document.getElementById('cmp-severity').value = t.severity;
  document.getElementById('cmp-description').value = t.description;
}

// ─── Render Helpers ───────────────────────────────────────────────────────────
function renderSessionIncidents() {
  const container = document.getElementById('incidents-list');
  document.getElementById('incidents-count').textContent = `${sessionIncidents.length} incidents`;

  if (sessionIncidents.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No incidents yet</div>
        <div class="empty-subtitle">Submit a new incident to see the agent in action</div>
        <button class="btn btn-primary btn-sm" onclick="showTab('analyze')">Report First Incident</button>
      </div>`;
    return;
  }

  container.innerHTML = sessionIncidents.map(inc => `
    <div class="incident-card ${inc.status === 'resolved' ? 'resolved-inc' : 'active-inc'}"
         onclick="viewIncident('${inc.id}')">
      <div class="incident-card-left">
        <div class="incident-card-title">${escHtml(inc.title)}</div>
        <div class="incident-card-meta">
          <span>🔧 ${escHtml(inc.service)}</span>
          <span>📅 ${formatDate(inc.timestamp)}</span>
          <span>${inc.status === 'resolved' ? '✅ Resolved' : '🔴 Active'}</span>
        </div>
      </div>
      <div class="incident-card-right">
        ${severityBadge(inc.severity)}
        ${inc.memory_used ? `<span class="memory-hit-badge">🧠 ${inc.memories_recalled} recalled</span>` : ''}
        ${inc.status !== 'resolved' ? `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();openResolveModal('${inc.id}')">Resolve</button>` : ''}
      </div>
    </div>
  `).join('');
}

function viewIncident(id) {
  const inc = sessionIncidents.find(i => i.id === id);
  if (!inc) return;
  showTab('analyze');
  // Pre-fill and show result
  setTimeout(() => {
    const panel = document.getElementById('analysis-result-panel');
    panel.innerHTML = `
      <div class="result-content">
        <div class="result-header">
          <div>
            <div class="result-title">${escHtml(inc.title)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">${inc.id} · ${escHtml(inc.service)}</div>
          </div>
          <div class="result-memory-badge ${inc.memory_used ? 'hit' : 'miss'}">
            ${inc.memory_used ? `🧠 ${inc.memories_recalled} recalled` : '◯ No match'}
          </div>
        </div>
        <div class="result-analysis">${formatMarkdown(inc.analysis || 'No analysis available')}</div>
      </div>`;
  }, 100);
}

function updateStats() {
  const active = sessionIncidents.filter(i => i.status !== 'resolved').length;
  const resolved = sessionIncidents.filter(i => i.status === 'resolved').length;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-resolved').textContent = resolved;
  document.getElementById('stat-memory-hits').textContent = memoryHits;
}

function severityBadge(sev) {
  const map = { P1: 'sev-p1', P2: 'sev-p2', P3: 'sev-p3', P4: 'sev-p4' };
  return `<span class="severity-badge ${map[sev] || 'sev-p3'}">${sev}</span>`;
}

function formatDate(ts) {
  if (!ts) return 'N/A';
  try { return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return ts; }
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s(.+)/gm, '<strong style="font-size:1rem;color:var(--text-primary);">$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);font-size:0.82em;background:rgba(255,255,255,0.07);padding:1px 6px;border-radius:4px;">$1</code>')
    .replace(/\n/g, '<br>');
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escJs(str) {
  if (!str) return '';
  return String(str).replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'info'));
}

// ─── Toast ───────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── Enter to search memory ───────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement.id === 'memory-query') searchMemory();
});
