import type { RootLayoutProps } from '@/types';
import type { Metadata } from 'next';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { AppToaster } from '@/components/AppToaster';
import 'sileo/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'KornSpace — Tus archivos, en su lugar',
  description: 'Un espacio sencillo y privado para guardar, organizar y compartir tus archivos.',
  applicationName: 'KornSpace',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body className="m-0 min-h-screen min-w-[320px] bg-page font-sans text-ink antialiased transition-colors duration-150 motion-reduce:transition-none"><SessionProvider>{children}<AppToaster /></SessionProvider></body>
    </html>
  );
}
