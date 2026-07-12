// api/contact.js — Vercel serverless function
// Saves contact form submissions to PostgreSQL `contacts` table

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, service, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required' });
  }

  try {
    // Create table if it doesn't exist yet
    await sql`
      CREATE TABLE IF NOT EXISTS contacts (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        email        TEXT NOT NULL,
        service      TEXT,
        message      TEXT NOT NULL,
        submitted_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO contacts (name, email, service, message)
      VALUES (${name}, ${email}, ${service || null}, ${message})
    `;

    return res.status(200).json({ success: true, message: 'Message received' });
  } catch (err) {
    console.error('Contact DB error:', err);
    return res.status(500).json({ error: 'Database error. Please try again.' });
  }
}
