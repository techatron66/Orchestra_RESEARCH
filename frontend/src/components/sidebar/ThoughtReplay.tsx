'use client';
/**
 * ThoughtReplay — inline sidebar component that shows the reasoning chain
 * for a specific paragraph when the user clicks the ↺ replay button.
 *
 * Distinct from ThoughtReplayModal: this is a compact inline panel that
 * slides into the sidebar rather than opening a full modal overlay.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ReplayEntry } from '@/hooks/useThoughtReplay';
import { getModelClass } from '@/store/thoughtStore';

const MODEL_COLORS: Record<string, string> = {
  kimi: '#60a5fa',
  ds:   '#34d399',
  qw:   '#a78bfa',
  fx:   '#fb923c',
  sys:  '#4b5563',
  usr:  '#f0980a',
};

interface Props {
  paragraphId: string | null;
  entries: ReplayEntry[];
  isLoading: boolean;
  onClose: () => void;
}

export default function ThoughtReplay({ paragraphId, entries, isLoading, onClose }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);

  // Animate entries in sequence when the panel opens
  useEffect(() => {
    if (!paragraphId) { setVisibleCount(0); return; }
    setVisibleCount(0);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= entries.length) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, [paragraphId, entries.length]);

  const exportMd = () => {
    const lines = entries.map((e) =>
      `## ${e.model} — ${e.role}\n_${new Date(e.timestamp).toISOString()}_\n\n${e.content}${e.citation ? `\n\n> ↳ ${e.citation}` : ''}`
    );
    const blob = new Blob(
      [`# Thought Replay — §${paragraphId?.slice(0, 8)}\n\n${lines.join('\n\n---\n\n')}`],
      { type: 'text/markdown' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `thought-replay-${paragraphId?.slice(0, 8)}.md`;
    a.click();
  };

  return (
    <AnimatePresence>
      {paragraphId && (
        <motion.div
          key="replay-panel"
          className="border-t flex flex-col flex-shrink-0"
          style={{
            borderColor: 'rgba(255,255,255,.06)',
            maxHeight: 320,
            background: 'rgba(255,255,255,.015)',
          }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}
          >
            <div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-amber-400">
                Thought Replay
              </div>
              <div className="font-mono text-[8px] text-slate-600 mt-[1px]">
                §{paragraphId.slice(0, 8)}… · {entries.length} entries
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportMd}
                className="font-mono text-[8.5px] px-2 py-[3px] rounded border text-slate-500 hover:text-slate-300 transition-colors"
                style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.08)' }}
              >
                ↓ .md
              </button>
              <button
                onClick={onClose}
                className="font-mono text-[11px] text-slate-600 hover:text-slate-400 transition-colors leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 1, background: 'rgba(255,255,255,.04)', flexShrink: 0 }}>
            <div
              style={{
                height: '100%',
                background: '#f0980a',
                transition: 'width .5s',
                width: entries.length ? `${(visibleCount / entries.length) * 100}%` : '0%',
              }}
            />
          </div>

          {/* Entry list */}
          <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-[6px]">
            {isLoading && (
              <div className="font-mono text-[9px] text-slate-600 text-center py-4">
                Loading reasoning chain…
              </div>
            )}
            {!isLoading && entries.length === 0 && (
              <div className="font-mono text-[9px] text-slate-700 text-center py-4">
                No reasoning recorded for this paragraph.
              </div>
            )}
            <AnimatePresence>
              {entries.slice(0, visibleCount).map((entry) => {
                const cls = getModelClass(entry.model);
                const color = MODEL_COLORS[cls] || '#4b5563';
                return (
                  <motion.div
                    key={entry.id}
                    className={`rounded-lg px-[10px] py-[8px] border text-[10px] font-mono leading-[1.5]`}
                    style={{
                      background: `${color}08`,
                      borderColor: `${color}18`,
                      animation: 'none',
                    }}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-[5px] mb-[5px]">
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ color, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                        {entry.model} · {entry.role}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 8, color: '#374151' }}>
                        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                      {entry.source === 'sidecar' && (
                        <span style={{ fontSize: 7.5, padding: '1px 4px', borderRadius: 3, background: 'rgba(240,152,10,.1)', color: '#f0980a', border: '1px solid rgba(240,152,10,.2)' }}>
                          sidecar
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#94a3b8' }}>{entry.content}</div>
                    {entry.citation && (
                      <div style={{ marginTop: 4, paddingLeft: 7, borderLeft: '2px solid #f0980a', fontSize: 9, color: '#374151' }}>
                        ↳ {entry.citation}
                      </div>
                    )}
                    {entry.confidence !== undefined && entry.confidence < 1 && (
                      <div style={{ marginTop: 3, fontSize: 8.5, color: '#374151' }}>
                        Confidence: {Math.round(entry.confidence * 100)}%
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
