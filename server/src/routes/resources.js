import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole, ROLES } from '../auth.js';
import { asyncHandler, requireFields } from '../utils.js';

export const resourcesRouter = Router();

resourcesRouter.get('/items', requireAuth, asyncHandler(async (req, res) => {
  const params = {};
  let where = 'WHERE wi.organisation_id IS NULL';

  if (req.user.organisation_id) {
    where = 'WHERE wi.organisation_id = :organisationId OR wi.organisation_id IS NULL';
    params.organisationId = req.user.organisation_id;
  }

  const items = await query(
    `SELECT wi.*, wi.quantity_available <= wi.reorder_level AS needs_reorder
     FROM welfare_items wi
     ${where}
     ORDER BY needs_reorder DESC, wi.name ASC`,
    params
  );
  res.json({ items });
}));

resourcesRouter.post('/items', requireAuth, requireRole(ROLES.ORG_ADMIN), asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'category']);

  const result = await query(
    `INSERT INTO welfare_items (organisation_id, name, category, quantity_available, reorder_level)
     VALUES (:organisation_id, :name, :category, :quantity_available, :reorder_level)`,
    {
      organisation_id: req.user.organisation_id,
      name: req.body.name,
      category: req.body.category,
      quantity_available: Number(req.body.quantity_available || 0),
      reorder_level: Number(req.body.reorder_level || 10)
    }
  );

  const [item] = await query('SELECT * FROM welfare_items WHERE id = :id', { id: result.insertId });
  res.status(201).json({ item });
}));

resourcesRouter.get('/donors', requireAuth, asyncHandler(async (req, res) => {
  const params = {};
  let where = '';

  if (req.user.organisation_id) {
    where = 'WHERE organisation_id = :organisationId OR organisation_id IS NULL';
    params.organisationId = req.user.organisation_id;
  }

  const donors = await query(`SELECT * FROM donors ${where} ORDER BY status, name`, params);
  res.json({ donors });
}));

resourcesRouter.post('/donors', requireAuth, requireRole(ROLES.ORG_ADMIN), asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'funding_area']);

  const result = await query(
    `INSERT INTO donors (organisation_id, name, contact_person, email, funding_area, status)
     VALUES (:organisation_id, :name, :contact_person, :email, :funding_area, :status)`,
    {
      organisation_id: req.user.organisation_id,
      name: req.body.name,
      contact_person: req.body.contact_person || null,
      email: req.body.email || null,
      funding_area: req.body.funding_area,
      status: req.body.status || 'Active'
    }
  );

  const [donor] = await query('SELECT * FROM donors WHERE id = :id', { id: result.insertId });
  res.status(201).json({ donor });
}));
