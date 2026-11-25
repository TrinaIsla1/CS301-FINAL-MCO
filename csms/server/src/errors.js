// Turns Postgres/Supabase errors into plain messages for the client.
export function dbError(error) {
  const map = {
    '23505': [409, 'A record with the same unique value already exists.'],
    '23503': [409, 'This record is still in use (by schedules or students). Remove or change those first.'],
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

// Friendlier messages for the roster's unique rules.
export function studentDbError(error) {
  const text = `${error.message || ''} ${error.details || ''}`
  if (error.code === '23505') {
    const err = new Error(
      text.includes('students_email_key')
        ? 'Another student already has that email address.'
        : 'That student number is already in the roster.',
    )
    err.status = 409
    return err
  }
  return dbError(error)
}
