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

  log(`Using Python executable: ${pythonExec}`);
  log(`Starting LLM service on port ${LLM_PORT}`);

  spawnService({
    name: 'llm',
    command: pythonExec,
    args: ['-m', 'uvicorn', 'main:app', '--app-dir', 'llm-service', '--host', '127.0.0.1', '--port', String(LLM_PORT)],
    cwd: ROOT,
    env: {
      OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434'
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
      LLM_SERVICE_URL: LLM_URL,
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  await waitForHealth(`${API_URL}/api/health`, 120000, 'Backend API');

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

  if (!message || message.role !== 'assistant') {
    throw new Error('Expected assistant message in query response');
  }

  if (!structured || typeof structured !== 'object') {
    throw new Error('Expected structuredAnswer object in query response');
  }

  if (!Array.isArray(structured.follow_up_suggestions) || structured.follow_up_suggestions.length === 0) {
    throw new Error('Expected follow_up_suggestions in structured answer');
  }

  if (sources.length === 0) {
    throw new Error('Expected at least one source in query response');
  }

  log(`Smoke query verified: sources=${sources.length}, followUps=${structured.follow_up_suggestions.length}`);
}

async function main() {
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
