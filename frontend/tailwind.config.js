/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // AIR-FLOW brand colors
        navy: '#101B35',
        primary: '#2563EB',
        background: '#F5F7FB',
        surface: '#FFFFFF',
        success: '#16A34A',
        warning: '#F59E0B',
        error: '#DC2626',
        'text-primary': '#1E293B',
      },
    },
  },
  plugins: [],
};

