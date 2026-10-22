import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20',
        cheerAmber:
          'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25',
        cheerEmerald:
          'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25',
        cheerIndigo:
          'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/25',
        secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200',
        outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        ghost: 'text-slate-700 hover:bg-slate-100',
      },
      size: {
        sm: 'min-h-[36px] min-w-[36px] px-3 py-1.5 text-xs',
        md: 'min-h-[44px] min-w-[44px] px-4 py-2.5 text-sm', // Touch target min 44x44px
        lg: 'min-h-[50px] min-w-[50px] px-6 py-3 text-base font-bold',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  },
);

export interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export function ActionButton({
  className,
  variant,
  size,
  fullWidth,
  isLoading = false,
  children,
  disabled,
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={twMerge(clsx(buttonVariants({ variant, size, fullWidth }), className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
