import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [ react() ],
    build: {
        lib: {
            entry: 'src/lib/index.ts',
            fileName: () => 'jitsi-component-layout.js',
            formats: [ 'es' ]
        },
        outDir: 'dist-lib',
        rollupOptions: {
            external: [ 'react', 'react-dom', 'react/jsx-runtime' ]
        },
        sourcemap: true
    }
});
