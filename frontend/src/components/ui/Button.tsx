import { cn } from '@/lib/cn';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md';
}

const variants = {
  default: 'bg-white border border-black/9 text-[var(--text-2)] hover:bg-stone-50 hover:text-[var(--text-1)]',
  primary: 'bg-[var(--text-1)] text-white border border-transparent hover:bg-stone-800',
  ghost: 'bg-transparent border-transparent text-[var(--text-2)] hover:bg-black/4',
  danger: 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-700 hover:text-white',
  outline: 'bg-transparent border border-black/12 text-[var(--text-2)] hover:bg-black/4',
};

const sizes = {
  xs: 'h-6 px-2 text-[9px]',
  sm: 'h-7 px-2.5 text-[10px]',
  md: 'h-8 px-3 text-[10.5px]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'sm', children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-mono transition-all',
        'disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
export default Button;
