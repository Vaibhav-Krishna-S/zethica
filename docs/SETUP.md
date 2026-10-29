# ZETHICA RAG Chatbot — Phase A Setup Guide

This guide walks you through setting up the knowledge base for the ZETHICA RAG chatbot. By the end, you'll have:

- A PostgreSQL `knowledge_chunks` table with 8 source documents
- Full-text search capability for retrieving relevant information
- A repeatable ingestion process that won't create duplicates

**Status:** Phase A, Step 1 — Database & Ingestion setup only. The chat endpoint and widget come in later phases.

---

## Prerequisites

Before you begin, ensure you have:

1. **A PostgreSQL database** (Supabase or self-hosted)
   - Connection string or Supabase credentials
   - Ability to run SQL migrations

2. **Node.js 18+** (for running ingestion script locally)
   - Check: `node --version`

3. **Git** (for accessing the repository)

4. **The ZETHICA repository** cloned locally:
   ```
   Zethica_AI_Chat_website/
   ├── zethica/                         ← Repository root
   ├── zethica_rag_knowledge_base/      ← Knowledge files
   └── Serverside_Instruction/          ← System prompt (not ingested)
   ```

---

## Step 1: Set Up Your Database (Supabase Recommended)

### Option A: Supabase (Easiest for beginners)

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project:
   - Organization: (create or select)
   - Project name: `zethica` (or your choice)
   - Database password: (generate strong password and save it)
   - Region: (choose closest to you)
3. Wait for the project to initialize (2–3 minutes)
4. In the Supabase dashboard:
   - Go to **Settings > Database**
   - Copy the **Connection string** (URI format)
   - Store it securely; you'll need it shortly

### Option B: Self-Hosted PostgreSQL

If you have a PostgreSQL server (local, AWS RDS, DigitalOcean, etc.):

- Connection string format: `postgres://user:password@host:port/database?sslmode=require`
- Ensure the database exists and is accessible
- Port is usually `5432`, but verify

---

## Step 2: Configure Environment Variables

Navigate to your repository root and set up your local configuration:

```powershell
cd c:\Users\Vaibhav Krishna S\Downloads\Zethica_AI_Chat_website\zethica
```

Copy the example file:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` with your actual credentials:

```powershell
notepad .env.local
```

**If using Supabase:**

Replace the content with:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

To find these values:
- In Supabase dashboard: **Settings > API**
- **Project URL** = `SUPABASE_URL`
- **Service role secret** = `SUPABASE_SERVICE_ROLE_KEY` (only visible once; save it safely)

**If using direct PostgreSQL:**

```env
POSTGRES_URL=postgres://user:password@localhost:5432/zethica?sslmode=require
```

**For chat endpoint (Phase B):**

Add (or leave placeholder for now):

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=meta-llama/llama-2-7b
```

---

## Step 3: Run the Database Migration

The migration creates the `knowledge_chunks` table with full-text search support. It's safe to run multiple times.

### Using psql (Recommended)

```powershell
# Load environment variables from .env.local
$env:POSTGRES_URL = (Select-String -Path .env.local -Pattern "POSTGRES_URL=" -Raw).Split("=")[1]

# Run the migration
psql $env:POSTGRES_URL -f sql/001_create_knowledge_chunks.sql
```

**Expected output:**

```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
COMMENT
COMMENT
COMMENT
```

### If psql is not installed

