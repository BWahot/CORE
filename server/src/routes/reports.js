import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, ROLES } from '../auth.js';
import { asyncHandler } from '../utils.js';
import {
  ALL_AVAILABLE_REPORT,
  availableReportsFor,
  assertReportAllowed,
  nonAllReportsForUser,
  validateReportRequest
} from '../reports/config.js';

export const reportsRouter = Router();

const formatLabels = {
  screen: 'View on screen',
  pdf: 'PDF',
  csv: 'CSV',
  excel: 'Excel'
};

function sanitizeFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function dateFilter(alias = 'r') {
  return '(:start_date IS NULL OR DATE(' + alias + '.created_at) >= :start_date) AND (:end_date IS NULL OR DATE(' + alias + '.created_at) <= :end_date)';
}

function referralFilterClause(filters, alias = 'r') {
  const clauses = [
    dateFilter(alias),
    '(:status IS NULL OR ' + alias + '.status = :status)',
    '(:service_type IS NULL OR ' + alias + '.service_required = :service_type)',
    '(:urgency IS NULL OR ' + alias + '.urgency = :urgency)'
  ];

  if (filters.feedback_status === 'PENDING') {
    clauses.push('f.id IS NULL');
  }

  if (filters.feedback_status === 'SUBMITTED') {
    clauses.push('f.id IS NOT NULL');
  }

  return clauses.join(' AND ');
}

function filterParams(user, filters = {}) {
  return {
    start_date: filters.start_date || null,
    end_date: filters.end_date || null,
    status: filters.status || null,
    feedback_status: filters.feedback_status || null,
    service_type: filters.service_type || null,
    urgency: filters.urgency || null,
    organisation_id: filters.organisation_id || null,
    staff_id: filters.staff_id || null,
    current_organisation_id: user.organisation_id
  };
}

async function auditReport(user, reportType, filters, outputFormat, success, message = null) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (:user_id, 'GENERATE_REPORT', 'report', NULL,
         JSON_OBJECT(
           'organisation_id', :organisation_id,
           'role', :role,
           'report_type', :report_type,
           'filters', :filters,
           'output_format', :output_format,
           'success', :success,
           'message', :message
         )
       )`,
      {
        user_id: user.id,
        organisation_id: user.organisation_id || null,
        role: user.role,
        report_type: reportType,
        filters: JSON.stringify(sanitizeFilters(filters)),
        output_format: outputFormat,
        success,
        message
      }
    );
  } catch (error) {
    console.error('Could not write report audit log', error);
  }
}

function createSummary(rows, extra = {}) {
  return {
    total_records: rows.length,
    ...extra
  };
}

function rowsToCsv(rows) {
  if (!rows.length) return 'No records found';
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))
  ].join('\n');
}

function makeExportPayload(reportName, rows, sections, outputFormat) {
  const body = sections
    ? sections.map((section) => `# ${section.report_name}\n${rowsToCsv(section.rows)}`).join('\n\n')
    : rowsToCsv(rows);
  const mime = outputFormat === 'excel'
    ? 'application/vnd.ms-excel'
    : outputFormat === 'pdf'
      ? 'application/pdf'
      : 'text/csv';
  const extension = outputFormat === 'excel' ? 'xls' : outputFormat;
  return {
    file_url: `data:${mime};charset=utf-8,${encodeURIComponent(body)}`,
    file_name: `${reportName.toLowerCase().replaceAll(' ', '-')}.${extension}`
  };
}

async function assertScopedFilters(user, filters) {
  if (user.role === ROLES.ORG_ADMIN && filters.staff_id) {
    const staff = await query(
      `SELECT id FROM users WHERE id = :staff_id AND organisation_id = :organisation_id`,
      { staff_id: filters.staff_id, organisation_id: user.organisation_id }
    );

    if (!staff.length) {
      const error = new Error('Organisation admins can only filter staff inside their own organisation.');
      error.status = 403;
      throw error;
    }
  }
}

