import type { DocumentCategory } from '@/types/database';

export interface DocumentWorkflow {
  stages: readonly string[];
  initialStage: string;
  terminalStages: readonly string[];
  suggestedAction: string;
  deadlineLabel: string;
}

const DEFAULT_WORKFLOW: DocumentWorkflow = {
  stages: ['received', 'reviewed', 'assigned', 'in progress', 'closed', 'archived'],
  initialStage: 'received',
  terminalStages: ['closed', 'archived'],
  suggestedAction: 'Vérifier le document et l’assigner à un responsable.',
  deadlineLabel: 'Échéance',
};

const WORKFLOWS: Partial<Record<DocumentCategory, DocumentWorkflow>> = {
  Invoice: {
    stages: ['received', 'reviewed', 'approved', 'payment scheduled', 'paid', 'archived'],
    initialStage: 'received',
    terminalStages: ['paid', 'archived'],
    suggestedAction: 'Envoyer au service comptable pour approbation.',
    deadlineLabel: 'Échéance de paiement',
  },
  'Employment Contract': {
    stages: ['received', 'reviewed', 'assigned', 'signed', 'active', 'renewal', 'archived'],
    initialStage: 'received',
    terminalStages: ['archived'],
    suggestedAction: 'Assigner le contrat pour vérification juridique.',
    deadlineLabel: 'Date de renouvellement',
  },
  Insurance: {
    stages: ['received', 'reviewed', 'active', 'renewal due', 'renewed', 'archived'],
    initialStage: 'received',
    terminalStages: ['renewed', 'archived'],
    suggestedAction: 'Vérifier la couverture et programmer un rappel de renouvellement.',
    deadlineLabel: 'Expiration de la police',
  },
  'Medical Report': {
    stages: ['received', 'classified', 'restricted', 'assigned', 'reviewed', 'archived'],
    initialStage: 'received',
    terminalStages: ['archived'],
    suggestedAction: 'Restreindre l’accès et transmettre à une personne autorisée.',
    deadlineLabel: 'Date de vérification',
  },
};

export function getDocumentWorkflow(category: DocumentCategory): DocumentWorkflow {
  return WORKFLOWS[category] || DEFAULT_WORKFLOW;
}

export function workflowStatus(category: DocumentCategory, stage: string): 'pending' | 'in_progress' | 'closed' {
  const workflow = getDocumentWorkflow(category);
  if (workflow.terminalStages.includes(stage)) return 'closed';
  return stage === workflow.initialStage ? 'pending' : 'in_progress';
}

const STAGE_LABELS: Record<string, string> = {
  received: 'Reçue', reviewed: 'Vérifiée', approved: 'Approuvée',
  'payment scheduled': 'Paiement planifié', paid: 'Payée', archived: 'Archivée',
  assigned: 'Assignée', signed: 'Signée', active: 'Active', renewal: 'Renouvellement',
  classified: 'Classée', restricted: 'Accès restreint', 'in progress': 'En cours',
  closed: 'Clôturée', renewed: 'Renouvelée', 'renewal due': 'À renouveler',
};

export function workflowStageLabel(stage: string): string {
  return STAGE_LABELS[stage] || stage;
}
