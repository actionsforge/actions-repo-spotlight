import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAsScript } from '../index.js';

vi.mock('../lib/cli.js', async () => ({
  main: vi.fn().mockResolvedValue(undefined),
}));

let originalEnv;
let originalArgv;

beforeEach(() => {
  originalEnv = { ...process.env };
  originalArgv = [...process.argv];
});

afterEach(() => {
  process.env = originalEnv;
  process.argv = originalArgv;
  vi.restoreAllMocks();
});

describe('index.js entry behavior', () => {
  test('runAsScript handles error and calls process.exit', async () => {
    const mockError = new Error('Test failure');
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const mockConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { main } = await import('../lib/cli.js');
    main.mockRejectedValueOnce(mockError);

    delete process.env.GITHUB_ACTION; // force non-GHA mode

    await runAsScript();

    expect(mockConsole).toHaveBeenCalledWith(expect.stringContaining('❌ Test failure'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('runAsScript uses setFailed in GitHub Actions environment', async () => {
    const core = await import('@actions/core');
    const mockSetFailed = vi.spyOn(core, 'setFailed').mockImplementation(() => {});
    const mockError = new Error('GH Action Error');
    const { main } = await import('../lib/cli.js');
    main.mockRejectedValueOnce(mockError);

    process.env.GITHUB_ACTION = 'true';

    await runAsScript();

    expect(mockSetFailed).toHaveBeenCalledWith('GH Action Error');
  }, 10000); // 10s timeout

  test('runAsScript calls main when no error occurs', async () => {
    const { main } = await import('../lib/cli.js');
    main.mockResolvedValueOnce();

    delete process.env.GITHUB_ACTION;

    await runAsScript();

    expect(main).toHaveBeenCalled();
  });
});

test('index.js runAsScript block executes if isDirectExecution is true', async () => {
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const realArgv = process.argv.slice();
  const filePath = path.resolve(fileURLToPath(import.meta.url), '../../index.js');
  process.argv[1] = filePath;

  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});

  await import(filePath);

  spy.mockRestore();
  exit.mockRestore();
  process.argv = realArgv;
});
