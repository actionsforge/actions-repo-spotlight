import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.mjs'],
    deps: {
      interopDefault: true,
      optimizer: {
        ssr: {
          include: ['@actions/*']
        }
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/index.{cjs,mjs,ts}',
        '**/*.config.{cjs,ts}',
        '**/vitest.config.ts',
        '**/tsup.config.cjs',
        '**/coverage/**',
        '**/dist/**',
        '**/.{idea,git,cache,output}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
      ]
    },
    server: {
      deps: {
        inline: ['@actions/*']
      }
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        isolate: false
      }
    }
  }
});
