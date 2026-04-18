import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IS_WIN = process.platform === 'win32';
const LLM_PORT = Number(process.env.BENCH_LLM_PORT || 8012);
const API_PORT = Number(process.env.BENCH_API_PORT || 5011);
const LLM_URL = `http://127.0.0.1:${LLM_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const SAMPLE_COUNT = 10;
const TARGET_MEDIAN_MS = 1500;
const TARGET_MAX_MS = 5000;

const services = [];

function log(message) {
  process.stdout.write(`[latency-bench] ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  const boundedIndex = Math.max(0, Math.min(sortedValues.length - 1, index));
  return sortedValues[boundedIndex];
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

function resolveServerCommand() {
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

function spawnService({ name, command, args, env }) {
  const child = spawn(command, args, {
    cwd: ROOT,
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

  services.push({ name, child });
  return child;
}

function stopService({ name, child }) {
  if (!child || child.killed) return;

  if (IS_WIN) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }

  log(`Stopped ${name} (pid ${child.pid})`);
}

async function waitForHealth(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'unknown';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
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

async function runBench() {
  const pythonExec = resolvePythonExecutable();
  const serverCommand = resolveServerCommand();
  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  const groqApiKey = String(process.env.GROQ_API_KEY || '').trim();
  const groqModel = String(process.env.GROQ_MODEL || 'llama-3.1-8b-instant').trim();

  if (!mongoUri) {
    throw new Error('MONGODB_URI is required for latency benchmark and must be an Atlas SRV URI.');
  }

  if (!mongoUri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI must start with "mongodb+srv://" for latency benchmark.');
  }

  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is required for latency benchmark in Groq-first mode.');
  }

  spawnService({
    name: 'llm',
    command: pythonExec,
    args: ['-m', 'uvicorn', 'main:app', '--app-dir', 'llm-service', '--host', '127.0.0.1', '--port', String(LLM_PORT)],
    env: {
      OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
      PRIMARY_LLM_PROVIDER: 'groq',
      GROQ_API_KEY: groqApiKey,
      GROQ_MODEL: groqModel,
      LOCAL_FALLBACK_ENABLED: 'false'
    }
  });

  await waitForHealth(`${LLM_URL}/health`, 120000, 'LLM');

  spawnService({
    name: 'api',
    command: serverCommand.command,
    args: serverCommand.args,
    env: {
      PORT: String(API_PORT),
      MONGODB_URI: mongoUri,
      LLM_SERVICE_URL: LLM_URL,
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  await waitForHealth(`${API_URL}/api/health`, 120000, 'API');

  const createSessionResponse = await fetch(`${API_URL}/api/sessions`, {
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

  if (!createSessionResponse.ok) {
    throw new Error(`Failed to create benchmark session: HTTP ${createSessionResponse.status}`);
  }

  const sessionData = await createSessionResponse.json();
  const sessionId = sessionData?.session?._id;
  if (!sessionId) {
    throw new Error('Benchmark session id missing from create response');
  }

  const benchmarkQuery = 'latest treatment options';

  // Warm-up request primes retrieval and query-response cache and is not counted.
  const warmUpResponse = await fetch(`${API_URL}/api/sessions/${sessionId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
    body: JSON.stringify({ message: benchmarkQuery })
  });
  if (!warmUpResponse.ok) {
    throw new Error(`Warm-up query failed: HTTP ${warmUpResponse.status}`);
  }
  const warmupPayload = await warmUpResponse.json();
  const warmupProvider = String(
    warmupPayload?.message?.trace?.llm?.provider || warmupPayload?.trace?.llm?.provider || ''
  ).toLowerCase();
  if (warmupProvider !== 'groq') {
    throw new Error(`Expected Groq provider during warm-up but received: ${warmupProvider || 'unknown'}`);
  }

  const samples = [];
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const startedAt = Date.now();
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
      body: JSON.stringify({ message: benchmarkQuery })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Benchmark query ${i + 1} failed: HTTP ${response.status} ${text}`);
    }

    const payload = await response.json();
    if (!payload?.message || !Array.isArray(payload?.sources)) {
      throw new Error(`Benchmark query ${i + 1} returned invalid payload shape`);
    }

    const elapsed = Date.now() - startedAt;
    samples.push(elapsed);
    log(`Query ${i + 1}/${SAMPLE_COUNT}: ${elapsed} ms`);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const medianMs = percentile(sorted, 50);
  const p95Ms = percentile(sorted, 95);
  const maxMs = sorted[sorted.length - 1] || 0;
  const passed = medianMs <= TARGET_MEDIAN_MS && maxMs <= TARGET_MAX_MS;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(ROOT, 'graphify-out', `latency-bench-${timestamp}.json`);
  const output = {
    timestamp: new Date().toISOString(),
    sample_count: SAMPLE_COUNT,
    warmup_included: false,
    thresholds: {
      median_ms: TARGET_MEDIAN_MS,
      max_ms: TARGET_MAX_MS,
      p95_ms: TARGET_MAX_MS
    },
    samples_ms: samples,
    median_ms: medianMs,
    p95_ms: p95Ms,
    max_ms: maxMs,
    passed
  };

  fs.mkdirSync(path.join(ROOT, 'graphify-out'), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  log(`Wrote benchmark output: ${path.relative(ROOT, outputPath)}`);

  if (!passed) {
    throw new Error(
      `Latency benchmark failed: median=${medianMs}ms (target<=${TARGET_MEDIAN_MS}), max=${maxMs}ms (target<=${TARGET_MAX_MS})`
    );
  }
}

async function main() {
  try {
    await runBench();
    log('Latency benchmark passed.');
  } catch (error) {
    console.error('[latency-bench] FAILED:', error?.message || error);
    process.exitCode = 1;
  } finally {
    for (const service of [...services].reverse()) {
      stopService(service);
    }
  }
}

main();
