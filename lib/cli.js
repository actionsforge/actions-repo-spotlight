import 'dotenv/config';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { spotlightRepos } from './spotlight.js';

const DEFAULTS = {
  delay: 300,
  limit: 6,
  minViews: 0,
  includeForks: false,
  includeArchived: false
};

export async function main() {
  if (process.argv.includes('--help')) {
    console.log(`\nUsage: node index.js [options]\n
Options:
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

  const token =
    process.env.GH_SPOTLIGHT_TOKEN ||
    process.env.GITHUB_TOKEN ||
    core.getInput?.('token') ||
    getArg('--token');

  if (!token) {
    console.error('❌ GitHub token is required.');
    process.exit(1);
  }

  const delay = parseInt(getInputOrArg('delay', DEFAULTS.delay), 10);
  const limit = parseInt(getInputOrArg('limit', DEFAULTS.limit), 10);
  const minViews = parseInt(getInputOrArg('min_views', DEFAULTS.minViews), 10);
  const includeForks = getBoolInputOrFlag('include_forks', '--include-forks');
  const includeArchived = getBoolInputOrFlag('include_archived', '--include-archived');

  const octokit = github.getOctokit(token);
  const username = github.context?.actor || process.env.GITHUB_USER;

  await spotlightRepos(octokit, username, {
    delay,
    limit,
    minViews,
    includeForks,
    includeArchived
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  core.info(`✅ Completed in ${elapsed}s`);
}

function getArg(flag, fallback = undefined) {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : fallback;
}

function getInputOrArg(name, fallback) {
  return core.getInput?.(name) || getArg(`--${name.replace(/_/g, '-')}`, fallback);
}

function getBoolInputOrFlag(name, flag) {
  const input = core.getInput?.(name)?.toLowerCase();
  if (input === 'true') return true;
  if (input === 'false') return false;
  return process.argv.includes(flag);
}

export { getBoolInputOrFlag };
