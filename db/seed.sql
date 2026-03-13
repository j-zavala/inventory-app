SET search_path TO mydb;

TRUNCATE TABLE
  mydb.computers_software,
  mydb.deaccessions,
  mydb.assignments,
  mydb.computers,
  mydb.software,
  mydb.users,
  mydb.locations
RESTART IDENTITY;

INSERT INTO mydb.locations (building, room)
VALUES
  ('IT Storage', 'Pending'),
  ('Administration', '101'),
  ('Faculty Hall', '202'),
  ('Library', '015'),
  ('Help Desk', '001'),
  ('Science Lab', '301'),
  ('Science Lab', '302');

INSERT INTO mydb.users (
  first_name,
  last_name,
  email,
  department,
  role_type
)
VALUES
  ('Alicia', 'Grant', 'alicia.grant@university.edu', 'Registrar', 'staff'),
  ('Evan', 'Stone', 'evan.stone@university.edu', 'Biology', 'faculty'),
  ('Priya', 'Shah', 'priya.shah@university.edu', 'Library', 'staff'),
  ('Marcus', 'Lee', 'marcus.lee@university.edu', 'IT Support', 'it'),
  ('Dana', 'Brooks', 'dana.brooks@university.edu', 'History', 'faculty'),
  ('Sam', 'Rivera', 'sam.rivera@university.edu', 'Finance', 'staff');

INSERT INTO mydb.software (
  software_name,
  software_category,
  vendor
)
VALUES
  ('Microsoft Office', 'Productivity', 'Microsoft'),
  ('Zoom', 'Collaboration', 'Zoom'),
  ('Adobe Acrobat', 'PDF', 'Adobe'),
  ('Slack', 'Messaging', 'Salesforce'),
  ('CrowdStrike Falcon', 'Security', 'CrowdStrike'),
  ('IBM SPSS', 'Analytics', 'IBM');

INSERT INTO mydb.computers (
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
  ('A1001', 'SN-A1001', 'desktop', 'Dell', 'OptiPlex 7090', DATE '2023-08-12', 'available', 2),
  ('A1002', 'SN-A1002', 'laptop', 'Apple', 'MacBook Air', DATE '2022-10-05', 'available', 3),
  ('A1003', 'SN-A1003', 'laptop', 'Lenovo', 'ThinkPad T14', DATE '2024-01-18', 'available', 4),
  ('A1004', 'SN-A1004', 'laptop', 'HP', 'ProBook 445', DATE '2023-05-21', 'available_loaner', 5),
  ('A1005', 'SN-A1005', 'laptop', 'Dell', 'Latitude 5430', DATE '2023-03-04', 'available_loaner', 5),
  ('A1006', 'SN-A1006', 'desktop', 'Apple', 'iMac 24', DATE '2021-11-15', 'available', 6),
  ('A1007', 'SN-A1007', 'tablet', 'Microsoft', 'Surface Go', DATE '2020-09-10', 'available', 1),
  ('A1008', 'SN-A1008', 'laptop', 'Lenovo', 'ThinkPad X1 Carbon', DATE '2024-02-02', 'in-repair', 1),
  ('A1009', 'SN-A1009', 'desktop', 'HP', 'EliteDesk 800', DATE '2019-04-28', 'wiped', 7),
  ('A1010', 'SN-A1010', 'laptop', 'Acer', 'Swift 5', DATE '2023-07-09', 'available', 3);

INSERT INTO mydb.computers_software (
  computer_id,
  software_id,
  installed_version,
  install_date
)
VALUES
  (1, 1, '2024.3', DATE '2024-08-20'),
  (1, 2, '6.2', DATE '2024-08-20'),
  (1, 5, '7.0', DATE '2024-08-20'),
  (2, 1, '2024.3', DATE '2024-01-15'),
  (2, 3, '2024.1', DATE '2024-01-15'),
  (2, 5, '7.0', DATE '2024-01-15'),
  (3, 1, '2024.3', DATE '2024-03-05'),
  (3, 2, '6.2', DATE '2024-03-05'),
  (3, 3, '2024.1', DATE '2024-03-05'),
  (3, 5, '7.0', DATE '2024-03-05'),
  (4, 1, '2024.3', DATE '2024-07-01'),
  (4, 2, '6.2', DATE '2024-07-01'),
  (5, 1, '2024.3', DATE '2024-07-01'),
  (5, 2, '6.2', DATE '2024-07-01'),
  (6, 1, '2024.3', DATE '2024-02-08'),
  (6, 5, '7.0', DATE '2024-02-08'),
  (6, 6, '29', DATE '2024-02-08'),
  (7, 1, '2023.4', DATE '2023-09-02'),
  (8, 1, '2024.3', DATE '2024-02-10'),
  (8, 4, '4.39', DATE '2024-02-10'),
  (9, 1, '2022.4', DATE '2022-03-01'),
  (9, 3, '2023.9', DATE '2022-03-01'),
  (10, 1, '2024.3', DATE '2024-05-18'),
  (10, 4, '4.39', DATE '2024-05-18'),
  (10, 5, '7.0', DATE '2024-05-18');

CALL mydb.sp_assign_computer(1, 1, 'long_term', DATE '2026-01-10');
CALL mydb.sp_assign_computer(2, 4, 'loaner', DATE '2026-03-15');
CALL mydb.sp_assign_computer(3, 2, 'long_term', DATE '2025-09-01');
CALL mydb.sp_assign_computer(6, 5, 'loaner', DATE '2026-02-20');
CALL mydb.sp_assign_computer(5, 10, 'long_term', DATE '2025-10-11');

DO $$
DECLARE
  returned_assignment_id INT;
BEGIN
  SELECT assignment_id
  INTO returned_assignment_id
  FROM mydb.assignments
  WHERE computer_id = 2
    AND returned_date IS NULL;

  CALL mydb.sp_return_computer(
    returned_assignment_id,
    DATE '2026-02-12',
    'wiped'
  );
END;
$$;

DO $$
DECLARE
  returned_assignment_id INT;
BEGIN
  SELECT assignment_id
  INTO returned_assignment_id
  FROM mydb.assignments
  WHERE computer_id = 5
    AND returned_date IS NULL;

  CALL mydb.sp_return_computer(
    returned_assignment_id,
    DATE '2026-02-22',
    NULL
  );
END;
$$;

DO $$
DECLARE
  returned_assignment_id INT;
BEGIN
  SELECT assignment_id
  INTO returned_assignment_id
  FROM mydb.assignments
  WHERE computer_id = 10
    AND returned_date IS NULL;

  CALL mydb.sp_return_computer(
    returned_assignment_id,
    DATE '2026-03-05',
    'available'
  );
END;
$$;

CALL mydb.sp_deaccession_computer(7, DATE '2026-01-18', 'Damaged hardware');
CALL mydb.sp_deaccession_computer(9, DATE '2025-12-05', 'End of lifecycle');
