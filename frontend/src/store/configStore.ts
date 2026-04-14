import { create } from 'zustand';
import { getConfig, updateConfig } from '@/lib/api';

export interface AppConfig {
  project: {
    title: string;
    target_journal: string;
    citation_standard: string;
    field: string;
  };
  tone: {
    profile: string;
    voice: string;
    density: string;
  };
  rigor: {
    level: number;
    require_citations: boolean;
    flag_unverified_claims: boolean;
    max_hallucination_score: number;
    peer_review_mode: boolean;
  };
  models: {
    lead_synthesis: string[];
    logic_verification: string[];
    visual_generation: string;
    metadata_extraction: string;
  };
  rag: {
    top_k: number;
    similarity_threshold: number;
    web_augmentation: boolean;
    auto_search_on_new_doc: boolean;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  project: { title: 'Untitled', target_journal: 'Nature', citation_standard: 'IEEE', field: 'Quantum Computing' },
  tone: { profile: 'Academic/Formal', voice: 'Third Person', density: 'High' },
  rigor: { level: 9, require_citations: true, flag_unverified_claims: true, max_hallucination_score: 0.05, peer_review_mode: true },
  models: { lead_synthesis: ['moonshotai/kimi-k2.5', 'z-ai/glm-5'], logic_verification: ['qwen/qwen3.5-397b-a17b', 'deepseek-ai/deepseek-v3.2'], visual_generation: 'black-forest-labs/flux.2-klein-4b', metadata_extraction: 'z-ai/glm-5' },
  rag: { top_k: 8, similarity_threshold: 0.72, web_augmentation: true, auto_search_on_new_doc: true },
};

interface ConfigState {
  config: AppConfig;
  isLoading: boolean;
  fetchConfig: () => Promise<void>;
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
  getLeadModel: () => string;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: DEFAULT_CONFIG,
  isLoading: false,

  fetchConfig: async () => {
    set({ isLoading: true });
    try {
      const cfg = await getConfig();
      set({ config: { ...DEFAULT_CONFIG, ...cfg } });
    } catch {
      // Use defaults silently if backend not available
    } finally {
      set({ isLoading: false });
    }
  },

  updateConfig: async (partial) => {
    const next = { ...get().config, ...partial };
    set({ config: next });
    try { await updateConfig(partial as Record<string, unknown>); } catch {}
  },

  getLeadModel: () => {
    const { config } = get();
    return config.models.lead_synthesis[0] || 'moonshotai/kimi-k2.5';
  },
}));
