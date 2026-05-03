# SIEM Dashboard - Complete Setup Guide

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Installation Steps](#installation-steps)
4. [Project Structure](#project-structure)
5. [Running the Application](#running-the-application)
6. [Building for Production](#building-for-production)
7. [Features Overview](#features-overview)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

This is a complete **Security Information and Event Management (SIEM)** dashboard built with:
- **React 18** with TypeScript
- **Tailwind CSS v4** for styling
- **Vite** for build tooling
- **Recharts** for data visualization
- **Lucide React** for icons

### Key Features
- ✅ 10 Complete dashboard pages
- ✅ Dark cybersecurity-themed UI
- ✅ User management with role-based access control
- ✅ Real-time alerts and threat detection
- ✅ Advanced filtering and search
- ✅ Interactive data visualizations
- ✅ Responsive design

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (v9 or higher) - comes with Node.js
  - OR **pnpm** (v8 or higher) - [Install here](https://pnpm.io/installation)

### Verify Installation
Open your terminal and run:
```bash
node --version    # Should show v18.0.0 or higher
npm --version     # Should show v9.0.0 or higher
```

---

## 🚀 Installation Steps

### Step 1: Create Project Directory
```bash
# Create and navigate to project folder
mkdir siem-dashboard
cd siem-dashboard
```

### Step 2: Initialize Package.json
Create a `package.json` file in your project root with the following content:

```json
{
  "name": "siem-dashboard",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
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

### Step 3: Install Dependencies
```bash
# Using npm
npm install

# OR using pnpm (faster)
pnpm install
```

This will install all required packages (~2-3 minutes).

### Step 4: Create Configuration Files

#### A. Create `vite.config.ts` in project root:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
});
```

#### B. Create `tsconfig.json` in project root:
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

#### C. Create `tsconfig.node.json` in project root:
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

#### D. Create `index.html` in project root:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SIEM Dashboard - Security Information & Event Management</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Step 5: Create Directory Structure
```bash
mkdir -p src/app/components
mkdir -p src/styles
```

### Step 6: Create Entry Point Files

#### A. Create `src/main.tsx`:
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

### Step 7: Create CSS Files

#### A. Create `src/styles/index.css`:
```css
@import './fonts.css';
@import './theme.css';
@import 'tailwindcss';
```

#### B. Create `src/styles/fonts.css`:
```css
/* Add custom fonts here if needed */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

#### C. Create `src/styles/theme.css`:
```css
@layer base {
  :root {
    --color-primary: #4f46e5;
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-danger: #ef4444;
    --color-info: #3b82f6;
  }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
  }
}
```

### Step 8: Copy Component Files

You need to copy all the component files from the Figma Make project into `src/app/components/`:

**Required Component Files:**
1. `Sidebar.tsx`
2. `Header.tsx`
3. `DashboardPage.tsx`
4. `LogManagementPage.tsx`
5. `AlertsPage.tsx`
6. `DetectionRulesPage.tsx`
7. `ThreatDetectionPage.tsx`
8. `AIRecommendationsPage.tsx`
9. `AccessControlPage.tsx`
10. `ReportsPage.tsx`
11. `SettingsPage.tsx`
12. `UserManagementPage.tsx`

**Main App File:**
- Copy `App.tsx` to `src/app/App.tsx`

### Step 9: Download Files from Figma Make

**To download all files:**
1. In Figma Make, look for the **"Download"** or **"Export"** button
2. Download the complete project as a ZIP file
3. Extract the ZIP file
4. Copy all `.tsx` files from `src/app/components/` to your local `src/app/components/` folder
5. Copy `src/app/App.tsx` to your local `src/app/` folder

---

## 📁 Project Structure

Your final project structure should look like this:

```
siem-dashboard/
├── node_modules/           # Dependencies (auto-generated)
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── LogManagementPage.tsx
│   │   │   ├── AlertsPage.tsx
│   │   │   ├── DetectionRulesPage.tsx
│   │   │   ├── ThreatDetectionPage.tsx
│   │   │   ├── AIRecommendationsPage.tsx
│   │   │   ├── AccessControlPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── UserManagementPage.tsx
│   │   └── App.tsx
│   ├── styles/
│   │   ├── index.css
│   │   ├── fonts.css
│   │   └── theme.css
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── SETUP_GUIDE.md (this file)
```

---

## 🎮 Running the Application

### Development Mode
```bash
# Start the development server
npm run dev

# OR with pnpm
pnpm dev
```

The application will start at: **http://localhost:3000**

You should see:
```
  VITE v6.0.5  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Open in Browser
Navigate to `http://localhost:3000` in your web browser.

---

## 🏗️ Building for Production

### Create Production Build
```bash
npm run build

# OR with pnpm
pnpm build
```

This creates an optimized build in the `dist/` folder.

### Preview Production Build
```bash
npm run preview

# OR with pnpm
pnpm preview
```

---

## ✨ Features Overview

### 1. **Dashboard** (Main Page)
- System status overview
- Priority AI recommendations
- Recent security alerts
- Quick actions

### 2. **Log Management**
- Real-time log ingestion monitoring
- Log sources and collectors
- Search and filtering

### 3. **Alerts**
- Security alert table with severity badges
- Alert deep-dive modal with raw/normalized data
- Status management (Open, In Progress, Resolved)

### 4. **Detection Rules**
- MITRE ATT&CK framework mapping
- Rule creation and management
- Enable/disable rule toggles

### 5. **Threat Detection**
- Active threat monitoring
- Severity-based filtering
- Real-time threat indicators

### 6. **AI Recommendations**
- Security advisories
- Best practices
- Threat intelligence

### 7. **Access Control**
- Role-based access control (RBAC)
- Permission matrix
- User role assignments

### 8. **Reports & Analytics**
- Advanced query builder
- Time-series data visualization
- Custom report generation
- Export functionality (CSV, JSON, PDF)

### 9. **Settings**
- Log collector configuration
- API key management
- System preferences

### 10. **User Management** ⭐ NEW
- Add/Edit/Delete user accounts
- User ID, Username, Email, Full Name
- Role assignment (Administrator, Security Analyst, Viewer)
- Account status management (Active, Disabled, Locked)
- Password security with strength meter
- Cryptographic hashing indicators (bcrypt + SHA-256)
- Search and filtering by role/status

---

## 🔧 Troubleshooting

### Issue: "Cannot find module 'react'"
**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Port 3000 already in use
**Solution:**
Edit `vite.config.ts` and change the port:
```typescript
server: {
  port: 3001, // Change to any available port
}
```

### Issue: Tailwind CSS not working
**Solution:**
Ensure `src/styles/index.css` contains:
```css
@import 'tailwindcss';
```

### Issue: TypeScript errors
**Solution:**
```bash
# Update TypeScript
npm install typescript@latest --save-dev

# Clear cache
npm run build -- --force
```

### Issue: Components not rendering
**Solution:**
- Verify all component files are in `src/app/components/`
- Check that `App.tsx` is in `src/app/App.tsx`
- Ensure all imports match file paths exactly (case-sensitive)

---

## 🎨 Customization

### Change Theme Colors
Edit `src/styles/theme.css`:
```css
:root {
  --color-primary: #your-color;
  --color-success: #your-color;
  /* etc */
}
```

### Add New Pages
1. Create new component in `src/app/components/YourPage.tsx`
2. Import in `App.tsx`
3. Add route case in `renderPage()` function
4. Add navigation item in `Sidebar.tsx`

---

## 📚 Additional Resources

- **React Documentation**: https://react.dev
- **Tailwind CSS v4**: https://tailwindcss.com
- **Vite Documentation**: https://vitejs.dev
- **Recharts Documentation**: https://recharts.org
- **Lucide Icons**: https://lucide.dev

---

## 🚀 Deployment Options

### Vercel (Recommended)
1. Push code to GitHub
2. Import project at https://vercel.com
3. Deploy automatically

### Netlify
1. Push code to GitHub
2. Import project at https://netlify.com
3. Build command: `npm run build`
4. Publish directory: `dist`

### Custom Server
```bash
npm run build
# Copy dist/ folder to your web server
```

---

## 📝 Notes

- All data is currently **mock data** for demonstration purposes
- For production use, integrate with real backend APIs
- Password hashing mentioned in UI is frontend-only (implement backend validation)
- Consider adding authentication middleware for production
- Review security best practices before deploying

---

## 🤝 Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Verify all dependencies are installed correctly
3. Ensure Node.js version is v18 or higher
4. Clear browser cache and restart dev server

---

## 📄 License

This project is provided as-is for your use.

---

**Last Updated:** April 6, 2026

**Version:** 1.0.0

---

## ✅ Quick Start Checklist

- [ ] Node.js v18+ installed
- [ ] Project folder created
- [ ] `package.json` created
- [ ] Dependencies installed (`npm install`)
- [ ] Configuration files created (vite.config.ts, tsconfig.json)
- [ ] Directory structure created (src/app/components, src/styles)
- [ ] Entry point files created (main.tsx, index.html)
- [ ] CSS files created (index.css, fonts.css, theme.css)
- [ ] All component files copied
- [ ] App.tsx copied
- [ ] Development server running (`npm run dev`)
- [ ] Application opens at http://localhost:3000

**Congratulations! Your SIEM Dashboard is ready! 🎉**
