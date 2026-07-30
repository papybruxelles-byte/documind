import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import admin from 'firebase-admin';
import OpenAI from 'openai';

const requiredEnvironment = ['OPENAI_API_KEY', 'FIREBASE_SERVICE_ACCOUNT'];
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);

if (missingEnvironment.length) {
  console.error(`Missing required environment variable(s): ${missingEnvironment.join(', ')}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed.'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
app.use(express.json({ limit: '2mb' }));

async function requireFirebaseUser(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'A Firebase authentication token is required.' });

  try {
    req.user = await admin.auth().verifyIdToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or has expired.' });
  }
}

function text(value, limit = 120000) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function parseJsonResponse(responseText) {
  const clean = responseText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    return { summary: responseText.trim(), category: 'Other', documentType: 'Document' };
  }
}

const documentAnalysisInstructions = `You are DocuMind, a careful document-analysis assistant.
Analyze only the provided document text. Never invent missing values.
Return valid JSON only, without markdown, using exactly this shape:
{
  "documentType": "string",
  "category": "Invoice|Receipt|Contract|Letter|Report|Other",
  "summary": "string",
  "language": "en|fr",
  "issuer": "string|null",
  "documentDate": "YYYY-MM-DD|null",
  "deadline": "YYYY-MM-DD|null",
  "requiresResponse": true,
  "recommendations": ["string"],
  "keywords": ["string"],
  "extractedFields": { "key": "value" }
}`;

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/ai/analyze', requireFirebaseUser, async (req, res, next) => {
  try {
    const documentText = text(req.body?.documentText);
    if (!documentText) return res.status(400).json({ error: 'documentText is required.' });

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      store: false,
      instructions: documentAnalysisInstructions,
      input: `Document text:\n\n${documentText}`,
      max_output_tokens: 1800,
    });

    return res.json({ analysis: parseJsonResponse(response.output_text || '') });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/ai/chat', requireFirebaseUser, async (req, res, next) => {
  try {
    const question = text(req.body?.question, 4000);
    const documentText = text(req.body?.documentText);
    const conversation = Array.isArray(req.body?.conversation) ? req.body.conversation.slice(-8) : [];
    if (!question || !documentText) {
      return res.status(400).json({ error: 'question and documentText are required.' });
    }

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      store: false,
      instructions: 'You are DocuMind. Answer questions using only the supplied document. If the answer is not in it, say so clearly. Reply in the document language (English or French).',
      input: `Document text:\n${documentText}\n\nRecent conversation:\n${JSON.stringify(conversation)}\n\nUser question: ${question}`,
      max_output_tokens: 1000,
    });

    return res.json({ answer: response.output_text?.trim() || 'I could not generate an answer.' });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error?.status || 500;
  const message = status >= 500 ? 'The AI service is temporarily unavailable.' : error.message;
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`DocuMind AI backend listening on port ${port}`));
