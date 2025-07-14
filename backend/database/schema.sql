CREATE DATABASE payhub;
USE payhub;

-- Organizations table
CREATE TABLE organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    logo_url VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'KES',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Organization Configurations
CREATE TABLE organization_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    config_type ENUM('tax', 'deduction', 'loan', 'benefit', 'per_diem', 'advance', 'refund') NOT NULL,
    name VARCHAR(100) NOT NULL,
    percentage DECIMAL(5, 2),
    fixed_amount DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_config (organization_id, config_type, name)
);

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    user_type ENUM('employee', 'admin', 'super_admin') DEFAULT 'employee',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Employees table
CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    user_id INT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    hire_date DATE NOT NULL,
    job_title VARCHAR(100),
    department VARCHAR(100),
    reports_to INT,
    base_salary DECIMAL(15, 2) NOT NULL,
    bank_account_number VARCHAR(50),
    tax_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reports_to) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_employee_org (organization_id, id)
);

-- Pay Runs table
CREATE TABLE payruns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    payrun_name VARCHAR(100) NOT NULL,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    pay_frequency ENUM('weekly', 'bi-weekly', 'monthly') DEFAULT 'monthly',
    status ENUM('draft', 'reviewed', 'finalized') DEFAULT 'draft',
    total_gross_pay DECIMAL(15, 2) DEFAULT 0.00,
    total_deductions DECIMAL(15, 2) DEFAULT 0.00,
    total_net_pay DECIMAL(15, 2) DEFAULT 0.00,
    employee_count INT DEFAULT 0,
    created_by INT NOT NULL,
    reviewed_by INT,
    finalized_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    finalized_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    FOREIGN KEY (finalized_by) REFERENCES users(id),
    INDEX idx_payrun_period (pay_period_start, pay_period_end),
    INDEX idx_payrun_status (status)
);

-- Pay Run Details table
CREATE TABLE payrun_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payrun_id INT NOT NULL,
    employee_id INT NOT NULL,
    basic_salary DECIMAL(15, 2) NOT NULL,
    overtime_amount DECIMAL(15, 2) DEFAULT 0.00,
    bonus_amount DECIMAL(15, 2) DEFAULT 0.00,
    commission_amount DECIMAL(15, 2) DEFAULT 0.00,
    gross_pay DECIMAL(15, 2) NOT NULL,
    total_deductions DECIMAL(15, 2) NOT NULL,
    net_pay DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (payrun_id) REFERENCES payruns(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_payrun_employee (payrun_id, employee_id)
);

-- Pay Run Deductions
CREATE TABLE payrun_deductions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payrun_detail_id INT NOT NULL,
    config_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (payrun_detail_id) REFERENCES payrun_details(id) ON DELETE CASCADE,
    FOREIGN KEY (config_id) REFERENCES organization_configs(id) ON DELETE CASCADE
);

-- Loans table
CREATE TABLE loans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    config_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2),
    start_date DATE NOT NULL,
    end_date DATE,
    status ENUM('pending', 'approved', 'rejected', 'repaid') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (config_id) REFERENCES organization_configs(id) ON DELETE CASCADE
);

-- Advances table
CREATE TABLE advances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    config_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    request_date DATE NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'repaid') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (config_id) REFERENCES organization_configs(id) ON DELETE CASCADE
);

-- Refunds table
CREATE TABLE refunds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    config_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    refund_date DATE NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'processed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (config_id) REFERENCES organization_configs(id) ON DELETE CASCADE
);

-- Per Diems table
CREATE TABLE per_diems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    config_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    trip_date DATE NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'paid') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (config_id) REFERENCES organization_configs(id) ON DELETE CASCADE
);

-- Leaves table
CREATE TABLE leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    leave_type ENUM('sick', 'casual', 'annual', 'maternity', 'paternity', 'other') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Benefits table
CREATE TABLE benefits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    config_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    date_granted DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (config_id) REFERENCES organization_configs(id) ON DELETE CASCADE
);

-- Approvals table
CREATE TABLE approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type ENUM('leave', 'loan', 'advance', 'refund', 'per_diem') NOT NULL,
    entity_id INT NOT NULL,
    approver_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit Logs table
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    user_id INT NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    action ENUM('create', 'update', 'delete') NOT NULL,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('salary', 'tax', 'leave', 'loan', 'advance', 'refund', 'per_diem', 'other') NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Insert or update audit log
DELIMITER $$
CREATE PROCEDURE upsert_audit_log(
    IN p_organization_id INT,
    IN p_user_id INT,
    IN p_entity_type VARCHAR(50),
    IN p_entity_id INT,
    IN p_action ENUM('create', 'update', 'delete'),
    IN p_details JSON
)
BEGIN
    INSERT INTO audit_logs (organization_id, user_id, entity_type, entity_id, action, details, created_at)
    VALUES (p_organization_id, p_user_id, p_entity_type, p_entity_id, p_action, p_details, NOW());
END$$
DELIMITER ;

-- Mark notification as read
DELIMITER $$
CREATE PROCEDURE mark_notification_read(IN p_notification_id INT)
BEGIN
    UPDATE notifications SET is_read = TRUE, updated_at = NOW() WHERE id = p_notification_id;
END$$
DELIMITER ;

-- Insert notification
DELIMITER $$
CREATE PROCEDURE insert_notification(
    IN p_employee_id INT,
    IN p_title VARCHAR(255),
    IN p_message TEXT,
    IN p_type ENUM('salary', 'tax', 'leave', 'loan', 'advance', 'refund', 'per_diem', 'other'),
    IN p_metadata JSON
)
BEGIN
    INSERT INTO notifications (employee_id, title, message, type, metadata, created_at, updated_at)
    VALUES (p_employee_id, p_title, p_message, p_type, p_metadata, NOW(), NOW());
END$$
DELIMITER ;