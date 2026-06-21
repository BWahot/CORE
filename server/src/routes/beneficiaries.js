import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole, ROLES } from '../auth.js';
import { asyncHandler, makeCaseNumber, requireFields } from '../utils.js';

export const beneficiariesRouter = Router();

beneficiariesRouter.get('/', requireAuth, requireRole(ROLES.NGO_SOCIAL_WORKER), asyncHandler(async (req, res) => {
  const search = `%${req.query.search || ''}%`;
  const rows = await query(
    `SELECT b.*,
            COUNT(r.id) AS referral_count,
            MAX(r.created_at) AS last_referral_at
     FROM beneficiaries b
     LEFT JOIN referrals r ON r.beneficiary_id = b.id
     WHERE b.organisation_id = :organisationId
       AND (b.full_name LIKE :search OR b.case_number LIKE :search OR b.phone LIKE :search)
     GROUP BY b.id
     ORDER BY b.updated_at DESC`,
    { search, organisationId: req.user.organisation_id }
  );

  res.json({ beneficiaries: rows });
}));

beneficiariesRouter.post('/', requireAuth, requireRole(ROLES.NGO_SOCIAL_WORKER), asyncHandler(async (req, res) => {
  requireFields(req.body, ['full_name', 'gender', 'county']);

  const result = await query(
    `INSERT INTO beneficiaries
      (organisation_id, case_number, full_name, date_of_birth, gender, phone, county, location, vulnerability_notes, consent_recorded, created_by)
     VALUES
      (:organisation_id, :case_number, :full_name, :date_of_birth, :gender, :phone, :county, :location, :vulnerability_notes, :consent_recorded, :created_by)`,
    {
      organisation_id: req.user.organisation_id,
      case_number: req.body.case_number || makeCaseNumber(),
      full_name: req.body.full_name,
      date_of_birth: req.body.date_of_birth || null,
      gender: req.body.gender,
      phone: req.body.phone || null,
      county: req.body.county,
      location: req.body.location || null,
      vulnerability_notes: req.body.vulnerability_notes || null,
      consent_recorded: Boolean(req.body.consent_recorded),
      created_by: req.user.id
    }
  );

  const [beneficiary] = await query('SELECT * FROM beneficiaries WHERE id = :id', { id: result.insertId });
  res.status(201).json({ beneficiary });
}));

beneficiariesRouter.get('/:id', requireAuth, requireRole(ROLES.NGO_SOCIAL_WORKER), asyncHandler(async (req, res) => {
  const beneficiaries = await query(
    `SELECT *
     FROM beneficiaries
     WHERE id = :id AND organisation_id = :organisationId`,
    { id: req.params.id, organisationId: req.user.organisation_id }
  );

  if (!beneficiaries.length) {
    return res.status(403).json({ message: 'You cannot access this beneficiary profile.' });
  }

  const referrals = await query(
    `SELECT r.*, ref_org.name AS ngo_name, rec_org.name AS hospital_name
     FROM referrals r
     JOIN organisations ref_org ON ref_org.id = r.referring_organisation_id
     JOIN organisations rec_org ON rec_org.id = r.receiving_organisation_id
     WHERE r.beneficiary_id = :id AND r.referring_organisation_id = :organisationId
     ORDER BY r.created_at DESC`,
    { id: req.params.id, organisationId: req.user.organisation_id }
  );

  const distributions = await query(
    `SELECT wd.*, wi.name AS item_name, wi.category, u.full_name AS distributed_by_name
     FROM welfare_distributions wd
     JOIN welfare_items wi ON wi.id = wd.item_id
     JOIN users u ON u.id = wd.distributed_by
     JOIN beneficiaries b ON b.id = wd.beneficiary_id
     WHERE wd.beneficiary_id = :id AND b.organisation_id = :organisationId
     ORDER BY wd.distributed_at DESC`,
    { id: req.params.id, organisationId: req.user.organisation_id }
  );

  res.json({ beneficiary: beneficiaries[0], referrals, distributions });
}));
