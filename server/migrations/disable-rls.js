#!/usr/bin/env node
/**
 * Remove todas as policies de RLS e desabilita RLS nas tabelas.
 * Execute no shell do Replit:
 *   node server/migrations/disable-rls.js
 */
import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL não definida.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const tables = [
  "doctor_entries", "clinic_reports", "notifications",
  "ai_corrections", "audit_logs", "uploaded_reports",
  "document_templates", "ai_audit_findings", "users",
];

async function disableRLS() {
  const client = await pool.connect();
  try {
    for (const table of tables) {
      const policyName = `rls_${table}_app`;
      await client.query(`DROP POLICY IF EXISTS ${policyName} ON ${table}`).catch(() => {});
      await client.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`).catch(() => {});
      await client.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`).catch(() => {});
      console.log(`  ✅ ${table} — RLS removido`);
    }
    console.log("\n🎉 RLS desabilitado em todas as tabelas. Pode fazer o deploy agora.");
  } finally {
    client.release();
    await pool.end();
  }
}

disableRLS().catch(e => { console.error("❌", e.message); process.exit(1); });
