import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { spotlightRepos } from '../src/spotlight.ts';

// Optional: catch all unhandled rejections during test for debugging
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

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
  Octokit: vi.fn().mockImplementation(() => ({
    paginate: vi.fn(),
    rest: {
      repos: {
        listForUser: vi.fn(),
        getViews: vi.fn()
      }
    }
  }))
}));

describe('spotlight core functionality', () => {
  let octokit;
  let mockRepos;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup mock repositories
    mockRepos = Array.from({ length: 30 }, (_, i) => ({
      name: `repo${i + 1}`,
      full_name: `user/repo${i + 1}`,
      owner: { login: 'user' },
      archived: i % 3 === 0,
      fork: i % 2 === 0
    }));

    // Setup Octokit mock
    octokit = new Octokit();
    octokit.paginate.mockResolvedValue(mockRepos);
    octokit.rest.repos.getViews.mockResolvedValue({
      data: {
        count: 100,
        uniques: 50
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // Test input validation
  describe('input validation', () => {
    // Test that empty username throws ValidationError
    it('throws ValidationError when username is empty', async () => {
      await expect(spotlightRepos(octokit, '')).rejects.toThrow('Username is required');
    }, 10000);

    // Test that invalid delay values throw ValidationError
    it('throws ValidationError for invalid delay', async () => {
      await expect(spotlightRepos(octokit, 'user', { delay: 'invalid' }))
        .rejects.toThrow('Invalid number for delay: invalid');
      await expect(spotlightRepos(octokit, 'user', { delay: 50 }))
        .rejects.toThrow('delay must be between 100 and 5000');
      await expect(spotlightRepos(octokit, 'user', { delay: 6000 }))
        .rejects.toThrow('delay must be between 100 and 5000');
    }, 10000);

    // Test that invalid limit values throw ValidationError
    it('throws ValidationError for invalid limit', async () => {
      await expect(spotlightRepos(octokit, 'user', { limit: 'invalid' }))
        .rejects.toThrow('Invalid number for limit: invalid');
      await expect(spotlightRepos(octokit, 'user', { limit: 0 }))
        .rejects.toThrow('limit must be between 1 and 100');
      await expect(spotlightRepos(octokit, 'user', { limit: 101 }))
        .rejects.toThrow('limit must be between 1 and 100');
    }, 10000);

    // Test that invalid minViews values throw ValidationError
    it('throws ValidationError for invalid minViews', async () => {
      await expect(spotlightRepos(octokit, 'user', { minViews: 'invalid' }))
        .rejects.toThrow('Invalid number for minViews: invalid');
      await expect(spotlightRepos(octokit, 'user', { minViews: -1 }))
        .rejects.toThrow('minViews must be between 0 and Infinity');
    }, 10000);
  });

  // Test repository filtering
  describe('repository filtering', () => {
    // Test that archived repositories are filtered out by default
    it('filters out archived repositories by default', async () => {
      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.length).toBeLessThanOrEqual(6);
      result.forEach(repo => {
        expect(mockRepos.find(r => r.full_name === repo.name)?.archived).toBe(false);
      });
    }, 10000);

    // Test that archived repositories are included when specified
    it('includes archived repositories when specified', async () => {
      const promise = spotlightRepos(octokit, 'user', { includeArchived: true });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.length).toBeLessThanOrEqual(6);
      const hasArchived = result.some(repo =>
        mockRepos.find(r => r.full_name === repo.name)?.archived
      );
      expect(hasArchived).toBe(true);
    }, 10000);

    // Test that forked repositories are filtered out by default
    it('filters out forked repositories by default', async () => {
      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.length).toBeLessThanOrEqual(6);
      result.forEach(repo => {
        expect(mockRepos.find(r => r.full_name === repo.name)?.fork).toBe(false);
      });
    }, 10000);

    // Test that forked repositories are included when specified
    it('includes forked repositories when specified', async () => {
      const promise = spotlightRepos(octokit, 'user', { includeForks: true });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.length).toBeLessThanOrEqual(6);
      const hasForks = result.some(repo =>
        mockRepos.find(r => r.full_name === repo.name)?.fork
      );
      expect(hasForks).toBe(true);
    }, 10000);
  });

  // Test API error handling
  describe('API error handling', () => {
    // Test that single API errors are handled gracefully
    it('handles single API error gracefully', async () => {
      octokit.rest.repos.getViews
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValue({ data: { count: 100, uniques: 50 } });

      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('API Error'));
      expect(result.length).toBeGreaterThan(0);
    }, 10000);

    // Test that exponential backoff is implemented for consecutive errors
    it('implements exponential backoff for consecutive errors', async () => {
      octokit.rest.repos.getViews
        .mockRejectedValueOnce(new Error('First error'))
        .mockRejectedValueOnce(new Error('Second error'))
        .mockResolvedValue({ data: { count: 100, uniques: 50 } });

      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('First error'));
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Second error'));
      expect(result.length).toBeGreaterThan(0);
    }, 10000);

    // Test that too many consecutive errors throw GitHubAPIError
    it('throws after too many consecutive errors', async () => {
      octokit.rest.repos.getViews.mockRejectedValue(new Error('API Error'));

      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('Too many consecutive errors');
    }, 10000);

    // Test that error counter is reset after successful call
    it('resets error counter after successful call', async () => {
      octokit.rest.repos.getViews
        .mockRejectedValueOnce(new Error('First error'))
        .mockRejectedValueOnce(new Error('Second error'))
        .mockResolvedValueOnce({ data: { count: 100, uniques: 50 } })
        .mockRejectedValueOnce(new Error('Another error'))
        .mockResolvedValue({ data: { count: 100, uniques: 50 } });

      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.length).toBeGreaterThan(0);
      expect(core.warning).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  // Test rate limiting and delays
  describe('rate limiting and delays', () => {
    // Test that base delay is applied between API calls
    it('applies base delay between API calls', async () => {
      const delay = 300;
      const promise = spotlightRepos(octokit, 'user', { delay });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.length).toBeGreaterThan(0);
    }, 10000);

    // Test that auto delay is applied for large repositories
    it('applies auto delay for large repositories', async () => {
      // Setup many repos to trigger auto delay
      mockRepos = Array.from({ length: 50 }, (_, i) => ({
        name: `repo${i + 1}`,
        full_name: `user/repo${i + 1}`,
        owner: { login: 'user' },
        archived: false,
        fork: false
      }));
      octokit.paginate.mockResolvedValue(mockRepos);

      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Auto delay'));
      expect(result.length).toBeGreaterThan(0);
    }, 10000);

    // Test that delay increases with exponential backoff after errors
    it('increases delay with exponential backoff after errors', async () => {
      octokit.rest.repos.getViews
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValue({ data: { count: 100, uniques: 50 } });

      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Rate limit'));
      expect(result.length).toBeGreaterThan(0);
    }, 10000);
  });

  // Test view filtering and sorting
  describe('view filtering and sorting', () => {
    // Test that repositories are filtered by minimum views
    it('filters repositories by minimum views', async () => {
      octokit.rest.repos.getViews.mockImplementation(({ repo }) => ({
        data: {
          count: parseInt(repo.replace('repo', '')) * 10,
          uniques: parseInt(repo.replace('repo', '')) * 5
        }
      }));

      const promise = spotlightRepos(octokit, 'user', { minViews: 150 });
      await vi.runAllTimersAsync();
      const result = await promise;
      result.forEach(repo => {
        expect(repo.views).toBeGreaterThanOrEqual(150);
      });
    }, 10000);

    // Test that repositories are sorted by view count
    it('sorts repositories by view count', async () => {
      octokit.rest.repos.getViews.mockImplementation(({ repo }) => ({
        data: {
          count: parseInt(repo.replace('repo', '')) * 10,
          uniques: parseInt(repo.replace('repo', '')) * 5
        }
      }));

      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      const result = await promise;
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].views).toBeGreaterThanOrEqual(result[i].views);
      }
    }, 10000);

    // Test that empty array is returned when no repositories meet criteria
    it('returns empty array when no repositories meet criteria', async () => {
      octokit.rest.repos.getViews.mockResolvedValue({ data: { count: 0, uniques: 0 } });

      const promise = spotlightRepos(octokit, 'user', { minViews: 1 });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toEqual([]);
      expect(core.warning).toHaveBeenCalledWith('⚠️ No repositories met the view criteria.');
    }, 10000);

    // Test that the number of returned repositories is limited
    it('limits the number of returned repositories', async () => {
      const limit = 3;
      const promise = spotlightRepos(octokit, 'user', { limit });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.length).toBeLessThanOrEqual(limit);
    }, 10000);
  });

  // Test error classes
  describe('error classes', () => {
    // Test that GitHubAPIError is thrown with status for API errors
    it('throws GitHubAPIError with status for API errors', async () => {
      const apiError = Object.assign(new Error('API Error'), { status: 403 });
      octokit.paginate.mockRejectedValue(apiError);

      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toMatchObject({
        name: 'GitHubAPIError',
        status: 403,
        message: expect.stringContaining('Failed to fetch repositories')
      });
    }, 10000);

    // Test that non-Error objects are wrapped in GitHubAPIError
    it('wraps non-Error objects in GitHubAPIError', async () => {
      octokit.paginate.mockRejectedValue('String error');

      const promise = spotlightRepos(octokit, 'user');
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toMatchObject({
        name: 'GitHubAPIError',
        message: expect.stringContaining('String error')
      });
    }, 10000);
  });
});
