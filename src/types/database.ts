export type DocumentCategory =
  | 'Invoice'
  | 'Medical Report'
  | 'Bank Statement'
  | 'Passport'
  | "Driver License"
  | 'Tax'
  | 'Insurance'
  | 'Employment Contract'
  | 'Birth Certificate'
  | 'Receipt'
  | 'Utility Bill'
  | 'Academic'
  | 'Legal'
  | 'Other';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'Invoice',
  'Medical Report',
  'Bank Statement',
  'Passport',
  'Driver License',
  'Tax',
  'Insurance',
  'Employment Contract',
  'Birth Certificate',
  'Receipt',
  'Utility Bill',
  'Academic',
  'Legal',
  'Other',
];

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Document {
  id: string;
  user_id: string;
  title: string;
  category: DocumentCategory;
  summary: string | null;
  language: string;
  ocr_status: ProcessingStatus;
  ai_status: ProcessingStatus;
  source: string;
  keywords: string[];
  created_at: string;
  updated_at: string;
  access_uids?: string[];
  company_id?: string | null;
  status?: 'pending' | 'in_progress' | 'closed';
  notes?: { id: string; user_id: string; author: string; text: string; created_at: string }[];
  scheduled_actions?: { id: string; type: 'reminder' | 'meeting' | 'payment'; date: string; created_at: string }[];
  shared_from?: string;
}

export interface DocumentFile {
  id: string;
  document_id: string;
  file_path: string;
  thumbnail_path: string | null;
  pages: number;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

export interface DocumentText {
  id: string;
  document_id: string;
  full_text: string;
  word_count: number;
  created_at: string;
}

export interface DocumentMetadata {
  id: string;
  document_id: string;
  document_type: string | null;
  confidence: number;
  issuer: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  amount: number | null;
  currency: string;
  fields: Record<string, string>;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface DocumentTag {
  id: string;
  document_id: string;
  tag_id: string;
}

export interface ChatMessage {
  id: string;
  document_id: string;
  user_id: string;
  question: string;
  answer: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  document_id: string | null;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  read: boolean;
  due_date: string | null;
  created_at: string;
}

export interface DocumentWithRelations extends Document {
  document_files: DocumentFile[];
  document_metadata: DocumentMetadata | null;
  document_tags: { tag_id: string; tags: Tag }[];
}
