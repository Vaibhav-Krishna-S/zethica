// api/contact.js — Vercel serverless function
import pkg from 'pg';
const { Client } = pkg;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, service, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        email        TEXT NOT NULL,
        service      TEXT,
        message      TEXT NOT NULL,
        submitted_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(
      `INSERT INTO contacts (name, email, service, message) VALUES ($1, $2, $3, $4)`,
      [name, email, service || null, message]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact DB error:', err);
    return res.status(500).json({ error: 'Database error. Please try again.' });
  } finally {
    await client.end();
  }
}
