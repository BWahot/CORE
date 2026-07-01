import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { pool, query } from '../db.js';
import { canManageStaff, emailDomain, organisationDomain, requireAuth, requireRole, ROLES } from '../auth.js';
import { asyncHandler, requireFields } from '../utils.js';

export const adminRouter = Router();

function normaliseDomain(domain) {
  return String(domain || '').trim().toLowerCase().replace(/^@/, '');
}

function domainFromOrganisationInput(body) {
  return normaliseDomain(body.email_domain || emailDomain(body.email));
}

async function execute(connection, sql, params = {}) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

async function assertUniqueOrganisationDomain(connection, domain, organisationId = null) {
  const rows = await execute(
    connection,
    `SELECT id FROM organisations
     WHERE LOWER(SUBSTRING_INDEX(email, '@', -1)) = :domain
       AND (:organisation_id IS NULL OR id != :organisation_id)`,
    { domain, organisation_id: organisationId }
  );

  if (rows.length) {
    const error = new Error('An organisation with this email domain already exists.');
    error.status = 400;
    throw error;
  }
}

function validateOrganisationAdminPayload(body, isEdit = false) {
  requireFields(body, ['name', 'type', 'email_domain', 'email', 'admin_full_name', 'admin_email']);
  if (!isEdit && !body.admin_id) {
    requireFields(body, ['admin_password']);
  }

  const domain = domainFromOrganisationInput(body);
  if (!domain) {
    const error = new Error('Organisation email domain is required.');
    error.status = 400;
    throw error;
  }

  if (emailDomain(body.email) !== domain) {
    const error = new Error('Contact email must use the registered organisation email domain.');
    error.status = 400;
    throw error;
  }

  if (emailDomain(body.admin_email) !== domain) {
    const error = new Error('Organisation administrators must use the registered organisation email domain.');
    error.status = 400;
    throw error;
  }

  return domain;
}

adminRouter.get('/organisations', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  const organisations = await query('SELECT * FROM organisations ORDER BY type, name');
  res.json({ organisations });
}));

adminRouter.post('/organisations', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'type']);

  const result = await query(
    `INSERT INTO organisations (name, type, email, phone, location, status)
     VALUES (:name, :type, :email, :phone, :location, :status)`,
    {
      name: req.body.name,
      type: req.body.type,
      email: req.body.email || null,
      phone: req.body.phone || null,
      location: req.body.location || null,
      status: req.body.status || 'ACTIVE'
    }
  );

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (:userId, 'CREATE_ORGANISATION', 'organisation', :entityId, JSON_OBJECT('name', :name, 'type', :type))`,
    { userId: req.user.id, entityId: result.insertId, name: req.body.name, type: req.body.type }
  );

  const [organisation] = await query('SELECT * FROM organisations WHERE id = :id', { id: result.insertId });
  res.status(201).json({ organisation });
}));

adminRouter.patch('/organisations/:id', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  await query(
    `UPDATE organisations
     SET name = COALESCE(:name, name),
         email = COALESCE(:email, email),
         phone = COALESCE(:phone, phone),
         location = COALESCE(:location, location),
         status = COALESCE(:status, status)
     WHERE id = :id`,
    {
      id: req.params.id,
      name: req.body.name || null,
      email: req.body.email || null,
      phone: req.body.phone || null,
      location: req.body.location || null,
      status: req.body.status || null
    }
  );

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (:userId, 'UPDATE_ORGANISATION', 'organisation', :entityId, JSON_OBJECT('status', :status))`,
    { userId: req.user.id, entityId: req.params.id, status: req.body.status || null }
  );

  const [organisation] = await query('SELECT * FROM organisations WHERE id = :id', { id: req.params.id });
  res.json({ organisation });
}));

