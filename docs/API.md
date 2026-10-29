# ZETHICA RAG Chat API — `/api/chat`

Endpoint for retrieving grounded answers from the ZETHICA knowledge base using PostgreSQL full-text search and OpenRouter LLM.

---

## Overview

The chat endpoint searches the company knowledge base (63 verified chunks from 8 Markdown files) and augments responses with retrieved context before calling an LLM. This approach ensures answers are grounded in company information and reduces hallucination.

**Endpoint:** `POST /api/chat`  
**Response:** JSON with reply and sources  
**Timeout:** 30 seconds per request  
**Rate Limit:** 10 requests per 60 seconds per IP (basic, per-instance)

---

## Request

### URL
```
POST /api/chat
```

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "message": "What services does ZETHICA offer?"
}
```

### Parameters

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| message | string | Yes | 1–2000 characters (trimmed) |

---

## Response

### Success (200 OK)

```json
{
  "reply": "ZETHICA offers a comprehensive range of digital services including logo and brand identity design, website development, graphic design, Google Business Profile management, social media management, and UI/UX design. Our approach is fast-turnaround, results-focused, and transparent in scope and pricing.",
  "sources": [
    {
      "source_file": "SERVICES.md",
      "section_heading": "Logo and Brand Identity"
    },
    {
      "source_file": "SERVICES.md",
      "section_heading": "Website Development"
    }
  ]
}
```

### Error (400, 405, 429, 500)

```json
{
  "error": "Unable to process your request. Please try again."
}
```

---

## Status Codes

| Code | Meaning | Reason |
|------|---------|--------|
| 200 | OK | Request processed successfully |
| 400 | Bad Request | Invalid JSON, empty message, oversized message |
| 405 | Method Not Allowed | Request is not POST |
| 429 | Too Many Requests | Rate limit exceeded (10 per 60 sec per IP) |
| 500 | Server Error | Database error, LLM API error, missing config |

---

## Error Handling

**All error messages are generic:** `"Unable to process your request. Please try again."`

This prevents exposure of:
- Stack traces
- Database details
- API credentials
- Internal system information

**Server logs** contain detailed error information for debugging. Never expose these to clients.

---

## Configuration

### Environment Variables

Required in `.env.local` (local dev) and Vercel project settings (production):

```env
POSTGRES_URL=postgresql://...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/auto
```

### OpenRouter Model Selection

**Current Free Models (Oct 2026):**
- `openrouter/auto` — Auto-selects best available free model (recommended)
- `meta-llama/llama-2-7b` — Fast, good for Q&A
- `meta-llama/llama-3-8b` — Higher quality, may have rate limits
- `mistralai/mistral-7b` — Fast, efficient

**Check availability:** https://openrouter.io/docs/models

**Getting an API Key:**
1. Visit https://openrouter.io/
2. Sign up (free tier available)
3. Generate an API key
4. Add to `.env.local`: `OPENROUTER_API_KEY=sk-or-v1-...`

---

## Usage Examples

### cURL

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What services do you offer?"}'
```

### JavaScript / Fetch

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Tell me about website development' })
});

