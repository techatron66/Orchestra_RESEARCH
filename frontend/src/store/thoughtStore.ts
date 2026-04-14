import { create } from 'zustand';
import { abortGeneration } from '@/lib/api';

export interface ThoughtEntry {
  id: string;
  timestamp: Date;
  model: string;
  role: string;
  content: string;
  citation?: string | null;
  paragraphId?: string | null;
  confidence: number;
}

export type ModelClass = 'kimi' | 'ds' | 'qw' | 'fx' | 'sys' | 'usr';

export function getModelClass(model: string): ModelClass {
  if (model.includes('kimi') || model.includes('glm')) return 'kimi';
  if (model.includes('deep')) return 'ds';
  if (model.includes('qwen')) return 'qw';
  if (model.includes('flux')) return 'fx';
  if (model === 'user') return 'usr';
  return 'sys';
}

interface ThoughtState {
  entries: ThoughtEntry[];
  activeRequestId: string | null;
  isGenerating: boolean;
  abortController: AbortController | null;

  addEntry: (entry: Omit<ThoughtEntry, 'id' | 'timestamp'>) => ThoughtEntry;
  addRaw: (raw: Record<string, unknown>) => void;
  clearEntries: () => void;
  setGenerating: (requestId: string, controller: AbortController) => void;
  finishGenerating: () => void;
  abort: () => Promise<void>;
}

let _idCounter = 0;
function nextId() { return `thought-${Date.now()}-${++_idCounter}`; }

export const useThoughtStore = create<ThoughtState>((set, get) => ({
  entries: [],
  activeRequestId: null,
  isGenerating: false,
  abortController: null,

  addEntry: (entry) => {
    const full: ThoughtEntry = {
      id: nextId(),
      timestamp: new Date(),
      confidence: 1.0,
      ...entry,
    };
    set((s) => ({ entries: [...s.entries, full] }));
    return full;
  },

  addRaw: (raw) => {
    const full: ThoughtEntry = {
      id: raw.id as string || nextId(),
      timestamp: raw.timestamp ? new Date(raw.timestamp as string) : new Date(),
      model: (raw.model as string) || 'orchestrator',
      role: (raw.role as string) || 'system',
      content: (raw.content as string) || '',
      citation: raw.citation as string | null,
      paragraphId: raw.paragraph_id as string | null,
      confidence: (raw.confidence as number) ?? 1.0,
    };
    set((s) => ({ entries: [...s.entries, full] }));
  },

  clearEntries: () => set({ entries: [] }),

  setGenerating: (requestId, controller) =>
    set({ activeRequestId: requestId, isGenerating: true, abortController: controller }),

  finishGenerating: () =>
    set({ isGenerating: false, abortController: null }),

  abort: async () => {
    const { activeRequestId, abortController } = get();
    if (abortController) abortController.abort();
    if (activeRequestId) {
      try { await abortGeneration(activeRequestId); } catch {}
    }
    set({ isGenerating: false, abortController: null });
  },
}));
