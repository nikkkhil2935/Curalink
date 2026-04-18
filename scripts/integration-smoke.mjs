import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = process.cwd();
const IS_WIN = process.platform === 'win32';

const LLM_PORT = Number(process.env.SMOKE_LLM_PORT || 8011);
const API_PORT = Number(process.env.SMOKE_API_PORT || 5010);
const LLM_URL = `http://127.0.0.1:${LLM_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;

const services = [];

function loadLocalEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  process.stdout.write(`[integration-smoke] ${message}\n`);
}

function resolvePythonExecutable() {
  if (process.env.PYTHON && process.env.PYTHON.trim()) {
    return process.env.PYTHON.trim();
  }

  const candidate = IS_WIN
    ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv', 'bin', 'python');

  if (fs.existsSync(candidate)) {
    return candidate;
  }

  return 'python';
}

function resolveNpmCommand() {
  if (IS_WIN) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm --prefix server run dev']
    };
  }

  return {
    command: 'npm',
    args: ['--prefix', 'server', 'run', 'dev']
  };
}

function spawnService({ name, command, args, cwd, env }) {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('error', (error) => {
    process.stderr.write(`[${name}] process error: ${error?.message || error}\n`);
  });

  services.push({ name, child });
  return child;
}

async function waitForHealth(url, timeoutMs, label) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let lastError = 'unknown error';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        log(`${label} health is up at ${url}`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for ${label} health (${url}): ${lastError}`);
}

function terminateService({ name, child }) {
  if (!child || child.killed) {
    return;
  }

  if (IS_WIN) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore'
    });
  } else {
    child.kill('SIGTERM');
  }

  log(`Stopped ${name} (pid ${child.pid})`);
}

