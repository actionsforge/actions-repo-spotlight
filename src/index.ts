#!/usr/bin/env node

import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import { pathToFileURL } from 'url';

/**
 * Default configuration values
 */
const DEFAULTS = {
  delay: 300,
  limit: 6,
  minViews: 0,
  includeForks: false,
  includeArchived: false
} as const;

/**
 * Interface for spotlight options
 */
interface SpotlightOptions {
  delay?: number;
  limit?: number;
  minViews?: number;
  includeForks?: boolean;
  includeArchived?: boolean;
}

/**
 * Sleep function to add delays between API calls
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main spotlight functionality
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
): Promise<{ name: string; views: number }[]> {
  core.info(`🔍 Fetching repositories for ${username || 'authenticated user'}...`);
  core.info(`⏱️ Delay between traffic API calls: ${delay}ms`);
  core.info(`🔢 Limit: ${limit}`);
  core.info(`📉 Minimum views: ${minViews}`);
  core.info(`🍴 Include forks: ${includeForks}`);
  core.info(`📦 Include archived: ${includeArchived}`);

  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    visibility: 'all',
    affiliation: 'owner',
    per_page: 100
  });

  const trafficData: { name: string; views: number }[] = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    if (!includeArchived && repo.archived) continue;
    if (!includeForks && repo.fork) continue;

    if (i > 0 && i % 25 === 0) {
      const autoDelay = Math.floor(Math.random() * 50 + delay * 0.5);
      core.info(`⏸️ Auto delay (${autoDelay}ms) [repo ${i}/${repos.length}]`);
      await sleep(autoDelay);
    } else {
      await sleep(delay);
    }

    try {
      const { data } = await octokit.rest.repos.getViews({
        owner: repo.owner.login,
        repo: repo.name
      });

      if (data.count >= minViews) {
        trafficData.push({
          name: repo.full_name,
          views: data.count
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.warning(`⚠️ Skipped ${repo.full_name}: API Error - ${message}`);
    }
  }

  if (trafficData.length === 0) {
    core.warning('⚠️ No repositories met the view criteria.');
    return [];
  }

  trafficData.sort((a, b) => b.views - a.views);
  const top = trafficData.slice(0, limit);

  core.info(
    `📊 Top ${top.length} repositories by views:\n${top.map(
      (r, i) => `${i + 1}. ${r.name} — ${r.views} views`
    ).join('\n')}`
  );

  return top;
}

/**
 * Checks if the script is being executed directly
 * @returns true if the script is being executed directly
 */
export function isDirectExecution(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1])?.href;
}

/**
 * Gets the GitHub token from environment variables or input
 * @returns GitHub token
 * @throws {Error} When token is not found
 */
export function getToken(): string {
  const token =
    process.env.GH_SPOTLIGHT_TOKEN ||
    process.env.GITHUB_TOKEN ||
    (core.getInput && core.getInput('token')) ||
    getArg('--token');

  if (!token) {
    throw new Error('GitHub token is required. Set GH_SPOTLIGHT_TOKEN or use --token');
  }

  return token;
}

/**
 * Gets the username from context or environment
 * @returns GitHub username
 */
export function getUsername(): string {
  let username = github.context?.actor || process.env.GITHUB_USER;

  if (!username) {
    core.warning('⚠️ GitHub username not found. Using "authenticated user" as fallback.');
    username = 'authenticated user';
  }

  return username;
}

/**
 * Gets all options from environment variables or command line arguments
 * @returns Object containing all options
 */
export function getOptions() {
  return {
    delay: getInputOrArg('delay', DEFAULTS.delay),
    limit: getInputOrArg('limit', DEFAULTS.limit),
    minViews: getInputOrArg('min_views', DEFAULTS.minViews),
    includeForks: getBoolInputOrFlag('include_forks', '--include-forks'),
    includeArchived: getBoolInputOrFlag('include_archived', '--include-archived')
  };
}

/**
 * Gets a command line argument value
 * @param flag - The flag to look for
 * @returns The value of the flag or undefined
 */
export function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

/**
 * Gets a value from either GitHub Action input or command line argument
 * @param name - Name of the parameter
 * @param fallback - Default value if not found
 * @returns The parsed number value
 * @throws {Error} When the value cannot be parsed as a number
 */
export function getInputOrArg(name: string, fallback: number): number {
  const input = core.getInput?.(name);
  if (input) {
    const parsed = parseInt(input, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid number for ${name}: ${input}`);
    }
    return parsed;
  }

  const flagIndex = process.argv.indexOf(`--${name.replace(/_/g, '-')}`);
  if (flagIndex !== -1) {
    const value = process.argv[flagIndex + 1];
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid number for ${name}: ${value}`);
    }
    return parsed;
  }

  return fallback;
}

/**
 * Gets a boolean value from either GitHub Action input or command line flag
 * @param name - Name of the parameter
 * @param flag - Command line flag
 * @returns The boolean value
 */
export function getBoolInputOrFlag(name: string, flag: string): boolean {
  const input = core.getInput?.(name)?.toLowerCase();
  if (input === 'true') return true;
  if (input === 'false') return false;
  return process.argv.includes(flag);
}

/**
 * Handles errors and exits the process
 * @param error - The error to handle
 */
export function handleError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
  process.exit(1);
}

/**
 * Main entry point for the CLI and GitHub Action
 * @throws {Error} When required parameters are missing or invalid
 */
export async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    console.log(`\nUsage: node index.js [options]\n
Options:
  --token <token>         GitHub token (required)
  --limit <N>             Max repositories to show (default: ${DEFAULTS.limit})
  --delay <ms>            Delay between API calls (default: ${DEFAULTS.delay})
  --min-views <N>         Skip repos with fewer views (default: ${DEFAULTS.minViews})
  --include-forks         Include forked repositories
  --include-archived      Include archived repositories
  --help                  Show this help message
`);
    process.exit(0);
  }

  const startTime = Date.now();

  try {
    const token = getToken();
    const options = getOptions();

    const octokit = new Octokit({ auth: token });
    const username = getUsername();

    await spotlightRepos(octokit, username, {
      delay: options.delay,
      limit: options.limit,
      minViews: options.minViews,
      includeForks: options.includeForks,
      includeArchived: options.includeArchived
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    core.info(`✅ Completed in ${elapsed}s`);
  } catch (error) {
    handleError(error);
  }
}

// Run main if this is being executed directly
if (isDirectExecution()) {
  main().catch(handleError);
}
