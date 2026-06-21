import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const dbName = process.env.DB_NAME || 'ngo_referral_tracker';
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: dbName,
  multipleStatements: true
});

const passwordHash = await bcrypt.hash('password123', 10);

await connection.query(
  `INSERT INTO organisations (id, name, type, email, phone, location, status) VALUES
    (1, 'HopeBridge Community NGO', 'NGO', 'referrals@hopebridge.or.ke', '+254700100200', 'Nairobi', 'ACTIVE'),
    (2, 'Ustawi Outreach Programme', 'NGO', 'care@ustawi.or.ke', '+254711400500', 'Kiambu', 'ACTIVE'),
    (3, 'Kenyatta National Hospital', 'HOSPITAL', 'records@knh.or.ke', '+254720900100', 'Nairobi', 'ACTIVE'),
    (4, 'Mbagathi County Hospital', 'HOSPITAL', 'referrals@mbagathi.go.ke', '+254733123456', 'Nairobi', 'ACTIVE')
   ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), email = VALUES(email), phone = VALUES(phone), location = VALUES(location), status = VALUES(status);

   INSERT INTO roles (id, name, scope) VALUES
    (1, 'PLATFORM_ADMIN', 'PLATFORM'),
    (2, 'ORG_ADMIN', 'ORGANISATION'),
    (3, 'NGO_SOCIAL_WORKER', 'ORGANISATION'),
    (4, 'HOSPITAL_RECORDS_KEEPER', 'ORGANISATION')
   ON DUPLICATE KEY UPDATE scope = VALUES(scope);

   INSERT INTO permissions (id, name) VALUES
    (1, 'manage_organisations'),
    (2, 'manage_platform_settings'),
    (3, 'view_platform_audit_logs'),
    (4, 'manage_organisation_staff'),
    (5, 'create_referrals'),
    (6, 'process_referrals'),
    (7, 'submit_feedback'),
    (8, 'view_organisation_reports')
   ON DUPLICATE KEY UPDATE name = VALUES(name);

   INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
    (1, 1), (1, 2), (1, 3),
    (2, 4), (2, 8),
    (3, 5), (3, 8),
    (4, 6), (4, 7), (4, 8);`
);

await connection.query(
  `INSERT INTO users (id, organisation_id, full_name, email, password_hash, role, status) VALUES
    (1, NULL, 'Anthony Khajira', 'platform@demo.test', ?, 'PLATFORM_ADMIN', 'ACTIVE'),
    (2, 1, 'HopeBridge Admin', 'orgadmin@demo.test', ?, 'ORG_ADMIN', 'ACTIVE'),
    (3, 1, 'Benjamin Wahothi', 'ngo@demo.test', ?, 'NGO_SOCIAL_WORKER', 'ACTIVE'),
    (4, 3, 'Sydney Ndeti', 'hospital@demo.test', ?, 'HOSPITAL_RECORDS_KEEPER', 'ACTIVE'),
    (5, 3, 'KNH Organisation Admin', 'hospitaladmin@demo.test', ?, 'ORG_ADMIN', 'ACTIVE')
   ON DUPLICATE KEY UPDATE
    organisation_id = VALUES(organisation_id),
    password_hash = VALUES(password_hash),
    full_name = VALUES(full_name),
    role = VALUES(role),
    status = VALUES(status);`,
  [passwordHash, passwordHash, passwordHash, passwordHash, passwordHash]
);

await connection.query(
  `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES
    (1, 1), (2, 2), (3, 3), (4, 4), (5, 2);

   INSERT INTO service_categories (id, name, description, is_active) VALUES
    (1, 'Maternal Health', 'Referral services for maternal and reproductive health.', TRUE),
    (2, 'Chronic Care', 'Long-term care review and medication follow-up.', TRUE),
    (3, 'Psychosocial Support', 'Counselling, assessment, and survivor support services.', TRUE)
   ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = VALUES(is_active);

   INSERT INTO referral_categories (id, name, description, is_active) VALUES
    (1, 'Emergency', 'Immediate referral requiring urgent action.', TRUE),
    (2, 'Routine Follow-up', 'Scheduled referral for continuity of care.', TRUE),
    (3, 'Specialist Assessment', 'Referral for specialised assessment.', TRUE)
   ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = VALUES(is_active);

   INSERT INTO platform_settings (setting_key, setting_value) VALUES
    ('default_feedback_sla_hours', '48'),
    ('organisation_self_service', 'enabled')
   ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);`
);

