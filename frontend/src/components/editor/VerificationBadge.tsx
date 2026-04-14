'use client';
import { cn } from '@/lib/cn';

type VerifyStatus = 'ok' | 'warn' | 'err';

const styles: Record<VerifyStatus, string> = {
  ok:   'bg-green-50 border-green-300 text-green-700',
  warn: 'bg-amber-50 border-amber-300 text-amber-700',
  err:  'bg-red-50 border-red-300 text-red-700',
};

const labels: Record<VerifyStatus, string> = { ok: '✓', warn: '?', err: '!' };

interface Props {
  status: VerifyStatus;
  tooltip?: string;
  onClick?: () => void;
  className?: string;
}

export default function VerificationBadge({ status, tooltip, onClick, className }: Props) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={tooltip}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={cn(
        'inline-flex items-center justify-center',
        'w-3 h-3 rounded-full border cursor-pointer',
        'font-mono font-bold text-[7.5px]',
        'vertical-align-super align-super ml-px',
        'transition-transform hover:scale-125',
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
