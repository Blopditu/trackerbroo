import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { JSDOM } from 'jsdom';
import axeCore from 'axe-core';

const browserDir = path.resolve('dist/proteintracker/browser');

async function listHtmlFiles(rootDir) {
  const queue = [rootDir];
  const files = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      break;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile() && entry.name === 'index.html') {
        files.push(fullPath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function routeFromFile(file) {
  const relative = path.relative(browserDir, file);
  const cleaned = relative.replace(/index\.html$/, '').replace(/\\/g, '/');
  return cleaned === '' ? '/' : `/${cleaned.replace(/\/$/, '')}`;
}

async function runAxeOnHtml(filePath) {
  const rawHtml = await fs.readFile(filePath, 'utf8');
  const hasHtmlTag = /<html[\s>]/i.test(rawHtml);
  let html = hasHtmlTag
    ? rawHtml
    : `<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"></head><body>${rawHtml}</body></html>`;

  html = html.replace(/<html(?![^>]*\blang=)([^>]*)>/i, '<html lang=\"de\"$1>');
  const dom = new JSDOM(html, {
    url: 'https://trackerbroo.local/',
    runScripts: 'dangerously',
  });

  const { window } = dom;
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.eval(axeCore.source);

  const results = await window.axe.run(window.document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa'],
    },
    resultTypes: ['violations'],
  });

  window.close();
  return results.violations || [];
}

async function main() {
  let files;
  try {
    files = await listHtmlFiles(browserDir);
  } catch {
    console.error('A11y check failed: build output not found at dist/proteintracker/browser');
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('A11y check failed: no prerendered route files found.');
    process.exit(1);
  }

  let failingCount = 0;

  for (const file of files) {
    const route = routeFromFile(file);
    const violations = await runAxeOnHtml(file);
    const severe = violations.filter(
      (item) => item.impact === 'critical' || item.impact === 'serious',
    );

    if (severe.length === 0) {
      console.log(`PASS ${route}`);
      continue;
    }

    failingCount += severe.length;
    console.error(`FAIL ${route}`);
    for (const issue of severe) {
      const impact = issue.impact || 'unknown';
      const nodeCount = issue.nodes?.length || 0;
      console.error(`  - [${impact}] ${issue.id}: ${issue.help} (${nodeCount} nodes)`);
      console.error(`    ${issue.helpUrl}`);
    }
  }

  if (failingCount > 0) {
    console.error(`A11y gating failed with ${failingCount} serious/critical violations.`);
    process.exit(1);
  }

  console.log('A11y gating passed with 0 serious/critical violations.');
}

void main();
