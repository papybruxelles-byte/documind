# Signataire Intelligence AI backend

This is the private server to deploy on Render. It receives a Firebase ID token from the signed-in user, verifies it with Firebase Admin, then calls OpenAI. The OpenAI key remains only in Render's environment variables.

## Deploy on Render

1. Create a **Web Service** from this repository.
2. Set the **Root Directory** to `backend`.
3. Use build command `npm install` and start command `npm start`.
4. Add `OPENAI_API_KEY`, `OPENAI_MODEL`, `FIREBASE_SERVICE_ACCOUNT`, `ALLOWED_ORIGINS`, and optionally `AI_ANALYSIS_MAX_CHARS` in Render's Environment section. For `FIREBASE_SERVICE_ACCOUNT`, paste the full, one-line JSON contents of the Firebase service-account key file. The default primary model is `gpt-5.6-luna`. Analysis sends at most 60,000 characters to OpenAI by default; configure `AI_ANALYSIS_MAX_CHARS` between 10,000 and 120,000 to tune cost versus coverage.
5. Set `ALLOWED_ORIGINS` to `https://signataire.com,https://www.signataire.com` (and optionally `http://localhost:5173` for local testing).
6. Confirm `https://your-render-service.onrender.com/health` returns `{ "status": "ok" }`.

## Endpoints

Both endpoints require `Authorization: Bearer <Firebase ID token>`.

- `POST /api/ai/analyze` with `{ "documentText": "..." }`
- `POST /api/ai/chat` with `{ "documentText": "...", "question": "...", "conversation": [] }`

The React app can obtain the token with `await auth.currentUser.getIdToken()` and send it to this server. Do not expose `OPENAI_API_KEY` in the frontend.
