import { vi } from 'vitest';

// Mock environment variables
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_REPOSITORY = 'test-org/test-repo';

// Dummy repository data
const dummyRepos = [
  {
    name: 'repo1',
    owner: { login: 'test-org' },
    fork: false,
    archived: false,
    private: false
  },
  {
    name: 'repo2',
    owner: { login: 'test-org' },
    fork: false,
    archived: false,
    private: false
  }
];

// Mock @actions/core
const coreMock = {
  getInput: vi.fn().mockReturnValue(''),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  setOutput: vi.fn(),
  setSecret: vi.fn()
};

vi.mock('@actions/core', () => ({
  __esModule: true,
  default: coreMock,
  ...coreMock
}));

// Mock @actions/github
const mockReposApi = {
  listForAuthenticatedUser: vi.fn(),
  getViews: vi.fn().mockResolvedValue({ data: { count: 100 } }),
  update: vi.fn().mockResolvedValue({ data: {} })
};

const mockOctokit = {
  paginate: vi.fn().mockImplementation(async (method, params) => {
    if (method === mockReposApi.listForAuthenticatedUser) {
      return dummyRepos;
    }
    return [];
  }),
  rest: {
    repos: mockReposApi
  }
};

vi.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-org',
      repo: 'test-repo'
    }
  },
  getOctokit: vi.fn().mockReturnValue(mockOctokit)
}));

// Mock @octokit/rest
vi.mock('@octokit/rest', () => ({
  Octokit: class {
    constructor() {
      this.rest = {
        repos: {
          listForUser: vi.fn().mockResolvedValue({
            data: [
              { name: 'repo1', stargazers_count: 100 },
              { name: 'repo2', stargazers_count: 50 }
            ]
          })
        }
      };
    }
  }
}));
