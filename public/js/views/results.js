/* ─── Results View ────────────────────────────────────────────────────────── */
const Results = {
  render(container) {
    const data = AppState.lastResults;
    if (!data) { Router.navigate('/'); return; }

    const { classId, className, topicNames, score, correct, totalQuestions, duration, answers } = data;
    const pct = score || 0;
    const wrong   = answers.filter(a => !a.correct).length;
    const emoji   = pct === 100 ? '🏆' : pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '📖' : '💪';
    const message = pct === 100 ? 'Perfect Score!' : pct >= 80 ? 'Great work!' : pct >= 60 ? 'Good job!' : pct >= 40 ? 'Keep practicing!' : 'Keep at it!';

    // Confetti for good scores
    if (pct === 100) setTimeout(() => Confetti.fire(120), 150);

    container.innerHTML = `
      <div class="page" style="max-width:720px">
        <div class="results-hero">
          <div style="font-size:3rem;animation:bounce-in 0.5s ease">${emoji}</div>
          <div class="results-score-circle" style="--score-pct:${pct * 3.6}deg;background:var(--bg-card);border:1px solid var(--border)">
            <span style="color:${scoreColor(pct)}">${pct}%</span>
          </div>
          <div>
            <h1 class="page-title" style="text-align:center">${message}</h1>
            <p style="text-align:center;color:var(--text-secondary)">${className} · ${topicNames?.join(', ') || ''}</p>
          </div>

          <!-- Score breakdown pills -->
          <div style="display:flex;gap:var(--sp-md);flex-wrap:wrap;justify-content:center">
            <div class="stat-card" style="align-items:center;min-width:100px">
              <div class="stat-label">Correct</div>
              <div class="stat-value" style="color:var(--emerald)">${correct}</div>
            </div>
            <div class="stat-card" style="align-items:center;min-width:100px">
              <div class="stat-label">Wrong</div>
              <div class="stat-value" style="color:var(--rose)">${wrong}</div>
            </div>
            <div class="stat-card" style="align-items:center;min-width:100px">
              <div class="stat-label">Total</div>
              <div class="stat-value" style="color:var(--indigo-light)">${totalQuestions}</div>
            </div>
            <div class="stat-card" style="align-items:center;min-width:100px">
              <div class="stat-label">Time</div>
              <div class="stat-value" style="color:var(--teal);font-size:1.4rem">${formatDuration(duration)}</div>
            </div>
          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:var(--sp-sm);flex-wrap:wrap;justify-content:center">
            <button class="btn btn-teal btn-lg" id="res-retry-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Retry Session
            </button>
            <button class="btn btn-ghost btn-lg" id="res-class-btn">
              Back to Class
            </button>
            <button class="btn btn-ghost btn-lg" id="res-home-btn">
              Home
            </button>
          </div>
        </div>

        <!-- Per-question breakdown -->
        <div class="section-header" style="margin-top:var(--sp-xl)">
          <span class="section-title">Question Breakdown</span>
          <div style="display:flex;gap:var(--sp-sm)">
            <button class="btn btn-sm tab-filter ${true?'btn-primary':'btn-ghost'}" data-filter="all" id="filter-all">All</button>
            <button class="btn btn-sm btn-ghost tab-filter" data-filter="wrong" id="filter-wrong">Wrong ${wrong}</button>
            <button class="btn btn-sm btn-ghost tab-filter" data-filter="correct" id="filter-correct">Correct ${correct}</button>
          </div>
        </div>
        <div class="results-breakdown" id="res-breakdown"></div>
      </div>`;

    Results._renderBreakdown(answers, 'all');

    document.getElementById('res-retry-btn').addEventListener('click', () => {
      // Reuse same config
      Router.navigate('/session');
    });
    document.getElementById('res-class-btn').addEventListener('click', () => Router.navigate(`/class/${classId}`));
    document.getElementById('res-home-btn').addEventListener('click', () => Router.navigate('/'));

    // Filter buttons
    document.querySelectorAll('.tab-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-filter').forEach(b => { b.className = 'btn btn-sm btn-ghost tab-filter'; });
        btn.className = 'btn btn-sm btn-primary tab-filter';
        Results._renderBreakdown(answers, btn.dataset.filter);
      });
    });
  },

  _renderBreakdown(answers, filter) {
    const el = document.getElementById('res-breakdown');
    let filtered = answers;
    if (filter === 'wrong')   filtered = answers.filter(a => !a.correct);
    if (filter === 'correct') filtered = answers.filter(a =>  a.correct);

    if (!filtered.length) {
      el.innerHTML = `<div style="text-align:center;padding:var(--sp-xl);color:var(--text-muted)">No questions in this category.</div>`;
      return;
    }

    el.innerHTML = filtered.map((a, i) => {
      const isCorrect = a.correct;
      const correctHtml = a.type === 'true-false'
        ? escapeHtml(String(a.correctAnswer) === 'true' ? '✓ True' : '✗ False')
        : renderMarkdown(a.correctAnswer);
      const userHtml = a.type === 'true-false'
        ? escapeHtml(String(a.userAnswer) === 'true' ? '✓ True' : '✗ False')
        : escapeHtml(a.userAnswer ?? '');
      return `
        <div class="result-item" style="flex-direction:column;align-items:flex-start;gap:var(--sp-sm)">
          <div style="display:flex;align-items:flex-start;gap:var(--sp-sm);width:100%">
            <span class="result-icon">${isCorrect ? '✅' : '❌'}</span>
            <div class="result-q" style="white-space:normal;flex:1;font-weight:500">${renderMarkdown(a.question)}</div>
            <span class="result-badge ${isCorrect ? 'result-correct' : 'result-wrong'}">${isCorrect ? 'Correct' : 'Wrong'}</span>
          </div>
          ${!isCorrect ? `
            <div style="display:flex;flex-direction:column;gap:var(--sp-sm);font-size:0.8rem;padding-left:calc(1rem + var(--sp-sm));width:100%">
              <div style="color:var(--rose)">Your answer: <strong>${userHtml}</strong></div>
              <div style="color:var(--emerald)"><strong>Correct:</strong> ${correctHtml}</div>
            </div>` : ''}
        </div>`;
    }).join('');
  }
};
