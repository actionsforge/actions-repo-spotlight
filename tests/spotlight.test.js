import { test, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import { spotlightRepos } from '../lib/spotlight.js';

const logs = [];
vi.spyOn(core, 'info').mockImplementation((msg) => logs.push(`INFO: ${msg}`));
vi.spyOn(core, 'warning').mockImplementation((msg) => logs.push(`WARN: ${msg}`));

beforeEach(() => {
  logs.length = 0;
});

test('spotlightRepos selects and prints top repos (offline mock)', async () => {
  const mockRepos = [
    { name: 'repo1', full_name: 'me/repo1', archived: false, fork: false, owner: { login: 'me' } },
    { name: 'repo2', full_name: 'me/repo2', archived: false, fork: false, owner: { login: 'me' } },
    { name: 'repo3', full_name: 'me/repo3', archived: false, fork: false, owner: { login: 'me' } }
  ];

  const mockTraffic = {
    repo1: { count: 10 },
    repo2: { count: 5 },
    repo3: { count: 20 }
  };

  const octokit = {
    paginate: vi.fn().mockResolvedValue(mockRepos),
    rest: {
      repos: {
        getViews: vi.fn(({ repo }) => ({
          data: mockTraffic[repo]
        }))
      }
    }
  };

  await spotlightRepos(octokit, 'me', { delay: 0, limit: 2 });

  expect(logs.some(msg => msg.includes('🔍 Fetching repositories for me'))).toBe(true);
  expect(logs.some(msg => msg.includes('📊 Top 2'))).toBe(true);
  expect(logs.some(msg => msg.includes('repo3'))).toBe(true);
  expect(logs.some(msg => msg.includes('repo1'))).toBe(true);
});

test('spotlightRepos warns when getViews throws', async () => {
  const octokit = {
    paginate: vi.fn().mockResolvedValue([
      { name: 'repo4', full_name: 'me/repo4', archived: false, fork: false, owner: { login: 'me' } }
    ]),
    rest: {
      repos: {
        getViews: vi.fn().mockRejectedValue(new Error('view error'))
      }
    }
  };

  await spotlightRepos(octokit, 'me', { delay: 0 });

  expect(logs.some(msg => msg.includes('⚠️ Skipped me/repo4: view error'))).toBe(true);
});

test('spotlightRepos uses fallback username when none provided', async () => {
  const repos = [{
    name: 'repo1',
    full_name: 'me/repo1',
    archived: false,
    fork: false,
    owner: { login: 'me' }
  }];

  const octokit = {
    paginate: vi.fn().mockResolvedValue(repos),
    rest: {
      repos: {
        getViews: vi.fn().mockResolvedValue({ data: { count: 50 } })
      }
    }
  };

  await spotlightRepos(octokit);

  expect(logs.some(msg => msg.includes('authenticated user'))).toBe(true);
});

test('spotlightRepos skips archived and forked repos', async () => {
  const repos = [
    {
      name: 'archived-repo',
      full_name: 'me/archived-repo',
      archived: true,
      fork: false,
      owner: { login: 'me' }
    },
    {
      name: 'forked-repo',
      full_name: 'me/forked-repo',
      archived: false,
      fork: true,
      owner: { login: 'me' }
    }
  ];

  const octokit = {
    paginate: vi.fn().mockResolvedValue(repos),
    rest: {
      repos: {
        getViews: vi.fn()
      }
    }
  };

  await spotlightRepos(octokit, 'me', { delay: 0 });

  expect(octokit.rest.repos.getViews).not.toHaveBeenCalled();
});

test('spotlightRepos triggers auto delay every 25 repos', async () => {
  vi.useFakeTimers();
  const dummyRepos = Array.from({ length: 30 }, (_, i) => ({
    name: `repo${i}`,
    owner: { login: 'testuser' },
    fork: false,
    archived: false,
  }));

  const octokit = {
    rest: {
      repos: {
        getViews: vi.fn().mockResolvedValue({ data: { count: 42 } }),
      },
    },
    paginate: vi.fn().mockResolvedValue(dummyRepos),
  };

  const promise = spotlightRepos(octokit, 'testuser', {
    delay: 100,
    limit: 30,
    minViews: 0,
    includeForks: true,
    includeArchived: true,
  });

  await vi.runAllTimersAsync();
  await promise;

  expect(logs.some(msg => msg.includes('Auto delay') && msg.includes('repo 25/30'))).toBe(true);
});
