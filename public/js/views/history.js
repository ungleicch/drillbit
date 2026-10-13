/* ─── History View ───────────────────────────────────────────────────────── */
const History = {
  async render(container, classId) {
    container.innerHTML = `<div class="page"><div class="skeleton" style="height:300px;border-radius:var(--r-xl)"></div></div>`;
    try {
      const [cls, sessions] = await Promise.all([
        API.getClass(classId),
        API.getSessions(classId)
      ]);
      History._renderPage(container, classId, cls, sessions);
    } catch(e) {
      Toast.error('Failed to load history');
      Router.navigate('/');
    }
  },

  _renderPage(container, classId, cls, sessions) {
    container.innerHTML = `
      <div class="page">
        <div class="breadcrumb">
          <a href="#/">Home</a>
          <span class="breadcrumb-sep">›</span>
          <a href="#/class/${classId}">${cls.name}</a>
          <span class="breadcrumb-sep">›</span>
          <span>History</span>
        </div>
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Session History</h1>
            <p class="page-subtitle">${cls.name} — ${sessions.length} session${sessions.length !== 1 ? 's' : ''} recorded</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-teal" id="hist-practice-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              New Session
            </button>
          </div>
        </div>

        ${sessions.length ? History._buildStats(sessions) : ''}

        <div id="hist-list" style="display:flex;flex-direction:column;gap:var(--sp-sm)"></div>
      </div>`;

    document.getElementById('hist-practice-btn').addEventListener('click', () => Router.navigate(`/class/${classId}`));

    if (!sessions.length) {
      document.getElementById('hist-list').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🕐</div>
          <div class="empty-title">No sessions yet</div>
          <div class="empty-desc">Start a practice session to see your history here.</div>
          <button class="btn btn-teal" onclick="Router.navigate('/class/${classId}')">Practice Now</button>
        </div>`;
      return;
    }

    History._renderList(sessions, classId);
  },

  _buildStats(sessions) {
    const scores   = sessions.map(s => s.score || 0);
    const avgScore = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
    const best     = Math.max(...scores);
    const totalQ   = sessions.reduce((a,s) => a + (s.totalQuestions||0), 0);
    const totalCorrect = sessions.reduce((a,s) => a + (s.correct||0), 0);
    return `
      <div class="stat-grid" style="margin-bottom:var(--sp-xl)">
        <div class="stat-card">
          <div class="stat-label">Sessions</div>
          <div class="stat-value" style="color:var(--indigo-light)">${sessions.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Score</div>
          <div class="stat-value" style="color:${scoreColor(avgScore)}">${avgScore}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Best Score</div>
          <div class="stat-value" style="color:var(--emerald)">${best}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Questions Done</div>
          <div class="stat-value" style="color:var(--teal)">${totalQ}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Correct</div>
          <div class="stat-value" style="color:var(--emerald)">${totalCorrect}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Overall Accuracy</div>
          <div class="stat-value" style="color:${scoreColor(totalQ ? Math.round(totalCorrect/totalQ*100) : 0)}">${totalQ ? Math.round(totalCorrect/totalQ*100) : 0}%</div>
        </div>
      </div>`;
  },

  _renderList(sessions, classId) {
    const el = document.getElementById('hist-list');
    el.innerHTML = sessions.map(s => {
      const pct = s.score || 0;
      const date = new Date(s.startedAt || s.savedAt);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const topics = s.topicNames?.join(', ') || 'Unknown topics';
      return `
        <div class="session-history-item">
          <div class="sh-date">
            <div>${dateStr}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">${timeStr}</div>
          </div>
          <div class="sh-info">
            <div class="sh-name">${topics}</div>
            <div class="sh-meta">${s.correct || 0} / ${s.totalQuestions || 0} correct · ${formatDuration(s.duration)}</div>
          </div>
          <div class="sh-score" style="color:${scoreColor(pct)}">${pct}%</div>
        </div>`;
    }).join('');
  }
};
