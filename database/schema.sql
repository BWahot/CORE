CREATE DATABASE IF NOT EXISTS ngo_referral_tracker;
USE ngo_referral_tracker;

CREATE TABLE IF NOT EXISTS organisations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type ENUM('NGO','HOSPITAL') NOT NULL,
  email VARCHAR(160),
  phone VARCHAR(40),
  location VARCHAR(160),
  status ENUM('ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('PLATFORM_ADMIN','ORG_ADMIN','NGO_SOCIAL_WORKER','HOSPITAL_RECORDS_KEEPER') NOT NULL UNIQUE,
  scope ENUM('PLATFORM','ORGANISATION') NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organisation_id INT NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('PLATFORM_ADMIN','ORG_ADMIN','NGO_SOCIAL_WORKER','HOSPITAL_RECORDS_KEEPER') NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  UNIQUE KEY unique_user_role (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(120) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organisation_id INT NOT NULL,
  case_number VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  date_of_birth DATE NULL,
  gender ENUM('Female','Male','Other') NOT NULL,
  phone VARCHAR(40),
  county VARCHAR(100) NOT NULL,
  location VARCHAR(160),
  vulnerability_notes TEXT,
  consent_recorded BOOLEAN DEFAULT FALSE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referral_number VARCHAR(40) NOT NULL UNIQUE,
  beneficiary_id INT NOT NULL,
  referring_organisation_id INT NOT NULL,
  receiving_organisation_id INT NOT NULL,
  created_by INT NOT NULL,
  service_required VARCHAR(180) NOT NULL,
  urgency ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
  reason TEXT NOT NULL,
  status ENUM('Pending','Accepted','In Progress','Completed','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
  due_date DATE NULL,
  accepted_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id),
  FOREIGN KEY (referring_organisation_id) REFERENCES organisations(id),
  FOREIGN KEY (receiving_organisation_id) REFERENCES organisations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referral_id INT NOT NULL,
  submitted_by_user_id INT NOT NULL,
  outcome ENUM('Treated','Referred onward','Admitted','Discharged','No show','Other') NOT NULL,
  treatment_given TEXT NOT NULL,
  discharge_status VARCHAR(120),
  recommendations TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS donors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organisation_id INT NULL,
  name VARCHAR(160) NOT NULL,
  contact_person VARCHAR(160),
  email VARCHAR(160),
  funding_area VARCHAR(160),
  status ENUM('Active','Prospective','Closed') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS welfare_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organisation_id INT NULL,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity_available INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS welfare_distributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  beneficiary_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  distributed_by INT NOT NULL,
  notes TEXT,
  distributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id),
  FOREIGN KEY (item_id) REFERENCES welfare_items(id),
  FOREIGN KEY (distributed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id INT NULL,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
