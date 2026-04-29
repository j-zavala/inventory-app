const roleOptions = ["staff", "faculty", "it"];
const deviceOptions = ["desktop", "laptop", "tablet"];
const statusOptions = ["available", "assigned", "retired"];
const assignmentOptions = ["long_term", "loaner"];

const locationOptionsSql = `
  SELECT
    location_id AS value,
    building || ' ' || room AS label
  FROM mydb.locations
  ORDER BY building, room
`;

const userOptionsSql = `
  SELECT
    user_id AS value,
    first_name || ' ' || last_name AS label
  FROM mydb.users
  ORDER BY last_name, first_name
`;

const computerOptionsSql = `
  SELECT
    computer_id AS value,
    asset_tag || ' - ' || COALESCE(model, 'Unknown model') AS label
  FROM mydb.computers
  ORDER BY asset_tag
`;

const softwareOptionsSql = `
  SELECT
    software_id AS value,
    software_name AS label
  FROM mydb.software
  ORDER BY software_name
`;

module.exports = [
  {
    key: "users",
    label: "Users",
    path: "/users",
    table: "users",
    idColumns: ["user_id"],
    orderBy: "user_id",
    intro: "People who can receive university computers.",
    fields: [
      { name: "first_name", label: "First name", required: true },
      { name: "last_name", label: "Last name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "department", label: "Department" },
      { name: "role_type", label: "Role", type: "select", options: roleOptions, required: true },
    ],
    listColumns: [
      { key: "user_id", label: "ID" },
      { key: "first_name", label: "First" },
      { key: "last_name", label: "Last" },
      { key: "email", label: "Email" },
      { key: "role_type", label: "Role" },
    ],
  },
  {
    key: "locations",
    label: "Locations",
    path: "/locations",
    table: "locations",
    idColumns: ["location_id"],
    orderBy: "location_id",
    intro: "Buildings and rooms where computers are stored or used.",
    fields: [
      { name: "building", label: "Building", required: true },
      { name: "room", label: "Room", required: true },
    ],
    listColumns: [
      { key: "location_id", label: "ID" },
      { key: "building", label: "Building" },
      { key: "room", label: "Room" },
    ],
  },
  {
    key: "computers",
    label: "Computers",
    path: "/computers",
    table: "computers",
    idColumns: ["computer_id"],
    orderBy: "computer_id",
    intro: "Hardware assets tracked by IT.",
    listSql: `
      SELECT
        c.computer_id,
        c.asset_tag,
        c.device_type,
        c.status,
        l.building || ' ' || l.room AS location
      FROM mydb.computers c
      JOIN mydb.locations l ON l.location_id = c.current_location_id
      ORDER BY c.computer_id
    `,
    fields: [
      { name: "asset_tag", label: "Asset tag", required: true },
      { name: "serial_number", label: "Serial number", required: true },
      { name: "device_type", label: "Device type", type: "select", options: deviceOptions, required: true },
      { name: "manufacturer", label: "Manufacturer" },
      { name: "model", label: "Model" },
      { name: "purchase_date", label: "Purchase date", type: "date" },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
      { name: "current_location_id", label: "Location", type: "select", optionsSql: locationOptionsSql, required: true },
    ],
    listColumns: [
      { key: "computer_id", label: "ID" },
      { key: "asset_tag", label: "Asset" },
      { key: "device_type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "location", label: "Location" },
    ],
  },
  {
    key: "assignments",
    label: "Assignments",
    path: "/assignments",
    table: "assignments",
    idColumns: ["assignment_id"],
    orderBy: "assignment_id",
    intro: "Which user has which computer.",
    listSql: `
      SELECT
        a.assignment_id,
        u.first_name || ' ' || u.last_name AS user_name,
        c.asset_tag,
        a.assignment_type,
        a.assigned_date,
        a.returned_date
      FROM mydb.assignments a
      JOIN mydb.users u ON u.user_id = a.user_id
      JOIN mydb.computers c ON c.computer_id = a.computer_id
      ORDER BY a.assignment_id
    `,
    createProcedure: {
      sql: "CALL mydb.sp_create_assignment($1, $2, $3, $4, $5)",
      params: ["user_id", "computer_id", "assignment_type", "assigned_date", "returned_date"],
    },
    fields: [
      { name: "user_id", label: "User", type: "select", optionsSql: userOptionsSql, required: true },
      { name: "computer_id", label: "Computer", type: "select", optionsSql: computerOptionsSql, required: true },
      { name: "assignment_type", label: "Assignment type", type: "select", options: assignmentOptions, required: true },
      { name: "assigned_date", label: "Assigned date", type: "date", required: true },
      { name: "returned_date", label: "Returned date", type: "date" },
    ],
    listColumns: [
      { key: "assignment_id", label: "ID" },
      { key: "user_name", label: "User" },
      { key: "asset_tag", label: "Computer" },
      { key: "assignment_type", label: "Type" },
      { key: "assigned_date", label: "Assigned" },
      { key: "returned_date", label: "Returned" },
    ],
  },
  {
    key: "deaccessions",
    label: "Deaccessions",
    path: "/deaccessions",
    table: "deaccessions",
    idColumns: ["deaccession_id"],
    orderBy: "deaccession_id",
    intro: "Computers removed from service.",
    listSql: `
      SELECT
        d.deaccession_id,
        c.asset_tag,
        d.deaccession_date,
        d.reason
      FROM mydb.deaccessions d
      JOIN mydb.computers c ON c.computer_id = d.computer_id
      ORDER BY d.deaccession_id
    `,
    fields: [
      { name: "deaccession_date", label: "Date", type: "date", required: true },
      { name: "reason", label: "Reason" },
      { name: "computer_id", label: "Computer", type: "select", optionsSql: computerOptionsSql, required: true },
    ],
    listColumns: [
      { key: "deaccession_id", label: "ID" },
      { key: "asset_tag", label: "Computer" },
      { key: "deaccession_date", label: "Date" },
      { key: "reason", label: "Reason" },
    ],
  },
  {
    key: "software",
    label: "Software",
    path: "/software",
    table: "software",
    idColumns: ["software_id"],
    orderBy: "software_id",
    intro: "Software titles that may be installed on computers.",
    fields: [
      { name: "software_name", label: "Name", required: true },
      { name: "software_category", label: "Category" },
      { name: "vendor", label: "Vendor" },
    ],
    listColumns: [
      { key: "software_id", label: "ID" },
      { key: "software_name", label: "Name" },
      { key: "software_category", label: "Category" },
      { key: "vendor", label: "Vendor" },
    ],
  },
  {
    key: "software-installations",
    label: "Installs",
    path: "/software-installations",
    table: "computers_software",
    idColumns: ["computer_id", "software_id"],
    orderBy: "computer_id, software_id",
    intro: "The many-to-many table connecting computers and software.",
    listSql: `
      SELECT
        cs.computer_id,
        cs.software_id,
        c.asset_tag,
        s.software_name,
        cs.installed_version,
        cs.install_date
      FROM mydb.computers_software cs
      JOIN mydb.computers c ON c.computer_id = cs.computer_id
      JOIN mydb.software s ON s.software_id = cs.software_id
      ORDER BY c.asset_tag, s.software_name
    `,
    fields: [
      { name: "computer_id", label: "Computer", type: "select", optionsSql: computerOptionsSql, required: true },
      { name: "software_id", label: "Software", type: "select", optionsSql: softwareOptionsSql, required: true },
      { name: "installed_version", label: "Version" },
      { name: "install_date", label: "Install date", type: "date" },
    ],
    listColumns: [
      { key: "asset_tag", label: "Computer" },
      { key: "software_name", label: "Software" },
      { key: "installed_version", label: "Version" },
      { key: "install_date", label: "Installed" },
    ],
  },
];
