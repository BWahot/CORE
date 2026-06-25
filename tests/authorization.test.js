import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageStaff, emailDomain, expectedOrganisationRole, organisationDomain, referralScopeWhere, ROLES } from '../server/src/auth.js';
import {
  ALL_AVAILABLE_REPORT,
  availableReportsFor,
  canGenerateReport,
  nonAllReportsForUser,
  validateReportRequest
} from '../server/src/reports/config.js';

function user(role, organisationId = null, organisationType = null) {
  return {
    id: Math.floor(Math.random() * 1000),
    role,
    organisation_id: organisationId,
    organisation_type: organisationType
  };
}

test('platform admin cannot receive referral scope', () => {
  const scope = referralScopeWhere(user(ROLES.PLATFORM_ADMIN));
  assert.equal(scope.clause, '1 = 0');
});

test('email domains are normalised for organisation matching', () => {
  assert.equal(emailDomain('Social.Worker@HopeBridge.or.ke'), 'hopebridge.or.ke');
  assert.equal(organisationDomain({ email: 'records@KNH.or.ke' }), 'knh.or.ke');
});

test('organisation type determines the operational role', () => {
  assert.equal(expectedOrganisationRole('NGO'), ROLES.NGO_SOCIAL_WORKER);
  assert.equal(expectedOrganisationRole('HOSPITAL'), ROLES.HOSPITAL_RECORDS_KEEPER);
});

test('organisation admin cannot receive referral scope', () => {
  const scope = referralScopeWhere(user(ROLES.ORG_ADMIN, 1, 'NGO'));
  assert.equal(scope.clause, '1 = 0');
});

test('NGO social worker is scoped to referrals created by their organisation', () => {
  const scope = referralScopeWhere(user(ROLES.NGO_SOCIAL_WORKER, 7, 'NGO'));
  assert.equal(scope.clause, 'r.referring_organisation_id = :scopeOrganisationId');
  assert.deepEqual(scope.params, { scopeOrganisationId: 7 });
});

test('hospital records keeper is scoped to referrals received by their hospital', () => {
  const scope = referralScopeWhere(user(ROLES.HOSPITAL_RECORDS_KEEPER, 9, 'HOSPITAL'));
  assert.equal(scope.clause, 'r.receiving_organisation_id = :scopeOrganisationId');
  assert.deepEqual(scope.params, { scopeOrganisationId: 9 });
});

test('organisation admin can manage staff inside own organisation', () => {
  assert.equal(canManageStaff(user(ROLES.ORG_ADMIN, 4, 'NGO'), 4), true);
});

test('organisation admin cannot manage staff in another organisation', () => {
  assert.equal(canManageStaff(user(ROLES.ORG_ADMIN, 4, 'NGO'), 5), false);
});

test('platform admin cannot manage organisation staff through org-admin guard', () => {
  assert.equal(canManageStaff(user(ROLES.PLATFORM_ADMIN), 4), false);
});

test('NGO social worker sees only NGO reports plus All Available Reports', () => {
  const reports = availableReportsFor(user(ROLES.NGO_SOCIAL_WORKER, 1, 'NGO'));
  assert.equal(reports.at(-1).report_key, ALL_AVAILABLE_REPORT);
  assert.equal(reports.some((report) => report.report_key === 'referral_summary'), true);
  assert.equal(reports.some((report) => report.report_key === 'incoming_referrals'), false);
});

test('hospital records keeper sees only hospital reports plus All Available Reports', () => {
  const reports = availableReportsFor(user(ROLES.HOSPITAL_RECORDS_KEEPER, 3, 'HOSPITAL'));
  assert.equal(reports.at(-1).report_key, ALL_AVAILABLE_REPORT);
  assert.equal(reports.some((report) => report.report_key === 'incoming_referrals'), true);
  assert.equal(reports.some((report) => report.report_key === 'organisation_registry'), false);
});

test('organisation admin sees only organisation reports plus All Available Reports', () => {
  const reports = availableReportsFor(user(ROLES.ORG_ADMIN, 1, 'NGO'));
  assert.equal(reports.at(-1).report_key, ALL_AVAILABLE_REPORT);
  assert.equal(reports.some((report) => report.report_key === 'staff_activity'), true);
  assert.equal(reports.some((report) => report.report_key === 'platform_growth'), false);
});

test('platform admin sees only platform reports plus All Available Reports', () => {
  const reports = availableReportsFor(user(ROLES.PLATFORM_ADMIN));
  assert.equal(reports.at(-1).report_key, ALL_AVAILABLE_REPORT);
  assert.equal(reports.some((report) => report.report_key === 'organisation_registry'), true);
  assert.equal(reports.some((report) => report.report_key === 'beneficiary_follow_up'), false);
});

test('NGO social worker cannot generate incoming referrals report', () => {
  assert.equal(canGenerateReport(user(ROLES.NGO_SOCIAL_WORKER, 1, 'NGO'), 'incoming_referrals'), false);
});

test('hospital records keeper cannot generate organisation registry report', () => {
  assert.equal(canGenerateReport(user(ROLES.HOSPITAL_RECORDS_KEEPER, 3, 'HOSPITAL'), 'organisation_registry'), false);
});

test('platform admin cannot generate beneficiary follow-up report', () => {
  assert.equal(canGenerateReport(user(ROLES.PLATFORM_ADMIN), 'beneficiary_follow_up'), false);
});

test('All Available Reports excludes unauthorised reports', () => {
  const reports = nonAllReportsForUser(user(ROLES.PLATFORM_ADMIN));
  assert.equal(reports.every((report) => report.allowed_roles.includes(ROLES.PLATFORM_ADMIN)), true);
  assert.equal(reports.some((report) => report.report_key === 'hospital_feedback'), false);
});

test('invalid report filters reject reversed date ranges', () => {
  assert.throws(
    () => validateReportRequest(user(ROLES.NGO_SOCIAL_WORKER, 1, 'NGO'), 'referral_summary', { start_date: '2026-06-20', end_date: '2026-06-01' }, 'screen'),
    /Start date/
  );
});
