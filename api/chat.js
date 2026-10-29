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
    // Workspace structure:
    // zethica/api/chat.js (this file)
    // Serverside_Instruction/SYSTEM_PROMPT.md
    // So: go up 2 levels from api/, then into Serverside_Instruction/
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const promptPath = path.resolve(__dirname, '../../Serverside_Instruction/SYSTEM_PROMPT.md');
    
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
// DATABASE SEARCH
// ============================================================================

async function searchKnowledge(client, query) {
  try {
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

    return result.rows;
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
    throw new Error('Configuration error');
  }

  if (!model) {
    console.error('Missing OPENROUTER_MODEL');
    throw new Error('Configuration error');
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

      if (response.status === 429) {
        throw new Error('Rate limited');
      } else if (response.status === 401) {
        console.error('Invalid API key');
        throw new Error('Authentication error');
      } else if (response.status === 400) {
        console.error('Invalid request to OpenRouter');
        throw new Error('Invalid model or request');
      } else {
        throw new Error('LLM service error');
      }
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected OpenRouter response format');
      throw new Error('Invalid response format');
    }

    return data.choices[0].message.content;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('OpenRouter API request timeout');
      throw new Error('Request timeout');
    }
    throw err;
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

    // Extract sources for response
    const sources = retrievedChunks.map(chunk => ({
      source_file: chunk.source_file,
      section_heading: chunk.section_heading
    }));

    // Call OpenRouter API
    let reply;
    try {
      reply = await callOpenRouter(systemPrompt, userMessage, retrievedChunks);
    } catch (err) {
      console.error('OpenRouter error:', err.message);
      return res.status(500).json({ error: 'Service temporarily unavailable' });
    }

    // Success response
    return res.status(200).json({
      reply,
      sources
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
