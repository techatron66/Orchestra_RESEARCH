'use client';
import { useEffect, useRef } from 'react';
import { useThoughtStore } from '@/store/thoughtStore';
import ThoughtEntryComponent from './ThoughtEntry';
import MentionInput from './MentionInput';

interface Props {
  onReplay: (paragraphId: string) => void;
  onSendInstruction: (text: string, mention: string | null) => void;
}

export default function ThoughtStream({ onReplay, onSendInstruction }: Props) {
  const { entries, isGenerating } = useThoughtStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden sidebar-dark">
      {/* Stream */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
        {entries.length === 0 && (
          <div className="font-mono text-[9.5px] text-slate-600 text-center py-8 px-4 leading-relaxed">
            Session not started. Click <strong className="text-slate-500">✦ Generate</strong> or type an instruction below.
          </div>
        )}
        {entries.map((entry) => (
          <ThoughtEntryComponent
            key={entry.id}
            entry={entry}
            onReplay={entry.paragraphId ? onReplay : undefined}
          />
        ))}
        {isGenerating && (
          <div className="flex items-center gap-1.5 px-3 py-2 font-mono text-[9.5px] text-amber-400">
            <span className="font-semibold">Generating</span>
            <span className="flex gap-1 ml-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-amber-400"
                  style={{ animation: `tdot 1.2s ${i * 0.2}s infinite` }}
                />
              ))}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MentionInput onSend={onSendInstruction} disabled={isGenerating} />
    </div>
  );
}
