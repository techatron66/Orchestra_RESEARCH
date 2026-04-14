'use client';
import type { Editor } from '@tiptap/react';
import { useThoughtStore } from '@/store/thoughtStore';
import { useConfigStore } from '@/store/configStore';

interface Props {
  editor: Editor | null;
  title: string;
  wordCount: number;
  scrutinyOn: boolean;
  isGenerating: boolean;
  currentModel: string;
  onTitleChange: (t: string) => void;
  onGenerate: () => void;
  onStop: () => void;
  onToggleScrutiny: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
}

const MODEL_BADGE: Record<string, string> = {
  kimi: 'bg-blue-50 border-blue-200 text-blue-700',
  ds: 'bg-green-50 border-green-200 text-green-700',
  qw: 'bg-violet-50 border-violet-200 text-violet-700',
};

function getModelCls(model: string): string {
  if (model.includes('kimi') || model.includes('glm')) return MODEL_BADGE.kimi;
  if (model.includes('deep')) return MODEL_BADGE.ds;
  return MODEL_BADGE.qw;
}

function getModelShort(model: string): string {
  return model.split('/').pop() ?? model;
}

export default function EditorToolbar({
  editor, title, wordCount, scrutinyOn, isGenerating,
  currentModel, onTitleChange, onGenerate, onStop,
  onToggleScrutiny, onOpenSettings, onBack,
}: Props) {
  const { isGenerating: storeGen } = useThoughtStore();
  const generating = isGenerating || storeGen;

  return (
    <div className="h-12 flex items-center px-3.5 gap-1.5 flex-shrink-0 border-b border-black/7 bg-[rgba(250,249,246,0.96)] backdrop-blur-md z-10">
      {/* Logo / back */}
      <button
        onClick={onBack}
        className="font-serif text-[18px] font-semibold text-[var(--text-1)] tracking-tight mr-1 cursor-pointer hover:opacity-70 transition-opacity"
        title="Back to Gallery"
      >
        Orchestra<span className="text-amber-600">◆</span>
      </button>

      <div className="w-px h-5 bg-black/8 mx-1" />

      {/* Doc title */}
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="flex-1 max-w-[260px] bg-transparent font-mono text-[11px] text-[var(--text-1)] px-2 py-1 rounded-md hover:bg-black/4 focus:bg-black/4 outline-none transition-colors"
      />

      <div className="w-px h-5 bg-black/8 mx-1" />

      {/* Scrutiny */}
      <button
        onClick={onToggleScrutiny}
        className={`h-7 px-2.5 rounded-md font-mono text-[10px] border transition-all flex items-center gap-1.5 ${
          scrutinyOn ? 'bg-[var(--text-1)] text-white border-transparent' : 'bg-white text-[var(--text-2)] border-black/9 hover:bg-stone-50'
        }`}
      >
        🌡 Scrutiny
      </button>

      {/* Generate / Stop */}
      {generating ? (
        <button
          onClick={onStop}
          className="h-7 px-2.5 rounded-md font-mono text-[10px] border bg-red-50 border-red-200 text-red-700 hover:bg-red-700 hover:text-white transition-all flex items-center gap-1.5"
        >
          ◼ Stop
        </button>
      ) : (
        <button
          onClick={onGenerate}
          className="h-7 px-2.5 rounded-md font-mono text-[10px] border bg-white border-black/9 text-[var(--text-2)] hover:bg-stone-50 transition-all flex items-center gap-1.5"
          style={{ animation: 'none' }}
        >
          ✦ Generate
        </button>
      )}

      <div className="w-px h-5 bg-black/8 mx-1" />

      {/* Model badge */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[9.5px] font-medium ${getModelCls(currentModel)}`}>
        <span
          className={`w-1.5 h-1.5 rounded-full bg-current ${generating ? 'animate-pulse' : ''}`}
        />
        {getModelShort(currentModel)}
      </div>

      <div className="flex-1" />

      {/* Word count */}
      <span className="font-mono text-[9.5px] text-[var(--text-3)]">{wordCount} words</span>

      <div className="w-px h-5 bg-black/8 mx-1" />

      {/* Action buttons */}
      <button
        onClick={onOpenSettings}
        className="h-7 px-2.5 rounded-md font-mono text-[10px] border bg-white border-black/9 text-[var(--text-2)] hover:bg-stone-50 transition-all"
      >
        ⚙ Settings
      </button>
      <button
        onClick={() => alert('Export — connect backend to enable')}
        className="h-7 px-2.5 rounded-md font-mono text-[10px] bg-[var(--text-1)] text-white border-none hover:bg-stone-800 transition-all"
      >
        ↓ Export
      </button>
    </div>
  );
}
