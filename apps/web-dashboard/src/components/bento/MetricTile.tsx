'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPace, formatDistanceKm } from '../../utils/formatters';

export { formatPace, formatDistanceKm };

export const metricTileVariants = cva(
  'bg-white/80 backdrop-blur-sm p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between transition-colors',
  {
    variants: {
      intent: {
        pace: 'hover:border-orange-300',
        heartRate: 'hover:border-rose-300',
        cadence: 'hover:border-teal-300',
        distance: 'hover:border-indigo-300',
        neutral: 'hover:border-slate-300',
      },
    },
    defaultVariants: {
      intent: 'neutral',
    },
  },
);

export interface MetricTileProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof metricTileVariants> {
  title: string;
  value: string | number;
  unit?: string;
  iconBgClass?: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
}

export function MetricTile({
  className,
  intent,
  title,
  value,
  unit,
  iconBgClass = 'bg-orange-50 text-orange-600',
  icon,
  footer,
  ...props
}: MetricTileProps) {
  return (
    <div className={twMerge(clsx(metricTileVariants({ intent }), className))} {...props}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">{title}</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
              {value}
            </span>
            {unit && <span className="text-xs font-semibold text-slate-500">{unit}</span>}
          </div>
        </div>
        {icon && (
          <div
            className={twMerge('p-2.5 rounded-full flex items-center justify-center', iconBgClass)}
          >
            {icon}
          </div>
        )}
      </div>
      {footer && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {footer}
        </div>
      )}
    </div>
  );
}
