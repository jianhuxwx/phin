import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0d0d0d',
          card: '#141414',
          border: '#1f1f1f',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
        },
        tx: {
          primary: '#f1f5f9',
          muted: '#64748b',
          hash: '#94a3b8',
        },
        status: {
          confirmed: '#22c55e',
          pending: '#f59e0b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
