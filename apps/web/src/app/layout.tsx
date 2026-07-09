import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { APP_NAME } from '@azela-pos/shared';
import './globals.css';
import RootWrapper from '@/components/RootWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Production-ready POS system for chicken butcher franchise',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Apply theme before React hydrates to prevent flash
                const theme = localStorage.getItem('theme') || 'system';
                const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                const effectiveTheme = theme === 'system' ? systemPreference : theme;
                
                if (effectiveTheme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.add('light');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <RootWrapper>{children}</RootWrapper>
      </body>
    </html>
  );
}
