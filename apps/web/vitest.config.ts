import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.smoke.ts',
      // Pure, dependency-free edge-function logic (no Deno globals) runs here under node too.
      '../../supabase/functions/post-image-upload/*.test.ts',
    ],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
