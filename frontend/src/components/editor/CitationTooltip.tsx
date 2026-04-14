'use client';
import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { getSourceChunk } from '@/lib/api';

interface Props {
  citationId: string;
  refId: string;
  chunkIndex: number;
  label: number;
  claimText: string;
}

export default function CitationTooltip({ citationId, refId, chunkIndex, label, claimText }: Props) {
  const [chunk, setChunk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadChunk = async () => {
    if (chunk !== null || !refId) return;
    setLoading(true);
    try {
      const data = await getSourceChunk(refId, chunkIndex);
      setChunk(data.text ?? '');
    } catch {
      setChunk('Source chunk unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover.Root onOpenChange={(open) => open && loadChunk()}>
      <Popover.Trigger asChild>
        <span className="citation-node cursor-pointer">[{label}]</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          className="z-50 w-72 bg-[#111420] border border-[var(--sidebar-border)] rounded-xl shadow-panel overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-[var(--sidebar-border)]">
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-amber-400 mb-1">
              Citation [{label}]
            </div>
            <div className="font-mono text-[9.5px] text-slate-400 leading-relaxed line-clamp-2">
              {claimText}
            </div>
          </div>
          <div className="px-3.5 py-3 max-h-40 overflow-y-auto">
            {loading && (
              <div className="font-mono text-[9px] text-slate-600">Loading source chunk…</div>
            )}
            {!loading && chunk !== null && (
              <div className="font-mono text-[9px] text-slate-500 leading-relaxed italic">
                "{chunk.slice(0, 300)}{chunk.length > 300 ? '…' : ''}"
              </div>
            )}
            {!loading && chunk === null && (
              <div className="font-mono text-[9px] text-slate-700">Click to load source text</div>
            )}
          </div>
          <Popover.Arrow className="fill-[#111420]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
