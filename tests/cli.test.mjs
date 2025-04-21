// tests/cli.test.cjs
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { main } from '../lib/cli.js';
import '../tests/setup.mjs';

vi.mock('@actions/core');
vi.mock('@actions/github');
vi.mock('../src/spotlight.js', () => ({
  spotlightRepos: vi.fn().mockResolvedValue([])
}));

describe('CLI tests', () => {
  const originalArgv = process.argv;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = ['node', 'cli.js'];
    process.env = { ...originalEnv, GITHUB_USER: 'test-user' };
    vi.mocked(core.info).mockImplementation(console.log);
    vi.mocked(core.error).mockImplementation(console.error);
    vi.mocked(core.getInput).mockReturnValue(undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  test('shows help message when --help flag is present', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    process.argv.push('--help');
    await main();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('exits with error when no token is provided', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    process.env = { GITHUB_USER: 'test-user' };
    await main();

    expect(consoleSpy).toHaveBeenCalledWith('❌ GitHub token is required.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('uses token from environment variable', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    process.env = { GITHUB_USER: 'test-user', GH_SPOTLIGHT_TOKEN: 'test-token' };
    await main();
    expect(github.getOctokit).toHaveBeenCalledWith('test-token');
  });

  test('uses token from GITHUB_TOKEN environment variable', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    process.env = { GITHUB_USER: 'test-user', GITHUB_TOKEN: 'github-token' };
    await main();
    expect(github.getOctokit).toHaveBeenCalledWith('github-token');
  });

  test('uses token from GitHub Actions input', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    process.env = { GITHUB_USER: 'test-user' };
    vi.mocked(core.getInput).mockReturnValue('input-token');
    await main();
    expect(github.getOctokit).toHaveBeenCalledWith('input-token');
  });

  test('uses token from command line argument', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    process.env = { GITHUB_USER: 'test-user' };
    process.argv.push('--token', 'cli-token');
    await main();
    expect(github.getOctokit).toHaveBeenCalledWith('cli-token');
  });

  test('parses command line arguments correctly', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    process.env = { GITHUB_USER: 'test-user', GH_SPOTLIGHT_TOKEN: 'test-token' };
    process.argv.push(
      '--delay', '500',
      '--limit', '10',
      '--min-views', '5',
      '--include-forks',
      '--include-archived'
    );

    await main();

    expect(github.getOctokit).toHaveBeenCalledWith('test-token');
  });

  test('handles errors gracefully', async () => {
    process.env = { GITHUB_USER: 'test-user', GH_SPOTLIGHT_TOKEN: 'test-token' };
    const error = new Error('Test error');
    vi.mocked(github.getOctokit).mockImplementation(() => {
      throw error;
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(main()).rejects.toThrow('Test error');
  });
});
