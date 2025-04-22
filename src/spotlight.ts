import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';

/**
 * Custom error class for GitHub API related errors
 */
class GitHubAPIError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

/**
 * Custom error class for validation errors
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Sleep for the specified number of milliseconds
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Options for the spotlightRepos function
 */
interface SpotlightOptions {
  /** Delay between API calls in milliseconds */
  delay?: string | number;
  /** Maximum number of repositories to return */
  limit?: string | number;
  /** Minimum number of views required to include a repository */
  minViews?: string | number;
  /** Whether to include forked repositories */
  includeForks?: boolean;
  /** Whether to include archived repositories */
  includeArchived?: boolean;
}

/**
 * Traffic data for a repository
 */
interface RepoTrafficData {
  /** Full name of the repository (owner/repo) */
  name: string;
  /** Total number of views */
  views: number;
  /** Number of unique viewers */
  uniques: number;
}

/**
 * Fetches and processes repository traffic data
 * @param octokit - Octokit instance for GitHub API access
 * @param username - GitHub username to fetch repositories for
 * @param options - Configuration options
 * @returns Promise resolving to an array of repository traffic data
 * @throws {GitHubAPIError} When GitHub API calls fail
 * @throws {ValidationError} When input validation fails
 */
export async function spotlightRepos(
  octokit: Octokit,
  username: string,
  {
    delay = 300,
    limit = 6,
    minViews = 0,
    includeForks = false,
    includeArchived = false
  }: SpotlightOptions = {}
): Promise<RepoTrafficData[]> {
  // Validate inputs
  if (!username) {
    throw new ValidationError('Username is required');
  }

  // Convert and validate numeric inputs
  const delayMs = validateNumber(delay, 'delay', 100, 5000);
  const limitNum = validateNumber(limit, 'limit', 1, 100);
  const minViewsNum = validateNumber(minViews, 'minViews', 0, Infinity);

  core.info(`🔍 Fetching repositories for ${username}...`);
  core.info(`⏱️ Delay between traffic API calls: ${delayMs}ms`);
  core.info(`🔢 Limit: ${limitNum}`);
  core.info(`📉 Minimum views: ${minViewsNum}`);
  core.info(`🍴 Include forks: ${includeForks}`);
  core.info(`📦 Include archived: ${includeArchived}`);

  try {
    const repos = await octokit.paginate(octokit.rest.repos.listForUser, {
      username,
      per_page: 100
    });

    const trafficData: RepoTrafficData[] = [];
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;

    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];

      if (!includeArchived && repo.archived) continue;
      if (!includeForks && repo.fork) continue;

      // Implement exponential backoff for rate limiting
      if (i > 0 && i % 25 === 0) {
        const autoDelay = Math.floor(Math.random() * 50 + delayMs * Math.pow(1.5, consecutiveErrors));
        core.info(`⏸️ Auto delay (${autoDelay}ms) [repo ${i}/${repos.length}]`);
        await sleep(autoDelay);
      } else {
        await sleep(delayMs);
      }

      try {
        const { data } = await octokit.rest.repos.getViews({
          owner: repo.owner.login,
          repo: repo.name
        });

        consecutiveErrors = 0; // Reset error counter on success

        if (data.count >= minViewsNum) {
          trafficData.push({
            name: repo.full_name,
            views: data.count,
            uniques: data.uniques
          });
        }
      } catch (error) {
        consecutiveErrors++;
        const message = error instanceof Error ? error.message : String(error);
        const status = (error as any)?.status;

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          throw new GitHubAPIError(`Too many consecutive errors (${consecutiveErrors})`, status);
        }

        core.warning(`⚠️ Skipped ${repo.full_name}: ${message}`);
        await sleep(delayMs * Math.pow(2, consecutiveErrors)); // Exponential backoff
      }
    }

    if (trafficData.length === 0) {
      core.warning('⚠️ No repositories met the view criteria.');
      return [];
    }

    trafficData.sort((a, b) => b.views - a.views);
    const top = trafficData.slice(0, limitNum);

    core.info(
      `📊 Top ${top.length} repositories by views:\n${top.map(
        (r, i) => `${i + 1}. ${r.name} — ${r.views} views (${r.uniques} unique)`
      ).join('\n')}`
    );

    return top;
  } catch (error) {
    if (error instanceof GitHubAPIError || error instanceof ValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = (error as any)?.status;
    throw new GitHubAPIError(`Failed to fetch repositories: ${message}`, status);
  }
}

/**
 * Validates and converts a number input
 * @param value - Input value to validate
 * @param name - Name of the parameter for error messages
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Validated number
 * @throws {ValidationError} When validation fails
 */
function validateNumber(
  value: string | number,
  name: string,
  min: number,
  max: number
): number {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(num)) {
    throw new ValidationError(`Invalid number for ${name}: ${value}`);
  }

  if (num < min || num > max) {
    throw new ValidationError(`${name} must be between ${min} and ${max}`);
  }

  return num;
}
