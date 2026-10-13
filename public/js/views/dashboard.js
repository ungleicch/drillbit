/* ─── Dashboard View ─────────────────────────────────────────────────────── */
const Dashboard = {
  async render(container) {
    container.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Your Classes</h1>
            <p class="page-subtitle">Track your progress and start a practice session.</p>
          </div>
          <div class="page-header-actions">
          </div>
        </div>
        <div id="dash-stats" class="stat-grid"></div>
        <div id="dash-classes" class="grid-3">
          <div class="skeleton" style="height:180px;border-radius:var(--r-xl)"></div>
          <div class="skeleton" style="height:180px;border-radius:var(--r-xl)"></div>
          <div class="skeleton" style="height:180px;border-radius:var(--r-xl)"></div>
        </div>
      </div>`;

    try {
      const classes = await API.getClasses();
      Dashboard._renderStats(classes);
      Dashboard._renderClasses(classes);
    } catch(e) {
      Toast.error('Failed to load classes');
      console.error(e);
    }
  },

  _renderStats(classes) {
    const totalTopics = classes.reduce((a, c) => a + (c.topicCount || 0), 0);
    const avgScore = classes.length
      ? Math.round(classes.reduce((a, c) => a + (c.learnScore || 0), 0) / classes.length)
      : 0;
    document.getElementById('dash-stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Classes</div>
        <div class="stat-value" style="background:var(--grad-indigo);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${classes.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sub-Topics</div>
        <div class="stat-value" style="color:var(--teal)">${totalTopics}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Learn Score</div>
        <div class="stat-value" style="color:${scoreColor(avgScore)}">${avgScore}%</div>
      </div>`;
  },

  _renderClasses(classes) {
    const el = document.getElementById('dash-classes');
    if (!classes.length) {
      el.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">📚</div>
          <div class="empty-title">No classes yet</div>
          <div class="empty-desc">Create your first class to start studying.</div>
          <button class="btn btn-primary btn-lg" id="dash-empty-new">Create a Class</button>
        </div>`;
      document.getElementById('dash-empty-new').onclick = () => Dashboard.showNewClassModal();
      return;
    }

    const COLORS = ['#6366f1','#14b8a6','#f59e0b','#f43f5e','#10b981','#a855f7'];
    el.innerHTML = classes.map((cls, i) => {
      const color = cls.color || COLORS[i % COLORS.length];
      const sc = cls.learnScore || 0;
      return `
        <div class="card class-card card-clickable" data-id="${cls.id}" style="padding-top:calc(var(--sp-lg) + 3px)">
          <div class="class-card-accent" style="background:${color}"></div>
          <div class="class-card-header">
            <div>
              <div class="class-card-title">${escapeHtml(cls.name)}</div>
              ${cls.description ? `<div class="class-card-desc">${escapeHtml(cls.description)}</div>` : ''}
            </div>
            <div class="score-ring-wrap">${buildScoreRing(sc, 56, 4)}</div>
          </div>
          <div class="class-card-footer">
            <div class="class-card-meta">
              <span>📂 ${cls.topicCount || 0} topic${cls.topicCount !== 1 ? 's' : ''}</span>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-ghost edit-class-btn" data-id="${cls.id}" title="Edit class">✏️</button>
              <button class="btn btn-sm btn-danger delete-class-btn" data-id="${cls.id}" style="opacity:0.6">Delete</button>
            </div>
          </div>
        </div>`;
    }).join('');

    el.querySelectorAll('.class-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.delete-class-btn') || e.target.closest('.edit-class-btn')) return;
        Router.navigate(`/class/${card.dataset.id}`);
      });
    });
    el.querySelectorAll('.edit-class-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const cls = classes.find(c => c.id === btn.dataset.id);
        if (cls) Dashboard.showEditClassModal(cls);
      });
    });
    el.querySelectorAll('.delete-class-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const cls = classes.find(c => c.id === id);
        Modal.confirm(
          `Delete <strong>${escapeHtml(cls?.name)}</strong>? All topics, questions, and progress will be lost.`,
          async () => {
            try {
              await API.deleteClass(id);
              Toast.success('Class deleted');
              Dashboard.render(document.getElementById('view-container'));
            } catch(err) { Toast.error(err.message); }
          },
          { title: 'Delete Class', confirmText: 'Delete Forever', confirmClass: 'btn-danger' }
        );
      });
    });
  },

  showNewClassModal() {
    const COLORS = ['#6366f1','#14b8a6','#f59e0b','#f43f5e','#10b981','#a855f7','#818cf8','#f97316'];
    let selectedColor = COLORS[0];
    Modal.open(`
      <form id="new-class-form">
        <div class="form-group">
          <label class="form-label">Class Name *</label>
          <input class="form-input" id="nc-name" placeholder="e.g. Biology 101" maxlength="60" required />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-input" id="nc-desc" placeholder="Optional short description" maxlength="120" />
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-swatches">
            ${COLORS.map((c, i) => `<div class="color-swatch${i===0?' selected':''}" data-color="${c}" style="background:${c}" title="${c}"></div>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-lg)">
          <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Class</button>
        </div>
      </form>`, 'New Class');

    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        selectedColor = sw.dataset.color;
      });
    });

    document.getElementById('new-class-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('nc-name').value.trim();
      if (!name) return;
      try {
        await API.createClass({ name, description: document.getElementById('nc-desc').value.trim(), color: selectedColor });
        Modal.close();
        Toast.success(`Class "${name}" created!`);
        Dashboard.render(document.getElementById('view-container'));
      } catch(err) { Toast.error(err.message); }
    });
  },
  showEditClassModal(cls) {
    const COLORS = ['#6366f1','#14b8a6','#f59e0b','#f43f5e','#10b981','#a855f7','#818cf8','#f97316'];
    let selectedColor = cls.color || COLORS[0];
    Modal.open(`
      <form id="edit-class-form">
        <div class="form-group">
          <label class="form-label">Class Name *</label>
          <input class="form-input" id="ec-name" value="${(cls.name || '').replace(/"/g, '&quot;')}" maxlength="60" required />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-input" id="ec-desc" value="${(cls.description || '').replace(/"/g, '&quot;')}" maxlength="120" />
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-swatches">
            ${COLORS.map(c => `<div class="color-swatch${c===selectedColor?' selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-lg)">
          <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>`, 'Edit Class');

    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        selectedColor = sw.dataset.color;
      });
    });

    document.getElementById('edit-class-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('ec-name').value.trim();
      if (!name) return;
      try {
        await API.updateClass(cls.id, {
          name,
          description: document.getElementById('ec-desc').value.trim(),
          color: selectedColor
        });
        Modal.close();
        Toast.success('Class updated');
        Dashboard.render(document.getElementById('view-container'));
      } catch (err) { Toast.error(err.message); }
    });
  }
};

