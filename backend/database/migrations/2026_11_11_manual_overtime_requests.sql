-- =============================================================================
-- Migration: Manual overtime requests
-- Target   : EXISTING PayHub database (MySQL 8+). Safe to run more than once.
-- Run      : mysql -u <user> -p <database> < 2026_11_11_manual_overtime_requests.sql
--            (or paste into HeidiSQL / phpMyAdmin - no DELIMITER statements are used)
--
-- What it does
--   Adds four nullable/defaulted columns to overtime_approvals so employees, admins and
--   HR managers can raise overtime by hand (the "Request Overtime" modal):
--     source          'auto' (detected from punches - every existing row) | 'manual'
--     reason          requester's reason
--     overtime_start  start of the requested window (DATETIME)
--     overtime_end    end of the requested window   (DATETIME)
--   plus an index on (organization_id, source, status).
--
-- Backward compatible: all existing rows become source = 'auto'; nothing else changes.
-- No change is needed to audit_logs (re-uses the existing 'submit' and 'cancelled' actions)
-- or notifications (re-uses type 'other').
--
-- BACK UP FIRST:  mysqldump -u <user> -p <database> > payhub_before_manual_overtime.sql
-- =============================================================================

-- 1. Columns -------------------------------------------------------------------
SET @has_source = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'overtime_approvals' AND COLUMN_NAME = 'source'
);

SET @ddl = IF(@has_source = 0,
  'ALTER TABLE `overtime_approvals`
     ADD COLUMN `source` ENUM(''auto'',''manual'') NOT NULL DEFAULT ''auto''
       COMMENT ''auto = detected from attendance punches; manual = requested through the Overtime Request modal''
       AFTER `overtime_minutes`,
     ADD COLUMN `reason` TEXT DEFAULT NULL
       COMMENT ''Requester reason (manual requests)''
       AFTER `source`,
     ADD COLUMN `overtime_start` DATETIME DEFAULT NULL
       COMMENT ''Start of the overtime window (manual requests)''
       AFTER `reason`,
     ADD COLUMN `overtime_end` DATETIME DEFAULT NULL
       COMMENT ''End of the overtime window (manual requests)''
       AFTER `overtime_start`',
  'SELECT ''overtime_approvals manual-request columns already present'' AS info');

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Index ---------------------------------------------------------------------
SET @has_idx = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'overtime_approvals'
     AND INDEX_NAME = 'idx_overtime_source_status'
);

SET @ddl = IF(@has_idx = 0,
  'ALTER TABLE `overtime_approvals`
     ADD KEY `idx_overtime_source_status` (`organization_id`, `source`, `status`)',
  'SELECT ''idx_overtime_source_status already present'' AS info');

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Verify (optional) ---------------------------------------------------------
-- DESCRIBE overtime_approvals;
