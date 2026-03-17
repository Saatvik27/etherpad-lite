# Running Etherpad with AI Assistant

Choose your setup method:
- **[Docker Setup](#docker-setup)** - Isolated environment with PostgreSQL
- **[Local Development](#local-development-without-docker)** - Run directly with pnpm (faster for development)

---

## Docker Setup (Custom Image)

### Quick Start

1. **Set your API key in `.env` file:**
   ```bash
   AI_API_KEY=your-actual-groq-api-key
   ```

2. **Set your Supabase DB password in `.env`:**
   ```bash
   SUPABASE_DB_PASSWORD=your-supabase-db-password
   ```

3. **Rebuild and start using your local codebase image:**
   ```bash
   docker compose down
   docker compose up --build
   ```

   **Note:** `docker-compose.yml` now builds from your local `Dockerfile` and does not pull `etherpad/etherpad:latest`.

4. **Access Etherpad:**
   - Open browser to http://localhost:9001
   - Click the 🤖 icon on the left side or press `Alt+A`

## Getting Your Groq API Key

1. Visit https://console.groq.com/
2. Sign up for a free account
3. Go to API Keys section
4. Create a new API key
5. Copy the key to `.env` file

## Environment Variables

Edit `.env` file to configure:

```env
# Enable AI Assistant
AI_ASSISTANT_ENABLED=true

# Your API Key (REQUIRED)
AI_API_KEY=gsk_your_key_here

# Provider and Model
AI_PROVIDER=groq
AI_MODEL=llama-3.3-70b-versatile
SUPABASE_DB_PASSWORD=your-db-password
```

## Troubleshooting

### AI Chat not appearing

**Check 1: Is AI enabled?**
```bash
docker compose exec app grep -A 5 "aiAssistant" /opt/etherpad-lite/settings.json
```

**Check 2: Are the files present?**
```bash
docker compose exec app ls -la /opt/etherpad-lite/src/node/ai_assistant/
docker compose exec app ls -la /opt/etherpad-lite/src/static/js/ai_chat.ts
docker compose exec app ls -la /opt/etherpad-lite/src/static/css/ai_chat.css
```

**Check 3: Check logs for errors:**
```bash
docker compose logs app | grep -i "error\|ai"
```

**Check 4: Verify API key is set:**
```bash
docker compose exec app printenv | grep AI_
```

### Rebuild from scratch

If you made code changes:
```bash
# Stop and remove containers
docker compose down

# Remove old images and volumes (ensures clean state)
docker compose down -v

# Rebuild without cache
docker compose build --no-cache

# Start fresh
docker compose up
```

### View real-time logs

```bash
docker compose logs -f app
```

### Access container shell

```bash
docker compose exec app sh
```

## Database

This setup uses external Supabase PostgreSQL (configured in `settings.json`).
No local Postgres container is created by default.

## Production Deployment

For production, use environment variables instead of `.env`:

```bash
export AI_ASSISTANT_ENABLED=true
export AI_API_KEY=your-secure-key
export DOCKER_COMPOSE_APP_ADMIN_PASSWORD=secure-password
export DOCKER_COMPOSE_POSTGRES_PASSWORD=secure-db-password

docker compose up -d
```

## Security Notes

1. **Never commit `.env` with real API keys** - Add `.env` to `.gitignore`
2. **Use strong passwords** for admin and database
3. **Enable HTTPS** in production
4. **Restrict database access** - Don't expose port 5432 publicly
5. **Monitor API usage** - Check Groq console for usage limits

## Available AI Commands

Once running, try asking the AI:

- "What is this pad about?"
- "Summarize the main points"
- "Add a table of contents"
- "Fix grammar mistakes"
- "How many words are in this pad?"

All write operations require your confirmation!

---

## Local Development (Without Docker)

You can also run Etherpad locally using pnpm instead of Docker:

### Prerequisites

- Node.js >= 20.0.0
- pnpm installed globally: `npm install -g pnpm`

### Setup Steps

1. **Install dependencies:**
   ```powershell
   pnpm install
   ```

2. **Build the AI chat widget:**
   ```powershell
   .\build-ai-widget.bat
   ```
   Or manually:
   ```powershell
   cd src\ai-chat-widget
   pnpm install
   pnpm build
   cd ..\..
   ```

3. **Configure AI in settings.json:**
   
   The file `settings.json` already has AI configuration at line 702. Make sure it looks like this:
   ```json
   "aiAssistant": {
     "enabled": true,
     "provider": "groq",
     "apiKey": "your-groq-api-key-here",
     "model": "llama-3.3-70b-versatile"
   }
   ```

4. **Run Etherpad:**

   **Development mode** (with auto-reload):
   ```powershell
   pnpm run dev
   ```
   
   **Production mode:**
   ```powershell
   pnpm run prod
   ```
   
   **Or use the Windows batch file:**
   ```powershell
   .\start.bat
   ```

5. **Access Etherpad:**
   - Open http://localhost:9001
   - Click the 🤖 icon or press `Alt+A`

### Quick Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm run dev` | Start in development mode |
| `pnpm run prod` | Start in production mode |
| `.\build-ai-widget.bat` | Rebuild AI widget |
| `pnpm run lint` | Run linter |
| `pnpm run test` | Run tests |

### Rebuilding After Changes

If you modify the AI widget source code:
```powershell
# Rebuild just the widget
cd src\ai-chat-widget
pnpm build
cd ..\..

# Then restart Etherpad
# Press Ctrl+C to stop, then run again:
pnpm run dev
```

### Notes

- **Local mode uses DirtyDB by default** (file-based database in `var/dirty.db`)
- **Hot reload:** Development mode automatically restarts on file changes
- **Port:** Default is 9001, configurable in `settings.json`
- **No database setup needed** for basic usage
- **AI widget files** are at `src/static/js/ai-widget/`
