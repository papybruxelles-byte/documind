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
    ? deadline ? `Préparez et envoyez une réponse avant le ${deadline}.` : 'Préparez une réponse et confirmez la prochaine étape demandée.'
    : deadline ? `Ajoutez le ${deadline} à votre calendrier et vérifiez le document avant cette date.` : 'Aucune réponse immédiate ni échéance n’a été détectée. Conservez ce document comme référence.';
  return { requiresResponse, deadline, recommendation };
}

export function draftResponse(tone: ReplyTone, insight: DocumentActionInsight, title: string): string {
  const action = insight.requiresResponse ? 'Je confirme avoir vérifié le document et je donnerai suite à la demande.' : 'Merci d’avoir partagé ce document. Je l’ai bien vérifié.';
  const deadline = insight.deadline ? ` Je m’assurerai de le traiter avant le ${insight.deadline}.` : '';
  if (tone === 'official') return `Objet : Réponse — ${title}\n\nMadame, Monsieur,\n\n${action}${deadline}\n\nCordialement,`;
  if (tone === 'amical') return `Bonjour,\n\nMerci pour l’envoi de « ${title} ». ${action}${deadline}\n\nBien à vous,`;
  return `Bonjour,\n\nMerci d’avoir partagé « ${title} ». ${action}${deadline}\n\nBonne journée !`;
}

export function downloadCalendarEvent(title: string, date: string | null, kind: 'reminder' | 'meeting' | 'payment') {
  const parsed = date ? new Date(date) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 9, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const format = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const label = kind === 'payment' ? 'Paiement' : kind === 'meeting' ? 'Réunion' : 'Rappel';
  const content = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Signataire Intelligent//FR\r\nBEGIN:VEVENT\r\nUID:${crypto.randomUUID()}\r\nDTSTAMP:${format(new Date())}\r\nDTSTART:${format(start)}\r\nDTEND:${format(end)}\r\nSUMMARY:${label}: ${title}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url; link.download = `${kind}-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`; link.click();
  URL.revokeObjectURL(url);
}