adminRouter.post('/organisations-with-admin', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  const domain = validateOrganisationAdminPayload(req.body);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await assertUniqueOrganisationDomain(connection, domain);

    const organisationResult = await execute(
      connection,
      `INSERT INTO organisations (name, type, email, phone, location, status)
       VALUES (:name, :type, :email, :phone, :location, :status)`,
      {
        name: req.body.name,
        type: req.body.type,
        email: req.body.email,
        phone: req.body.phone || null,
        location: req.body.location || null,
        status: req.body.status || 'ACTIVE'
      }
    );

    const passwordHash = await bcrypt.hash(req.body.admin_password, 10);
    const adminResult = await execute(
      connection,
      `INSERT INTO users (organisation_id, full_name, email, password_hash, role, status)
       VALUES (:organisation_id, :full_name, :email, :password_hash, 'ORG_ADMIN', :status)`,
      {
        organisation_id: organisationResult.insertId,
        full_name: req.body.admin_full_name,
        email: req.body.admin_email,
        password_hash: passwordHash,
        status: req.body.admin_status || 'ACTIVE'
      }
    );

    await execute(
      connection,
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (:userId, 'CREATE_ORGANISATION_WITH_ADMIN', 'organisation', :entityId,
         JSON_OBJECT('name', :name, 'type', :type, 'admin_user_id', :adminUserId))`,
      { userId: req.user.id, entityId: organisationResult.insertId, name: req.body.name, type: req.body.type, adminUserId: adminResult.insertId }
    );

    await connection.commit();
    const [organisation] = await query('SELECT * FROM organisations WHERE id = :id', { id: organisationResult.insertId });
    const [admin] = await query(
      `SELECT u.id, u.organisation_id, u.full_name, u.email, u.role, u.status, u.created_at, u.updated_at,
              o.name AS organisation_name, o.type AS organisation_type, o.email AS organisation_email
       FROM users u
       JOIN organisations o ON o.id = u.organisation_id
       WHERE u.id = :id`,
      { id: adminResult.insertId }
    );
    res.status(201).json({ organisation, admin });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      error.status = 400;
      error.message = 'An organisation administrator with this email already exists.';
    }
    throw error;
  } finally {
    connection.release();
  }
}));

adminRouter.patch('/organisations/:id/with-admin', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  const domain = validateOrganisationAdminPayload(req.body, true);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const organisations = await execute(connection, 'SELECT * FROM organisations WHERE id = :id', { id: req.params.id });
    if (!organisations.length) {
      const error = new Error('Organisation was not found.');
      error.status = 404;
      throw error;
    }

    await assertUniqueOrganisationDomain(connection, domain, req.params.id);
    await execute(
      connection,
      `UPDATE organisations
       SET name = :name,
           type = :type,
           email = :email,
           phone = :phone,
           location = :location,
           status = :status
       WHERE id = :id`,
      {
        id: req.params.id,
        name: req.body.name,
        type: req.body.type,
        email: req.body.email,
        phone: req.body.phone || null,
        location: req.body.location || null,
        status: req.body.status || 'ACTIVE'
      }
    );

    const existingAdmins = await execute(
      connection,
      'SELECT * FROM users WHERE organisation_id = :organisation_id AND role = :role ORDER BY created_at LIMIT 1',
      { organisation_id: req.params.id, role: ROLES.ORG_ADMIN }
    );
    const adminId = req.body.admin_id || existingAdmins[0]?.id || null;

    if (adminId) {
      const passwordClause = req.body.admin_password ? ', password_hash = :password_hash' : '';
      await execute(
        connection,
        `UPDATE users
         SET organisation_id = :organisation_id,
             full_name = :full_name,
             email = :email,
             status = :status
             ${passwordClause}
         WHERE id = :id AND role = :role`,
        {
          id: adminId,
          role: ROLES.ORG_ADMIN,
          organisation_id: req.params.id,
          full_name: req.body.admin_full_name,
          email: req.body.admin_email,
          status: req.body.admin_status || 'ACTIVE',
          password_hash: req.body.admin_password ? await bcrypt.hash(req.body.admin_password, 10) : null
        }
      );
    } else {
      requireFields(req.body, ['admin_password']);
      await execute(
        connection,
        `INSERT INTO users (organisation_id, full_name, email, password_hash, role, status)
         VALUES (:organisation_id, :full_name, :email, :password_hash, 'ORG_ADMIN', :status)`,
        {
          organisation_id: req.params.id,
          full_name: req.body.admin_full_name,
          email: req.body.admin_email,
          password_hash: await bcrypt.hash(req.body.admin_password, 10),
          status: req.body.admin_status || 'ACTIVE'
        }
      );
    }

    await execute(
      connection,
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (:userId, 'UPDATE_ORGANISATION_WITH_ADMIN', 'organisation', :entityId,
         JSON_OBJECT('status', :status, 'admin_user_id', :adminUserId))`,
      { userId: req.user.id, entityId: req.params.id, status: req.body.status || null, adminUserId: adminId }
    );

    await connection.commit();
    const [organisation] = await query('SELECT * FROM organisations WHERE id = :id', { id: req.params.id });
    const [admin] = await query(
      `SELECT u.id, u.organisation_id, u.full_name, u.email, u.role, u.status, u.created_at, u.updated_at,
              o.name AS organisation_name, o.type AS organisation_type, o.email AS organisation_email
       FROM users u
       JOIN organisations o ON o.id = u.organisation_id
       WHERE u.organisation_id = :organisation_id AND u.role = :role
       ORDER BY u.created_at
       LIMIT 1`,
      { organisation_id: req.params.id, role: ROLES.ORG_ADMIN }
    );
    res.json({ organisation, admin });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      error.status = 400;
      error.message = 'An organisation administrator with this email already exists.';
    }
    throw error;
  } finally {
    connection.release();
  }
}));

