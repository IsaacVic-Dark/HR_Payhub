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
  `phone` varchar(20) DEFAULT NULL,
  `hire_date` date NOT NULL,
  `start_date` date NOT NULL,
  `job_title` varchar(100) DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `reports_to` int DEFAULT NULL,
  `base_salary` decimal(15,2) NOT NULL,
  `bank_account_number` varchar(50) DEFAULT NULL,
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
  CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employees_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employees_ibfk_3` FOREIGN KEY (`reports_to`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employees_ibfk_4` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
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
  `action` enum('create','update','delete') NOT NULL,
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
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `config_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `interest_rate` decimal(5,2) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('pending','approved','rejected','repaid') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `config_id` (`config_id`),
  CONSTRAINT `loans_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `loans_ibfk_2` FOREIGN KEY (`config_id`) REFERENCES `organization_configs` (`id`) ON DELETE CASCADE
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
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int DEFAULT NULL, -- Link to main tenants table
  `name` varchar(100) NOT NULL, -- Consider increasing length to 255
  `payroll_number_prefix` varchar(10) DEFAULT 'EMP',
  `kra_pin` varchar(11) DEFAULT NULL,
  `nssf_number` varchar(15) DEFAULT NULL,
  `nhif_number` varchar(15) DEFAULT NULL,
  `legal_type` enum('LTD','PLC','Sole_Proprietor','Partnership','NGO','Government','School','Other') DEFAULT NULL,
  `registration_number` varchar(50) DEFAULT NULL,
  `physical_address` varchar(255) DEFAULT NULL, -- Specific address
  `location` varchar(255) DEFAULT NULL, -- Original, more generic field
  `postal_address` varchar(255) DEFAULT NULL,
  `postal_code_id` int DEFAULT NULL,
  `county_id` int DEFAULT NULL, -- Specific county in Kenya
  `primary_phone` varchar(20) DEFAULT NULL,
  `secondary_phone` varchar(20) DEFAULT NULL,
  `official_email` varchar(255) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `currency` varchar(10) DEFAULT 'KES',
  `payroll_schedule` enum('Monthly','Bi-Monthly','Weekly') DEFAULT 'Monthly',
  `payroll_lock_date` date DEFAULT NULL,
  `default_payday` int DEFAULT NULL,
  `bank_id` int DEFAULT NULL,
  `bank_account_name` varchar(255) DEFAULT NULL,
  `bank_account_number` varchar(255) DEFAULT NULL,
  `bank_branch` varchar(255) DEFAULT NULL,
  `swift_code` varchar(11) DEFAULT NULL,
  `nssf_branch_code` varchar(50) DEFAULT NULL,
  `nhif_branch_code` varchar(50) DEFAULT NULL,
  `primary_administrator_id` int DEFAULT NULL, -- Link to users table
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `domain` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_org_tenant_id` (`tenant_id`),
  KEY `idx_org_kra_pin` (`kra_pin`),
  KEY `idx_org_county_id` (`county_id`)
  -- Foreign keys to be added after referenced tables are confirmed to exist
  -- FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  -- FOREIGN KEY (`county_id`) REFERENCES `counties` (`id`),
  -- FOREIGN KEY (`bank_id`) REFERENCES `banks` (`id`),
  -- FOREIGN KEY (`primary_administrator_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

CREATE TABLE IF NOT EXISTS `organization_configs` (
  `id`               INT          NOT NULL AUTO_INCREMENT,
  `organization_id`  INT          NOT NULL,
  `config_type`      ENUM('tax','deduction','loan','benefit','per_diem','advance','refund','leave') NOT NULL,
  `name`             VARCHAR(100) NOT NULL,
  `percentage`       DECIMAL(5,2)  DEFAULT NULL,
  `fixed_amount`     DECIMAL(15,2) DEFAULT NULL,
  `value_text`       VARCHAR(100)  DEFAULT NULL  COMMENT 'Scalar text value for settings that are not numeric (e.g. "monthly", "true", "01-01")',
  `settings`         JSON          DEFAULT NULL  COMMENT 'Structured / array values (e.g. approval workflow roles)',
  `status`           ENUM('pending','approved','rejected','deleted_pending') NOT NULL DEFAULT 'approved',
  `created_by`       INT NULL,
  `approved_by`      INT NULL,
  `rejected_by`      INT NULL,
  `approved_at`      TIMESTAMP NULL,
  `rejected_at`      TIMESTAMP NULL,
  `rejection_reason` TEXT NULL,
  `is_active`        TINYINT(1)   DEFAULT '1',
  `created_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_config` (`organization_id`,`config_type`,`name`),

  CONSTRAINT `organization_configs_ibfk_1`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
    ON DELETE CASCADE,

  CONSTRAINT `organization_configs_created_by_fk`
    FOREIGN KEY (`created_by`)  REFERENCES `users`(`id`)
    ON DELETE SET NULL,

  CONSTRAINT `organization_configs_approved_by_fk`
    FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`)
    ON DELETE SET NULL,

  CONSTRAINT `organization_configs_rejected_by_fk`
    FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`)
    ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Data exporting was unselected.

-- Dumping structure for table payhub.payruns
CREATE TABLE IF NOT EXISTS `payruns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `payrun_name` varchar(100) NOT NULL,
  `pay_period_start` date NOT NULL,
  `pay_period_end` date NOT NULL,
  `pay_frequency` enum('weekly','bi-weekly','monthly') DEFAULT 'monthly',
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
  CONSTRAINT `payruns_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payruns_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payruns_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payruns_ibfk_4` FOREIGN KEY (`finalized_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payruns_ibfk_5` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`)
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
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_payrun_employee` (`payrun_id`,`employee_id`),
  KEY `employee_id` (`employee_id`),
  KEY `idx_payrundetails_org` (`organization_id`),
  CONSTRAINT `payrun_details_ibfk_1` FOREIGN KEY (`payrun_id`) REFERENCES `payruns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payrun_details_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payrun_details_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
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
  `email` varchar(100) NOT NULL,
  `user_type` enum('super_admin','admin','hr_manager','hr_officer','payroll_manager','payroll_officer','finance_manager','auditor','department_manager','employee') DEFAULT 'employee',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `organization_id` (`organization_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  'approved', 1);