Download PostgreSQL tools from [postgresql.org](https://www.postgresql.org/download/) or use a GUI client (pgAdmin, DBeaver).

Alternatively, run the migration through Supabase:

1. In Supabase dashboard: **SQL Editor**
2. Click **New Query**
3. Copy the contents of `sql/001_create_knowledge_chunks.sql`
4. Paste and click **RUN**

---

## Step 4: Ingest Knowledge Files

The ingestion script parses 8 markdown files and stores them as chunks in the database. It's safe to run repeatedly.

### First, verify Node.js packages are installed

```powershell
npm install
```

(The project only needs `pg`, which is already in `package.json`.)

### Run the ingestion script

```powershell
# Make sure environment variables are loaded
$env:POSTGRES_URL = (Select-String -Path .env.local -Pattern "^POSTGRES_URL=" -Raw).Split("=")[1]
# Or if using Supabase:
$env:SUPABASE_URL = (Select-String -Path .env.local -Pattern "^SUPABASE_URL=" -Raw).Split("=")[1]
$env:SUPABASE_SERVICE_ROLE_KEY = (Select-String -Path .env.local -Pattern "^SUPABASE_SERVICE_ROLE_KEY=" -Raw).Split("=")[1]

# Run the ingestion
node scripts/ingest-knowledge.js
```

**Expected output:**

```
🔍 ZETHICA Knowledge Base Ingestion

📂 Knowledge base directory: ...\zethica_rag_knowledge_base

📖 Parsing markdown files...
   ✓ COMPANY_OVERVIEW.md: 1 chunks
   ✓ SERVICES.md: 6 chunks
   ✓ WEBSITE_DEVELOPMENT_FAQ.md: 3 chunks
   ✓ AI_SERVICES_STATUS.md: 2 chunks
   ✓ PRICING_POLICIES_AND_COMMERCIALS.md: 2 chunks
   ✓ PROCESS_AND_SUPPORT.md: 2 chunks
   ✓ LEAD_QUALIFICATION.md: 8 chunks
   ✓ EDGE_CASES_AND_SAFE_ANSWERS.md: 3 chunks

✓ Total chunks parsed: 27

🔗 Connecting to database...
✓ Connected

💾 Upserting chunks into database...

✓ Ingestion complete:
  • Inserted: 27
  • Updated:  0

📊 Knowledge base summary by source:

   AI_SERVICES_STATUS.md: 2 chunks
   COMPANY_OVERVIEW.md: 1 chunks
   EDGE_CASES_AND_SAFE_ANSWERS.md: 3 chunks
   LEAD_QUALIFICATION.md: 8 chunks
   PRICING_POLICIES_AND_COMMERCIALS.md: 2 chunks
   PROCESS_AND_SUPPORT.md: 2 chunks
   SERVICES.md: 6 chunks
   WEBSITE_DEVELOPMENT_FAQ.md: 3 chunks

   Total: 27 chunks in database

✨ Ready for RAG retrieval!
```

### Verify ingestion in your database

**Using psql:**

```powershell
psql $env:POSTGRES_URL -c "SELECT COUNT(*) FROM knowledge_chunks;"
```

Expected output: `27` (or close, depending on how sections are parsed)

**Using Supabase dashboard:**

1. **SQL Editor > New Query**
2. Run:
   ```sql
   SELECT source_file, COUNT(*) as chunk_count 
   FROM knowledge_chunks 
   GROUP BY source_file 
   ORDER BY source_file;
   ```

---

## Step 5: Test Full-Text Search (Optional)

Verify that retrieval works:

```sql
SELECT source_file, section_heading, chunk_content
FROM knowledge_chunks
WHERE content_tsvector @@ plainto_tsquery('english', 'website development')
LIMIT 3;
```

Expected: 3 rows from SERVICES.md or WEBSITE_DEVELOPMENT_FAQ.md mentioning website development.

---

## Deploying to Vercel

When you're ready to deploy the full chatbot to production, follow these steps:

### 1. Add Environment Variables to Vercel

In your Vercel project dashboard:

1. Go to **Settings > Environment Variables**
2. Add each variable as a secret (encrypted):
   - `POSTGRES_URL` (or `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
   - `OPENROUTER_API_KEY` (Phase B, when chat endpoint is ready)
   - `OPENROUTER_MODEL` (Phase B)
3. Select **Environment:** Production (or all environments)
4. Save

### 2. Run Migration on Vercel Database

If your database doesn't already have the `knowledge_chunks` table:

```powershell
# From your local environment:
psql $env:POSTGRES_URL -f sql/001_create_knowledge_chunks.sql
```

Vercel doesn't run migrations automatically; you must do this locally or via a one-time script.

### 3. Ingest Data

```powershell
# Set the Vercel database URL
$env:POSTGRES_URL = "your-vercel-postgres-url"

node scripts/ingest-knowledge.js
```

### 4. Redeploy

```powershell
git add .
git commit -m "Add RAG knowledge base migration and ingestion"
git push origin main
```

Vercel will detect the push and redeploy automatically.

---

## Troubleshooting

### "Connection refused" error

**Problem:** The script can't connect to your database.

**Solutions:**
- Verify `POSTGRES_URL` or Supabase credentials are correct in `.env.local`
- If using Supabase, ensure the service role key (not the anon key) is set
- Check that your database is running and accessible
- If self-hosted: ensure firewall rules allow your machine to reach the database

### "Table knowledge_chunks does not exist"

**Problem:** The migration hasn't been run yet.

**Solution:**
```powershell
psql $env:POSTGRES_URL -f sql/001_create_knowledge_chunks.sql
```

### "No chunks parsed"

**Problem:** The ingestion script can't find markdown files.

**Solution:**
- Verify the knowledge base directory: `Test-Path ../zethica_rag_knowledge_base`
- Ensure all 8 `.md` files are present
- Check file permissions; the script needs read access

### "UNIQUE constraint violation on chunk_id"

**Problem:** Running ingestion created duplicate chunks (shouldn't happen with ON CONFLICT).

**Solution:**
- This is safe; the script will skip duplicates on subsequent runs
- If needed, manually check: `SELECT COUNT(DISTINCT chunk_id) FROM knowledge_chunks;`

---

## What's Next

Phase A, Step 1 is complete. You now have:

✓ A `knowledge_chunks` table with 27 chunks from 8 markdown files  
✓ PostgreSQL full-text search capability  
✓ A repeatable ingestion script  

**Next steps (Phase A, Steps 2–3):**

- Build `/api/chat` endpoint (retrieval + OpenRouter integration)
- Integrate chat widget into the website
- Add security, testing, and error handling

---

## Security Checklist

Before deploying to production:

- [ ] Never commit `.env.local` to Git (it's in `.gitignore`)
- [ ] Use environment variables, not hardcoded keys
- [ ] Rotate Supabase service role key if accidentally exposed
- [ ] Use strong database passwords
- [ ] Enable SSL/TLS for database connections (Supabase default: yes)
- [ ] Verify firewall rules restrict database access to authorized IPs
- [ ] Review chat endpoint input validation (Phase B)
- [ ] Monitor API usage for abuse
- [ ] Never expose database credentials in error messages

---

## Support

If you encounter issues:

1. Check this guide again; most problems are configuration-related
2. Verify environment variables: `Get-Content .env.local`
3. Check database connectivity: `psql $env:POSTGRES_URL -c "SELECT 1;"`
4. Review script output for specific error messages
5. Consult PostgreSQL or Supabase documentation for database-specific issues

---

## Summary

You've successfully set up the ZETHICA RAG knowledge base. The ingestion script is idempotent (safe to run multiple times) and will only create new chunks or update existing ones. The database is now ready for the chat endpoint to retrieve relevant information and augment responses with company knowledge.

Proceed to Phase A, Step 2 when ready to build the `/api/chat` endpoint.
