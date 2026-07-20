import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'K2 Chicken Loyalty',
  description: 'Check your K2 Chicken loyalty points — redeem in store',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={sans.variable}>
      <body suppressHydrationWarning className="font-sans antialiased">
        <div className="loyalty-shell">{children}</div>
      </body>
    </html>
  );
}
