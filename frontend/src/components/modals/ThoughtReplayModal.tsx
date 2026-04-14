'use client';
import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { type ReplayEntry } from '@/hooks/useThoughtReplay';
import { getModelClass } from '@/store/thoughtStore';

const MODEL_COLORS: Record<string, string> = {
  kimi: 'text-blue-400 border-blue-500/20',
  ds: 'text-emerald-400 border-emerald-500/20',
  qw: 'text-violet-400 border-violet-500/20',
  fx: 'text-orange-400 border-orange-500/20',
  sys: 'text-slate-500 border-slate-500/20',
  usr: 'text-amber-400 border-amber-500/20',
};

interface Props {
  open: boolean;
  paragraphId: string | null;
  entries: ReplayEntry[];
  isLoading: boolean;
  onClose: () => void;
}

export default function ThoughtReplayModal({ open, paragraphId, entries, isLoading, onClose }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);

  // Animate entries in sequence
  useEffect(() => {
    if (!open) { setVisibleCount(0); return; }
    setVisibleCount(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= entries.length) clearInterval(interval);
    }, 600);
    return () => clearInterval(interval);
  }, [open, entries]);

  const exportMd = () => {
    const lines = entries.map((e) =>
      `## ${e.model} — ${e.role}\n_${new Date(e.timestamp).toISOString()}_\n\n${e.content}${e.citation ? `\n\n> ↳ ${e.citation}` : ''}`
    );
    const blob = new Blob([`# Thought Replay — Paragraph ${paragraphId?.slice(0, 8)}\n\n${lines.join('\n\n---\n\n')}`], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `thought-replay-${paragraphId?.slice(0, 8)}.md`;
    a.click();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            className="bg-[#111420] border border-[var(--sidebar-border)] rounded-2xl w-full max-w-lg max-h-[75vh] flex flex-col overflow-hidden shadow-panel"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sidebar-border)] flex-shrink-0">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-amber-400 mb-0.5">Thought Replay</div>
                <div className="font-mono text-[9px] text-slate-600">Paragraph {paragraphId?.slice(0, 8)}…</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportMd}
                  className="font-mono text-[9px] px-2.5 py-1 bg-white/5 border border-white/10 text-slate-400 rounded-md hover:bg-white/10 transition-colors"
                >
                  ↓ Export .md
                </button>
                <Dialog.Close className="text-slate-600 hover:text-slate-400 text-sm leading-none">✕</Dialog.Close>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-0.5 bg-white/5 flex-shrink-0">
              <div
                className="h-full bg-amber-400 transition-all duration-500"
                style={{ width: entries.length ? `${(visibleCount / entries.length) * 100}%` : '0%' }}
              />
            </div>

            {/* Entries */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {isLoading && (
                <div className="font-mono text-[9.5px] text-slate-600 text-center py-8">Loading reasoning chain…</div>
              )}
              {!isLoading && entries.length === 0 && (
                <div className="font-mono text-[9.5px] text-slate-600 text-center py-8">No recorded reasoning for this paragraph yet.</div>
              )}
              <AnimatePresence>
                {entries.slice(0, visibleCount).map((entry, i) => {
                  const cls = getModelClass(entry.model);
                  return (
                    <motion.div
                      key={entry.id}
                      className={`p-2.5 rounded-lg border bg-white/[0.025] ${MODEL_COLORS[cls]}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0 }}
                    >
                      <div className={`font-mono text-[8.5px] uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1.5 ${MODEL_COLORS[cls].split(' ')[0]}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {entry.model} · {entry.role}
                        <span className="ml-auto text-slate-700 normal-case">
                          {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                        </span>
                        {entry.source === 'sidecar' && (
                          <span className="px-1 py-0.5 bg-amber-400/10 text-amber-400 text-[7.5px] rounded border border-amber-400/20">sidecar</span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 leading-relaxed">{entry.content}</div>
                      {entry.citation && (
                        <div className="mt-1.5 font-mono text-[9px] text-slate-600 border-l-2 border-amber-400 pl-2">
                          ↳ {entry.citation}
                        </div>
                      )}
                      {entry.confidence !== undefined && entry.confidence < 1 && (
                        <div className="mt-1 font-mono text-[8.5px] text-slate-700">
                          Confidence: {Math.round(entry.confidence * 100)}%
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
