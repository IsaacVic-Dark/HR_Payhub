-- =============================================================================
-- Migration: Document Templates (Payslip Templates module)
-- Target   : EXISTING PayHub database (MySQL 8+). Safe to run more than once.
-- Run      : mysql -u <user> -p <database> < 2026_11_08_document_templates.sql
--            (or paste into HeidiSQL / phpMyAdmin — no DELIMITER statements are used)
--
-- What it does
--   1. Creates document_templates and document_template_versions
--   2. Adds template_id / template_version_id (nullable) to payslips and p9forms
--   3. Extends audit_logs.action with the new template/payslip actions
--      (includes the values from audit_logs_action_enum_fix.sql, so it is safe whether or not
--       that file was already applied)
--   4. Seeds an active "Default Modern" payslip template for every existing organisation
-- It is backward compatible: every new column is nullable and no existing data is changed.
--
-- BACK UP FIRST:  mysqldump -u <user> -p <database> > payhub_before_templates.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Template tables ---------------------------------------------------------
-- -----------------------------------------------------------------------------
-- DOCUMENT TEMPLATES (Templates module — payslip layouts & branding)
--   document_templates          working copy of each template (what the editor edits)
--   document_template_versions  immutable snapshots; payslips point at the one they used
--   document_templates.active_version_id = snapshot used for PDF generation
-- Presentation only: nothing here can change a payroll value.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `document_templates` (
  `id`                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `organization_id`   INT NOT NULL,
  `template_type`     ENUM('payslip','p9','employment_letter','loan_statement','advance_statement','reimbursement_statement') NOT NULL DEFAULT 'payslip',
  `name`              VARCHAR(100) NOT NULL,
  `layout_key`        VARCHAR(50)  NOT NULL DEFAULT 'modern',
  `config`            JSON NOT NULL,
  `header_logo_url`   VARCHAR(500) NULL COMMENT 'NULL = no logo, @organization = organization logo, storage/template-logos/... = uploaded',
  `primary_color`     VARCHAR(20)  NULL,
  `accent_color`      VARCHAR(20)  NULL,
  `footer_text`       TEXT NULL,
  `is_default`        TINYINT(1) NOT NULL DEFAULT 0,
  `status`            ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
  `active_version_id` INT UNSIGNED NULL COMMENT 'Snapshot used for PDF generation (set on activation)',
  `created_by`        INT NULL,
  `updated_by`        INT NULL,
  `created_at`        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT `fk_document_templates_org`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_document_templates_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_document_templates_updated_by`
    FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,

  UNIQUE KEY `unique_org_template_name` (`organization_id`, `template_type`, `name`),
  KEY `idx_document_templates_org_type` (`organization_id`, `template_type`, `status`),
  KEY `idx_document_templates_active_version` (`active_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `document_template_versions` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `template_id`     INT UNSIGNED NOT NULL,
  `version`         INT UNSIGNED NOT NULL,
  `config`          JSON NOT NULL,
  `header_logo_url` VARCHAR(500) NULL,
  `primary_color`   VARCHAR(20)  NULL,
  `accent_color`    VARCHAR(20)  NULL,
  `footer_text`     TEXT NULL,
  `created_by`      INT NULL,
  `created_at`      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT `fk_template_versions_template`
    FOREIGN KEY (`template_id`) REFERENCES `document_templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_template_versions_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,

  UNIQUE KEY `unique_template_version` (`template_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Circular reference (template → its active snapshot) is added after both tables exist.
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `document_templates` ADD CONSTRAINT `fk_document_templates_active_version` FOREIGN KEY (`active_version_id`) REFERENCES `document_template_versions` (`id`) ON DELETE SET NULL', 'SELECT ''document_templates.fk_document_templates_active_version already exists''') FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_templates' AND CONSTRAINT_NAME = 'fk_document_templates_active_version' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;


-- 2. payslips ----------------------------------------------------------------
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payslips` ADD COLUMN `template_id` INT UNSIGNED NULL AFTER `metadata`', 'SELECT ''payslips.template_id already exists'''  ) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND COLUMN_NAME = 'template_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payslips` ADD COLUMN `template_version_id` INT UNSIGNED NULL AFTER `template_id`', 'SELECT ''payslips.template_version_id already exists'''  ) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND COLUMN_NAME = 'template_version_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payslips` ADD KEY `idx_payslips_org_employee` (`organization_id`, `employee_id`)', 'SELECT ''payslips.idx_payslips_org_employee already exists''') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND INDEX_NAME = 'idx_payslips_org_employee');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payslips` ADD KEY `idx_payslips_org_payrun` (`organization_id`, `payrun_id`)', 'SELECT ''payslips.idx_payslips_org_payrun already exists''') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND INDEX_NAME = 'idx_payslips_org_payrun');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payslips` ADD KEY `idx_payslips_template` (`template_id`)', 'SELECT ''payslips.idx_payslips_template already exists''') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND INDEX_NAME = 'idx_payslips_template');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payslips` ADD KEY `idx_payslips_template_version` (`template_version_id`)', 'SELECT ''payslips.idx_payslips_template_version already exists''') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND INDEX_NAME = 'idx_payslips_template_version');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payslips` ADD CONSTRAINT `fk_payslips_template` FOREIGN KEY (`template_id`) REFERENCES `document_templates` (`id`) ON DELETE SET NULL', 'SELECT ''payslips.fk_payslips_template already exists''') FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND CONSTRAINT_NAME = 'fk_payslips_template' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payslips` ADD CONSTRAINT `fk_payslips_template_version` FOREIGN KEY (`template_version_id`) REFERENCES `document_template_versions` (`id`) ON DELETE SET NULL', 'SELECT ''payslips.fk_payslips_template_version already exists''') FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND CONSTRAINT_NAME = 'fk_payslips_template_version' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 3. p9forms (schema only; P9 template rendering is a later phase) ---------------
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `p9forms` ADD COLUMN `template_id` INT UNSIGNED NULL', 'SELECT ''p9forms.template_id already exists'''  ) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'p9forms' AND COLUMN_NAME = 'template_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `p9forms` ADD COLUMN `template_version_id` INT UNSIGNED NULL AFTER `template_id`', 'SELECT ''p9forms.template_version_id already exists'''  ) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'p9forms' AND COLUMN_NAME = 'template_version_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `p9forms` ADD KEY `idx_p9forms_template` (`template_id`)', 'SELECT ''p9forms.idx_p9forms_template already exists''') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'p9forms' AND INDEX_NAME = 'idx_p9forms_template');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `p9forms` ADD KEY `idx_p9forms_template_version` (`template_version_id`)', 'SELECT ''p9forms.idx_p9forms_template_version already exists''') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'p9forms' AND INDEX_NAME = 'idx_p9forms_template_version');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `p9forms` ADD CONSTRAINT `fk_p9forms_template` FOREIGN KEY (`template_id`) REFERENCES `document_templates` (`id`) ON DELETE SET NULL', 'SELECT ''p9forms.fk_p9forms_template already exists''') FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'p9forms' AND CONSTRAINT_NAME = 'fk_p9forms_template' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `p9forms` ADD CONSTRAINT `fk_p9forms_template_version` FOREIGN KEY (`template_version_id`) REFERENCES `document_template_versions` (`id`) ON DELETE SET NULL', 'SELECT ''p9forms.fk_p9forms_template_version already exists''') FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'p9forms' AND CONSTRAINT_NAME = 'fk_p9forms_template_version' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 4. audit_logs --------------------------------------------------------------
-- Re-running is harmless: MODIFY with the same list is a no-op rewrite.
ALTER TABLE `audit_logs`
  MODIFY COLUMN `action` ENUM(
    'create','update','delete','review','finalize','reopen',
    'auto_create','locked_period_detected','off_cycle_adjustment_linked','carry_forward_applied','carry_forward_queued',
    'submit','policy_validated','policy_failed','manager_approved','hr_approved','finance_approved','partially_approved',
    'rejected','scheduled','payment_initiated','paid','payment_failed','disputed','reversed','cancelled',
    'advance_created','advance_submitted','advance_policy_validated','advance_policy_failed','advance_approved',
    'advance_rejected','advance_cancelled','advance_disbursed','advance_recovery_attached','advance_recovery_detached',
    'advance_recovery_processed','advance_recovery_skipped','advance_partially_recovered','advance_repaid',
    'advance_reversed','advance_manual_repayment',
    -- from audit_logs_action_enum_fix.sql
    'bootstrap_create','approve','reject','advance_payout_scheduled','advance_payout_detached',
    -- Templates module
    'template_created','template_updated','template_activated','template_archived','template_previewed',
    'payslips_generated','payslip_regenerated','access_denied'
  ) NOT NULL;
SET @s := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `audit_logs` ADD KEY `idx_audit_logs_org_created` (`organization_id`, `created_at`)', 'SELECT ''audit_logs.idx_audit_logs_org_created already exists''') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND INDEX_NAME = 'idx_audit_logs_org_created');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET FOREIGN_KEY_CHECKS = 1;

