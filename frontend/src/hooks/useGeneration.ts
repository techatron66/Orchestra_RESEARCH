import { useCallback, useRef } from 'react';
import { useSSE } from './useSSE';
import { useDocumentStore } from '@/store/documentStore';
import { useThoughtStore } from '@/store/thoughtStore';

interface GenerationOptions {
  docId: string;
  section: string;
  instruction: string;
  contextParagraphs: string[];
  mentionOverride?: string | null;
  onDelta: (text: string, paragraphId: string) => void;
  onGhostComplete: (paragraphId: string, text: string, generatedBy: string) => void;
  onAborted: (partial: string, paragraphId: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}

export function useGeneration() {
  const { connect, abort: sseAbort } = useSSE();
  const { addEntry, addRaw, setGenerating, finishGenerating, abort: storeAbort } = useThoughtStore();
  const { addVerifiedClaim, addFlag, acceptGhost } = useDocumentStore();
  const requestIdRef = useRef<string | null>(null);

  const start = useCallback(async (opts: GenerationOptions) => {
    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    const controller = new AbortController();
    setGenerating(requestId, controller);

    addEntry({
      model: 'orchestrator',
      role: 'system',
      content: `Generation started for §${opts.section}. Request ID: ${requestId.slice(0, 8)}…`,
    });

    await connect(
      '/api/generate',
      {
        document_id: opts.docId,
        section: opts.section,
        instruction: opts.instruction,
        context_paragraphs: opts.contextParagraphs,
        mention_override: opts.mentionOverride ?? null,
        stream: true,
        request_id: requestId,
      },
      {
        onThought: (data) => addRaw(data),

        onDelta: (text, paragraphId) => opts.onDelta(text, paragraphId),

        onGhostComplete: (data) => {
          const paragraphId = data.paragraph_id as string;
          const text = data.text as string;
          const generatedBy = (data.generated_by as string) ?? 'kimi-k2.5';
          opts.onGhostComplete(paragraphId, text, generatedBy);
          addEntry({
            model: 'orchestrator',
            role: 'system',
            content: `Ghost draft ready — ${text.split(' ').length} words. Awaiting user review.`,
            paragraphId,
          });
        },

        onVerified: (data) => {
          addVerifiedClaim({
            claimId: data.claim_id as string,
            text: data.text as string,
            verifiedBy: data.verified_by as string,
            refId: data.ref_id as string,
            chunkIndex: data.chunk_index as number,
            confidence: data.confidence as number,
            paragraphId: data.paragraph_id as string,
          });
        },

        onFlagged: (data) => {
          addFlag({
            flagId: data.flag_id as string,
            sentence: data.sentence as string,
            issue: data.issue as string,
            severity: data.severity as 'low' | 'medium' | 'high',
            paragraphId: data.paragraph_id as string,
          });
        },

        onAborted: (data) => {
          finishGenerating();
          opts.onAborted(
            (data.partial as string) ?? '',
            (data.paragraph_id as string) ?? '',
          );
        },

        onDone: () => {
          finishGenerating();
          opts.onDone();
        },

        onError: (msg) => {
          finishGenerating();
          opts.onError(msg);
        },
      },
      controller.signal,
    );

    finishGenerating();
  }, [connect, addEntry, addRaw, setGenerating, finishGenerating, addVerifiedClaim, addFlag]);

  const stop = useCallback(async () => {
    sseAbort();
    await storeAbort();
  }, [sseAbort, storeAbort]);

  return { start, stop };
}
