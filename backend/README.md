# Documind AI backend

This is the private server to deploy on Render. It receives a Firebase ID token from the signed-in user, verifies it with Firebase Admin, then calls OpenAI. The OpenAI key remains only in Render's environment variables.

## Deploy on Render

1. Create a **Web Service** from this repository.
2. Set the **Root Directory** to `backend`.
3. Use build command `npm install` and start command `npm start`.
4. Add `OPENAI_API_KEY`, `OPENAI_MODEL`, `FIREBASE_SERVICE_ACCOUNT`, and `ALLOWED_ORIGINS` in Render's Environment section. For `FIREBASE_SERVICE_ACCOUNT`, paste the full, one-line JSON contents of the Firebase service-account key file. The default primary model is `gpt-5.6-sol`.
5. Set `ALLOWED_ORIGINS` to `https://signataire.com,https://www.signataire.com` (and optionally `http://localhost:5173` for local testing).
6. Confirm `https://your-render-service.onrender.com/health` returns `{ "status": "ok" }`.

## Endpoints

Both endpoints require `Authorization: Bearer <Firebase ID token>`.

- `POST /api/ai/analyze` with `{ "documentText": "..." }`
- `POST /api/ai/chat` with `{ "documentText": "...", "question": "...", "conversation": [] }`

The React app can obtain the token with `await auth.currentUser.getIdToken()` and send it to this server. Do not expose `OPENAI_API_KEY` in the frontend.
