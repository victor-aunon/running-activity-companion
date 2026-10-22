import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'En Vivo | Running Activity Support',
  description: 'Seguimiento en tiempo real y muro de ánimos para carreras',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
