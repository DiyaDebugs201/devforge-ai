# DevForge AI — Developer Productivity Suite

AI-powered MERN stack app combining **BranchNamer**, **TestCraft**, and **PR Describer** in one dashboard.

---

## Architecture

```
DevForge AI/
├── backend/                   # Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js         # MongoDB connection
│   │   ├── controllers/
│   │   │   ├── authController.js   # register, login, getMe
│   │   │   ├── branchController.js # branch generation
│   │   │   ├── testsController.js  # test suite generation
│   │   │   ├── prController.js     # PR description generation
│   │   │   ├── historyController.js
│   │   │   ├── shareController.js
│   │   │   └── adminController.js
│   │   ├── middleware/
│   │   │   ├── auth.js             # JWT + daily limit
│   │   │   ├── rateLimiter.js      # express-rate-limit
│   │   │   └── errorHandler.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── BranchHistory.js
│   │   │   ├── TestHistory.js
│   │   │   ├── PRHistory.js
│   │   │   └── SharedLink.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── branch.js
│   │   │   ├── tests.js
│   │   │   ├── pr.js
│   │   │   ├── history.js
│   │   │   ├── share.js
│   │   │   └── admin.js
│   │   ├── services/
│   │   │   └── aiService.js        # HuggingFace Mistral-7B
│   │   └── server.js
│   ├── .env.example
│   ├── package.json
│   └── render.yaml
│
└── frontend/                  # React + Vite + Tailwind
    ├── src/
    │   ├── components/
    │   │   ├── auth/
    │   │   │   ├── ProtectedRoute.jsx
    │   │   │   └── AdminRoute.jsx
    │   │   └── shared/
    │   │       ├── Layout.jsx       # Sidebar + nav
    │   │       ├── CopyButton.jsx
    │   │       ├── ShareButton.jsx
    │   │       └── LoadingSpinner.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── BranchNamerPage.jsx
    │   │   ├── TestCraftPage.jsx
    │   │   ├── PRDescriberPage.jsx
    │   │   ├── HistoryPage.jsx
    │   │   ├── AdminPage.jsx
    │   │   └── SharePage.jsx
    │   ├── services/
    │   │   └── api.js              # Axios instance
    │   ├── store/
    │   │   └── authStore.js        # Zustand auth
    │   └── App.jsx
    ├── .env.example
    ├── vercel.json
    └── package.json
```

---

## Step 1 — Local Development Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier)
- Hugging Face account + API key (free)

### 1.1 Clone and install

```bash
# Install backend
cd DevForge AI/backend
npm install

# Install frontend
cd ../frontend
npm install
```

### 1.2 Set up MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free M0 cluster
3. Create a database user under **Security → Database Access**
4. Allow all IPs (or your IP) under **Security → Network Access**
5. Get your connection string from **Connect → Drivers**
   - Format: `mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/DevForge AI?retryWrites=true&w=majority`

### 1.3 Get Hugging Face API key

