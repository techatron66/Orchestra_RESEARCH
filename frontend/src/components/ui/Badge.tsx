import { cn } from '@/lib/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'gray';
  className?: string;
}

const variants = {
  blue:   'bg-blue-50 border-blue-200 text-blue-700',
  green:  'bg-green-50 border-green-200 text-green-700',
  amber:  'bg-amber-50 border-amber-200 text-amber-700',
  red:    'bg-red-50 border-red-200 text-red-700',
  violet: 'bg-violet-50 border-violet-200 text-violet-700',
  gray:   'bg-stone-50 border-stone-200 text-stone-600',
};

export default function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full border font-mono text-[9px] font-medium',
      variants[variant],
      className,
    )}>
      {children}
    </span>
  );
}
