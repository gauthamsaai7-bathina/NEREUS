/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: '#050b14',      // page background
        trench: '#0a1522',     // panels
        shelf: '#0f1e30',      // raised surfaces / inputs
        line: '#1a2c40',       // thin borders
        mist: '#d8e6f2',       // primary text
        haze: '#7f97ad',       // secondary text
        sonar: '#37d5d6',      // brand accent
        signal: '#f2b84b',     // medium confidence / caution
        coral: '#ef6a5b',      // errors
        kelp: '#34d8a0',       // high confidence / ok
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
        mono: ['"Cascadia Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
