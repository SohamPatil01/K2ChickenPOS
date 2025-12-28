/**
 * Centralized Design System Theme
 * Single source of truth for colors, spacing, shadows, and design tokens
 */

export const theme = {
  colors: {
    brand: {
      900: '#7A2E00',
      800: '#9A3E00',
      700: '#C04A00',
      600: '#E65C00',
      500: '#FF6A00', // PRIMARY BRAND
      400: '#FF8A3D',
      300: '#FFB37A',
      200: '#FFD5B3',
      100: '#FFF0E6',
    },
    accent: {
      success: '#16A34A',
      warning: '#FACC15',
      danger: '#DC2626',
      info: '#2563EB',
    },
    neutral: {
      black: '#0F0F0F',
      gray900: '#181818',
      gray700: '#2A2A2A',
      gray500: '#6B7280',
      gray300: '#D1D5DB',
      gray100: '#F5F5F5',
      white: '#FFFFFF',
    },
  },
  shadows: {
    card: '0px 6px 20px rgba(0, 0, 0, 0.08)',
    orangeGlow: '0px 10px 30px rgba(255, 106, 0, 0.4)',
    inputFocus: '0px 0px 0px 3px rgba(255, 106, 0, 0.35)',
    inputError: '0px 0px 0px 2px rgba(220, 38, 38, 0.3)',
    buttonHover: '0px 8px 24px rgba(255, 106, 0, 0.35)',
  },
  borderRadius: {
    sm: '8px',
    md: '10px',
    lg: '12px',
    xl: '16px',
    xl2: '16px',
  },
  spacing: {
    inputPadding: '12px 14px',
    buttonPadding: '12px 18px',
    cardPadding: '20px',
  },
  transitions: {
    standard: 'all 180ms ease-out',
    button: 'all 180ms ease-out',
  },
  typography: {
    fontFamily: {
      primary: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  darkMode: {
    background: '#0B0B0B',
    surface: '#181818',
    textPrimary: '#FFFFFF',
    textSecondary: '#D1D5DB',
  },
} as const;

export type Theme = typeof theme;

