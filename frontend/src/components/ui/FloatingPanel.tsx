'use client';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

interface FloatingPanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  position?: 'bottom-right' | 'center';
}

export default function FloatingPanel({
  open, title, onClose, children, className, position = 'bottom-right',
}: FloatingPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const positionClass = position === 'bottom-right'
    ? 'fixed bottom-9 right-5 z-40'
    : 'fixed inset-0 z-40 flex items-center justify-center';

  return (
    <AnimatePresence>
      {open && (
        <div className={positionClass}>
          <motion.div
            ref={ref}
            className={cn(
              'bg-[#111420] border border-[var(--sidebar-border)] rounded-xl overflow-hidden',
              'shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
              className,
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--sidebar-border)]">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-amber-400">
                {title}
              </span>
              <button
                onClick={onClose}
                className="text-slate-600 hover:text-slate-400 text-sm leading-none transition-colors"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
