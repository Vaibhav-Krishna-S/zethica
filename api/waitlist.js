// api/waitlist.js — Vercel serverless function
// Saves waitlist email to PostgreSQL `waitlist` table

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    // Create table if it doesn't exist yet
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id        SERIAL PRIMARY KEY,
        email     TEXT NOT NULL UNIQUE,
        joined_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO waitlist (email)
      VALUES (${email})
      ON CONFLICT (email) DO NOTHING
    `;

    return res.status(200).json({ success: true, message: 'Added to waitlist' });
  } catch (err) {
    console.error('Waitlist DB error:', err);
    return res.status(500).json({ error: 'Database error. Please try again.' });
  }
}