adminRouter.get('/active-users', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  const organisations = await query(
    `SELECT o.id, o.name, o.type, o.status, COUNT(u.id) AS active_users
     FROM organisations o
     LEFT JOIN users u ON u.organisation_id = o.id AND u.status = 'ACTIVE'
     GROUP BY o.id, o.name, o.type, o.status
     ORDER BY active_users DESC, o.name`
  );
  res.json({ organisations });
}));

adminRouter.get('/organisation-admins', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  // Platform admins see only organisation administrator accounts, joined to their assigned organisation.
  const admins = await query(
    `SELECT u.id, u.organisation_id, u.full_name, u.email, u.role, u.status, u.created_at, u.updated_at,
            o.name AS organisation_name, o.type AS organisation_type, o.email AS organisation_email
     FROM users u
     JOIN organisations o ON o.id = u.organisation_id
     WHERE u.role = :role
     ORDER BY u.created_at DESC, u.full_name`,
    { role: ROLES.ORG_ADMIN }
  );
  res.json({ admins });
}));

adminRouter.post('/organisations/:id/admins', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  requireFields(req.body, ['full_name', 'email', 'password']);

  const organisations = await query('SELECT * FROM organisations WHERE id = :id', { id: req.params.id });
  if (!organisations.length) {
    return res.status(404).json({ message: 'Organisation was not found.' });
  }

  const organisation = organisations[0];
  if (!organisationDomain(organisation) || emailDomain(req.body.email) !== organisationDomain(organisation)) {
    return res.status(400).json({ message: 'Organisation administrators must use the registered organisation email domain.' });
  }

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const result = await query(
    `INSERT INTO users (organisation_id, full_name, email, password_hash, role, status)
     VALUES (:organisation_id, :full_name, :email, :password_hash, 'ORG_ADMIN', 'ACTIVE')`,
    {
      organisation_id: req.params.id,
      full_name: req.body.full_name,
      email: req.body.email,
      password_hash: passwordHash
    }
  );

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (:userId, 'CREATE_ORG_ADMIN', 'user', :entityId, JSON_OBJECT('organisation_id', :organisationId))`,
    { userId: req.user.id, entityId: result.insertId, organisationId: req.params.id }
  );

  const [user] = await query(
    'SELECT id, organisation_id, full_name, email, role, status, created_at FROM users WHERE id = :id',
    { id: result.insertId }
  );
  res.status(201).json({ user });
}));

adminRouter.patch('/organisation-admins/:id', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  const users = await query('SELECT * FROM users WHERE id = :id AND role = :role', { id: req.params.id, role: ROLES.ORG_ADMIN });

  if (!users.length) {
    return res.status(404).json({ message: 'Organisation administrator was not found.' });
  }

  const organisationId = req.body.organisation_id || users[0].organisation_id;
  const organisations = await query('SELECT * FROM organisations WHERE id = :id', { id: organisationId });
  if (!organisations.length) {
    return res.status(404).json({ message: 'Assigned organisation was not found.' });
  }

  const organisation = organisations[0];
  if (req.body.email && (!organisationDomain(organisation) || emailDomain(req.body.email) !== organisationDomain(organisation))) {
    return res.status(400).json({ message: 'Organisation administrators must use the registered organisation email domain.' });
  }

  // Keep platform edits constrained to organisation-admin profile fields.
  await query(
    `UPDATE users
     SET organisation_id = :organisation_id,
         full_name = COALESCE(:full_name, full_name),
         email = COALESCE(:email, email),
         status = COALESCE(:status, status)
     WHERE id = :id AND role = :role`,
    {
      id: req.params.id,
      role: ROLES.ORG_ADMIN,
      organisation_id: organisationId,
      full_name: req.body.full_name || null,
      email: req.body.email || null,
      status: req.body.status || null
    }
  );

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (:userId, 'UPDATE_ORG_ADMIN', 'user', :entityId, JSON_OBJECT('organisation_id', :organisationId, 'status', :status))`,
    { userId: req.user.id, entityId: req.params.id, organisationId, status: req.body.status || null }
  );

  const [user] = await query(
    `SELECT u.id, u.organisation_id, u.full_name, u.email, u.role, u.status, u.created_at, u.updated_at,
            o.name AS organisation_name, o.type AS organisation_type, o.email AS organisation_email
     FROM users u
     JOIN organisations o ON o.id = u.organisation_id
     WHERE u.id = :id AND u.role = :role`,
    { id: req.params.id, role: ROLES.ORG_ADMIN }
  );
  res.json({ user });
}));

