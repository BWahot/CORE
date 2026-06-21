import jwt from 'jsonwebtoken';
import { query } from './db.js';

export const ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  NGO_SOCIAL_WORKER: 'NGO_SOCIAL_WORKER',
  HOSPITAL_RECORDS_KEEPER: 'HOSPITAL_RECORDS_KEEPER'
};

const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signUser(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      organisation_id: user.organisation_id
    },
    jwtSecret,
    { expiresIn: '8h' }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required.' });
    }

    const payload = jwt.verify(token, jwtSecret);
    const users = await query(
      `SELECT users.id, users.full_name, users.email, users.role, users.organisation_id,
              organisations.name AS organisation_name,
              organisations.type AS organisation_type,
              organisations.status AS organisation_status
       FROM users
       LEFT JOIN organisations ON users.organisation_id = organisations.id
       WHERE users.id = :id AND users.status = 'ACTIVE'`,
      { id: payload.id }
    );

    if (!users.length) {
      return res.status(401).json({ message: 'User account is no longer active.' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }

    next();
  };
}

export function requireOperationalRole(req, res, next) {
  if (![ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER].includes(req.user.role)) {
    return res.status(403).json({ message: 'Administrative users cannot access referral content.' });
  }

  next();
}

export function requireOrganisationUser(req, res, next) {
  if (!req.user.organisation_id) {
    return res.status(403).json({ message: 'This action requires an organisation user.' });
  }

  next();
}

export function referralScopeWhere(user, alias = 'r') {
  if (user.role === ROLES.NGO_SOCIAL_WORKER) {
    return {
      clause: `${alias}.referring_organisation_id = :scopeOrganisationId`,
      params: { scopeOrganisationId: user.organisation_id }
    };
  }

  if (user.role === ROLES.HOSPITAL_RECORDS_KEEPER) {
    return {
      clause: `${alias}.receiving_organisation_id = :scopeOrganisationId`,
      params: { scopeOrganisationId: user.organisation_id }
    };
  }

  return { clause: '1 = 0', params: {} };
}

export function canManageStaff(actor, targetOrganisationId) {
  if (actor.role !== ROLES.ORG_ADMIN) {
    return false;
  }

  return Number(actor.organisation_id) === Number(targetOrganisationId);
}

export function isPlatformAdmin(user) {
  return user.role === ROLES.PLATFORM_ADMIN;
}
