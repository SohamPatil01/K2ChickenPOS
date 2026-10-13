import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-book-display',
  weight: ['600', '700', '800'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-book-body',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Book your cut · K2 Chicken',
  description:
    'Pre-order fresh chicken from K2 Chicken. Pick your cut, choose a time, and pick up from the shop.',
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${syne.variable} ${dmSans.variable}`}
      style={{
        fontFamily: 'var(--font-book-body), system-ui, sans-serif',
        // Book pages stay light — override POS dark toggle for customers.
        colorScheme: 'light',
      }}
    >
      {children}
    </div>
  );
}
