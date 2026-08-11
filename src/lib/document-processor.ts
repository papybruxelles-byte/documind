import { getProvider } from '@/lib/ai-engine';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import { collection, deleteDoc, doc as firestoreDoc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { getDocumentWorkflow } from '@/lib/document-workflows';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/tiff'];
const PDF_MIME_TYPE = 'application/pdf';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_OCR_PAGES = 20;
const PROCESSING_TIMEOUT_MS = 3 * 60 * 1000;
const OCR_ASSET_BASE = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}tesseract`;

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('Processing stopped after the 3-minute time limit.')),
      Math.max(0, milliseconds),
    );
    promise.then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

interface UploadResult {
  documentId: string;
  error: string | null;
  aiProvider?: 'openai' | 'local';
}

export async function processAndUploadDocument(
  file: File,
  userId: string,
  onProgress?: (stage: string) => void
): Promise<UploadResult> {
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
  const timeRemaining = () => Math.max(0, deadline - Date.now());
  let createdDocumentId = '';

  try {
    onProgress?.('Uploading file...');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'file';
    const storagePath = `users/${userId}/documents/${crypto.randomUUID()}.${extension}`;
    await withTimeout(
      uploadBytes(ref(storage, storagePath), file, { contentType: file.type || 'application/octet-stream' }),
      timeRemaining(),
    );

    const documentRef = firestoreDoc(collection(db, 'users', userId, 'documents'));
    createdDocumentId = documentRef.id;
    const now = new Date().toISOString();
    await setDoc(documentRef, {
      user_id: userId, title: file.name.replace(/\.[^/.]+$/, ''), category: 'Other', summary: null,
      language: 'en', ocr_status: 'processing', ai_status: 'pending', ai_provider: null, source: 'upload', keywords: [],
      created_at: now, updated_at: now, access_uids: [userId], company_id: null,
      document_files: [{ id: crypto.randomUUID(), document_id: documentRef.id, file_path: storagePath, thumbnail_path: null, pages: 1, size_bytes: file.size, mime_type: file.type || 'application/octet-stream', created_at: now }],
      document_metadata: null, document_tags: [], full_text: '', word_count: 0, chat_messages: [], notes: [], status: 'pending',
    });

    onProgress?.('Extracting text (OCR)...');
    let extractedText = '';
    if (file.type === PDF_MIME_TYPE || file.name.toLowerCase().endsWith('.pdf')) extractedText = await withTimeout(extractTextFromPdf(file, onProgress), timeRemaining());
    else if (IMAGE_MIME_TYPES.includes(file.type)) extractedText = await withTimeout(extractTextFromImage(file, onProgress), timeRemaining());
    else if (file.type === DOCX_MIME_TYPE || file.name.toLowerCase().endsWith('.docx')) extractedText = await withTimeout(extractTextFromDocx(file), timeRemaining());
    else if (file.type.startsWith('text/')) extractedText = await withTimeout(extractTextFromFile(file), timeRemaining());
    const readableWords = extractedText.match(/\p{L}{2,}/gu) || [];
    if (readableWords.length < 5) {
      throw new Error('Aucun texte suffisamment lisible n’a pu être extrait. Vérifiez la qualité du document puis réessayez.');
    }

    onProgress?.('AI analyzing document...');
    await updateDoc(documentRef, { ocr_status: 'completed', ai_status: 'processing', updated_at: new Date().toISOString() });
    let usedLocalAI = false;
    const analysis = await withTimeout(
      getProvider().analyze(
        extractedText,
        () => {
          usedLocalAI = true;
          onProgress?.('OpenAI processing failed. Starting local AI...');
        },
      ),
      timeRemaining(),
    );
    const tags = analysis.tags.map((name) => ({ tag_id: name.toLowerCase(), tags: { id: name.toLowerCase(), user_id: userId, name, color: 'blue', created_at: now } }));
    const metadata = { id: documentRef.id, document_id: documentRef.id, document_type: analysis.documentType, confidence: analysis.confidence, issuer: analysis.issuer, issue_date: analysis.issueDate, expiration_date: analysis.expirationDate, amount: analysis.amount, currency: analysis.currency, fields: analysis.fields, created_at: now };
    const aiProvider = usedLocalAI ? 'local' : 'openai';
    const workflow = getDocumentWorkflow(analysis.category);
    await updateDoc(documentRef, { category: analysis.category, summary: analysis.summary, language: analysis.language, keywords: analysis.keywords, ocr_status: 'completed', ai_status: 'completed', ai_provider: aiProvider, updated_at: new Date().toISOString(), full_text: extractedText, word_count: extractedText.split(/\s+/).filter(Boolean).length, document_metadata: metadata, document_tags: tags, workflow_stage: workflow.initialStage, status: 'pending' });
    onProgress?.(`Done! Processed by ${usedLocalAI ? 'local AI' : 'OpenAI'}.`);
    return { documentId: documentRef.id, error: null, aiProvider };
  } catch (error) {
    if (createdDocumentId) {
      try {
        await updateDoc(firestoreDoc(db, 'users', userId, 'documents', createdDocumentId), {
          ocr_status: 'failed',
          ai_status: 'failed',
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Preserve the original processing error if the status update also fails.
      }
    }
    return {
      documentId: createdDocumentId,
      error: error instanceof Error ? error.message : 'Unable to process document',
    };
  }
}

/* Previous backend implementation retained temporarily for migration reference.
async function legacyProcessAndUploadDocument(
  file: File,
  userId: string,
  onProgress?: (stage: string) => void
): Promise<UploadResult> {
  try {
    onProgress?.('Uploading file...');

    const fileName = file.name.replace(/\.[^/.]+$/, '');
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
    const filePath = `${userId}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await legacyBackend.storage
      .from('documents')
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      return { documentId: '', error: uploadError.message };
    }

    onProgress?.('Creating document record...');

    const { data: doc, error: docError } = await legacyBackend
      .from('documents')
      .insert({
        title: fileName,
        source: 'upload',
        ocr_status: 'processing',
        ai_status: 'pending',
      })
      .select()
      .single();

    if (docError || !doc) {
      return { documentId: '', error: docError?.message ?? 'Failed to create document' };
    }

    const { error: fileError } = await legacyBackend.from('document_files').insert({
      document_id: doc.id,
      file_path: filePath,
      pages: 1,
      size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
    });

    if (fileError) {
      console.error('File record error:', fileError);
    }

    onProgress?.('Extracting text (OCR)...');

    let extractedText = '';

    if (file.type === PDF_MIME_TYPE || file.name.toLowerCase().endsWith('.pdf')) {
      extractedText = await extractTextFromPdf(file, onProgress);
    } else if (IMAGE_MIME_TYPES.includes(file.type)) {
      extractedText = await extractTextFromImage(file, onProgress);
    } else if (file.type === DOCX_MIME_TYPE || file.name.toLowerCase().endsWith('.docx')) {
      extractedText = await extractTextFromDocx(file);
    } else if (file.type.startsWith('text/')) {
      extractedText = await extractTextFromFile(file);
    } else {
      extractedText = `[Document: ${file.name}] This ${file.type || 'document'} format is stored, but text extraction is not supported yet.`;
    }

    if (!extractedText.trim()) {
      extractedText = `Document: ${file.name}\nFile type: ${file.type}\nSize: ${file.size} bytes\n\nNo readable text could be extracted from this document.`;
    }

    onProgress?.('Saving extracted text...');

    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    await legacyBackend.from('document_text').upsert({
      document_id: doc.id,
      full_text: extractedText,
      word_count: wordCount,
    });

    await legacyBackend
      .from('documents')
      .update({ ocr_status: 'completed', ai_status: 'processing' })
      .eq('id', doc.id);

    onProgress?.('AI analyzing document...');

    const provider = getProvider('local');
    const analysis = await provider.analyze(extractedText);

    onProgress?.('Saving AI analysis...');

    await legacyBackend.from('document_metadata').upsert({
      document_id: doc.id,
      document_type: analysis.documentType,
      confidence: analysis.confidence,
      issuer: analysis.issuer,
      issue_date: analysis.issueDate,
      expiration_date: analysis.expirationDate,
      amount: analysis.amount,
      currency: analysis.currency,
      fields: analysis.fields,
    });

    await legacyBackend
      .from('documents')
      .update({
        category: analysis.category as DocumentCategory,
        summary: analysis.summary,
        language: analysis.language,
        keywords: analysis.keywords,
        ai_status: 'completed',
      })
      .eq('id', doc.id);

    onProgress?.('Generating tags...');

    for (const tagName of analysis.tags) {
      const { data: existingTag } = await legacyBackend
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .maybeSingle();

      let tagId = existingTag?.id;

      if (!tagId) {
        const colors = ['blue', 'green', 'amber', 'rose', 'teal', 'violet', 'cyan', 'orange'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const { data: newTag } = await legacyBackend
          .from('tags')
          .insert({ name: tagName, color })
          .select('id')
          .single();
        tagId = newTag?.id;
      }

      if (tagId) {
        await legacyBackend.from('document_tags').insert({
          document_id: doc.id,
          tag_id: tagId,
        });
      }
    }

    if (analysis.expirationDate) {
      const expDate = new Date(analysis.expirationDate);
      const now = new Date();
      const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil <= 90 && daysUntil >= 0) {
        await legacyBackend.from('notifications').insert({
          user_id: userId,
          document_id: doc.id,
          type: 'expiration',
          title: `${analysis.category} expires soon`,
          message: `Your ${analysis.category.toLowerCase()}${analysis.issuer ? ` from ${analysis.issuer}` : ''} expires on ${analysis.expirationDate} (${daysUntil} days remaining).`,
          severity: daysUntil <= 30 ? 'danger' : 'warning',
          due_date: analysis.expirationDate,
        });
      }
    }

    onProgress?.('Done!');

    return { documentId: doc.id, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during processing';
    return { documentId: '', error: message };
  }
}

