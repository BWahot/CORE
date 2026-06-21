import { ROLES } from '../auth.js';

export const REPORT_FORMATS = ['screen', 'pdf', 'csv', 'excel'];
export const ALL_AVAILABLE_REPORT = 'all_available';

export const REPORT_DEFINITIONS = [
  {
    report_key: 'referral_summary',
    report_name: 'Referral Summary Report',
    allowed_roles: [ROLES.NGO_SOCIAL_WORKER],
    scope_type: 'NGO_REFERRALS',
    available_filters: ['start_date', 'end_date', 'status', 'feedback_status', 'service_type', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'referral_status',
    report_name: 'Referral Status Report',
    allowed_roles: [ROLES.NGO_SOCIAL_WORKER],
    scope_type: 'NGO_REFERRALS',
    available_filters: ['start_date', 'end_date', 'status', 'service_type', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'pending_feedback',
    report_name: 'Pending Feedback Report',
    allowed_roles: [ROLES.NGO_SOCIAL_WORKER],
    scope_type: 'NGO_REFERRALS',
    available_filters: ['start_date', 'end_date', 'service_type', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'completed_referrals',
    report_name: 'Completed Referrals Report',
    allowed_roles: [ROLES.NGO_SOCIAL_WORKER],
    scope_type: 'NGO_REFERRALS',
    available_filters: ['start_date', 'end_date', 'feedback_status', 'service_type', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'hospital_feedback',
    report_name: 'Hospital Feedback Report',
    allowed_roles: [ROLES.NGO_SOCIAL_WORKER],
    scope_type: 'NGO_FEEDBACK',
    available_filters: ['start_date', 'end_date', 'feedback_status', 'service_type', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'beneficiary_follow_up',
    report_name: 'Beneficiary Follow-up Report',
    allowed_roles: [ROLES.NGO_SOCIAL_WORKER],
    scope_type: 'NGO_CASES',
    available_filters: ['start_date', 'end_date', 'status', 'feedback_status', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'referral_by_hospital',
    report_name: 'Referral by Hospital Report',
    allowed_roles: [ROLES.NGO_SOCIAL_WORKER],
    scope_type: 'NGO_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'status', 'service_type', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'referral_by_service_type',
    report_name: 'Referral by Service Type Report',
    allowed_roles: [ROLES.NGO_SOCIAL_WORKER],
    scope_type: 'NGO_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'status', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'incoming_referrals',
    report_name: 'Incoming Referrals Report',
    allowed_roles: [ROLES.HOSPITAL_RECORDS_KEEPER],
    scope_type: 'HOSPITAL_REFERRALS',
    available_filters: ['start_date', 'end_date', 'status', 'feedback_status', 'service_type', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'referral_processing',
    report_name: 'Referral Processing Report',
    allowed_roles: [ROLES.HOSPITAL_RECORDS_KEEPER],
    scope_type: 'HOSPITAL_REFERRALS',
    available_filters: ['start_date', 'end_date', 'status', 'service_type', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'rejected_referrals',
    report_name: 'Rejected Referrals Report',
    allowed_roles: [ROLES.HOSPITAL_RECORDS_KEEPER],
    scope_type: 'HOSPITAL_REFERRALS',
    available_filters: ['start_date', 'end_date', 'service_type', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'pending_hospital_action',
    report_name: 'Pending Hospital Action Report',
    allowed_roles: [ROLES.HOSPITAL_RECORDS_KEEPER],
    scope_type: 'HOSPITAL_REFERRALS',
    available_filters: ['start_date', 'end_date', 'service_type', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'feedback_submitted',
    report_name: 'Feedback Submitted Report',
    allowed_roles: [ROLES.HOSPITAL_RECORDS_KEEPER],
    scope_type: 'HOSPITAL_FEEDBACK',
    available_filters: ['start_date', 'end_date', 'feedback_status', 'service_type', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'service_demand',
    report_name: 'Service Demand Report',
    allowed_roles: [ROLES.HOSPITAL_RECORDS_KEEPER],
    scope_type: 'HOSPITAL_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'status', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'urgency',
    report_name: 'Urgency Report',
    allowed_roles: [ROLES.HOSPITAL_RECORDS_KEEPER],
    scope_type: 'HOSPITAL_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'status', 'service_type', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'average_response_time',
    report_name: 'Average Response Time Report',
    allowed_roles: [ROLES.HOSPITAL_RECORDS_KEEPER],
    scope_type: 'HOSPITAL_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'status', 'service_type', 'urgency', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'staff_activity',
    report_name: 'Staff Activity Report',
    allowed_roles: [ROLES.ORG_ADMIN],
    scope_type: 'ORG_STAFF',
    available_filters: ['start_date', 'end_date', 'staff_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'organisation_referral_summary',
    report_name: 'Organisation Referral Summary Report',
    allowed_roles: [ROLES.ORG_ADMIN],
    scope_type: 'ORG_REFERRALS',
    available_filters: ['start_date', 'end_date', 'status', 'feedback_status', 'service_type', 'urgency', 'staff_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'feedback_completion',
    report_name: 'Feedback Completion Report',
    allowed_roles: [ROLES.ORG_ADMIN],
    scope_type: 'ORG_REFERRALS',
    available_filters: ['start_date', 'end_date', 'status', 'feedback_status', 'staff_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'response_time',
    report_name: 'Response Time Report',
    allowed_roles: [ROLES.ORG_ADMIN],
    scope_type: 'ORG_REFERRALS',
    available_filters: ['start_date', 'end_date', 'status', 'service_type', 'urgency', 'staff_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'monthly_organisation',
    report_name: 'Monthly Organisation Report',
    allowed_roles: [ROLES.ORG_ADMIN],
    scope_type: 'ORG_REFERRALS',
    available_filters: ['start_date', 'end_date', 'status', 'feedback_status', 'service_type', 'urgency', 'staff_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'organisation_registry',
    report_name: 'Organisation Registry Report',
    allowed_roles: [ROLES.PLATFORM_ADMIN],
    scope_type: 'PLATFORM_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'organisation_type', 'organisation_status'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'active_organisations',
    report_name: 'Active Organisations Report',
    allowed_roles: [ROLES.PLATFORM_ADMIN],
    scope_type: 'PLATFORM_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'organisation_type', 'organisation_status'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'user_account',
    report_name: 'User Account Report',
    allowed_roles: [ROLES.PLATFORM_ADMIN],
    scope_type: 'PLATFORM_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'organisation_type', 'organisation_status'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'system_usage',
    report_name: 'System Usage Report',
    allowed_roles: [ROLES.PLATFORM_ADMIN],
    scope_type: 'PLATFORM_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'organisation_type', 'organisation_status'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'audit_trail',
    report_name: 'Audit Trail Report',
    allowed_roles: [ROLES.PLATFORM_ADMIN],
    scope_type: 'PLATFORM_AUDIT',
    available_filters: ['start_date', 'end_date', 'organisation_type', 'organisation_status'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'service_category_usage',
    report_name: 'Service Category Usage Report',
    allowed_roles: [ROLES.PLATFORM_ADMIN],
    scope_type: 'PLATFORM_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'organisation_type', 'organisation_status'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'platform_growth',
    report_name: 'Platform Growth Report',
    allowed_roles: [ROLES.PLATFORM_ADMIN],
    scope_type: 'PLATFORM_AGGREGATE',
    available_filters: ['start_date', 'end_date', 'organisation_type', 'organisation_status'],
    export_formats: REPORT_FORMATS
  }
];

export function reportsForRole(role) {
  return REPORT_DEFINITIONS.filter((report) => report.allowed_roles.includes(role));
}

export function availableReportsFor(user) {
  const reports = reportsForRole(user.role).map((report) => ({ ...report }));
  return [
    ...reports,
    {
      report_key: ALL_AVAILABLE_REPORT,
      report_name: 'All Available Reports',
      allowed_roles: [user.role],
      scope_type: 'ROLE_AVAILABLE',
      available_filters: [...new Set(reports.flatMap((report) => report.available_filters))],
      export_formats: REPORT_FORMATS
    }
  ];
}

export function getReportDefinition(reportKey) {
  if (reportKey === ALL_AVAILABLE_REPORT) {
    return {
      report_key: ALL_AVAILABLE_REPORT,
      report_name: 'All Available Reports',
      allowed_roles: Object.values(ROLES),
      scope_type: 'ROLE_AVAILABLE',
      available_filters: [],
      export_formats: REPORT_FORMATS
    };
  }

  return REPORT_DEFINITIONS.find((report) => report.report_key === reportKey);
}

export function canGenerateReport(user, reportKey) {
  if (reportKey === ALL_AVAILABLE_REPORT) {
    return reportsForRole(user.role).length > 0;
  }

  const report = getReportDefinition(reportKey);
  return Boolean(report && report.allowed_roles.includes(user.role));
}

export function assertReportAllowed(user, reportKey) {
  const report = getReportDefinition(reportKey);
  if (!report) {
    const error = new Error('Invalid report type.');
    error.status = 400;
    throw error;
  }

  if (!canGenerateReport(user, reportKey)) {
    const error = new Error('You do not have permission to generate this report.');
    error.status = 403;
    throw error;
  }

  return report;
}

export function validateReportRequest(user, reportKey, filters = {}, outputFormat = 'screen') {
  const report = assertReportAllowed(user, reportKey);

  if (!REPORT_FORMATS.includes(outputFormat)) {
    const error = new Error('Invalid output format.');
    error.status = 400;
    throw error;
  }

  if (filters.start_date && filters.end_date && filters.start_date > filters.end_date) {
    const error = new Error('Start date must be before end date.');
    error.status = 400;
    throw error;
  }

  return report;
}

export function nonAllReportsForUser(user) {
  return availableReportsFor(user).filter((report) => report.report_key !== ALL_AVAILABLE_REPORT);
}
