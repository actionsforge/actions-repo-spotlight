#!/usr/bin/env node

const { main } = require('./dist/index.cjs');
const core = require('@actions/core');

function isDirectExecution() {
  return require.main === module;
}

async function runAsScript() {
  try {
    await main();
  } catch (err) {
    if (process.env.GITHUB_ACTION) {
      core.setFailed(err instanceof Error ? err.message : String(err));
    } else {
      console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }
}

if (isDirectExecution()) {
  runAsScript();
}

module.exports = { main, runAsScript, isDirectExecution };
