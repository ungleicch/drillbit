const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DRILLBIT_DATA_DIR || path.join(__dirname, 'data');

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer for JSON file uploads (in-memory)
const upload = multer({ storage: multer.memoryStorage() });

// Multer for media uploads (disk storage) — images/gifs/video, 8MB, safe names
const ALLOWED_MEDIA_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime'
]);
const MEDIA_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/svg+xml': '.svg',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'
};
const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'public', 'uploads');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = MEDIA_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  }
});
const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (ALLOWED_MEDIA_MIMES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only images (jpeg/png/gif/webp/svg) and video (mp4/webm/mov) are allowed'));
  }
});

// ─── Data helpers ──────────────────────────────────────────────────────────────
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function readJSON(filePath, defaultVal = null) {
  if (!fs.existsSync(filePath)) return defaultVal;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return defaultVal; }
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function classDir(classId) { return path.join(DATA_DIR, 'classes', classId); }
function topicDir(classId, topicId) { return path.join(classDir(classId), 'topics', topicId); }
function sessionsDir(classId) { return path.join(classDir(classId), 'sessions'); }

// Ensure base data structure exists
ensureDir(DATA_DIR);
const CLASSES_FILE = path.join(DATA_DIR, 'classes.json');
if (!readJSON(CLASSES_FILE)) {
  writeJSON(CLASSES_FILE, []);
  seedSampleDeck();
}

// First run only: create a sample class from examples/ so the app isn't empty.
function seedSampleDeck() {
  const file = path.join(__dirname, 'examples', 'cs_fundamentals.json');
  const questions = readJSON(file);
  if (!Array.isArray(questions) || process.env.DRILLBIT_NO_SEED) return;
  const now = new Date().toISOString();
  const cId = uuidv4(), tId = uuidv4();
  writeJSON(CLASSES_FILE, [{ id: cId, name: 'CS Fundamentals' }]);
  writeJSON(path.join(classDir(cId), 'meta.json'), { id: cId, name: 'CS Fundamentals', description: 'Sample deck: data structures, complexity, and code reading', color: '#7c83ff', createdAt: now });
  writeJSON(path.join(classDir(cId), 'topics.json'), [{ id: tId, name: 'Basics' }]);
  writeJSON(path.join(topicDir(cId, tId), 'meta.json'), { id: tId, name: 'Basics', description: '', createdAt: now });
  writeJSON(path.join(topicDir(cId, tId), 'questions.json'), questions.map(q => ({ ...q, id: q.id || uuidv4() })));
  writeJSON(path.join(topicDir(cId, tId), 'progress.json'), {});
}

// ─── Helper: compute learn score for a topic ──────────────────────────────────
function computeLearnScore(progress) {
  // progress is { [questionId]: { history: [{correct, timestamp}] } }
  if (!progress || Object.keys(progress).length === 0) return 0;
  let total = 0;
  const qIds = Object.keys(progress);
  for (const qId of qIds) {
    const history = (progress[qId] && progress[qId].history) ? progress[qId].history : [];
    if (history.length === 0) { total += 0; continue; }
    const last5 = history.slice(-5);
    let score = last5.reduce((acc, h) => acc + (h.correct ? 20 : 0), 0);
    // Streak bonus
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].correct) streak++;
      else break;
    }
    if (streak >= 3) score = Math.min(100, score + 10);
    total += score;
  }
  return Math.round(total / qIds.length);
}

// ─── Classes ──────────────────────────────────────────────────────────────────
app.get('/api/classes', (req, res) => {
  const classes = readJSON(CLASSES_FILE, []);
  // Attach topic count and learn score to each
  const enriched = classes.map(cls => {
    const metaPath = path.join(classDir(cls.id), 'meta.json');
    const meta = readJSON(metaPath, cls);
    const topicsPath = path.join(classDir(cls.id), 'topics.json');
    const topics = readJSON(topicsPath, []);
    // Compute overall class learn score
    let totalScore = 0;
    let scoredTopics = 0;
    for (const t of topics) {
      const progPath = path.join(topicDir(cls.id, t.id), 'progress.json');
      const prog = readJSON(progPath, {});
      const qPath = path.join(topicDir(cls.id, t.id), 'questions.json');
      const qs = readJSON(qPath, []);
      if (qs.length > 0) {
        totalScore += computeLearnScore(prog);
        scoredTopics++;
      }
    }
    return {
      ...meta,
      topicCount: topics.length,
      learnScore: scoredTopics > 0 ? Math.round(totalScore / scoredTopics) : 0
    };
  });
  res.json(enriched);
});

