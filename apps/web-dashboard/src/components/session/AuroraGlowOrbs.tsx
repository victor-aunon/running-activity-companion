import React from 'react';

export function AuroraGlowOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute -top-32 -left-20 w-[600px] h-[600px] bg-indigo-200/40 rounded-full blur-[110px]" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-teal-100/50 rounded-full blur-[100px]" />
      <div className="absolute bottom-10 left-1/3 w-[550px] h-[550px] bg-rose-100/40 rounded-full blur-[120px]" />
    </div>
  );
}
