'use client';
import { useState } from 'react';
import ThoughtStream from './ThoughtStream';
import ThoughtReplay from './ThoughtReplay';
import ContextLibrarian from './ContextLibrarian';
import { useThoughtReplay } from '@/hooks/useThoughtReplay';

interface Props {
  docId: string | null;
  field: string;
  onSendInstruction: (text: string, mention: string | null) => void;
}

export default function Sidebar({ docId, field, onSendInstruction }: Props) {
  const [tab, setTab] = useState(0);
  const { replayParagraphId, replayEntries, isLoading, replayFor, clearReplay } = useThoughtReplay();

  const tabs = ['Thought Stream', 'Context'];

  return (
    <div
      className="flex flex-col sidebar-dark"
      style={{
        width: 'var(--sidebar-w)',
        borderLeft: '1px solid var(--sidebar-border)',
        background: 'var(--sidebar-bg)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div className="flex flex-shrink-0 border-b border-[var(--sidebar-border)]">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 py-[10px] font-mono text-[9px] uppercase tracking-[0.07em] border-b-2 transition-all ${
              tab === i
                ? 'text-amber-400 border-amber-400'
                : 'text-slate-600 border-transparent hover:text-slate-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 0 && (
          <>
            <ThoughtStream
              onReplay={replayFor}
              onSendInstruction={onSendInstruction}
            />
            {/* Inline replay panel slides in below the thought stream */}
            <ThoughtReplay
              paragraphId={replayParagraphId}
              entries={replayEntries}
              isLoading={isLoading}
              onClose={clearReplay}
            />
          </>
        )}
        {tab === 1 && (
          <ContextLibrarian docId={docId} field={field} />
        )}
      </div>
    </div>
  );
}