app.post('/api/classes', (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  const cls = { id, name, description: description || '', color: color || '#6366f1', createdAt: new Date().toISOString() };
  // Save to classes list
  const classes = readJSON(CLASSES_FILE, []);
  classes.push({ id, name });
  writeJSON(CLASSES_FILE, classes);
  // Save meta
  writeJSON(path.join(classDir(id), 'meta.json'), cls);
  writeJSON(path.join(classDir(id), 'topics.json'), []);
  res.json(cls);
});

app.get('/api/classes/:id', (req, res) => {
  const { id } = req.params;
  const meta = readJSON(path.join(classDir(id), 'meta.json'));
  if (!meta) return res.status(404).json({ error: 'Class not found' });
  const topics = readJSON(path.join(classDir(id), 'topics.json'), []);
  // Enrich topics with question count and learn score
  const enrichedTopics = topics.map(t => {
    const tMeta = readJSON(path.join(topicDir(id, t.id), 'meta.json'), t);
    const qs = readJSON(path.join(topicDir(id, t.id), 'questions.json'), []);
    const prog = readJSON(path.join(topicDir(id, t.id), 'progress.json'), {});
    return { ...tMeta, questionCount: qs.length, learnScore: computeLearnScore(prog) };
  });
  const sessions = readJSON(path.join(sessionsDir(id), 'index.json'), []);
  res.json({ ...meta, topics: enrichedTopics, sessionCount: sessions.length });
});

app.delete('/api/classes/:id', (req, res) => {
  const { id } = req.params;
  let classes = readJSON(CLASSES_FILE, []);
  classes = classes.filter(c => c.id !== id);
  writeJSON(CLASSES_FILE, classes);
  // Remove directory
  const dir = classDir(id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  res.json({ ok: true });
});

app.patch('/api/classes/:id', (req, res) => {
  const { id } = req.params;
  const metaPath = path.join(classDir(id), 'meta.json');
  const meta = readJSON(metaPath);
  if (!meta) return res.status(404).json({ error: 'Class not found' });
  const { name, description, color } = req.body;
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) return res.status(400).json({ error: 'Name required' });
    meta.name = trimmed;
  }
  if (description !== undefined) meta.description = String(description);
  if (color !== undefined) meta.color = String(color);
  writeJSON(metaPath, meta);
  // Keep classes.json name in sync
  const classes = readJSON(CLASSES_FILE, []);
  const entry = classes.find(c => c.id === id);
  if (entry && name !== undefined) {
    entry.name = meta.name;
    writeJSON(CLASSES_FILE, classes);
  }
  res.json(meta);
});

// ─── Topics ───────────────────────────────────────────────────────────────────
app.post('/api/classes/:id/topics', (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const tId = uuidv4();
  const topic = { id: tId, name, description: description || '', createdAt: new Date().toISOString() };
  const topics = readJSON(path.join(classDir(id), 'topics.json'), []);
  topics.push({ id: tId, name });
  writeJSON(path.join(classDir(id), 'topics.json'), topics);
  writeJSON(path.join(topicDir(id, tId), 'meta.json'), topic);
  writeJSON(path.join(topicDir(id, tId), 'questions.json'), []);
  writeJSON(path.join(topicDir(id, tId), 'progress.json'), {});
  res.json(topic);
});

app.delete('/api/classes/:classId/topics/:topicId', (req, res) => {
  const { classId, topicId } = req.params;
  let topics = readJSON(path.join(classDir(classId), 'topics.json'), []);
  topics = topics.filter(t => t.id !== topicId);
  writeJSON(path.join(classDir(classId), 'topics.json'), topics);
  const dir = topicDir(classId, topicId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  res.json({ ok: true });
});

app.patch('/api/classes/:classId/topics/:topicId', (req, res) => {
  const { classId, topicId } = req.params;
  const metaPath = path.join(topicDir(classId, topicId), 'meta.json');
  const meta = readJSON(metaPath);
  if (!meta) return res.status(404).json({ error: 'Topic not found' });
  const { name, description } = req.body;
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) return res.status(400).json({ error: 'Name required' });
    meta.name = trimmed;
  }
  if (description !== undefined) meta.description = String(description);
  writeJSON(metaPath, meta);
  const topicsPath = path.join(classDir(classId), 'topics.json');
  const topics = readJSON(topicsPath, []);
  const entry = topics.find(t => t.id === topicId);
  if (entry && name !== undefined) {
    entry.name = meta.name;
    writeJSON(topicsPath, topics);
  }
  res.json(meta);
});

