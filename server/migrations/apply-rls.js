#!/usr/bin/env node
/**
 * Aplica as políticas de RLS no banco de produção.
 * Execute no shell do Replit (onde DATABASE_URL está disponível):
 *
 *   node server/migrations/apply-rls.js
 */

import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL não definida. Execute no shell do Replit.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function applyRLS() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT current_user AS role");
    const appRole = rows[0].role;
    console.log(`✅ Role detectado: ${appRole}`);

    const tables = [
      { table: "doctor_entries",     col: "doctor_id" },
      { table: "clinic_reports",     col: "doctor_id" },
      { table: "notifications",      col: "doctor_id" },
      { table: "ai_corrections",     col: "doctor_id" },
      { table: "audit_logs",         col: "doctor_id" },
      { table: "uploaded_reports",   col: "user_id"   },
      { table: "document_templates", col: "user_id"   },
      { table: "ai_audit_findings",  col: "doctor_id" },
      { table: "users",              col: "id"        },
    ];

    for (const { table, col } of tables) {
      const policyName = `rls_${table}_app`;

      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await client.query(`DROP POLICY IF EXISTS ${policyName} ON ${table}`);
      await client.query(`
        CREATE POLICY ${policyName} ON ${table}
          AS PERMISSIVE FOR ALL
          TO ${appRole}
          USING (
            ${col} = NULLIF(current_setting('app.current_user_id', TRUE), '')
            OR current_setting('app.bypass_rls', TRUE) = 'true'
          )
      `);

      console.log(`  ✅ ${table} (${col})`);
    }

    console.log("\n🎉 RLS aplicado com sucesso em todas as tabelas!");
  } finally {
    client.release();
    await pool.end();
  }
}

applyRLS().catch((err) => {
  console.error("❌ Erro:", err.message);
  process.exit(1);
});
