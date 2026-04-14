-- =============================================================================
-- RLS (Row Level Security) — RecebMed
-- =============================================================================
-- Objetivo: garantir isolamento por médico no banco de dados.
-- Se a credencial do serviço for comprometida, o atacante só pode acessar
-- os dados do usuário cujo ID estiver definido na sessão.
--
-- Como executar:
--   1. Descubra o usuário da conexão da aplicação:
--        SELECT current_user;
--   2. Preencha APP_ROLE abaixo com o resultado acima.
--   3. Execute este script como superusuário no banco de produção:
--        psql $DATABASE_URL -f server/migrations/001_rls_policies.sql
--
-- Como a aplicação usa o RLS:
--   Antes de qualquer query sensível, execute:
--     SET LOCAL app.current_user_id = '<uuid-do-médico>';
--   O helper withUserContext() em server/db.ts faz isso automaticamente
--   quando você o utiliza.
-- =============================================================================

-- Altere para o role que a aplicação usa para conectar ao banco.
-- Geralmente é o valor de current_user na string de conexão.
\set APP_ROLE 'neondb_owner'

-- ---------------------------------------------------------------------------
-- doctor_entries
-- ---------------------------------------------------------------------------
ALTER TABLE doctor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_doctor_entries_app ON doctor_entries;
CREATE POLICY rls_doctor_entries_app ON doctor_entries
  AS PERMISSIVE FOR ALL
  TO :APP_ROLE
  USING (
    doctor_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    OR current_setting('app.bypass_rls', TRUE) = 'true'
  );

-- ---------------------------------------------------------------------------
-- clinic_reports
-- ---------------------------------------------------------------------------
ALTER TABLE clinic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_clinic_reports_app ON clinic_reports;
CREATE POLICY rls_clinic_reports_app ON clinic_reports
  AS PERMISSIVE FOR ALL
  TO :APP_ROLE
  USING (
    doctor_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    OR current_setting('app.bypass_rls', TRUE) = 'true'
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_notifications_app ON notifications;
CREATE POLICY rls_notifications_app ON notifications
  AS PERMISSIVE FOR ALL
  TO :APP_ROLE
  USING (
    doctor_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    OR current_setting('app.bypass_rls', TRUE) = 'true'
  );

-- ---------------------------------------------------------------------------
-- ai_corrections
-- ---------------------------------------------------------------------------
ALTER TABLE ai_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_corrections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_ai_corrections_app ON ai_corrections;
CREATE POLICY rls_ai_corrections_app ON ai_corrections
  AS PERMISSIVE FOR ALL
  TO :APP_ROLE
  USING (
    doctor_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    OR current_setting('app.bypass_rls', TRUE) = 'true'
  );

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_audit_logs_app ON audit_logs;
CREATE POLICY rls_audit_logs_app ON audit_logs
  AS PERMISSIVE FOR ALL
  TO :APP_ROLE
  USING (
    doctor_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    OR current_setting('app.bypass_rls', TRUE) = 'true'
  );

-- ---------------------------------------------------------------------------
-- uploaded_reports
-- ---------------------------------------------------------------------------
ALTER TABLE uploaded_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_uploaded_reports_app ON uploaded_reports;
CREATE POLICY rls_uploaded_reports_app ON uploaded_reports
  AS PERMISSIVE FOR ALL
  TO :APP_ROLE
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    OR current_setting('app.bypass_rls', TRUE) = 'true'
  );

-- ---------------------------------------------------------------------------
-- document_templates
-- ---------------------------------------------------------------------------
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_document_templates_app ON document_templates;
CREATE POLICY rls_document_templates_app ON document_templates
  AS PERMISSIVE FOR ALL
  TO :APP_ROLE
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    OR current_setting('app.bypass_rls', TRUE) = 'true'
  );

-- ---------------------------------------------------------------------------
-- ai_audit_findings
-- ---------------------------------------------------------------------------
ALTER TABLE ai_audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_findings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_ai_audit_findings_app ON ai_audit_findings;
CREATE POLICY rls_ai_audit_findings_app ON ai_audit_findings
  AS PERMISSIVE FOR ALL
  TO :APP_ROLE
  USING (
    doctor_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    OR current_setting('app.bypass_rls', TRUE) = 'true'
  );

-- ---------------------------------------------------------------------------
-- users (apenas a própria linha)
-- ---------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_users_own ON users;
CREATE POLICY rls_users_own ON users
  AS PERMISSIVE FOR ALL
  TO :APP_ROLE
  USING (
    id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    OR current_setting('app.bypass_rls', TRUE) = 'true'
  );
