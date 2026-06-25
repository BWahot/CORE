import jwt from 'jsonwebtoken';
import { query } from './db.js';

export const ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  NGO_SOCIAL_WORKER: 'NGO_SOCIAL_WORKER',
  HOSPITAL_RECORDS_KEEPER: 'HOSPITAL_RECORDS_KEEPER'
};

const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';

export function emailDomain(email) {
  const parts = String(email || '').trim().toLowerCase().split('@');
  return parts.length === 2 && parts[1] ? parts[1] : null;
}

export function organisationDomain(organisation) {
  return emailDomain(organisation?.email);
}

export function expectedOrganisationRole(organisationType) {
  if (organisationType === 'NGO') return ROLES.NGO_SOCIAL_WORKER;
  if (organisationType === 'HOSPITAL') return ROLES.HOSPITAL_RECORDS_KEEPER;
  return null;
}

export async function validateAuthenticatedUser(user) {
  if (!user?.role) {
    return { ok: false, status: 403, message: 'Your account is authenticated but has no assigned role. Please contact support.' };
  }

  if (user.role === ROLES.PLATFORM_ADMIN) {
    if (user.organisation_id) {
      return { ok: false, status: 403, message: 'Your platform administrator account should not be assigned to an organisation. Please contact support.' };
    }

    return { ok: true, user };
  }

  if (!user.organisation_id || !user.organisation_type) {
    return { ok: false, status: 403, message: 'Your account is authenticated but has no assigned organisation. Please contact support.' };
  }

  const domain = emailDomain(user.email);
  if (!domain) {
    return { ok: false, status: 403, message: 'Your account email address is invalid. Please contact support.' };
  }

  const organisations = await query(
    `SELECT id, name, type, email, status
     FROM organisations
     WHERE LOWER(SUBSTRING_INDEX(email, '@', -1)) = :domain
       AND status = 'ACTIVE'`,
    { domain }
  );

  if (!organisations.length) {
    return { ok: false, status: 403, message: 'Your organisation domain is not registered. Please contact support.' };
  }

  const organisation = organisations.find((item) => Number(item.id) === Number(user.organisation_id));
  if (!organisation) {
    return { ok: false, status: 403, message: 'Your account is not assigned to the organisation registered for this email domain. Please contact support.' };
  }

  if (user.role === ROLES.ORG_ADMIN) {
    return { ok: true, user: { ...user, organisation_name: organisation.name, organisation_type: organisation.type, organisation_email: organisation.email, organisation_status: organisation.status } };
  }

  const expectedRole = expectedOrganisationRole(organisation.type);
  if (user.role !== expectedRole) {
    return { ok: false, status: 403, message: 'Your assigned role does not match your organisation type. Please contact support.' };
  }

  return { ok: true, user: { ...user, organisation_name: organisation.name, organisation_type: organisation.type, organisation_email: organisation.email, organisation_status: organisation.status } };
}

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
              organisations.email AS organisation_email,
              organisations.status AS organisation_status
       FROM users
       LEFT JOIN organisations ON users.organisation_id = organisations.id
       WHERE users.id = :id AND users.status = 'ACTIVE'`,
      { id: payload.id }
    );

    if (!users.length) {
      return res.status(401).json({ message: 'User account is no longer active.' });
    }

    const validation = await validateAuthenticatedUser(users[0]);
    if (!validation.ok) {
      return res.status(validation.status).json({ message: validation.message });
    }

    req.user = validation.user;
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
