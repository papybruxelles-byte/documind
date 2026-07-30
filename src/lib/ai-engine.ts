import type { DocumentCategory } from '@/types/database';

export interface AIAnalysisResult {
  category: DocumentCategory;
  summary: string;
  documentType: string;
  confidence: number;
  issuer: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  amount: number | null;
  currency: string;
  fields: Record<string, string>;
  tags: string[];
  keywords: string[];
  language: string;
}

export interface AIChatResult {
  answer: string;
}

export interface AIProvider {
  name: string;
  analyze(text: string): Promise<AIAnalysisResult>;
  chat(question: string, documentText: string, summary: string): Promise<AIChatResult>;
}

const CATEGORY_KEYWORDS: Record<DocumentCategory, string[]> = {
  Invoice: ['invoice', 'bill to', 'amount due', 'subtotal', 'tax', 'total due', 'payment terms', 'vendor', 'invoice number', 'invoice #'],
  'Medical Report': ['patient', 'diagnosis', 'prescription', 'doctor', 'hospital', 'medical', 'blood pressure', 'mg', 'dosage', 'symptoms', 'treatment'],
  'Bank Statement': ['account', 'balance', 'deposit', 'withdrawal', 'transaction', 'bank', 'statement', 'credit', 'debit', 'overdraft'],
  Passport: ['passport', 'surname', 'given names', 'nationality', 'date of birth', 'place of birth', 'date of issue', 'date of expiry', 'authority'],
  'Driver License': ['driver', 'license', 'dl', 'date of birth', 'class', 'restrictions', 'endorsements', 'sex', 'height', 'eye color'],
  Tax: ['tax', 'return', 'income', 'deduction', 'refund', 'w-2', 'w2', '1040', 'irs', 'fiscal year', 'taxable'],
  Insurance: ['insurance', 'policy', 'coverage', 'premium', 'deductible', 'claim', 'insured', 'beneficiary', 'effective date', 'liability'],
  'Employment Contract': ['employment', 'employer', 'employee', 'salary', 'compensation', 'probation', 'termination', 'position', 'contract', 'party'],
  'Birth Certificate': ['birth', 'certificate', 'born', 'mother', 'father', 'sex', 'date of birth', 'place of birth', 'maiden name'],
  Receipt: ['receipt', 'total', 'cash', 'card', 'change', 'thank you', 'store', 'purchased', 'qty', 'item'],
  'Utility Bill': ['electric', 'electricity', 'gas', 'water', 'utility', 'kwh', 'meter', 'billing period', 'usage', 'service address'],
  Academic: ['university', 'college', 'degree', 'transcript', 'grade', 'gpa', 'semester', 'course', 'credit', 'diploma', 'student'],
  Legal: ['agreement', 'parties', 'whereas', 'hereby', 'clause', 'jurisdiction', 'binding', 'witness', 'notary', 'covenant'],
  Other: [],
};

const TAG_SUGGESTIONS: Record<string, string[]> = {
  Invoice: ['finance', 'billing', 'payment'],
  'Medical Report': ['health', 'medical'],
  'Bank Statement': ['finance', 'banking'],
  Passport: ['travel', 'identity', 'international'],
  'Driver License': ['identity', 'driving'],
  Tax: ['finance', 'tax', 'government'],
  Insurance: ['insurance', 'protection'],
  'Employment Contract': ['career', 'legal', 'employment'],
  'Birth Certificate': ['identity', 'family', 'vital'],
  Receipt: ['finance', 'shopping', 'expense'],
  'Utility Bill': ['finance', 'utilities', 'household'],
  Academic: ['education', 'academic'],
  Legal: ['legal', 'contracts'],
  Other: ['document'],
};

function detectCategory(text: string): DocumentCategory {
  const lower = text.toLowerCase();
  let bestCategory: DocumentCategory = 'Other';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'Other') continue;
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as DocumentCategory;
    }
  }

  return bestCategory;
}

function detectLanguage(text: string): string {
  const frenchWords = ['le', 'la', 'les', 'de', 'et', 'que', 'dans', 'pour', 'avec', 'sur'];
  const spanishWords = ['el', 'la', 'los', 'de', 'y', 'que', 'en', 'para', 'con', 'por'];
  const germanWords = ['der', 'die', 'das', 'und', 'von', 'mit', 'zu', 'auf', 'für', 'ist'];
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).slice(0, 200);

  const countMatches = (dict: string[]) =>
    words.filter((w) => dict.includes(w.replace(/[^a-zà-ÿ]/g, ''))).length;

  if (countMatches(frenchWords) > 3) return 'fr';
  return 'en';
}

