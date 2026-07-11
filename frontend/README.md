# Priority:One

## Run locally

From `frontend/`, run:

```bash
npm run dev
```

This starts both required services:

- Vite frontend: `http://127.0.0.1:5173`
- Flask API for Gemini and Google Calendar: `http://127.0.0.1:5001`

The backend reads private credentials from `backend/.env`. Never commit that file. On the first connection, approve Google Classroom and Google Calendar access in the popup. The resulting refresh token is stored locally in `backend/.google_token.json`, which is also ignored by Git.

Use `npm run dev:frontend` only when the Flask API is already running separately.