async function runSmoke() {
  const pythonExec = resolvePythonExecutable();
  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  const groqApiKey = String(process.env.GROQ_API_KEY || '').trim();
  const groqModel = String(process.env.GROQ_MODEL || 'llama-3.1-8b-instant').trim();

  if (!mongoUri) {
    throw new Error('MONGODB_URI is required for integration smoke and must start with "mongodb+srv://" or "mongodb://".');
  }

  if (!(mongoUri.startsWith('mongodb+srv://') || mongoUri.startsWith('mongodb://'))) {
    throw new Error('MONGODB_URI must start with "mongodb+srv://" or "mongodb://" for integration smoke.');
  }

  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is required for integration smoke in Groq-first mode.');
  }

  log(`Using Python executable: ${pythonExec}`);
  log(`Starting LLM service on port ${LLM_PORT}`);

  spawnService({
    name: 'llm',
    command: pythonExec,
    args: ['-m', 'uvicorn', 'main:app', '--app-dir', 'llm-service', '--host', '127.0.0.1', '--port', String(LLM_PORT)],
    cwd: ROOT,
    env: {
      OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
      PRIMARY_LLM_PROVIDER: 'groq',
      GROQ_API_KEY: groqApiKey,
      GROQ_MODEL: groqModel,
      LOCAL_FALLBACK_ENABLED: 'false'
    }
  });

  await waitForHealth(`${LLM_URL}/health`, 120000, 'LLM');

  log(`Starting backend service on port ${API_PORT}`);
  const npmCommand = resolveNpmCommand();
  spawnService({
    name: 'api',
    command: npmCommand.command,
    args: npmCommand.args,
    cwd: ROOT,
    env: {
      PORT: String(API_PORT),
      MONGODB_URI: mongoUri,
      LLM_SERVICE_URL: LLM_URL,
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  await waitForHealth(`${API_URL}/api/health`, 120000, 'Backend API');

  const llmHealthResponse = await fetch(`${LLM_URL}/health`);
  if (!llmHealthResponse.ok) {
    throw new Error(`LLM health check failed: HTTP ${llmHealthResponse.status}`);
  }
  const llmHealth = await llmHealthResponse.json();
  if (!llmHealth || typeof llmHealth.status !== 'string') {
    throw new Error('LLM health payload missing required status field');
  }

  const backendHealthResponse = await fetch(`${API_URL}/api/health`);
  if (!backendHealthResponse.ok) {
    throw new Error(`Backend health check failed: HTTP ${backendHealthResponse.status}`);
  }
  const backendHealth = await backendHealthResponse.json();
  const backendHealthKeys = ['status', 'version', 'uptime_ms', 'services', 'timestamp'];
  const missingHealthKeys = backendHealthKeys.filter((key) => !(key in backendHealth));
  if (missingHealthKeys.length) {
    throw new Error(`Backend health payload missing fields: ${missingHealthKeys.join(', ')}`);
  }

  if (backendHealth?.services?.db !== 'connected') {
    throw new Error(`Expected backend health services.db=connected but received: ${backendHealth?.services?.db || 'unknown'}`);
  }

  const sessionResponse = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      disease: 'asthma',
      intent: 'treatment',
      location: {
        city: 'Boston',
        country: 'USA'
      }
    })
  });

  if (!sessionResponse.ok) {
    const text = await sessionResponse.text();
    throw new Error(`Session creation failed: HTTP ${sessionResponse.status} ${text}`);
  }

  const sessionData = await sessionResponse.json();
  const sessionId = sessionData?.session?._id;
  if (!sessionId) {
    throw new Error('Session ID missing in /api/sessions response');
  }

  log(`Created smoke session ${sessionId}`);

  const queryResponse = await fetch(`${API_URL}/api/sessions/${sessionId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'latest treatment options' })
  });

  if (!queryResponse.ok) {
    const text = await queryResponse.text();
    throw new Error(`Query failed: HTTP ${queryResponse.status} ${text}`);
  }

  const queryData = await queryResponse.json();
  const message = queryData?.message;
  const structured = message?.structuredAnswer;
  const sources = Array.isArray(queryData?.sources) ? queryData.sources : [];
  const pipelineTimings =
    message?.trace?.pipeline_timings ||
    message?.retrievalStats?.pipeline_timings ||
    queryData?.trace?.pipeline_timings ||
    [];

  if (!message || message.role !== 'assistant') {
    throw new Error('Expected assistant message in query response');
  }

  if (!structured || typeof structured !== 'object') {
    throw new Error('Expected structuredAnswer object in query response');
  }

  const activeProvider = String(message?.trace?.llm?.provider || queryData?.trace?.llm?.provider || '').toLowerCase();
  if (activeProvider !== 'groq') {
    throw new Error(`Expected Groq provider in smoke query but received: ${activeProvider || 'unknown'}`);
  }

  if (!Array.isArray(structured.follow_up_suggestions) || structured.follow_up_suggestions.length === 0) {
    throw new Error('Expected follow_up_suggestions in structured answer');
  }

  if (sources.length === 0) {
    throw new Error('Expected at least one source in query response');
  }

  if (!Array.isArray(pipelineTimings) || pipelineTimings.length === 0) {
    throw new Error('Expected pipeline_timings in query response trace payload');
  }

  const assistantMessageId = message?._id;
  if (!assistantMessageId) {
    throw new Error('Assistant message id missing from query response');
  }

  const bookmarkCreateResponse = await fetch(
    `${API_URL}/api/sessions/${sessionId}/messages/${assistantMessageId}/bookmark`,
    { method: 'POST' }
  );
  if (!bookmarkCreateResponse.ok) {
    const text = await bookmarkCreateResponse.text();
    throw new Error(`Bookmark create failed: HTTP ${bookmarkCreateResponse.status} ${text}`);
  }
  const bookmarkCreate = await bookmarkCreateResponse.json();
  if (!bookmarkCreate?.isBookmarked) {
    throw new Error('Expected isBookmarked=true after first bookmark toggle');
  }

  const bookmarksListResponse = await fetch(`${API_URL}/api/bookmarks`);
  if (!bookmarksListResponse.ok) {
    const text = await bookmarksListResponse.text();
    throw new Error(`Bookmarks list failed: HTTP ${bookmarksListResponse.status} ${text}`);
  }
  const bookmarksList = await bookmarksListResponse.json();
  const hasBookmarkedMessage = (bookmarksList?.groups || []).some((group) =>
    (group?.bookmarks || []).some((entry) => entry?.messageId === String(assistantMessageId))
  );
  if (!hasBookmarkedMessage) {
    throw new Error('Bookmarked message not found in /api/bookmarks response');
  }

  const bookmarkDeleteResponse = await fetch(
    `${API_URL}/api/sessions/${sessionId}/messages/${assistantMessageId}/bookmark`,
    { method: 'POST' }
  );
  if (!bookmarkDeleteResponse.ok) {
    const text = await bookmarkDeleteResponse.text();
    throw new Error(`Bookmark delete failed: HTTP ${bookmarkDeleteResponse.status} ${text}`);
  }
  const bookmarkDelete = await bookmarkDeleteResponse.json();
  if (bookmarkDelete?.isBookmarked) {
    throw new Error('Expected isBookmarked=false after second bookmark toggle');
  }

  const exportJsonResponse = await fetch(`${API_URL}/api/sessions/${sessionId}/export?format=json`);
  if (!exportJsonResponse.ok) {
    const text = await exportJsonResponse.text();
    throw new Error(`Export JSON failed: HTTP ${exportJsonResponse.status} ${text}`);
  }
  const exportJson = await exportJsonResponse.json();
  if (!exportJson?.session || !Array.isArray(exportJson?.messages)) {
    throw new Error('Export JSON payload missing session or messages array');
  }

  const analyticsOverviewResponse = await fetch(`${API_URL}/api/analytics/overview`);
  if (!analyticsOverviewResponse.ok) {
    const text = await analyticsOverviewResponse.text();
    throw new Error(`Analytics overview failed: HTTP ${analyticsOverviewResponse.status} ${text}`);
  }
  const analyticsOverview = await analyticsOverviewResponse.json();
  const requiredOverviewFields = [
    'total_sessions',
    'total_queries',
    'avg_latency_ms',
    'p95_latency_ms',
    'top_intents',
    'daily_activity',
    'source_distribution'
  ];
  const missingOverviewFields = requiredOverviewFields.filter((field) => !(field in analyticsOverview));
  if (missingOverviewFields.length) {
    throw new Error(`Analytics overview missing fields: ${missingOverviewFields.join(', ')}`);
  }

  const historySearchResponse = await fetch(
    `${API_URL}/api/sessions/history/search?q=${encodeURIComponent('latest treatment')}&limit=20`
  );
  if (!historySearchResponse.ok) {
    const text = await historySearchResponse.text();
    throw new Error(`History search failed: HTTP ${historySearchResponse.status} ${text}`);
  }
  const historySearch = await historySearchResponse.json();
  if (!Array.isArray(historySearch?.results)) {
    throw new Error('History search response missing results array');
  }

  log(`Smoke query verified: sources=${sources.length}, followUps=${structured.follow_up_suggestions.length}, pipelineTimings=${pipelineTimings.length}`);
}

async function main() {
  loadLocalEnvFile(path.join(ROOT, '.env'));
  loadLocalEnvFile(path.join(ROOT, 'server', '.env'));

  try {
    await runSmoke();
    log('Integration smoke passed.');
  } catch (error) {
    console.error('[integration-smoke] FAILED:', error?.message || error);
    process.exitCode = 1;
  } finally {
    for (const service of [...services].reverse()) {
      terminateService(service);
    }
  }
}

main();
