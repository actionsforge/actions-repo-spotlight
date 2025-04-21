#!/usr/bin/env node

import { main } from './lib/cli.js';
import { pathToFileURL } from 'url';

export function isDirectExecution() {
  return import.meta.url === pathToFileURL(process.argv[1])?.href;
}

export async function runAsScript() {
  try {
    await main();
  } catch (err) {
    if (process.env.GITHUB_ACTION) {
      const { setFailed } = await import('@actions/core');
      setFailed(err.message);
    } else {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  }
}

if (isDirectExecution()) {
  runAsScript();
}

export { main };
