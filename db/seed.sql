SET search_path TO mydb;

TRUNCATE TABLE
  computers_software,
  deaccessions,
  assignments,
  computers,
  software,
  users,
  locations
RESTART IDENTITY;

INSERT INTO locations (building, room)
VALUES
  ('Administration', '101'),
  ('Library', '015'),
  ('Help Desk', '001');

INSERT INTO users (first_name, last_name, email, department, role_type)
VALUES
  ('Alicia', 'Grant', 'alicia.grant@university.edu', 'Registrar', 'staff'),
  ('Evan', 'Stone', 'evan.stone@university.edu', 'Biology', 'faculty'),
  ('Marcus', 'Lee', 'marcus.lee@university.edu', 'IT Support', 'it');

INSERT INTO software (software_name, software_category, vendor)
VALUES
  ('Microsoft Office', 'Productivity', 'Microsoft'),
  ('Zoom', 'Collaboration', 'Zoom'),
  ('CrowdStrike Falcon', 'Security', 'CrowdStrike');

INSERT INTO computers (
  asset_tag,
  serial_number,
  device_type,
  manufacturer,
  model,
  purchase_date,
  status,
  current_location_id
)
VALUES
  ('A1001', 'SN-A1001', 'desktop', 'Dell', 'OptiPlex 7090', DATE '2023-08-12', 'available', 1),
  ('A1002', 'SN-A1002', 'laptop', 'Apple', 'MacBook Air', DATE '2022-10-05', 'available', 2),
  ('A1003', 'SN-A1003', 'tablet', 'Microsoft', 'Surface Go', DATE '2020-09-10', 'available', 3),
  ('A1004', 'SN-A1004', 'laptop', 'Lenovo', 'ThinkPad T14', DATE '2024-01-18', 'retired', 3);

INSERT INTO computers_software (computer_id, software_id, installed_version, install_date)
VALUES
  (1, 1, '2024.3', DATE '2024-08-20'),
  (1, 3, '7.0', DATE '2024-08-20'),
  (2, 1, '2024.3', DATE '2024-01-15'),
  (2, 2, '6.2', DATE '2024-01-15');

CALL mydb.sp_create_assignment(1, 1, 'long_term', DATE '2026-01-10');
CALL mydb.sp_create_assignment(2, 2, 'loaner', DATE '2026-03-15');

INSERT INTO deaccessions (deaccession_date, reason, computer_id)
VALUES
  (DATE '2026-01-18', 'End of lifecycle', 4);
