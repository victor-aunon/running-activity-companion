import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function BentoGrid({ className, children, ...props }: BentoGridProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-7xl mx-auto',
          className,
        ),
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface BentoItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  colSpan?: 1 | 2 | 3 | 4;
}

export function BentoItem({ className, colSpan = 1, children, ...props }: BentoItemProps) {
  return (
    <div
      className={twMerge(
        clsx(
          {
            'col-span-1': colSpan === 1,
            'col-span-1 md:col-span-2': colSpan === 2,
            'col-span-1 md:col-span-2 lg:col-span-3': colSpan === 3,
            'col-span-1 md:col-span-2 lg:col-span-4': colSpan === 4,
          },
          className,
        ),
      )}
      {...props}
    >
      {children}
    </div>
  );
}