function extractDates(text: string): { issueDate: string | null; expirationDate: string | null } {
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g,
    /(?:date of (?:issue|birth|issue)\s*[:\-]?\s*)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
    /(?:expir\w*\s*[:\-]?\s*)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
  ];

  const allDates: string[] = [];
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      allDates.push(match[1] || match[0]);
    }
  }

  let issueDate: string | null = null;
  let expirationDate: string | null = null;

  const expMatch = text.match(/expir\w*\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (expMatch) expirationDate = expMatch[1];

  const issueMatch = text.match(/(?:date of issue|issued?\s*[:\-]?\s*)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (issueMatch) issueDate = issueMatch[1];

  if (!issueDate && allDates.length > 0) issueDate = allDates[0];
  if (!expirationDate && allDates.length > 1) {
    const last = allDates[allDates.length - 1];
    if (last !== issueDate) expirationDate = last;
  }

  return { issueDate, expirationDate };
}

function extractAmount(text: string): { amount: number | null; currency: string } {
  const currencyMatch = text.match(/(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|\$|€|£|¥)/i);
  const currencyMap: Record<string, string> = {
    '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY',
    USD: 'USD', EUR: 'EUR', GBP: 'GBP', JPY: 'JPY', CAD: 'CAD', AUD: 'AUD', CHF: 'CHF', CNY: 'CNY',
  };
  const currency = currencyMatch ? currencyMap[currencyMatch[0].toUpperCase()] || 'USD' : 'USD';

  const amountPatterns = [
    /(?:total(?:\s+due)?|amount\s+due|balance\s+due|grand\s+total)\s*[:\$]?\s*([\d,]+\.?\d*)/i,
    /(?:total|amount)\s*[:]\s*([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.?\d*)/,
    /€\s*([\d,]+\.?\d*)/,
    /£\s*([\d,]+\.?\d*)/,
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0) return { amount: num, currency };
    }
  }

  return { amount: null, currency };
}

function extractIssuer(text: string, category: DocumentCategory): string | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  if (category === 'Invoice' || category === 'Receipt' || category === 'Utility Bill') {
    const vendorMatch = text.match(/(?:from|vendor|biller|company|issued by)\s*[:\-]?\s*(.+)/i);
    if (vendorMatch) return vendorMatch[1].trim().slice(0, 80);
    return lines[0].slice(0, 80);
  }

  if (category === 'Medical Report') {
    const docMatch = text.match(/(?:dr\.?|doctor|physician|hospital|clinic)\s*[:\-]?\s*(.+)/i);
    if (docMatch) return docMatch[1].trim().slice(0, 80);
  }

  if (category === 'Bank Statement') {
    const bankMatch = text.match(/(?:bank|institution)\s*[:\-]?\s*(.+)/i);
    if (bankMatch) return bankMatch[1].trim().slice(0, 80);
  }

  if (category === 'Insurance') {
    const insMatch = text.match(/(?:insurer|insurance\s+co|provider)\s*[:\-]?\s*(.+)/i);
    if (insMatch) return insMatch[1].trim().slice(0, 80);
  }

  return lines[0].slice(0, 80);
}

