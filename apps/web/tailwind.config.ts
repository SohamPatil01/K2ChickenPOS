import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Primary Brand (Orange Spectrum)
        brand: {
          900: 'var(--brand-900, #7A2E00)',
          800: 'var(--brand-800, #9A3E00)',
          700: 'var(--brand-700, #C04A00)',
          600: 'var(--brand-600, #E65C00)',
          500: 'var(--brand-500, #FF6A00)', // PRIMARY BRAND
          400: 'var(--brand-400, #FF8A3D)',
          300: 'var(--brand-300, #FFB37A)',
          200: 'var(--brand-200, #FFD5B3)',
          100: 'var(--brand-100, #FFF0E6)',
        },
        // Legacy primary mapping (for backward compatibility) - Uses CSS variables
        primary: {
          900: 'var(--brand-900, #7A2E00)',
          800: 'var(--brand-800, #9A3E00)',
          700: 'var(--brand-700, #C04A00)',
          600: 'var(--brand-600, #E65C00)',
          500: 'var(--brand-500, #FF6A00)',
          400: 'var(--brand-400, #FF8A3D)',
          300: 'var(--brand-300, #FFB37A)',
          200: 'var(--brand-200, #FFD5B3)',
          100: 'var(--brand-100, #FFF0E6)',
        },
        // Accent Colors
        accent: {
          success: '#16A34A',
          warning: '#FACC15',
          danger: '#DC2626',
          info: '#2563EB',
        },
        // Neutrals
        neutral: {
          black: '#0F0F0F',
          gray900: '#181818',
          gray700: '#2A2A2A',
          gray500: '#6B7280',
          gray300: '#D1D5DB',
          gray100: '#F5F5F5',
          white: '#FFFFFF',
        },
        // Semantic surfaces/text (glass design system — flip under .dark via CSS vars)
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
      },
      borderColor: {
        subtle: 'var(--border-subtle)',
        strong: 'var(--border-strong)',
        glass: 'var(--border-glass)',
      },
      backgroundImage: {
        'gradient-brand': 'var(--gradient-brand)',
        'app-glow': 'var(--bg-app-glow)',
      },
      borderRadius: {
        xl2: '16px',
      },
      boxShadow: {
        glass: 'var(--shadow-glass)',
        'glow-brand': 'var(--glow-brand)',
        'glow-brand-lg': 'var(--glow-brand-lg)',
        card: '0px 6px 20px rgba(0, 0, 0, 0.08)',
        orangeGlow: '0px 10px 30px rgba(255, 106, 0, 0.4)',
        inputFocus: '0px 0px 0px 3px rgba(255, 106, 0, 0.35)',
        inputError: '0px 0px 0px 2px rgba(220, 38, 38, 0.3)',
        buttonHover: '0px 8px 24px rgba(255, 106, 0, 0.35)',
      },
      transitionDuration: {
        standard: '180ms',
      },
      transitionTimingFunction: {
        standard: 'ease-out',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-out-left': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-24px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(255, 106, 0, 0.35)' },
          '50%': { opacity: '0.95', boxShadow: '0 0 0 8px rgba(255, 106, 0, 0.1)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '60%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
        'fade-in': 'fade-in 0.25s ease-out forwards',
        'scale-in': 'scale-in 0.3s ease-out forwards',
        'slide-out-left': 'slide-out-left 0.3s ease-in forwards',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'soft-pulse': 'soft-pulse 2s ease-in-out infinite',
        'bounce-in': 'bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;

