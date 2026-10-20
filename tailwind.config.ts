import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        placement: {
          valid: '#22c55e',
          invalid: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};

export default config;
