/* ─── Session View ────────────────────────────────────────────────────────── */
/* Features:
   - Questions appear in random order
   - MC answer options are shuffled on every question
   - Instant feedback: highlights correct/wrong immediately on click
   - Correct answer always revealed after answering (even if right)
   - Explanation shown if available
   - Progress tracked per question
   - Session saved on completion
*/
const Session = {
  _state: {
    questions: [],
    current: 0,
    answers: [],
    startedAt: null,
    config: null,
    answered: false,   // true once current q is answered
    timer: null,
    elapsed: 0,
    examAnswers: {}, // Stores answers for exam mode navigation
  },

  async render(container) {
    const cfg = AppState.sessionConfig;
    if (!cfg) { Router.navigate('/'); return; }

    // Show loading screen
    container.innerHTML = `
      <div id="session-view">
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:var(--sp-md)">
          <div style="font-size:2rem">⚡</div>
          <div style="color:var(--text-secondary)">Loading questions…</div>
        </div>
      </div>`;

    try {
      const questions = await API.getSessionQuestions(cfg.classId, {
        topicIds:  cfg.topicIds,
        mode:      cfg.mode,
        limit:     cfg.limit || 0,
        focusWeak: cfg.focusWeak || false,
      });

      if (!questions.length) {
        Toast.info('No questions found for selected topics');
        Router.navigate(`/class/${cfg.classId}`);
        return;
      }

      // Always shuffle question order (server may have pre-sorted for weak mode)
      const shuffled = shuffle(questions);

      Session._state = {
        questions: shuffled,
        current: 0,
        answers: [],
        startedAt: new Date().toISOString(),
        config: cfg,
        answered: false,
        timer: null,
        elapsed: 0,
        examAnswers: {},
      };

      Session._renderShell(container, cfg, shuffled.length);
      Session._renderQuestion();
      Session._startTimer();
    } catch(e) {
      Toast.error('Failed to load questions: ' + e.message);
      Router.navigate(`/class/${cfg.classId}`);
    }
  },

  _renderShell(container, cfg, total) {
    container.innerHTML = `
      <div id="session-view">
        <!-- Top bar -->
        <div class="session-topbar">
          <button class="btn btn-ghost btn-sm" id="sess-quit-btn" title="Quit session">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="session-progress-wrap">
            <div class="session-progress-label" id="sess-progress-label">Question 1 of ${total}</div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" id="sess-progress-bar" style="width:0%;background:var(--grad-indigo)"></div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-md);flex-shrink:0">
            <div style="font-size:0.875rem;color:var(--text-muted)" id="sess-timer">${cfg.examMode && cfg.timeLimit > 0 ? cfg.timeLimit + ':00' : '0:00'}</div>
            <div style="font-size:0.8rem;padding:4px 10px;border-radius:var(--r-full);background:var(--bg-card);${cfg.examMode ? 'display:none;' : ''}" id="sess-score-live">
              <span style="color:var(--emerald)" id="sess-correct-count">0</span>
              <span style="color:var(--text-muted)"> / 0</span>
            </div>
          </div>
        </div>

        <!-- Session info strip -->
        <div style="text-align:center;padding:var(--sp-sm);font-size:0.75rem;color:var(--text-muted);border-bottom:1px solid var(--border)">
          ${cfg.className} · ${cfg.topicNames.join(', ')}
        </div>

        <!-- Question area -->
        <div class="session-content" id="sess-content"></div>
      </div>`;

    document.getElementById('sess-quit-btn').addEventListener('click', () => {
      Modal.confirm('Quit this session? Progress so far will NOT be saved.', () => {
        Session._stopTimer();
        Router.navigate(`/class/${cfg.classId}`);
      }, { title: 'Quit Session', confirmText: 'Quit', confirmClass: 'btn-danger' });
    });
  },

  _startTimer() {
    const { config } = Session._state;
    Session._state.elapsed = 0;
    const isCountdown = config.examMode && config.timeLimit > 0;
    let timeLeft = config.timeLimit * 60;

    Session._state.timer = setInterval(() => {
      Session._state.elapsed++;
      if (isCountdown) {
        timeLeft--;
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        const el = document.getElementById('sess-timer');
        if (el) el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
        if (timeLeft <= 0) {
          clearInterval(Session._state.timer);
          Toast.info('Time is up! Submitting exam.');
          Session._finishSession();
        }
      } else {
        const m = Math.floor(Session._state.elapsed / 60);
        const s = Session._state.elapsed % 60;
        const el = document.getElementById('sess-timer');
        if (el) el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
      }
    }, 1000);
  },

  _stopTimer() {
    if (Session._state.timer) { clearInterval(Session._state.timer); Session._state.timer = null; }
  },

  _updateProgress() {
    const { current, questions, answers } = Session._state;
    const total = questions.length;
    const pct = Math.round((current / total) * 100);
    const bar = document.getElementById('sess-progress-bar');
    const label = document.getElementById('sess-progress-label');
    const scoreEl = document.getElementById('sess-score-live');
    if (bar)   bar.style.width = pct + '%';
    if (label) label.textContent = `Question ${current + 1} of ${total}`;
    if (scoreEl) {
      const correct = answers.filter(a => a.correct).length;
      scoreEl.innerHTML = `<span style="color:var(--emerald)">${correct}</span><span style="color:var(--text-muted)"> / ${answers.length}</span>`;
    }
  },

  _renderQuestion() {
    const { questions, current, config, examAnswers } = Session._state;
    const q = questions[current];
    Session._state.answered = false;
    Session._updateProgress();

    const existingAns = examAnswers[q.id];
    if (existingAns) Session._state.answered = true;

    const content = document.getElementById('sess-content');
    if (!content) return;

    let questionHTML = '';
    if (q.type === 'multiple-choice') {
      questionHTML = Session._buildMC(q);
    } else if (q.type === 'true-false') {
      questionHTML = Session._buildTF(q);
    } else {
      // Fallback — treat as flashcard-style
      questionHTML = Session._buildFC(q);
    }

    content.innerHTML = `
      <div class="question-card" id="q-card">
        <div class="question-meta">
          <span class="question-type-badge ${typeBadgeClass(q.type)}">${typeLabel(q.type)}</span>
          <span class="question-counter">${current + 1} / ${questions.length}</span>
        </div>
        ${q.mediaUrl ? `
          <div class="question-media" style="margin-bottom:var(--sp-md);text-align:center">
            ${q.mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? 
              `<video src="${q.mediaUrl}" controls style="max-width:100%;max-height:300px;border-radius:var(--r-md)"></video>` : 
              `<img src="${q.mediaUrl}" style="max-width:100%;max-height:300px;border-radius:var(--r-md);object-fit:contain" alt="Question Media" />`
            }
          </div>` : ''}
        <div class="question-body">${renderMarkdown(q.question)}</div>
        ${questionHTML}
        <div id="q-feedback" style="display:none"></div>
        <div class="next-btn-wrap" id="q-next-wrap" style="${config.examMode || existingAns ? 'display:flex; justify-content:space-between;' : 'display:none'}">
          ${config.examMode && current > 0 ? `<button class="btn btn-ghost" id="q-prev-btn">← Previous</button>` : '<div></div>'}
          <button class="btn btn-primary btn-lg pulse-glow" id="q-next-btn">
            ${current + 1 < questions.length ? (config.examMode ? 'Next →' : 'Next Question →') : (config.examMode ? 'Submit Exam 🎉' : 'See Results 🎉')}
          </button>
        </div>
      </div>`;

    // Wire answer handlers
    if (q.type === 'multiple-choice') {
      content.querySelectorAll('.mc-option').forEach(opt => {
        if (existingAns && existingAns.userAnswer === opt.dataset.value) {
          opt.classList.add(config.examMode ? 'selected' : (existingAns.correct ? 'correct' : 'wrong'));
        }
        opt.addEventListener('click', () => {
          if (Session._state.answered && !config.examMode) return;
          Session._answerMC(q, opt.dataset.value);
        });
      });
    } else if (q.type === 'true-false') {
      content.querySelectorAll('.tf-btn').forEach(btn => {
        if (existingAns && existingAns.userAnswer === btn.dataset.value) {
          btn.classList.add(config.examMode ? 'selected' : (existingAns.correct ? 'correct' : 'wrong'));
        }
        btn.addEventListener('click', () => {
          if (Session._state.answered && !config.examMode) return;
          Session._answerTF(q, btn.dataset.value);
        });
      });
    } else {
      // Flashcard
      const wrap = content.querySelector('.flashcard-wrap');
      if (wrap) {
        wrap.addEventListener('click', () => {
          wrap.classList.toggle('flipped');
          const flipped = wrap.classList.contains('flipped');
          wrap.querySelector('.flashcard-front')?.setAttribute('aria-hidden', String(flipped));
          wrap.querySelector('.flashcard-back')?.setAttribute('aria-hidden', String(!flipped));
          const selfGrade = document.getElementById('q-self-grade');
          if (selfGrade && wrap.classList.contains('flipped')) selfGrade.style.display = 'flex';
        });
      }
      content.querySelectorAll('.grade-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (Session._state.answered && !config.examMode) return;
          Session._answerFlashcard(q, btn.dataset.correct === 'true');
        });
      });
    }

    // Navigation buttons
    document.getElementById('q-next-btn')?.addEventListener('click', () => Session._nextQuestion());
    document.getElementById('q-prev-btn')?.addEventListener('click', () => Session._prevQuestion());
  },

  _buildMC(q) {
    // Shuffle options for this question
    const shuffledOpts = shuffle(q.options || []);
    const letters = ['A','B','C','D','E','F'];
    return `
      <div class="mc-options">
        ${shuffledOpts.map((opt, i) => `
          <button class="mc-option" data-value="${opt.replace(/"/g,'&quot;')}">
            <span class="mc-option-letter">${letters[i]}</span>
            <span>${renderMarkdown(opt)}</span>
          </button>`).join('')}
      </div>`;
  },

  _buildTF(q) {
    return `
      <div class="tf-options">
        <button class="tf-btn true-btn" data-value="true">✓ True</button>
        <button class="tf-btn false-btn" data-value="false">✗ False</button>
      </div>`;
  },

  _buildFC(q) {
    return `
      <div class="flashcard-wrap" id="fc-wrap">
        <div class="flashcard-inner">
          <div class="flashcard-front">
            <div class="flashcard-reveal-icon">👁</div>
            <div class="flashcard-hint">Click to reveal answer</div>
          </div>
          <div class="flashcard-back" aria-hidden="true">
            <div class="flashcard-hint">Answer</div>
            <div class="flashcard-content">${renderMarkdown(q.answer)}</div>
          </div>
        </div>
      </div>
      <div class="flashcard-self-grade" id="q-self-grade" style="display:none">
        <button class="grade-btn grade-wrong"  data-correct="false">✕ Got it wrong</button>
        <button class="grade-btn grade-correct" data-correct="true">✓ Got it right</button>
      </div>`;
  },

  _answerMC(q, userAnswer) {
    const { config } = Session._state;
    Session._state.answered = true;
    const correct = String(userAnswer).trim() === String(q.answer).trim();

    // Disable and highlight options
    document.querySelectorAll('.mc-option').forEach(opt => {
      opt.classList.remove('selected', 'correct', 'wrong', 'disabled');
      if (!config.examMode) {
        opt.classList.add('disabled');
        if (opt.dataset.value === q.answer) {
          opt.classList.add('correct');
        } else if (opt.dataset.value === userAnswer && !correct) {
          opt.classList.add('wrong');
        }
      } else {
        if (opt.dataset.value === userAnswer) {
          opt.classList.add('selected');
        }
      }
    });

    if (!config.examMode) Session._showFeedback(q, correct, userAnswer);
    Session._recordAnswer(q, correct, userAnswer);
  },

  _answerTF(q, userAnswer) {
    const { config } = Session._state;
    Session._state.answered = true;
    const correct = String(userAnswer) === String(q.answer);

    document.querySelectorAll('.tf-btn').forEach(btn => {
      btn.classList.remove('selected', 'correct', 'wrong', 'disabled');
      if (!config.examMode) {
        btn.classList.add('disabled');
        if (btn.dataset.value === q.answer) {
          btn.classList.add('correct');
        } else if (btn.dataset.value === userAnswer && !correct) {
          btn.classList.add('wrong');
        }
      } else {
        if (btn.dataset.value === userAnswer) {
          btn.classList.add('selected');
        }
      }
    });

    if (!config.examMode) Session._showFeedback(q, correct, userAnswer);
    Session._recordAnswer(q, correct, userAnswer);
  },

  _answerFlashcard(q, correct) {
    Session._state.answered = true;
    document.querySelectorAll('.grade-btn').forEach(b => b.style.opacity = '0.5');
    Session._showFeedback(q, correct, correct ? q.answer : '?');
    Session._recordAnswer(q, correct, correct ? q.answer : '?');
  },

  _showFeedback(q, correct, userAnswer) {
    const feedbackEl = document.getElementById('q-feedback');
    const nextWrap   = document.getElementById('q-next-wrap');
    if (!feedbackEl) return;

    const isCorrect = correct;
    const answerHtml = q.type === 'true-false'
      ? escapeHtml(String(q.answer) === 'true' ? '✓ True' : '✗ False')
      : renderMarkdown(q.answer);

    feedbackEl.style.display = 'block';
    feedbackEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--sp-sm)">
        <div style="display:flex;align-items:center;gap:var(--sp-sm);font-weight:700;font-size:1rem;color:${isCorrect ? 'var(--emerald)' : 'var(--rose)'}">
          <span style="font-size:1.3rem">${isCorrect ? '✅' : '❌'}</span>
          ${isCorrect ? 'Correct!' : 'Incorrect'}
        </div>
        ${!isCorrect ? `
          <div class="explanation-banner" style="background:rgba(16,185,129,0.08);border-color:rgba(16,185,129,0.3)">
            <strong style="color:var(--emerald)">Correct answer:</strong>
            ${answerHtml}
          </div>` : ''}
        ${q.explanation ? `
          <div class="explanation-banner">
            <strong>Explanation:</strong>
            ${renderMarkdown(q.explanation)}
          </div>` : ''}
      </div>`;

    if (nextWrap) nextWrap.style.display = 'flex';

    // Auto-focus next button for keyboard flow
    setTimeout(() => document.getElementById('q-next-btn')?.focus(), 50);
  },

  async _recordAnswer(q, correct, userAnswer) {
    const { config } = Session._state;
    
    // In exam mode, we just update the examAnswers map
    if (config.examMode) {
      Session._state.examAnswers[q.id] = { correct, userAnswer };
      const nextWrap = document.getElementById('q-next-wrap');
      if (nextWrap) nextWrap.style.display = 'flex';
      return;
    }

    Session._state.answers.push({
      questionId:    q.id,
      question:      q.question,
      correct,
      userAnswer,
      correctAnswer: q.answer,
      topicId:       q.topicId,
      type:          q.type,
    });

    // Save progress to server (non-blocking)
    API.recordProgress(config.classId, q.topicId, q.id, correct).catch(() => {});
  },

  _nextQuestion() {
    const { current, questions, config } = Session._state;
    
    if (config.examMode && !Session._state.answered && current + 1 < questions.length) {
      // Allow skipping questions in exam mode
    }
    
    if (current + 1 >= questions.length) {
      if (config.examMode) {
        Modal.confirm('Are you sure you want to submit your exam?', () => {
          Session._finishSession();
        }, { title: 'Submit Exam' });
      } else {
        Session._finishSession();
      }
    } else {
      Session._state.current++;
      Session._renderQuestion();
    }
  },

  _prevQuestion() {
    if (Session._state.current > 0) {
      Session._state.current--;
      Session._renderQuestion();
    }
  },

  async _finishSession() {
    Session._stopTimer();
    const { answers, examAnswers, questions, config, startedAt, elapsed } = Session._state;
    
    let finalAnswers = answers;
    
    // In exam mode, build the answers array from examAnswers, and record all progress at once
    if (config.examMode) {
      finalAnswers = questions.map(q => {
        const ea = examAnswers[q.id] || { correct: false, userAnswer: null }; // Unanswered = wrong
        return {
          questionId:    q.id,
          question:      q.question,
          correct:       ea.correct,
          userAnswer:    ea.userAnswer,
          correctAnswer: q.answer,
          topicId:       q.topicId,
          type:          q.type,
        };
      });
      // Save progress to server for all questions
      for (const a of finalAnswers) {
        API.recordProgress(config.classId, a.topicId, a.questionId, a.correct).catch(() => {});
      }
    }

    const correct = finalAnswers.filter(a => a.correct).length;
    const score   = finalAnswers.length ? Math.round((correct / finalAnswers.length) * 100) : 0;

    // Save session
    try {
      const saved = await API.saveSession(config.classId, {
        classId:    config.classId,
        className:  config.className,
        topicIds:   config.topicIds,
        topicNames: config.topicNames,
        mode:       config.mode,
        startedAt,
        totalQuestions: finalAnswers.length,
        correct,
        score,
        duration:   elapsed,
        answers:    finalAnswers,
      });
      AppState.lastResults = { ...saved, classId: config.classId };
    } catch(e) {
      // Still show results even if save fails
      AppState.lastResults = {
        classId: config.classId, className: config.className,
        topicNames: config.topicNames,
        totalQuestions: finalAnswers.length, correct, score, duration: elapsed, answers: finalAnswers,
      };
    }

    Router.navigate('/results');
  }
};
