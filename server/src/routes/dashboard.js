import { Router } from 'express';
import { query } from '../db.js';
import { referralScopeWhere, requireAuth, ROLES } from '../auth.js';
import { asyncHandler } from '../utils.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role === ROLES.PLATFORM_ADMIN) {
    const [organisations, activeUsers, referrals, byType, activeUsersByOrganisation] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM organisations WHERE status != "ARCHIVED"'),
      query('SELECT COUNT(*) AS total FROM users WHERE status = "ACTIVE"'),
      query('SELECT COUNT(*) AS total FROM referrals'),
      query('SELECT type, status, COUNT(*) AS total FROM organisations GROUP BY type, status'),
      query(
        `SELECT o.id, o.name, o.type, o.status, COUNT(u.id) AS active_users
         FROM organisations o
         LEFT JOIN users u ON u.organisation_id = o.id AND u.status = 'ACTIVE'
         GROUP BY o.id, o.name, o.type, o.status
         ORDER BY active_users DESC, o.name`
      )
    ]);

    return res.json({
      mode: 'platform',
      metrics: {
        totalOrganisations: organisations[0]?.total || 0,
        activeUsers: activeUsers[0]?.total || 0,
        totalReferrals: referrals[0]?.total || 0,
        byType
      },
      activeUsersByOrganisation,
      recent: [],
      notifications: []
    });
  }

  if (req.user.role === ROLES.ORG_ADMIN) {
    const [staff, referralsSent, referralsReceived, notifications] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM users WHERE organisation_id = :organisationId', { organisationId: req.user.organisation_id }),
      query('SELECT COUNT(*) AS total FROM referrals WHERE referring_organisation_id = :organisationId', { organisationId: req.user.organisation_id }),
      query('SELECT COUNT(*) AS total FROM referrals WHERE receiving_organisation_id = :organisationId', { organisationId: req.user.organisation_id }),
      query(
        `SELECT id, title, message, is_read, created_at
         FROM notifications
         WHERE user_id = :userId
         ORDER BY created_at DESC
         LIMIT 6`,
        { userId: req.user.id }
      )
    ]);

    return res.json({
      mode: 'organisation',
      metrics: {
        staffUsers: staff[0]?.total || 0,
        referralsSent: referralsSent[0]?.total || 0,
        referralsReceived: referralsReceived[0]?.total || 0,
        byStatus: []
      },
      recent: [],
      notifications
    });
  }

  const scope = referralScopeWhere(req.user);
  const params = scope.params;

  const [totals, byStatus, urgent, pendingFeedback, recent, notifications] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM referrals r WHERE ${scope.clause}`, params),
    query(`SELECT r.status, COUNT(*) AS total FROM referrals r WHERE ${scope.clause} GROUP BY r.status`, params),
    query(`SELECT COUNT(*) AS total FROM referrals r WHERE ${scope.clause} AND r.urgency IN ('High','Critical') AND r.status NOT IN ('Completed','Cancelled','Rejected')`, params),
    query(
      `SELECT COUNT(*) AS total
       FROM referrals r
       LEFT JOIN feedback f ON f.referral_id = r.id
       WHERE ${scope.clause} AND r.status = 'Completed' AND f.id IS NULL`,
      params
    ),
    query(
      `SELECT r.id, r.referral_number, r.status, r.urgency, r.service_required, r.updated_at,
              b.full_name AS beneficiary_name, rec_org.name AS hospital_name, ref_org.name AS ngo_name
       FROM referrals r
       JOIN beneficiaries b ON b.id = r.beneficiary_id
       JOIN organisations rec_org ON rec_org.id = r.receiving_organisation_id
       JOIN organisations ref_org ON ref_org.id = r.referring_organisation_id
       WHERE ${scope.clause}
       ORDER BY r.updated_at DESC
       LIMIT 8`,
      params
    ),
    query(
      `SELECT id, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = :userId
       ORDER BY created_at DESC
       LIMIT 6`,
      { userId: req.user.id }
    )
  ]);

  res.json({
    mode: 'operational',
    metrics: {
      totalReferrals: totals[0]?.total || 0,
      urgentOpen: urgent[0]?.total || 0,
      pendingFeedback: pendingFeedback[0]?.total || 0,
      byStatus
    },
    recent,
    notifications
  });
}));
