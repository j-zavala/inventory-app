SET search_path TO mydb;

CREATE OR REPLACE VIEW mydb.v_computers_by_status AS
SELECT
  status,
  COUNT(*)::INT AS computer_count
FROM mydb.computers
GROUP BY status
ORDER BY status;

CREATE OR REPLACE FUNCTION mydb.fn_assignment_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.returned_date IS NULL THEN
    UPDATE mydb.computers
    SET status = 'assigned'
    WHERE computer_id = NEW.computer_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignment_marks_computer_assigned
AFTER INSERT ON mydb.assignments
FOR EACH ROW
EXECUTE FUNCTION mydb.fn_assignment_status_trigger();

CREATE OR REPLACE PROCEDURE mydb.sp_create_assignment(
  IN p_user_id INT,
  IN p_computer_id INT,
  IN p_assignment_type TEXT,
  IN p_assigned_date DATE,
  IN p_returned_date DATE DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO mydb.assignments (
    user_id,
    computer_id,
    assignment_type,
    assigned_date,
    returned_date
  )
  VALUES (
    p_user_id,
    p_computer_id,
    p_assignment_type,
    p_assigned_date,
    p_returned_date
  );
END;
$$;
