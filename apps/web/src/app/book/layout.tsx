import type { Metadata } from 'next';
import { Manrope, DM_Sans } from 'next/font/google';
import ForceLight from './ForceLight';
import './book-theme.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-book-display',
  weight: ['500', '600', '700', '800'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-book-body',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'K2 Chicken — Pre-order your cuts',
  description:
    'Book fresh chicken cuts from K2 Chicken, Pimple Nilakh. Choose your cut, pick a time, track live.',
  themeColor: '#fff8f6',
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${manrope.variable} ${dmSans.variable} k2-book`}
      style={{ colorScheme: 'light' }}
    >
      <ForceLight />
      {children}
    </div>
  );
}
