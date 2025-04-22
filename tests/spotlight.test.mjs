import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { spotlightRepos } from '../src/index.js';

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
  Octokit: vi.fn()
}));

describe('spotlightRepos', () => {
  let octokit;
  let mockRepos;
  let mockViews;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Setup mock repositories
    mockRepos = [
      { name: 'repo1', full_name: 'user/repo1', owner: { login: 'user' }, archived: false, fork: false },
      { name: 'repo2', full_name: 'user/repo2', owner: { login: 'user' }, archived: false, fork: true },
      { name: 'repo3', full_name: 'user/repo3', owner: { login: 'user' }, archived: true, fork: false }
    ];

    // Setup mock views data
    mockViews = {
      data: {
        count: 100
      }
    };

    // Setup Octokit mock
    octokit = {
      paginate: vi.fn().mockResolvedValue(mockRepos),
      rest: {
        repos: {
          listForAuthenticatedUser: vi.fn(),
          getViews: vi.fn().mockResolvedValue(mockViews)
        }
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns repositories with views', async () => {
    const result = await spotlightRepos(octokit, 'test-user', {
      delay: 100,
      limit: 2,
      minViews: 50,
      includeForks: true,
      includeArchived: true
    });

    expect(octokit.paginate).toHaveBeenCalledWith(
      octokit.rest.repos.listForAuthenticatedUser,
      expect.objectContaining({
        visibility: 'all',
        affiliation: 'owner',
        per_page: 100
      })
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'user/repo1',
      views: 100
    });

    expect(core.info).toHaveBeenCalledWith('🔍 Fetching repositories for test-user...');
    expect(core.info).toHaveBeenCalledWith('⏱️ Delay between traffic API calls: 100ms');
    expect(core.info).toHaveBeenCalledWith('🔢 Limit: 2');
    expect(core.info).toHaveBeenCalledWith('📉 Minimum views: 50');
    expect(core.info).toHaveBeenCalledWith('🍴 Include forks: true');
    expect(core.info).toHaveBeenCalledWith('📦 Include archived: true');
  });

  it('filters out forks and archived repos when specified', async () => {
    const result = await spotlightRepos(octokit, 'test-user', {
      includeForks: false,
      includeArchived: false
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('user/repo1');
  });

  it('applies minimum views filter', async () => {
    const result = await spotlightRepos(octokit, 'test-user', {
      minViews: 200
    });

    expect(result).toHaveLength(0);
    expect(core.warning).toHaveBeenCalledWith('⚠️ No repositories met the view criteria.');
  });

  it('handles API errors gracefully', async () => {
    octokit.rest.repos.getViews
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({ data: { count: 100 } })
      .mockResolvedValueOnce({ data: { count: 100 } });

    const result = await spotlightRepos(octokit, 'test-user', {
      includeForks: true,
      includeArchived: true
    });

    expect(core.warning).toHaveBeenCalledWith('⚠️ Skipped user/repo1: API Error - API Error');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('user/repo2');
    expect(result[1].name).toBe('user/repo3');
  });

  it('applies limit to results', async () => {
    const result = await spotlightRepos(octokit, 'test-user', {
      limit: 1
    });

    expect(result).toHaveLength(1);
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('📊 Top 1 repositories by views:')
    );
  });

  it('sorts repositories by views in descending order', async () => {
    octokit.rest.repos.getViews
      .mockResolvedValueOnce({ data: { count: 100 } })
      .mockResolvedValueOnce({ data: { count: 200 } })
      .mockResolvedValueOnce({ data: { count: 50 } });

    const result = await spotlightRepos(octokit, 'test-user', {
      includeForks: true,
      includeArchived: true
    });

    expect(result).toHaveLength(3);
    expect(result[0].views).toBe(200);
    expect(result[1].views).toBe(100);
    expect(result[2].views).toBe(50);
  });
});
