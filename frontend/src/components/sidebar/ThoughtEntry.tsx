'use client';
import { motion } from 'framer-motion';
import { type ThoughtEntry, getModelClass } from '@/store/thoughtStore';

const MODEL_COLORS: Record<string, string> = {
  kimi: 'text-blue-400',
  ds: 'text-emerald-400',
  qw: 'text-violet-400',
  fx: 'text-orange-400',
  sys: 'text-slate-500',
  usr: 'text-amber-400',
};

const ENTRY_BG: Record<string, string> = {
  kimi: 'bg-blue-500/7 border-blue-500/13',
  ds: 'bg-emerald-500/7 border-emerald-500/13',
  qw: 'bg-violet-500/7 border-violet-500/13',
  fx: 'bg-orange-500/7 border-orange-500/13',
  sys: 'bg-white/[0.025] border-white/5',
  usr: 'bg-amber-500/7 border-amber-500/13',
};

interface Props {
  entry: ThoughtEntry;
  onReplay?: (paragraphId: string) => void;
}

export default function ThoughtEntryComponent({ entry, onReplay }: Props) {
  const cls = getModelClass(entry.model);
  const time = entry.timestamp.toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <motion.div
      className={`rounded-lg px-3 py-2.5 border font-mono text-[10.5px] leading-[1.55] ${ENTRY_BG[cls]}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Tag row */}
      <div className={`flex items-center gap-1.5 text-[8.5px] uppercase tracking-[0.1em] mb-1.5 ${MODEL_COLORS[cls]}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
        <span className="font-semibold">{entry.role?.toUpperCase() ?? entry.model.toUpperCase()}</span>
        <span className="ml-auto text-slate-600 normal-case">{time}</span>
        {entry.paragraphId && onReplay && (
          <button
            className="ml-1 text-slate-600 hover:text-slate-400 transition-colors"
            title="Replay reasoning for this paragraph"
            onClick={() => onReplay(entry.paragraphId!)}
          >
            ↺
          </button>
        )}
      </div>

      {/* Content */}
      <div className="text-slate-400">{entry.content}</div>

      {/* Citation */}
      {entry.citation && (
        <div className="mt-1.5 px-2 py-1 bg-white/[0.03] border-l-2 border-amber-400 rounded-r text-[9px] text-slate-600">
          ↳ {entry.citation}
        </div>
      )}
    </motion.div>
  );
}
