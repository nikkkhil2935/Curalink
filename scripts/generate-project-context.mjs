import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_MD = path.join(ROOT, 'PROJECT_CONTEXT.md');
const OUTPUT_JSON = path.join(ROOT, 'PROJECT_CONTEXT.json');

const TREE_IGNORE = new Set([
  '.git',
  '.venv',
  'node_modules',
  'dist',
  'build',
  '__pycache__',
  '.DS_Store',
  '.idea',
  '.vscode'
]);

const EXPRESS_ROUTE_FILES = [
  { file: 'server/src/routes/sessions.js', prefix: '/api/sessions' },
  { file: 'server/src/routes/query.js', prefix: '/api' },
  { file: 'server/src/routes/analytics.js', prefix: '/api/analytics' },
  { file: 'server/src/routes/export.js', prefix: '/api/export' }
];

const IMPORTANT_ENV_HINTS = [
  'MONGODB_URI',
  'MONGODB_URI_FALLBACK',
  'MONGODB_URI_LOCAL',
  'MONGODB_ALLOW_LOCAL_FALLBACK',
  'MONGODB_MEMORY_FALLBACK',
  'LLM_SERVICE_URL',
  'FRONTEND_URL',
  'PORT',
  'NODE_ENV',
  'PUBMED_EMAIL',
  'VITE_API_URL',
  'VITE_DEV_API_PROXY',
  'OLLAMA_URL',
  'OLLAMA_MODEL',
  'OLLAMA_EMBED_MODEL',
  'GROQ_API_KEY',
  'LOCAL_FALLBACK_ENABLED',
  'USE_LANGGRAPH_WORKFLOW'
];

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function relPath(filePath) {
  return toPosixPath(path.relative(ROOT, filePath));
}

async function safeRead(file) {
  try {
    return await fs.readFile(path.join(ROOT, file), 'utf8');
  } catch {
    return '';
  }
}

async function safeReadJson(file) {
  const raw = await safeRead(file);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseRequirements(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function extractEnvEntries(content) {
  const entries = [];
  let pendingComments = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      pendingComments = [];
      continue;
    }

    if (line.startsWith('#')) {
      pendingComments.push(line.replace(/^#\s?/, ''));
      continue;
    }

    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) {
      pendingComments = [];
      continue;
    }

    const [, key, value] = match;
    entries.push({
      key,
      value,
      note: pendingComments.join(' ').trim()
    });

    pendingComments = [];
  }

  return entries;
}

function normalizeJoinedPath(prefix, routePath) {
  const joined = `${prefix}/${routePath}`.replace(/\/+/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

function extractExpressRoutes(content, prefix, file) {
  const routes = [];
  const regex = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  let match = regex.exec(content);

  while (match) {
    routes.push({
      method: match[1].toUpperCase(),
      path: normalizeJoinedPath(prefix, match[2]),
      file
    });
    match = regex.exec(content);
  }

  return routes;
}

function extractAppRoutes(content, file) {
  const routes = [];
  const regex = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  let match = regex.exec(content);

  while (match) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      file
    });
    match = regex.exec(content);
  }

  return routes;
}

function extractFastApiRoutes(content, file) {
  const routes = [];
  const regex = /@app\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
  let match = regex.exec(content);

  while (match) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      file
    });
    match = regex.exec(content);
  }

  return routes;
}

function extractFrontendRoutes(content, file) {
  const routes = [];
  const regex = /<Route\s+path="([^"]+)"/g;
  let match = regex.exec(content);

  while (match) {
    routes.push({ path: match[1], file });
    match = regex.exec(content);
  }

  return routes;
}

function extractEnvUsagesFromNode(content) {
  const keys = new Set();
  const regex = /process\.env\.([A-Z0-9_]+)/g;
  let match = regex.exec(content);

  while (match) {
    keys.add(match[1]);
    match = regex.exec(content);
  }

  return [...keys];
}

