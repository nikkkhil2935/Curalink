# Theme

## Global CSS
Source: `client/src/styles.css`

```css
@import 'tailwindcss';

:root {
  --bg-0: #070a12;
  --bg-1: #101726;
  --surface-0: #131d2d;
  --surface-1: #1a263a;
  --border-0: #24324a;
  --text-0: #f3f7ff;
  --text-1: #c6d3eb;
  --text-2: #8ea1c2;
  --brand-0: #1d4ed8;
  --brand-1: #2563eb;
  --ok-0: #16a34a;
  --warn-0: #ca8a04;
  --bad-0: #dc2626;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: radial-gradient(circle at 20% 0%, #17233a 0%, var(--bg-0) 45%), var(--bg-0);
  color: var(--text-0);
}

.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: var(--border-0) transparent;
}
```

## Build/Styling Config
Source: `client/vite.config.js`

```js
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
```
