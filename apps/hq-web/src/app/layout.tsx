import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AzelaPOS HQ - Franchise Management',
  description: 'Headquarters Dashboard for Franchise Management',
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
                const theme = localStorage.getItem('hq-theme') || localStorage.getItem('theme') || 'system';
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
      <body>{children}</body>
    </html>
  );
}

