// api/waitlist.js — Vercel serverless function
import pkg from 'pg';
const { Client } = pkg;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id        SERIAL PRIMARY KEY,
        email     TEXT NOT NULL UNIQUE,
        joined_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(
      `INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
      [email]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Waitlist DB error:', err);
    return res.status(500).json({ error: 'Database error. Please try again.' });
  } finally {
    await client.end();
  }
}
