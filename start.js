const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const concurrently = require('concurrently');

const rootDir = __dirname;
const preferredPython = path.join(rootDir, '.venv', 'Scripts', 'python.exe');
const pythonCmd = fs.existsSync(preferredPython) ? `"${preferredPython}"` : 'python';
const DEFAULT_LLM_PORT = 8001;
const DEFAULT_CLIENT_PORT = 5173;
const DEFAULT_LLM_PROVIDER = 'groq';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_OLLAMA_MODEL = 'llama3.1:8b';

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

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }

  return parsed;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error?.code === 'EADDRINUSE' || error?.code === 'EACCES') {
        resolve(false);
        return;
      }

      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort, maxAttempts = 25) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    if (candidate > 65535) {
      break;
    }

    // Reserve the first local port that is currently free.
    // This avoids crashing when a stale process already owns the preferred port.
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

async function run() {
  loadLocalEnvFile(path.join(rootDir, '.env'));
  loadLocalEnvFile(path.join(rootDir, 'server', '.env'));
  loadLocalEnvFile(path.join(rootDir, 'llm-service', '.env'));

  const requestedLlmPort = parsePort(process.env.LLM_PORT, DEFAULT_LLM_PORT);
  const llmPort = await findAvailablePort(requestedLlmPort);
  const clientPort = parsePort(process.env.CLIENT_PORT, DEFAULT_CLIENT_PORT);
  const llmUrl = `http://127.0.0.1:${llmPort}`;
  const configuredProvider = String(process.env.LLM_PROVIDER || process.env.PRIMARY_LLM_PROVIDER || DEFAULT_LLM_PROVIDER)
    .trim()
    .toLowerCase();
  const llmProvider = configuredProvider === 'ollama' ? 'ollama' : 'groq';
  const groqModel = String(process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL).trim();
  const ollamaModel = String(process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL).trim();
  const localFallbackEnabled = String(
    process.env.LOCAL_FALLBACK_ENABLED || (llmProvider === 'groq' ? 'false' : 'true')
  )
    .trim()
    .toLowerCase();

  if (llmPort !== requestedLlmPort) {
    console.warn(`[START] Port ${requestedLlmPort} is in use. LLM service will run on ${llmPort}.`);
  }

  if (llmProvider === 'groq' && !String(process.env.GROQ_API_KEY || '').trim()) {
    console.warn('[START] GROQ_API_KEY is not set. Groq requests will fail unless Ollama fallback is reachable.');
  }

  console.log(`[START] LLM URL: ${llmUrl}`);
  console.log(`[START] PRIMARY_LLM_PROVIDER: ${llmProvider}`);
  console.log(`[START] GROQ_MODEL: ${groqModel}`);
  console.log(`[START] OLLAMA_MODEL: ${ollamaModel}`);
  console.log(`[START] LOCAL_FALLBACK_ENABLED: ${localFallbackEnabled}`);

  const { result, commands } = concurrently(
    [
      {
        name: 'LLM',
        command: `${pythonCmd} -m uvicorn main:app --app-dir llm-service --host 0.0.0.0 --port ${llmPort}`,
        env: {
          ...process.env,
          PRIMARY_LLM_PROVIDER: llmProvider,
          GROQ_MODEL: groqModel,
          OLLAMA_MODEL: ollamaModel,
          LOCAL_FALLBACK_ENABLED: localFallbackEnabled
        },
        prefixColor: 'cyan'
      },
      {
        name: 'SERVER',
        command: 'npm --prefix server run dev',
        env: {
          ...process.env,
          LLM_SERVICE_URL: llmUrl
        },
        prefixColor: 'green'
      },
      {
        name: 'CLIENT',
        command: `npm --prefix client run dev -- --host 0.0.0.0 --port ${clientPort}`,
        prefixColor: 'magenta'
      }
    ],
    {
      cwd: rootDir,
      prefix: '[{name}]',
      killOthersOn: ['failure', 'success'],
      restartTries: 0
    }
  );

  const shutdown = () => {
    for (const command of commands) {
      try {
        command.kill('SIGINT');
      } catch {
        // Ignore already-terminated children.
      }
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await result;
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`[START] Startup failed: ${error?.message || error}`);
    process.exit(1);
  });
