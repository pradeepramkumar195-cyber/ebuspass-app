CREATE DATABASE IF NOT EXISTS ebuspass CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE ebuspass;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) PRIMARY KEY, name VARCHAR(150), email VARCHAR(150) UNIQUE,
  mobile VARCHAR(15), role VARCHAR(30), provider VARCHAR(30), depot VARCHAR(20),
  salt VARCHAR(128), password_hash VARCHAR(255), created_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(128) PRIMARY KEY, user_id VARCHAR(32), created_at DATETIME,
  INDEX (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(32), type VARCHAR(30), pass_code VARCHAR(50),
  category VARCHAR(50), personal LONGTEXT, details LONGTEXT, route LONGTEXT, files LONGTEXT,
  fare LONGTEXT, amount DECIMAL(10,2), status VARCHAR(40), reject_reason TEXT,
  created_at DATETIME, paid_at DATETIME, issued_at DATETIME,
  INDEX (user_id), INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS passes (
  code VARCHAR(50) PRIMARY KEY, application_id VARCHAR(50), user_id VARCHAR(32),
  name VARCHAR(150), mobile VARCHAR(15), category VARCHAR(50), from_station VARCHAR(50),
  to_station VARCHAR(50), km DECIMAL(8,2), depot VARCHAR(30), valid_from DATE, valid_till DATE,
  issued_at DATETIME, issued_by VARCHAR(150), institution VARCHAR(200),
  escort BOOLEAN DEFAULT FALSE, blocked BOOLEAN DEFAULT FALSE, renewals INT DEFAULT 0,
  INDEX (user_id), INDEX (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  receipt_no VARCHAR(50) PRIMARY KEY, application_id VARCHAR(50), user_id VARCHAR(32),
  amount DECIMAL(10,2), method VARCHAR(30), transaction_id VARCHAR(100), paid_at DATETIME,
  INDEX (application_id), INDEX (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(32), mobile VARCHAR(15), title VARCHAR(200),
  message TEXT, is_read BOOLEAN DEFAULT FALSE, created_at DATETIME, app_id VARCHAR(50),
  INDEX (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS update_requests (
  id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(32), pass_code VARCHAR(50), field VARCHAR(50),
  value LONGTEXT, reason TEXT, proof TEXT, status VARCHAR(30), created_at DATETIME,
  INDEX (user_id), INDEX (pass_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS trips (
  id VARCHAR(50) PRIMARY KEY, pass_code VARCHAR(50), trip_date DATE, trip_time DATETIME,
  bus_no VARCHAR(50), conductor VARCHAR(150), boarding VARCHAR(150),
  INDEX (pass_code), INDEX (trip_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS counters (
  name VARCHAR(100) PRIMARY KEY, counter_value INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
