/* ─── API Client ──────────────────────────────────────────────────────────── */
const API = {
  _fetch(url, opts = {}) {
    return fetch(url, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(err.error || 'Request failed');
      }
      return r.json();
    });
  },

  /* ── Classes ── */
  getClasses:   ()           => API._fetch('/api/classes'),
  createClass:  (data)       => API._fetch('/api/classes', { method: 'POST', body: JSON.stringify(data) }),
  getClass:     (id)         => API._fetch(`/api/classes/${id}`),
  updateClass:  (id, data)   => API._fetch(`/api/classes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteClass:  (id)         => API._fetch(`/api/classes/${id}`, { method: 'DELETE' }),

  /* ── Topics ── */
  createTopic:  (cId, data)  => API._fetch(`/api/classes/${cId}/topics`, { method: 'POST', body: JSON.stringify(data) }),
  updateTopic:  (cId, tId, data) => API._fetch(`/api/classes/${cId}/topics/${tId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTopic:  (cId, tId)   => API._fetch(`/api/classes/${cId}/topics/${tId}`, { method: 'DELETE' }),

  /* ── Questions ── */
  getQuestions: (cId, tId)   => API._fetch(`/api/classes/${cId}/topics/${tId}/questions`),
  addQuestion:  (cId, tId, data) => API._fetch(`/api/classes/${cId}/topics/${tId}/questions`, { method: 'POST', body: JSON.stringify(data) }),
  editQuestion: (cId, tId, qId, data) => API._fetch(`/api/classes/${cId}/topics/${tId}/questions/${qId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuestion:(cId, tId, qId) => API._fetch(`/api/classes/${cId}/topics/${tId}/questions/${qId}`, { method: 'DELETE' }),
  duplicateQuestion:(cId, tId, qId) => API._fetch(`/api/classes/${cId}/topics/${tId}/questions/${qId}/duplicate`, { method: 'POST' }),
  reorderQuestions:(cId, tId, ids) => API._fetch(`/api/classes/${cId}/topics/${tId}/questions/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) }),

  uploadQuestions(cId, tId, file) {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`/api/classes/${cId}/topics/${tId}/questions/upload`, { method: 'POST', body: fd })
      .then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
        return r.json();
      });
  },

  uploadMedia(file) {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`/api/upload-media`, { method: 'POST', body: fd })
      .then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
        return r.json();
      });
  },

  /* ── Progress ── */
  getProgress:   (cId, tId)           => API._fetch(`/api/classes/${cId}/topics/${tId}/progress`),
  recordProgress:(cId, tId, qId, ok)  => API._fetch(`/api/classes/${cId}/topics/${tId}/progress`, { method: 'POST', body: JSON.stringify({ questionId: qId, correct: ok }) }),
  resetProgress: (cId, tId)           => API._fetch(`/api/classes/${cId}/topics/${tId}/progress`, { method: 'DELETE' }),

  /* ── Sessions ── */
  getSessions:       (cId)        => API._fetch(`/api/classes/${cId}/sessions`),
  saveSession:       (cId, data)  => API._fetch(`/api/classes/${cId}/sessions`, { method: 'POST', body: JSON.stringify(data) }),
  getSession:        (cId, sId)   => API._fetch(`/api/classes/${cId}/sessions/${sId}`),
  getSessionQuestions:(cId, cfg)  => API._fetch(`/api/classes/${cId}/session-questions`, { method: 'POST', body: JSON.stringify(cfg) }),
};
