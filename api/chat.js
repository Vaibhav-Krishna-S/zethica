// api/chat.js — ZETHICA RAG Chatbot Endpoint
// Vercel serverless function for retrieving grounded answers from the knowledge base
//
// Flow:
// 1. Validate input (message, length, JSON)
// 2. Check rate limit (per IP, in-memory counter)
// 3. Connect to PostgreSQL and search knowledge_chunks
// 4. Load server-side system prompt
// 5. Call OpenRouter API with context and user message
// 6. Return response or generic error

import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pkg;

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 1;
const SEARCH_RESULT_LIMIT = 5;
const OPENROUTER_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_TIMEOUT = 30000; // 30 seconds

// In-memory rate limit store (per serverless instance)
// WARNING: This is NOT a reliable global rate limiter across instances
// See documentation for production alternatives
const rateLimitStore = new Map();
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// ============================================================================
// SYSTEM PROMPT LOADING
// ============================================================================

let cachedSystemPrompt = null;

function loadSystemPrompt() {
  if (cachedSystemPrompt) {
    return cachedSystemPrompt;
  }

  try {
    // Resolve path relative to this file (api/chat.js)
    // Repository structure:
    // zethica/api/chat.js (this file)
    // zethica/server/SYSTEM_PROMPT.md (server-only, included in Vercel deployment)
    // So: go up 1 level from api/, then into server/
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const promptPath = path.resolve(__dirname, '../server/SYSTEM_PROMPT.md');
    
    if (!fs.existsSync(promptPath)) {
      console.error(`System prompt not found at: ${promptPath}`);
      throw new Error('System prompt unavailable');
    }

    cachedSystemPrompt = fs.readFileSync(promptPath, 'utf8');
    return cachedSystemPrompt;
  } catch (err) {
    console.error('Failed to load system prompt:', err.message);
    throw new Error('Configuration error');
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

function getClientIp(req) {
  // Respect X-Forwarded-For header (set by Vercel)
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.connection.remoteAddress ||
         'unknown';
}

function checkRateLimit(ip) {
  const key = `rate:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Initialize or reset if window expired
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000
    });
    return true;
  }

  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  // Increment and allow
  entry.count++;
  return true;
}

// ============================================================================
// DATABASE SEARCH (Two-Phase Retrieval with Fallback)
// ============================================================================

// Conservative stop-word list for filtering insignificant terms
// Used only in Phase 2 OR fallback query
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could',
  'should', 'would', 'will', 'shall', 'may', 'might', 'must', 'how',
  'what', 'when', 'where', 'why', 'who', 'whom', 'which', 'that', 'this',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'him',
  'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
]);

// Helper to build OR query from user input
// Removes stop words, normalizes tokens, and joins with | operator
// Returns empty string if no significant terms remain
function buildOrQuery(query) {
  // Validate input
  if (!query || typeof query !== 'string') {
    return '';
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return '';
  }

  // Extract words (alphanumeric sequences)
  const terms = trimmedQuery
    .toLowerCase()
    .match(/\b\w+\b/g) || [];

  if (terms.length === 0) {
    return '';
  }

  // Filter: remove stop words and duplicates
  const significantTerms = [];
  const seen = new Set();

  for (const term of terms) {
    if (!STOP_WORDS.has(term) && !seen.has(term)) {
      significantTerms.push(term);
      seen.add(term);
    }
  }

  // Return empty if all terms were stop words
  if (significantTerms.length === 0) {
    return '';
  }

  // Join with OR operator for to_tsquery
  return significantTerms.join(' | ');
}

async function searchKnowledge(client, query) {
  try {
    // PHASE 1: Strict AND query (current behavior, unchanged)
    const result = await client.query(
      `SELECT 
         chunk_id,
         source_file,
         section_heading,
         subsection_heading,
         chunk_content
       FROM knowledge_chunks
       WHERE content_tsvector @@ plainto_tsquery('english', $1)
       ORDER BY ts_rank(content_tsvector, plainto_tsquery('english', $1)) DESC
       LIMIT $2`,
      [query, SEARCH_RESULT_LIMIT]
    );

    // If Phase 1 found results, return them (preserve all working queries)
    if (result.rows.length > 0) {
      return result.rows;
    }

    // PHASE 2: OR fallback (only if Phase 1 returned zero chunks)
    const orQuery = buildOrQuery(query);
    
    // If no significant terms remain after stop-word filtering, return empty
    if (!orQuery) {
      return [];
    }

    const fallbackResult = await client.query(
      `SELECT 
         chunk_id,
         source_file,
         section_heading,
         subsection_heading,
         chunk_content
       FROM knowledge_chunks
       WHERE content_tsvector @@ to_tsquery('english', $1)
       ORDER BY ts_rank(content_tsvector, to_tsquery('english', $1)) DESC
       LIMIT $2`,
      [orQuery, SEARCH_RESULT_LIMIT]
    );

    return fallbackResult.rows;
  } catch (err) {
    console.error('Knowledge search error:', err.message);
    throw new Error('Database error');
  }
}

// ============================================================================
// OPENROUTER API CALL
// ============================================================================

async function callOpenRouter(systemPrompt, userMessage, retrievedContext) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;

  if (!apiKey) {
    console.error('Missing OPENROUTER_API_KEY');
    throw { code: 'MISSING_CONFIG', message: 'OpenRouter API key not configured' };
  }

  if (!model) {
    console.error('Missing OPENROUTER_MODEL');
    throw { code: 'MISSING_CONFIG', message: 'OpenRouter model not configured' };
  }

  // Build the user message with context
  let contextualUserMessage = userMessage;
  if (retrievedContext.length > 0) {
    const contextText = retrievedContext
      .map(chunk => chunk.chunk_content)
      .join('\n\n---\n\n');
    contextualUserMessage = `Based on this company knowledge:\n\n${contextText}\n\nPlease answer: ${userMessage}`;
  } else {
    contextualUserMessage = `Please answer this question about ZETHICA. If the knowledge base does not contain the answer, say so and suggest contacting the team: ${userMessage}`;
  }

  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: contextualUserMessage
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_API_TIMEOUT);

    const response = await fetch(OPENROUTER_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zethica.online'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`OpenRouter API error: ${response.status} ${errorData.substring(0, 100)}`);

      // Classify error for fallback decision
      if (response.status === 429) {
        throw { code: 'RATE_LIMIT', status: 429, message: 'Rate limited' };
      } else if (response.status === 503 || response.status === 502) {
        throw { code: 'SERVICE_UNAVAILABLE', status: response.status, message: 'Service temporarily unavailable' };
      } else if (response.status === 500) {
        throw { code: 'SERVER_ERROR', status: 500, message: 'Server error' };
      } else if (response.status === 401) {
        console.error('Invalid API key');
        throw { code: 'AUTH_ERROR', status: 401, message: 'Authentication error' };
      } else if (response.status === 400) {
        console.error('Invalid request to OpenRouter');
        throw { code: 'INVALID_REQUEST', status: 400, message: 'Invalid request' };
      } else {
        throw { code: 'LLM_ERROR', status: response.status, message: 'LLM service error' };
      }
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected OpenRouter response format');
      throw { code: 'INVALID_RESPONSE', message: 'Invalid response format' };
    }

    return data.choices[0].message.content;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('OpenRouter API request timeout');
      throw { code: 'TIMEOUT', message: 'Request timeout' };
    }
    // Re-throw with error code if already classified
    if (err.code) {
      throw err;
    }
    throw { code: 'NETWORK_ERROR', message: err.message || 'Network error' };
  }
}

// ============================================================================
// GEMINI API CALL (Fallback Provider)
// ============================================================================

async function callGemini(systemPrompt, userMessage, retrievedContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;

  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY');
    throw { code: 'MISSING_CONFIG', message: 'Gemini API key not configured' };
  }

  if (!model) {
    console.error('Missing GEMINI_MODEL');
    throw { code: 'MISSING_CONFIG', message: 'Gemini model not configured' };
  }

  const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Build the user message with context (same as OpenRouter)
  let userContent = userMessage;
  if (retrievedContext.length > 0) {
    const contextText = retrievedContext
      .map(chunk => chunk.chunk_content)
      .join('\n\n---\n\n');
    userContent = `Based on this company knowledge:\n\n${contextText}\n\nPlease answer: ${userMessage}`;
  } else {
    userContent = `Please answer this question about ZETHICA. If the knowledge base does not contain the answer, say so and suggest contacting the team: ${userMessage}`;
  }

  const requestBody = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          { text: userContent }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_API_TIMEOUT);

    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Gemini API error: ${response.status} ${errorData.substring(0, 100)}`);

      // Classify error
      if (response.status === 429) {
        throw { code: 'RATE_LIMIT', status: 429, message: 'Rate limited' };
      } else if (response.status === 503 || response.status === 502) {
        throw { code: 'SERVICE_UNAVAILABLE', status: response.status, message: 'Service unavailable' };
      } else if (response.status === 500) {
        throw { code: 'SERVER_ERROR', status: 500, message: 'Server error' };
      } else if (response.status === 401 || response.status === 403) {
        console.error('Invalid Gemini API key');
        throw { code: 'AUTH_ERROR', status: response.status, message: 'Authentication error' };
      } else if (response.status === 400) {
        console.error('Invalid request to Gemini');
        throw { code: 'INVALID_REQUEST', status: 400, message: 'Invalid request' };
      } else {
        throw { code: 'LLM_ERROR', status: response.status, message: 'LLM service error' };
      }
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Unexpected Gemini response format');
      throw { code: 'INVALID_RESPONSE', message: 'Invalid response format' };
    }

    // Extract text from Gemini response
    const parts = data.candidates[0].content.parts;
    if (!parts || parts.length === 0) {
      throw { code: 'INVALID_RESPONSE', message: 'No content in response' };
    }

    return parts.map(part => part.text).join('');
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Gemini API request timeout');
      throw { code: 'TIMEOUT', message: 'Request timeout' };
    }
    // Re-throw with error code if already classified
    if (err.code) {
      throw err;
    }
    throw { code: 'NETWORK_ERROR', message: err.message || 'Network error' };
  }
}

