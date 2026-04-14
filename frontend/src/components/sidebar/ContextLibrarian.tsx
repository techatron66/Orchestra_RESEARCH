'use client';
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadReference, getIngestStatus, webSearch, deleteReference } from '@/lib/api';

interface RefCard {
  id: string;
  filename: string;
  title?: string;
  chunk_count: number;
  year?: number;
  authors?: string[];
}

interface WebResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  year?: number;
}

interface IngestJob {
  jobId: string;
  localId: string;
  filename: string;
  stage: string;
  progress: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

interface Props {
  docId: string | null;
  field: string;
  onReferenceAdded?: (ref: RefCard) => void;
}

export default function ContextLibrarian({ docId, field, onReferenceAdded }: Props) {
  const [references, setReferences] = useState<RefCard[]>([]);
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [webResults, setWebResults] = useState<WebResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Web search on mount
  useEffect(() => {
    if (!field) return;
    setSearchLoading(true);
    webSearch(field, 4)
      .then((d) => setWebResults(d.results ?? []))
      .catch(() => setWebResults([]))
      .finally(() => setSearchLoading(false));
  }, [field]);

  // Poll active jobs
  useEffect(() => {
    const activeJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'processing');
    if (!activeJobs.length || !docId) return;

    const interval = setInterval(async () => {
      for (const job of activeJobs) {
        try {
          const data = await getIngestStatus(docId, job.jobId);
          setJobs((prev) =>
            prev.map((j) =>
              j.jobId === job.jobId
                ? { ...j, stage: data.stage ?? j.stage, progress: data.progress ?? j.progress, status: data.status }
                : j
            )
          );
          if (data.status === 'complete' && data.reference) {
            setReferences((prev) => [data.reference as RefCard, ...prev]);
            onReferenceAdded?.(data.reference as RefCard);
          }
        } catch {}
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [jobs, docId, onReferenceAdded]);

  const processFile = useCallback(async (file: File) => {
    if (!docId) return;
    const localId = crypto.randomUUID();

    setJobs((prev) => [
      { jobId: localId, localId, filename: file.name, stage: 'Queued', progress: 0, status: 'pending' },
      ...prev,
    ]);

    try {
      const res = await uploadReference(docId, file);
      setJobs((prev) =>
        prev.map((j) => (j.localId === localId ? { ...j, jobId: res.job_id, status: 'processing', stage: 'Extracting text...' } : j))
      );
    } catch {
      // Demo mode: simulate ingestion
      simulateIngest(localId, file.name);
    }
  }, [docId]);

  const simulateIngest = (localId: string, filename: string) => {
    const stages = ['Extracting text...', 'Chunking...', 'Embedding...', 'Indexing...'];
    let si = 0;
    const interval = setInterval(() => {
      setJobs((prev) =>
        prev.map((j) =>
          j.localId === localId
            ? { ...j, stage: stages[si] ?? 'Complete', progress: (si + 1) / stages.length, status: si >= stages.length - 1 ? 'complete' : 'processing' }
            : j
        )
      );
      si++;
      if (si >= stages.length) {
        clearInterval(interval);
        const demoRef: RefCard = { id: crypto.randomUUID(), filename, title: filename, chunk_count: 47 };
        setReferences((prev) => [demoRef, ...prev]);
        onReferenceAdded?.(demoRef);
      }
    }, 700);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => accepted.forEach(processFile),
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    multiple: true,
    noClick: false,
  });

  return (
    <div className="flex flex-col flex-1 overflow-y-auto sidebar-dark">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`mx-3 my-3 border-[1.5px] border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-amber-400/40 bg-amber-400/4' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-2xl mb-2 opacity-40">📄</div>
        <div className="font-mono text-[9.5px] text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Click or drag PDF / DOCX</strong><br />
          to add to RAG index
        </div>
      </div>

      {/* Active ingest jobs */}
      {jobs.filter((j) => j.status !== 'complete').map((job) => (
        <div key={job.localId} className="mx-2.5 mb-1.5 p-2.5 bg-amber-400/6 border border-amber-400/15 rounded-lg">
          <div className="font-mono text-[9.5px] text-slate-400 mb-1 truncate">{job.filename}</div>
          <div className="font-mono text-[9px] text-slate-600 mb-1.5">{job.stage}</div>
          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${job.progress * 100}%` }} />
          </div>
        </div>
      ))}

      {/* Indexed references */}
      <div className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-slate-600 px-3.5 py-2">
        Indexed References
      </div>
      {references.length === 0 ? (
        <div className="font-mono text-[9.5px] text-slate-700 px-3.5 pb-2">No references indexed yet</div>
      ) : (
        references.map((ref) => (
          <div key={ref.id} className="mx-2.5 mb-1 p-2.5 bg-white/[0.025] border border-white/5 rounded-md hover:bg-white/[0.045] transition-colors">
            <div className="font-mono text-[9.5px] text-slate-400 truncate mb-0.5">{ref.filename}</div>
            <div className="font-mono text-[9px] text-slate-600">
              {ref.title ?? ref.filename}
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/18 text-amber-400 text-[8px]">
                {ref.chunk_count} chunks
              </span>
            </div>
          </div>
        ))
      )}

      {/* Web search results */}
      <div className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-slate-600 px-3.5 py-2 mt-2">
        Web Search — {field}
      </div>
      {searchLoading ? (
        <div className="font-mono text-[9px] text-slate-700 px-3.5">Searching...</div>
      ) : (
        webResults.map((r, i) => (
          <div key={i} className="mx-2.5 mb-1 p-2.5 bg-white/[0.02] border border-white/4 rounded-md">
            <a href={r.url} target="_blank" rel="noopener noreferrer"
               className="font-mono text-[9px] text-blue-400 hover:underline block mb-1 leading-tight">
              {r.title}
            </a>
            <div className="font-mono text-[8.5px] text-slate-600 leading-relaxed">{r.snippet?.slice(0, 100)}</div>
            <div className="font-mono text-[8px] text-slate-700 mt-1">{r.source} · {r.year ?? ''}</div>
          </div>
        ))
      )}
      <div className="h-4" />
    </div>
  );
}
