import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.ts',
            formats: ['es'],
            fileName: () => 'index.js',
        },
        sourcemap: true,
        minify: false,
        rollupOptions: {
            // The host must resolve these imports to its shared module instances.
            external: ['three', '@clonedspaces/viewer-core-plugin'],
        },
    },
    preview: {
        host: '127.0.0.1',
        port: 4174,
        strictPort: true,
        cors: true,
    },
})
