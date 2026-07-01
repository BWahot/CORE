import { ROLES } from '../auth.js';

export const REPORT_FORMATS = ['screen', 'csv', 'pdf'];

export const REPORT_DEFINITIONS = [
  {
    report_key: 'platform_system_overview',
    report_name: 'System Overview Report',
    allowed_roles: [ROLES.PLATFORM_ADMIN],
    available_filters: ['date_preset', 'start_date', 'end_date', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'platform_organisation',
    report_name: 'Organisation Report',
    allowed_roles: [ROLES.PLATFORM_ADMIN],
    available_filters: ['date_preset', 'start_date', 'end_date', 'organisation_id'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'organisation_activity',
    report_name: 'Organisation Activity Report',
    allowed_roles: [ROLES.ORG_ADMIN],
    available_filters: ['date_preset', 'start_date', 'end_date'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'ngo_social_worker_activity',
    report_name: 'NGO Social Worker Activity Report',
    allowed_roles: [ROLES.NGO_SOCIAL_WORKER],
    available_filters: ['date_preset', 'start_date', 'end_date'],
    export_formats: REPORT_FORMATS
  },
  {
    report_key: 'hospital_records_keeper_activity',
    report_name: 'Hospital Records Keeper Activity Report',
    allowed_roles: [ROLES.HOSPITAL_RECORDS_KEEPER],
    available_filters: ['date_preset', 'start_date', 'end_date'],
    export_formats: REPORT_FORMATS
  }
];

export function reportsForRole(role) {
  return REPORT_DEFINITIONS.filter((report) => report.allowed_roles.includes(role));
}

export function availableReportsFor(user) {
  return reportsForRole(user.role).map((report) => ({ ...report }));
}

export function getReportDefinition(reportKey) {
  return REPORT_DEFINITIONS.find((report) => report.report_key === reportKey);
}

export function defaultReportForUser(user) {
  return reportsForRole(user.role)[0] || null;
}

export function canGenerateReport(user, reportKey) {
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
