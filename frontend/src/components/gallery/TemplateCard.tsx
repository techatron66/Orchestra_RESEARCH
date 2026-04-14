'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { TemplateDef } from '@/lib/templates';

const BADGE_COLORS: Record<string, string> = {
  blue:   'bg-blue-50 border-blue-200 text-blue-700',
  green:  'bg-green-50 border-green-200 text-green-700',
  amber:  'bg-amber-50 border-amber-200 text-amber-700',
  gray:   'bg-stone-50 border-stone-200 text-stone-600',
};

const PREVIEW_BG: Record<string, string> = {
  ieee:   'from-blue-50 to-blue-100/60',
  nature: 'from-green-50 to-green-100/60',
  apa:    'from-amber-50 to-amber-100/60',
  blank:  'from-stone-50 to-stone-100/40',
};

function PreviewIEEE() {
  return (
    <div className="flex gap-2 h-full">
      {[0, 1].map((c) => (
        <div key={c} className="flex-1 flex flex-col gap-1">
          <div className="h-[7px] rounded bg-blue-200/70 mb-1" />
          {[100, 75, 100, 55, 100, 75, 100].map((w, i) => (
            <div key={i} className="h-[3.5px] rounded" style={{ width: `${w}%`, background: 'rgba(0,0,0,.08)' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PreviewNature() {
  return (
    <div className="flex flex-col gap-[5px] h-full">
      <div className="h-2 rounded bg-green-200/70 w-3/5 mx-auto mb-1" />
      {[100, 75, 100].map((w, i) => (
        <div key={i} className="h-[3.5px] rounded" style={{ width: `${w}%`, background: 'rgba(0,0,0,.08)' }} />
      ))}
      <div className="h-8 rounded bg-green-100/60 my-1" />
      {[100, 60].map((w, i) => (
        <div key={i} className="h-[3.5px] rounded" style={{ width: `${w}%`, background: 'rgba(0,0,0,.08)' }} />
      ))}
    </div>
  );
}

function PreviewAPA() {
  return (
    <div className="flex flex-col gap-[6px] h-full">
      {[100, 100, 75, null, 100, 100, 100, 62].map((w, i) =>
        w === null ? (
          <div key={i} className="h-px bg-black/7" />
        ) : (
          <div key={i} className="h-[3.5px] rounded" style={{ width: `${w}%`, background: 'rgba(0,0,0,.08)' }} />
        )
      )}
    </div>
  );
}

function PreviewBlank() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-[52px] h-16 border-2 border-black/10 rounded-sm" />
    </div>
  );
}

const PREVIEWS: Record<string, React.ReactNode> = {
  ieee: <PreviewIEEE />,
  nature: <PreviewNature />,
  apa: <PreviewAPA />,
  blank: <PreviewBlank />,
};

interface Props {
  tmpl: TemplateDef;
  animationDelay?: number;
  onClick: () => void;
}

export default function TemplateCard({ tmpl, animationDelay = 0, onClick }: Props) {
  return (
    <motion.div
      onClick={onClick}
      className="bg-white border border-black/[0.07] rounded-[13px] overflow-hidden cursor-pointer"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay / 1000, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{
        y: -5,
        boxShadow: '0 16px 48px rgba(0,0,0,.12)',
        transition: { type: 'spring', stiffness: 400, damping: 28 },
      }}
    >
      {/* Preview area */}
      <div className={`h-[148px] p-4 bg-gradient-to-br ${PREVIEW_BG[tmpl.id]}`}>
        {PREVIEWS[tmpl.id]}
      </div>

      {/* Info */}
      <div className="p-[13px_16px] border-t border-black/[0.06]">
        <div className="font-mono text-[11px] font-medium text-[#17160d] mb-[3px]">{tmpl.name}</div>
        <div className="font-mono text-[9.5px] text-[#a39880] mb-2">{tmpl.description}</div>
        <span className={`font-mono text-[9px] px-[7px] py-[2px] rounded-full border font-medium ${BADGE_COLORS[tmpl.badgeColor]}`}>
          {tmpl.badge}
        </span>
      </div>
    </motion.div>
  );
}
