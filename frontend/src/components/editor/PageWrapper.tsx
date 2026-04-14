import { cn } from '@/lib/cn';

interface Props {
  pageNumber: number;
  children: React.ReactNode;
  className?: string;
}

export default function PageWrapper({ pageNumber, children, className }: Props) {
  return (
    <div
      className={cn(
        'w-full max-w-[720px] min-h-[1040px] bg-white relative rounded-sm',
        'shadow-page',
        'px-[88px] py-[80px]',
        className,
      )}
    >
      {children}
      <div className="absolute bottom-6 left-0 right-0 text-center font-mono text-[9px] text-[var(--text-3)]">
        {pageNumber}
      </div>
    </div>
  );
}
