'use client';
import { useState, useRef, useCallback } from 'react';

const MODELS = [
  { mention: '@Kimi', label: 'Lead Synthesis', cls: 'text-blue-400' },
  { mention: '@DeepSeek', label: 'Scientific Auditor', cls: 'text-emerald-400' },
  { mention: '@Qwen', label: 'Logic Verifier', cls: 'text-violet-400' },
  { mention: '@Flux', label: 'Visual Designer', cls: 'text-orange-400' },
];

interface Props {
  onSend: (text: string, mention: string | null) => void;
  disabled?: boolean;
}

function extractMention(text: string): string | null {
  const m = text.match(/@(Kimi|DeepSeek|Qwen|Flux)/i);
  return m ? `@${m[1]}` : null;
}

export default function MentionInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const send = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const mention = extractMention(trimmed);
    onSend(trimmed, mention);
    setValue('');
    setShowDropdown(false);
  }, [value, onSend]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape') setShowDropdown(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    // Show dropdown when user types '@'
    const lastAt = v.lastIndexOf('@');
    setShowDropdown(lastAt !== -1 && lastAt === v.length - 1);
  };

  const insertMention = (mention: string) => {
    const withoutAt = value.endsWith('@') ? value.slice(0, -1) : value;
    setValue(withoutAt + mention + ' ');
    setShowDropdown(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="p-2.5 border-t border-[var(--sidebar-border)] flex-shrink-0">
      <div className="font-mono text-[8.5px] text-slate-600 mb-1.5 pl-0.5">
        Mention @Kimi @DeepSeek @Qwen @Flux to direct a model
      </div>

      {/* Mention dropdown */}
      {showDropdown && (
        <div className="mb-1.5 bg-[var(--sidebar-2)] border border-[var(--sidebar-border)] rounded-lg overflow-hidden">
          {MODELS.map((m) => (
            <button
              key={m.mention}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
              onMouseDown={(e) => { e.preventDefault(); insertMention(m.mention); }}
            >
              <span className={`font-mono text-[10px] font-semibold ${m.cls}`}>{m.mention}</span>
              <span className="font-mono text-[9px] text-slate-600">{m.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 bg-white/[0.04] border border-white/7 rounded-xl px-2.5 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          disabled={disabled}
          rows={1}
          placeholder="@DeepSeek audit §3.1 statistical claims..."
          className="flex-1 bg-transparent border-none outline-none font-mono text-[10.5px] text-slate-200 resize-none leading-[1.5] min-h-[18px] max-h-[76px] placeholder:text-slate-700 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={disabled || !value.trim()}
          className="w-6 h-6 rounded-md bg-amber-400 hover:bg-amber-500 flex items-center justify-center text-stone-900 text-xs flex-shrink-0 transition-colors disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}
