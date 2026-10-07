# ProjectHub

Full-stack project manager: accounts, projects, and a task board (To do / Doing / Done) with progress tracking.

**Stack:** React 18 + Vite · Express · SQLite (better-sqlite3) · JWT + bcrypt · node:test

## Run
```bash
cd server && npm install && npm run dev     # API on :4000
cd client && npm install && npm run dev     # UI on :5173
cd server && npm test
```

## API (all except auth require `Authorization: Bearer <token>`)
| Method | Route | Purpose |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | `{email,password}` -> `{token}` |
| GET/POST | /api/projects | list (with progress %) / create `{name, description}` |
| DELETE | /api/projects/:id | delete project and its tasks |
| GET/POST | /api/projects/:id/tasks | list / create `{title, due?}` |
| PATCH | /api/tasks/:id | update `{status?, title?}` (status: todo, doing, done) |
| DELETE | /api/tasks/:id | delete task |

## Notes
- Ownership is enforced in SQL (`JOIN projects ... WHERE user_id = ?`), so users cannot touch each other's data.
- Progress is a pure, unit-tested function (`server/src/progress.js`).
- Ideas to extend: drag-and-drop, comments, teams/roles, Postgres, Docker, CI, deployment.
