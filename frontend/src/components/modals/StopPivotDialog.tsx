'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useThoughtStore } from '@/store/thoughtStore';
import { useConfigStore } from '@/store/configStore';

type PivotAction = 'keep' | 'discard' | null;

interface Props {
  open: boolean;
  tokenCount: number;
  sectionName: string;
  onPivot: (action: PivotAction, newModel?: string) => void;
}

const MODEL_OPTIONS = [
  { key: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'deepseek-ai/deepseek-v3.2', label: 'DeepSeek V3.2', cls: 'bg-green-50 border-green-200 text-green-700' },
  { key: 'qwen/qwen3.5-397b-a17b', label: 'Qwen 3.5', cls: 'bg-violet-50 border-violet-200 text-violet-700' },
];

export default function StopPivotDialog({ open, tokenCount, sectionName, onPivot }: Props) {
  const [showModels, setShowModels] = useState(false);
  const { addEntry } = useThoughtStore();
  const { updateConfig } = useConfigStore();

  const handlePivot = (action: PivotAction) => {
    setShowModels(false);
    onPivot(action);
    addEntry({
      model: 'orchestrator',
      role: 'system',
      content: action === 'keep'
        ? 'Keep & Continue selected. Partial output preserved at current cursor position.'
        : 'Discard & Regenerate selected. Rolling back to last stable checkpoint.',
    });
  };

  const handleModelSwitch = async (modelKey: string, label: string) => {
    await updateConfig({ models: { lead_synthesis: [modelKey] } } as never);
    addEntry({
      model: 'orchestrator',
      role: 'system',
      content: `Model switched to ${label}. Context window transferred. Previous state archived.`,
    });
    onPivot(null, modelKey);
    setShowModels(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onPivot(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/35 backdrop-blur-[4px] z-50" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            className="bg-white rounded-2xl p-7 w-[400px] shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
            initial={{ opacity: 0, scale: 0.86, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          >
            <Dialog.Title className="font-serif text-[22px] font-semibold text-[var(--text-1)] mb-1">
              Generation Stopped
            </Dialog.Title>
            <Dialog.Description className="font-mono text-[10px] text-[var(--text-2)] mb-6">
              Interrupted at §{sectionName} · {tokenCount} tokens produced
            </Dialog.Description>

            {/* Keep */}
            <button
              onClick={() => handlePivot('keep')}
              className="w-full flex items-start gap-3 p-3.5 border-[1.5px] border-black/8 rounded-xl hover:border-black/16 hover:shadow-sm hover:-translate-y-0.5 transition-all text-left mb-2"
            >
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-sm flex-shrink-0">📌</div>
              <div>
                <div className="font-mono text-[11px] font-medium text-[var(--text-1)] mb-0.5">Keep &amp; Continue</div>
                <div className="font-mono text-[9.5px] text-[var(--text-2)] leading-relaxed">Save partial output and resume later from this point</div>
              </div>
            </button>

            {/* Discard */}
            <button
              onClick={() => handlePivot('discard')}
              className="w-full flex items-start gap-3 p-3.5 border-[1.5px] border-black/8 rounded-xl hover:border-black/16 hover:shadow-sm hover:-translate-y-0.5 transition-all text-left mb-2"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-sm flex-shrink-0">🗑</div>
              <div>
                <div className="font-mono text-[11px] font-medium text-[var(--text-1)] mb-0.5">Discard &amp; Regenerate</div>
                <div className="font-mono text-[9.5px] text-[var(--text-2)] leading-relaxed">Roll back and retry with a different approach</div>
              </div>
            </button>

            {/* Switch Model */}
            <button
              onClick={() => setShowModels((v) => !v)}
              className="w-full flex items-start gap-3 p-3.5 border-[1.5px] border-black/8 rounded-xl hover:border-black/16 hover:shadow-sm hover:-translate-y-0.5 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm flex-shrink-0">🔀</div>
              <div className="flex-1">
                <div className="font-mono text-[11px] font-medium text-[var(--text-1)] mb-0.5">Switch Model</div>
                <div className="font-mono text-[9.5px] text-[var(--text-2)] leading-relaxed">Current model struggling — try another NIM</div>
                {showModels && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {MODEL_OPTIONS.map((m) => (
                      <button
                        key={m.key}
                        onClick={(e) => { e.stopPropagation(); handleModelSwitch(m.key, m.label); }}
                        className={`font-mono text-[9.5px] px-2.5 py-1 rounded-full border transition-opacity hover:opacity-70 ${m.cls}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </button>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
