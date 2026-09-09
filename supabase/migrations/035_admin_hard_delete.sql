-- Migration 035: Admin hard delete support
-- 1. bookings.customer_id currently has no ON DELETE action (defaults to
--    RESTRICT), so deleting a customer profile with any booking fails
--    outright. contracts.customer_id and invoices.customer_id already
--    cascade (migration 003) — bring bookings in line so a customer delete
--    cleanly cascades to all their data.
-- 2. admin_audit_log records every admin hard-delete (who, what, when,
--    a snapshot of what was removed) since the data itself is unrecoverable.

ALTER TABLE bookings DROP CONSTRAINT bookings_customer_id_fkey;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL DEFAULT 'DELETE',
  entity_type text NOT NULL CHECK (entity_type IN ('customer','contract','invoice','booking')),
  entity_ids uuid[] NOT NULL,
  summary jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON admin_audit_log
  FOR SELECT
  USING (get_my_role() = 'admin');

CREATE INDEX admin_audit_log_entity_type_idx ON admin_audit_log(entity_type);
CREATE INDEX admin_audit_log_created_at_idx ON admin_audit_log(created_at);
