import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#14110f',
          soft: '#3d342c',
          mute: '#8a8078',
        },
        paper: {
          DEFAULT: '#faf8f5',
          raised: '#ffffff',
        },
        flame: {
          DEFAULT: '#ff4d1a',
          deep: '#e03d0e',
          soft: 'rgba(255, 77, 26, 0.1)',
        },
        line: 'rgba(20, 17, 15, 0.1)',
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
