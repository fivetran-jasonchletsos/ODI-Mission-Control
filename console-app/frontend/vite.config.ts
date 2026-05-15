import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path: GitHub Pages serves at https://<user>.github.io/ODI-Mission-Control/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/ODI-Mission-Control/',
});
