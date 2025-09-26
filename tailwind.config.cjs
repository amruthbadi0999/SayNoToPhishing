module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx,mdx}",
    "./components/**/*.{js,jsx,ts,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        gray: {
          850: '#1a1a1a',
          900: '#0a0a0a',
          950: '#050505',
        },
        blue: {
          450: '#007aff',
          550: '#0056cc',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        blink: {
          '0%, 80%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '40%': { opacity: '1', transform: 'scale(1)' }
        }
      },
      animation: {
        pulseDot: 'pulseDot 1s ease-in-out infinite',
        fadeIn: 'fadeIn 0.6s ease-out',
        slideIn: 'slideIn 0.5s ease-out',
        blink: 'blink 1.4s infinite ease-in-out'
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 20px rgba(0, 122, 255, 0.3)',
      }
    }
  },
  plugins: []
};
