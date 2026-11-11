// Turns Postgres/Supabase errors into plain messages for the client.
export function dbError(error) {
  const map = {
    '23505': [409, 'A record with the same unique value already exists.'],
    '23503': [409, 'This record is in use by a schedule. Remove or change those schedules first.'],
    '23514': [400, 'One of the values is not allowed. Check the times and numbers.'],
    '23P01': [409, 'This schedule conflicts with an existing class (same room, instructor, or section and time).'],
  };
  const [status, message] = map[error.code] || [500, error.message || 'Something went wrong.'];
  const err = new Error(message);
  err.status = status;
  return err;
}

export const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
