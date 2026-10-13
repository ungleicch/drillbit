/* ─── Class View ──────────────────────────────────────────────────────────── */
const ClassView = {
  _data: null,

  async render(container, classId) {
    container.innerHTML = `<div class="page"><div class="skeleton" style="height:400px;border-radius:var(--r-xl)"></div></div>`;
    try {
      const cls = await API.getClass(classId);
      ClassView._data = cls;
      ClassView._renderPage(container, cls);
    } catch(e) {
      Toast.error('Failed to load class');
      Router.navigate('/');
    }
  },

  _renderPage(container, cls) {
    const color = cls.color || '#6366f1';
    const sc = cls.learnScore || 0;
    container.innerHTML = `
      <div class="page">
        <div class="breadcrumb">
          <a href="#/">Home</a>
          <span class="breadcrumb-sep">›</span>
          <span>${cls.name}</span>
        </div>
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title" style="background:linear-gradient(135deg,${color},#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${cls.name}</h1>
            ${cls.description ? `<p class="page-subtitle">${cls.description}</p>` : ''}
          </div>
          <div class="page-header-actions">
            <button class="btn btn-ghost" id="cv-edit-btn" title="Edit class">✏️ Edit</button>
            <button class="btn btn-ghost" id="cv-history-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              History
            </button>
            <button class="btn btn-teal" id="cv-practice-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Practice
            </button>
            <button class="btn btn-primary" id="cv-new-topic-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Topic
            </button>
          </div>
        </div>

        <!-- Stats -->
        <div class="stat-grid" style="margin-bottom:var(--sp-2xl)">
          <div class="stat-card">
            <div class="stat-label">Topics</div>
            <div class="stat-value" style="color:var(--indigo-light)">${cls.topics.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Questions</div>
            <div class="stat-value" style="color:var(--teal)">${cls.topics.reduce((a,t) => a + (t.questionCount||0), 0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Sessions</div>
            <div class="stat-value" style="color:var(--amber)">${cls.sessionCount || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Class Score</div>
            <div class="stat-value" style="color:${scoreColor(sc)}">${sc}%</div>
          </div>
        </div>

        <!-- Topics -->
        <div class="section-header">
          <span class="section-title">Topics</span>
        </div>
        <div id="cv-topics" style="display:flex;flex-direction:column;gap:var(--sp-sm)"></div>
      </div>`;

    document.getElementById('cv-new-topic-btn').addEventListener('click', () => ClassView.showNewTopicModal(cls.id));
    document.getElementById('cv-history-btn').addEventListener('click', () => Router.navigate(`/history/${cls.id}`));
    document.getElementById('cv-practice-btn').addEventListener('click', () => ClassView.showPracticeModal(cls));
    document.getElementById('cv-edit-btn').addEventListener('click', () => ClassView.showEditClassModal(cls));

    ClassView._renderTopics(cls);
  },

  _renderTopics(cls) {
    const el = document.getElementById('cv-topics');
    if (!cls.topics.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No topics yet</div>
        <div class="empty-desc">Add a topic to start organizing your questions.</div>
        <button class="btn btn-primary" id="cv-topics-empty-btn">Add First Topic</button>
      </div>`;
      document.getElementById('cv-topics-empty-btn').onclick = () => ClassView.showNewTopicModal(cls.id);
      return;
    }

    el.innerHTML = cls.topics.map(t => {
      const sc = t.learnScore || 0;
      return `
        <div class="card topic-card card-clickable" data-tid="${t.id}" data-cid="${cls.id}">
          <div class="score-ring-wrap">${buildScoreRing(sc, 48, 4)}</div>
          <div class="topic-card-info">
            <div class="topic-card-name">${t.name}</div>
            <div class="topic-card-meta">
              <span>${t.questionCount || 0} question${t.questionCount !== 1 ? 's' : ''}</span>
              ${t.description ? `<span>· ${t.description}</span>` : ''}
            </div>
          </div>
          <div class="topic-card-actions">
            <button class="btn btn-sm btn-ghost topic-edit-btn" data-tid="${t.id}" title="Edit topic">✏️</button>
            <button class="btn btn-sm btn-teal topic-practice-btn" data-tid="${t.id}" data-tname="${t.name}" title="Quick Practice">▶ Practice</button>
            <button class="btn btn-sm btn-danger topic-delete-btn" data-tid="${t.id}" data-tname="${t.name}" title="Delete topic">✕</button>
          </div>
        </div>`;
    }).join('');

    el.querySelectorAll('.topic-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.topic-practice-btn') || e.target.closest('.topic-delete-btn') || e.target.closest('.topic-edit-btn')) return;
        Router.navigate(`/class/${card.dataset.cid}/topic/${card.dataset.tid}`);
      });
    });

    el.querySelectorAll('.topic-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const t = cls.topics.find(x => x.id === btn.dataset.tid);
        if (t) ClassView.showEditTopicModal(cls, t);
      });
    });

    el.querySelectorAll('.topic-practice-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const t = cls.topics.find(t => t.id === btn.dataset.tid);
        AppState.sessionConfig = {
          classId: cls.id, className: cls.name,
          topicIds: [t.id], topicNames: [t.name],
          mode: 'mixed', limit: 0, focusWeak: false
        };
        Router.navigate('/session');
      });
    });

    el.querySelectorAll('.topic-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const tname = btn.dataset.tname;
        Modal.confirm(
          `Delete topic <strong>"${tname}"</strong>? All questions and progress will be lost.`,
          async () => {
            try {
              await API.deleteTopic(cls.id, btn.dataset.tid);
              Toast.success(`Topic "${tname}" deleted`);
              const updated = await API.getClass(cls.id);
              ClassView._data = updated;
              ClassView._renderPage(document.getElementById('view-container'), updated);
            } catch(err) { Toast.error(err.message); }
          },
          { title: 'Delete Topic', confirmText: 'Delete Topic', confirmClass: 'btn-danger' }
        );
      });
    });
  },

  showNewTopicModal(classId) {
    Modal.open(`
      <form id="new-topic-form">
        <div class="form-group">
          <label class="form-label">Topic Name *</label>
          <input class="form-input" id="nt-name" placeholder="e.g. Chapter 3: Cell Biology" maxlength="80" required />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-input" id="nt-desc" placeholder="Optional" maxlength="120" />
        </div>
        <div style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-lg)">
          <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Topic</button>
        </div>
      </form>`, 'New Topic');

    document.getElementById('new-topic-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('nt-name').value.trim();
      if (!name) return;
      try {
        await API.createTopic(classId, { name, description: document.getElementById('nt-desc').value.trim() });
        Modal.close();
        Toast.success(`Topic "${name}" created!`);
        const updated = await API.getClass(classId);
        ClassView._data = updated;
        ClassView._renderPage(document.getElementById('view-container'), updated);
      } catch(err) { Toast.error(err.message); }
    });
  },


  showEditClassModal(cls) {
    const COLORS = ['#6366f1','#14b8a6','#f59e0b','#f43f5e','#10b981','#a855f7','#818cf8','#f97316'];
    let selectedColor = cls.color || COLORS[0];
    Modal.open(`
      <form id="cv-edit-class-form">
        <div class="form-group">
          <label class="form-label">Class Name *</label>
          <input class="form-input" id="cve-name" value="${(cls.name || '').replace(/"/g, '&quot;')}" maxlength="60" required />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-input" id="cve-desc" value="${(cls.description || '').replace(/"/g, '&quot;')}" maxlength="120" />
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-swatches">
            ${COLORS.map(c => `<div class="color-swatch${c===selectedColor?' selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-lg)">
          <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>`, 'Edit Class');
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        selectedColor = sw.dataset.color;
      });
    });
    document.getElementById('cv-edit-class-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('cve-name').value.trim();
      if (!name) return;
      try {
        await API.updateClass(cls.id, {
          name,
          description: document.getElementById('cve-desc').value.trim(),
          color: selectedColor
        });
        Modal.close();
        Toast.success('Class updated');
        ClassView.render(document.getElementById('view-container'), cls.id);
      } catch (err) { Toast.error(err.message); }
    });
  },

  showEditTopicModal(cls, topic) {
    Modal.open(`
      <form id="cv-edit-topic-form">
        <div class="form-group">
          <label class="form-label">Topic Name *</label>
          <input class="form-input" id="cvt-name" value="${(topic.name || '').replace(/"/g, '&quot;')}" maxlength="80" required />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-input" id="cvt-desc" value="${(topic.description || '').replace(/"/g, '&quot;')}" maxlength="120" />
        </div>
        <div style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-lg)">
          <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>`, 'Edit Topic');
    document.getElementById('cv-edit-topic-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('cvt-name').value.trim();
      if (!name) return;
      try {
        await API.updateTopic(cls.id, topic.id, {
          name,
          description: document.getElementById('cvt-desc').value.trim()
        });
        Modal.close();
        Toast.success('Topic updated');
        ClassView.render(document.getElementById('view-container'), cls.id);
      } catch (err) { Toast.error(err.message); }
    });
  },

  showPracticeModal(cls) {
    if (!cls.topics.length) { Toast.info('Add topics first'); return; }
    const totalQ = cls.topics.reduce((a, t) => a + (t.questionCount || 0), 0);
    if (totalQ === 0) { Toast.info('Add questions to your topics first'); return; }

    Modal.open(`
      <p class="form-hint" style="margin-bottom:var(--sp-md)">Select topics to include in this session:</p>
      <div class="topic-checkbox-list" id="pc-topics">
        ${cls.topics.map(t => `
          <label class="topic-checkbox-item">
            <input type="checkbox" class="topic-checkbox" value="${t.id}" data-name="${t.name}" checked />
            <span class="topic-checkbox-label">${t.name}</span>
            <span class="topic-checkbox-count">${t.questionCount || 0} q</span>
          </label>`).join('')}
      </div>
      <hr class="divider" />
      <div class="form-group">
        <label class="form-label">Question limit (0 = all)</label>
        <input type="number" class="form-input" id="pc-limit" value="0" min="0" max="200" />
      </div>
      <div class="form-group">
        <label class="form-label">Mode</label>
        <select class="form-select" id="pc-mode">
          <option value="mixed">Mixed (random order)</option>
          <option value="weak">Focus on weak questions first</option>
          <option value="exam">Exam Mode (delayed results, navigation)</option>
        </select>
      </div>
      <div class="form-group" id="pc-time-limit-group" style="display:none">
        <label class="form-label">Time Limit (minutes, 0 = unlimited)</label>
        <input type="number" class="form-input" id="pc-time-limit" value="0" min="0" max="300" />
      </div>
      <div style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-lg)">
        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-teal btn-lg" id="pc-start-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start Session
        </button>
      </div>`, `Practice — ${cls.name}`);

    const modeSelect = document.getElementById('pc-mode');
    const timeGroup = document.getElementById('pc-time-limit-group');
    modeSelect.addEventListener('change', () => {
      timeGroup.style.display = modeSelect.value === 'exam' ? 'block' : 'none';
    });

    document.getElementById('pc-start-btn').addEventListener('click', () => {
      const checked = [...document.querySelectorAll('.topic-checkbox:checked')];
      if (!checked.length) { Toast.info('Select at least one topic'); return; }
      const topicIds   = checked.map(c => c.value);
      const topicNames = checked.map(c => c.dataset.name);
      const limit      = parseInt(document.getElementById('pc-limit').value) || 0;
      const mode       = document.getElementById('pc-mode').value;
      const examMode   = mode === 'exam';
      const timeLimit  = examMode ? (parseInt(document.getElementById('pc-time-limit').value) || 0) : 0;
      
      AppState.sessionConfig = {
        classId: cls.id, className: cls.name,
        topicIds, topicNames, mode: examMode ? 'mixed' : mode, limit,
        focusWeak: mode === 'weak',
        examMode, timeLimit
      };
      Modal.close();
      Router.navigate('/session');
    });
  }
};
