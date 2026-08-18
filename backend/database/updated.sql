-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.4.3 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for payhub
CREATE DATABASE IF NOT EXISTS `payhub` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `payhub`;

-- Dumping structure for table payhub.countries
CREATE TABLE IF NOT EXISTS `countries` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(100)  NOT NULL,
  `iso2`            CHAR(2)       NOT NULL COMMENT 'ISO 3166-1 alpha-2, e.g. KE',
  `iso3`            CHAR(3)       NOT NULL COMMENT 'ISO 3166-1 alpha-3, e.g. KEN',
  `phone_code`      VARCHAR(6)    DEFAULT NULL COMMENT 'Calling code, e.g. +254',
  `currency_code`   CHAR(3)       DEFAULT NULL COMMENT 'ISO 4217, e.g. KES',
  `currency_symbol` VARCHAR(5)    DEFAULT NULL,
  `timezone`        VARCHAR(50)   DEFAULT NULL COMMENT 'Default IANA timezone, e.g. Africa/Nairobi',
  `is_active`       TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`      TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_country_iso2` (`iso2`),
  UNIQUE KEY `unique_country_iso3` (`iso3`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Dumping structure for table payhub.counties
CREATE TABLE IF NOT EXISTS `counties` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `country_id`  INT           NOT NULL,
  `name`        VARCHAR(100)  NOT NULL,
  `code`        VARCHAR(10)   DEFAULT NULL COMMENT 'Official county/region code, e.g. 001',
  `is_active`   TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`  TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_county_per_country` (`country_id`, `name`),
  KEY `idx_counties_country_id` (`country_id`),

  CONSTRAINT `counties_country_fk`
    FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Dumping structure for table payhub.organizations
CREATE TABLE IF NOT EXISTS `organizations` (
  `id`                        INT           NOT NULL AUTO_INCREMENT,
  `name`                      VARCHAR(100)  NOT NULL,
  `account_type`              ENUM('tenant','platform') NOT NULL DEFAULT 'tenant',
  `payroll_number_prefix`     VARCHAR(10)   DEFAULT 'EMP',
  `kra_pin`                   VARCHAR(11)   DEFAULT NULL,
  `nssf_number`               VARCHAR(15)   DEFAULT NULL,
  `nhif_number`               VARCHAR(15)   DEFAULT NULL,
  `legal_type`                ENUM('LTD','PLC','Sole_Proprietor','Partnership','NGO','Government','School','Other') DEFAULT NULL,
  `registration_number`       VARCHAR(50)   DEFAULT NULL,
  `physical_address`          VARCHAR(255)  DEFAULT NULL,
  `postal_address`            VARCHAR(255)  DEFAULT NULL,
  `postal_code_id`            INT           DEFAULT NULL,
  `county_id`                 INT           DEFAULT NULL,
  `country_id`                INT           DEFAULT NULL,
  `primary_phone`             VARCHAR(20)   DEFAULT NULL,
  `secondary_phone`           VARCHAR(20)   DEFAULT NULL,
  `official_email`            VARCHAR(255)  DEFAULT NULL,
  `logo_url`                  VARCHAR(255)  DEFAULT NULL,
  `currency`                  VARCHAR(10)   DEFAULT 'KES',
  `payroll_schedule`          ENUM('Monthly','Bi-Monthly','Weekly') DEFAULT 'Monthly',
  `payroll_lock_date`         DATE          DEFAULT NULL,
  `default_payday`            INT           DEFAULT NULL,
  `bank_id`                   INT           DEFAULT NULL,
  `bank_account_name`         VARCHAR(255)  DEFAULT NULL,
  `bank_account_number`       VARCHAR(255)  DEFAULT NULL,
  `bank_branch`                VARCHAR(255)  DEFAULT NULL,
  `swift_code`                VARCHAR(11)   DEFAULT NULL,
  `nssf_branch_code`          VARCHAR(50)   DEFAULT NULL,
  `nhif_branch_code`          VARCHAR(50)   DEFAULT NULL,
  `primary_administrator_id`  INT           DEFAULT NULL,
  `is_active`                 TINYINT(1)    DEFAULT 1,
  `setup_completed`           TINYINT(1)    NOT NULL DEFAULT 0,
  `setup_completed_at`        TIMESTAMP     NULL DEFAULT NULL,
  `created_at`                TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `domain`                    VARCHAR(100)  DEFAULT NULL,

  PRIMARY KEY (`id`),
  KEY `idx_org_kra_pin` (`kra_pin`),
  KEY `idx_org_county_id` (`county_id`),
  KEY `idx_org_country_id` (`country_id`),
  KEY `idx_org_primary_administrator_id` (`primary_administrator_id`),

  CONSTRAINT `org_county_fk`
    FOREIGN KEY (`county_id`) REFERENCES `counties` (`id`) ON DELETE SET NULL,
  CONSTRAINT `org_country_fk`
    FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Dumping structure for table payhub.employees
CREATE TABLE IF NOT EXISTS `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `has_user` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = auto-create user account, 0 = no user account',
  `employee_number` varchar(50) NOT NULL,
  `firstname` varchar(255) NOT NULL,
  `middlename` varchar(255) DEFAULT NULL,
  `surname` varchar(255) NOT NULL,
  `personalemail` VARCHAR(255) NOT NULL UNIQUE,
  `workemail` VARCHAR(255) DEFAULT NULL UNIQUE,
  `phone` varchar(20) DEFAULT NULL,
  `hire_date` date NOT NULL,
  `start_date` date NOT NULL,
  `job_title_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `reports_to` int DEFAULT NULL,
  `base_salary` decimal(15,2) NOT NULL,
  `bank_account_number` varchar(50) DEFAULT NULL,
  `bank_name` VARCHAR(100)  DEFAULT NULL,
  `tax_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('active','on_leave','on_probation','suspended','resigned','terminated','retired','deceased') DEFAULT 'active',
  `employment_type` enum('full_time','part_time','contract') DEFAULT 'full_time',
  `work_location` enum('on-site','hybrid','remote') DEFAULT 'on-site',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `reports_to` (`reports_to`),
  KEY `idx_employee_org` (`organization_id`,`id`),
  KEY `idx_department_id` (`department_id`),
  UNIQUE KEY `unique_employee_number_per_org` (`organization_id`, `employee_number`),
  UNIQUE KEY `unique_workemail_per_org` (`organization_id`, `workemail`),
  CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employees_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employees_ibfk_3` FOREIGN KEY (`reports_to`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employees_ibfk_4` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employees_jt_fk`  FOREIGN KEY (`job_title_id`)    REFERENCES `job_titles`    (`id`) ON DELETE SET NULL\
  
) ENGINE=InnoDB AUTO_INCREMENT=128 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- -----------------------------------------------------------------------------
-- 1. employee_profiles
--    Stores statutory identity numbers that don't belong in the employees table.
--    Personal info: National ID, KRA PIN, NSSF Number, SHIF/NHIF Number.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `employee_profiles` (
  `id`               INT         NOT NULL AUTO_INCREMENT,
  `employee_id`      INT         NOT NULL,
  `national_id`      VARCHAR(20) DEFAULT NULL  COMMENT 'National ID number',
  `kra_pin`          VARCHAR(11) DEFAULT NULL  COMMENT 'KRA Personal Identification Number',
  `nssf_number`      VARCHAR(20) DEFAULT NULL  COMMENT 'NSSF member number',
  `shif_number`      VARCHAR(20) DEFAULT NULL  COMMENT 'SHIF/NHIF member number',
  `bank_name`        VARCHAR(100) DEFAULT NULL,
  `bank_branch`      VARCHAR(100) DEFAULT NULL,
  `bank_account_name` VARCHAR(150) DEFAULT NULL,
  -- bank_account_number is already in employees table; link there

  -- Pension & Sacco (voluntary)
  `pension_provider`       VARCHAR(100) DEFAULT NULL,
  `pension_member_number`  VARCHAR(50)  DEFAULT NULL,
  `pension_contribution`   DECIMAL(15,2) DEFAULT NULL  COMMENT 'Monthly employee pension contribution',
  `sacco_name`             VARCHAR(100) DEFAULT NULL,
  `sacco_member_number`    VARCHAR(50)  DEFAULT NULL,
  `sacco_contribution`     DECIMAL(15,2) DEFAULT NULL  COMMENT 'Monthly Sacco deduction',

  -- PAYE exemptions (e.g. disability certificate, mortgage relief)
  `paye_exemption_type`    ENUM('none','disability','mortgage_relief','other') DEFAULT 'none',
  `paye_exemption_amount`  DECIMAL(15,2) DEFAULT NULL  COMMENT 'Monthly relief amount if applicable',
  `paye_exemption_ref`     VARCHAR(100)  DEFAULT NULL  COMMENT 'Certificate / reference number',

  `created_at`  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_profile` (`employee_id`),

  CONSTRAINT `employee_profiles_emp_fk`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- -----------------------------------------------------------------------------
-- 2. employee_allowances
--    Recurring allowances attached to an employee (house allowance, transport, etc.)
--    These are added to gross pay every payrun automatically.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `employee_allowances` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `employee_id`     INT           NOT NULL,
  `config_id`       INT           NOT NULL  COMMENT 'Points to organization_configs (config_type=benefit)',
  `amount`          DECIMAL(15,2) NOT NULL,
  `effective_from`  DATE          NOT NULL,
  `effective_to`    DATE          DEFAULT NULL  COMMENT 'NULL = no end date',
  `is_active`       TINYINT(1)    DEFAULT 1,
  `created_at`      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `ea_employee_id` (`employee_id`),
  KEY `ea_config_id`   (`config_id`),

  CONSTRAINT `ea_emp_fk`    FOREIGN KEY (`employee_id`) REFERENCES `employees`            (`id`) ON DELETE CASCADE,
  CONSTRAINT `ea_config_fk` FOREIGN KEY (`config_id`)   REFERENCES `organization_configs` (`id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- -----------------------------------------------------------------------------
-- 3. departments
--    Departments within an organization
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `departments` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `organization_id` INT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) DEFAULT NULL,
    `head_employee_id` INT DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_org_dept` (`organization_id`, `name`),
    KEY `idx_org_dept` (`organization_id`, `name`),
    KEY `idx_head` (`head_employee_id`),
    CONSTRAINT fk_dept_org FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
    CONSTRAINT fk_dept_head FOREIGN KEY (`head_employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `job_titles` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `organization_id`      INT           NOT NULL,
  `department_id`   INT           DEFAULT NULL,
  `title`           VARCHAR(150)  NOT NULL,
  `grade`           VARCHAR(50)   DEFAULT NULL,
  `created_at`      TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_title_per_company` (`organization_id`, `title`),
  KEY `idx_jt_company`     (`organization_id`),
  KEY `idx_jt_department`  (`department_id`),

  CONSTRAINT `jt_company_fk`
    FOREIGN KEY (`organization_id`)    REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `jt_department_fk`
    FOREIGN KEY (`department_id`) REFERENCES `departments`   (`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping structure for table payhub.advances
CREATE TABLE IF NOT EXISTS `advances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `config_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `request_date` date NOT NULL,
  `status` enum('pending','approved','rejected','repaid') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `config_id` (`config_id`),
  CONSTRAINT `advances_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `advances_ibfk_2` FOREIGN KEY (`config_id`) REFERENCES `organization_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table payhub.approvals
CREATE TABLE IF NOT EXISTS `approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_type` enum('leave','loan','advance','refund','per_diem') NOT NULL,
  `entity_id` int NOT NULL,
  `approver_id` int NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `comments` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `approver_id` (`approver_id`),
  CONSTRAINT `approvals_ibfk_1` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table payhub.audit_logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `user_id` int NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int NOT NULL,
  `action` enum(
    'create',
    'update',
    'delete',
    'review',
    'finalize',
    'reopen',

    'auto_create',
    'locked_period_detected',
    'off_cycle_adjustment_linked',
    'carry_forward_applied',
    'carry_forward_queued',

    'submit',
    'policy_validated',
    'policy_failed',
    'manager_approved',
    'hr_approved',
    'finance_approved',
    'partially_approved',
    'rejected',
    'scheduled',
    'payment_initiated',
    'paid',
    'payment_failed',
    'disputed',
    'reversed',
    'cancelled'
  ) NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `organization_id` (`organization_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `audit_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table payhub.benefits
CREATE TABLE IF NOT EXISTS `benefits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `config_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `date_granted` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `config_id` (`config_id`),
  CONSTRAINT `benefits_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `benefits_ibfk_2` FOREIGN KEY (`config_id`) REFERENCES `organization_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Data exporting was unselected.

-- Updated structure for table payhub.leaves
CREATE TABLE IF NOT EXISTS `leaves` (
  `id`              INT       NOT NULL AUTO_INCREMENT,
  `organization_id` INT       NOT NULL,                    -- added: avoids sub-select on every query
  `employee_id`     INT       NOT NULL,
  `approver_id`     INT       DEFAULT NULL,                -- Employee who approves the leave
  `reliever_id`     INT       DEFAULT NULL,                -- Employee who takes the workload
  `leave_type_id`   INT       NOT NULL,                    -- replaces the old ENUM leave_type
  `start_date`      DATE      NOT NULL,
  `end_date`        DATE      NOT NULL,
  `duration_days`   DECIMAL(5,1) DEFAULT NULL,             -- computed & stored: accounts for weekends/half-days
  `is_half_day`     TINYINT(1)   DEFAULT 0,
  `half_day_period` ENUM('morning','afternoon') DEFAULT NULL,  -- only set when is_half_day = 1
  `status`          ENUM('pending','approved','rejected','cancelled','expired') DEFAULT 'pending',
  `reason`          TEXT      NULL,
  `rejection_reason` TEXT     NULL,                        -- populated when status = rejected
  `document_path`   VARCHAR(500) DEFAULT NULL,             -- uploaded medical cert or supporting doc
  `approved_at`     TIMESTAMP NULL DEFAULT NULL,
  `rejected_at`     TIMESTAMP NULL DEFAULT NULL,
  `created_at`      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_leaves_org`          (`organization_id`),
  KEY `idx_leaves_employee`     (`employee_id`),
  KEY `idx_leaves_leave_type`   (`leave_type_id`),
  KEY `idx_leaves_approver`     (`approver_id`),
  KEY `idx_leaves_reliever`     (`reliever_id`),
  KEY `idx_leaves_status`       (`status`),
  KEY `idx_leaves_dates`        (`start_date`, `end_date`),

  CONSTRAINT `leaves_org_fk`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leaves_employee_fk`
    FOREIGN KEY (`employee_id`)     REFERENCES `employees`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `leaves_type_fk`
    FOREIGN KEY (`leave_type_id`)   REFERENCES `leave_types`  (`id`) ON DELETE RESTRICT,
  CONSTRAINT `leaves_approver_fk`
    FOREIGN KEY (`approver_id`)     REFERENCES `employees`    (`id`) ON DELETE SET NULL,
  CONSTRAINT `leaves_reliever_fk`
    FOREIGN KEY (`reliever_id`)     REFERENCES `employees`    (`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- This is used incase user needs to create new leave types or edit existing ones. The actual leave requests are stored in the `leaves` table, which references the type via the `leave_type` field (which is currently an ENUM for simplicity but could be changed to a foreign key if more flexibility is needed).
CREATE TABLE IF NOT EXISTS `leave_types` (
  `id`                    INT           NOT NULL AUTO_INCREMENT,
  `organization_id`       INT           NOT NULL,
  `name`                  VARCHAR(100)  NOT NULL,
  `code`                  VARCHAR(30)   NOT NULL  COMMENT 'Short code e.g. ANNUAL, SICK, MAT',
  `description`           TEXT          DEFAULT NULL,

  -- Entitlement
  `days_per_year`         DECIMAL(5,1)  DEFAULT NULL  COMMENT 'NULL = unlimited / managed by accrual',
  `is_paid`               TINYINT(1)    DEFAULT 1,
  `is_accrued`            TINYINT(1)    DEFAULT 0     COMMENT '1 = days build up over time',
  `accrual_rate`          DECIMAL(5,2)  DEFAULT NULL  COMMENT 'Days per accrual cycle',
  `accrual_frequency`     ENUM('daily','weekly','monthly') DEFAULT 'monthly',

  -- Rules
  `allow_carry_over`      TINYINT(1)    DEFAULT 0,
  `max_carry_over_days`   DECIMAL(5,1)  DEFAULT 0,
  `allow_half_day`        TINYINT(1)    DEFAULT 1,
  `allow_negative_balance` TINYINT(1)  DEFAULT 0,
  `min_notice_days`       INT           DEFAULT 0     COMMENT 'Days in advance required',
  `max_consecutive_days`  INT           DEFAULT NULL  COMMENT 'NULL = no cap',
  `requires_document`     TINYINT(1)    DEFAULT 0     COMMENT 'e.g. medical cert for sick leave',
  `document_threshold_days` INT         DEFAULT NULL  COMMENT 'Require doc only if > N days',

  -- Approval
  `requires_approval`     TINYINT(1)    DEFAULT 1,
  `approval_workflow`     JSON          DEFAULT NULL  COMMENT 'e.g. ["manager","hr_manager"]',

  -- Eligibility
  `applicable_gender`     ENUM('all','male','female') DEFAULT 'all',
  `probation_eligible`    TINYINT(1)    DEFAULT 0     COMMENT '1 = can be taken during probation',

  -- System
  `is_system_default`     TINYINT(1)    DEFAULT 0     COMMENT '1 = seeded by system, not user-created',
  `is_active`             TINYINT(1)    DEFAULT 1,
  `created_at`            TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_leave_type_per_org` (`organization_id`, `code`),

  CONSTRAINT `leave_types_org_fk`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- shows the leave balance an employee has for each leave type, updated in real-time as leave is taken or accrued. This allows for quick reference without needing to calculate on the fly.
CREATE TABLE IF NOT EXISTS `leave_balances` (
  `id`               INT           NOT NULL AUTO_INCREMENT,
  `organization_id`  INT           NOT NULL,
  `employee_id`      INT           NOT NULL,
  `leave_type_id`    INT           NOT NULL,
  `leave_year`       YEAR          NOT NULL  COMMENT 'The leave year this balance belongs to',
  `entitled_days`    DECIMAL(5,1)  DEFAULT 0 COMMENT 'Days granted for this year',
  `accrued_days`     DECIMAL(5,1)  DEFAULT 0 COMMENT 'Days built up so far (if accrued type)',
  `used_days`        DECIMAL(5,1)  DEFAULT 0,
  `pending_days`     DECIMAL(5,1)  DEFAULT 0 COMMENT 'Days in pending requests',
  `carried_over`     DECIMAL(5,1)  DEFAULT 0 COMMENT 'Days brought forward from previous year',
  `encashed_days`    DECIMAL(5,1)  DEFAULT 0,
  `created_at`       TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_balance` (`employee_id`, `leave_type_id`, `leave_year`),
  KEY `lb_org`  (`organization_id`),

  CONSTRAINT `lb_org_fk`  FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lb_emp_fk`  FOREIGN KEY (`employee_id`)     REFERENCES `employees`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `lb_type_fk` FOREIGN KEY (`leave_type_id`)   REFERENCES `leave_types`   (`id`) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Data exporting was unselected.

-- Dumping structure for table payhub.loans
CREATE TABLE IF NOT EXISTS `loans` (
  `id`                          INT            NOT NULL AUTO_INCREMENT,
  `organization_id`             INT            NOT NULL,
  `employee_id`                 INT            NOT NULL,
  `config_id`                   INT            NOT NULL,
 
  `amount`                      DECIMAL(15,2)  NOT NULL,
  `interest_rate`               DECIMAL(5,2)   DEFAULT NULL,
  `monthly_deduction`           DECIMAL(15,2)  DEFAULT NULL,
  `balance_remaining`           DECIMAL(15,2)  DEFAULT NULL,
  `total_repaid`                DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
 
  `purpose`                     TEXT           DEFAULT NULL,
  `rejection_reason`            TEXT           DEFAULT NULL,
  `system_rejection_reason`     TEXT           DEFAULT NULL,
 
  -- Final (legacy) approver columns — still used when a single admin approves directly
  `approved_by`                 INT            DEFAULT NULL,
  `rejected_by`                 INT            DEFAULT NULL,
  `approved_at`                 TIMESTAMP      NULL DEFAULT NULL,
  `rejected_at`                 TIMESTAMP      NULL DEFAULT NULL,
 
  -- Step 3: Line Manager
  `manager_approved_by`         INT            DEFAULT NULL,
  `manager_approved_at`         TIMESTAMP      NULL DEFAULT NULL,
  `manager_rejected_by`         INT            DEFAULT NULL,
  `manager_rejected_at`         TIMESTAMP      NULL DEFAULT NULL,
  `manager_rejection_reason`    TEXT           DEFAULT NULL,
 
  -- Step 4: HR Manager
  `hr_approved_by`              INT            DEFAULT NULL,
  `hr_approved_at`              TIMESTAMP      NULL DEFAULT NULL,
  `hr_rejected_by`              INT            DEFAULT NULL,
  `hr_rejected_at`              TIMESTAMP      NULL DEFAULT NULL,
  `hr_rejection_reason`         TEXT           DEFAULT NULL,
 
  -- Step 5: Finance Manager (only if amount > threshold)
  `finance_approved_by`         INT            DEFAULT NULL,
  `finance_approved_at`         TIMESTAMP      NULL DEFAULT NULL,
  `finance_rejected_by`         INT            DEFAULT NULL,
  `finance_rejected_at`         TIMESTAMP      NULL DEFAULT NULL,
  `finance_rejection_reason`    TEXT           DEFAULT NULL,
 
  -- Step 6: Disbursement
  `disbursed_by`                INT            DEFAULT NULL,
  `disbursed_at`                TIMESTAMP      NULL DEFAULT NULL,
  `disbursement_date`           DATE           DEFAULT NULL,
 
  `start_date`                  DATE           NOT NULL,
  `end_date`                    DATE           DEFAULT NULL,
 
  `status` ENUM(
    'pending','validated','system_rejected',
    'manager_approved','manager_rejected',
    'hr_approved','hr_rejected','compliance_review',
    'finance_approved','finance_rejected',
    'approved','active','rejected','repaid','appealed'
  ) NOT NULL DEFAULT 'pending',
 
  `created_at`  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
  PRIMARY KEY (`id`),
  KEY `idx_loans_org`                 (`organization_id`),
  KEY `idx_loans_employee`            (`employee_id`),
  KEY `idx_loans_config`              (`config_id`),
  KEY `idx_loans_status`              (`status`),
  KEY `idx_loans_approved_by`         (`approved_by`),
  KEY `idx_loans_rejected_by`         (`rejected_by`),
  KEY `idx_loans_manager_approved_by` (`manager_approved_by`),
  KEY `idx_loans_hr_approved_by`      (`hr_approved_by`),
  KEY `idx_loans_finance_approved_by` (`finance_approved_by`),
  KEY `idx_loans_disbursed_by`        (`disbursed_by`),
 
  CONSTRAINT `loans_org_fk`                  FOREIGN KEY (`organization_id`)    REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `loans_employee_fk`             FOREIGN KEY (`employee_id`)        REFERENCES `employees`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `loans_config_fk`               FOREIGN KEY (`config_id`)          REFERENCES `organization_configs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `loans_approved_by_fk`          FOREIGN KEY (`approved_by`)        REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `loans_rejected_by_fk`          FOREIGN KEY (`rejected_by`)        REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `loans_manager_approved_by_fk`  FOREIGN KEY (`manager_approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `loans_manager_rejected_by_fk`  FOREIGN KEY (`manager_rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `loans_hr_approved_by_fk`       FOREIGN KEY (`hr_approved_by`)     REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `loans_hr_rejected_by_fk`       FOREIGN KEY (`hr_rejected_by`)     REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `loans_finance_approved_by_fk`  FOREIGN KEY (`finance_approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `loans_finance_rejected_by_fk`  FOREIGN KEY (`finance_rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `loans_disbursed_by_fk`         FOREIGN KEY (`disbursed_by`)       REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- -----------------------------------------------------------------------------
-- 2. loan_repayments  — track individual repayments / deductions
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `loan_repayments` (
    `id`              INT           NOT NULL AUTO_INCREMENT,
    `loan_id`         INT           NOT NULL,
    `organization_id` INT           NOT NULL,
    `employee_id`     INT           NOT NULL,
    `payrun_id`       INT           DEFAULT NULL  COMMENT 'Populated when deducted via payroll',
    `amount`          DECIMAL(15,2) NOT NULL       COMMENT 'Amount paid in this instalment',
    `balance_after`   DECIMAL(15,2) NOT NULL       COMMENT 'Remaining balance after this repayment',
    `repayment_date`  DATE          NOT NULL,
    `method`          ENUM('payroll_deduction', 'manual') NOT NULL DEFAULT 'payroll_deduction',
    `notes`           TEXT          DEFAULT NULL,
    `recorded_by`     INT           DEFAULT NULL   COMMENT 'User who recorded this repayment',
    `created_at`      TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
    PRIMARY KEY (`id`),
    KEY `idx_repayments_loan`   (`loan_id`),
    KEY `idx_repayments_org`    (`organization_id`),
    KEY `idx_repayments_emp`    (`employee_id`),
    KEY `idx_repayments_payrun` (`payrun_id`),
 
    CONSTRAINT `lr_loan_fk`
        FOREIGN KEY (`loan_id`)         REFERENCES `loans`         (`id`) ON DELETE CASCADE,
    CONSTRAINT `lr_org_fk`
        FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
    CONSTRAINT `lr_emp_fk`
        FOREIGN KEY (`employee_id`)     REFERENCES `employees`     (`id`) ON DELETE CASCADE,
    CONSTRAINT `lr_payrun_fk`
        FOREIGN KEY (`payrun_id`)       REFERENCES `payruns`       (`id`) ON DELETE SET NULL,
    CONSTRAINT `lr_recorded_by_fk`
        FOREIGN KEY (`recorded_by`)     REFERENCES `users`         (`id`) ON DELETE SET NULL
 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 3. CREATE loan_appeals — employee appeal after any rejection
-- =============================================================================
 
CREATE TABLE IF NOT EXISTS `loan_appeals` (
  `id`                  INT           NOT NULL AUTO_INCREMENT,
  `loan_id`             INT           NOT NULL,
  `organization_id`     INT           NOT NULL,
  `employee_id`         INT           NOT NULL     COMMENT 'The employee filing the appeal',
 
  -- Appeal submission
  `appeal_reason`       TEXT          NOT NULL     COMMENT 'Employee explanation for the appeal',
  `supporting_docs`     VARCHAR(500)  DEFAULT NULL COMMENT 'Path to uploaded supporting documents',
 
  -- HR decision
  `reviewed_by`         INT           DEFAULT NULL COMMENT 'HR Manager who reviewed the appeal',
  `reviewed_at`         TIMESTAMP     NULL DEFAULT NULL,
  `hr_decision`         ENUM('upheld','overturned') DEFAULT NULL
                        COMMENT 'upheld = rejection stands; overturned = loan re-enters approval flow',
  `hr_decision_reason`  TEXT          DEFAULT NULL COMMENT 'HR notes on their decision',
 
  `status`              ENUM('pending','upheld','overturned') NOT NULL DEFAULT 'pending',
 
  `created_at`          TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
  PRIMARY KEY (`id`),
 
  -- Only one active appeal per loan at a time
  UNIQUE KEY `unique_active_appeal` (`loan_id`, `status`),
 
  KEY `idx_appeals_loan`     (`loan_id`),
  KEY `idx_appeals_org`      (`organization_id`),
  KEY `idx_appeals_employee` (`employee_id`),
  KEY `idx_appeals_reviewer` (`reviewed_by`),
  KEY `idx_appeals_status`   (`status`),
 
  CONSTRAINT `la_loan_fk`
    FOREIGN KEY (`loan_id`)         REFERENCES `loans`         (`id`) ON DELETE CASCADE,
  CONSTRAINT `la_org_fk`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `la_employee_fk`
    FOREIGN KEY (`employee_id`)     REFERENCES `employees`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `la_reviewer_fk`
    FOREIGN KEY (`reviewed_by`)     REFERENCES `users`         (`id`) ON DELETE SET NULL
 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table payhub.notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `organization_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` enum('salary','tax','leave','loan','advance','refund','per_diem','other') NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `organization_id` (`organization_id`),
  KEY `idx_org_read` (`organization_id`, `is_read`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table payhub.organizations
CREATE TABLE IF NOT EXISTS `organization_configs` (
  `id`                INT           NOT NULL AUTO_INCREMENT,
  `organization_id`   INT           NOT NULL,
  `config_type`       ENUM('tax','deduction','loan','benefit','per_diem','advance','refund','leave','attendance','reimbursement') NOT NULL,
  `name`              VARCHAR(100)  NOT NULL,
  `percentage`        DECIMAL(5,2)  DEFAULT NULL,
  `fixed_amount`      DECIMAL(15,2) DEFAULT NULL,
  `finance_threshold` DECIMAL(15,2) DEFAULT NULL
    COMMENT 'For config_type=loan: loans above this value require Finance Manager approval. NULL = no Finance step.',
  `value_text`        VARCHAR(100)  DEFAULT NULL,
  `settings`          JSON          DEFAULT NULL,
  `status`            ENUM('pending','approved','rejected','deleted_pending') NOT NULL DEFAULT 'approved',
  `created_by`        INT           NULL,
  `approved_by`       INT           NULL,
  `rejected_by`       INT           NULL,
  `approved_at`       TIMESTAMP     NULL,
  `rejected_at`       TIMESTAMP     NULL,
  `rejection_reason`  TEXT          NULL,
  `is_active`         TINYINT(1)    DEFAULT '1',
  `created_at`        TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_config` (`organization_id`, `config_type`, `name`),
 
  CONSTRAINT `organization_configs_ibfk_1`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `organization_configs_created_by_fk`
    FOREIGN KEY (`created_by`)      REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `organization_configs_approved_by_fk`
    FOREIGN KEY (`approved_by`)     REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `organization_configs_rejected_by_fk`
    FOREIGN KEY (`rejected_by`)     REFERENCES `users` (`id`) ON DELETE SET NULL,

  CONSTRAINT `chk_lateness_deduction_policy`
    CHECK (`name` <> 'Lateness Deduction Policy'
      OR `value_text` IN ('no_deduction','per_minute','daily_rate','leave_balance'))
 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- CREATE TABLE IF NOT EXISTS `organization_configs` (
--   `id`               INT          NOT NULL AUTO_INCREMENT,
--   `organization_id`  INT          NOT NULL,
--   `config_type`      ENUM('tax','deduction','loan','benefit','per_diem','advance','refund','leave') NOT NULL,
--   `name`             VARCHAR(100) NOT NULL,
--   `percentage`       DECIMAL(5,2)  DEFAULT NULL,
--   `fixed_amount`     DECIMAL(15,2) DEFAULT NULL,
--   `value_text`       VARCHAR(100)  DEFAULT NULL  COMMENT 'Scalar text value for settings that are not numeric (e.g. "monthly", "true", "01-01")',
--   `settings`         JSON          DEFAULT NULL  COMMENT 'Structured / array values (e.g. approval workflow roles)',
--   `status`           ENUM('pending','approved','rejected','deleted_pending') NOT NULL DEFAULT 'approved',
--   `created_by`       INT NULL,
--   `approved_by`      INT NULL,
--   `rejected_by`      INT NULL,
--   `approved_at`      TIMESTAMP NULL,
--   `rejected_at`      TIMESTAMP NULL,
--   `rejection_reason` TEXT NULL,
--   `is_active`        TINYINT(1)   DEFAULT '1',
--   `created_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
--   `updated_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

--   PRIMARY KEY (`id`),
--   UNIQUE KEY `unique_config` (`organization_id`,`config_type`,`name`),

--   CONSTRAINT `organization_configs_ibfk_1`
--     FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
--     ON DELETE CASCADE,

--   CONSTRAINT `organization_configs_created_by_fk`
--     FOREIGN KEY (`created_by`)  REFERENCES `users`(`id`)
--     ON DELETE SET NULL,

--   CONSTRAINT `organization_configs_approved_by_fk`
--     FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`)
--     ON DELETE SET NULL,

--   CONSTRAINT `organization_configs_rejected_by_fk`
--     FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`)
--     ON DELETE SET NULL

-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Data exporting was unselected.

-- Dumping structure for table payhub.payruns
CREATE TABLE IF NOT EXISTS `payruns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `payrun_name` varchar(100) NOT NULL,
  `pay_period_start` date NOT NULL,
  `pay_period_end` date NOT NULL,
  `pay_frequency` enum('weekly','bi-weekly','monthly') DEFAULT 'monthly',
  `payrun_type` enum('regular','off_cycle') NOT NULL DEFAULT 'regular' COMMENT 'off_cycle = an adjustment run created to pay overtime that landed in an already-locked period',
  `parent_payrun_id` int DEFAULT NULL COMMENT 'For off_cycle runs: the original (finalized) payrun this adjustment belongs to',
  `status` enum('draft','reviewed','finalized') DEFAULT 'draft',
  `total_gross_pay` decimal(15,2) DEFAULT '0.00',
  `total_deductions` decimal(15,2) DEFAULT '0.00',
  `total_net_pay` decimal(15,2) DEFAULT '0.00',
  `employee_count` int DEFAULT '0',
  `created_by` int NOT NULL,
  `reviewed_by` int DEFAULT NULL,
  `finalized_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `finalized_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `organization_id` (`organization_id`),
  KEY `created_by` (`created_by`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `finalized_by` (`finalized_by`),
  KEY `deleted_by` (`deleted_by`),
  KEY `idx_payrun_period` (`pay_period_start`,`pay_period_end`),
  KEY `idx_payrun_status` (`status`),
  KEY `idx_payrun_deleted_at` (`deleted_at`),
  KEY `idx_payrun_type` (`payrun_type`),
  KEY `idx_payrun_parent` (`parent_payrun_id`),
  CONSTRAINT `payruns_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payruns_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payruns_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payruns_ibfk_4` FOREIGN KEY (`finalized_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payruns_ibfk_5` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payruns_parent_fk` FOREIGN KEY (`parent_payrun_id`) REFERENCES `payruns` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Data exporting was unselected.

-- Dumping structure for table payhub.payrun_deductions
CREATE TABLE IF NOT EXISTS `payrun_deductions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payrun_detail_id` int NOT NULL,
  `config_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payrun_detail_id` (`payrun_detail_id`),
  KEY `config_id` (`config_id`),
  CONSTRAINT `payrun_deductions_ibfk_1` FOREIGN KEY (`payrun_detail_id`) REFERENCES `payrun_details` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payrun_deductions_ibfk_2` FOREIGN KEY (`config_id`) REFERENCES `organization_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table payhub.payrun_details
CREATE TABLE IF NOT EXISTS `payrun_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payrun_id` int NOT NULL,
  `organization_id` int NOT NULL,
  `employee_id` int NOT NULL,

  `basic_salary` decimal(15,2) NOT NULL,

  `overtime_amount` decimal(15,2) DEFAULT '0.00',
  `bonus_amount` decimal(15,2) DEFAULT '0.00',
  `commission_amount` decimal(15,2) DEFAULT '0.00',

  `taxable_reimbursement` decimal(15,2) NOT NULL DEFAULT '0.00',
  `nontaxable_reimbursement` decimal(15,2) NOT NULL DEFAULT '0.00',
  `reimbursement_metadata` json DEFAULT NULL,

  `nssf` decimal(15,2) DEFAULT '0.00',
  `shif` decimal(15,2) DEFAULT '0.00',
  `housing_levy` decimal(15,2) DEFAULT '0.00',

  `taxable_income` decimal(15,2) DEFAULT '0.00',
  `tax_before_relief` decimal(15,2) DEFAULT '0.00',
  `personal_relief` decimal(15,2) DEFAULT '0.00',
  `paye` decimal(15,2) DEFAULT '0.00',

  `gross_pay` decimal(15,2) NOT NULL,
  `total_deductions` decimal(15,2) NOT NULL,
  `net_pay` decimal(15,2) NOT NULL,

  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `unique_payrun_employee` (`payrun_id`, `employee_id`),

  KEY `employee_id` (`employee_id`),
  KEY `idx_payrundetails_org` (`organization_id`),

  CONSTRAINT `payrun_details_ibfk_1`
    FOREIGN KEY (`payrun_id`)
    REFERENCES `payruns` (`id`)
    ON DELETE CASCADE,

  CONSTRAINT `payrun_details_ibfk_2`
    FOREIGN KEY (`employee_id`)
    REFERENCES `employees` (`id`)
    ON DELETE CASCADE,

  CONSTRAINT `payrun_details_org_fk`
    FOREIGN KEY (`organization_id`)
    REFERENCES `organizations` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table payhub.p9forms
CREATE TABLE p9forms (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `organizationid` INT NOT NULL,
    `employeeid` INT NOT NULL,
    `year` INT NOT NULL,
    `p9number` VARCHAR(50) NOT NULL,
    `employee_pin` VARCHAR(11),
    `total_basic_salary` DECIMAL(15,2),
    `total_gross_pay` DECIMAL(15,2),
    `total_taxable_pay` DECIMAL(15,2),
    `total_paye` DECIMAL(15,2),
    `monthly_data` JSON,  -- Array of 12 months' breakdowns
    `pdfpath` VARCHAR(500),
    `status` ENUM('generated','sent','filed') DEFAULT 'generated',
    `generatedat` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizationid) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (employeeid) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_p9 (organizationid, employeeid, year)
);


-- Dumping structure for table payhub.per_diems
CREATE TABLE IF NOT EXISTS `per_diems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `config_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `trip_date` date NOT NULL,
  `status` enum('pending','approved','rejected','paid') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `config_id` (`config_id`),
  CONSTRAINT `per_diems_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `per_diems_ibfk_2` FOREIGN KEY (`config_id`) REFERENCES `organization_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table payhub.refunds
CREATE TABLE IF NOT EXISTS `refunds` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `config_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `refund_date` date NOT NULL,
  `status` enum('pending','approved','rejected','processed') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `config_id` (`config_id`),
  CONSTRAINT `refunds_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `refunds_ibfk_2` FOREIGN KEY (`config_id`) REFERENCES `organization_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payslips` (
  `id`                INT  NOT NULL AUTO_INCREMENT,
  `organization_id`   INT  NOT NULL,
  `payrun_id`         INT  NOT NULL,
  `payrun_detail_id`  INT  NOT NULL,
  `employee_id`       INT  NOT NULL,
  `payslip_number`    VARCHAR(50)  NOT NULL,
  `status`            ENUM('generated','sent','acknowledged') DEFAULT 'generated',
  `generated_at`      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at`           TIMESTAMP NULL DEFAULT NULL,
  `pdf_path`          VARCHAR(500)  DEFAULT NULL  COMMENT 'Server path to stored PDF',
  `metadata`          JSON DEFAULT NULL COMMENT 'e.g. {"type":"off_cycle_adjustment","original_payrun_id":12,"overtime_approval_id":45}',
 
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_payslip` (`payrun_id`, `employee_id`),
  KEY `payslips_org`    (`organization_id`),
  KEY `payslips_detail` (`payrun_detail_id`),
 
  CONSTRAINT `payslips_org_fk`    FOREIGN KEY (`organization_id`)  REFERENCES `organizations`  (`id`) ON DELETE CASCADE,
  CONSTRAINT `payslips_run_fk`    FOREIGN KEY (`payrun_id`)        REFERENCES `payruns`        (`id`) ON DELETE CASCADE,
  CONSTRAINT `payslips_detail_fk` FOREIGN KEY (`payrun_detail_id`) REFERENCES `payrun_details` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payslips_emp_fk`    FOREIGN KEY (`employee_id`)      REFERENCES `employees`      (`id`) ON DELETE CASCADE
 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- -----------------------------------------------------------------------------
-- 4. statutory_remittances
--    Tracks remittance of PAYE / NSSF / SHIF to KRA and other bodies.
--    Due by 9th of the following month.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `statutory_remittances` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `organization_id` INT           NOT NULL,
  `payrun_id`       INT           NOT NULL,
  `remittance_type` ENUM('PAYE','NSSF','SHIF','Housing_Levy','Other') NOT NULL,
  `amount`          DECIMAL(15,2) NOT NULL,
  `due_date`        DATE          NOT NULL,
  `remitted_at`     DATE          DEFAULT NULL,
  `reference_number` VARCHAR(100) DEFAULT NULL  COMMENT 'KRA / NSSF / SHIF payment reference',
  `status`          ENUM('pending','remitted','overdue') DEFAULT 'pending',
  `remitted_by`     INT           DEFAULT NULL,
  `created_at`      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `sr_org_run` (`organization_id`, `payrun_id`),

  CONSTRAINT `sr_org_fk`    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sr_run_fk`    FOREIGN KEY (`payrun_id`)       REFERENCES `payruns`       (`id`) ON DELETE CASCADE,
  CONSTRAINT `sr_user_fk`   FOREIGN KEY (`remitted_by`)     REFERENCES `users`         (`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Data exporting was unselected.

-- Dumping structure for table payhub.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `user_type` enum(
    'super_admin',
    'admin',
    'hr_manager',
    'hr_officer',
    'payroll_manager',
    'payroll_officer',
    'finance_manager',
    'auditor',
    'department_manager',
    'employee'
  ) DEFAULT 'employee',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_org_username` (`organization_id`, `username`),
  UNIQUE KEY `email` (`email`),
  KEY `organization_id` (`organization_id`),
  CONSTRAINT `users_ibfk_1`
    FOREIGN KEY (`organization_id`)
    REFERENCES `organizations` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id`                     INT           NOT NULL AUTO_INCREMENT,
  `user_id`                INT           NOT NULL  COMMENT 'FK to users(id)',
  `employee_id`            INT           DEFAULT NULL COMMENT 'FK to employees(id); NULL for non-employee users',
  `session_token`          VARCHAR(255)  DEFAULT NULL COMMENT 'Hashed session/JWT identifier for server-side invalidation',
  `login_at`               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `logout_at`              TIMESTAMP     NULL DEFAULT NULL,
  `ip_address`             VARCHAR(45)   DEFAULT NULL COMMENT 'IPv4 or IPv6; VARCHAR(45) covers full IPv6',
  `device_info`            VARCHAR(500)  DEFAULT NULL COMMENT 'User-agent string or parsed device summary',
  `failed_login_attempts`  JSON          DEFAULT NULL COMMENT 'Array of failed attempt objects: [{attempted_at, email, ip_address, user_agent, reason}]',
  `is_active`              TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '0 = session forcefully invalidated or logged out',
  `created_at`             TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_us_user_id`     (`user_id`),
  KEY `idx_us_employee_id` (`employee_id`),
  KEY `idx_us_login_at`    (`login_at`),
  KEY `idx_us_is_active`   (`is_active`),

  CONSTRAINT `us_user_fk`
    FOREIGN KEY (`user_id`)     REFERENCES `users`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `us_employee_fk`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE subscription_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE, -- starter, professional, enterprise
  name VARCHAR(100) NOT NULL,
  billing_cycle ENUM('monthly','annual') DEFAULT 'monthly',
  base_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  price_per_employee DECIMAL(15,2) DEFAULT NULL,
  trial_days INT DEFAULT 0,
  requires_card TINYINT(1) DEFAULT 0,
  max_employees INT DEFAULT NULL,
  features JSON DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE organization_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  plan_id INT NOT NULL,
  status ENUM('trialing','pending_payment','active','past_due','suspended','cancelled','expired') DEFAULT 'trialing',
  starts_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
  trial_ends_at TIMESTAMP NULL,
  current_period_starts_at TIMESTAMP NULL,
  current_period_ends_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  -- Card payment fields
  payment_method_token VARCHAR(255) DEFAULT NULL,
  card_brand VARCHAR(30) DEFAULT NULL,
  card_last4 VARCHAR(4) DEFAULT NULL,
  card_exp_month VARCHAR(2) DEFAULT NULL,
  card_exp_year VARCHAR(4) DEFAULT NULL,
  -- M-Pesa payment fields
  checkout_request_id VARCHAR(100) DEFAULT NULL,
  mpesa_phone VARCHAR(20) DEFAULT NULL,
  mpesa_receipt_number VARCHAR(50) DEFAULT NULL,
  employee_limit INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_org_sub_org
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_org_sub_plan
    FOREIGN KEY (plan_id)
    REFERENCES subscription_plans(id)
    ON DELETE RESTRICT
);

CREATE TABLE payment_transactions (
  id                   INT           NOT NULL AUTO_INCREMENT,
  organization_id      INT           NOT NULL,
  subscription_id      INT           DEFAULT NULL,  -- NULL if not yet linked (pre-activation)

  -- Provider identification
  provider             ENUM('mpesa','stripe','paypal','bank_transfer','manual') NOT NULL,
  transaction_type     ENUM('subscription','upgrade','downgrade','renewal','refund','manual_adjustment') NOT NULL DEFAULT 'subscription',

  -- Provider-side references (generic naming, filled per provider)
  provider_reference   VARCHAR(100)  DEFAULT NULL  COMMENT 'mpesa_receipt_number, stripe charge_id, etc.',
  provider_request_id  VARCHAR(100)  DEFAULT NULL  COMMENT 'checkout_request_id, stripe payment_intent_id, etc.',

  -- Amount
  amount               DECIMAL(15,2) NOT NULL,
  currency             VARCHAR(10)   NOT NULL DEFAULT 'KES',

  -- Status lifecycle
  status               ENUM('initiated','pending','completed','failed','refunded','disputed') NOT NULL DEFAULT 'initiated',
  failure_reason       VARCHAR(255)  DEFAULT NULL,

  -- M-Pesa specific (nullable, only filled for mpesa)
  mpesa_phone          VARCHAR(20)   DEFAULT NULL,
  mpesa_result_code    VARCHAR(10)   DEFAULT NULL,
  mpesa_result_desc    VARCHAR(255)  DEFAULT NULL,

  -- Raw payload for audit/debugging
  raw_request          JSON          DEFAULT NULL  COMMENT 'Outgoing request payload (STK push body, etc.)',
  raw_callback         JSON          DEFAULT NULL  COMMENT 'Raw provider callback/webhook payload',

  -- Who triggered it
  initiated_by_user_id INT           DEFAULT NULL,

  -- Timestamps
  initiated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at         TIMESTAMP     NULL DEFAULT NULL,
  created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_pt_org`         (`organization_id`),
  KEY `idx_pt_sub`         (`subscription_id`),
  KEY `idx_pt_provider_ref`(`provider_reference`),
  KEY `idx_pt_request_id`  (`provider_request_id`),
  KEY `idx_pt_status`      (`status`),

  CONSTRAINT `fk_pt_org`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pt_sub`
    FOREIGN KEY (`subscription_id`) REFERENCES `organization_subscriptions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pt_user`
    FOREIGN KEY (`initiated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create pending_tokens table
--
-- Used by SubscriptionController::mpesaCallback() to store the JWT that was
-- issued after a successful M-Pesa payment, so the polling endpoint
-- (paymentStatus) can hand it to the frontend.
--
-- Each row is a one-time-use token keyed by checkout_request_id.
-- Rows expire after 10 minutes; a background job or MySQL event can trim them,
-- but the application also deletes each row immediately after reading it.
-- ─────────────────────────────────────────────────────────────────────────────
 
CREATE TABLE IF NOT EXISTS `pending_tokens` (
  `checkout_request_id` VARCHAR(100)  NOT NULL,
  `token`               TEXT          NOT NULL  COMMENT 'JWT access_token',
  `expires_at`          DATETIME      NOT NULL,
  `created_at`          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
 
  PRIMARY KEY (`checkout_request_id`),
  KEY `idx_pt_expires` (`expires_at`)
 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Short-lived one-time JWT tokens bridging mpesaCallback → paymentStatus polling.';

  CREATE TABLE IF NOT EXISTS `employee_attendance_punches` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `organization_id`  INT NOT NULL,
  `employee_id`      INT NOT NULL,
  `attendance_date`  DATE NOT NULL,
  `punch_type`       ENUM('check_in','check_out') NOT NULL,
  `punch_time`       DATETIME NOT NULL,
  `source`           ENUM('biometric','manual','api') NOT NULL DEFAULT 'manual',
  `device_id`        VARCHAR(100) DEFAULT NULL,
  `remarks`          VARCHAR(255) DEFAULT NULL,
  `created_by`       INT DEFAULT NULL,
  `status`           ENUM('pending','approved','rejected','deleted_pending') NOT NULL DEFAULT 'approved',
  `approved_by`      INT DEFAULT NULL,
  `rejected_by`      INT DEFAULT NULL,
  `approved_at`      TIMESTAMP NULL,
  `rejected_at`      TIMESTAMP NULL,
  `rejection_reason` TEXT NULL,
  `is_active`        TINYINT(1) DEFAULT '1',
  `created_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_attendance_punches_org_emp_date` (`organization_id`, `employee_id`, `attendance_date`),
  KEY `idx_attendance_punches_emp_time` (`employee_id`, `punch_time`),

  CONSTRAINT `employee_attendance_punches_ibfk_1`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_attendance_punches_ibfk_2`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_attendance_punches_created_by_fk`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employee_attendance_punches_approved_by_fk`
    FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employee_attendance_punches_rejected_by_fk`
    FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `employee_attendance_days` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `organization_id`    INT NOT NULL,
  `employee_id`        INT NOT NULL,
  `attendance_date`    DATE NOT NULL,
  `check_in_time`      DATETIME DEFAULT NULL,
  `check_out_time`     DATETIME DEFAULT NULL,
  `worked_minutes`     INT NOT NULL DEFAULT 0,
  `scheduled_minutes`  INT NOT NULL DEFAULT 0,
  `overtime_minutes`   INT NOT NULL DEFAULT 0,
  `late_minutes`       INT NOT NULL DEFAULT 0,
  `early_leave_minutes` INT NOT NULL DEFAULT 0,
  `is_public_holiday`  TINYINT(1) NOT NULL DEFAULT 0,
  `is_weekend`         TINYINT(1) NOT NULL DEFAULT 0,
  `status`             ENUM('present','absent','partial','holiday','leave') NOT NULL DEFAULT 'absent',
  `approval_status`    ENUM('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required',
  `salary_included`    TINYINT(1) NOT NULL DEFAULT 0,
  `source_summary`     JSON DEFAULT NULL,
  `created_by`         INT DEFAULT NULL,
  `approved_by`        INT DEFAULT NULL,
  `approved_at`        TIMESTAMP NULL,
  `is_active`          TINYINT(1) DEFAULT '1',
  `created_at`         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_attendance_day` (`organization_id`, `employee_id`, `attendance_date`),
  KEY `idx_attendance_days_emp_date` (`employee_id`, `attendance_date`),
  KEY `idx_attendance_days_status` (`organization_id`, `attendance_date`, `status`),

  CONSTRAINT `employee_attendance_days_ibfk_1`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_attendance_days_ibfk_2`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_attendance_days_created_by_fk`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employee_attendance_days_approved_by_fk`
    FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `attendance_adjustments` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `organization_id`    INT NOT NULL,
  `attendance_day_id`  INT NOT NULL,
  `adjustment_type`    ENUM('edit','override','late_entry','missing_checkout','delete') NOT NULL,
  `old_value`          JSON DEFAULT NULL,
  `new_value`          JSON DEFAULT NULL,
  `reason`             TEXT NOT NULL,
  `created_by`         INT DEFAULT NULL,
  `approved_by`        INT DEFAULT NULL,
  `approved_at`        TIMESTAMP NULL,
  `status`             ENUM('pending','approved','rejected','deleted_pending') NOT NULL DEFAULT 'approved',
  `rejection_reason`   TEXT NULL,
  `is_active`          TINYINT(1) DEFAULT '1',
  `created_at`         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_attendance_adjustments_day` (`attendance_day_id`),
  KEY `idx_attendance_adjustments_org` (`organization_id`, `attendance_day_id`),

  CONSTRAINT `attendance_adjustments_ibfk_1`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_adjustments_ibfk_2`
    FOREIGN KEY (`attendance_day_id`) REFERENCES `employee_attendance_days` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_adjustments_created_by_fk`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `attendance_adjustments_approved_by_fk`
    FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `overtime_approvals` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `organization_id`    INT NOT NULL,
  `attendance_day_id`  INT NOT NULL,
  `employee_id`        INT NOT NULL,
  `overtime_minutes`  INT NOT NULL DEFAULT 0,
  `overtime_rate`     DECIMAL(10,2) DEFAULT NULL,
  `overtime_amount`   DECIMAL(15,2) DEFAULT NULL,
  `requested_by`      INT DEFAULT NULL,
  `approved_by`       INT DEFAULT NULL,
  `rejected_by`       INT DEFAULT NULL,
  `status`            ENUM('pending','approved','rejected','deleted_pending') NOT NULL DEFAULT 'pending',
  `approval_notes`    TEXT DEFAULT NULL,
  `rejection_reason`  TEXT DEFAULT NULL,
  `approved_at`       TIMESTAMP NULL,
  `rejected_at`       TIMESTAMP NULL,
  `salary_included`   TINYINT(1) NOT NULL DEFAULT 0,
  `finalized_period_payrun_id` INT DEFAULT NULL COMMENT 'Set by approve() when the attendance date falls inside a reviewed/finalized payrun — awaiting officer resolution',
  `resolution`        ENUM('off_cycle','carry_forward') DEFAULT NULL COMMENT 'Officer choice for how a locked-period overtime is paid (see resolve())',
  `resolved_payrun_id` INT DEFAULT NULL COMMENT 'The off-cycle run or next regular payrun that actually paid this overtime',
  `resolved_by`       INT DEFAULT NULL,
  `resolved_at`       TIMESTAMP NULL DEFAULT NULL,
  `is_active`         TINYINT(1) DEFAULT '1',
  `created_at`        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_overtime_per_day` (`organization_id`, `employee_id`, `attendance_day_id`),
  KEY `idx_overtime_approvals_emp_status` (`employee_id`, `status`),
  KEY `idx_overtime_approvals_day` (`attendance_day_id`),
  KEY `idx_overtime_finalized_period` (`finalized_period_payrun_id`),
  KEY `idx_overtime_resolved_payrun` (`resolved_payrun_id`),
 
  CONSTRAINT `overtime_approvals_ibfk_1`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `overtime_approvals_ibfk_2`
    FOREIGN KEY (`attendance_day_id`) REFERENCES `employee_attendance_days` (`id`) ON DELETE CASCADE,
  CONSTRAINT `overtime_approvals_ibfk_3`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `overtime_approvals_requested_by_fk`
    FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `overtime_finalized_period_fk`
    FOREIGN KEY (`finalized_period_payrun_id`) REFERENCES `payruns` (`id`) ON DELETE SET NULL,
  CONSTRAINT `overtime_resolved_payrun_fk`
    FOREIGN KEY (`resolved_payrun_id`) REFERENCES `payruns` (`id`) ON DELETE SET NULL,
  CONSTRAINT `overtime_resolved_by_fk`
    FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- attendance_deductions
--   One row per employee_attendance_days record where lateness/early-leave
--   crosses the grace period. Written in real time by
--   AttendanceService::recomputeDay(). Cash-type rows (per_minute/daily_rate)
--   stay 'pending' until a payrun pulls them in; leave_balance rows are
--   applied immediately since they touch leave_balances, not payroll cash.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance_deductions` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `organization_id`     INT NOT NULL,
  `employee_id`         INT NOT NULL,
  `attendance_day_id`   INT NOT NULL,
  `deduction_date`      DATE NOT NULL COMMENT 'Copy of attendance_date, avoids a join for payrun-period lookups',

  `late_minutes`        INT NOT NULL DEFAULT 0,
  `early_leave_minutes` INT NOT NULL DEFAULT 0,
  `billable_minutes`    INT NOT NULL DEFAULT 0 COMMENT 'Minutes actually attracting a deduction, after grace period',

  `policy_applied`      ENUM('none','per_minute','daily_rate','leave_balance') NOT NULL DEFAULT 'none'
                         COMMENT 'Snapshot of the org policy active at calculation time',

  `cash_amount`         DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Set only when policy_applied = per_minute or daily_rate',

  `leave_type_id`       INT DEFAULT NULL COMMENT 'Set only when policy_applied = leave_balance',
  `leave_days_deducted` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Set only when policy_applied = leave_balance',

  `rate_snapshot`       JSON DEFAULT NULL
                        COMMENT 'daily_rate, hourly_rate, minute_rate, grace_minutes, working_days_in_month used at calc time — kept for audit even if salary/policy changes later',

  `status`              ENUM('pending','applied','waived','reversed') NOT NULL DEFAULT 'pending'
                        COMMENT 'pending = cash computed, not yet pulled into a payrun. applied = leave already debited OR cash pulled into payrun_deductions. waived = HR excused it. reversed = a later attendance correction invalidated an already-applied row, needs manual reconciliation',

  `payrun_detail_id`    INT DEFAULT NULL COMMENT 'Set once a per_minute/daily_rate amount is pulled into a specific payrun',

  `waived_by`           INT DEFAULT NULL,
  `waived_reason`       TEXT DEFAULT NULL,
  `created_by`          INT DEFAULT NULL,
  `is_active`           TINYINT(1) DEFAULT '1',
  `created_at`          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_attendance_deduction_per_day` (`organization_id`, `attendance_day_id`),
  KEY `idx_attendance_deductions_emp_date` (`employee_id`, `deduction_date`),
  KEY `idx_attendance_deductions_status`   (`organization_id`, `status`),
  KEY `idx_attendance_deductions_payrun`   (`payrun_detail_id`),

  CONSTRAINT `attendance_deductions_org_fk`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_deductions_emp_fk`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_deductions_day_fk`
    FOREIGN KEY (`attendance_day_id`) REFERENCES `employee_attendance_days` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_deductions_leave_type_fk`
    FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE SET NULL,
  CONSTRAINT `attendance_deductions_payrun_detail_fk`
    FOREIGN KEY (`payrun_detail_id`) REFERENCES `payrun_details` (`id`) ON DELETE SET NULL,
  CONSTRAINT `attendance_deductions_waived_by_fk`
    FOREIGN KEY (`waived_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `attendance_deductions_created_by_fk`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE public_holidays_master (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    country_code    CHAR(2) NOT NULL,
    holiday_date    DATE NOT NULL,
    name            VARCHAR(150) NOT NULL,
    type            ENUM('national','regional','religious','bank','observance') NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    source          ENUM('api_mansa','api_abstract','manual') NOT NULL DEFAULT 'manual',
    source_id       VARCHAR(100) NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_country_date_name (country_code, holiday_date, name),
    INDEX idx_country_year (country_code, holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE org_public_holidays (
    id                BIGINT PRIMARY KEY AUTO_INCREMENT,
    organization_id   INT NOT NULL,
    country_code      CHAR(2) NOT NULL,          -- for which country’s master list
    master_holiday_id BIGINT NULL,               -- link to public_holidays_master.id (nullable for custom org holidays)
    holiday_date      DATE NOT NULL,
    name              VARCHAR(150) NOT NULL,
    source            ENUM('override','custom') NOT NULL,
    is_paid           TINYINT(1) NOT NULL DEFAULT 1,
    is_active         TINYINT(1) NOT NULL DEFAULT 1,
    notes             TEXT NULL,
    created_by        INT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_org_date (organization_id, holiday_date, name),
    UNIQUE KEY uq_org_master_override (organization_id, master_holiday_id),
    INDEX idx_org_date (organization_id, holiday_date),

    CONSTRAINT fk_org_public_holidays_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_org_public_holidays_master
        FOREIGN KEY (master_holiday_id) REFERENCES public_holidays_master(id) ON DELETE SET NULL,
    CONSTRAINT fk_org_public_holidays_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `reimbursements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `payrun_id` int DEFAULT NULL,
  `payment_transaction_id` int DEFAULT NULL,
  `reimbursement_number` varchar(50) NOT NULL,
  `reimbursement_type` enum('expense','travel','medical','training','transport','other') NOT NULL DEFAULT 'expense',
  `payout_method` enum('payroll','banktransfer','mpesa','cash','check','wallet') NOT NULL DEFAULT 'payroll',
  `amount_requested` decimal(15,2) NOT NULL DEFAULT '0.00',
  `amount_approved` decimal(15,2) NOT NULL DEFAULT '0.00',
  `amount_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(10) NOT NULL DEFAULT 'KES',
  `request_date` date NOT NULL,
  `expense_date` date DEFAULT NULL,
  `approver_id` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `status` enum('draft','pending','managerapproved','hrapproved','financeapproved','rejected','scheduled','paid','partpaid','cancelled','failed','reversed') NOT NULL DEFAULT 'pending',
  `description` text,
  `rejection_reason` text,
  `payment_reference` varchar(100) DEFAULT NULL,
  `external_reference` varchar(100) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `policy_config_id` int DEFAULT NULL,
  `original_currency` varchar(10) NOT NULL DEFAULT 'KES',
  `currency_rate` decimal(15,6) NOT NULL DEFAULT '1.000000',
  `scheduled_payment_date` date DEFAULT NULL,
  `policy_validated` tinyint(1) NOT NULL DEFAULT '0',
  `policy_validation_errors` json DEFAULT NULL,
  `receipt_count` int NOT NULL DEFAULT '0',
  `receipts_validated` tinyint(1) NOT NULL DEFAULT '0',
  `is_taxable` tinyint(1) NOT NULL DEFAULT '0',
  `payslip_inclusion` enum('current','next','none') NOT NULL DEFAULT 'none',
  `partial_approval_amount` decimal(15,2) DEFAULT NULL,
  `is_disputed` tinyint(1) NOT NULL DEFAULT '0',
  `disputed_reason` text,
  `disputed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniqreimbursenumber` (`organization_id`,`reimbursement_number`),
  KEY `idxreimborg` (`organization_id`),
  KEY `idxreimbeemp` (`employee_id`),
  KEY `idxreimbstatus` (`status`),
  KEY `idxreimbpayrun` (`payrun_id`),
  KEY `idxreimbpaymenttxn` (`payment_transaction_id`),
  KEY `reimbapproverfk` (`approver_id`),
  KEY `reimbcreatedbyfk` (`created_by`),
  KEY `reimbupdatedbyfk` (`updated_by`),
  KEY `reimbpolicyfk` (`policy_config_id`),
  CONSTRAINT `reimbapproverfk` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reimbcreatedbyfk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reimbempfk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reimborgfk` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reimbpaymenttxnfk` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reimbpayrunfk` FOREIGN KEY (`payrun_id`) REFERENCES `payruns` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reimbpolicyfk` FOREIGN KEY (`policy_config_id`) REFERENCES `organization_configs` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reimbupdatedbyfk` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `reimbursementitems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reimbursement_id` int NOT NULL,
  `expense_category` varchar(100) NOT NULL,
  `expense_item` varchar(150) DEFAULT NULL,
  `receipt_number` varchar(100) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `tax_amount` decimal(15,2) DEFAULT '0.00',
  `currency` varchar(10) NOT NULL DEFAULT 'KES',
  `expense_date` date NOT NULL,
  `vendor_name` varchar(150) DEFAULT NULL,
  `notes` text,
  `receipt_path` varchar(500) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idxreimbitemreimb` (`reimbursement_id`),
  CONSTRAINT `reimbitemreimbfk` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

-- Optional: auto-purge expired rows every hour (requires MySQL Event Scheduler)
-- SET GLOBAL event_scheduler = ON;
-- CREATE EVENT IF NOT EXISTS purge_expired_pending_tokens
--   ON SCHEDULE EVERY 1 HOUR
--   DO DELETE FROM pending_tokens WHERE expires_at < NOW();


-- Data exporting was unselected.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;


-- Insert queries for data when company starts

-- ============================================================
-- Leave Configuration INSERT queries
-- organization_id : 221
-- config_type     : leave
-- ============================================================

INSERT INTO `organization_configs`
  (`organization_id`, `config_type`, `name`, `percentage`, `fixed_amount`, `value_text`, `settings`, `status`, `is_active`)
VALUES

-- ── Annual Leave ─────────────────────────────────────────────
-- Total days an employee is entitled to per leave year.
(221, 'leave', 'Annual Leave Allowance',
  NULL, 21.00, NULL, NULL,
  'approved', 1),

-- ── Accrual Rules ────────────────────────────────────────────
-- Number of days accrued each frequency cycle (e.g. 2 days/month).
(221, 'leave', 'Accrual Rate (Days Per Cycle)',
  NULL, 2.00, NULL, NULL,
  'approved', 1),

-- How often accrual is calculated: daily | weekly | monthly.
(221, 'leave', 'Accrual Frequency',
  NULL, NULL, 'monthly', NULL,
  'approved', 1),

-- Maximum days that can be carried forward into the next leave year.
(221, 'leave', 'Carry-Forward Limit (Days)',
  NULL, 10.00, NULL, NULL,
  'approved', 1),

-- Whether unused leave days can be cashed out: true | false.
(221, 'leave', 'Encashment Option',
  NULL, NULL, 'false', NULL,
  'approved', 1),

-- ── Requests & Approvals ─────────────────────────────────────
-- Allow employees to request days beyond their current balance: true | false.
(221, 'leave', 'Allow Extra Days Request',
  NULL, NULL, 'false', NULL,
  'approved', 1),

-- How many days in the past an employee can back-date a leave request.
(221, 'leave', 'Past Application Limit (Days)',
  NULL, 7.00, NULL, NULL,
  'approved', 1),

-- How many days into the future an employee can apply for leave in advance.
(221, 'leave', 'Future Application Limit (Days)',
  NULL, 90.00, NULL, NULL,
  'approved', 1),

-- Ordered list of roles that must approve a leave request.
-- Supported role values: manager | department_manager | hr_manager | hr_officer | auto
(221, 'leave', 'Approval Workflow',
  NULL, NULL, NULL,
  JSON_ARRAY('manager', 'hr_manager'),
  'approved', 1),

-- ── Leave Year ───────────────────────────────────────────────
-- The date (MM-DD) on which the leave year resets each year.
-- Affects carry-over calculations and accrual cycle restarts.
(221, 'leave', 'Leave Year Start',
  NULL, NULL, '01-01', NULL,
  'approved', 1),

-- ── Duration Calculation ─────────────────────────────────────
-- When true, Saturday and Sunday are excluded from leave day counts: true | false.
(221, 'leave', 'Exclude Weekends',
  NULL, NULL, 'true', NULL,
  'approved', 1),

-- ── Half-Day ─────────────────────────────────────────────────
-- Allow employees to apply for a morning or afternoon half-day: true | false.
(221, 'leave', 'Allow Half-Day Leave',
  NULL, NULL, 'true', NULL,
  'approved', 1),

-- ── Balance ──────────────────────────────────────────────────
-- Allow leave requests when balance is zero or negative: true | false.
(221, 'leave', 'Allow Negative Balance',
  NULL, NULL, 'false', NULL,
  'approved', 1),

-- ── Notifications ────────────────────────────────────────────
-- Send a notification to the line manager when a leave request is submitted: true | false.
(221, 'leave', 'Notify Manager on Request',
  NULL, NULL, 'true', NULL,
  'approved', 1),

-- Send a notification to the employee when their request is approved or rejected: true | false.
(221, 'leave', 'Notify Employee on Approval/Rejection',
  NULL, NULL, 'true', NULL,
  'approved', 1);\-- ============================================================
-- Lateness / Early-Leave Deduction Policy
-- organization_id : 221
-- config_type     : attendance
-- ============================================================

-- The single source of truth for which model is active.
-- value_text is one of: 'no_deduction' | 'per_minute' | 'daily_rate' | 'leave_balance'
-- settings.options lists the selectable values for the admin UI dropdown;
-- enforced at the DB level by chk_lateness_deduction_policy (see organization_configs table above).
INSERT INTO `organization_configs`
  (`organization_id`, `config_type`, `name`, `percentage`, `fixed_amount`, `value_text`, `settings`, `status`, `is_active`)
VALUES
(221, 'attendance', 'Lateness Deduction Policy',
  NULL, NULL, 'no_deduction',
  JSON_OBJECT('options', JSON_ARRAY('no_deduction', 'per_minute', 'daily_rate', 'leave_balance')),
  'approved', 1),

-- Leave type to debit when policy = leave_balance. Stored as the leave_types.code
-- (not the numeric id) so it survives leave_types being re-seeded per org.
(221, 'attendance', 'Lateness Deduction Leave Type',
  NULL, NULL, 'ANNUAL', NULL,
  'approved', 1),

-- Minute-to-leave-day conversion tiers for the leave_balance policy.
-- Read top-down, take the highest threshold the billable minutes clear.
(221, 'attendance', 'Lateness Leave Conversion Tiers',
  NULL, NULL, NULL,
  JSON_ARRAY(
    JSON_OBJECT('min_minutes', 60,  'leave_days', 0.5),
    JSON_OBJECT('min_minutes', 120, 'leave_days', 1.0)
  ),
  'approved', 1),

-- Bucket config row so cash-type deductions (per_minute / daily_rate) have
-- something to attach to in payrun_deductions (its config_id FK is NOT NULL).
(221, 'deduction', 'Lateness & Early-Leave Deduction',
  NULL, NULL, NULL, NULL,
  'approved', 1);

-- ============================================================
-- Country + Counties seed data: Kenya
-- ============================================================

INSERT INTO `countries`
  (`name`, `iso2`, `iso3`, `phone_code`, `currency_code`, `currency_symbol`, `timezone`, `is_active`)
VALUES
  ('Kenya', 'KE', 'KEN', '+254', 'KES', 'KSh', 'Africa/Nairobi', 1);

INSERT INTO `counties`
  (`country_id`, `name`, `code`, `is_active`)
VALUES
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Mombasa', '001', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kwale', '002', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kilifi', '003', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Tana River', '004', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Lamu', '005', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Taita-Taveta', '006', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Garissa', '007', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Wajir', '008', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Mandera', '009', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Marsabit', '010', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Isiolo', '011', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Meru', '012', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Tharaka-Nithi', '013', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Embu', '014', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kitui', '015', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Machakos', '016', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Makueni', '017', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Nyandarua', '018', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Nyeri', '019', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kirinyaga', '020', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Murang''a', '021', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kiambu', '022', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Turkana', '023', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'West Pokot', '024', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Samburu', '025', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Trans Nzoia', '026', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Uasin Gishu', '027', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Elgeyo-Marakwet', '028', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Nandi', '029', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Baringo', '030', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Laikipia', '031', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Nakuru', '032', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Narok', '033', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kajiado', '034', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kericho', '035', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Bomet', '036', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kakamega', '037', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Vihiga', '038', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Bungoma', '039', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Busia', '040', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Siaya', '041', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kisumu', '042', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Homa Bay', '043', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Migori', '044', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Kisii', '045', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Nyamira', '046', 1),
  ((SELECT id FROM `countries` WHERE iso2 = 'KE'), 'Nairobi City', '047', 1);

INSERT INTO `subscription_plans` (`id`, `code`, `name`, `billing_cycle`, `base_price`, `price_per_employee`, `trial_days`, `requires_card`, `max_employees`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (1, 'starter_monthly', 'Starter', 'monthly', 0.00, NULL, 20, 1, 30, '["Core payroll runs", "Payslip generation", "Single pay schedule", "Basic statutory calculations (PAYE/NSSF/NHIF or local equivalents)", "CSV employee import", "Email support"]', 1, '2026-05-14 10:32:53', '2026-05-14 10:32:53');
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `billing_cycle`, `base_price`, `price_per_employee`, `trial_days`, `requires_card`, `max_employees`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (2, 'professional_monthly', 'Professional', 'monthly', 30.00, 3.00, NULL, 1, 250, '["Everything in Starter", "Multi-schedule payrolls", "Automated tax filings/remittances", "Direct deposit or payrun funding", "Time and leave integration", "Reporting and analytics", "API access", "Priority support"]', 1, '2026-05-14 10:32:53', '2026-05-14 10:32:53');
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `billing_cycle`, `base_price`, `price_per_employee`, `trial_days`, `requires_card`, `max_employees`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (3, 'enterprise_monthly', 'Enterprise', 'monthly', 150.00, 6.00, NULL, 1, NULL, '["Everything in Professional", "SSO/SCIM", "Role-based access and audit logs", "Custom integrations and onboarding", "Higher uptime and SLAs", "Dedicated account manager", "Custom pricing", "Advanced compliance for multi-country payrolls"]', 1, '2026-05-14 10:32:53', '2026-05-14 10:32:53');
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `billing_cycle`, `base_price`, `price_per_employee`, `trial_days`, `requires_card`, `max_employees`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (4, 'starter_annual', 'Starter', 'annual', 0.00, NULL, 20, 1, 30, '["Core payroll runs", "Payslip generation", "Single pay schedule", "Basic statutory calculations (PAYE/NSSF/NHIF or local equivalents)", "CSV employee import", "Email support"]', 1, '2026-05-14 10:32:53', '2026-05-14 10:32:53');
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `billing_cycle`, `base_price`, `price_per_employee`, `trial_days`, `requires_card`, `max_employees`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (5, 'professional_annual', 'Professional', 'annual', 306.00, 30.60, NULL, 1, 250, '["Everything in Starter", "Multi-schedule payrolls", "Automated tax filings/remittances", "Direct deposit or payrun funding", "Time and leave integration", "Reporting and analytics", "API access", "Priority support"]', 1, '2026-05-14 10:32:53', '2026-05-14 10:32:53');
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `billing_cycle`, `base_price`, `price_per_employee`, `trial_days`, `requires_card`, `max_employees`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (6, 'enterprise_annual', 'Enterprise', 'annual', 1530.00, 61.20, NULL, 1, NULL, '["Everything in Professional", "SSO/SCIM", "Role-based access and audit logs", "Custom integrations and onboarding", "Higher uptime and SLAs", "Dedicated account manager", "Custom pricing", "Advanced compliance for multi-country payrolls"]', 1, '2026-05-14 10:32:53', '2026-05-14 10:32:53');
