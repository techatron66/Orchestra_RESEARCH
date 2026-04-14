'use client';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createDocument } from '@/lib/api';
import { TEMPLATES, type TemplateId } from '@/lib/templates';
import RecentDocuments from './RecentDocuments';

const BADGE_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-600',
};

function PreviewIEEE() {
  return (
    <div className="flex gap-2 h-full">
      {[0, 1].map((col) => (
        <div key={col} className="flex-1 flex flex-col gap-1">
          <div className="h-2 rounded bg-blue-200/60 w-full mb-1" />
          {[100, 75, 100, 50, 100, 75, 100].map((w, i) => (
            <div key={i} className="h-1 rounded bg-black/8" style={{ width: `${w}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PreviewNature() {
  return (
    <div className="flex flex-col gap-1.5 h-full">
      <div className="h-2.5 rounded bg-green-200/70 w-2/3 mx-auto mb-2" />
      {[100, 75, 100].map((w, i) => (
        <div key={i} className="h-1 rounded bg-black/8" style={{ width: `${w}%` }} />
      ))}
      <div className="h-8 rounded bg-green-100/60 my-1" />
      {[100, 60].map((w, i) => (
        <div key={i} className="h-1 rounded bg-black/8" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function PreviewAPA() {
  return (
    <div className="flex flex-col gap-2 h-full">
      {[100, 100, 75, 0, 100, 100, 100, 60].map((w, i) =>
        w === 0 ? (
          <div key={i} className="h-px bg-black/6" />
        ) : (
          <div key={i} className="h-1 rounded bg-black/8" style={{ width: `${w}%` }} />
        )
      )}
    </div>
  );
}

function PreviewBlank() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-14 h-16 border-2 border-black/12 rounded-sm" />
    </div>
  );
}

const PREVIEWS: Record<TemplateId, React.ReactNode> = {
  ieee: <PreviewIEEE />,
  nature: <PreviewNature />,
  apa: <PreviewAPA />,
  blank: <PreviewBlank />,
};

const PREVIEW_BG: Record<TemplateId, string> = {
  ieee: 'from-blue-50 to-blue-100/60',
  nature: 'from-green-50 to-green-100/60',
  apa: 'from-amber-50 to-amber-100/60',
  blank: 'from-stone-50 to-stone-100/40',
};

export default function TemplateGallery() {
  const router = useRouter();

  async function handleCreate(id: TemplateId) {
    try {
      const data = await createDocument(id, TEMPLATES[id].defaultTitle);
      router.push(`/doc/${data.id}?template=${id}`);
    } catch {
      // Backend not available — navigate with local UUID
      const localId = crypto.randomUUID();
      const recent = JSON.parse(localStorage.getItem('orchestra_recent') ?? '[]');
      recent.unshift({ id: localId, title: TEMPLATES[id].defaultTitle, template: id, ts: Date.now() });
      localStorage.setItem('orchestra_recent', JSON.stringify(recent.slice(0, 20)));
      router.push(`/doc/${localId}?template=${id}`);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel */}
      <div className="w-80 flex-shrink-0 bg-[var(--sidebar-bg)] flex flex-col justify-between p-12 border-r border-[var(--sidebar-border)]">
        <div>
          <div className="font-mono text-xs tracking-[0.25em] uppercase text-amber-400 mb-3">Orchestra</div>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] text-stone-100 tracking-tight">
            Research<br /><span className="text-amber-400">Studio</span>
          </h1>
          <p className="font-mono text-[10.5px] text-slate-500 leading-relaxed mt-5">
            Multi-agent AI authoring with<br />
            RAG verification, live debate,<br />
            and citation persistence.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-6">
            {['kimi-k2.5', 'deepseek-v3.2', 'qwen3.5', 'flux.2-klein'].map((m) => (
              <span key={m} className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-400">
                {m}
              </span>
            ))}
          </div>
        </div>
        <div className="font-mono text-[8.5px] text-slate-700 leading-relaxed">
          NVIDIA NIM · ChromaDB<br />FastAPI · Next.js · Tiptap
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto p-12 bg-[var(--canvas)]">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-3)] mb-5">
          Choose a Template
        </div>

        <div className="grid grid-cols-2 gap-4 mb-10">
          {(Object.values(TEMPLATES) as typeof TEMPLATES[TemplateId][]).map((tmpl) => (
            <motion.div
              key={tmpl.id}
              className="bg-white border border-black/7 rounded-xl overflow-hidden cursor-pointer shadow-page"
              whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              onClick={() => handleCreate(tmpl.id)}
            >
              <div className={`h-40 p-4 bg-gradient-to-br ${PREVIEW_BG[tmpl.id]}`}>
                {PREVIEWS[tmpl.id]}
              </div>
              <div className="p-3.5 border-t border-black/5">
                <div className="font-mono text-[11px] font-medium text-[var(--text-1)] mb-0.5">
                  {tmpl.name}
                </div>
                <div className="font-mono text-[9.5px] text-[var(--text-3)] mb-2">{tmpl.description}</div>
                <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full border ${BADGE_COLORS[tmpl.badgeColor]}`}>
                  {tmpl.badge}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <RecentDocuments />
      </div>
    </div>
  );
}