async function ngoReport(report, user, filters) {
  const params = filterParams(user, filters);
  const fixed = [];

  if (report.report_key === 'pending_feedback') fixed.push('f.id IS NULL');
  if (report.report_key === 'completed_referrals') fixed.push("r.status = 'Completed'");
  if (report.report_key === 'hospital_feedback') fixed.push('f.id IS NOT NULL');

  if (report.report_key === 'referral_by_hospital') {
    const rows = await query(
      `SELECT rec_org.name AS destination_hospital, COUNT(*) AS total_referrals,
              SUM(CASE WHEN f.id IS NULL THEN 1 ELSE 0 END) AS pending_feedback
       FROM referrals r
       JOIN organisations rec_org ON rec_org.id = r.receiving_organisation_id
       LEFT JOIN feedback f ON f.referral_id = r.id
       WHERE r.referring_organisation_id = :current_organisation_id
         AND (:organisation_id IS NULL OR r.receiving_organisation_id = :organisation_id)
         AND ${referralFilterClause(filters)}
       GROUP BY rec_org.id, rec_org.name
       ORDER BY total_referrals DESC`,
      params
    );
    return { summary: createSummary(rows), rows };
  }

  if (report.report_key === 'referral_by_service_type') {
    const rows = await query(
      `SELECT r.service_required AS service_type, COUNT(*) AS total_referrals,
              SUM(CASE WHEN r.status = 'Completed' THEN 1 ELSE 0 END) AS completed_referrals
       FROM referrals r
       LEFT JOIN feedback f ON f.referral_id = r.id
       WHERE r.referring_organisation_id = :current_organisation_id
         AND (:organisation_id IS NULL OR r.receiving_organisation_id = :organisation_id)
         AND ${referralFilterClause(filters)}
       GROUP BY r.service_required
       ORDER BY total_referrals DESC`,
      params
    );
    return { summary: createSummary(rows), rows };
  }

  const rows = await query(
    `SELECT r.referral_number,
            b.case_number AS beneficiary_code,
            b.full_name AS beneficiary_name,
            rec_org.name AS destination_hospital,
            r.service_required AS service_type,
            r.urgency,
            DATE(r.created_at) AS referral_date,
            r.status AS current_status,
            CASE WHEN f.id IS NULL THEN 'PENDING' ELSE 'SUBMITTED' END AS feedback_status,
            f.outcome AS feedback_outcome,
            CASE WHEN f.recommendations IS NULL OR f.recommendations = '' THEN 'No' ELSE 'Yes' END AS follow_up_required
     FROM referrals r
     JOIN beneficiaries b ON b.id = r.beneficiary_id
     JOIN organisations rec_org ON rec_org.id = r.receiving_organisation_id
     LEFT JOIN feedback f ON f.referral_id = r.id
     WHERE r.referring_organisation_id = :current_organisation_id
       AND (:organisation_id IS NULL OR r.receiving_organisation_id = :organisation_id)
       AND ${referralFilterClause(filters)}
       ${fixed.length ? `AND ${fixed.join(' AND ')}` : ''}
     ORDER BY r.created_at DESC`,
    params
  );
  return { summary: createSummary(rows), rows };
}

