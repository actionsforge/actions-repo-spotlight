import { test, expect, vi } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

test('index.js runAsScript block executes if isDirectExecution is true', async () => {
  const realArgv = process.argv.slice();
  const filePath = path.resolve(fileURLToPath(import.meta.url), '../../index.js');

  // Fake direct execution
  process.argv[1] = filePath;

  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});

  await import(filePath);

  spy.mockRestore();
  exit.mockRestore();
  process.argv = realArgv;
});
