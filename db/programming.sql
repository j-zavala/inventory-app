SET search_path TO mydb;

-- =========================
-- functions
-- =========================
CREATE OR REPLACE FUNCTION mydb.fn_has_active_assignment(p_computer_id INT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM mydb.assignments
    WHERE computer_id = p_computer_id
      AND returned_date IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION mydb.fn_user_active_assignment_count(p_user_id INT)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INT
  FROM mydb.assignments
  WHERE user_id = p_user_id
    AND returned_date IS NULL;
$$;

CREATE OR REPLACE FUNCTION mydb.fn_computer_software_count(p_computer_id INT)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INT
  FROM mydb.computers_software
  WHERE computer_id = p_computer_id;
$$;

-- =========================
-- views
-- =========================
CREATE OR REPLACE VIEW mydb.v_active_assignments AS
SELECT
  a.assignment_id,
  a.user_id,
  a.computer_id,
  a.assignment_type,
  a.assigned_date,
  CONCAT(u.first_name, ' ', u.last_name) AS user_name,
  u.department,
  u.role_type,
  c.asset_tag,
  c.serial_number,
  c.device_type,
  c.status AS computer_status,
  CONCAT(l.building, ' ', l.room) AS location_label
FROM mydb.assignments a
JOIN mydb.users u
  ON u.user_id = a.user_id
JOIN mydb.computers c
  ON c.computer_id = a.computer_id
JOIN mydb.locations l
  ON l.location_id = c.current_location_id
WHERE a.returned_date IS NULL;

CREATE OR REPLACE VIEW mydb.v_software_installations AS
SELECT
  cs.computer_id,
  cs.software_id,
  c.asset_tag,
  CONCAT(c.manufacturer, ' ', c.model) AS computer_name,
  s.software_name,
  s.software_category,
  s.vendor,
  cs.installed_version,
  cs.install_date
FROM mydb.computers_software cs
JOIN mydb.computers c
  ON c.computer_id = cs.computer_id
JOIN mydb.software s
  ON s.software_id = cs.software_id;

CREATE OR REPLACE VIEW mydb.v_computer_overview AS
SELECT
  c.computer_id,
  c.asset_tag,
  c.serial_number,
  c.device_type,
  c.manufacturer,
  c.model,
  c.purchase_date,
  c.status,
  c.current_location_id,
  CONCAT(l.building, ' ', l.room) AS location_label,
  mydb.fn_has_active_assignment(c.computer_id) AS has_active_assignment,
  mydb.fn_computer_software_count(c.computer_id) AS installed_software_count,
  EXISTS (
    SELECT 1
    FROM mydb.deaccessions d
    WHERE d.computer_id = c.computer_id
  ) AS has_deaccession_record,
  va.assignment_id AS active_assignment_id,
  va.assignment_type AS active_assignment_type,
  va.user_name AS active_assignee
FROM mydb.computers c
JOIN mydb.locations l
  ON l.location_id = c.current_location_id
LEFT JOIN mydb.v_active_assignments va
  ON va.computer_id = c.computer_id;

CREATE OR REPLACE VIEW mydb.v_report_computers_by_status_device AS
SELECT
  status,
  device_type,
  COUNT(*)::INT AS computer_count
FROM mydb.computers
GROUP BY status, device_type
ORDER BY status, device_type;

CREATE OR REPLACE VIEW mydb.v_report_active_assignments_by_department AS
SELECT
  department,
  role_type,
  COUNT(*)::INT AS active_assignment_count
FROM mydb.v_active_assignments
GROUP BY department, role_type
ORDER BY active_assignment_count DESC, department, role_type;

CREATE OR REPLACE VIEW mydb.v_report_software_install_counts AS
SELECT
  vendor,
  software_category,
  software_name,
  COUNT(*)::INT AS installation_count
FROM mydb.v_software_installations
GROUP BY vendor, software_category, software_name
ORDER BY installation_count DESC, software_name;

CREATE OR REPLACE VIEW mydb.v_report_deaccessions_by_reason AS
SELECT
  COALESCE(reason, 'Unspecified') AS reason_label,
  COUNT(*)::INT AS deaccession_count
FROM mydb.deaccessions
GROUP BY COALESCE(reason, 'Unspecified')
ORDER BY deaccession_count DESC, reason_label;

-- =========================
-- trigger functions
-- =========================
CREATE OR REPLACE FUNCTION mydb.trg_assignments_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT status
  INTO current_status
  FROM mydb.computers
  WHERE computer_id = NEW.computer_id
  FOR UPDATE;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'The selected computer does not exist.' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.returned_date IS NOT NULL THEN
      RAISE EXCEPTION 'Use the return workflow instead of inserting a returned assignment.' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.assignment_type = 'long_term' AND current_status <> 'available' THEN
      RAISE EXCEPTION 'Long-term assignments require a computer in available status.' USING ERRCODE = 'P0001';
    ELSIF NEW.assignment_type = 'loaner' AND current_status <> 'available_loaner' THEN
      RAISE EXCEPTION 'Loaner assignments require a computer in available_loaner status.' USING ERRCODE = 'P0001';
    END IF;

    IF mydb.fn_has_active_assignment(NEW.computer_id) THEN
      RAISE EXCEPTION 'That computer already has an active assignment.' USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.user_id <> OLD.user_id OR NEW.computer_id <> OLD.computer_id THEN
    RAISE EXCEPTION 'User and computer cannot be changed on an existing assignment.' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.assignment_type <> OLD.assignment_type OR NEW.assigned_date <> OLD.assigned_date THEN
    RAISE EXCEPTION 'Assignment type and assigned date are managed at creation time.' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.returned_date IS NULL AND NEW.returned_date IS NOT NULL THEN
    IF OLD.assignment_type = 'loaner' AND NEW.post_return_status IS NOT NULL THEN
      RAISE EXCEPTION 'Loaner returns do not use a post-return status.' USING ERRCODE = 'P0001';
    END IF;

    IF OLD.assignment_type = 'long_term'
       AND NEW.post_return_status NOT IN ('available', 'wiped', 'in-repair') THEN
      RAISE EXCEPTION 'Long-term returns require a post-return status of available, wiped, or in-repair.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF OLD.returned_date IS NOT NULL THEN
    IF NEW.returned_date IS NULL THEN
      RAISE EXCEPTION 'Returned assignments cannot be reopened.' USING ERRCODE = 'P0001';
    END IF;

    IF OLD.assignment_type = 'long_term'
       AND NEW.post_return_status NOT IN ('available', 'wiped', 'in-repair') THEN
      RAISE EXCEPTION 'Returned long-term assignments must keep a valid post-return status.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mydb.trg_assignments_after_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE mydb.computers
    SET status = 'assigned'
    WHERE computer_id = NEW.computer_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.returned_date IS NULL AND NEW.returned_date IS NOT NULL THEN
      UPDATE mydb.computers
      SET status = CASE
        WHEN NEW.assignment_type = 'loaner' THEN 'available_loaner'
        ELSE NEW.post_return_status
      END
      WHERE computer_id = NEW.computer_id;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.returned_date IS NULL THEN
      UPDATE mydb.computers
      SET status = CASE
        WHEN OLD.assignment_type = 'loaner' THEN 'available_loaner'
        ELSE 'available'
      END
      WHERE computer_id = OLD.computer_id;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION mydb.trg_deaccessions_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND mydb.fn_has_active_assignment(NEW.computer_id) THEN
    RAISE EXCEPTION 'Cannot deaccession a computer with an active assignment.' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.computer_id <> OLD.computer_id THEN
    RAISE EXCEPTION 'The related computer cannot be changed on a deaccession record.' USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION mydb.trg_deaccessions_after_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE mydb.computers
    SET status = 'wiped'
    WHERE computer_id = OLD.computer_id;

    RETURN OLD;
  END IF;

  UPDATE mydb.computers
  SET status = 'deaccessioned'
  WHERE computer_id = NEW.computer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_before_write ON mydb.assignments;
CREATE TRIGGER trg_assignments_before_write
BEFORE INSERT OR UPDATE OR DELETE
ON mydb.assignments
FOR EACH ROW
EXECUTE FUNCTION mydb.trg_assignments_before_write();

DROP TRIGGER IF EXISTS trg_assignments_after_write ON mydb.assignments;
CREATE TRIGGER trg_assignments_after_write
AFTER INSERT OR UPDATE OR DELETE
ON mydb.assignments
FOR EACH ROW
EXECUTE FUNCTION mydb.trg_assignments_after_write();

DROP TRIGGER IF EXISTS trg_deaccessions_before_write ON mydb.deaccessions;
CREATE TRIGGER trg_deaccessions_before_write
BEFORE INSERT OR UPDATE
ON mydb.deaccessions
FOR EACH ROW
EXECUTE FUNCTION mydb.trg_deaccessions_before_write();

DROP TRIGGER IF EXISTS trg_deaccessions_after_write ON mydb.deaccessions;
CREATE TRIGGER trg_deaccessions_after_write
AFTER INSERT OR UPDATE OR DELETE
ON mydb.deaccessions
FOR EACH ROW
EXECUTE FUNCTION mydb.trg_deaccessions_after_write();

-- =========================
-- procedures
-- =========================
CREATE OR REPLACE PROCEDURE mydb.sp_assign_computer(
  IN p_user_id INT,
  IN p_computer_id INT,
  IN p_assignment_type TEXT,
  IN p_assigned_date DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO mydb.assignments (
    user_id,
    computer_id,
    assignment_type,
    assigned_date
  )
  VALUES (
    p_user_id,
    p_computer_id,
    p_assignment_type,
    p_assigned_date
  );
END;
$$;

CREATE OR REPLACE PROCEDURE mydb.sp_return_computer(
  IN p_assignment_id INT,
  IN p_returned_date DATE,
  IN p_post_return_status TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_record mydb.assignments%ROWTYPE;
BEGIN
  SELECT *
  INTO assignment_record
  FROM mydb.assignments
  WHERE assignment_id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected assignment does not exist.' USING ERRCODE = 'P0001';
  END IF;

  IF assignment_record.returned_date IS NOT NULL THEN
    RAISE EXCEPTION 'That assignment has already been returned.' USING ERRCODE = 'P0001';
  END IF;

  IF assignment_record.assignment_type = 'loaner' THEN
    UPDATE mydb.assignments
    SET returned_date = p_returned_date,
        post_return_status = NULL
    WHERE assignment_id = p_assignment_id;
    RETURN;
  END IF;

  IF p_post_return_status NOT IN ('available', 'wiped', 'in-repair') THEN
    RAISE EXCEPTION 'Long-term returns require a status of available, wiped, or in-repair.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE mydb.assignments
  SET returned_date = p_returned_date,
      post_return_status = p_post_return_status
  WHERE assignment_id = p_assignment_id;
END;
$$;

CREATE OR REPLACE PROCEDURE mydb.sp_deaccession_computer(
  IN p_computer_id INT,
  IN p_deaccession_date DATE,
  IN p_reason VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF mydb.fn_has_active_assignment(p_computer_id) THEN
    RAISE EXCEPTION 'Cannot deaccession a computer with an active assignment.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO mydb.deaccessions (
    deaccession_date,
    reason,
    computer_id
  )
  VALUES (
    p_deaccession_date,
    p_reason,
    p_computer_id
  );
END;
$$;
