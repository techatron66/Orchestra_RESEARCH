import { create } from 'zustand';

export interface ClaimMeta {
  claimId: string;
  text: string;
  verifiedBy: string;
  refId: string;
  chunkIndex: number;
  confidence: number;
  paragraphId: string;
}

export interface FlagMeta {
  flagId: string;
  sentence: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  paragraphId: string;
}

export interface CitationMeta {
  citationId: string;
  refId: string;
  claimText: string;
  chunkIndex: number;
  paragraphId: string;
}

export interface DocumentState {
  id: string | null;
  title: string;
  template: string;
  content: Record<string, unknown>;
  ghostParagraphs: Record<string, { text: string; generatedBy: string }>;
  verifiedClaims: Record<string, ClaimMeta>;
  unverifiedFlags: Record<string, FlagMeta>;
  citations: Record<string, CitationMeta>;
  paragraphThoughts: Record<string, string[]>;
  isDirty: boolean;
  lastSaved: Date | null;

  // Actions
  setDocument: (id: string, title: string, template: string) => void;
  setTitle: (title: string) => void;
  setContent: (content: Record<string, unknown>) => void;
  addGhost: (paragraphId: string, text: string, generatedBy: string) => void;
  acceptGhost: (paragraphId: string) => void;
  rejectGhost: (paragraphId: string) => void;
  addVerifiedClaim: (claim: ClaimMeta) => void;
  addFlag: (flag: FlagMeta) => void;
  addCitation: (citation: CitationMeta) => void;
  removeCitation: (citationId: string) => void;
  linkThoughtToParagraph: (paragraphId: string, thoughtId: string) => void;
  markSaved: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  id: null,
  title: 'Untitled Research',
  template: 'blank',
  content: {},
  ghostParagraphs: {},
  verifiedClaims: {},
  unverifiedFlags: {},
  citations: {},
  paragraphThoughts: {},
  isDirty: false,
  lastSaved: null,

  setDocument: (id, title, template) =>
    set({ id, title, template, isDirty: false, lastSaved: null }),

  setTitle: (title) => set({ title, isDirty: true }),

  setContent: (content) => set({ content, isDirty: true }),

  addGhost: (paragraphId, text, generatedBy) =>
    set((s) => ({
      ghostParagraphs: { ...s.ghostParagraphs, [paragraphId]: { text, generatedBy } },
    })),

  acceptGhost: (paragraphId) =>
    set((s) => {
      const { [paragraphId]: _, ...rest } = s.ghostParagraphs;
      return { ghostParagraphs: rest, isDirty: true };
    }),

  rejectGhost: (paragraphId) =>
    set((s) => {
      const { [paragraphId]: _, ...rest } = s.ghostParagraphs;
      return { ghostParagraphs: rest };
    }),

  addVerifiedClaim: (claim) =>
    set((s) => ({
      verifiedClaims: { ...s.verifiedClaims, [claim.claimId]: claim },
    })),

  addFlag: (flag) =>
    set((s) => ({
      unverifiedFlags: { ...s.unverifiedFlags, [flag.flagId]: flag },
    })),

  addCitation: (citation) =>
    set((s) => ({
      citations: { ...s.citations, [citation.citationId]: citation },
      isDirty: true,
    })),

  removeCitation: (citationId) =>
    set((s) => {
      const { [citationId]: removed, ...rest } = s.citations;
      const flags = { ...s.unverifiedFlags };
      if (removed) {
        flags[`removed-${citationId}`] = {
          flagId: `removed-${citationId}`,
          sentence: removed.claimText,
          issue: `Citation removed: ${removed.claimText.slice(0, 60)}`,
          severity: 'medium',
          paragraphId: removed.paragraphId,
        };
      }
      return { citations: rest, unverifiedFlags: flags, isDirty: true };
    }),

  linkThoughtToParagraph: (paragraphId, thoughtId) =>
    set((s) => ({
      paragraphThoughts: {
        ...s.paragraphThoughts,
        [paragraphId]: [...(s.paragraphThoughts[paragraphId] || []), thoughtId],
      },
    })),

  markSaved: () => set({ isDirty: false, lastSaved: new Date() }),
}));