adminRouter.get('/staff', requireAuth, requireRole(ROLES.ORG_ADMIN), asyncHandler(async (req, res) => {
  const staff = await query(
    `SELECT id, organisation_id, full_name, email, role, status, created_at, updated_at
     FROM users
     WHERE organisation_id = :organisationId
     ORDER BY full_name`,
    { organisationId: req.user.organisation_id }
  );
  res.json({ staff });
}));

adminRouter.post('/staff', requireAuth, requireRole(ROLES.ORG_ADMIN), asyncHandler(async (req, res) => {
  requireFields(req.body, ['full_name', 'email', 'password', 'role']);

  if (!canManageStaff(req.user, req.body.organisation_id || req.user.organisation_id)) {
    return res.status(403).json({ message: 'Organisation admins can only create users inside their own organisation.' });
  }

  const allowedRoles = req.user.organisation_type === 'NGO'
    ? [ROLES.ORG_ADMIN, ROLES.NGO_SOCIAL_WORKER]
    : [ROLES.ORG_ADMIN, ROLES.HOSPITAL_RECORDS_KEEPER];

  if (!allowedRoles.includes(req.body.role)) {
    return res.status(403).json({ message: 'This role is not available for your organisation type.' });
  }

  if (!organisationDomain({ email: req.user.organisation_email }) || emailDomain(req.body.email) !== organisationDomain({ email: req.user.organisation_email })) {
    return res.status(400).json({ message: 'Staff users must use the registered organisation email domain.' });
  }

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const result = await query(
    `INSERT INTO users (organisation_id, full_name, email, password_hash, role, status)
     VALUES (:organisation_id, :full_name, :email, :password_hash, :role, 'ACTIVE')`,
    {
      organisation_id: req.user.organisation_id,
      full_name: req.body.full_name,
      email: req.body.email,
      password_hash: passwordHash,
      role: req.body.role
    }
  );

  const [user] = await query(
    'SELECT id, organisation_id, full_name, email, role, status, created_at FROM users WHERE id = :id',
    { id: result.insertId }
  );
  res.status(201).json({ user });
}));

adminRouter.patch('/staff/:id', requireAuth, requireRole(ROLES.ORG_ADMIN), asyncHandler(async (req, res) => {
  const users = await query('SELECT * FROM users WHERE id = :id', { id: req.params.id });

  if (!users.length || !canManageStaff(req.user, users[0].organisation_id)) {
    return res.status(403).json({ message: 'You cannot manage this staff account.' });
  }

  const allowedRoles = req.user.organisation_type === 'NGO'
    ? [ROLES.ORG_ADMIN, ROLES.NGO_SOCIAL_WORKER]
    : [ROLES.ORG_ADMIN, ROLES.HOSPITAL_RECORDS_KEEPER];

  if (req.body.role && !allowedRoles.includes(req.body.role)) {
    return res.status(403).json({ message: 'This role is not available for your organisation type.' });
  }

  if (req.body.email && (!organisationDomain({ email: req.user.organisation_email }) || emailDomain(req.body.email) !== organisationDomain({ email: req.user.organisation_email }))) {
    return res.status(400).json({ message: 'Staff users must use the registered organisation email domain.' });
  }

  const updatePassword = req.body.password
    ? ', password_hash = :password_hash'
    : '';

  await query(
    `UPDATE users
     SET full_name = COALESCE(:full_name, full_name),
         email = COALESCE(:email, email),
         status = COALESCE(:status, status),
         role = COALESCE(:role, role)
         ${updatePassword}
     WHERE id = :id`,
    {
      id: req.params.id,
      full_name: req.body.full_name || null,
      email: req.body.email || null,
      status: req.body.status || null,
      role: req.body.role || null,
      password_hash: req.body.password ? await bcrypt.hash(req.body.password, 10) : null
    }
  );

  const [user] = await query(
    'SELECT id, organisation_id, full_name, email, role, status, updated_at FROM users WHERE id = :id',
    { id: req.params.id }
  );
  res.json({ user });
}));

