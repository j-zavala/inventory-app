CREATE SCHEMA IF NOT EXISTS mydb;
SET search_path TO mydb;

-- =========================
-- users
-- =========================
CREATE TABLE IF NOT EXISTS users (
  user_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  department VARCHAR(255),
  role_type TEXT NOT NULL CHECK (role_type IN ('staff', 'faculty', 'it'))
);

-- =========================
-- locations
-- =========================
CREATE TABLE IF NOT EXISTS locations (
  location_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  building VARCHAR(255) NOT NULL,
  room VARCHAR(255) NOT NULL,
  CONSTRAINT uq_locations_building_room UNIQUE (building, room)
);

-- =========================
-- computers
-- =========================
CREATE TABLE IF NOT EXISTS computers (
  computer_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_tag VARCHAR(50) NOT NULL UNIQUE,
  serial_number VARCHAR(50) NOT NULL UNIQUE,
  device_type TEXT NOT NULL CHECK (device_type IN ('desktop', 'laptop', 'tablet')),
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  purchase_date DATE,
  status TEXT NOT NULL CHECK (
    status IN (
      'available',
      'assigned',
      'available_loaner',
      'deaccessioned',
      'wiped',
      'in-repair'
    )
  ),
  current_location_id INT,
  CONSTRAINT fk_computers_location
    FOREIGN KEY (current_location_id)
    REFERENCES locations(location_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_computers_current_location_id
  ON computers(current_location_id);

-- =========================
-- assignments
-- =========================
CREATE TABLE IF NOT EXISTS assignments (
  assignment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL,
  computer_id INT NOT NULL,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('long_term', 'loaner')),
  assigned_date DATE NOT NULL,
  returned_date DATE,
  CONSTRAINT fk_assignments_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT fk_assignments_computer
    FOREIGN KEY (computer_id)
    REFERENCES computers(computer_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT chk_assignment_dates
    CHECK (returned_date IS NULL OR returned_date >= assigned_date)
);

CREATE INDEX IF NOT EXISTS idx_assignments_user_id
  ON assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_assignments_computer_id
  ON assignments(computer_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_assignment_per_computer
  ON assignments(computer_id)
  WHERE returned_date IS NULL;

-- =========================
-- deaccessions
-- =========================
CREATE TABLE IF NOT EXISTS deaccessions (
  deaccession_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deaccession_date DATE NOT NULL,
  reason VARCHAR(255),
  computer_id INT NOT NULL UNIQUE,
  CONSTRAINT fk_deaccessions_computer
    FOREIGN KEY (computer_id)
    REFERENCES computers(computer_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

-- =========================
-- software
-- =========================
CREATE TABLE IF NOT EXISTS software (
  software_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  software_name VARCHAR(255) NOT NULL,
  software_category VARCHAR(255),
  vendor VARCHAR(255)
);

-- =========================
-- computers_software
-- =========================
CREATE TABLE IF NOT EXISTS computers_software (
  computer_id INT NOT NULL,
  software_id INT NOT NULL,
  installed_version VARCHAR(255),
  install_date DATE,
  PRIMARY KEY (computer_id, software_id),
  CONSTRAINT fk_computers_software_computer
    FOREIGN KEY (computer_id)
    REFERENCES computers(computer_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT fk_computers_software_software
    FOREIGN KEY (software_id)
    REFERENCES software(software_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_computers_software_software_id
  ON computers_software(software_id);
