import { db } from '../db.js';

export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Verifies the Supabase JWT, requires a verified email, and attaches the user's role.
export const requireAuth = wrap(async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Your session expired. Sign in again.' });
  }
  if (!data.user.email_confirmed_at) {
    return res.status(403).json({ error: 'Verify your email address to continue.' });
  }

  const { data: profile } = await db
    .from('profiles')
    .select('role, full_name')
    .eq('id', data.user.id)
    .single();

  req.user = {
    id: data.user.id,
    email: data.user.email,
    role: profile?.role || 'viewer',
    name: profile?.full_name || '',
  };
  next();
});

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'You do not have permission to do that.' });
