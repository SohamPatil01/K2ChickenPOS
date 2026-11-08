import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#2a1a12',
          soft: '#6b5848',
          mute: '#8a7766',
        },
        paper: {
          DEFAULT: '#faf6ec',
          raised: '#ffffff',
          warm: '#f3e9d2',
        },
        flame: {
          DEFAULT: '#e8481c',
          deep: '#c93a12',
          ink: '#b33a12',
          soft: 'rgba(232, 72, 28, 0.1)',
        },
        line: {
          DEFAULT: '#e4dac4',
          soft: '#efe6d2',
          strong: '#cdbfa3',
        },
        pill: {
          DEFAULT: '#f6d9a8',
          ink: '#633806',
        },
      },
      fontFamily: {
        display: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