function extractFields(text: string, category: DocumentCategory): Record<string, string> {
  const fields: Record<string, string> = {};
  const lower = text.toLowerCase();

  const fieldExtractors: Record<DocumentCategory, [string, RegExp][]> = {
    Invoice: [
      ['Invoice Number', /invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i],
      ['Vendor', /(?:from|vendor)\s*[:\-]?\s*(.+)/i],
      ['Due Date', /due\s+date\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
      ['Amount', /(?:total|amount\s+due)\s*[:\$]?\s*([\d,]+\.?\d*)/i],
    ],
    'Medical Report': [
      ['Doctor', /(?:dr\.?|doctor|physician)\s*[:\-]?\s*(.+)/i],
      ['Hospital', /(?:hospital|clinic)\s*[:\-]?\s*(.+)/i],
      ['Diagnosis', /diagnosis\s*[:\-]?\s*(.+)/i],
      ['Prescription', /prescription\s*[:\-]?\s*(.+)/i],
    ],
    'Bank Statement': [
      ['Bank', /(?:bank)\s*[:\-]?\s*(.+)/i],
      ['Account', /account\s*(?:no\.?|number|#)?\s*[:\-]?\s*([\d\-\*]+)/i],
      ['Balance', /(?:balance|ending\s+balance)\s*[:\$]?\s*([\d,]+\.?\d*)/i],
      ['Period', /(?:statement\s+period|period)\s*[:\-]?\s*(.+)/i],
    ],
    Passport: [
      ['Country', /(?:country|nationality)\s*[:\-]?\s*(.+)/i],
      ['Passport Number', /passport\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9]+)/i],
      ['Expiration', /expir\w*\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
      ['Name', /(?:surname|name)\s*[:\-]?\s*(.+)/i],
    ],
    'Driver License': [
      ['License Number', /(?:dl|license)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9]+)/i],
      ['Class', /class\s*[:\-]?\s*([A-Z]+)/i],
      ['Date of Birth', /date\s+of\s+birth\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
      ['Expiration', /expir\w*\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ],
    Tax: [
      ['Tax Year', /(?:tax\s+year|fiscal\s+year)\s*[:\-]?\s*(\d{4})/i],
      ['Income', /(?:total\s+income|gross\s+income)\s*[:\$]?\s*([\d,]+\.?\d*)/i],
      ['Refund', /(?:refund|amount\s+due)\s*[:\$]?\s*([\d,]+\.?\d*)/i],
    ],
    Insurance: [
      ['Policy Number', /policy\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9\-]+)/i],
      ['Insurer', /(?:insurer|insurance\s+co)\s*[:\-]?\s*(.+)/i],
      ['Coverage', /coverage\s*[:\-]?\s*(.+)/i],
      ['Premium', /premium\s*[:\$]?\s*([\d,]+\.?\d*)/i],
      ['Effective Date', /effective\s+date\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ],
    'Employment Contract': [
      ['Employer', /(?:employer|company)\s*[:\-]?\s*(.+)/i],
      ['Position', /(?:position|title|role)\s*[:\-]?\s*(.+)/i],
      ['Salary', /(?:salary|compensation)\s*[:\$]?\s*([\d,]+\.?\d*)/i],
      ['Start Date', /(?:start\s+date|effective\s+date)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ],
    'Birth Certificate': [
      ['Name', /(?:name|child)\s*[:\-]?\s*(.+)/i],
      ['Date of Birth', /date\s+of\s+birth\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
      ['Place of Birth', /place\s+of\s+birth\s*[:\-]?\s*(.+)/i],
      ['Sex', /\bsex\s*[:\-]?\s*([MF])/i],
    ],
    Receipt: [
      ['Store', /(?:store|merchant)\s*[:\-]?\s*(.+)/i],
      ['Total', /total\s*[:\$]?\s*([\d,]+\.?\d*)/i],
      ['Date', /date\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
      ['Payment Method', /(?:paid\s+by|payment|card)\s*[:\-]?\s*(.+)/i],
    ],
    'Utility Bill': [
      ['Provider', /(?:provider|company)\s*[:\-]?\s*(.+)/i],
      ['Billing Period', /billing\s+period\s*[:\-]?\s*(.+)/i],
      ['Usage', /usage\s*[:\-]?\s*([\d,.]+\s*kwh)/i],
      ['Amount Due', /amount\s+due\s*[:\$]?\s*([\d,]+\.?\d*)/i],
    ],
    Academic: [
      ['Institution', /(?:university|college|institute)\s*[:\-]?\s*(.+)/i],
      ['Degree', /(?:degree|diploma)\s*[:\-]?\s*(.+)/i],
      ['GPA', /gpa\s*[:\-]?\s*([\d.]+)/i],
      ['Student', /student\s+name\s*[:\-]?\s*(.+)/i],
    ],
    Legal: [
      ['Parties', /(?:between|parties)\s*[:\-]?\s*(.+)/i],
      ['Date', /(?:dated|date)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
      ['Jurisdiction', /jurisdiction\s*[:\-]?\s*(.+)/i],
    ],
    Other: [],
  };

  const extractors = fieldExtractors[category] || [];
  for (const [label, pattern] of extractors) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim().slice(0, 100);
      if (value) fields[label] = value;
    }
  }

  return fields;
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'as', 'if',
    'not', 'no', 'so', 'than', 'too', 'very', 'just', 'about', 'above', 'after', 'again',
    'all', 'any', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
    'same', 'then', 'there', 'here', 'when', 'where', 'why', 'how', 'both', 'each',
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w) && !/^\d+$/.test(w));

  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

function generateSummary(text: string, category: DocumentCategory): string {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length === 0) {
    return `This ${category.toLowerCase()} was processed and stored. No readable text content was extracted.`;
  }

  const wordFreq: Record<string, number> = {};
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
  for (const sentence of sentences) {
    for (const word of sentence.toLowerCase().split(/\s+/)) {
      if (word.length > 3 && !stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    }
  }

  const scored = sentences.map((sentence) => {
    let score = 0;
    for (const word of sentence.toLowerCase().split(/\s+/)) {
      score += wordFreq[word] || 0;
    }
    return { sentence, score: score / Math.sqrt(sentence.length) };
  });

  const topSentences = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.sentence);

  const summary = topSentences.join('. ');
  return summary.length > 280 ? summary.slice(0, 277) + '...' : summary;
}

function generateTags(category: DocumentCategory, text: string): string[] {
  const baseTags = TAG_SUGGESTIONS[category] || ['document'];
  const extraTags: string[] = [];
  const lower = text.toLowerCase();

  const tagTriggers: Record<string, string[]> = {
    travel: ['passport', 'visa', 'flight', 'airline', 'boarding'],
    family: ['family', 'child', 'spouse', 'birth', 'marriage'],
    education: ['school', 'university', 'college', 'student', 'degree'],
    electricity: ['electric', 'kwh', 'engie', 'edf'],
    healthcare: ['health', 'medical', 'hospital', 'doctor', 'prescription'],
    finance: ['payment', 'invoice', 'bank', 'amount', 'total'],
    visa: ['visa', 'embassy', 'consulate'],
    insurance: ['insurance', 'policy', 'coverage'],
  };

  for (const [tag, triggers] of Object.entries(tagTriggers)) {
    if (triggers.some((t) => lower.includes(t))) {
      if (!extraTags.includes(tag) && !baseTags.includes(tag)) {
        extraTags.push(tag);
      }
    }
  }

  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (yearMatch) extraTags.push(yearMatch[1]);

  return [...new Set([...baseTags, ...extraTags])].slice(0, 8);
}

class LocalAIProvider implements AIProvider {
  name = 'Local NLP Engine';

  async analyze(text: string): Promise<AIAnalysisResult> {
    await new Promise((r) => setTimeout(r, 600));

    const category = detectCategory(text);
    const language = detectLanguage(text);
    const { issueDate, expirationDate } = extractDates(text);
    const { amount, currency } = extractAmount(text);
    const issuer = extractIssuer(text, category);
    const fields = extractFields(text, category);
    const keywords = extractKeywords(text);
    const summary = generateSummary(text, category);
    const tags = generateTags(category, text);

    const confidence = Math.min(0.98, 0.55 + Math.random() * 0.4);

    return {
      category,
      summary,
      documentType: category,
      confidence,
      issuer,
      issueDate,
      expirationDate,
      amount,
      currency,
      fields,
      tags,
      keywords,
      language,
    };
  }

  async chat(question: string, documentText: string, summary: string): Promise<AIChatResult> {
    await new Promise((r) => setTimeout(r, 800));

    const lower = question.toLowerCase();
    const context = documentText.slice(0, 3000);

    if (/summar|what is this|overview/.test(lower)) {
      return { answer: summary };
    }

    if (/expir|valid until|when does/.test(lower)) {
      const expMatch = context.match(/expir\w*\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
      if (expMatch) {
        return { answer: `This document expires on ${expMatch[1]}. Make sure to renew it before that date to avoid any issues.` };
      }
      return { answer: 'No expiration date was found in this document.' };
    }

    if (/payment|due|deadline|when.*pay/.test(lower)) {
      const dueMatch = context.match(/due\s+date\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
      if (dueMatch) {
        return { answer: `The payment deadline is ${dueMatch[1]}. Please ensure payment is made before this date to avoid late fees.` };
      }
      return { answer: 'No specific payment deadline was found in this document.' };
    }

    if (/amount|total|cost|how much|price/.test(lower)) {
      const amountMatch = context.match(/(?:total|amount\s+due)\s*[:\$]?\s*([\d,]+\.?\d*)/i);
      if (amountMatch) {
        return { answer: `The total amount is ${amountMatch[1]}. This figure was extracted from the document content.` };
      }
      return { answer: 'No specific amount was found in this document.' };
    }

    if (/who|issuer|from|company|vendor|doctor|hospital|bank/.test(lower)) {
      const lines = context.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        return { answer: `The issuer of this document appears to be "${lines[0].slice(0, 80)}".` };
      }
      return { answer: 'The issuer could not be clearly identified from the document.' };
    }

    const sentences = context.split(/[.!?]+/).filter((s) => s.trim().length > 15);
    const questionWords = lower.split(/\s+/).filter((w) => w.length > 3);
    const relevant = sentences.find((s) =>
      questionWords.some((w) => s.toLowerCase().includes(w))
    );

    if (relevant) {
      return { answer: relevant.trim() + '.' };
    }

    return {
      answer: `Based on the document content: ${summary} Could you ask a more specific question? I can help with details about dates, amounts, issuer information, or specific sections of this document.`,
    };
  }
}

const localProvider = new LocalAIProvider();

export const aiProviders: Record<string, AIProvider> = {
  local: localProvider,
};

export function getProvider(name: string = 'local'): AIProvider {
  return aiProviders[name] || localProvider;
}