function extractEnvUsagesFromPython(content) {
  const keys = new Set();
  const regex = /os\.getenv\(\s*["']([A-Z0-9_]+)["']/g;
  let match = regex.exec(content);

  while (match) {
    keys.add(match[1]);
    match = regex.exec(content);
  }

  return [...keys];
}

async function buildTreeLines(dir, depth = 0, maxDepth = 2) {
  if (depth > maxDepth) {
    return [];
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const visible = entries
    .filter((entry) => !TREE_IGNORE.has(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const lines = [];
  for (const entry of visible) {
    const full = path.join(dir, entry.name);
    const relative = relPath(full);
    const indent = '  '.repeat(depth);

    if (entry.isDirectory()) {
      lines.push(`${indent}- ${relative}/`);
      if (depth < maxDepth) {
        const childLines = await buildTreeLines(full, depth + 1, maxDepth);
        lines.push(...childLines);
      }
    } else {
      lines.push(`${indent}- ${relative}`);
    }
  }

  return lines;
}

function dedupeRoutes(routes) {
  const seen = new Set();
  const out = [];

  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(route);
  }

  return out.sort((a, b) => {
    const methodCmp = a.method.localeCompare(b.method);
    if (methodCmp !== 0) return methodCmp;
    return a.path.localeCompare(b.path);
  });
}

function renderMarkdown(context) {
  const lines = [];

  lines.push('# PROJECT CONTEXT');
  lines.push('');
  lines.push(`Last Updated: ${context.generatedAt}`);
  lines.push(`Workspace: ${context.workspaceName}`);
  lines.push('');

  lines.push('## What This Is');
  lines.push('- Auto-generated project snapshot for quick operational context.');
  lines.push('- Regenerate with: `npm run context:refresh`');
  lines.push('- Full verification run (and refresh): `npm run doctor`');
  lines.push('');

  lines.push('## Services');
  for (const service of context.services) {
    lines.push(`- ${service.name}`);
    lines.push(`  - Path: ${service.path}`);
    lines.push(`  - Startup: ${service.startup}`);
    lines.push(`  - Health: ${service.health}`);
  }
  lines.push('');

  lines.push('## Required Connections (You Must Provide)');
  for (const conn of context.requiredConnections) {
    lines.push(`- ${conn}`);
  }
  lines.push('');

  lines.push('## Environment Variables');
  for (const group of context.envGroups) {
    lines.push(`### ${group.name}`);
    if (group.entries.length === 0) {
      lines.push('- No variables discovered.');
    } else {
      for (const entry of group.entries) {
        const note = entry.note ? ` (${entry.note})` : '';
        lines.push(`- ${entry.key}=${entry.value}${note}`);
      }
    }
    lines.push('');
  }

  lines.push('## Backend API Endpoints');
  for (const route of context.backendRoutes) {
    lines.push(`- ${route.method} ${route.path} (${route.file})`);
  }
  lines.push('');

  lines.push('## LLM API Endpoints');
  for (const route of context.llmRoutes) {
    lines.push(`- ${route.method} ${route.path} (${route.file})`);
  }
  lines.push('');

  lines.push('## Frontend Routes');
  for (const route of context.frontendRoutes) {
    lines.push(`- ${route.path} (${route.file})`);
  }
  lines.push('');

  lines.push('## Dependencies Snapshot');
  lines.push(`- Root dependencies: ${context.dependencies.root.length}`);
  lines.push(`- Client dependencies: ${context.dependencies.client.length}`);
  lines.push(`- Server dependencies: ${context.dependencies.server.length}`);
  lines.push(`- LLM python requirements: ${context.dependencies.llm.length}`);
  lines.push('');

  lines.push('## Quick Checks');
  for (const cmd of context.quickChecks) {
    lines.push(`- ${cmd}`);
  }
  lines.push('');

  lines.push('## Workspace Tree (Depth 2)');
  lines.push(...context.treeLines);
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const rootPackage = await safeReadJson('package.json');
  const clientPackage = await safeReadJson('client/package.json');
  const serverPackage = await safeReadJson('server/package.json');

  const serverEnvExample = extractEnvEntries(await safeRead('server/.env.example'));
  const clientEnvExample = extractEnvEntries(await safeRead('client/.env.example'));
  const clientEnvProd = extractEnvEntries(await safeRead('client/.env.production'));

  const appJs = await safeRead('server/src/app.js');
  const serverLlmJs = await safeRead('server/src/services/llm.js');
  const llmMain = await safeRead('llm-service/main.py');
  const appJsx = await safeRead('client/src/App.jsx');

  const backendRoutes = [];
  for (const entry of EXPRESS_ROUTE_FILES) {
    const content = await safeRead(entry.file);
    backendRoutes.push(...extractExpressRoutes(content, entry.prefix, entry.file));
  }
  backendRoutes.push(...extractAppRoutes(appJs, 'server/src/app.js'));

  const llmRoutes = extractFastApiRoutes(llmMain, 'llm-service/main.py');
  const frontendRoutes = extractFrontendRoutes(appJsx, 'client/src/App.jsx');

  const backendEnvUsage = [
    ...extractEnvUsagesFromNode(appJs),
    ...extractEnvUsagesFromNode(serverLlmJs)
  ];
  const llmEnvUsage = extractEnvUsagesFromPython(llmMain);

  const discoveredEnv = new Set([
    ...IMPORTANT_ENV_HINTS,
    ...serverEnvExample.map((item) => item.key),
    ...clientEnvExample.map((item) => item.key),
    ...clientEnvProd.map((item) => item.key),
    ...backendEnvUsage,
    ...llmEnvUsage
  ]);

  const requiredConnections = [
    'MongoDB URI must be valid and reachable (Atlas or local fallback).',
    'LLM service URL must point to running FastAPI service (default http://127.0.0.1:8001).',
    'Frontend origin must be listed in FRONTEND_URL for CORS in backend.',
    'If using Ollama, ensure OLLAMA_URL and OLLAMA_MODEL are reachable/available.',
    'If using hosted fallback, set GROQ_API_KEY.',
    'Internet access is required for PubMed, OpenAlex, and ClinicalTrials retrieval APIs.'
  ];

  const treeLines = await buildTreeLines(ROOT, 0, 2);

  const context = {
    generatedAt: new Date().toISOString(),
    workspaceName: path.basename(ROOT),
    services: [
      {
        name: 'Frontend (React + Vite)',
        path: 'client',
        startup: 'npm --prefix client run dev',
        health: 'Open http://localhost:5173'
      },
      {
        name: 'Backend (Express + MongoDB)',
        path: 'server',
        startup: 'npm --prefix server run dev',
        health: 'GET http://127.0.0.1:5000/api/health'
      },
      {
        name: 'LLM Service (FastAPI)',
        path: 'llm-service',
        startup: 'python -m uvicorn main:app --app-dir llm-service --host 127.0.0.1 --port 8001',
        health: 'GET http://127.0.0.1:8001/health'
      }
    ],
    requiredConnections,
    envGroups: [
      {
        name: 'Backend (.env.example)',
        entries: serverEnvExample
      },
      {
        name: 'Frontend (.env.example + .env.production)',
        entries: [...clientEnvExample, ...clientEnvProd]
      },
      {
        name: 'Discovered In Code (process.env/os.getenv)',
        entries: [...discoveredEnv]
          .sort((a, b) => a.localeCompare(b))
          .map((key) => ({ key, value: '<set-as-needed>', note: '' }))
      }
    ],
    backendRoutes: dedupeRoutes(backendRoutes),
    llmRoutes: dedupeRoutes(llmRoutes),
    frontendRoutes,
    dependencies: {
      root: Object.keys(rootPackage?.dependencies || {}),
      client: Object.keys(clientPackage?.dependencies || {}),
      server: Object.keys(serverPackage?.dependencies || {}),
      llm: parseRequirements(await safeRead('llm-service/requirements.txt'))
    },
    quickChecks: [
      'npm --prefix server run check',
      'npm --prefix client run check',
      'python -m py_compile llm-service/main.py',
      'Invoke-RestMethod -Method Get -Uri http://127.0.0.1:5000/api/health',
      'Invoke-RestMethod -Method Get -Uri http://127.0.0.1:8001/health'
    ],
    treeLines
  };

  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUTPUT_MD, renderMarkdown(context), 'utf8');

  process.stdout.write(
    `Updated ${relPath(OUTPUT_MD)} and ${relPath(OUTPUT_JSON)} at ${context.generatedAt}\n`
  );
}

main().catch((error) => {
  console.error('Failed to generate project context:', error);
  process.exitCode = 1;
});