adminRouter.get('/service-categories', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  const serviceCategories = await query('SELECT * FROM service_categories ORDER BY name');
  const referralCategories = await query('SELECT * FROM referral_categories ORDER BY name');
  res.json({ serviceCategories, referralCategories });
}));

adminRouter.post('/service-categories', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  requireFields(req.body, ['name']);

  const result = await query(
    'INSERT INTO service_categories (name, description, is_active) VALUES (:name, :description, :is_active)',
    {
      name: req.body.name,
      description: req.body.description || null,
      is_active: req.body.is_active !== false
    }
  );
  const [category] = await query('SELECT * FROM service_categories WHERE id = :id', { id: result.insertId });
  res.status(201).json({ category });
}));

adminRouter.patch('/service-categories/:id', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  await query(
    `UPDATE service_categories
     SET name = COALESCE(:name, name),
         description = COALESCE(:description, description),
         is_active = COALESCE(:is_active, is_active)
     WHERE id = :id`,
    {
      id: req.params.id,
      name: req.body.name || null,
      description: req.body.description || null,
      is_active: req.body.is_active === undefined ? null : Boolean(req.body.is_active)
    }
  );

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (:userId, 'UPDATE_SERVICE_CATEGORY', 'service_category', :entityId, JSON_OBJECT('is_active', :isActive))`,
    { userId: req.user.id, entityId: req.params.id, isActive: req.body.is_active === undefined ? null : Boolean(req.body.is_active) }
  );

  const [category] = await query('SELECT * FROM service_categories WHERE id = :id', { id: req.params.id });
  res.json({ category });
}));

adminRouter.get('/audit-logs', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  const logs = await query(
    `SELECT al.*, u.full_name AS actor_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC
     LIMIT 100`
  );
  res.json({ logs });
}));

adminRouter.get('/system-statistics', requireAuth, requireRole(ROLES.PLATFORM_ADMIN), asyncHandler(async (req, res) => {
  const [organisations, activeUsers, referrals] = await Promise.all([
    query('SELECT COUNT(*) AS total FROM organisations WHERE status != "ARCHIVED"'),
    query('SELECT COUNT(*) AS total FROM users WHERE status = "ACTIVE"'),
    query('SELECT COUNT(*) AS total FROM referrals')
  ]);

  res.json({
    totalOrganisations: organisations[0]?.total || 0,
    activeUsers: activeUsers[0]?.total || 0,
    totalReferrals: referrals[0]?.total || 0
  });
}));

adminRouter.get('/organisation-profile', requireAuth, requireRole(ROLES.ORG_ADMIN), asyncHandler(async (req, res) => {
  const [organisation] = await query('SELECT * FROM organisations WHERE id = :id', { id: req.user.organisation_id });
  res.json({ organisation });
}));

adminRouter.patch('/organisation-profile', requireAuth, requireRole(ROLES.ORG_ADMIN), asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'email']);

  if (req.body.email && emailDomain(req.body.email) !== emailDomain(req.user.email)) {
    return res.status(400).json({ message: 'Organisation contact email must use your registered organisation domain.' });
  }

  // Organisation admins may update only their own organisation profile, never another organisation by id.
  await query(
    `UPDATE organisations
     SET name = :name,
         email = :email,
         phone = :phone,
         location = :location
     WHERE id = :id`,
    {
      id: req.user.organisation_id,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone || null,
      location: req.body.location || null
    }
  );

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (:userId, 'UPDATE_ORGANISATION_PROFILE', 'organisation', :entityId, JSON_OBJECT('name', :name))`,
    { userId: req.user.id, entityId: req.user.organisation_id, name: req.body.name }
  );

  const [organisation] = await query('SELECT * FROM organisations WHERE id = :id', { id: req.user.organisation_id });
  res.json({ organisation });
}));

adminRouter.get('/organisation-reports', requireAuth, requireRole(ROLES.ORG_ADMIN), asyncHandler(async (req, res) => {
  const [staff, sent, received] = await Promise.all([
    query('SELECT role, status, COUNT(*) AS total FROM users WHERE organisation_id = :organisationId GROUP BY role, status', { organisationId: req.user.organisation_id }),
    query('SELECT status, COUNT(*) AS total FROM referrals WHERE referring_organisation_id = :organisationId GROUP BY status', { organisationId: req.user.organisation_id }),
    query('SELECT status, COUNT(*) AS total FROM referrals WHERE receiving_organisation_id = :organisationId GROUP BY status', { organisationId: req.user.organisation_id })
  ]);

  res.json({ staff, referralsSent: sent, referralsReceived: received });
}));
