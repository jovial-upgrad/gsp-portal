import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes a normal static build in dist/.
// `npm run build:artifact` inlines everything into one HTML file for sharing.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'artifact' ? [react(), viteSingleFile()] : [react()],
  // one bundle on purpose: the prototype is shared as a single file, so a larger chunk is expected
  build: { outDir: mode === 'artifact' ? 'dist-artifact' : 'dist', chunkSizeWarningLimit: 900 },
  // which build this is: connected copies of the prototype only sync with the same build (see src/proto/link.ts)
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
}));