async function hospitalReport(report, user, filters) {
  const params = filterParams(user, filters);
  const fixed = [];

  if (report.report_key === 'rejected_referrals') fixed.push("r.status = 'Rejected'");
  if (report.report_key === 'pending_hospital_action') fixed.push("r.status IN ('Pending', 'Accepted', 'In Progress')");
  if (report.report_key === 'feedback_submitted') fixed.push('f.id IS NOT NULL');

  if (['service_demand', 'urgency', 'average_response_time'].includes(report.report_key)) {
    const groupColumn = report.report_key === 'urgency' ? 'r.urgency' : 'r.service_required';
    const label = report.report_key === 'urgency' ? 'urgency' : 'service_type';
    const rows = await query(
      `SELECT ${groupColumn} AS ${label}, COUNT(*) AS total_referrals,
              ROUND(AVG(TIMESTAMPDIFF(HOUR, r.created_at, COALESCE(r.accepted_at, r.updated_at))), 1) AS average_response_hours
       FROM referrals r
       LEFT JOIN feedback f ON f.referral_id = r.id
       WHERE r.receiving_organisation_id = :current_organisation_id
         AND (:organisation_id IS NULL OR r.referring_organisation_id = :organisation_id)
         AND ${referralFilterClause(filters)}
       GROUP BY ${groupColumn}
       ORDER BY total_referrals DESC`,
      params
    );
    return { summary: createSummary(rows), rows };
  }

  const rows = await query(
    `SELECT r.referral_number,
            ref_org.name AS referring_ngo,
            b.case_number AS beneficiary_code,
            r.service_required AS service_type,
            r.urgency,
            DATE(r.created_at) AS received_date,
            r.status AS current_status,
            CASE WHEN f.id IS NULL THEN 'PENDING' ELSE 'SUBMITTED' END AS feedback_status,
            ROUND(TIMESTAMPDIFF(HOUR, r.created_at, COALESCE(r.accepted_at, r.updated_at)), 1) AS response_time_hours
     FROM referrals r
     JOIN beneficiaries b ON b.id = r.beneficiary_id
     JOIN organisations ref_org ON ref_org.id = r.referring_organisation_id
     LEFT JOIN feedback f ON f.referral_id = r.id
     WHERE r.receiving_organisation_id = :current_organisation_id
       AND (:organisation_id IS NULL OR r.referring_organisation_id = :organisation_id)
       AND ${referralFilterClause(filters)}
       ${fixed.length ? `AND ${fixed.join(' AND ')}` : ''}
     ORDER BY r.created_at DESC`,
    params
  );
  return { summary: createSummary(rows), rows };
}

async function orgAdminReport(report, user, filters) {
  const params = filterParams(user, filters);

  if (report.report_key === 'staff_activity') {
    const rows = await query(
      `SELECT u.full_name AS staff_name,
              u.role AS staff_role,
              COUNT(DISTINCT created.id) AS number_of_referrals_created,
              COUNT(DISTINCT processed.id) AS processed_referrals,
              COUNT(DISTINCT completed.id) AS completed_referrals,
              SUM(CASE WHEN feedback.id IS NULL AND completed.id IS NOT NULL THEN 1 ELSE 0 END) AS pending_feedback,
              ROUND(AVG(TIMESTAMPDIFF(HOUR, processed.created_at, COALESCE(processed.accepted_at, processed.updated_at))), 1) AS average_response_time,
              CONCAT(COALESCE(:start_date, 'beginning'), ' to ', COALESCE(:end_date, 'today')) AS reporting_period
       FROM users u
       LEFT JOIN referrals created ON created.created_by = u.id
       LEFT JOIN referrals processed ON processed.receiving_organisation_id = u.organisation_id
       LEFT JOIN referrals completed ON completed.id = processed.id AND completed.status = 'Completed'
       LEFT JOIN feedback ON feedback.referral_id = completed.id
       WHERE u.organisation_id = :current_organisation_id
         AND (:staff_id IS NULL OR u.id = :staff_id)
       GROUP BY u.id, u.full_name, u.role
       ORDER BY u.full_name`,
      params
    );
    return { summary: createSummary(rows), rows };
  }

  const sideColumn = user.organisation_type === 'NGO' ? 'r.referring_organisation_id' : 'r.receiving_organisation_id';
  const rows = await query(
    `SELECT u.full_name AS staff_name,
            u.role AS staff_role,
            COUNT(DISTINCT r.id) AS total_referrals,
            SUM(CASE WHEN r.status = 'Completed' THEN 1 ELSE 0 END) AS completed_referrals,
            SUM(CASE WHEN f.id IS NULL AND r.status = 'Completed' THEN 1 ELSE 0 END) AS pending_feedback,
            ROUND(AVG(TIMESTAMPDIFF(HOUR, r.created_at, COALESCE(r.accepted_at, r.updated_at))), 1) AS average_response_time,
            CONCAT(COALESCE(:start_date, 'beginning'), ' to ', COALESCE(:end_date, 'today')) AS reporting_period
     FROM users u
     LEFT JOIN referrals r ON ${user.organisation_type === 'NGO' ? 'r.created_by = u.id' : 'r.receiving_organisation_id = u.organisation_id'}
     LEFT JOIN feedback f ON f.referral_id = r.id
     WHERE u.organisation_id = :current_organisation_id
       AND ${sideColumn} = :current_organisation_id
       AND (:staff_id IS NULL OR u.id = :staff_id)
       AND ${referralFilterClause(filters)}
     GROUP BY u.id, u.full_name, u.role
     ORDER BY total_referrals DESC`,
    params
  );
  return { summary: createSummary(rows), rows };
}

