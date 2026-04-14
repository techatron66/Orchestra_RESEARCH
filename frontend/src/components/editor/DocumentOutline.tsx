'use client';
import { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { cn } from '@/lib/cn';

interface OutlineItem {
  id: string;
  label: string;
  level: 1 | 2 | 3;
}

interface Props {
  editor: Editor | null;
  template: string;
}

export default function DocumentOutline({ editor, template }: Props) {
  const [items, setItems] = useState<OutlineItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // Derive outline from editor headings
  useEffect(() => {
    if (!editor) return;

    const extract = () => {
      const headings: OutlineItem[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'heading') {
          const text = node.textContent.trim();
          if (text) {
            headings.push({
              id: `h-${text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
              label: text,
              level: node.attrs.level as 1 | 2 | 3,
            });
          }
        }
      });
      setItems(headings);
    };

    extract();
    editor.on('update', extract);
    return () => editor.off('update', extract);
  }, [editor]);

  const scrollToHeading = (label: string, id: string) => {
    if (!editor) return;
    setActiveId(id);

    // Find the heading in the doc and set cursor there
    let found = false;
    editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (node.type.name === 'heading' && node.textContent.trim() === label) {
        editor.commands.setTextSelection(pos);
        editor.commands.scrollIntoView();
        found = true;
        return false;
      }
    });
  };

  const levelPadding = { 1: 'pl-3.5', 2: 'pl-6', 3: 'pl-8' };
  const levelSize = { 1: 'text-[10px]', 2: 'text-[9.5px]', 3: 'text-[9px]' };

  return (
    <div
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{ width: 'var(--outline-w)', borderRight: '1px solid rgba(0,0,0,0.06)', background: 'var(--canvas)' }}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-3)] px-3.5 py-3 border-b border-black/5 flex-shrink-0">
        Document Outline
      </div>
      <div className="flex-1 overflow-y-auto py-1.5">
        {items.length === 0 && (
          <div className="font-mono text-[9px] text-[var(--text-3)] px-3.5 py-3 italic">
            No headings yet
          </div>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollToHeading(item.label, item.id)}
            className={cn(
              'w-full text-left py-1.5 font-mono leading-[1.35] transition-all',
              'border-l-2',
              levelPadding[item.level],
              levelSize[item.level],
              activeId === item.id
                ? 'text-blue-600 border-l-blue-500 bg-blue-500/4'
                : 'text-[var(--text-2)] border-transparent hover:text-[var(--text-1)] hover:bg-black/[0.025]',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
