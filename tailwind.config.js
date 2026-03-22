/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wolf: {
          bg: '#0A0A12',
          left: '#3366BB',
          right: '#CC8833',
          whiteKey: '#E8E8EE',
          blackKey: '#1A1A22',
        },
        ruby: {
          bg: '#FEF8F0',
          cat: '#5DCAA5',
          dog: '#F0997B',
          elephant: '#AFA9EC',
          frog: '#97C459',
          giraffe: '#FAC775',
          alligator: '#85B7EB',
          bear: '#ED93B1',
        },
      },
    },
  },
  plugins: [],
};
