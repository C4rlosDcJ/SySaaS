-- Script to create settings table and initial data
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('default_warranty_days', '30');
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('business_name', 'SySaaS');
