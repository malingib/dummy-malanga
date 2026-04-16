import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        foreground: '#000000',
        primary: '#10b981',
        secondary: '#f3f4f6',
        accent: '#3b82f6',
        muted: '#6b7280',
      },
    },
  },
  plugins: [],
}
export default config
