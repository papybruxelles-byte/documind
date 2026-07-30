export type ReplyTone = 'official' | 'friendly' | 'amical';

export interface DocumentActionInsight {
  requiresResponse: boolean;
  deadline: string | null;
  recommendation: string;
}

const DATE = '(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}|\\d{4}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{1,2})';

export function inspectDocument(text: string): DocumentActionInsight {
  const deadlineMatch = text.match(new RegExp(`(?:due\\s+date|deadline|respond(?:\\s+by)?|reply(?:\\s+by)?|payment\\s+due|before)\\s*[:\\-]?\\s*${DATE}`, 'i'));
  const dateMatch = text.match(new RegExp(DATE));
  const requiresResponse = /\b(reply|respond|response required|action required|please (?:confirm|provide|send|pay)|rsvp|signature required)\b/i.test(text);
  const deadline = deadlineMatch?.[1] || deadlineMatch?.[2] || dateMatch?.[1] || null;
  const recommendation = requiresResponse
    ? deadline ? `Prepare and send a response before ${deadline}.` : 'Prepare a response and confirm the requested next step.'
    : deadline ? `Add ${deadline} to your calendar and review the document before then.` : 'No immediate response or deadline was detected; keep this document for reference.';
  return { requiresResponse, deadline, recommendation };
}

export function draftResponse(tone: ReplyTone, insight: DocumentActionInsight, title: string): string {
  const action = insight.requiresResponse ? 'I confirm that I have reviewed the document and will follow up as requested.' : 'Thank you for sharing this document. I have reviewed it.';
  const deadline = insight.deadline ? ` I will make sure to address this before ${insight.deadline}.` : '';
  if (tone === 'official') return `Subject: Re: ${title}\n\nDear Sir or Madam,\n\n${action}${deadline}\n\nKind regards,`;
  if (tone === 'amical') return `Hi,\n\nThanks for sending ${title}. ${action}${deadline}\n\nBest,`;
  return `Hello!\n\nThanks for sharing ${title}. ${action}${deadline}\n\nHave a great day!`;
}

export function downloadCalendarEvent(title: string, date: string | null, kind: 'reminder' | 'meeting' | 'payment') {
  const parsed = date ? new Date(date) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 9, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const format = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const label = kind === 'payment' ? 'Payment' : kind === 'meeting' ? 'Meeting' : 'Reminder';
  const content = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//DocuMind//EN\r\nBEGIN:VEVENT\r\nUID:${crypto.randomUUID()}\r\nDTSTAMP:${format(new Date())}\r\nDTSTART:${format(start)}\r\nDTEND:${format(end)}\r\nSUMMARY:${label}: ${title}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url; link.download = `${kind}-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`; link.click();
  URL.revokeObjectURL(url);
}
