import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, signUser, validateAuthenticatedUser } from '../auth.js';
import { asyncHandler, requireFields } from '../utils.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  requireFields(req.body, ['email', 'password']);

  const users = await query(
    `SELECT users.id, users.full_name, users.email, users.password_hash, users.role, users.organisation_id,
            organisations.name AS organisation_name,
            organisations.type AS organisation_type,
            organisations.email AS organisation_email,
            organisations.status AS organisation_status
     FROM users
     LEFT JOIN organisations ON users.organisation_id = organisations.id
     WHERE users.email = :email AND users.status = 'ACTIVE'`,
    { email: req.body.email }
  );

  if (!users.length) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const user = users[0];
  const ok = await bcrypt.compare(req.body.password, user.password_hash);

  if (!ok) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  delete user.password_hash;
  const validation = await validateAuthenticatedUser(user);
  if (!validation.ok) {
    return res.status(validation.status).json({ message: validation.message });
  }

  res.json({
    token: signUser(validation.user),
    user: validation.user
  });
}));

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