// ─── Questions ────────────────────────────────────────────────────────────────
app.get('/api/classes/:classId/topics/:topicId/questions', (req, res) => {
  const { classId, topicId } = req.params;
  const qs = readJSON(path.join(topicDir(classId, topicId), 'questions.json'), []);
  const prog = readJSON(path.join(topicDir(classId, topicId), 'progress.json'), {});
  const enriched = qs.map(q => ({
    ...q,
    progress: prog[q.id] || { history: [] }
  }));
  res.json(enriched);
});

// Upload questions via JSON file
app.post('/api/classes/:classId/topics/:topicId/questions/upload', upload.single('file'), (req, res) => {
  const { classId, topicId } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  let incoming;
  try { incoming = JSON.parse(req.file.buffer.toString('utf-8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON file' }); }
  if (!Array.isArray(incoming)) return res.status(400).json({ error: 'JSON must be an array of questions' });
  const qPath = path.join(topicDir(classId, topicId), 'questions.json');
  const existing = readJSON(qPath, []);
  // Assign IDs if missing
  const newQs = incoming.map(q => ({ ...q, id: q.id || uuidv4() }));
  const merged = [...existing, ...newQs];
  writeJSON(qPath, merged);
  res.json({ added: newQs.length, total: merged.length });
});

// Add a single question manually
app.post('/api/classes/:classId/topics/:topicId/questions', (req, res) => {
  const { classId, topicId } = req.params;
  const q = { ...req.body, id: req.body.id || uuidv4() };
  const qPath = path.join(topicDir(classId, topicId), 'questions.json');
  const qs = readJSON(qPath, []);
  qs.push(q);
  writeJSON(qPath, qs);
  res.json(q);
});

// Delete a question
app.delete('/api/classes/:classId/topics/:topicId/questions/:qId', (req, res) => {
  const { classId, topicId, qId } = req.params;
  const qPath = path.join(topicDir(classId, topicId), 'questions.json');
  let qs = readJSON(qPath, []);
  qs = qs.filter(q => q.id !== qId);
  writeJSON(qPath, qs);
  res.json({ ok: true });
});

// Edit a question
app.put('/api/classes/:classId/topics/:topicId/questions/:qId', (req, res) => {
  const { classId, topicId, qId } = req.params;
  const qPath = path.join(topicDir(classId, topicId), 'questions.json');
  let qs = readJSON(qPath, []);
  const index = qs.findIndex(q => q.id === qId);
  if (index === -1) return res.status(404).json({ error: 'Question not found' });
  
  const merged = { ...qs[index], ...req.body, id: qId };
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'mediaUrl') && req.body.mediaUrl === null) {
    delete merged.mediaUrl;
  }
  qs[index] = merged;
  writeJSON(qPath, qs);
  res.json(qs[index]);
});

// Duplicate a question
app.post('/api/classes/:classId/topics/:topicId/questions/:qId/duplicate', (req, res) => {
  const { classId, topicId, qId } = req.params;
  const qPath = path.join(topicDir(classId, topicId), 'questions.json');
  const qs = readJSON(qPath, []);
  const idx = qs.findIndex(q => q.id === qId);
  if (idx === -1) return res.status(404).json({ error: 'Question not found' });
  const copy = { ...qs[idx], id: uuidv4() };
  qs.splice(idx + 1, 0, copy);
  writeJSON(qPath, qs);
  res.json(copy);
});