-- 5. Seed --------------------------------------------------------------------
-- -----------------------------------------------------------------------------
-- Default payslip template for every existing organisation (modern layout, active).
-- New organisations get theirs lazily the first time the Templates module is opened
-- (DocumentTemplateService::ensureDefault). Safe to re-run: it only inserts where missing.
-- -----------------------------------------------------------------------------
INSERT INTO `document_templates`
  (`organization_id`, `template_type`, `name`, `layout_key`, `config`, `header_logo_url`,
   `primary_color`, `accent_color`, `footer_text`, `is_default`, `status`)
SELECT o.`id`, 'payslip', 'Default Modern', 'modern',
       CAST('{"layout":"modern","documentTitle":"Payslip","showCompanyHeader":true,"showEmployeeDetails":true,"showPaymentSummary":true,"showEarnings":true,"showDeductions":true,"showStatutoryDeductions":true,"showAllowances":true,"showReimbursements":true,"showAdvances":true,"showLoanDeductions":true,"showLeaveSummary":false,"showBankDetails":false,"showPaymentDate":true,"showFooter":true,"footerText":"This is a system-generated payslip.","labels":{"employee":"Employee","employeeNumber":"Employee No.","payPeriod":"Pay Period","basicSalary":"Basic Salary","grossPay":"Gross Pay","totalDeductions":"Total Deductions","netPay":"Net Pay","paye":"PAYE","nssf":"NSSF","shif":"SHIF","housingLevy":"Housing Levy","jobTitle":"Job Title","department":"Department","hireDate":"Date Hired","payslipNumber":"Payslip No.","paymentDate":"Payment Date","earnings":"Earnings","deductions":"Deductions","statutoryDeductions":"Statutory Deductions","allowances":"Allowances","reimbursements":"Reimbursements","advances":"Advance Recoveries","loans":"Loan Repayments","overtime":"Overtime","bonus":"Bonus","commission":"Commission","taxableIncome":"Taxable Income","personalRelief":"Personal Relief","bankDetails":"Bank Details","leaveSummary":"Leave Summary","paymentSummary":"Payment Summary"},"sections":{"earnings":{"visible":true,"order":1},"deductions":{"visible":true,"order":2}}}' AS JSON),
       '@organization', '#1E3A8A', '#2563EB', 'This is a system-generated payslip.', 1, 'active'
  FROM `organizations` o
 WHERE NOT EXISTS (
         SELECT 1 FROM `document_templates` t
          WHERE t.`organization_id` = o.`id` AND t.`template_type` = 'payslip'
       );

INSERT INTO `document_template_versions`
  (`template_id`, `version`, `config`, `header_logo_url`, `primary_color`, `accent_color`, `footer_text`)
SELECT t.`id`, 1, t.`config`, t.`header_logo_url`, t.`primary_color`, t.`accent_color`, t.`footer_text`
  FROM `document_templates` t
 WHERE t.`template_type` = 'payslip' AND t.`status` = 'active' AND t.`active_version_id` IS NULL
   AND NOT EXISTS (SELECT 1 FROM `document_template_versions` v WHERE v.`template_id` = t.`id`);

UPDATE `document_templates` t
  JOIN `document_template_versions` v ON v.`template_id` = t.`id` AND v.`version` = 1
   SET t.`active_version_id` = v.`id`
 WHERE t.`status` = 'active' AND t.`active_version_id` IS NULL;

-- -----------------------------------------------------------------------------
-- OPTIONAL (recommended, not required by this feature):
-- payrun_details.organization_id currently has DEFAULT 221 in the live database, which would silently
-- assign rows to organisation 221 if an INSERT ever omitted it. Remove the default with:
--   ALTER TABLE `payrun_details` ALTER COLUMN `organization_id` DROP DEFAULT;
-- -----------------------------------------------------------------------------
