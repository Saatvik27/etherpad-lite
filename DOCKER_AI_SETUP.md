# Running Etherpad with AI Assistant in Docker

## Quick Start

1. **Set your API key in `.env` file:**
   ```bash
   AI_API_KEY=your-actual-groq-api-key
   ```

2. **Rebuild and start the containers:**
   ```bash
   docker compose down
   docker compose up --build
   ```

3. **Access Etherpad:**
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

# Remove old images
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

## Database Location

The PostgreSQL data is stored in a Docker volume:
```bash
# View volume info
docker volume inspect etherpad-lite_postgres_data

# Backup database
docker compose exec postgres pg_dump -U admin etherpad > backup.sql

# Restore database
cat backup.sql | docker compose exec -T postgres psql -U admin etherpad
```

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
