#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

async function verify() {
  const connectionString = process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('❌ POSTGRES_URL not set');
    process.exit(1);
  }
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    await client.connect();
    
    // Get total count
    const totalResult = await client.query('SELECT COUNT(*) as total FROM knowledge_chunks');
    const total = totalResult.rows[0].total;
    
    // Get breakdown by source
    const breakdownResult = await client.query(
      'SELECT source_file, COUNT(*) as cnt FROM knowledge_chunks GROUP BY source_file ORDER BY source_file'
    );
    
    console.log('\n📊 Verification: Chunks in Database\n');
    breakdownResult.rows.forEach(row => {
      console.log(`   ${row.source_file}: ${row.cnt} chunks`);
    });
    console.log(`\n   TOTAL: ${total} chunks\n`);
    
    if (parseInt(total) === 63) {
      console.log('✅ Verification PASSED: All 63 chunks successfully ingested\n');
      process.exit(0);
    } else {
      console.log(`⚠️  Expected 63 chunks, found ${total}\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Verification error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verify();
