import * as core from '@actions/core';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function spotlightRepos(octokit, username, {
  delay = 300,
  limit = 6,
  minViews = 0,
  includeForks = false,
  includeArchived = false
} = {}) {
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

  const trafficData = [];

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
    } catch (e) {
      core.warning(`⚠️ Skipped ${repo.full_name}: ${e.message}`);
    }
  }

  if (trafficData.length === 0) {
    core.warning('⚠️ No repositories met the view criteria.');
    return;
  }

  trafficData.sort((a, b) => b.views - a.views);
  const top = trafficData.slice(0, limit);

  core.info(
    `📊 Top ${top.length} repositories by views:\n${top.map(
      (r, i) => `${i + 1}. ${r.name} — ${r.views} views`
    ).join('\n')}`
  );
}