// ============================================================================
// DUAL PROVIDER HANDLER WITH FALLBACK
// ============================================================================

async function callLLMWithFallback(systemPrompt, userMessage, retrievedContext) {
  let provider = 'openrouter';
  
  try {
    // Try OpenRouter first (primary provider)
    const reply = await callOpenRouter(systemPrompt, userMessage, retrievedContext);
    console.log('Provider: OpenRouter — Success');
    return { reply, provider: 'openrouter' };
  } catch (err) {
    console.error(`OpenRouter failed (${err.code}): ${err.message}`);
    
    // Determine if fallback is appropriate
    const shouldFallback = [
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE',
      'SERVER_ERROR',
      'TIMEOUT',
      'NETWORK_ERROR'
    ].includes(err.code);

    if (!shouldFallback) {
      // Don't fall back for auth errors, config errors, invalid requests
      console.error(`OpenRouter error not eligible for fallback: ${err.code}`);
      throw err;
    }

    // Check if Gemini is configured
    if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) {
      console.warn('Gemini not configured, cannot fallback');
      throw err;
    }

    console.log('Falling back to Gemini provider...');

    try {
      // Try Gemini as fallback
      const reply = await callGemini(systemPrompt, userMessage, retrievedContext);
      console.log('Provider: Gemini — Fallback success');
      return { reply, provider: 'gemini' };
    } catch (geminiErr) {
      console.error(`Gemini fallback failed (${geminiErr.code}): ${geminiErr.message}`);
      throw geminiErr;
    }
  }
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