// Reorder questions
app.put('/api/classes/:classId/topics/:topicId/questions/reorder', (req, res) => {
  const { classId, topicId } = req.params;
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  const qPath = path.join(topicDir(classId, topicId), 'questions.json');
  const qs = readJSON(qPath, []);
  const byId = new Map(qs.map(q => [q.id, q]));
  const ordered = [];
  for (const id of ids) {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
      byId.delete(id);
    }
  }
  // Append any questions not listed in ids
  for (const q of byId.values()) ordered.push(q);
  writeJSON(qPath, ordered);
  res.json({ ok: true, total: ordered.length });
});

// ─── Media Upload ─────────────────────────────────────────────────────────────
app.post('/api/upload-media', (req, res) => {
  uploadMedia.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 8MB)' : (err.message || 'Upload failed');
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });
});

// ─── Progress ─────────────────────────────────────────────────────────────────
app.get('/api/classes/:classId/topics/:topicId/progress', (req, res) => {
  const { classId, topicId } = req.params;
  const prog = readJSON(path.join(topicDir(classId, topicId), 'progress.json'), {});
  res.json(prog);
});

app.post('/api/classes/:classId/topics/:topicId/progress', (req, res) => {
  const { classId, topicId } = req.params;
  const { questionId, correct } = req.body;
  const progPath = path.join(topicDir(classId, topicId), 'progress.json');
  const prog = readJSON(progPath, {});
  if (!prog[questionId]) prog[questionId] = { history: [] };
  prog[questionId].history.push({ correct, timestamp: new Date().toISOString() });
  writeJSON(progPath, prog);
  const learnScore = computeLearnScore(prog);
  res.json({ ok: true, learnScore });
});

// Reset progress for a topic
app.delete('/api/classes/:classId/topics/:topicId/progress', (req, res) => {
  const { classId, topicId } = req.params;
  writeJSON(path.join(topicDir(classId, topicId), 'progress.json'), {});
  res.json({ ok: true });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────
app.get('/api/classes/:classId/sessions', (req, res) => {
  const { classId } = req.params;
  const sessions = readJSON(path.join(sessionsDir(classId), 'index.json'), []);
  res.json(sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)));
});

app.post('/api/classes/:classId/sessions', (req, res) => {
  const { classId } = req.params;
  const sessionData = req.body;
  const sessionId = uuidv4();
  const session = { ...sessionData, id: sessionId, savedAt: new Date().toISOString() };
  // Save full session
  writeJSON(path.join(sessionsDir(classId), `${sessionId}.json`), session);
  // Update index
  const idx = readJSON(path.join(sessionsDir(classId), 'index.json'), []);
  idx.push({
    id: sessionId,
    startedAt: session.startedAt,
    savedAt: session.savedAt,
    score: session.score,
    totalQuestions: session.totalQuestions,
    correct: session.correct,
    mode: session.mode,
    topicIds: session.topicIds,
    topicNames: session.topicNames,
    className: session.className,
    duration: session.duration
  });
  writeJSON(path.join(sessionsDir(classId), 'index.json'), idx);
  res.json(session);
});

app.get('/api/classes/:classId/sessions/:sessionId', (req, res) => {
  const { classId, sessionId } = req.params;
  const session = readJSON(path.join(sessionsDir(classId), `${sessionId}.json`));
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// ─── Session builder: get questions for a session config ──────────────────────
app.post('/api/classes/:classId/session-questions', (req, res) => {
  const { classId } = req.params;
  const { topicIds, mode, limit, focusWeak } = req.body;
  // Gather questions from specified topics
  let allQuestions = [];
  for (const tId of topicIds) {
    const qs = readJSON(path.join(topicDir(classId, tId), 'questions.json'), []);
    const prog = readJSON(path.join(topicDir(classId, tId), 'progress.json'), {});
    qs.forEach(q => {
      const history = prog[q.id] ? prog[q.id].history : [];
      const last5 = history.slice(-5);
      const mastery = last5.length === 0 ? 0 : last5.reduce((a, h) => a + (h.correct ? 20 : 0), 0);
      allQuestions.push({ ...q, topicId: tId, mastery });
    });
  }
  // Focus weak: sort by mastery ascending
  if (focusWeak) {
    allQuestions.sort((a, b) => a.mastery - b.mastery);
  } else {
    // Shuffle
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
  }
  if (limit && limit > 0) allQuestions = allQuestions.slice(0, limit);
  res.json(allQuestions);
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nDrillbit is running`);
  console.log(`   Open: http://localhost:${PORT}\n`);
});
