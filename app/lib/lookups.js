const { pool } = require("./db");
const { mapOptions } = require("./helpers");

async function getLocationOptions() {
  const { rows } = await pool.query(`
    SELECT
      location_id,
      CONCAT(building, ' ', room) AS location_label
    FROM mydb.locations
    ORDER BY building, room
  `);

  return mapOptions(rows, "location_id", (row) => row.location_label);
}

async function getUserOptions() {
  const { rows } = await pool.query(`
    SELECT
      user_id,
      CONCAT(first_name, ' ', last_name) AS full_name,
      department,
      role_type
    FROM mydb.users
    ORDER BY last_name, first_name
  `);

  return mapOptions(
    rows,
    "user_id",
    (row) => `${row.full_name} (${row.department || "No department"} / ${row.role_type})`,
  );
}

async function getSoftwareOptions() {
  const { rows } = await pool.query(`
    SELECT
      software_id,
      software_name,
      software_category,
      vendor
    FROM mydb.software
    ORDER BY software_name
  `);

  return mapOptions(
    rows,
    "software_id",
    (row) =>
      `${row.software_name} (${row.vendor || "Unknown vendor"}${row.software_category ? ` / ${row.software_category}` : ""})`,
  );
}

async function getComputerOptions() {
  const { rows } = await pool.query(`
    SELECT
      computer_id,
      asset_tag,
      manufacturer,
      model,
      status
    FROM mydb.computers
    ORDER BY asset_tag
  `);

  return mapOptions(
    rows,
    "computer_id",
    (row) =>
      `${row.asset_tag} - ${[row.manufacturer, row.model].filter(Boolean).join(" ") || "Unknown model"} [${row.status}]`,
  );
}

async function getAssignableComputerOptions() {
  const { rows } = await pool.query(`
    SELECT
      computer_id,
      asset_tag,
      manufacturer,
      model,
      status
    FROM mydb.computers
    WHERE status IN ('available', 'available_loaner')
    ORDER BY asset_tag
  `);

  return mapOptions(
    rows,
    "computer_id",
    (row) =>
      `${row.asset_tag} - ${[row.manufacturer, row.model].filter(Boolean).join(" ") || "Unknown model"} [${row.status}]`,
  );
}

async function getDeaccessionCandidateOptions() {
  const { rows } = await pool.query(`
    SELECT
      computer_id,
      asset_tag,
      manufacturer,
      model,
      status
    FROM mydb.v_computer_overview
    WHERE has_deaccession_record = FALSE
      AND has_active_assignment = FALSE
      AND status <> 'deaccessioned'
    ORDER BY asset_tag
  `);

  return mapOptions(
    rows,
    "computer_id",
    (row) =>
      `${row.asset_tag} - ${[row.manufacturer, row.model].filter(Boolean).join(" ") || "Unknown model"} [${row.status}]`,
  );
}

module.exports = {
  getAssignableComputerOptions,
  getComputerOptions,
  getDeaccessionCandidateOptions,
  getLocationOptions,
  getSoftwareOptions,
  getUserOptions,
};
