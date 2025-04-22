#!/usr/bin/env node
import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import { pathToFileURL } from 'url';

var DEFAULTS = {
  delay: 300,
  limit: 6,
  minViews: 0};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function spotlightRepos(octokit, username, {
  delay = 300,
  limit = 6,
  minViews = 0,
  includeForks = false,
  includeArchived = false
} = {}) {
  core.info(`\u{1F50D} Fetching repositories for ${username || "authenticated user"}...`);
  core.info(`\u23F1\uFE0F Delay between traffic API calls: ${delay}ms`);
  core.info(`\u{1F522} Limit: ${limit}`);
  core.info(`\u{1F4C9} Minimum views: ${minViews}`);
  core.info(`\u{1F374} Include forks: ${includeForks}`);
  core.info(`\u{1F4E6} Include archived: ${includeArchived}`);
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    visibility: "all",
    affiliation: "owner",
    per_page: 100
  });
  const trafficData = [];
  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    if (!includeArchived && repo.archived) continue;
    if (!includeForks && repo.fork) continue;
    if (i > 0 && i % 25 === 0) {
      const autoDelay = Math.floor(Math.random() * 50 + delay * 0.5);
      core.info(`\u23F8\uFE0F Auto delay (${autoDelay}ms) [repo ${i}/${repos.length}]`);
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
      core.warning(`\u26A0\uFE0F Skipped ${repo.full_name}: API Error - ${message}`);
    }
  }
  if (trafficData.length === 0) {
    core.warning("\u26A0\uFE0F No repositories met the view criteria.");
    return [];
  }
  trafficData.sort((a, b) => b.views - a.views);
  const top = trafficData.slice(0, limit);
  core.info(
    `\u{1F4CA} Top ${top.length} repositories by views:
${top.map(
      (r, i) => `${i + 1}. ${r.name} \u2014 ${r.views} views`
    ).join("\n")}`
  );
  return top;
}
function isDirectExecution() {
  return import.meta.url === pathToFileURL(process.argv[1])?.href;
}
function getToken() {
  const token = process.env.GH_SPOTLIGHT_TOKEN || process.env.GITHUB_TOKEN || core.getInput?.("token") || getArg("--token");
  if (!token) {
    throw new Error("GitHub token is required. Set GH_SPOTLIGHT_TOKEN or use --token");
  }
  return token;
}
function getUsername() {
  let username = github.context?.actor || process.env.GITHUB_USER;
  if (!username) {
    core.warning('\u26A0\uFE0F GitHub username not found. Using "authenticated user" as fallback.');
    username = "authenticated user";
  }
  return username;
}
function getOptions() {
  return {
    delay: getInputOrArg("delay", DEFAULTS.delay),
    limit: getInputOrArg("limit", DEFAULTS.limit),
    minViews: getInputOrArg("min_views", DEFAULTS.minViews),
    includeForks: getBoolInputOrFlag("include_forks", "--include-forks"),
    includeArchived: getBoolInputOrFlag("include_archived", "--include-archived")
  };
}
function getArg(flag) {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : void 0;
}
function getInputOrArg(name, fallback) {
  const input = core.getInput?.(name);
  if (input) {
    const parsed = parseInt(input, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid number for ${name}: ${input}`);
    }
    return parsed;
  }
  const flagIndex = process.argv.indexOf(`--${name.replace(/_/g, "-")}`);
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
function getBoolInputOrFlag(name, flag) {
  const input = core.getInput?.(name)?.toLowerCase();
  if (input === "true") return true;
  if (input === "false") return false;
  return process.argv.includes(flag);
}
function handleError(error) {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
  process.exit(1);
}
async function main() {
  if (process.argv.includes("--help")) {
    console.log(`
Usage: node index.js [options]

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
    const elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
    core.info(`\u2705 Completed in ${elapsed}s`);
  } catch (error) {
    handleError(error);
  }
}
if (isDirectExecution()) {
  main().catch(handleError);
}

export { getArg, getBoolInputOrFlag, getInputOrArg, getOptions, getToken, getUsername, handleError, isDirectExecution, main, spotlightRepos };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map