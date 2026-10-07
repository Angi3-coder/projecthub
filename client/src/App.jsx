import { useEffect, useState } from 'react';
import { api } from './api.js';

const COLUMNS = [['todo', 'To do'], ['doing', 'Doing'], ['done', 'Done']];

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try { const { token } = await api(`/auth/${mode}`, { method: 'POST', body: f }); localStorage.setItem('token', token); onAuth(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <form className="auth" onSubmit={submit}>
      <h1>ProjectHub</h1>
      <p>Plan your projects and move tasks from to do to done.</p>
      <input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      <input type="password" placeholder="Password (8+ characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
      {err && <div className="error" role="alert">{err}</div>}
      <button className="primary">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
      <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
      </button>
    </form>
  );
}

function Board({ project, onChange }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [err, setErr] = useState('');
  const load = () => api(`/projects/${project.id}/tasks`).then(setTasks).catch((e) => setErr(e.message));
  useEffect(() => { setTasks([]); load(); }, [project.id]);
  const act = (fn) => fn().then(() => { setErr(''); load(); onChange(); }).catch((e) => setErr(e.message));
  const add = (e) => { e.preventDefault(); act(() => api(`/projects/${project.id}/tasks`, { method: 'POST', body: { title, due: due || undefined } })).then(() => { setTitle(''); setDue(''); }); };
  const move = (t, dir) => { const i = COLUMNS.findIndex(([k]) => k === t.status) + dir; act(() => api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: COLUMNS[i][0] } })); };

  return (
    <section className="board">
      <header>
        <div><h2>{project.name}</h2><p className="muted">{project.description || 'No description'}</p></div>
        <button className="link" onClick={() => confirm(`Delete "${project.name}" and its tasks?`) && act(() => api(`/projects/${project.id}`, { method: 'DELETE' }))}>Delete project</button>
      </header>
      <form className="row" onSubmit={add}>
        <input placeholder="Add a task" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        <input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="primary">Add task</button>
      </form>
      {err && <div className="error" role="alert">{err}</div>}
      <div className="cols">
        {COLUMNS.map(([key, label], ci) => (
          <div className="col" key={key}>
            <h3>{label} <span className="muted">{tasks.filter((t) => t.status === key).length}</span></h3>
            {tasks.filter((t) => t.status === key).map((t) => (
              <article className="task" key={t.id}>
                <div>{t.title}</div>
                {t.due && <small className={t.status !== 'done' && t.due < new Date().toISOString().slice(0, 10) ? 'error' : 'muted'}>Due {t.due}</small>}
                <div className="actions">
                  {ci > 0 && <button className="link" onClick={() => move(t, -1)}>Move to {COLUMNS[ci - 1][1]}</button>}
                  {ci < 2 && <button className="link" onClick={() => move(t, 1)}>Move to {COLUMNS[ci + 1][1]}</button>}
                  <button className="link" onClick={() => act(() => api(`/tasks/${t.id}`, { method: 'DELETE' }))}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Workspace({ onSignOut }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [f, setF] = useState({ name: '', description: '' });
  const [err, setErr] = useState('');
  const load = () => api('/projects').then((p) => { setProjects(p); setSelected((s) => (p.some((x) => x.id === s) ? s : p[0]?.id ?? null)); })
    .catch((e) => (e.message.startsWith('Sign in') ? onSignOut() : setErr(e.message)));
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try { const p = await api('/projects', { method: 'POST', body: f }); setF({ name: '', description: '' }); await load(); setSelected(p.id); setErr(''); }
    catch (x) { setErr(x.message); }
  };
  const current = projects.find((p) => p.id === selected);
  return (
    <div className="shell">
      <aside>
        <h1>ProjectHub</h1>
        <ul>
          {projects.map((p) => (
            <li key={p.id}>
              <button className={p.id === selected ? 'proj active' : 'proj'} onClick={() => setSelected(p.id)}>
                <span>{p.name}</span>
                <span className="bar" role="progressbar" aria-valuenow={p.progress} aria-label={`${p.name} progress`}><i style={{ width: p.progress + '%' }} /></span>
                <small className="muted">{p.progress}% of {p.taskCount} tasks</small>
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={create} className="newproj">
          <input placeholder="Project name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} required />
          <input placeholder="Description (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} />
          <button className="primary">Create project</button>
        </form>
        {err && <div className="error" role="alert">{err}</div>}
        <button className="link" onClick={onSignOut}>Sign out</button>
      </aside>
      <main>{current ? <Board project={current} onChange={load} /> : <p className="muted empty">No projects yet. Create one on the left to start planning.</p>}</main>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));
  const out = () => { localStorage.removeItem('token'); setAuthed(false); };
  return authed ? <Workspace onSignOut={out} /> : <Auth onAuth={() => setAuthed(true)} />;
}
