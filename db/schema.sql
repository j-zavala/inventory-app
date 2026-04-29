DROP SCHEMA IF EXISTS mydb CASCADE;
CREATE SCHEMA mydb;
SET search_path TO mydb;

CREATE TABLE users (
  user_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  department VARCHAR(100),
  role_type TEXT NOT NULL CHECK (role_type IN ('staff', 'faculty', 'it'))
);

CREATE TABLE locations (
  location_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  building VARCHAR(100) NOT NULL,
  room VARCHAR(50) NOT NULL
);

CREATE TABLE computers (
  computer_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_tag VARCHAR(50) NOT NULL UNIQUE,
  serial_number VARCHAR(50) NOT NULL UNIQUE,
  device_type TEXT NOT NULL CHECK (device_type IN ('desktop', 'laptop', 'tablet')),
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  purchase_date DATE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'retired')),
  current_location_id INT NOT NULL REFERENCES locations(location_id)
);

CREATE TABLE assignments (
  assignment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  computer_id INT NOT NULL REFERENCES computers(computer_id),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('long_term', 'loaner')),
  assigned_date DATE NOT NULL,
  returned_date DATE,
  CHECK (returned_date IS NULL OR returned_date >= assigned_date)
);

CREATE TABLE deaccessions (
  deaccession_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deaccession_date DATE NOT NULL,
  reason VARCHAR(150),
  computer_id INT NOT NULL UNIQUE REFERENCES computers(computer_id)
);

CREATE TABLE software (
  software_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  software_name VARCHAR(100) NOT NULL,
  software_category VARCHAR(100),
  vendor VARCHAR(100)
);

CREATE TABLE computers_software (
  computer_id INT NOT NULL REFERENCES computers(computer_id),
  software_id INT NOT NULL REFERENCES software(software_id),
  installed_version VARCHAR(50),
  install_date DATE,
  PRIMARY KEY (computer_id, software_id)
);
