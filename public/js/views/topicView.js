/* ─── Topic View ──────────────────────────────────────────────────────────── */
const TopicView = {
  _keyHandler: null,
  _pendingMediaFile: null,

  _bindTopicKeys(classId, topicId, cls, topic) {
    if (TopicView._keyHandler) {
      document.removeEventListener('keydown', TopicView._keyHandler);
    }
    TopicView._keyHandler = (e) => {
      if (Modal.isOpen()) return;
      // Only active while this topic is on screen.
      if (!location.hash.includes(`/topic/${topicId}`)) return;
      const tag = (e.target && e.target.tagName) || '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target?.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        TopicView.showAddQuestionModal(classId, topicId, cls, topic);
      }
    };
    document.addEventListener('keydown', TopicView._keyHandler);
  },

  _setupMediaArea(prefix, existingUrl) {
    TopicView._pendingMediaFile = null;
    const zone = document.getElementById(prefix + '-media-zone');
    const input = document.getElementById(prefix + '-media');
    const preview = document.getElementById(prefix + '-media-preview');
    const previewImg = document.getElementById(prefix + '-media-preview-img');
    const clearBtn = document.getElementById(prefix + '-media-clear');
    if (!zone || !input) return;

    const showPreview = (fileOrUrl) => {
      if (!preview || !previewImg) return;
      if (fileOrUrl instanceof File) {
        if (!fileOrUrl.type.startsWith('image/') && !fileOrUrl.type.startsWith('video/')) {
          Toast.error('Only images or video allowed');
          return;
        }
        TopicView._pendingMediaFile = fileOrUrl;
        const url = URL.createObjectURL(fileOrUrl);
        if (fileOrUrl.type.startsWith('video/')) {
          previewImg.outerHTML = `<video id="${prefix}-media-preview-img" src="${url}" controls style="max-height:120px;max-width:100%;border-radius:var(--r-md);border:1px solid var(--border)"></video>`;
        } else {
          const el = document.getElementById(prefix + '-media-preview-img');
          if (el.tagName === 'VIDEO') {
            el.outerHTML = `<img id="${prefix}-media-preview-img" src="${url}" alt="preview" />`;
          } else {
            el.src = url;
          }
        }
        preview.classList.add('visible');
      } else if (typeof fileOrUrl === 'string' && fileOrUrl) {
        const el = document.getElementById(prefix + '-media-preview-img');
        if (el) el.src = fileOrUrl;
        preview.classList.add('visible');
      }
    };

    if (existingUrl) showPreview(existingUrl);

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) showPreview(f);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) showPreview(input.files[0]);
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        TopicView._pendingMediaFile = null;
        input.value = '';
        preview.classList.remove('visible');
        const el = document.getElementById(prefix + '-media-preview-img');
        if (el) el.removeAttribute('src');
        if (prefix === 'eq') TopicView._clearExistingMedia = true;
      });
    }

    // Paste images while modal is open
    const pasteHandler = (e) => {
      if (!Modal.isOpen()) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          e.preventDefault();
          const f = item.getAsFile();
          if (f) showPreview(f);
          break;
        }
      }
    };
    document.addEventListener('paste', pasteHandler);
    // Clean up when modal closes — monkey-patch once per open via MutationObserver-ish: store and remove on next Modal.close
    const prevClose = Modal.close;
    Modal.close = function() {
      document.removeEventListener('paste', pasteHandler);
      Modal.close = prevClose;
      prevClose();
    };
  },

  async _resolveMedia(qData, keepExisting) {
    if (TopicView._pendingMediaFile) {
      const mRes = await API.uploadMedia(TopicView._pendingMediaFile);
      qData.mediaUrl = mRes.url;
      TopicView._pendingMediaFile = null;
      TopicView._clearExistingMedia = false;
      return;
    }
    if (TopicView._clearExistingMedia) {
      qData.mediaUrl = null;
      TopicView._clearExistingMedia = false;
      return;
    }
    if (keepExisting) qData.mediaUrl = keepExisting;
  },

  async render(container, classId, topicId) {
    container.innerHTML = `<div class="page"><div class="skeleton" style="height:400px;border-radius:var(--r-xl)"></div></div>`;
    try {
      const [cls, questions] = await Promise.all([
        API.getClass(classId),
        API.getQuestions(classId, topicId)
      ]);
      const topic = cls.topics.find(t => t.id === topicId);
      if (!topic) throw new Error('Topic not found');
      TopicView._render(container, classId, cls, topicId, topic, questions);
    } catch(e) {
      Toast.error('Failed to load topic');
      console.error(e);
    }
  },

  _render(container, classId, cls, topicId, topic, questions) {
    const sc = topic.learnScore || 0;
    container.innerHTML = `
      <div class="page">
        <div class="breadcrumb">
          <a href="#/">Home</a>
          <span class="breadcrumb-sep">›</span>
          <a href="#/class/${classId}">${cls.name}</a>
          <span class="breadcrumb-sep">›</span>
          <span>${topic.name}</span>
        </div>
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title" style="display:flex;align-items:center;gap:8px">
              <input class="inline-rename-input" id="tv-topic-name" value="${topic.name.replace(/"/g, '&quot;')}" title="Click to rename" />
            </h1>
            ${topic.description ? `<p class="page-subtitle">${topic.description}</p>` : ''}
            <p class="form-hint" style="margin-top:4px">Press <kbd>n</kbd> to add a question</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-ghost" id="tv-add-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Question
            </button>
            <button class="btn btn-ghost" id="tv-upload-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
              Upload JSON
            </button>
            <button class="btn btn-ghost" id="tv-format-btn" title="View question format guide">
              📋 Format Guide
            </button>
            <button class="btn btn-teal" id="tv-practice-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Practice This Topic
            </button>
          </div>
        </div>

        <!-- Stats -->
        <div class="stat-grid" style="margin-bottom:var(--sp-2xl)">
          <div class="stat-card">
            <div class="stat-label">Questions</div>
            <div class="stat-value" style="color:var(--indigo-light)">${questions.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Learn Score</div>
            <div class="stat-value" style="color:${scoreColor(sc)}">${sc}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Multiple Choice</div>
            <div class="stat-value" style="color:var(--teal)">${questions.filter(q=>q.type==='multiple-choice').length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">True / False</div>
            <div class="stat-value" style="color:var(--amber)">${questions.filter(q=>q.type==='true-false').length}</div>
          </div>
        </div>

        <!-- Questions list -->
        <div class="section-header">
          <span class="section-title">Questions (${questions.length})</span>
          ${questions.length ? `<button class="btn btn-sm btn-danger" id="tv-reset-btn">Reset Progress</button>` : ''}
        </div>
        <div id="tv-questions" style="display:flex;flex-direction:column;gap:var(--sp-sm)"></div>
      </div>`;

    // Wire buttons
    document.getElementById('tv-practice-btn').addEventListener('click', () => {
      if (!questions.length) { Toast.info('Upload some questions first'); return; }
      AppState.sessionConfig = {
        classId, className: cls.name,
        topicIds: [topicId], topicNames: [topic.name],
        mode: 'mixed', limit: 0, focusWeak: false
      };
      Router.navigate('/session');
    });

    document.getElementById('tv-upload-btn').addEventListener('click', () => TopicView.showUploadModal(classId, topicId, cls, topic));
    document.getElementById('tv-add-btn').addEventListener('click', () => TopicView.showAddQuestionModal(classId, topicId, cls, topic));
    document.getElementById('tv-format-btn').addEventListener('click', () => TopicView.showFormatGuide());
    TopicView._bindTopicKeys(classId, topicId, cls, topic);

    const nameInput = document.getElementById('tv-topic-name');
    if (nameInput) {
      const saveName = async () => {
        const name = nameInput.value.trim();
        if (!name || name === topic.name) { nameInput.value = topic.name; return; }
        try {
          await API.updateTopic(classId, topicId, { name });
          topic.name = name;
          Toast.success('Topic renamed');
          // refresh breadcrumb text
          TopicView.render(document.getElementById('view-container'), classId, topicId);
        } catch (err) {
          Toast.error(err.message);
          nameInput.value = topic.name;
        }
      };
      nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
        if (e.key === 'Escape') { nameInput.value = topic.name; nameInput.blur(); }
      });
      nameInput.addEventListener('blur', saveName);
    }

    const resetBtn = document.getElementById('tv-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        Modal.confirm('Reset all progress for this topic? Your question scores will be cleared.', async () => {
          await API.resetProgress(classId, topicId);
          Toast.success('Progress reset');
          TopicView.render(document.getElementById('view-container'), classId, topicId);
        }, { title: 'Reset Progress', confirmText: 'Reset', confirmClass: 'btn-danger' });
      });
    }

    TopicView._renderQuestions(document.getElementById('tv-questions'), classId, topicId, cls, topic, questions);
  },

  _renderQuestions(el, classId, topicId, cls, topic, questions) {
    if (!questions.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❓</div>
          <div class="empty-title">No questions yet</div>
          <div class="empty-desc">Upload a JSON file or add questions manually.</div>
          <div style="display:flex;gap:var(--sp-sm)">
            <button class="btn btn-primary" id="tv-q-upload">Upload JSON</button>
            <button class="btn btn-ghost" id="tv-q-add">Add Manually</button>
            <button class="btn btn-ghost" id="tv-q-guide">📋 Format Guide</button>
          </div>
        </div>`;
      document.getElementById('tv-q-upload').onclick = () => TopicView.showUploadModal(classId, topicId, cls, topic);
      document.getElementById('tv-q-add').onclick    = () => TopicView.showAddQuestionModal(classId, topicId, cls, topic);
      document.getElementById('tv-q-guide').onclick  = () => TopicView.showFormatGuide();
      return;
    }

    el.innerHTML = questions.map(q => {
      const hist = q.progress?.history || [];
      const last5 = hist.slice(-5);
      const mastery = last5.length ? last5.reduce((a, h) => a + (h.correct ? 20 : 0), 0) : 0;
      const mastColor = scoreColor(mastery);
      const thumb = q.mediaUrl
        ? `<img class="question-thumb" src="${q.mediaUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />`
        : `<span class="question-thumb" style="display:inline-flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--text-muted)">—</span>`;
      return `
        <div class="question-item">
          ${thumb}
          <span class="question-type-badge ${typeBadgeClass(q.type)}">${typeLabel(q.type)}</span>
          <span class="question-text" title="${escapeHtml(stripMarkdown(q.question))}">${escapeHtml(stripMarkdown(q.question))}</span>
          <div class="question-mastery" style="color:${mastColor}">
            <div class="question-mastery-bar">
              <div class="question-mastery-fill" style="width:${mastery}%;background:${mastColor}"></div>
            </div>
            ${mastery}%
          </div>
          <button class="btn btn-sm btn-ghost dup-q-btn" data-qid="${q.id}" title="Duplicate question">⧉ Dup</button>
          <button class="btn btn-sm btn-ghost edit-q-btn" data-qid="${q.id}" title="Edit question">✏️ Edit</button>
          <button class="btn btn-sm btn-danger delete-q-btn" data-qid="${q.id}" title="Delete question">✕</button>
        </div>`;
    }).join('');

    el.querySelectorAll('.edit-q-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.qid;
        const q = questions.find(question => question.id === qId);
        TopicView.showEditQuestionModal(classId, topicId, cls, topic, q);
      });
    });

    el.querySelectorAll('.dup-q-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.duplicateQuestion(classId, topicId, btn.dataset.qid);
          Toast.success('Question duplicated');
          TopicView.render(document.getElementById('view-container'), classId, topicId);
        } catch (err) { Toast.error(err.message); }
      });
    });

    el.querySelectorAll('.delete-q-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Modal.confirm('Delete this question?', async () => {
          await API.deleteQuestion(classId, topicId, btn.dataset.qid);
          Toast.success('Question deleted');
          TopicView.render(document.getElementById('view-container'), classId, topicId);
        }, { title: 'Delete Question', confirmText: 'Delete', confirmClass: 'btn-danger' });
      });
    });
  },

  showUploadModal(classId, topicId, cls, topic) {
    Modal.open(`
      <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:var(--sp-md)">
        Upload a <strong>.json</strong> file containing an array of question objects. Questions will be added to this topic.
      </p>
      <div class="drop-zone" id="tv-drop-zone">
        <div class="drop-zone-icon">📂</div>
        <div class="drop-zone-text">Drop your JSON file here, or click to browse</div>
        <div class="drop-zone-sub">Only .json files are accepted</div>
        <input type="file" id="tv-file-input" accept=".json" style="display:none" />
      </div>
      <div id="tv-upload-result" style="margin-top:var(--sp-md)"></div>
      <div style="display:flex;gap:var(--sp-sm);justify-content:space-between;margin-top:var(--sp-lg)">
        <button class="btn btn-ghost btn-sm" id="tv-upload-guide-btn">📋 View Format Guide</button>
        <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
      </div>`, `Upload Questions — ${topic.name}`);

    const dropZone = document.getElementById('tv-drop-zone');
    const fileInput = document.getElementById('tv-file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) TopicView._uploadFile(classId, topicId, e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) TopicView._uploadFile(classId, topicId, fileInput.files[0]); });
    document.getElementById('tv-upload-guide-btn').addEventListener('click', () => { Modal.close(); TopicView.showFormatGuide(); });
  },

  async _uploadFile(classId, topicId, file) {
    const result = document.getElementById('tv-upload-result');
    result.innerHTML = `<div class="chip">Uploading…</div>`;
    try {
      const res = await API.uploadQuestions(classId, topicId, file);
      result.innerHTML = `<div class="chip" style="background:rgba(16,185,129,0.2);color:var(--emerald);border-color:rgba(16,185,129,0.4)">✓ Added ${res.added} question${res.added!==1?'s':''}. Total: ${res.total}</div>`;
      Toast.success(`${res.added} questions added!`);
      setTimeout(() => {
        Modal.close();
        TopicView.render(document.getElementById('view-container'), classId, topicId);
      }, 1200);
    } catch(e) {
      result.innerHTML = `<div class="chip" style="background:rgba(244,63,94,0.2);color:var(--rose)">✕ ${e.message}</div>`;
    }
  },

  showAddQuestionModal(classId, topicId, cls, topic) {
    Modal.open(`
      <form id="add-q-form">
        <div class="form-group">
          <label class="form-label">Question Type</label>
          <select class="form-select" id="aq-type">
            <option value="multiple-choice">Multiple Choice</option>
            <option value="true-false">True / False</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Question *</label>
          <textarea class="form-textarea" id="aq-question" placeholder="Enter your question..." required></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Question Media (drag-drop, paste, or browse)</label>
          <div class="media-drop-zone" id="aq-media-zone">
            <div style="font-size:0.85rem;color:var(--text-secondary)">Drop image/gif/video here, paste from clipboard, or click to browse</div>
            <div class="form-hint">Max 8MB · images & video</div>
            <input type="file" id="aq-media" accept="image/*,video/*" />
          </div>
          <div class="media-preview" id="aq-media-preview">
            <img id="aq-media-preview-img" alt="preview" />
            <button type="button" class="btn btn-sm btn-ghost" id="aq-media-clear">Remove</button>
          </div>
        </div>
        <div id="aq-mc-fields">
          <div class="form-group">
            <label class="form-label">✅ Correct Answer</label>
            <input class="form-input" id="aq-correct-answer" placeholder="The correct answer text" />
          </div>
          <div class="form-group">
            <label class="form-label">Wrong Options (Distractors)</label>
            <div id="aq-distractors-container"></div>
            <button type="button" class="btn btn-ghost btn-sm" id="aq-add-distractor-btn" style="margin-top:var(--sp-xs)">+ Add Wrong Option</button>
          </div>
        </div>
        <div id="aq-tf-fields" style="display:none">
          <div class="form-group">
            <label class="form-label">Correct Answer</label>
            <select class="form-select" id="aq-tf-answer">
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Explanation (optional)</label>
          <textarea class="form-textarea" id="aq-explanation" placeholder="Why is this the correct answer?"></textarea>
        </div>
        <div style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-lg);flex-wrap:wrap">
          <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button type="button" class="btn btn-teal" id="aq-next-btn" title="Cmd/Ctrl+Enter">Add &amp; Next</button>
          <button type="submit" class="btn btn-primary" id="aq-submit-btn">Add Question</button>
        </div>
        <p class="form-hint" style="text-align:right;margin-top:6px">Tip: ⌘/Ctrl+Enter = Add &amp; Next</p>
      </form>`, `Add Question — ${topic.name}`);

    TopicView._clearExistingMedia = false;
    TopicView._setupMediaArea('aq');

    const typeSelect = document.getElementById('aq-type');
    typeSelect.addEventListener('change', () => {
      document.getElementById('aq-mc-fields').style.display = typeSelect.value === 'multiple-choice' ? '' : 'none';
      document.getElementById('aq-tf-fields').style.display = typeSelect.value === 'true-false'    ? '' : 'none';
    });

    function addDistractorRow(containerId, val = '', included = true) {
      const container = document.getElementById(containerId);
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:var(--sp-xs);margin-bottom:4px';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.dataset.included = included ? 'true' : 'false';
      toggleBtn.style.cssText = 'flex-shrink:0;width:110px;font-size:0.78rem';
      const setToggleState = (inc) => {
        toggleBtn.dataset.included = inc ? 'true' : 'false';
        toggleBtn.className = inc ? 'btn btn-sm btn-emerald' : 'btn btn-sm btn-ghost';
        toggleBtn.style.opacity = inc ? '1' : '0.5';
        toggleBtn.innerHTML = inc ? '👁️ Included' : '🚫 Excluded';
      };
      setToggleState(included);
      toggleBtn.onclick = () => setToggleState(toggleBtn.dataset.included !== 'true');

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input';
      input.placeholder = 'Wrong option text';
      input.value = val;
      input.style.flex = '1';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-ghost btn-sm';
      delBtn.style.color = 'var(--rose)';
      delBtn.title = 'Remove';
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      delBtn.onclick = () => div.remove();

      div.appendChild(toggleBtn);
      div.appendChild(input);
      div.appendChild(delBtn);
      container.appendChild(div);
    }

    addDistractorRow('aq-distractors-container', '', true);
    addDistractorRow('aq-distractors-container', '', true);
    addDistractorRow('aq-distractors-container', '', true);

    document.getElementById('aq-add-distractor-btn').addEventListener('click', () => {
      addDistractorRow('aq-distractors-container', '', true);
    });

    async function collectAndSave(stayOpen) {
      const type = typeSelect.value;
      const question = document.getElementById('aq-question').value.trim();
      const explanation = document.getElementById('aq-explanation').value.trim();
      if (!question) { Toast.error('Enter a question'); return; }

      let qData = { type, question, explanation };
      if (type === 'multiple-choice') {
        const answer = document.getElementById('aq-correct-answer').value.trim();
        if (!answer) { Toast.error('Enter the correct answer'); return; }
        const rows = document.getElementById('aq-distractors-container').children;
        const activeOpts = [];
        const inactiveOpts = [];
        for (const row of rows) {
          const tb = row.querySelector('button[data-included]');
          const t = row.querySelector('input[type="text"]').value.trim();
          if (t) {
            if (tb && tb.dataset.included === 'true') activeOpts.push(t);
            else inactiveOpts.push(t);
          }
        }
        if (activeOpts.length < 1) { Toast.error('Add at least 1 wrong option (included)'); return; }
        qData = { ...qData, options: [answer, ...activeOpts], answer, inactiveOptions: inactiveOpts };
      } else {
        qData = { ...qData, answer: document.getElementById('aq-tf-answer').value };
      }

      const submitBtn = document.getElementById('aq-submit-btn');
      const nextBtn = document.getElementById('aq-next-btn');
      submitBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      try {
        await TopicView._resolveMedia(qData);
        await API.addQuestion(classId, topicId, qData);
        Toast.success('Question added!');
        if (stayOpen) {
          document.getElementById('aq-question').value = '';
          document.getElementById('aq-explanation').value = '';
          document.getElementById('aq-correct-answer') && (document.getElementById('aq-correct-answer').value = '');
          TopicView._pendingMediaFile = null;
          const preview = document.getElementById('aq-media-preview');
          if (preview) preview.classList.remove('visible');
          const mediaInput = document.getElementById('aq-media');
          if (mediaInput) mediaInput.value = '';
          document.getElementById('aq-question').focus();
          submitBtn.disabled = false;
          if (nextBtn) nextBtn.disabled = false;
          submitBtn.textContent = 'Add Question';
        } else {
          Modal.close();
          TopicView.render(document.getElementById('view-container'), classId, topicId);
        }
      } catch (err) {
        Toast.error(err.message || 'Failed');
        submitBtn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;
        submitBtn.textContent = 'Add Question';
      }
    }

    document.getElementById('add-q-form').addEventListener('submit', async e => {
      e.preventDefault();
      await collectAndSave(false);
    });
    document.getElementById('aq-next-btn').addEventListener('click', async () => {
      await collectAndSave(true);
    });
    document.getElementById('add-q-form').addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        collectAndSave(true);
      }
    });
  },

  showEditQuestionModal(classId, topicId, cls, topic, q) {
    const isMC = q.type === 'multiple-choice';
    const isTF = q.type === 'true-false';
    const optionsText = isMC && q.options ? q.options.join('\n') : '';

    Modal.open(`
      <form id="edit-q-form">
        <div class="form-group">
          <label class="form-label">Question Type</label>
          <select class="form-select" id="eq-type">
            <option value="multiple-choice" ${isMC ? 'selected' : ''}>Multiple Choice</option>
            <option value="true-false" ${isTF ? 'selected' : ''}>True / False</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Question *</label>
          <textarea class="form-textarea" id="eq-question" required>${q.question.replace(/</g, '&lt;')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Question Media (drag-drop, paste, or browse)</label>
          <div class="media-drop-zone" id="eq-media-zone">
            <div style="font-size:0.85rem;color:var(--text-secondary)">Drop image/gif/video here, paste, or click to browse</div>
            <div class="form-hint">Leave blank to keep existing · Max 8MB</div>
            <input type="file" id="eq-media" accept="image/*,video/*" />
          </div>
          <div class="media-preview${q.mediaUrl ? ' visible' : ''}" id="eq-media-preview">
            <img id="eq-media-preview-img" src="${q.mediaUrl || ''}" alt="preview" />
            <button type="button" class="btn btn-sm btn-ghost" id="eq-media-clear">Remove</button>
          </div>
        </div>
        <div id="eq-mc-fields" style="display:${isMC ? 'block' : 'none'}">
          <div class="form-group">
            <label class="form-label">✅ Correct Answer</label>
            <input class="form-input" id="eq-correct-answer" placeholder="The correct answer text" value="${isMC ? (q.answer || '').replace(/"/g, '&quot;') : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Wrong Options (Distractors)</label>
            <div id="eq-distractors-container"></div>
            <button type="button" class="btn btn-ghost btn-sm" id="eq-add-distractor-btn" style="margin-top:var(--sp-xs)">+ Add Wrong Option</button>
          </div>
        </div>
        <div id="eq-tf-fields" style="display:${isTF ? 'block' : 'none'}">
          <div class="form-group">
            <label class="form-label">Correct Answer</label>
            <select class="form-select" id="eq-tf-answer">
              <option value="true" ${isTF && String(q.answer) === 'true' ? 'selected' : ''}>True</option>
              <option value="false" ${isTF && String(q.answer) === 'false' ? 'selected' : ''}>False</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Explanation (optional)</label>
          <textarea class="form-textarea" id="eq-explanation">${q.explanation ? q.explanation.replace(/</g, '&lt;') : ''}</textarea>
        </div>
        <div style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-lg)">
          <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="eq-submit-btn">Save Changes</button>
        </div>
      </form>`, `Edit Question`);

    TopicView._clearExistingMedia = false;
    TopicView._setupMediaArea('eq', q.mediaUrl || null);

    const typeSelect = document.getElementById('eq-type');
    typeSelect.addEventListener('change', () => {
      document.getElementById('eq-mc-fields').style.display = typeSelect.value === 'multiple-choice' ? 'block' : 'none';
      document.getElementById('eq-tf-fields').style.display = typeSelect.value === 'true-false'    ? 'block' : 'none';
    });

    function addDistractorRow(containerId, val = '', included = true) {
      const container = document.getElementById(containerId);
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:var(--sp-xs);margin-bottom:4px';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.dataset.included = included ? 'true' : 'false';
      toggleBtn.style.cssText = 'flex-shrink:0;width:110px;font-size:0.78rem';
      const setToggleState = (inc) => {
        toggleBtn.dataset.included = inc ? 'true' : 'false';
        toggleBtn.className = inc ? 'btn btn-sm btn-emerald' : 'btn btn-sm btn-ghost';
        toggleBtn.style.opacity = inc ? '1' : '0.5';
        toggleBtn.innerHTML = inc ? '👁️ Included' : '🚫 Excluded';
      };
      setToggleState(included);
      toggleBtn.onclick = () => setToggleState(toggleBtn.dataset.included !== 'true');

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input';
      input.placeholder = 'Wrong option text';
      input.value = val;
      input.style.flex = '1';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-ghost btn-sm';
      delBtn.style.color = 'var(--rose)';
      delBtn.title = 'Remove';
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      delBtn.onclick = () => div.remove();

      div.appendChild(toggleBtn);
      div.appendChild(input);
      div.appendChild(delBtn);
      container.appendChild(div);
    }

    const activeDistractors = isMC && q.options ? q.options.filter(o => String(o).trim() !== String(q.answer).trim()) : ['', '', ''];
    const inactiveDistractors = q.inactiveOptions || [];
    activeDistractors.forEach(d => addDistractorRow('eq-distractors-container', d, true));
    if (!activeDistractors.length) {
      addDistractorRow('eq-distractors-container', '', true);
      addDistractorRow('eq-distractors-container', '', true);
      addDistractorRow('eq-distractors-container', '', true);
    }
    inactiveDistractors.forEach(d => addDistractorRow('eq-distractors-container', d, false));
    document.getElementById('eq-add-distractor-btn').addEventListener('click', () => addDistractorRow('eq-distractors-container', '', true));

    document.getElementById('edit-q-form').addEventListener('submit', async e => {
      e.preventDefault();
      const type = typeSelect.value;
      const question = document.getElementById('eq-question').value.trim();
      const explanation = document.getElementById('eq-explanation').value.trim();
      if (!question) return;

      let qData = { type, question, explanation };
      if (type === 'multiple-choice') {
        const answer = document.getElementById('eq-correct-answer').value.trim();
        if (!answer) { Toast.error('Enter the correct answer'); return; }
        const rows = document.getElementById('eq-distractors-container').children;
        const activeOpts = [];
        const inactiveOpts = [];
        for (const row of rows) {
          const tb = row.querySelector('button[data-included]');
          const t = row.querySelector('input[type="text"]').value.trim();
          if (t) {
            if (tb && tb.dataset.included === 'true') activeOpts.push(t);
            else inactiveOpts.push(t);
          }
        }
        if (activeOpts.length < 1) { Toast.error('Add at least 1 wrong option (included)'); return; }
        qData = { ...qData, options: [answer, ...activeOpts], answer, inactiveOptions: inactiveOpts };
      } else {
        qData = { ...qData, answer: document.getElementById('eq-tf-answer').value };
      }

      const submitBtn = document.getElementById('eq-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      try {
        await TopicView._resolveMedia(qData, TopicView._clearExistingMedia ? null : (q.mediaUrl || null));
        await API.editQuestion(classId, topicId, q.id, qData);
        Modal.close();
        Toast.success('Question updated!');
        TopicView.render(document.getElementById('view-container'), classId, topicId);
      } catch(err) { 
        Toast.error(err.message); 
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
  },

  showFormatGuide() {
    Modal.open(`
      <div style="font-size:0.875rem;line-height:1.7">

        <!-- ── AI Prompt Generator ── -->
        <div style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(20,184,166,0.1));border:1px solid rgba(99,102,241,0.35);border-radius:var(--r-lg);padding:var(--sp-lg);margin-bottom:var(--sp-xl)">
          <div style="display:flex;align-items:center;gap:var(--sp-sm);margin-bottom:var(--sp-md)">
            <span style="font-size:1.3rem">🤖</span>
            <strong style="font-size:1rem;color:var(--indigo-light)">Generate Questions with AI</strong>
          </div>
          <p style="color:var(--text-secondary);margin-bottom:var(--sp-md)">
            Copy the prompt below, paste it into <strong>ChatGPT</strong>, <strong>Claude</strong>, or <strong>Gemini</strong>, then paste your lecture notes, PDF text, or slide content right after it. The AI will return a ready-to-upload JSON file.
          </p>

          <div style="margin-bottom:var(--sp-md)">
            <label class="form-label" style="margin-bottom:var(--sp-xs)">Customize the prompt:</label>
            <div style="display:flex;gap:var(--sp-sm);flex-wrap:wrap;margin-bottom:var(--sp-sm)">
              <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:120px">
                <label style="font-size:0.75rem;color:var(--text-muted)">MC questions</label>
                <input type="number" id="ai-mc-count" class="form-input" value="8" min="1" max="50" style="padding:6px 10px" />
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:120px">
                <label style="font-size:0.75rem;color:var(--text-muted)">T/F questions</label>
                <input type="number" id="ai-tf-count" class="form-input" value="4" min="0" max="50" style="padding:6px 10px" />
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:180px">
                <label style="font-size:0.75rem;color:var(--text-muted)">Topic/subject hint (optional)</label>
                <input type="text" id="ai-topic-hint" class="form-input" placeholder="e.g. Cell Biology, Chapter 3" style="padding:6px 10px" />
              </div>
            </div>
          </div>

          <div style="position:relative">
            <pre id="ai-prompt-preview" style="background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--sp-md);overflow-x:auto;white-space:pre-wrap;word-break:break-word;font-size:0.78rem;color:var(--text-secondary);max-height:180px;overflow-y:auto;margin:0"></pre>
          </div>

          <div style="display:flex;gap:var(--sp-sm);margin-top:var(--sp-md);flex-wrap:wrap">
            <button class="btn btn-primary" id="ai-copy-btn" style="flex:1;justify-content:center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy AI Prompt
            </button>
            <button class="btn btn-ghost" id="ai-open-chatgpt" title="Open ChatGPT in a new tab">
              Open ChatGPT ↗
            </button>
            <button class="btn btn-ghost" id="ai-open-claude" title="Open Claude in a new tab">
              Open Claude ↗
            </button>
          </div>
          <p style="font-size:0.75rem;color:var(--text-muted);margin-top:var(--sp-sm)">
            After copying: open the AI chat, paste the prompt, then paste your content below it and send.
          </p>
        </div>

        <hr class="divider" />

        <!-- ── Format reference ── -->
        <p style="color:var(--text-secondary);margin-bottom:var(--sp-md)">
          Your JSON file must be an <strong>array</strong> of question objects. Both types are supported and can be mixed in one file.
        </p>

        <div style="margin-bottom:var(--sp-lg)">
          <div style="font-weight:700;margin-bottom:var(--sp-sm);display:flex;align-items:center;gap:8px">
            <span class="question-type-badge badge-mc">MC</span> Multiple Choice
          </div>
          <pre style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--sp-md);overflow-x:auto;font-size:0.8rem;color:var(--teal-light)">{
  "type": "multiple-choice",
  "question": "What is the atomic number of Carbon?",
  "options": ["4", "6", "8", "12"],
  "answer": "6",
  "explanation": "Carbon has 6 protons."
}</pre>
        </div>

        <div style="margin-bottom:var(--sp-lg)">
          <div style="font-weight:700;margin-bottom:var(--sp-sm);display:flex;align-items:center;gap:8px">
            <span class="question-type-badge badge-tf">T/F</span> True / False
          </div>
          <pre style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--sp-md);overflow-x:auto;font-size:0.8rem;color:var(--teal-light)">{
  "type": "true-false",
  "question": "The mitochondria is the powerhouse of the cell.",
  "answer": "true",
  "explanation": "Mitochondria produce ATP via cellular respiration."
}</pre>
        </div>

        <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:var(--r-md);padding:var(--sp-md)">
          <strong style="color:var(--indigo-light)">💡 Tips</strong>
          <ul style="color:var(--text-secondary);margin-top:var(--sp-xs);padding-left:var(--sp-lg)">
            <li>IDs are auto-generated if omitted</li>
            <li>Uploading to the same topic <em>adds</em> to existing questions</li>
            <li>Answer options are automatically shuffled during practice</li>
            <li>You can mix MC and T/F questions in one file</li>
          </ul>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:var(--sp-lg)">
        <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
      </div>`, '📋 Question Format Guide');

    // ── Build and update the AI prompt preview ──────────────────────────────
    function buildPrompt() {
      const mc    = parseInt(document.getElementById('ai-mc-count')?.value) || 8;
      const tf    = parseInt(document.getElementById('ai-tf-count')?.value) || 4;
      const hint  = document.getElementById('ai-topic-hint')?.value.trim();
      const topic = hint ? ` about "${hint}"` : '';
      return `You are a study question generator. I will paste content from my lecture notes, slides, or textbook below. Generate ${mc} multiple-choice questions and ${tf} true/false questions${topic} based strictly on that content.

Return ONLY a valid JSON array — no markdown, no explanation, no code fences. Each object must follow this exact schema:

Multiple choice:
{
  "type": "multiple-choice",
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "answer": "exact text of the correct option",
  "explanation": "brief explanation of why this is correct"
}

True/False:
{
  "type": "true-false",
  "question": "...",
  "answer": "true" or "false",
  "explanation": "brief explanation"
}

Rules:
- "answer" for MC must exactly match one of the "options" strings
- "answer" for T/F must be the string "true" or "false" (lowercase)
- Include 4 options per MC question
- Make questions test understanding, not just memorization
- Vary difficulty: mix easy, medium, and hard questions
- Do not include the question number in the question text

Here is my content:
[PASTE YOUR NOTES / PDF TEXT / SLIDE CONTENT HERE]`;
    }

    function refreshPreview() {
      const pre = document.getElementById('ai-prompt-preview');
      if (pre) pre.textContent = buildPrompt();
    }

    refreshPreview();

    ['ai-mc-count','ai-tf-count','ai-topic-hint'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', refreshPreview);
    });

    // Copy button
    document.getElementById('ai-copy-btn')?.addEventListener('click', () => {
      const prompt = buildPrompt();
      navigator.clipboard.writeText(prompt).then(() => {
        const btn = document.getElementById('ai-copy-btn');
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '✓ Copied!';
          btn.style.background = 'var(--grad-teal)';
          setTimeout(() => { if (btn) { btn.innerHTML = orig; btn.style.background = ''; } }, 2000);
        }
        Toast.success('AI prompt copied to clipboard!');
      }).catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = prompt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        Toast.success('Prompt copied!');
      });
    });

    document.getElementById('ai-open-chatgpt')?.addEventListener('click', () => {
      window.open('https://chat.openai.com', '_blank');
    });
    document.getElementById('ai-open-claude')?.addEventListener('click', () => {
      window.open('https://claude.ai', '_blank');
    });
  }
};