const data = await response.json();
console.log(data.reply);
console.log(data.sources);
```

### PowerShell

```powershell
$body = @{ message = "What is the process for working with ZETHICA?" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:3000/api/chat" `
  -Method Post `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body $body
```

---

## How It Works

1. **Validate Input:** Check JSON, message field, length constraints
2. **Rate Limit:** Check IP-based rate limit (10 req/60 sec)
3. **Search Knowledge Base:** Query `knowledge_chunks` table using full-text search
4. **Load System Prompt:** Read server-side instructions from `SYSTEM_PROMPT.md`
5. **Build Context:** Combine system prompt, retrieved chunks, and user message
6. **Call OpenRouter API:** Send to LLM endpoint at `https://openrouter.ai/api/v1/chat/completions`
7. **Return Response:** Reply and sources

---

## Security & Privacy

### No Secrets Exposed
- API keys never logged or sent to browser
- Database connection strings never exposed
- System prompt kept server-side
- Retrieved knowledge is reference material, not instructions

### Parameterized Queries
- Full-text search uses `plainto_tsquery('english', $1)` for safe parsing
- User input never directly interpolated into SQL

### Prompt Injection Resistance
- System prompt controls response behavior
- User message is separate from system instructions
- Retrieved chunks are treated as untrusted reference data
- LLM is instructed to ground answers in knowledge or say "I need confirmation"

### Rate Limiting
- Per-IP basic rate limit: 10 requests per 60 seconds
- **Limitation:** This is per-instance in Vercel serverless. Not a global rate limiter.
- For production, consider: Redis, Vercel KV, or other distributed caching

---

## Limits & Timeouts

| Setting | Value | Notes |
|---------|-------|-------|
| Max message length | 2000 chars | Prevents oversized requests |
| Search result limit | 5 chunks | Prevents over-retrieval from DB |
| LLM request timeout | 30 seconds | Prevents hanging connections |
| Rate limit | 10 req/60 sec/IP | Per-instance, basic protection |
| Max response tokens | 500 | Keeps responses concise |

---

## Testing Locally

### Prerequisites
- Node.js 18+
- `.env.local` with:
  - `POSTGRES_URL` (Supabase connection)
  - `OPENROUTER_API_KEY` (from openrouter.io)
  - `OPENROUTER_MODEL` (e.g., `openrouter/auto`)

### Run Tests

```powershell
npm test
```

### Manual Test

```powershell
$env:POSTGRES_URL = (Get-Content .env.local | Select-Object -First 1).Split("=", 2)[1]
$env:OPENROUTER_API_KEY = (Get-Content .env.local | Select-String "^OPENROUTER_API_KEY=").Split("=", 2)[1]
$env:OPENROUTER_MODEL = (Get-Content .env.local | Select-String "^OPENROUTER_MODEL=").Split("=", 2)[1]

$body = @{ message = "What services does ZETHICA offer?" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:3000/api/chat" `
  -Method Post `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body $body
```

---

## Deployment to Vercel

### 1. Set Environment Variables

In Vercel project settings > Environment Variables:

| Variable | Value | Scope |
|----------|-------|-------|
| POSTGRES_URL | Your connection string | Production, Preview, Development |
| OPENROUTER_API_KEY | Your API key | Production, Preview, Development |
| OPENROUTER_MODEL | Your chosen model | Production, Preview, Development |

### 2. Verify System Prompt

- File location: `Serverside_Instruction/SYSTEM_PROMPT.md`
- Included in deployment: Yes (via git)
- Accessible to public: No (server-side only)

### 3. Deploy

```bash
git add api/chat.js tests/ docs/API.md .env.example
git commit -m "Add Phase A Step 2: RAG chat endpoint"
git push origin main
```

Vercel auto-deploys; endpoint available at `https://yourdomain.com/api/chat`

---

## Troubleshooting

### "Service temporarily unavailable"
**Causes:**
- Missing `OPENROUTER_API_KEY` or `OPENROUTER_MODEL`
- Invalid OpenRouter API key
- Database connection failed
- System prompt file not found

**Solution:** Check `.env.local` and Vercel environment variables. Verify file paths in logs.

### "Too many requests"
**Cause:** Rate limit exceeded (10 per 60 sec per IP)

**Solution:** Wait 60 seconds and retry. Or check IP if using multiple clients.

### "Invalid model or request"
**Cause:** Model not available on OpenRouter

**Solution:** Check https://openrouter.io/docs/models. Use `openrouter/auto` for reliability.

### No results returned
**Cause:** Knowledge base has no matching chunks for query

**Solution:** This is normal. LLM handles it per system prompt ("I need confirmation").

---

## Architecture Notes

### Database Query
```sql
SELECT chunk_id, source_file, section_heading, subsection_heading, chunk_content
FROM knowledge_chunks
WHERE content_tsvector @@ plainto_tsquery('english', $1)
ORDER BY ts_rank(content_tsvector, plainto_tsquery('english', $1)) DESC
LIMIT 5
```

- Uses PostgreSQL full-text search (`tsvector`, `GIN` index)
- Ranked by relevance (most relevant first)
- Top 5 chunks returned

### OpenRouter Integration
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Format: OpenAI-compatible chat completions
- Free tier: Yes, with usage limits
- Timeout: 30 seconds

### Rate Limiting
- Per-IP in-memory counter
- Resets every 60 seconds
- Counts requests per Vercel instance (not global)

---

## Next Steps

- **Phase A, Step 3:** Integrate chat widget into website UI
- **Phase B:** Add persistence (chat history), user authentication, analytics
