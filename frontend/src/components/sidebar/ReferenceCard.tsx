'use client';
import { useState } from 'react';
import { deleteReference } from '@/lib/api';

interface Props {
  refId: string;
  filename: string;
  title?: string;
  authors?: string[];
  year?: number;
  journal?: string;
  chunkCount: number;
  keyClaims?: string[];
  onDelete?: (refId: string) => void;
  onShowSource?: (refId: string, title: string) => void;
}

export default function ReferenceCard({
  refId, filename, title, authors, year, journal,
  chunkCount, keyClaims = [], onDelete, onShowSource,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove "${filename}" from the RAG index?`)) return;
    setDeleting(true);
    try {
      await deleteReference(refId);
      onDelete?.(refId);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div
      className="mx-[10px] mb-[3px] rounded-md border transition-all cursor-pointer"
      style={{
        background: 'rgba(255,255,255,.025)',
        borderColor: 'rgba(255,255,255,.06)',
        opacity: deleting ? 0.4 : 1,
      }}
      onClick={() => setExpanded((v) => !v)}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.048)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'; }}
    >
      {/* Header row */}
      <div className="p-[9px_12px] flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[9.5px] text-slate-400 truncate mb-[3px]">{filename}</div>
          <div className="font-mono text-[9px] text-slate-600 flex items-center gap-2 flex-wrap">
            <span>{title || filename}</span>
            <span
              className="px-[5px] py-[1px] rounded-full border text-[8px]"
              style={{ background: 'rgba(240,152,10,.1)', borderColor: 'rgba(240,152,10,.18)', color: '#f0980a' }}
            >
              {chunkCount} chunks
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onShowSource && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowSource(refId, title || filename); }}
              className="font-mono text-[8.5px] text-slate-600 hover:text-slate-400 transition-colors"
              title="View source"
            >
              ↗
            </button>
          )}
          <button
            onClick={handleDelete}
            className="font-mono text-[8.5px] text-slate-700 hover:text-red-400 transition-colors"
            title="Remove from index"
          >
            ×
          </button>
          <span className="text-slate-700 text-[9px]">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-white/5">
          <div className="pt-2 space-y-[5px]">
            {authors && authors.length > 0 && (
              <div className="font-mono text-[8.5px] text-slate-600">
                <span className="text-slate-700">Authors: </span>
                {authors.slice(0, 3).join(', ')}{authors.length > 3 ? ' et al.' : ''}
              </div>
            )}
            {journal && (
              <div className="font-mono text-[8.5px] text-slate-600">
                <span className="text-slate-700">Journal: </span>{journal}{year ? ` (${year})` : ''}
              </div>
            )}
            {keyClaims.length > 0 && (
              <div>
                <div className="font-mono text-[8px] text-slate-700 uppercase tracking-wider mb-1">Key Claims</div>
                {keyClaims.slice(0, 3).map((claim, i) => (
                  <div key={i} className="font-mono text-[8.5px] text-slate-500 leading-relaxed mb-1 pl-2 border-l border-amber-400/30">
                    {claim.slice(0, 120)}{claim.length > 120 ? '…' : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
