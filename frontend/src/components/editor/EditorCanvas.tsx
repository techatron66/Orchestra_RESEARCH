'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';

import { GhostMark } from './extensions/GhostMark';
import { VerifiedMark } from './extensions/VerifiedMark';
import { CitationNode } from './extensions/CitationNode';
import { ScrutinyExtension } from './extensions/ScrutinyExtension';
import GhostOverlay from './GhostOverlay';
import { buildDefaultTiptapContent, type TemplateId } from '@/lib/templates';
import { useCitationPersistence } from '@/hooks/useCitationPersistence';
import { useDocumentStore } from '@/store/documentStore';
import { useThoughtStore } from '@/store/thoughtStore';
import { cn } from '@/lib/cn';

interface GhostBlock {
  paragraphId: string;
  text: string;
  generatedBy: string;
}

interface StreamingState {
  paragraphId: string;
  text: string;
}

interface Props {
  docId: string | null;
  template: string;
  scrutinyOn: boolean;
  onWordCountChange: (n: number) => void;
  onParagraphSelect: (sectionLabel: string) => void;
  // Exposed imperative refs for the parent
  editorRef?: React.MutableRefObject<ReturnType<typeof useEditor> | null>;
  streamingRef?: React.MutableRefObject<{
    pushDelta: (text: string, paragraphId: string) => void;
    finalizeGhost: (paragraphId: string, text: string, generatedBy: string) => void;
    clearGhost: (paragraphId: string) => void;
  } | null>;
}

