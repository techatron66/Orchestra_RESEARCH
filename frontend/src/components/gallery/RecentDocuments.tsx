'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TEMPLATES } from '@/lib/templates';

interface RecentDoc {
  id: string;
  title: string;
  template: string;
  ts: number;
}

export default function RecentDocuments() {
  const [docs, setDocs] = useState<RecentDoc[]>([]);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('orchestra_recent') ?? '[]';
      setDocs(JSON.parse(raw).slice(0, 6));
    } catch {}
  }, []);

  if (!docs.length) {
    return (
      <>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-3)] mb-3">
          Recent Documents
        </div>
        <p className="font-serif text-lg italic text-[var(--text-3)] text-center py-6">
          Your research begins here.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-3)] mb-3">
        Recent Documents
      </div>
      <div className="flex flex-col gap-2">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-2.5 bg-white border border-black/6 rounded-lg cursor-pointer hover:border-black/12 hover:shadow-sm transition-all"
            onClick={() => router.push(`/doc/${doc.id}?template=${doc.template}`)}
          >
            <span className="text-base">📄</span>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11px] text-[var(--text-1)] truncate">{doc.title}</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] mt-0.5">
                {(TEMPLATES[doc.template as keyof typeof TEMPLATES]?.badge ?? doc.template.toUpperCase())} ·{' '}
                {new Date(doc.ts).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
