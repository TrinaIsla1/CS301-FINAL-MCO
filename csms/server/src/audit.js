import { db } from './db.js';

// Best-effort audit trail. A logging failure never blocks the request.
export async function logAudit(user, action, entity, entityId, oldData, newData) {
  try {
    await db.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action,
      entity,
      entity_id: entityId,
      old_data: oldData ?? null,
      new_data: newData ?? null,
    });
  } catch (_) {
    /* ignore */
  }
}