export default function EditorCanvas({
  docId, template, scrutinyOn, onWordCountChange,
  onParagraphSelect, editorRef, streamingRef,
}: Props) {
  const { ghostParagraphs, acceptGhost: storeAccept, rejectGhost: storeReject, setContent } = useDocumentStore();
  const { addEntry } = useThoughtStore();

  const [ghosts, setGhosts] = useState<GhostBlock[]>([]);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const deltaBuffer = useRef('');
  const flushRaf = useRef<number | null>(null);

  // ── Editor setup ─────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Begin writing, or press ⌘K to invoke the AI…' }),
      Highlight,
      Typography,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link,
      Image,
      Color,
      TextStyle,
      GhostMark,
      VerifiedMark,
      CitationNode,
      ScrutinyExtension,
    ],
    editorProps: {
      attributes: { class: 'orchestra-editor focus:outline-none' },
    },
    onUpdate: ({ editor: e }) => {
      const text = e.getText();
      const wc = text.trim().split(/\s+/).filter(Boolean).length;
      onWordCountChange(wc);
      setContent(e.getJSON() as Record<string, unknown>);
    },
  });

  // Expose editor ref
  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // Toggle scrutiny decorations
  useEffect(() => {
    if (!editor) return;
    editor.commands.setScrutinyMode?.(scrutinyOn);
  }, [editor, scrutinyOn]);

  // Seed content from template on first mount
  useEffect(() => {
    if (!editor || !template) return;
    if (editor.isEmpty) {

      editor.commands.setContent(buildDefaultTiptapContent(template as TemplateId));
    }
  }, [editor, template]);

  // Citation persistence watcher
  useCitationPersistence(editor, docId);

  // ── Streaming API ─────────────────────────────────────
  const pushDelta = useCallback((text: string, paragraphId: string) => {
    deltaBuffer.current += text;
    setStreaming({ paragraphId, text: deltaBuffer.current });

    // Throttle DOM updates via RAF
    if (flushRaf.current) return;
    flushRaf.current = requestAnimationFrame(() => {
      flushRaf.current = null;
    });
  }, []);

  const finalizeGhost = useCallback((paragraphId: string, text: string, generatedBy: string) => {
    deltaBuffer.current = '';
    setStreaming(null);
    setGhosts((prev) => {
      if (prev.find((g) => g.paragraphId === paragraphId)) return prev;
      return [...prev, { paragraphId, text, generatedBy }];
    });
  }, []);

  const clearGhost = useCallback((paragraphId: string) => {
    setGhosts((prev) => prev.filter((g) => g.paragraphId !== paragraphId));
    deltaBuffer.current = '';
    setStreaming(null);
  }, []);

  // Expose streaming API to parent
  useEffect(() => {
    if (streamingRef) {
      streamingRef.current = { pushDelta, finalizeGhost, clearGhost };
    }
  }, [streamingRef, pushDelta, finalizeGhost, clearGhost]);

  // ── Ghost accept / reject ─────────────────────────────
  const handleAccept = useCallback((paragraphId: string) => {
    clearGhost(paragraphId);
    storeAccept(paragraphId);
    addEntry({
      model: 'kimi-k2.5', role: 'architect',
      content: 'Draft accepted. Paragraph incorporated into document. Updating citation cross-link map.',
    });
  }, [clearGhost, storeAccept, addEntry]);

  const handleReject = useCallback((paragraphId: string) => {
    clearGhost(paragraphId);
    storeReject(paragraphId);
    addEntry({
      model: 'orchestrator', role: 'system',
      content: 'Draft discarded. Document state rolled back to pre-generation checkpoint.',
    });
  }, [clearGhost, storeReject, addEntry]);

  // ── Keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'Enter' && ghosts.length > 0) {
        e.preventDefault();
        handleAccept(ghosts[0].paragraphId);
      }
      if (mod && e.key === 'Backspace' && ghosts.length > 0) {
        e.preventDefault();
        handleReject(ghosts[0].paragraphId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ghosts, handleAccept, handleReject]);

  // ── Unsaved ghosts navigation guard ──────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (ghosts.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [ghosts]);

  return (
    <div className={cn('flex flex-col items-center gap-6 w-full', scrutinyOn && 'scrutiny-on')}>

      {/* Heatmap legend */}
      {scrutinyOn && (
        <div className="w-full max-w-[720px] flex items-center gap-4 px-3.5 py-2 bg-white/90 border border-black/7 rounded-lg font-mono text-[9px] text-[var(--text-3)]">
          <span className="mr-1">Scrutiny View:</span>
          {[
            { color: 'rgba(37,99,235,0.4)', label: 'Original Draft' },
            { color: 'rgba(5,150,105,0.4)', label: 'RAG-Verified' },
            { color: 'rgba(220,38,38,0.4)', label: 'Needs Review' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Page */}
      <div className="w-full max-w-[720px] min-h-[1040px] bg-white shadow-page rounded-sm px-[88px] py-[80px] relative">

        {/* Tiptap content */}
        <EditorContent editor={editor} />

        {/* Live streaming delta */}
        {streaming && (
          <div
            className="mt-3 text-[14px] leading-[1.76] font-body"
            style={{
              color: 'rgba(37,99,235,0.65)',
              fontStyle: 'italic',
              borderLeft: '2px solid rgba(37,99,235,0.3)',
              paddingLeft: '9px',
              marginLeft: '-11px',
              borderRadius: '0 3px 3px 0',
            }}
          >
            {streaming.text}
            <span className="inline-flex gap-0.5 ml-1 align-middle">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-blue-400"
                  style={{ animation: `tdot 1.2s ${i * 0.2}s infinite` }}
                />
              ))}
            </span>
          </div>
        )}

        {/* Ghost paragraphs + overlays */}
        {ghosts.map((ghost) => (
          <div key={ghost.paragraphId} className="mt-3">
            <div
              className="text-[14px] leading-[1.76] font-body cursor-pointer"
              style={{
                color: 'rgba(37,99,235,0.65)',
                fontStyle: 'italic',
                borderBottom: '1px dashed rgba(37,99,235,0.35)',
              }}
              onClick={() => onParagraphSelect('AI Draft')}
            >
              {ghost.text}
            </div>
            <GhostOverlay
              paragraphId={ghost.paragraphId}
              generatedBy={ghost.generatedBy}
              visible={true}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          </div>
        ))}

        {/* Page number */}
        <div className="absolute bottom-6 left-0 right-0 text-center font-mono text-[9px] text-[var(--text-3)]">
          1
        </div>
      </div>
    </div>
  );
}
