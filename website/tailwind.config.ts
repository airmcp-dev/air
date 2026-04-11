/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        air: {
          50: '#edfff8', 100: '#d5ffef', 200: '#aeffdf', 300: '#70ffc8',
          400: '#2bfda9', 500: '#00d4aa', 600: '#00c48b', 700: '#009a71',
          800: '#06795b', 900: '#07634c', 950: '#003829',
        },
        surface: {
          0: '#08080d',
          1: '#0e0e16',
          2: '#15151f',
          3: '#1e1e2c',
          4: '#2a2a3a',
        },
        text: {
          primary: '#eeeef3',
          secondary: '#8888a0',
          muted: '#55556a',
        },
      },
      fontFamily: {
        display: ['"TheJamsil"', 'system-ui', 'sans-serif'],
        body: ['"TheJamsil"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.7s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.6s ease-out forwards',
        'glow-pulse': 'glowPulse 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeInUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInLeft: { from: { opacity: '0', transform: 'translateX(-20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        glowPulse: { '0%, 100%': { opacity: '0.4' }, '50%': { opacity: '0.8' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
