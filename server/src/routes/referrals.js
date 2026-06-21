import { Router } from 'express';
import { query } from '../db.js';
import { referralScopeWhere, requireAuth, requireOperationalRole, requireRole, ROLES } from '../auth.js';
import { asyncHandler, makeReferralNumber, requireFields } from '../utils.js';

export const referralsRouter = Router();

const referralSelect = `
  SELECT r.*, b.case_number, b.full_name AS beneficiary_name, b.phone AS beneficiary_phone,
         ref_org.name AS ngo_name, rec_org.name AS hospital_name, u.full_name AS created_by_name,
         f.id AS feedback_id, f.outcome AS feedback_outcome
  FROM referrals r
  JOIN beneficiaries b ON b.id = r.beneficiary_id
  JOIN organisations ref_org ON ref_org.id = r.referring_organisation_id
  JOIN organisations rec_org ON rec_org.id = r.receiving_organisation_id
  JOIN users u ON u.id = r.created_by
  LEFT JOIN feedback f ON f.referral_id = r.id
`;

referralsRouter.get('/', requireAuth, requireOperationalRole, asyncHandler(async (req, res) => {
  const scope = referralScopeWhere(req.user);
  const params = {
    ...scope.params,
    status: req.query.status || null,
    search: `%${req.query.search || ''}%`
  };

  const rows = await query(
    `${referralSelect}
     WHERE ${scope.clause}
       AND (:status IS NULL OR r.status = :status)
       AND (r.referral_number LIKE :search OR b.full_name LIKE :search OR rec_org.name LIKE :search OR ref_org.name LIKE :search)
     ORDER BY
       FIELD(r.urgency, 'Critical', 'High', 'Medium', 'Low'),
       r.updated_at DESC`,
    params
  );

  res.json({ referrals: rows });
}));

referralsRouter.post('/', requireAuth, requireRole(ROLES.NGO_SOCIAL_WORKER), asyncHandler(async (req, res) => {
  requireFields(req.body, ['beneficiary_id', 'receiving_organisation_id', 'service_required', 'urgency', 'reason']);

  const beneficiary = await query(
    `SELECT id
     FROM beneficiaries
     WHERE id = :beneficiaryId AND organisation_id = :organisationId`,
    { beneficiaryId: req.body.beneficiary_id, organisationId: req.user.organisation_id }
  );

  if (!beneficiary.length) {
    return res.status(403).json({ message: 'You can only refer beneficiaries from your NGO.' });
  }

  const hospital = await query(
    `SELECT id FROM organisations
     WHERE id = :id AND type = 'HOSPITAL' AND status = 'ACTIVE'`,
    { id: req.body.receiving_organisation_id }
  );

  if (!hospital.length) {
    return res.status(400).json({ message: 'A valid active hospital is required.' });
  }

  const referralNumber = req.body.referral_number || makeReferralNumber();
  const result = await query(
    `INSERT INTO referrals
      (referral_number, beneficiary_id, referring_organisation_id, receiving_organisation_id, created_by, service_required, urgency, reason, status, due_date)
     VALUES
      (:referral_number, :beneficiary_id, :referring_organisation_id, :receiving_organisation_id, :created_by, :service_required, :urgency, :reason, 'Pending', :due_date)`,
    {
      referral_number: referralNumber,
      beneficiary_id: req.body.beneficiary_id,
      referring_organisation_id: req.user.organisation_id,
      receiving_organisation_id: req.body.receiving_organisation_id,
      created_by: req.user.id,
      service_required: req.body.service_required,
      urgency: req.body.urgency,
      reason: req.body.reason,
      due_date: req.body.due_date || null
    }
  );

  await query(
    `INSERT INTO notifications (user_id, title, message)
     SELECT id, 'New referral received', CONCAT('Referral ', :referral_number, ' is awaiting review.')
     FROM users
     WHERE organisation_id = :organisation_id AND role = 'HOSPITAL_RECORDS_KEEPER' AND status = 'ACTIVE'`,
    {
      referral_number: referralNumber,
      organisation_id: req.body.receiving_organisation_id
    }
  );

  const [referral] = await query(`${referralSelect} WHERE r.id = :id`, { id: result.insertId });
  res.status(201).json({ referral });
}));

referralsRouter.get('/:id', requireAuth, requireOperationalRole, asyncHandler(async (req, res) => {
  const scope = referralScopeWhere(req.user);
  const rows = await query(`${referralSelect} WHERE r.id = :id AND ${scope.clause}`, {
    id: req.params.id,
    ...scope.params
  });

  if (!rows.length) {
    return res.status(403).json({ message: 'You cannot access this referral.' });
  }

  const feedback = await query(
    `SELECT f.*, u.full_name AS submitted_by_name
     FROM feedback f
     JOIN users u ON u.id = f.submitted_by_user_id
     WHERE f.referral_id = :id
     ORDER BY f.submitted_at DESC`,
    { id: req.params.id }
  );

  res.json({ referral: rows[0], feedback });
}));

referralsRouter.patch('/:id/status', requireAuth, requireRole(ROLES.HOSPITAL_RECORDS_KEEPER), asyncHandler(async (req, res) => {
  requireFields(req.body, ['status']);

  const found = await query(
    `SELECT * FROM referrals
     WHERE id = :id AND receiving_organisation_id = :organisationId`,
    { id: req.params.id, organisationId: req.user.organisation_id }
  );

  if (!found.length) {
    return res.status(403).json({ message: 'You cannot update this referral.' });
  }

  const status = req.body.status;
  const acceptedAt = status === 'Accepted' || status === 'In Progress' ? 'NOW()' : 'accepted_at';
  const completedAt = status === 'Completed' ? 'NOW()' : 'completed_at';

  await query(
    `UPDATE referrals
     SET status = :status,
         accepted_at = ${acceptedAt},
         completed_at = ${completedAt}
     WHERE id = :id`,
    { status, id: req.params.id }
  );

  const [referral] = await query(`${referralSelect} WHERE r.id = :id`, { id: req.params.id });
  res.json({ referral });
}));

referralsRouter.post('/:id/feedback', requireAuth, requireRole(ROLES.HOSPITAL_RECORDS_KEEPER), asyncHandler(async (req, res) => {
  requireFields(req.body, ['outcome', 'treatment_given']);

  const found = await query(
    `SELECT * FROM referrals
     WHERE id = :id AND receiving_organisation_id = :organisationId`,
    { id: req.params.id, organisationId: req.user.organisation_id }
  );

  if (!found.length) {
    return res.status(403).json({ message: 'You cannot submit feedback for this referral.' });
  }

  const result = await query(
    `INSERT INTO feedback (referral_id, submitted_by_user_id, outcome, treatment_given, discharge_status, recommendations)
     VALUES (:referral_id, :submitted_by_user_id, :outcome, :treatment_given, :discharge_status, :recommendations)`,
    {
      referral_id: req.params.id,
      submitted_by_user_id: req.user.id,
      outcome: req.body.outcome,
      treatment_given: req.body.treatment_given,
      discharge_status: req.body.discharge_status || null,
      recommendations: req.body.recommendations || null
    }
  );

  await query('UPDATE referrals SET status = "Completed", completed_at = COALESCE(completed_at, NOW()) WHERE id = :id', {
    id: req.params.id
  });

  const [feedback] = await query('SELECT * FROM feedback WHERE id = :id', { id: result.insertId });
  res.status(201).json({ feedback });
}));
