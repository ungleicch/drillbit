/* ─── Quality of life: remembered deck, keyboard shortcuts, help overlay ─── */
const Prefs = {
  KEY_CLASS: 'drillbit:lastClass',
  KEY_TOPIC: 'drillbit:lastTopic',
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  lastClassId() { return Prefs.get(Prefs.KEY_CLASS); },
  lastTopic() { return Prefs.get(Prefs.KEY_TOPIC); }, // "classId/topicId"
  rememberRoute(path) {
    const m = path.match(/^\/(?:class|history)\/([^/]+)(?:\/topic\/([^/]+))?$/);
    if (!m) return;
    Prefs.set(Prefs.KEY_CLASS, m[1]);
    if (m[2]) Prefs.set(Prefs.KEY_TOPIC, `${m[1]}/${m[2]}`);
  },
  continueHash(classes) {
    const id = Prefs.lastClassId();
    if (!id || (classes && !classes.some(c => c.id === id))) return null;
    const t = Prefs.lastTopic();
    return t && t.startsWith(id + '/') ? `/class/${id}/topic/${t.split('/')[1]}` : `/class/${id}`;
  },
};
window.Prefs = Prefs;

/* "Continue where you left off" bar on the dashboard */
(() => {
  const orig = Dashboard._renderClasses.bind(Dashboard);
  Dashboard._renderClasses = function (classes) {
    orig(classes);
    document.querySelector('.continue-bar')?.remove();
    const hash = Prefs.continueHash(classes);
    if (!hash) { if (Prefs.lastClassId()) Prefs.set(Prefs.KEY_CLASS, null); return; }
    const cls = classes.find(c => c.id === Prefs.lastClassId());
    const bar = document.createElement('div');
    bar.className = 'continue-bar';
    bar.innerHTML = `<div><div class="cb-label">Continue where you left off</div>
      <div class="cb-name">${escapeHtml(cls.name)}</div></div>
      <button class="btn btn-primary btn-sm">Open <kbd>C</kbd></button>`;
    bar.querySelector('button').onclick = () => Router.navigate(hash);
    const stats = document.getElementById('dash-stats');
    stats?.parentNode.insertBefore(bar, stats);
  };
})();

/* Help overlay */
const Shortcuts = {
  open: false,
  toggle() { Shortcuts.open ? Shortcuts.hide() : Shortcuts.show(); },
  show() {
    if (Shortcuts.open) return;
    Shortcuts.open = true;
    const row = (label, ...keys) => `<div class="kbd-row"><span>${label}</span><span>${keys.map(k => `<kbd>${k}</kbd>`).join('')}</span></div>`;
    const el = document.createElement('div');
    el.className = 'kbd-overlay';
    el.id = 'kbd-overlay';
    el.innerHTML = `<div class="kbd-panel" role="dialog" aria-label="Keyboard shortcuts">
      <h2>Keyboard shortcuts</h2>
      <h3>Anywhere</h3>
      ${row('Show this help', '?')}
      ${row('Go to dashboard', 'G', 'H')}
      ${row('Session history (last class)', 'G', 'S')}
      ${row('Continue last deck', 'C')}
      ${row('New class (dashboard)', 'N')}
      ${row('Close dialog', 'Esc')}
      <h3>Practice session</h3>
      ${row('Pick answer', '1–9', 'A–D')}
      ${row('True / False', 'T', 'F')}
      ${row('Flip flashcard', 'Space')}
      ${row('Grade flashcard wrong / right', 'X', 'V')}
      ${row('Next question', 'Enter', '→')}
      ${row('Previous question (exam mode)', '←')}
      ${row('Quit session', 'Esc')}
      <h3>Topic editor</h3>
      ${row('New question', 'N')}
      ${row('Add and next', '⌘/Ctrl', 'Enter')}
    </div>`;
    el.addEventListener('click', e => { if (e.target === el) Shortcuts.hide(); });
    document.body.appendChild(el);
  },
  hide() { Shortcuts.open = false; document.getElementById('kbd-overlay')?.remove(); },
};
window.Shortcuts = Shortcuts;
document.getElementById('nav-help-btn')?.addEventListener('click', () => Shortcuts.show());

(() => {
  let pendingG = 0;
  const visible = el => el && el.offsetParent !== null && !el.disabled;
  const clickIf = sel => { const el = document.querySelector(sel); if (visible(el)) { el.click(); return true; } return false; };

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const k = e.key;

    if (Shortcuts.open) { if (k === 'Escape' || k === '?') { e.preventDefault(); Shortcuts.hide(); } return; }
    if (k === '?') { e.preventDefault(); Shortcuts.show(); return; }
    if (!document.getElementById('modal-overlay')?.classList.contains('hidden')) return;

    const inSession = !!document.getElementById('session-view');
    if (inSession) {
      const lower = k.toLowerCase();
      const opts = [...document.querySelectorAll('.mc-option')].filter(visible);
      let idx = -1;
      if (/^[1-9]$/.test(k)) idx = Number(k) - 1;
      else if (/^[a-d]$/.test(lower) && opts.length) idx = lower.charCodeAt(0) - 97;
      if (idx >= 0 && opts[idx]) { e.preventDefault(); opts[idx].click(); return; }
      if (lower === 't' && clickIf('.tf-btn.true-btn')) return e.preventDefault();
      if (lower === 'f' && clickIf('.tf-btn.false-btn')) return e.preventDefault();
      if (k === ' ') {
        const fc = document.getElementById('fc-wrap');
        if (fc && !fc.classList.contains('flipped')) { e.preventDefault(); fc.click(); return; }
      }
      if (lower === 'x' && clickIf('.grade-btn.grade-wrong')) return e.preventDefault();
      if (lower === 'v' && clickIf('.grade-btn.grade-correct')) return e.preventDefault();
      if ((k === 'Enter' || k === 'ArrowRight') && clickIf('#q-next-btn')) return e.preventDefault();
      if (k === 'ArrowLeft' && clickIf('#q-prev-btn')) return e.preventDefault();
      if (k === 'Escape' && clickIf('#sess-quit-btn')) return e.preventDefault();
      return;
    }

    const lower = k.toLowerCase();
    if (pendingG && Date.now() - pendingG < 1200) {
      pendingG = 0;
      if (lower === 'h') { e.preventDefault(); Router.navigate('/'); return; }
      if (lower === 's') { e.preventDefault(); document.getElementById('nav-history-btn').click(); return; }
    }
    if (lower === 'g') { pendingG = Date.now(); return; }

    const path = (location.hash.slice(1) || '/').split('?')[0];
    if (lower === 'c') {
      const hash = Prefs.continueHash();
      if (hash) { e.preventDefault(); Router.navigate(hash); }
      return;
    }
    if (lower === 'n' && (path === '/' || path === '')) { e.preventDefault(); Dashboard.showNewClassModal(); }
  });
})();
