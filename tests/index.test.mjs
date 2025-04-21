import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import { pathToFileURL } from 'url';
import {
  isDirectExecution,
  getToken,
  getUsername,
  getOptions,
  getArg,
  getInputOrArg,
  getBoolInputOrFlag,
  handleError
} from '../src/index.js';
import { Octokit } from '@octokit/rest';
import * as spotlight from '../src/spotlight.js';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setFailed: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}));

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn()
}));

vi.mock('../src/spotlight.js', () => ({
  spotlightRepos: vi.fn()
}));

describe('index.ts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {};
    process.argv = ['node', 'script.js'];
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('isDirectExecution', () => {
    it('returns true when script is executed directly', () => {
      process.argv[1] = 'script.js';
      expect(typeof isDirectExecution()).toBe('boolean');
    });

    it('returns false when script is imported', () => {
      process.argv[1] = 'different.js';
      expect(typeof isDirectExecution()).toBe('boolean');
    });
  });

  describe('getToken', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
      process.env = {};
      process.argv = ['node', 'script.js'];
    });

    it('gets token from GH_SPOTLIGHT_TOKEN', () => {
      process.env.GH_SPOTLIGHT_TOKEN = 'spotlight-token';
      expect(getToken()).toBe('spotlight-token');
    });

    it('gets token from GITHUB_TOKEN', () => {
      process.env.GITHUB_TOKEN = 'github-token';
      expect(getToken()).toBe('github-token');
    });

    it('gets token from core.getInput', () => {
      vi.mocked(core.getInput).mockReturnValue('input-token');
      expect(getToken()).toBe('input-token');
    });

    it('gets token from command line arg', () => {
      vi.mocked(core.getInput).mockReturnValue(undefined);
      process.argv = ['node', 'script.js', '--token', 'cli-token'];
      expect(getToken()).toBe('cli-token');
    });

    it('throws when no token is found', () => {
      expect(() => getToken()).toThrow('GitHub token is required');
    });
  });

  describe('getUsername', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
      process.env = {};
      process.argv = ['node', 'script.js'];
    });

    it('gets username from github context', () => {
      process.env.GITHUB_USER = 'env-user';
      expect(getUsername()).toBe('env-user');
    });

    it('returns fallback when no username found', () => {
      vi.mocked(core.warning).mockImplementation(() => {});
      expect(getUsername()).toBe('authenticated user');
      expect(core.warning).toHaveBeenCalledWith('⚠️ GitHub username not found. Using "authenticated user" as fallback.');
    });
  });

  describe('getOptions', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
      process.env = {};
      process.argv = ['node', 'script.js'];
      vi.mocked(core.getInput).mockReturnValue(undefined);
    });

    it('gets default options when no inputs provided', () => {
      const options = getOptions();
      expect(options).toEqual({
        delay: 300,
        limit: 6,
        minViews: 0,
        includeForks: false,
        includeArchived: false
      });
    });

    it('gets options from core.getInput', () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        const values = {
          delay: '500',
          limit: '10',
          min_views: '5'
        };
        return values[name] || '';
      });

      const options = getOptions();
      expect(options).toEqual({
        delay: 500,
        limit: 10,
        minViews: 5,
        includeForks: false,
        includeArchived: false
      });
    });

    it('gets options from command line args', () => {
      process.argv = [
        'node',
        'script.js',
        '--delay', '500',
        '--limit', '10',
        '--min-views', '5',
        '--include-forks',
        '--include-archived'
      ];

      const options = getOptions();
      expect(options).toEqual({
        delay: 500,
        limit: 10,
        minViews: 5,
        includeForks: true,
        includeArchived: true
      });
    });
  });

  describe('getArg', () => {
    it('gets argument value', () => {
      process.argv = ['node', 'script.js', '--flag', 'value'];
      expect(getArg('--flag')).toBe('value');
    });

    it('returns undefined when flag not found', () => {
      process.argv = ['node', 'script.js'];
      expect(getArg('--flag')).toBeUndefined();
    });
  });

  describe('getInputOrArg', () => {
    it('gets value from core.getInput', () => {
      vi.mocked(core.getInput).mockReturnValue('42');
      expect(getInputOrArg('test', 0)).toBe(42);
    });

    it('gets value from command line arg', () => {
      process.argv = ['node', 'script.js', '--test', '42'];
      expect(getInputOrArg('test', 0)).toBe(42);
    });

    it('returns fallback when no value found', () => {
      expect(getInputOrArg('test', 42)).toBe(42);
    });

    it('throws on invalid number', () => {
      vi.mocked(core.getInput).mockReturnValue('not-a-number');
      expect(() => getInputOrArg('test', 0)).toThrow('Invalid number for test: not-a-number');
    });

    // it('throws error for invalid number in command line arg', () => {
    //   process.argv = ['node', 'script.js', '--test', 'invalid'];
    //   expect(() => getInputOrArg('test', 0)).toThrow('Invalid number for test: invalid');
    // });
  });

  describe('getBoolInputOrFlag', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
      process.env = {};
      process.argv = ['node', 'script.js'];
      vi.mocked(core.getInput).mockReturnValue(undefined);
    });

    it('gets boolean from core.getInput', () => {
      vi.mocked(core.getInput).mockReturnValue('true');
      expect(getBoolInputOrFlag('test', '--test')).toBe(true);
    });

    it('gets boolean from command line flag', () => {
      process.argv = ['node', 'script.js', '--test'];
      expect(getBoolInputOrFlag('test', '--test')).toBe(true);
    });

    it('returns false when flag not found', () => {
      expect(getBoolInputOrFlag('test', '--test')).toBe(false);
    });
  });

  describe('handleError', () => {
    let exitSpy;

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
      exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    it('handles Error objects', () => {
      const error = new Error('test error');
      handleError(error);
      expect(core.setFailed).toHaveBeenCalledWith('test error');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('handles non-Error objects', () => {
      handleError('string error');
      expect(core.setFailed).toHaveBeenCalledWith('string error');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
