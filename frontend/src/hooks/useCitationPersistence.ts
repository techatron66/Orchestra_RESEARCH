'use client';
import { useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { useDocumentStore } from '@/store/documentStore';
import { useThoughtStore } from '@/store/thoughtStore';
import { removeCitation } from '@/lib/api';

/**
 * Watches Tiptap editor transactions.
 * On every transaction:
 *  1. Diffs CitationNode marks — removed citations → flag as unverified
 *  2. Diffs GhostMark — if ghost paragraph deleted → silently reject
 *  3. Calls backend to update sidecar
 */
export function useCitationPersistence(editor: Editor | null, docId: string | null) {
  const { removeCitation: removeFromStore, rejectGhost, citations } = useDocumentStore();
  const { addEntry } = useThoughtStore();

  useEffect(() => {
    if (!editor || !docId) return;

    const handler = ({ transaction }: { transaction: unknown }) => {
      const tr = transaction as { docChanged: boolean; before: unknown; doc: unknown };
      if (!tr.docChanged) return;

      const prevDoc = tr.before as { descendants: (fn: (node: unknown, pos: number) => void) => void };
      const nextDoc = tr.doc as { descendants: (fn: (node: unknown, pos: number) => void) => void };

      // Collect citation node IDs present in previous doc
      const prevCitationIds = new Set<string>();
      prevDoc.descendants((node: unknown) => {
        const n = node as { type: { name: string }; attrs: Record<string, unknown> };
        if (n.type?.name === 'citationNode') {
          prevCitationIds.add(n.attrs.citationId as string);
        }
      });

      // Collect citation node IDs present in next doc
      const nextCitationIds = new Set<string>();
      nextDoc.descendants((node: unknown) => {
        const n = node as { type: { name: string }; attrs: Record<string, unknown> };
        if (n.type?.name === 'citationNode') {
          nextCitationIds.add(n.attrs.citationId as string);
        }
      });

      // Find removed citations
      for (const citationId of prevCitationIds) {
        if (!nextCitationIds.has(citationId)) {
          const meta = citations[citationId];
          removeFromStore(citationId);

          // Notify sidecar
          removeCitation(docId, citationId).catch(() => {});

          // Add sidebar thought
          addEntry({
            model: 'orchestrator',
            role: 'system',
            content: `⚠ Citation removed: "${
              meta?.claimText?.slice(0, 60) ?? citationId
            }". Claim is now Unverified.`,
            paragraphId: meta?.paragraphId,
          });
        }
      }

      // Check for deleted ghost paragraphs
      const prevGhosts = new Set<string>();
      prevDoc.descendants((node: unknown) => {
        const n = node as { type: { name: string }; marks?: Array<{ type: { name: string }; attrs: Record<string, unknown> }> };
        if (n.marks) {
          for (const mark of n.marks) {
            if (mark.type?.name === 'ghostMark') {
              prevGhosts.add(mark.attrs.paragraphId as string);
            }
          }
        }
      });

      const nextGhosts = new Set<string>();
      nextDoc.descendants((node: unknown) => {
        const n = node as { type: { name: string }; marks?: Array<{ type: { name: string }; attrs: Record<string, unknown> }> };
        if (n.marks) {
          for (const mark of n.marks) {
            if (mark.type?.name === 'ghostMark') {
              nextGhosts.add(mark.attrs.paragraphId as string);
            }
          }
        }
      });

      for (const pId of prevGhosts) {
        if (!nextGhosts.has(pId)) {
          rejectGhost(pId);
        }
      }
    };

    editor.on('transaction', handler);
    return () => { editor.off('transaction', handler); };
  }, [editor, docId, citations, removeFromStore, rejectGhost, addEntry]);
}