*/

async function extractTextFromPdf(file: File, onProgress?: (stage: string) => void): Promise<string> {
  try {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').trim();
      if (text) pageTexts.push(`Page ${pageNumber}\n${text}`);
    }

    // PDFs without an embedded text layer are scans, so render each page for local OCR.
    if (pageTexts.join(' ').trim().length < Math.max(80, pdf.numPages * 40)) {
      const pagesToOcr = Math.min(pdf.numPages, MAX_OCR_PAGES);
      const ocrPages: string[] = [];
      onProgress?.('Initialisation de la lecture OCR en français…');
      const worker = await createFrenchFirstOcrWorker();
      try {
        for (let pageNumber = 1; pageNumber <= pagesToOcr; pageNumber++) {
          onProgress?.(`Lecture de la page numérisée ${pageNumber} sur ${pagesToOcr}…`);
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 2.5 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d');
          if (!context) continue;
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const { data } = await worker.recognize(canvas);
          const text = data.text.trim();
          if (text) ocrPages.push(`Page ${pageNumber}\n${text}`);
        }
      } finally {
        await worker.terminate();
      }
      if (pdf.numPages > MAX_OCR_PAGES) ocrPages.push(`[Seules les ${MAX_OCR_PAGES} premières pages ont été lues par OCR.]`);
      return ocrPages.join('\n\n');
    }

    return pageTexts.join('\n\n');
  } catch (error) {
    console.error('Échec de la lecture du PDF.', error);
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`La lecture OCR du PDF a échoué : ${detail}`);
  }
}

