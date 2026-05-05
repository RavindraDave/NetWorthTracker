<div align="center">
  <img src="./public/logo.svg" alt="WealthPulse Logo" width="120" />
  <h1>WealthPulse</h1>
  <p><strong>A beautifully designed, offline-first Progressive Web App to track your net worth and FIRE goals.</strong></p>
  <p>
    <a href="#features">Features</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#data-privacy">Data Privacy</a>
  </p>
</div>

<br/>

WealthPulse replaces the traditional, messy "monthly Excel sheet" with a structured, multi-currency financial dashboard. It is built natively for the web but designed to feel like a premium mobile application — install it to your home screen and use it exactly like a native app.

## 🚀 Features

- **Multi-Currency Support** — Add assets and liabilities in their native currencies (USD, EUR, GBP, SGD, AED, INR, etc.). WealthPulse auto-fetches live exchange rates and converts everything to your chosen Base Currency.
- **Live Exchange Rates** — One-click rate refresh via [open.er-api.com](https://open.er-api.com) (free, no API key, 160+ currencies) with [Frankfurter](https://www.frankfurter.app) as fallback. Stale-rate warnings appear automatically when rates are older than 30 days.
- **FIRE Tracking** — Define your Financial Independence target and let the built-in calculator project your Safe Withdrawal Rate and estimated years to retirement based on real net worth growth.
- **Offline-First PWA** — Install directly to your iOS or Android home screen, or use it in any browser. All data is local — zero network required after first load.
- **Glassmorphic Design** — Dark-mode, glassmorphism aesthetic with smooth micro-animations throughout.
- **Data Portability** — Export your full database as a JSON backup. Import historical snapshots from Excel. Auto-safety-backup triggers before any restore operation.

## 📊 How Net Worth Is Calculated

WealthPulse offers three views of your wealth, selectable via the **Overall / Liquid / Investable** toggle on the Dashboard.

### Overall (default)
Includes **all** asset and liability categories.

```
Net Worth = Σ all asset categories − Σ all liability categories
```

This is your complete balance sheet — the most comprehensive view.

### Liquid
Includes only categories flagged **Is Liquid** in the Snapshot Editor.

```
Liquid Net Worth = Σ liquid asset categories − Σ liquid liability categories
```

Liquid assets are those you can access within a short time without significant loss of value — typically Cash & Bank accounts, Money Market funds, and short-term fixed deposits. Use this view to understand your **short-term financial resilience**.

### Investable
Includes only categories flagged **Is Investable** in the Snapshot Editor.

```
Investable Net Worth = Σ investable asset categories − Σ investable liability categories
```

Investable assets are those actively working towards growth — typically Stocks, Mutual Funds, ETFs, Bonds, and Crypto. Physical assets like Real Estate or Gold are usually *not* investable because you can't deploy them directly into the market. Use this view to track your **wealth-compounding base**.

### Per-Goal Exclusions
Goals support per-goal category exclusions. For example, if your primary home is in the Real Estate category, you can exclude it from a FIRE goal's progress calculation so that your retirement readiness isn't inflated by an illiquid asset you'd never sell. Configure this in **Goals → Edit → Exclude from net worth calculation**.

---

## 💻 Getting Started

### Instant Use (Recommended)

The easiest way to use WealthPulse is to open it in your browser and install it as a PWA:

1. Open the app URL in Chrome, Edge, or Safari
2. Click **"Add to Home Screen"** (Safari on iOS) or **"Install App"** (Chrome/Edge on desktop)
3. Launch from your home screen — it works completely offline from that point forward

### Run Locally

```bash
git clone https://github.com/yourusername/wealthpulse.git
cd wealthpulse
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Self-Hosted (Always-On)

For a persistent local server that starts automatically on reboot, use the provided setup scripts:

**macOS:**
```bash
./setup-mac.sh
```

**Linux:**
```bash
./setup-linux.sh
```

**Windows** *(run Command Prompt as Administrator)*:
```cmd
setup-windows.bat
```

These scripts install Node.js if missing, build the production app, and configure PM2 to keep it running on port 3000 permanently.

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/) |
| Language | TypeScript (Strict Mode) |
| Database | [Dexie.js](https://dexie.org/) (IndexedDB wrapper) |
| Styling | Vanilla CSS (CSS Variables, Glassmorphism) |
| Icons | [Lucide React](https://lucide.dev/) |
| Charts | [Recharts](https://recharts.org/) |
| PWA | `vite-plugin-pwa` (Workbox, auto-update) |
| Exchange Rates | [open.er-api.com](https://open.er-api.com) + [Frankfurter](https://api.frankfurter.app) |

## ☁️ Cloud Sync — Google Drive Setup

<a name="cloud-sync-setup"></a>

WealthPulse can automatically back up your data to a **hidden, app-only folder** in your Google Drive (`appDataFolder`). This folder:

- Is **invisible** in your Google Drive UI — it never clutters your files
- Is **inaccessible** to any other app — only WealthPulse can read or write to it
- **Survives browser data clears, cache wipes, and device loss**
- Uses a read-only scope (`drive.appdata`) — WealthPulse **cannot** see or touch any of your other Drive files

---

### Who needs to do setup?

| Scenario | What you need to do |
|---|---|
| **Using the hosted app** (wealthpulse.vercel.app or similar) | Nothing — just click **Settings → Cloud Sync → Connect Google Drive** and sign in |
| **Self-hosting or running locally** | Follow the one-time GCP setup below, then paste your Client ID in the app |

---

### One-time GCP setup (self-hosters only)

This takes about 10 minutes and is completely free.

#### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and sign in with your Google account.
2. Click the project dropdown at the top → **New Project**.
3. Give it any name (e.g. `WealthPulse`) and click **Create**.
4. Make sure your new project is selected in the top dropdown.

#### Step 2 — Enable the Google Drive API

1. In the left sidebar, click **APIs & Services → Library**.
2. Search for **Google Drive API** and click on it.
3. Click **Enable**.

#### Step 3 — Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** and click **Create**.
3. Fill in:
   - **App name**: `WealthPulse` (or anything you like)
   - **User support email**: your email address
   - **Developer contact information**: your email address
4. Click **Save and Continue**.
5. On the **Scopes** page, click **Add or Remove Scopes**.
   - In the filter box, type `drive.appdata`
   - Check the box for `../auth/drive.appdata` → click **Update** → **Save and Continue**.
6. On the **Test users** page, click **Add Users** and add your own Google account email.
7. Click **Save and Continue** → **Back to Dashboard**.

> **Why "External" and "Testing"?** Google requires all OAuth apps to go through a verification process before they can be used by the general public. For personal use or a small team, staying in Testing mode is fine — it lets up to 100 Google accounts use your app without any review process.

#### Step 4 — Create an OAuth Client ID

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. Choose **Web application** as the application type.
4. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000` (for local development)
   - Your deployed URL, e.g. `https://yourapp.vercel.app` (for production)
5. Leave **Authorized redirect URIs** empty (not needed for this flow).
6. Click **Create**.
7. Copy the **Client ID** — it looks like `123456789-abcdefg.apps.googleusercontent.com`.

#### Step 5 — Add the Client ID to your app

**Option A — Vercel or other hosting platforms (recommended)**

Set it as an environment variable in your deployment platform. No code change, no `.env.local` file needed.

- **Vercel**: Go to your project → Settings → Environment Variables → add `VITE_GOOGLE_CLIENT_ID` with your Client ID value → redeploy.
- **Netlify**: Site settings → Build & deploy → Environment → add the variable.
- Any other platform: add `VITE_GOOGLE_CLIENT_ID=your-client-id` to your build environment.

Once deployed, your users just see **"Connect Google Drive"** — no setup on their end.

**Option B — Running locally without rebuilding**

1. Open WealthPulse in your browser.
2. Go to **Settings → Cloud Sync**.
3. Paste your Client ID into the **Google OAuth Client ID** field and click **Save**.
4. The Client ID is saved to your browser's local storage — you only need to do this once per device.

**Option C — `.env.local` for local development**

Create a file called `.env.local` in the project root (it is git-ignored and never committed):

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

Then run `npm run dev`.

---

### Using Google Drive sync

Once the Client ID is configured, using sync is straightforward:

1. **Settings → Cloud Sync → Connect Google Drive** — a Google sign-in popup appears. Grant permission when asked.
2. WealthPulse will immediately sync a backup and then auto-sync every time you save a snapshot or goal (with a 5-second debounce).
3. To manually sync at any time: **Sync Now** button.
4. To restore from a previous backup: **Restore** button → pick a date from the list.
5. If you clear your browser data or switch devices: open the app, click **Restore from Google Drive** on the empty dashboard, sign in, pick your backup.

---

### Security notes

- The **Client ID is not a secret** — it's a public identifier similar to an app name. It's safe to display in the UI and is visible in your browser's network requests. The security comes from Google only accepting OAuth requests from the exact domains you registered.
- WealthPulse never sends your financial data to any server other than Google Drive. The data goes directly from your browser to your own Google account.
- Access can be revoked at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
- Backups are stored as **plaintext JSON** in your Drive's hidden app folder. They are not encrypted end-to-end. If you want zero-knowledge encryption on top of this, that is planned as a future phase (see CLAUDE.md).

## 🛡 Data Privacy

WealthPulse is a strictly **client-side application**. It has no backend, no authentication servers, and sends zero telemetry.

All financial data is stored locally on your device inside your browser's **IndexedDB** database.

> ⚠️ **On-device security:** IndexedDB files are stored **unencrypted** on disk. On a shared computer, ensure your device has full-disk encryption enabled — [FileVault](https://support.apple.com/en-us/102541) on macOS or [BitLocker](https://learn.microsoft.com/en-us/windows/security/information-protection/bitlocker/bitlocker-overview) on Windows.

**Backups:** The JSON export feature creates a **plaintext** backup file. Treat it like any sensitive document — store it in an encrypted location (password-protected zip, encrypted cloud folder like [Cryptomator](https://cryptomator.org/), etc.).

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.