async function platformReport(report, user, filters) {
  const params = filterParams(user, filters);
  const organisationFilter = `
    (:organisation_type IS NULL OR o.type = :organisation_type)
    AND (:organisation_status IS NULL OR o.status = :organisation_status)
    AND (:start_date IS NULL OR DATE(o.created_at) >= :start_date)
    AND (:end_date IS NULL OR DATE(o.created_at) <= :end_date)
  `;
  const platformParams = {
    ...params,
    organisation_type: filters.organisation_type || null,
    organisation_status: filters.organisation_status || null
  };

  if (report.report_key === 'audit_trail') {
    const rows = await query(
      `SELECT DATE(al.created_at) AS activity_date,
              al.action,
              al.entity_type,
              COUNT(*) AS activity_count
       FROM audit_logs al
       WHERE (:start_date IS NULL OR DATE(al.created_at) >= :start_date)
         AND (:end_date IS NULL OR DATE(al.created_at) <= :end_date)
       GROUP BY DATE(al.created_at), al.action, al.entity_type
       ORDER BY activity_date DESC, activity_count DESC`,
      platformParams
    );
    return { summary: createSummary(rows), rows };
  }

  if (report.report_key === 'service_category_usage') {
    const rows = await query(
      `SELECT r.service_required AS service_type,
              COUNT(*) AS total_referral_count,
              COUNT(DISTINCT r.referring_organisation_id) AS referring_organisations,
              COUNT(DISTINCT r.receiving_organisation_id) AS receiving_organisations
       FROM referrals r
       WHERE (:start_date IS NULL OR DATE(r.created_at) >= :start_date)
         AND (:end_date IS NULL OR DATE(r.created_at) <= :end_date)
       GROUP BY r.service_required
       ORDER BY total_referral_count DESC`,
      platformParams
    );
    return { summary: createSummary(rows), rows };
  }

  if (report.report_key === 'platform_growth') {
    const rows = await query(
      `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS month,
              o.type AS organisation_type,
              COUNT(*) AS organisations_created
       FROM organisations o
       WHERE ${organisationFilter}
       GROUP BY DATE_FORMAT(o.created_at, '%Y-%m'), o.type
       ORDER BY month DESC`,
      platformParams
    );
    return { summary: createSummary(rows), rows };
  }

  const activeOnly = report.report_key === 'active_organisations' ? "AND o.status = 'ACTIVE'" : '';
  const rows = await query(
    `SELECT o.name AS organisation_name,
            o.type AS organisation_type,
            COUNT(DISTINCT u.id) AS number_of_users,
            o.status AS organisation_status,
            COUNT(DISTINCT r.id) AS total_referral_count,
            MAX(COALESCE(r.updated_at, u.updated_at, o.updated_at)) AS last_activity_date,
            DATE(o.created_at) AS created_at
     FROM organisations o
     LEFT JOIN users u ON u.organisation_id = o.id
     LEFT JOIN referrals r ON r.referring_organisation_id = o.id OR r.receiving_organisation_id = o.id
     WHERE ${organisationFilter}
       ${activeOnly}
     GROUP BY o.id, o.name, o.type, o.status, o.created_at
     ORDER BY o.type, o.name`,
    platformParams
  );
  return { summary: createSummary(rows), rows };
}