1. Create account at [huggingface.co](https://huggingface.co)
2. Go to **Settings → Access Tokens**
3. Create a **Read** token
4. The `mistralai/Mistral-7B-Instruct-v0.2` model is free on the Inference API

### 1.4 Configure environment

```bash
# backend/.env
cp backend/.env.example backend/.env
# Fill in: MONGODB_URI, JWT_SECRET (any 32+ char random string), HUGGINGFACE_API_KEY

# frontend/.env.local (for local dev, you don't need this — Vite proxy handles it)
# Only needed for production:
cp frontend/.env.example frontend/.env.local
```

### 1.5 Run locally

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# API available at http://localhost:5000

# Terminal 2 — Frontend  
cd frontend
npm run dev
# App available at http://localhost:5173
```

The first user to register becomes an admin automatically.

---

## Step 2 — Deploy Backend to Render

### 2.1 Push to GitHub

```bash
git init
git add .
git commit -m "feat: initial DevForge AI implementation"
git remote add origin https://github.com/yourname/DevForge AI.git
git push -u origin main
```

### 2.2 Create Render Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Instance Type**: Free

### 2.3 Set environment variables in Render Dashboard

```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_super_secret_32_char_string_here
JWT_EXPIRES_IN=7d
HUGGINGFACE_API_KEY=hf_xxxxxxx
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
DAILY_AI_REQUEST_LIMIT=20
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
FRONTEND_URL=https://your-app.vercel.app   ← fill after Vercel deploy
ADMIN_EMAIL=your@email.com
```

4. Click **Deploy**. Your API will be at `https://DevForge AI-api.onrender.com`

> ⚠️ **Render free tier spins down after 15 min inactivity** — first request after sleep may take 30-60s.
> Consider setting up a cron ping (e.g. UptimeRobot free) to keep it alive.

---

## Step 3 — Deploy Frontend to Vercel

### 3.1 Set up Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3.2 Set environment variables in Vercel

```
VITE_API_URL=https://DevForge AI-api.onrender.com/api
```

4. Click **Deploy**. Your app will be at `https://DevForge AI.vercel.app`

### 3.3 Update CORS in Render

Go back to Render, update:
```
FRONTEND_URL=https://DevForge AI.vercel.app
```
Then trigger a redeploy.

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Create account |
| POST | `/api/auth/login` | ❌ | Login, get JWT |
| GET | `/api/auth/me` | ✅ | Get current user |
| PUT | `/api/auth/branch-config` | ✅ | Save branch naming config |

### Tools
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/branch/generate` | ✅ | Generate branch names |
| POST | `/api/tests/generate` | ✅ | Generate Jest test suite |
| POST | `/api/pr/generate` | ✅ | Generate PR description |

### History
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/history/dashboard` | ✅ | Dashboard stats + recent |
| GET | `/api/history/:tool` | ✅ | Paginated history (branch/tests/pr) |
| DELETE | `/api/history/:tool/:id` | ✅ | Delete history item |

### Sharing
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/share/:tool/:id` | ✅ | Create share link |
| GET | `/api/share/:shareId` | ❌ | View shared result (public) |
| DELETE | `/api/share/:tool/:id` | ✅ | Revoke share link |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/stats` | ✅ Admin | Platform usage stats |
| GET | `/api/admin/users` | ✅ Admin | List all users |
| PUT | `/api/admin/users/:id/role` | ✅ Admin | Change user role |
| PUT | `/api/admin/users/:id/toggle` | ✅ Admin | Activate/deactivate user |

---

## AI Prompts (Mistral-7B-Instruct)

All prompts use the `<s>[INST] system\n\nuser [/INST]` format.

### BranchNamer Prompt
```
System: You are a Git branch naming expert. Generate clean, semantic Git branch names.
- Use only lowercase letters, numbers, and hyphens
- No spaces, no special characters except hyphens  
- Maximum {maxLength} characters per branch name
- Start each branch with one of these prefixes: {prefixes}
- If a ticket ID is provided, include it after the prefix
- Make the description part concise (3-6 words max)
- Return ONLY a JSON array of 5 objects:
  [{"prefix": "...", "name": "...", "command": "git checkout -b ..."}]

User: Ticket: {ticketId} | Task: {taskDescription}
```

### TestCraft Prompt
```
System: You are a senior TDD engineer. Generate comprehensive Jest test suites.
- Include: happy path, edge cases (null, undefined, empty), boundary conditions, error throwing
- Each test name explains WHAT is tested and WHY
- Use descriptive describe() blocks
- Return ONLY a JSON object:
  {
    "functionName": "...",
    "importStatement": "...",
    "fullTestFile": "...",
    "testCases": [{"name": "...", "category": "happy-path|edge-case|error|boundary", "code": "..."}],
    "estimatedCoverage": 85
  }

User: Generate tests for this {language} function:\n\n{functionCode}
```

### PR Describer Prompt
```
System: You are a senior engineering lead who writes exceptional PR descriptions.
{concise|detailed mode instructions}
Return ONLY a JSON object:
{
  "title": "...",
  "summary": "...",
  "whatChanged": "...",
  "whyChanged": "...",
  "testingSteps": "...",
  "reviewerChecklist": ["...", "..."],
  "markdownFull": "...",
  "plainTextFull": "..."
}

User: Generate a PR description for this git diff:\n\n{diff}
```

---

## Rate Limiting Strategy

| Layer | Limit | Scope |
|-------|-------|-------|
| Global | 100 req/15min | Per IP |
| Auth endpoints | 10 req/15min | Per IP |
| AI endpoints (IP) | 5 req/min | Per IP |
| AI endpoints (user) | 20 req/day | Per user (DB tracked) |

---

## Troubleshooting

**HuggingFace 503 errors**
- The free tier model goes cold. The retry logic handles this — first request may take 60s.
- Solution: Use HF Inference Endpoints (paid) or switch to Groq's free API.

**Render cold starts**
- Free tier services sleep after 15 min. Set up a UptimeRobot monitor to ping `/health` every 5 min.

**MongoDB connection timeout**
- Ensure your Atlas cluster has `0.0.0.0/0` in Network Access (or add Render's IPs).

**CORS errors in production**
- Make sure `FRONTEND_URL` in Render exactly matches your Vercel URL (no trailing slash).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, Monaco Editor |
| State | Zustand |
| HTTP | Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| AI | HuggingFace Inference API (Mistral-7B-Instruct) |
| Rate Limiting | express-rate-limit |
| Validation | express-validator |
| Deployment | Vercel (frontend) + Render (backend) |