function validateInput(req) {
  // Check method
  if (req.method !== 'POST') {
    return { valid: false, statusCode: 405, error: 'Method not allowed' };
  }

  // Check JSON
  if (typeof req.body !== 'object' || req.body === null) {
    return { valid: false, statusCode: 400, error: 'Invalid JSON' };
  }

  // Check message field
  if (!req.body.message) {
    return { valid: false, statusCode: 400, error: 'Message field required' };
  }

  if (typeof req.body.message !== 'string') {
    return { valid: false, statusCode: 400, error: 'Message must be a string' };
  }

  // Trim and check length
  const trimmedMessage = req.body.message.trim();

  if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
    return { valid: false, statusCode: 400, error: 'Message cannot be empty' };
  }

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, statusCode: 400, error: 'Message too long' };
  }

  return { valid: true, message: trimmedMessage };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate input
  const validation = validateInput(req);
  if (!validation.valid) {
    return res.status(validation.statusCode).json({ error: 'Invalid request' });
  }

  // Check rate limit
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    console.warn(`Rate limit exceeded for IP: ${clientIp}`);
    return res.status(429).json({ error: 'Too many requests' });
  }

  const userMessage = validation.message;

  // Create database client
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Load system prompt
    let systemPrompt;
    try {
      systemPrompt = loadSystemPrompt();
    } catch (err) {
      console.error('System prompt error:', err.message);
      return res.status(500).json({ error: 'Service temporarily unavailable' });
    }

    // Connect to database
    await client.connect();

    // Search knowledge base
    const retrievedChunks = await searchKnowledge(client, userMessage);

    // Extract sources for response (hidden from customer in frontend)
    const sources = retrievedChunks.map(chunk => ({
      source_file: chunk.source_file,
      section_heading: chunk.section_heading
    }));

    // Call LLM with fallback support
    let reply;
    let provider = 'unknown';
    try {
      const result = await callLLMWithFallback(systemPrompt, userMessage, retrievedChunks);
      reply = result.reply;
      provider = result.provider;
    } catch (err) {
      console.error('LLM call failed (all providers exhausted):', err.message);
      return res.status(500).json({ error: 'Service temporarily unavailable' });
    }

    // Success response
    return res.status(200).json({
      reply,
      sources,
      _provider: provider  // Internal logging (prefixed with _ to indicate internal)
    });
  } catch (err) {
    console.error('Chat handler error:', err.message);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  } finally {
    try {
      await client.end();
    } catch (err) {
      console.error('Error closing database connection:', err.message);
    }
  }
}
