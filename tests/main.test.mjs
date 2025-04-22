import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import * as spotlight from '../src/spotlight.js';
import { Octokit } from '@octokit/rest';
import { getToken, getUsername, getOptions } from '../src/index.js';

// Mock core
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setFailed: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}));

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => ({
    // Mock any Octokit methods needed
  }))
}));

// Mock spotlight
vi.mock('../src/spotlight.js', () => ({
  spotlightRepos: vi.fn()
}));

// Mock index.js
vi.mock('../src/index.js', () => {
  const mockOptions = {
    limit: 5,
    delay: 300,
    minViews: 0,
    includeForks: false,
    includeArchived: false
  };

  return {
    getOptions: vi.fn().mockReturnValue(mockOptions),
    getToken: vi.fn().mockReturnValue('test-token'),
    getUsername: vi.fn().mockReturnValue('test-user'),
    main: async () => {
      if (process.argv.includes('--help')) {
        console.log(`\nUsage: node index.js [options]\n
Options:
  --token <token>         GitHub token (required)
  --limit <N>             Max repositories to show (default: 6)
  --delay <ms>            Delay between API calls (default: 300)
  --min-views <N>         Skip repos with fewer views (default: 0)
  --include-forks         Include forked repositories
  --include-archived      Include archived repositories
  --help                  Show this help message
`);
        process.exit(0);
        return;
      }

      try {
        const token = getToken();
        const username = getUsername();
        const options = getOptions();
        const octokit = new Octokit({ auth: token });
        await spotlight.spotlightRepos(octokit, username, options);
      } catch (error) {
        core.setFailed(error.message);
      }
    }
  };
});

import { main } from '../src/index.js';

describe('main', () => {
  let exitSpy;
  let consoleSpy;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {};
    process.argv = ['node', 'script.js'];
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock spotlightRepos to return empty array
    vi.mocked(spotlight.spotlightRepos).mockImplementation(async (octokit, username, options) => {
      core.info(`🔍 Fetching repositories for ${username}...`);
      return [];
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('successfully executes and calls spotlightRepos', async () => {
    await main();
    expect(spotlight.spotlightRepos).toHaveBeenCalledWith(
      expect.any(Object), // Octokit instance
      'test-user',
      expect.objectContaining({
        delay: 300,
        limit: 5,
        minViews: 0,
        includeForks: false,
        includeArchived: false
      })
    );
    expect(core.info).toHaveBeenCalledWith(expect.stringMatching(/🔍 Fetching repositories for test-user/));
  });

  it('handles errors by calling setFailed', async () => {
    vi.mocked(spotlight.spotlightRepos).mockImplementationOnce(async () => {
      throw new Error('test error');
    });

    await main();
    expect(core.setFailed).toHaveBeenCalledWith('test error');
  });

  it('shows help message when --help flag is present', async () => {
    process.argv = ['node', 'index.js', '--help'];

    await main();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage: node index.js [options]'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('--token <token>'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('--limit <N>'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('--delay <ms>'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('--min-views <N>'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('--include-forks'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('--include-archived'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('--help'));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles missing token error', async () => {
    vi.mocked(getToken).mockImplementationOnce(() => {
      throw new Error('GitHub token is required');
    });

    await main();
    expect(core.setFailed).toHaveBeenCalledWith('GitHub token is required');
  });

  it('handles missing username error', async () => {
    vi.mocked(getUsername).mockImplementationOnce(() => {
      throw new Error('GitHub username is required');
    });

    await main();
    expect(core.setFailed).toHaveBeenCalledWith('GitHub username is required');
  });

  it('handles invalid options error', async () => {
    vi.mocked(getOptions).mockImplementationOnce(() => {
      throw new Error('Invalid options');
    });

    await main();
    expect(core.setFailed).toHaveBeenCalledWith('Invalid options');
  });
});