async function generateSingleReport(report, user, filters) {
  if (user.role === ROLES.NGO_SOCIAL_WORKER) return ngoReport(report, user, filters);
  if (user.role === ROLES.HOSPITAL_RECORDS_KEEPER) return hospitalReport(report, user, filters);
  if (user.role === ROLES.ORG_ADMIN) return orgAdminReport(report, user, filters);
  if (user.role === ROLES.PLATFORM_ADMIN) return platformReport(report, user, filters);
  return { summary: {}, rows: [] };
}

async function buildReportResponse(report, user, filters, outputFormat) {
  const generatedAt = new Date().toISOString();
  const { summary, rows } = await generateSingleReport(report, user, filters);
  const response = {
    report_key: report.report_key,
    report_name: report.report_name,
    generated_at: generatedAt,
    filters_applied: sanitizeFilters(filters),
    output_format: outputFormat,
    summary,
    rows
  };

  if (outputFormat !== 'screen') {
    Object.assign(response, makeExportPayload(report.report_name, rows, null, outputFormat));
  }

  return response;
}

reportsRouter.get('/available', requireAuth, (req, res) => {
  res.json({
    reports: availableReportsFor(req.user),
    output_formats: Object.entries(formatLabels).map(([value, label]) => ({ value, label }))
  });
});

reportsRouter.post('/generate', requireAuth, asyncHandler(async (req, res) => {
  const reportType = req.body.report_type;
  const filters = sanitizeFilters(req.body.filters || {});
  const outputFormat = req.body.output_format || 'screen';

  try {
    const report = validateReportRequest(req.user, reportType, filters, outputFormat);
    await assertScopedFilters(req.user, filters);

    if (reportType === ALL_AVAILABLE_REPORT) {
      const sections = [];
      for (const allowedReport of nonAllReportsForUser(req.user)) {
        const section = await buildReportResponse(allowedReport, req.user, filters, 'screen');
        sections.push({
          report_key: allowedReport.report_key,
          report_name: allowedReport.report_name,
          summary: section.summary,
          rows: section.rows
        });
      }

      const response = {
        report_name: report.report_name,
        generated_at: new Date().toISOString(),
        filters_applied: filters,
        output_format: outputFormat,
        sections
      };

      if (outputFormat !== 'screen') {
        Object.assign(response, makeExportPayload(report.report_name, [], sections, outputFormat));
      }

      await auditReport(req.user, reportType, filters, outputFormat, true);
      return res.json(response);
    }

    const response = await buildReportResponse(report, req.user, filters, outputFormat);
    await auditReport(req.user, reportType, filters, outputFormat, true);
    return res.json(response);
  } catch (error) {
    await auditReport(req.user, reportType || 'unknown', filters, outputFormat, false, error.message);
    throw error;
  }
}));

reportsRouter.get('/summary', requireAuth, asyncHandler(async (req, res) => {
  const reports = availableReportsFor(req.user).filter((report) => report.report_key !== ALL_AVAILABLE_REPORT);
  if (!reports.length) {
    return res.json({ mode: 'empty', statuses: [], hospitals: [], outcomes: [], averageResponseHours: 0 });
  }

  const generated = await buildReportResponse(reports[0], req.user, {}, 'screen');
  res.json({
    mode: req.user.role === ROLES.PLATFORM_ADMIN ? 'platform' : req.user.role === ROLES.ORG_ADMIN ? 'organisation' : 'operational',
    statuses: generated.rows.slice(0, 4).map((row) => ({ label: row.current_status || row.organisation_status || row.staff_role || 'Records', total: row.total_referrals || row.total_referral_count || row.number_of_users || 1 })),
    hospitals: [],
    outcomes: [],
    averageResponseHours: 0
  });
}));
