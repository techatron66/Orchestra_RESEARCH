'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

import EditorCanvas from '@/components/editor/EditorCanvas';
import EditorToolbar from '@/components/editor/EditorToolbar';
import DocumentOutline from '@/components/editor/DocumentOutline';
import Sidebar from '@/components/sidebar/Sidebar';
import StopPivotDialog from '@/components/modals/StopPivotDialog';
import InstructionLedger from '@/components/modals/InstructionLedger';
import ThoughtReplayModal from '@/components/modals/ThoughtReplayModal';
import FloatingPanel from '@/components/ui/FloatingPanel';

import { useGeneration } from '@/hooks/useGeneration';
import { useScrutinyMode } from '@/hooks/useScrutinyMode';
import { useThoughtReplay } from '@/hooks/useThoughtReplay';
import { useDocumentStore } from '@/store/documentStore';
import { useThoughtStore } from '@/store/thoughtStore';
import { useConfigStore } from '@/store/configStore';
import { updateDocument } from '@/lib/api';
import { useEditor } from '@tiptap/react';

// Notification helper hook
function useNotif() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2800);
  }, []);
  return { msg, show, notify };
}

export default function DocPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const docId = params.id as string;
  const template = searchParams.get('template') ?? 'blank';

  // ── Stores ─────────────────────────────────────────
  const { title, setDocument, setTitle, ghostParagraphs, acceptGhost, rejectGhost } = useDocumentStore();
  const { addEntry, isGenerating } = useThoughtStore();
  const { config, fetchConfig, getLeadModel } = useConfigStore();

  // ── Local state ────────────────────────────────────
  const [wordCount, setWordCount] = useState(0);
  const [sectionCtx, setSectionCtx] = useState('Introduction');
  const [tokenCount, setTokenCount] = useState(0);
  const [pivotOpen, setPivotOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyData, setVerifyData] = useState({ title: '', src: '', quote: '' });

  const { msg: notifMsg, show: notifShow, notify } = useNotif();
  const { scrutinyOn, toggle: toggleScrutiny } = useScrutinyMode();
  const { replayParagraphId, replayEntries, isLoading: replayLoading, replayFor, clearReplay } = useThoughtReplay();

  // ── Editor + streaming refs ─────────────────────────
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const streamingRef = useRef<{
    pushDelta: (t: string, id: string) => void;
    finalizeGhost: (id: string, t: string, by: string) => void;
    clearGhost: (id: string) => void;
  } | null>(null);

  // ── Generation ─────────────────────────────────────
  const { start: startGen, stop: stopGen } = useGeneration();

  // ── Init ───────────────────────────────────────────
  useEffect(() => {
    setDocument(docId, 'Untitled Research', template);
    fetchConfig();

    addEntry({
      model: 'orchestrator', role: 'system',
      content: `Session initialized. Document: ${docId.slice(0, 8)}… Template: ${template.toUpperCase()}. Active model: ${getLeadModel().split('/').pop()}.`,
    });
    addEntry({
      model: 'kimi-k2.5', role: 'architect',
      content: 'Document structure analyzed. Ready to synthesize from RAG corpus. Invoke @Flux for figures or @DeepSeek for deep audit.',
    });

    // Restore title from localStorage
    try {
      const recent = JSON.parse(localStorage.getItem('orchestra_recent') ?? '[]');
      const rec = recent.find((r: { id: string }) => r.id === docId);
      if (rec) setTitle(rec.title);
    } catch {}
  }, [docId, template]); // eslint-disable-line

  // ── Auto-save ──────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (!editorRef.current) return;
      // Strip ghost marks before saving
      const content = editorRef.current.getJSON();
      updateDocument(docId, { content, title, word_count: wordCount }).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [docId, title, wordCount]);

  // ── Title update ───────────────────────────────────
  const handleTitleChange = (t: string) => {
    setTitle(t);
    try {
      const recent = JSON.parse(localStorage.getItem('orchestra_recent') ?? '[]');
      const updated = recent.map((r: { id: string; title: string }) =>
        r.id === docId ? { ...r, title: t } : r
      );
      localStorage.setItem('orchestra_recent', JSON.stringify(updated));
    } catch {}
  };

  // ── Generate ───────────────────────────────────────
  const handleGenerate = useCallback((instruction = '', mention: string | null = null) => {
    const instr = instruction || `Continue writing the ${sectionCtx} section with empirical evidence`;
    setTokenCount(0);

    startGen({
      docId,
      section: sectionCtx,
      instruction: instr,
      contextParagraphs: editorRef.current
        ? editorRef.current.getText().split('\n').filter(Boolean).slice(-3)
        : [],
      mentionOverride: mention,
      onDelta: (text, paragraphId) => {
        setTokenCount((n) => n + text.split(' ').length);
        streamingRef.current?.pushDelta(text, paragraphId);
      },
      onGhostComplete: (paragraphId, text, generatedBy) => {
        streamingRef.current?.finalizeGhost(paragraphId, text, generatedBy);
        notify('Generation complete — review draft below');
      },
      onAborted: (partial, paragraphId) => {
        if (partial) streamingRef.current?.finalizeGhost(paragraphId, partial, getLeadModel().split('/').pop() ?? 'kimi');
        setPivotOpen(true);
      },
      onDone: () => notify('Generation complete'),
      onError: (msg) => {
        notify(`Error: ${msg}`);
        addEntry({ model: 'orchestrator', role: 'system', content: `⚠ Generation error: ${msg}` });
      },
    });
  }, [docId, sectionCtx, startGen, notify, addEntry, getLeadModel]);

  // ── Stop ───────────────────────────────────────────
  const handleStop = useCallback(async () => {
    await stopGen();
    setPivotOpen(true);
  }, [stopGen]);

  // ── Pivot ──────────────────────────────────────────
  const handlePivot = useCallback((action: 'keep' | 'discard' | null) => {
    setPivotOpen(false);
    if (action === 'discard') {
      streamingRef.current?.clearGhost('');
      // Remove all ghost blocks in the canvas
      Object.keys(ghostParagraphs).forEach((id) => {
        streamingRef.current?.clearGhost(id);
        rejectGhost(id);
      });
      notify('Rolled back — regenerate when ready');
    } else if (action === 'keep') {
      notify('Partial output kept');
    }
  }, [ghostParagraphs, rejectGhost, notify]);

  // ── Sidebar instruction ────────────────────────────
  const handleSidebarInstruction = useCallback((text: string, mention: string | null) => {
    addEntry({ model: 'usr', role: 'user', content: text });
    handleGenerate(text, mention);
  }, [addEntry, handleGenerate]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--canvas)]">

      {/* Toolbar */}
      <EditorToolbar
        editor={editorRef.current}
        title={title}
        wordCount={wordCount}
        scrutinyOn={scrutinyOn}
        isGenerating={isGenerating}
        currentModel={getLeadModel()}
        onTitleChange={handleTitleChange}
        onGenerate={() => handleGenerate()}
        onStop={handleStop}
        onToggleScrutiny={() => { toggleScrutiny(); notify(scrutinyOn ? 'Scrutiny OFF' : 'Scrutiny ON — paragraphs colored by source'); }}
        onOpenSettings={() => setSettingsOpen(true)}
        onBack={() => router.push('/')}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Outline */}
        <DocumentOutline editor={editorRef.current} template={template} />

        {/* Editor scroll area */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-6">
          <EditorCanvas
            docId={docId}
            template={template}
            scrutinyOn={scrutinyOn}
            onWordCountChange={setWordCount}
            onParagraphSelect={setSectionCtx}
            editorRef={editorRef}
            streamingRef={streamingRef}
          />
        </div>

        {/* Sidebar */}
        <Sidebar
          docId={docId}
          field={config.project.field}
          onReplay={replayFor}
          onSendInstruction={handleSidebarInstruction}
        />
      </div>

      {/* Status bar */}
      <div className="h-[22px] flex items-center px-3.5 gap-3 border-t border-black/6 bg-[var(--canvas)] font-mono text-[9px] text-[var(--text-3)] flex-shrink-0">
        <span>{wordCount} words</span>
        <span className="text-black/15">•</span>
        <span>Active: {getLeadModel().split('/').pop()}</span>
        <span className="text-black/15">•</span>
        <span>RAG ready</span>
        <span className="text-black/15">•</span>
        <span>{isGenerating ? '⏳ Generating…' : 'Ready'}</span>
      </div>

      {/* Modals */}
      <StopPivotDialog
        open={pivotOpen}
        tokenCount={tokenCount}
        sectionName={sectionCtx}
        onPivot={(action) => {
          if (action) handlePivot(action);
          else setPivotOpen(false);
        }}
      />

      <InstructionLedger
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => notify('Configuration saved — agents will use new settings')}
      />

      <ThoughtReplayModal
        open={replayParagraphId !== null}
        paragraphId={replayParagraphId}
        entries={replayEntries}
        isLoading={replayLoading}
        onClose={clearReplay}
      />

      {/* Verification float panel */}
      <FloatingPanel
        open={verifyOpen}
        title={verifyData.title}
        onClose={() => setVerifyOpen(false)}
        className="w-80"
      >
        <div className="p-3.5">
          <div className="font-mono text-[9.5px] font-medium text-slate-400 mb-2">{verifyData.src}</div>
          <div className="font-serif text-[13px] text-slate-500 italic px-2.5 py-2 bg-amber-400/7 border-l-2 border-amber-400 rounded-r leading-relaxed">
            {verifyData.quote}
          </div>
        </div>
      </FloatingPanel>

      {/* Toast notification */}
      <div
        className={`fixed bottom-9 left-1/2 -translate-x-1/2 bg-[var(--text-1)] text-white px-4 py-2 rounded-lg font-mono text-[10.5px] shadow-lg z-50 transition-all duration-300 whitespace-nowrap pointer-events-none ${
          notifShow ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
      >
        {notifMsg}
      </div>
    </div>
  );
}
