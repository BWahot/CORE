import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, ROLES } from '../auth.js';
import { asyncHandler } from '../utils.js';

export const lookupsRouter = Router();

lookupsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const organisations = await query(
    `SELECT id, name, type, email, phone, location, status
     FROM organisations
     WHERE status = 'ACTIVE'
     ORDER BY type, name`
  );

  const users = req.user.role === ROLES.PLATFORM_ADMIN
    ? await query('SELECT id, full_name, email, role, organisation_id, status FROM users ORDER BY full_name')
    : await query(
      `SELECT id, full_name, email, role, organisation_id, status
       FROM users
       WHERE organisation_id = :organisationId
       ORDER BY full_name`,
      { organisationId: req.user.organisation_id }
    );

  res.json({
    organisations,
    ngos: organisations.filter((organisation) => organisation.type === 'NGO'),
    hospitals: organisations.filter((organisation) => organisation.type === 'HOSPITAL'),
    users,
    roles: Object.values(ROLES),
    organisationRoles: [ROLES.ORG_ADMIN, ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER],
    statuses: ['Pending', 'Accepted', 'In Progress', 'Completed', 'Rejected', 'Cancelled'],
    urgencyLevels: ['Low', 'Medium', 'High', 'Critical']
  });
}));
