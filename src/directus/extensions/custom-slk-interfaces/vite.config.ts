import { defineConfig } from 'vite';
import vue from '@vue/compiler-sfc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      vue: 'vue',
    },
  },
  build: {
    lib: {
      entry: {
        'footer-nav-editor': resolve(__dirname, 'src/footer-nav-editor/index.ts'),
        'images-as-radio-buttons': resolve(__dirname, 'src/images-as-radio-buttons/index.ts'),
        'measure-infos': resolve(__dirname, 'src/measure-infos/index.ts'),
        'navigation-editor': resolve(__dirname, 'src/navigation-editor/index.ts'),
        'unsplash-image': resolve(__dirname, 'src/unsplash-image/index.ts'),
      },
    },
    outDir: 'dist',
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
});