async function extractTextFromImage(file: File, onProgress?: (stage: string) => void): Promise<string> {
  onProgress?.('Lecture du texte de l’image en français…');
  return recognizeImage(file);
}

async function createFrenchFirstOcrWorker() {
  const options = {
    workerPath: `${OCR_ASSET_BASE}/worker.min.js`,
    corePath: `${OCR_ASSET_BASE}/tesseract-core-lstm.wasm.js`,
    langPath: `${OCR_ASSET_BASE}/lang`,
    workerBlobURL: false,
    gzip: true,
    errorHandler: (error: unknown) => console.error('Erreur du moteur OCR local.', error),
  };
  try {
    return await createWorker(['fra', 'eng'], undefined, options);
  } catch (error) {
    console.warn('Le modèle OCR français est indisponible, utilisation du modèle anglais.', error);
    try {
      return await createWorker('eng', undefined, options);
    } catch (fallbackError) {
      const detail = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Impossible de charger les ressources OCR depuis ${OCR_ASSET_BASE}. ${detail}`);
    }
  }
}

async function recognizeImage(image: File | HTMLCanvasElement): Promise<string> {
  const worker = await createFrenchFirstOcrWorker();
  try {
    const { data } = await worker.recognize(image);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value.trim();
  } catch {
    return '';
  }
}

/* Replaced placeholder extraction routines. */
/*
async function legacyExtractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let text = '';

    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] >= 32 && bytes[i] <= 126) {
        text += String.fromCharCode(bytes[i]);
      } else if (bytes[i] === 10 || bytes[i] === 13) {
        text += '\n';
      } else {
        text += ' ';
      }
    }

    const cleanText = text
      .replace(/[^\w\s\.\,\;\:\!\?\-\(\)\/\$€£\@\#\&\*\+\=\'\"\u00C0-\u017F]/g, ' ')
      .replace(/\s{3,}/g, '\n')
      .replace(/(.)\1{4,}/g, '')
      .trim();

    if (cleanText.length < 20) {
      return `PDF Document: ${file.name}\n\nThis PDF document was uploaded for processing. In a production environment, the full text would be extracted using OCR services such as Google Vision, Azure Document Intelligence, or Tesseract. The AI engine would then analyze the extracted text to provide summaries, classification, and metadata extraction.\n\nFile size: ${(file.size / 1024).toFixed(1)} KB\nEstimated pages: ${Math.max(1, Math.ceil(file.size / 50000))}`;
    }

    return cleanText;
  } catch {
    return `PDF Document: ${file.name}\nSize: ${file.size} bytes\nThe document was uploaded but text extraction encountered an error.`;
  }
}

async function legacyExtractTextFromImage(file: File): Promise<string> {
  return `Image Document: ${file.name}\n\nThis image was uploaded for OCR processing. In a production environment with Google Vision API, Azure Document Intelligence, or Tesseract OCR, the text content from this image would be extracted here.\n\nFile type: ${file.type}\nFile size: ${(file.size / 1024).toFixed(1)} KB\n\nThe AI engine would then analyze the extracted text to classify the document, generate a summary, extract important fields, and suggest tags.`;
}

*/

export async function chatWithDocument(
  documentId: string,
  question: string,
  documentText: string,
  summary: string
): Promise<string> {
  const result = await getProvider().chat(question, documentText, summary);
  const userId = (await import('@/lib/firebase')).auth.currentUser?.uid;
  if (userId) {
    const reference = firestoreDoc(db, 'users', userId, 'documents', documentId);
    const snapshot = await getDoc(reference);
    const existing = (snapshot.data()?.chat_messages || []) as unknown[];
    await updateDoc(reference, { chat_messages: [...existing, { id: crypto.randomUUID(), document_id: documentId, user_id: userId, question, answer: result.answer, created_at: new Date().toISOString() }] });
  }
  return result.answer;
}

/* Previous backend implementation retained temporarily for migration reference.
async function legacyChatWithDocument(
  documentId: string,
  question: string,
  documentText: string,
  summary: string
): Promise<string> {
  const provider = getProvider('local');
  const result = await provider.chat(question, documentText, summary);

  await legacyBackend.from('chat_messages').insert({
    document_id: documentId,
    question,
    answer: result.answer,
  });

  return result.answer;
}

*/

export async function deleteDocument(documentId: string): Promise<{ error: string | null }> {
  try {
    const userId = (await import('@/lib/firebase')).auth.currentUser?.uid;
    if (!userId) return { error: 'You must be signed in.' };
    const reference = firestoreDoc(db, 'users', userId, 'documents', documentId);
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) return { error: 'Document not found.' };
    const isSharedCopy = Boolean(snapshot.data()?.shared_from);
    const filePath = snapshot.data()?.document_files?.[0]?.file_path;
    // Recipients only remove their access copy; the owner keeps the original file.
    if (filePath && !isSharedCopy) {
      try {
        await deleteObject(ref(storage, filePath));
      } catch (error) {
        // A missing Storage object (404) should not prevent removing its Firestore record.
        if (!(error instanceof Error) || !error.message.includes('object-not-found')) throw error;
      }
    }
    await deleteDoc(reference);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to delete document' }; }
}

/* Previous backend implementation retained temporarily for migration reference.
async function legacyDeleteDocument(documentId: string): Promise<{ error: string | null }> {
  const { data: files } = await legacyBackend
    .from('document_files')
    .select('file_path')
    .eq('document_id', documentId);

  if (files) {
    for (const f of files) {
      await legacyBackend.storage.from('documents').remove([f.file_path]);
    }
  }

  const { error } = await legacyBackend.from('document_files').delete().eq('document_id', documentId);
  if (error) return { error: error.message };

  const { error: docError } = await legacyBackend.from('documents').delete().eq('id', documentId);
  if (docError) return { error: docError.message };

  return { error: null };
}
*/
