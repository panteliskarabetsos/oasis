const { fontFamily } = require('tailwindcss/defaultTheme');

module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      animation: {
        'ping-slow': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
      },

      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
        roboto: ['Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [     require('tailwind-scrollbar-hide')],
};
