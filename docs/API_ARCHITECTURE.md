# Signataire Intelligence API architecture

This document describes how the React application calls and uses the private AI API. It covers document upload and analysis, document chat, authentication, storage, CORS, error handling, and the local fallback.

## System overview

```text
User
  |
  v
React/Vite frontend (signataire.com)
  |-- uploads the original file ----------> Firebase Storage
  |-- stores document state/results ------> Cloud Firestore
  |-- extracts text locally (PDF/OCR/DOCX)
  |
  |  HTTPS + Firebase ID token + extracted text
  v
Express API (documind-zsgo.onrender.com)
  |-- verifies the Firebase ID token -----> Firebase Admin
  |-- sends text and instructions --------> OpenAI Responses API
  |<-- receives structured analysis -------|
  |
  v
React app saves normalized results in Firestore
```

The OpenAI API key is never included in the browser bundle. It exists only in the Render backend environment.

## Main source files

| Responsibility | File |
| --- | --- |
| Upload UI and progress | `src/components/UploadModal.tsx` |
| File storage, text extraction, analysis orchestration, and chat persistence | `src/lib/document-processor.ts` |
| AI provider interface, HTTP client, and local fallback | `src/lib/ai-engine.ts` |
| Document chat UI | `src/pages/DocumentDetail.tsx` |
| Firebase client configuration | `src/lib/firebase.ts` |
| Express routes, authentication, CORS, and OpenAI calls | `backend/server.js` |

## Document analysis flow

### 1. The user selects a file

`UploadModal` calls:

```ts
processAndUploadDocument(file, user.uid, onProgress)
```

Files are processed sequentially by the upload modal. The callback updates the visible processing stage.

### 2. The original file is stored

`processAndUploadDocument` uploads the original file to Firebase Storage under:

```text
users/{userId}/documents/{randomId}.{extension}
```

It then creates a Firestore document at:

```text
users/{userId}/documents/{documentId}
```

Initial state includes `ocr_status: processing`, `ai_status: pending`, and `ai_provider: null`.

### 3. Text is extracted in the browser

The frontend chooses an extractor based on the file type:

| Input | Extraction implementation |
| --- | --- |
| PDF with a text layer | `pdfjs-dist` |
| Scanned PDF | PDF.js rendering plus `tesseract.js`, up to 20 pages |
| PNG, JPEG, WebP, GIF, or TIFF | `tesseract.js` OCR |
| DOCX | `mammoth.extractRawText` |
| Text files | Browser `FileReader` |

Processing has a combined three-minute timeout. If extraction produces no readable content, the app supplies a short placeholder explaining that no text was extracted.

The original binary file is not sent to the AI backend. Only the extracted text is sent.

The complete extracted text is retained in Firestore. For AI analysis, the backend sends at most 60,000 characters by default. When a document is longer, it keeps 75% from the beginning and 25% from the end, with an omission marker between them. This preserves introductory context as well as totals, dates, and signatures commonly found at the end without paying to analyze every page.

### 4. The frontend selects the primary AI provider

The processor calls:

```ts
getProvider().analyze(extractedText, onFallback)
```

`getProvider()` defaults to `PrimaryAIProvider`. This provider tries the remote OpenAI-backed API first. If that call throws an error, it invokes the fallback callback and runs `LocalAIProvider` in the browser.

### 5. The frontend authenticates the API request

`OpenAIProvider.request()` reads the currently signed-in Firebase user and obtains a fresh ID token:

```ts
const token = await auth.currentUser.getIdToken();
```

The backend base URL comes from:

```env
VITE_AI_API_URL=https://documind-zsgo.onrender.com
```

If this variable is absent, the development fallback is `http://localhost:3001`.

The request sent by the browser is equivalent to:

```http
POST /api/ai/analyze HTTP/1.1
Host: documind-zsgo.onrender.com
Authorization: Bearer <Firebase-ID-token>
Content-Type: application/json

{
  "documentText": "<locally extracted document text>"
}
```

Because `Authorization` and JSON `Content-Type` are used across origins, the browser first sends an `OPTIONS` preflight request. The Express CORS middleware must approve the frontend origin before the POST is sent.

### 6. The backend verifies the user

The `/api/ai/analyze` route uses `requireFirebaseUser`. It extracts the bearer token and verifies it with:

```js
admin.auth().verifyIdToken(token)
```

Missing tokens return HTTP `401`. Invalid or expired tokens also return `401`. The OpenAI request is made only after successful verification.

### 7. The backend calls OpenAI

The backend calls the OpenAI Responses API with:

- the model configured by `OPENAI_MODEL`;
- `store: false`;
- document-analysis instructions requiring JSON;
- the extracted document text;
- `max_output_tokens: 1000`.

The requested result contains:

```json
{
  "category": "Invoice",
  "summary": "Concise document summary",
  "documentType": "Commercial invoice",
  "confidence": 0.94,
  "issuer": "Example Company",
  "issueDate": "2026-07-01",
  "expirationDate": null,
  "amount": 1250,
  "currency": "EUR",
  "fields": {
    "invoiceNumber": "INV-123"
  },
  "tags": ["invoice", "finance"],
  "keywords": ["payment", "customer"],
  "language": "en"
}
```

`normalizeAnalysis()` validates and limits these fields before returning them. Unknown categories become `Other`, confidence is clamped between 0 and 1, strings and arrays are length-limited, and absent optional values become `null`.

The API response envelope is:

```json
{
  "analysis": {
    "category": "Invoice",
    "summary": "Concise document summary"
  }
}
```

