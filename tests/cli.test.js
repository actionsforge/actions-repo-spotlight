import { test, expect, vi, beforeEach, afterEach, describe } from 'vitest';
import * as core from '@actions/core';
import * as spotlight from '../lib/spotlight.js';

let originalArgv;
let originalEnv;

beforeEach(() => {
  originalArgv = [...process.argv];
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.argv = originalArgv;
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe('CLI behavior', () => {
  test('shows help message and exits with code 0 when --help is passed', async () => {
    process.argv = ['node', 'index.js', '--help'];

    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') });

    const { main } = await import('../lib/cli.js');
    await expect(main()).rejects.toThrow('exit');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Usage: node index.js [options]'));
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  test('calls spotlightRepos with parsed args', async () => {
    const spy = vi.spyOn(spotlight, 'spotlightRepos').mockResolvedValue();

    process.env.GH_SPOTLIGHT_TOKEN = 'mock-token';
    process.env.GITHUB_USER = 'mock-user';
    process.argv = ['node', 'index.js', '--delay', '0', '--limit', '2'];

    const { main } = await import('../lib/cli.js');
    await main();

    const [_octokitArg, usernameArg, optionsArg] = spy.mock.calls[0];

    expect(typeof usernameArg).toBe('string');
    expect(usernameArg.length).toBeGreaterThan(0);
    expect(optionsArg).toMatchObject({
      delay: 0,
      limit: 2,
      minViews: 0,
      includeForks: false,
      includeArchived: false,
    });
  });

  test('fails if no token is provided', async () => {
    const spy = vi.spyOn(spotlight, 'spotlightRepos').mockResolvedValue();
    delete process.env.GH_SPOTLIGHT_TOKEN;
    delete process.env.GITHUB_TOKEN;

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { main } = await import('../lib/cli.js');
    await expect(main()).rejects.toThrow('exit');

    expect(mockError).toHaveBeenCalledWith('❌ GitHub token is required.');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

describe('getBoolInputOrFlag()', () => {
  test('returns true if core input is "true"', async () => {
    vi.spyOn(core, 'getInput').mockReturnValue('true');
    const { getBoolInputOrFlag } = await import('../lib/cli.js');
    expect(getBoolInputOrFlag('include_forks', '--include-forks')).toBe(true);
  });

  test('returns false if core input is "false"', async () => {
    vi.spyOn(core, 'getInput').mockReturnValue('false');
    const { getBoolInputOrFlag } = await import('../lib/cli.js');
    expect(getBoolInputOrFlag('include_forks', '--include-forks')).toBe(false);
  });

  test('falls back to checking argv if core input is not set', async () => {
    vi.spyOn(core, 'getInput').mockReturnValue(undefined);
    process.argv = [...originalArgv, '--include-forks'];
    const { getBoolInputOrFlag } = await import('../lib/cli.js');
    expect(getBoolInputOrFlag('include_forks', '--include-forks')).toBe(true);
  });
});
