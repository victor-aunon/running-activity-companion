import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors',
  {
    variants: {
      variant: {
        live: 'bg-emerald-50 text-emerald-700 border border-emerald-300 animate-pulse',
        enviado: 'bg-sky-50 text-sky-700 border border-sky-300',
        en_reloj: 'bg-amber-50 text-amber-700 border border-amber-300',
        agradecido: 'bg-purple-50 text-purple-700 border border-purple-300',
        expirado: 'bg-slate-100 text-slate-500 border border-slate-300',
        outline: 'border border-slate-200 text-slate-700',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-xs px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'enviado',
      size: 'md',
    },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function StatusBadge({
  className,
  variant,
  size,
  dot = true,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={twMerge(clsx(badgeVariants({ variant, size }), className))} {...props}>
      {dot && (
        <span
          className={twMerge(
            clsx('h-1.5 w-1.5 rounded-full', {
              'bg-emerald-500': variant === 'live',
              'bg-sky-500': variant === 'enviado',
              'bg-amber-500': variant === 'en_reloj',
              'bg-purple-500': variant === 'agradecido',
              'bg-slate-400': variant === 'expirado' || variant === 'outline',
            }),
          )}
        />
      )}
      {children}
    </span>
  );
}