The real `analysis` object contains all fields shown above.

### 8. The frontend stores the analysis

After a successful response, `processAndUploadDocument` updates the Firestore document with:

- category, summary, language, and keywords;
- extracted full text and word count;
- normalized metadata, including dates, issuer, amount, currency, and custom fields;
- generated tags;
- `ocr_status: completed`;
- `ai_status: completed`;
- `ai_provider: openai`.

If the remote request failed and local analysis succeeded, the same structure is saved with `ai_provider: local`.

## Local fallback behavior

The local NLP engine runs automatically when any remote operation fails, including:

- CORS or network failure;
- missing or invalid authentication;
- Render service failure or timeout;
- OpenAI API error;
- invalid backend response.

It performs rule-based category detection, date and amount extraction, issuer and field extraction, keyword selection, summary generation, and tag generation. This keeps document processing functional, but its results are generally less capable than the OpenAI analysis.

The console message below indicates fallback, not success from OpenAI:

```text
OpenAI analysis unavailable; using the local NLP engine.
```

## Document chat flow

On the document detail page, the user submits a question. The UI calls:

```ts
chatWithDocument(documentId, question, fullText, summary)
```

This eventually sends:

```http
POST /api/ai/chat HTTP/1.1
Authorization: Bearer <Firebase-ID-token>
Content-Type: application/json

{
  "question": "When does this document expire?",
  "documentText": "<stored extracted text>",
  "conversation": [
    {
      "role": "context",
      "content": "<stored document summary>"
    }
  ]
}
```

The backend keeps at most the last eight conversation entries and asks OpenAI to answer only from the supplied document. The response is:

```json
{
  "answer": "The document expires on 2027-03-15."
}
```

The frontend saves the question and answer in the document's `chat_messages` array in Firestore. Chat also uses the local provider automatically if the remote API fails.

## API endpoints

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | None | Render service health check |
| `POST` | `/api/ai/analyze` | Firebase ID token | Analyze extracted document text |
| `POST` | `/api/ai/chat` | Firebase ID token | Answer a question using document text |

The backend accepts JSON bodies up to 2 MB. Its text sanitizer uses at most 120,000 characters of document text and 4,000 characters for a chat question.

## Configuration

### Frontend

```env
VITE_AI_API_URL=https://documind-zsgo.onrender.com
```

Vite variables are compiled into the frontend. This variable is safe because it contains only the public backend URL. Never place `OPENAI_API_KEY` or a Firebase service-account key in a `VITE_` variable.

### Render backend

```env
OPENAI_API_KEY=<secret OpenAI API key>
OPENAI_MODEL=gpt-5.6-luna
AI_ANALYSIS_MAX_CHARS=60000
FIREBASE_SERVICE_ACCOUNT=<one-line Firebase service-account JSON>
ALLOWED_ORIGINS=https://signataire.com,https://www.signataire.com
```

`OPENAI_API_KEY` and `FIREBASE_SERVICE_ACCOUNT` are required; the backend exits during startup if either is absent.

`gpt-5.6-luna` is the backend default for cost-sensitive document processing. Render's `OPENAI_MODEL` value overrides that code default, so keep the environment variable synchronized when changing models.

`AI_ANALYSIS_MAX_CHARS` controls the maximum text sent for initial document analysis. It defaults to 60,000 characters and is clamped between 10,000 and 120,000. Lower values reduce input tokens and cost but may omit relevant content. This limit does not truncate the full text stored in Firestore.

The backend always permits these built-in origins:

- `https://signataire.com`
- `https://www.signataire.com`
- `http://localhost:5173`
- any HTTP port on `localhost` or `127.0.0.1`

Origins listed in `ALLOWED_ORIGINS` are added to those defaults. Values must be comma-separated origins without paths or trailing slashes.

## CORS request sequence

For a production analysis request, the browser performs:

```text
1. OPTIONS https://documind-zsgo.onrender.com/api/ai/analyze
   Origin: https://signataire.com
   Access-Control-Request-Method: POST
   Access-Control-Request-Headers: authorization,content-type

2. Render responds with Access-Control-Allow-Origin and permitted headers.

3. The browser sends the authenticated POST.
```

If step 2 fails, the browser never sends the POST, the backend never calls OpenAI, and the frontend switches to local analysis.

## Error handling and diagnosis

| Symptom/status | Meaning |
| --- | --- |
| Browser reports a failed CORS preflight | Origin was rejected, the service is unavailable, or old backend code is deployed |
| `401` | Firebase token is missing, invalid, or expired |
| `400` | Required input such as `documentText` or `question` is missing |
| `500` | Backend/OpenAI failure; details are logged on Render |
| UI says processing used local AI | Remote API threw an error and fallback completed |

Useful checks:

```bash
curl https://documind-zsgo.onrender.com/health
```

```bash
curl -i -X OPTIONS "https://documind-zsgo.onrender.com/api/ai/analyze" \
  -H "Origin: https://signataire.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

The preflight response should contain:

```http
Access-Control-Allow-Origin: https://signataire.com
```

## Security boundaries

- The browser authenticates users with Firebase; it never receives the OpenAI key.
- The backend independently verifies every Firebase bearer token.
- The backend accepts requests only from configured browser origins. CORS is a browser control, not a replacement for authentication.
- OpenAI requests use `store: false`.
- The original file stays in Firebase Storage; only extracted text is sent to the AI backend.
- Firestore and Storage access must also remain protected by their Firebase security rules.
