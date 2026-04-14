'use client';
import { useState, useCallback } from 'react';
import { useThoughtStore, type ThoughtEntry } from '@/store/thoughtStore';
import { useDocumentStore } from '@/store/documentStore';
import { getInferencesForParagraph } from '@/lib/api';

export interface ReplayEntry {
  id: string;
  timestamp: Date;
  model: string;
  role: string;
  content: string;
  citation?: string | null;
  source: 'thought' | 'sidecar';
  confidence?: number;
}

export function useThoughtReplay() {
  const [replayParagraphId, setReplayParagraphId] = useState<string | null>(null);
  const [replayEntries, setReplayEntries] = useState<ReplayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { entries: allThoughts } = useThoughtStore();
  const { paragraphThoughts } = useDocumentStore();

  const replayFor = useCallback(async (paragraphId: string) => {
    setIsLoading(true);
    setReplayParagraphId(paragraphId);

    // 1. Get thought IDs linked to this paragraph
    const thoughtIds = new Set(paragraphThoughts[paragraphId] ?? []);

    // 2. Filter in-memory thoughts
    const matched: ReplayEntry[] = allThoughts
      .filter((t) => t.paragraphId === paragraphId || thoughtIds.has(t.id))
      .map((t) => ({
        id: t.id,
        timestamp: t.timestamp,
        model: t.model,
        role: t.role,
        content: t.content,
        citation: t.citation,
        source: 'thought' as const,
        confidence: t.confidence,
      }));

    // 3. Fetch sidecar inferences
    try {
      const inferences = await getInferencesForParagraph(paragraphId);
      for (const inf of inferences) {
        matched.push({
          id: inf.inference_id,
          timestamp: new Date(inf.timestamp),
          model: inf.verified_by ?? 'deepseek-v3.2',
          role: 'verifier',
          content: `Verified: "${inf.claim?.slice(0, 120)}"`,
          citation: inf.reference_filename ?? null,
          source: 'sidecar',
          confidence: inf.confidence,
        });
      }
    } catch {
      // sidecar unavailable — use only in-memory
    }

    // 4. Sort by timestamp
    matched.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    setReplayEntries(matched);
    setIsLoading(false);
  }, [allThoughts, paragraphThoughts]);

  const clearReplay = useCallback(() => {
    setReplayParagraphId(null);
    setReplayEntries([]);
  }, []);

  return { replayParagraphId, replayEntries, isLoading, replayFor, clearReplay };
}
