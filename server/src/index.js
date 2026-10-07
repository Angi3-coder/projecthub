import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { progress } from './progress.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const STATUSES = ['todo', 'doing', 'done'];
const db = new Database(process.env.DB_FILE || 'projecthub.db');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'todo', due TEXT);
`);

const app = express();
app.use(cors());
app.use(express.json());

const sign = (id) => jwt.sign({ id }, SECRET, { expiresIn: '7d' });
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

function auth(req, res, next) {
  try { req.userId = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET).id; next(); }
  catch { bad(res, 'Sign in to continue.', 401); }
}

function creds(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8) {
    bad(res, 'Enter a valid email and a password of at least 8 characters.'); return null;
  }
  return { email: email.toLowerCase(), password };
}

app.post('/api/auth/register', (req, res) => {
  const c = creds(req, res); if (!c) return;
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(c.email)) return bad(res, 'That email is already registered.', 409);
  const { lastInsertRowid } = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(c.email, bcrypt.hashSync(c.password, 10));
  res.status(201).json({ token: sign(lastInsertRowid) });
});

app.post('/api/auth/login', (req, res) => {
  const c = creds(req, res); if (!c) return;
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(c.email);
  if (!u || !bcrypt.compareSync(c.password, u.password_hash)) return bad(res, 'Email or password is incorrect.', 401);
  res.json({ token: sign(u.id) });
});

app.get('/api/projects', auth, (req, res) => {
  const rows = db.prepare('SELECT id, name, description FROM projects WHERE user_id = ? ORDER BY id DESC').all(req.userId);
  const q = db.prepare('SELECT status FROM tasks WHERE project_id = ?');
  res.json(rows.map((p) => { const t = q.all(p.id); return { ...p, taskCount: t.length, progress: progress(t) }; }));
});

app.post('/api/projects', auth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim().slice(0, 300);
  if (!name || name.length > 80) return bad(res, 'Project name must be 1-80 characters.');
  const { lastInsertRowid } = db.prepare('INSERT INTO projects (user_id, name, description) VALUES (?, ?, ?)').run(req.userId, name, description);
  res.status(201).json({ id: lastInsertRowid, name, description, taskCount: 0, progress: 0 });
});

const ownsProject = (id, uid) => db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(id, uid);
const ownedTask = (id, uid) => db.prepare('SELECT t.* FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = ? AND p.user_id = ?').get(id, uid);

app.delete('/api/projects/:id', auth, (req, res) => {
  if (!ownsProject(req.params.id, req.userId)) return bad(res, 'Project not found.', 404);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.get('/api/projects/:id/tasks', auth, (req, res) => {
  if (!ownsProject(req.params.id, req.userId)) return bad(res, 'Project not found.', 404);
  res.json(db.prepare('SELECT id, title, status, due FROM tasks WHERE project_id = ? ORDER BY id').all(req.params.id));
});

app.post('/api/projects/:id/tasks', auth, (req, res) => {
  if (!ownsProject(req.params.id, req.userId)) return bad(res, 'Project not found.', 404);
  const title = String(req.body?.title || '').trim();
  const due = req.body?.due || null;
  if (!title || title.length > 120) return bad(res, 'Task title must be 1-120 characters.');
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return bad(res, 'Due date must be YYYY-MM-DD.');
  const { lastInsertRowid } = db.prepare('INSERT INTO tasks (project_id, title, due) VALUES (?, ?, ?)').run(req.params.id, title, due);
  res.status(201).json({ id: lastInsertRowid, title, status: 'todo', due });
});

app.patch('/api/tasks/:id', auth, (req, res) => {
  const t = ownedTask(req.params.id, req.userId);
  if (!t) return bad(res, 'Task not found.', 404);
  const status = req.body?.status ?? t.status;
  const title = req.body?.title !== undefined ? String(req.body.title).trim() : t.title;
  if (!STATUSES.includes(status)) return bad(res, 'Status must be todo, doing, or done.');
  if (!title || title.length > 120) return bad(res, 'Task title must be 1-120 characters.');
  db.prepare('UPDATE tasks SET status = ?, title = ? WHERE id = ?').run(status, title, t.id);
  res.json({ ...t, status, title });
});

app.delete('/api/tasks/:id', auth, (req, res) => {
  if (!ownedTask(req.params.id, req.userId)) return bad(res, 'Task not found.', 404);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.listen(process.env.PORT || 4000, () => console.log('API on :4000'));
