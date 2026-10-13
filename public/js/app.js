/* ─── Shared Utilities ────────────────────────────────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scoreColor(pct) {
  if (pct >= 80) return 'var(--emerald)';
  if (pct >= 60) return 'var(--indigo-light)';
  if (pct >= 40) return 'var(--amber)';
  return 'var(--rose)';
}

function scoreClass(pct) {
  if (pct >= 80) return 'score-great';
  if (pct >= 60) return 'score-good';
  if (pct >= 40) return 'score-ok';
  return 'score-low';
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function typeLabel(type) {
  const map = { 'multiple-choice': 'MC', 'true-false': 'T/F', flashcard: 'Card', 'short-answer': 'SA' };
  return map[type] || type;
}

function typeBadgeClass(type) {
  const map = { 'multiple-choice': 'badge-mc', 'true-false': 'badge-tf', flashcard: 'badge-fc', 'short-answer': 'badge-sa' };
  return map[type] || 'badge-mc';
}

function buildScoreRing(score, size = 64, stroke = 5) {
  const r = (size / 2) - stroke;
  const circ = 2 * Math.PI * r;
  const fill = circ - (circ * score / 100);
  const color = scoreColor(score);
  return `
    <div class="score-ring" style="width:${size}px;height:${size}px;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="score-ring-bg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"/>
        <circle class="score-ring-fill" cx="${size/2}" cy="${size/2}" r="${r}"
          stroke-width="${stroke}" stroke="${color}"
          stroke-dasharray="${circ}" stroke-dashoffset="${fill}"/>
      </svg>
      <div class="score-ring-label" style="color:${color}">${score}%</div>
    </div>`;
}


function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain one-line preview (topic lists, titles). */
function stripMarkdown(s) {
  return String(s ?? '')
    .replace(/```[\w]*\r?\n?([\s\S]*?)```/g, (_, code) => ' ' + code.replace(/\s+/g, ' ').trim() + ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lightweight markdown for study cards: fenced code, inline code, bold, paragraphs.
 * Escapes HTML first so question text is safe.
 */
function renderMarkdown(text) {
  if (text == null || text === '') return '';
  const blocks = [];
  let body = String(text).replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = blocks.length;
    const langSafe = escapeHtml(lang || '');
    const label = lang
      ? `<span class="md-code-lang">${langSafe}</span>`
      : '';
    const cls = lang ? ` class="language-${langSafe}"` : '';
    blocks.push(
      `<div class="md-code-wrap">${label}<pre class="md-code"><code${cls}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre></div>`
    );
    return `\n\n%%CODE${idx}%%\n\n`;
  });

  body = escapeHtml(body);
  body = body.replace(/`([^`\n]+)`/g, '<code class="md-inline">$1</code>');
  body = body.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  body = body.split(/\n{2,}/).map(block => {
    const t = block.trim();
    if (!t) return '';
    const m = t.match(/^%%CODE(\d+)%%$/);
    if (m) return blocks[Number(m[1])];
    return `<p class="md-p">${t.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return `<div class="md-content">${body}</div>`;
}

/* ─── App State & Router ─────────────────────────────────────────────────── */
const AppState = {
  // For passing data between views without URL encoding
  sessionConfig: null,   // { classId, topicIds, topicNames, className, mode, limit, focusWeak }
  lastResults:   null,   // { classId, sessionId, answers, score, questions }
};

const Router = {
  navigate(hash) { window.location.hash = hash; },
  back()         { history.back(); },

  init() {
    window.addEventListener('hashchange', () => Router.route());
    Router.route();

    document.getElementById('nav-new-class-btn').addEventListener('click', () => Dashboard.showNewClassModal());
    document.getElementById('nav-logo-link').addEventListener('click', e => { e.preventDefault(); Router.navigate('/'); });
    document.getElementById('nav-history-btn').addEventListener('click', () => {
      // History is per class: open the last class you studied, or the dashboard.
      const last = window.Prefs && Prefs.lastClassId();
      Router.navigate(last ? `/history/${last}` : '/');
    });
  },

  route() {
    const raw  = window.location.hash.slice(1) || '/';
    const path = raw.split('?')[0];
    const container = document.getElementById('view-container');

    // Hide session-specific navbar items during session
    const isSession = path.startsWith('/session');
    document.getElementById('navbar').style.display = isSession ? 'none' : '';

    window.scrollTo(0, 0);
    if (window.Prefs) Prefs.rememberRoute(path);

    if (path === '/' || path === '') {
      Dashboard.render(container);
    } else if (path.match(/^\/class\/[^/]+\/topic\/[^/]+$/)) {
      const [,, classId,, topicId] = path.split('/');
      TopicView.render(container, classId, topicId);
    } else if (path.match(/^\/class\/[^/]+$/)) {
      const [,, classId] = path.split('/');
      ClassView.render(container, classId);
    } else if (path === '/session') {
      Session.render(container);
    } else if (path === '/results') {
      Results.render(container);
    } else if (path.match(/^\/history\/[^/]+$/)) {
      const classId = path.split('/')[2];
      History.render(container, classId);
    } else {
      container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Page not found</div><button class="btn btn-primary" onclick="Router.navigate('/')">Go Home</button></div></div>`;
    }
  }
};

Router.init();