await connection.query(
  `INSERT INTO beneficiaries (id, organisation_id, case_number, full_name, date_of_birth, gender, phone, county, location, vulnerability_notes, consent_recorded, created_by) VALUES
    (1, 1, 'CASE-2026-001', 'Mary Achieng', '1998-04-12', 'Female', '+254712000111', 'Nairobi', 'Kibera', 'Requires urgent maternal health support and follow-up.', TRUE, 3),
    (2, 1, 'CASE-2026-002', 'Peter Kamau', '1984-09-21', 'Male', '+254733000222', 'Nairobi', 'Mathare', 'Chronic condition follow-up and medication support.', TRUE, 3),
    (3, 2, 'CASE-2026-003', 'Amina Hassan', '2003-01-05', 'Female', '+254722000333', 'Kiambu', 'Ruiru', 'Psychosocial support and hospital assessment required.', TRUE, 3)
   ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone = VALUES(phone), vulnerability_notes = VALUES(vulnerability_notes);

   INSERT INTO referrals (id, referral_number, beneficiary_id, referring_organisation_id, receiving_organisation_id, created_by, service_required, urgency, reason, status, due_date, accepted_at, completed_at) VALUES
    (1, 'REF-2026-0001', 1, 1, 3, 3, 'Maternal health assessment', 'Critical', 'Beneficiary reported severe symptoms and needs hospital evaluation.', 'In Progress', DATE_ADD(CURDATE(), INTERVAL 1 DAY), NOW(), NULL),
    (2, 'REF-2026-0002', 2, 1, 4, 3, 'Chronic care review', 'Medium', 'Follow-up required after missed clinic appointment.', 'Completed', DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
    (3, 'REF-2026-0003', 3, 2, 3, 3, 'Psychosocial and medical assessment', 'High', 'Beneficiary needs linked hospital assessment and NGO follow-up.', 'Pending', DATE_ADD(CURDATE(), INTERVAL 3 DAY), NULL, NULL)
   ON DUPLICATE KEY UPDATE status = VALUES(status), urgency = VALUES(urgency);`
);

await connection.query(
  `INSERT INTO feedback (referral_id, submitted_by_user_id, outcome, treatment_given, discharge_status, recommendations)
   SELECT 2, 4, 'Treated', 'Clinical review completed and medication issued.', 'Discharged', 'NGO to support transport for next clinic visit.'
   WHERE NOT EXISTS (SELECT 1 FROM feedback WHERE referral_id = 2);

   INSERT INTO notifications (user_id, title, message) VALUES
    (3, 'Feedback received', 'Mbagathi County Hospital submitted feedback for REF-2026-0002.'),
    (4, 'New referral pending', 'A critical referral is awaiting review in the hospital inbox.'),
    (1, 'Usage summary ready', 'Aggregate platform usage metrics are available.');

   INSERT INTO donors (id, organisation_id, name, contact_person, email, funding_area, status) VALUES
    (1, 1, 'Afya Support Fund', 'Grace Wambui', 'grace@afyasupport.org', 'Hospital referral transport', 'Active'),
    (2, NULL, 'Community Care Trust', 'Daniel Otieno', 'daniel@cctrust.org', 'Medical supplies', 'Prospective')
   ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status), organisation_id = VALUES(organisation_id);

   INSERT INTO welfare_items (id, organisation_id, name, category, quantity_available, reorder_level) VALUES
    (1, 1, 'Transport vouchers', 'Referral support', 45, 10),
    (2, 1, 'Hygiene kits', 'Welfare supplies', 80, 20),
    (3, NULL, 'Food baskets', 'Household support', 12, 15)
   ON DUPLICATE KEY UPDATE quantity_available = VALUES(quantity_available), reorder_level = VALUES(reorder_level), organisation_id = VALUES(organisation_id);

   INSERT INTO welfare_distributions (beneficiary_id, item_id, quantity, distributed_by, notes)
   SELECT 1, 1, 2, 3, 'Transport support for hospital visit.'
   WHERE NOT EXISTS (SELECT 1 FROM welfare_distributions WHERE beneficiary_id = 1 AND item_id = 1);

   INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
   SELECT 1, 'SEED_PLATFORM', 'system', NULL, JSON_OBJECT('message', 'Demo data loaded')
   WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'SEED_PLATFORM');`
);

await connection.end();

console.log('Database seeded. Demo password for all users: password123');
