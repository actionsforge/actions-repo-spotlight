import { test, expect, vi } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import { runAsScript } from '../index.js';

test('entrypoint executes index.js and exits on error', () => {
  const scriptPath = path.resolve('index.js');

  const result = spawnSync('node', [scriptPath], {
    env: {
      ...process.env,
      GH_SPOTLIGHT_TOKEN: ''
    },
    encoding: 'utf-8'
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/GitHub token is required/);
});

test('runAsScript() calls main and exits with error', async () => {
  process.env.GH_SPOTLIGHT_TOKEN = '';

  const mockLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

  await runAsScript();

  expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('❌'));
  expect(mockExit).toHaveBeenCalledWith(1);

  mockLog.mockRestore();
  mockExit.mockRestore();
});
