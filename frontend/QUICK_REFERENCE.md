# SIEM Dashboard - Quick Copy/Paste Reference

## 📦 Complete package.json

Copy this entire file as your `package.json`:

```json
{
  "name": "siem-dashboard",
  "version": "1.0.0",
  "type": "module",
  "description": "Security Information and Event Management Dashboard",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.15.0",
    "lucide-react": "^0.469.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.3",
    "vite": "^6.0.5",
    "tailwindcss": "^4.0.0"
  }
}
```

---

## ⚙️ Complete vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

---

## 📝 Complete tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## 📝 Complete tsconfig.node.json

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

---

## 🌐 Complete index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Security Information and Event Management Dashboard" />
    <title>SIEM Dashboard - Security Information & Event Management</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 🎨 Complete src/styles/index.css

```css
@import './fonts.css';
@import './theme.css';
@import 'tailwindcss';
```

---

## 🔤 Complete src/styles/fonts.css

```css
/* Google Fonts Import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');

/* Apply fonts globally */
body {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Monospace for code/technical data */
code,
pre,
.font-mono {
  font-family: 'Fira Code', 'Courier New', monospace;
}
```

---

## 🎨 Complete src/styles/theme.css

```css
@layer base {
  :root {
    /* Brand Colors */
    --color-primary: #4f46e5;
    --color-primary-hover: #6366f1;
    
    /* Status Colors */
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-danger: #ef4444;
    --color-info: #3b82f6;
    
    /* Background Colors */
    --bg-primary: #0a0a0f;
    --bg-secondary: #0f0f17;
    --bg-tertiary: #1a1a24;
    
    /* Border Colors */
    --border-primary: #1f1f2e;
    --border-secondary: #2a2a3a;
    
    /* Text Colors */
    --text-primary: #ffffff;
    --text-secondary: #9ca3af;
    --text-tertiary: #6b7280;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    line-height: 1.2;
  }

  h1 {
    font-size: 2rem;
  }

  h2 {
    font-size: 1.5rem;
  }

  h3 {
    font-size: 1.25rem;
  }

  /* Scrollbar Styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--bg-secondary);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--border-secondary);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--color-primary);
  }
}
```

---

## 📱 Complete src/main.tsx

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 📂 File Checklist

After setting up, your project should have these files:

### Root Directory
- [ ] `package.json`
- [ ] `vite.config.ts`
- [ ] `tsconfig.json`
- [ ] `tsconfig.node.json`
- [ ] `index.html`
- [ ] `SETUP_GUIDE.md`
- [ ] `QUICK_REFERENCE.md` (this file)

### src/ Directory
- [ ] `main.tsx`

### src/styles/ Directory
- [ ] `index.css`
- [ ] `fonts.css`
- [ ] `theme.css`

### src/app/ Directory
- [ ] `App.tsx`

### src/app/components/ Directory
- [ ] `Sidebar.tsx`
- [ ] `Header.tsx`
- [ ] `DashboardPage.tsx`
- [ ] `LogManagementPage.tsx`
- [ ] `AlertsPage.tsx`
- [ ] `DetectionRulesPage.tsx`
- [ ] `ThreatDetectionPage.tsx`
- [ ] `AIRecommendationsPage.tsx`
- [ ] `AccessControlPage.tsx`
- [ ] `ReportsPage.tsx`
- [ ] `SettingsPage.tsx`
- [ ] `UserManagementPage.tsx`

---

## ⚡ Quick Command Reference

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run lint

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json && npm install

# Update all dependencies to latest
npm update
```

---

## 🔗 Import Paths Reference

In your component files, use these import paths:

```typescript
// React
import { useState, useEffect } from 'react';

// Icons (Lucide React)
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  Settings,
  // ... more icons
} from 'lucide-react';

// Charts (Recharts)
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Local Components
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './components/DashboardPage';
```

---

## 🎯 Environment Setup (Optional)

Create `.env` file in root for environment variables:

```env
# Development
VITE_API_URL=http://localhost:8000
VITE_APP_TITLE=SIEM Dashboard
VITE_APP_VERSION=1.0.0

# Production (replace with your values)
# VITE_API_URL=https://api.yourdomain.com
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## 🚀 Git Setup (Optional)

Create `.gitignore` file:

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
dist-ssr/
*.local

# Environment
.env
.env.local
.env.production

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*
```

---

## 📊 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## 💡 Pro Tips

1. **Use pnpm for faster installs**: `npm install -g pnpm`
2. **Enable hot reload**: Already configured in vite.config.ts
3. **VS Code Extensions**: Install ESLint, Prettier, Tailwind CSS IntelliSense
4. **Browser DevTools**: Use React DevTools extension for debugging

---

**Ready to start? Run:**
```bash
npm install && npm run dev
```

Your dashboard will open at: **http://localhost:3000** 🚀
