import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminAuditEntityType = 'customer' | 'contract' | 'invoice' | 'booking'

export interface AdminAuditRow {
  id: string
  label: string
}

export async function logAdminDelete(
  supabaseAdmin: SupabaseClient,
  adminId: string,
  entityType: AdminAuditEntityType,
  rows: AdminAuditRow[],
): Promise<void> {
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'DELETE',
    entity_type: entityType,
    entity_ids: rows.map(r => r.id),
    summary: rows,
  })

  if (error) throw new Error(error.message)
}
