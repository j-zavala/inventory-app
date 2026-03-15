require("dotenv").config();

const path = require("path");
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT) || 3000;

const DEVICE_TYPES = ["desktop", "laptop", "tablet"];
const STATUSES = [
  "available",
  "assigned",
  "available_loaner",
  "deaccessioned",
  "wiped",
  "in-repair",
];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Add it to your .env file.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL client error:", error);
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

function emptyToNull(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmedValue = String(value).trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function buildComputerFormData(source = {}) {
  return {
    asset_tag: source.asset_tag ? String(source.asset_tag).trim() : "",
    serial_number: source.serial_number
      ? String(source.serial_number).trim()
      : "",
    device_type: source.device_type ? String(source.device_type).trim() : "",
    manufacturer: source.manufacturer ? String(source.manufacturer).trim() : "",
    model: source.model ? String(source.model).trim() : "",
    purchase_date: source.purchase_date
      ? String(source.purchase_date).trim()
      : "",
    status: source.status ? String(source.status).trim() : "",
    location_display: source.location_display
      ? String(source.location_display).trim()
      : "",
  };
}

function validateComputer(computer) {
  const errors = [];

  if (!computer.asset_tag) {
    errors.push("Asset tag is required.");
  }

  if (!computer.serial_number) {
    errors.push("Serial number is required.");
  }

  if (!DEVICE_TYPES.includes(computer.device_type)) {
    errors.push("Choose a valid device type.");
  }

  if (!STATUSES.includes(computer.status)) {
    errors.push("Choose a valid status.");
  }

  return errors;
}

function toComputerValues(computer) {
  return [
    computer.asset_tag,
    computer.serial_number,
    emptyToNull(computer.device_type),
    emptyToNull(computer.manufacturer),
    emptyToNull(computer.model),
    emptyToNull(computer.purchase_date),
    emptyToNull(computer.status),
  ];
}

function parsePositiveId(value) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getDbErrorMessage(error) {
  if (error.code === "23505") {
    if (error.constraint && error.constraint.includes("asset_tag")) {
      return "That asset tag is already in use.";
    }

    if (error.constraint && error.constraint.includes("serial_number")) {
      return "That serial number is already in use.";
    }

    return "That value must be unique, but it is already in use.";
  }

  if (error.code === "23503" && error.constraint === "fk_computers_location") {
    return "Location assignment is handled outside the part 2 computers form.";
  }

  if (error.code === "22P02") {
    return "One of the entered values has the wrong format.";
  }

  if (error.code === "23514") {
    return "One of the entered values does not match the allowed options.";
  }

  return "The database could not save that change. Please review the form and try again.";
}

function renderComputerForm(res, viewName, options) {
  res.status(options.statusCode || 200).render(viewName, {
    pageTitle: options.pageTitle,
    formAction: options.formAction,
    submitLabel: options.submitLabel,
    intro: options.intro,
    computer: options.computer,
    deviceTypes: DEVICE_TYPES,
    statuses: STATUSES,
    errorMessage: options.errorMessage || null,
  });
}

app.get("/", async (req, res, next) => {
  try {
    const summaryQuery = `
      SELECT
        COUNT(*)::INT AS total_computers,
        COUNT(*) FILTER (WHERE status = 'available')::INT AS available_count,
        COUNT(*) FILTER (WHERE status = 'assigned')::INT AS assigned_count,
        COUNT(*) FILTER (WHERE status = 'available_loaner')::INT AS loaner_count
      FROM mydb.computers
    `;

    const recentComputersQuery = `
      SELECT computer_id, asset_tag, device_type, status, manufacturer, model
      FROM mydb.computers
      ORDER BY computer_id DESC
      LIMIT 5
    `;

    const [{ rows: summaryRows }, { rows: recentComputers }] =
      await Promise.all([
        pool.query(summaryQuery),
        pool.query(recentComputersQuery),
      ]);

    res.render("index", {
      summary: summaryRows[0],
      recentComputers,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/computers", async (req, res, next) => {
  try {
    const query = `
      SELECT
        c.computer_id,
        c.asset_tag,
        c.serial_number,
        c.device_type,
        c.manufacturer,
        c.model,
        TO_CHAR(c.purchase_date, 'YYYY-MM-DD') AS purchase_date,
        c.status,
        c.current_location_id,
        CASE
          WHEN l.location_id IS NULL THEN NULL
          ELSE CONCAT(l.building, ' ', l.room)
        END AS location_label
      FROM mydb.computers c
      LEFT JOIN mydb.locations l
        ON l.location_id = c.current_location_id
      ORDER BY c.computer_id DESC
    `;

    const { rows } = await pool.query(query);

    res.render("computers/list", {
      computers: rows,
      successMessage: req.query.success || null,
      errorMessage: req.query.error || null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/computers/new", (req, res) => {
  renderComputerForm(res, "computers/new", {
    pageTitle: "Add Computer",
    formAction: "/computers",
    submitLabel: "Create Computer",
    intro:
      "Use this form to add a single device record to the computers table.",
    computer: buildComputerFormData(),
  });
});

app.post("/computers", async (req, res) => {
  const computer = buildComputerFormData(req.body);
  const validationErrors = validateComputer(computer);

  if (validationErrors.length > 0) {
    return renderComputerForm(res, "computers/new", {
      statusCode: 400,
      pageTitle: "Add Computer",
      formAction: "/computers",
      submitLabel: "Create Computer",
      intro:
        "Use this form to add a single device record to the computers table.",
      computer,
      errorMessage: validationErrors.join(" "),
    });
  }

  try {
    const insertQuery = `
      INSERT INTO mydb.computers (
        asset_tag,
        serial_number,
        device_type,
        manufacturer,
        model,
        purchase_date,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING asset_tag
    `;

    const {
      rows: [createdComputer],
    } = await pool.query(insertQuery, toComputerValues(computer));

    const successMessage = encodeURIComponent(
      `Computer ${createdComputer.asset_tag} was added successfully.`,
    );
    return res.redirect(`/computers?success=${successMessage}`);
  } catch (error) {
    return renderComputerForm(res, "computers/new", {
      statusCode: 400,
      pageTitle: "Add Computer",
      formAction: "/computers",
      submitLabel: "Create Computer",
      intro:
        "Use this form to add a single device record to the computers table.",
      computer,
      errorMessage: getDbErrorMessage(error),
    });
  }
});

app.get("/computers/:id/edit", async (req, res, next) => {
  const computerId = parsePositiveId(req.params.id);

  if (!computerId) {
    return res.status(404).render("error", {
      pageTitle: "Computer Not Found",
      heading: "Computer not found",
      message: "Computer IDs must be positive whole numbers.",
    });
  }

  try {
    const query = `
      SELECT
        computer_id,
        asset_tag,
        serial_number,
        device_type,
        manufacturer,
        model,
        TO_CHAR(purchase_date, 'YYYY-MM-DD') AS purchase_date,
        status,
        CASE
          WHEN current_location_id IS NULL THEN ''
          ELSE 'Linked location record'
        END AS location_display
      FROM mydb.computers
      WHERE computer_id = $1
    `;

    const { rows } = await pool.query(query, [computerId]);

    if (rows.length === 0) {
      return res.status(404).render("error", {
        pageTitle: "Computer Not Found",
        heading: "Computer not found",
        message:
          "That computer record does not exist or may have been deleted.",
      });
    }

    return renderComputerForm(res, "computers/edit", {
      pageTitle: "Edit Computer",
      formAction: `/computers/${req.params.id}`,
      submitLabel: "Save Changes",
      intro: "Update the stored values for this computer record.",
      computer: buildComputerFormData(rows[0]),
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/computers/:id", async (req, res, next) => {
  const computerId = parsePositiveId(req.params.id);
  const computer = buildComputerFormData(req.body);
  const validationErrors = validateComputer(computer);

  if (!computerId) {
    return renderComputerForm(res, "computers/edit", {
      statusCode: 400,
      pageTitle: "Edit Computer",
      formAction: `/computers/${req.params.id}`,
      submitLabel: "Save Changes",
      intro: "Update the stored values for this computer record.",
      computer,
      errorMessage: "Computer IDs must be positive whole numbers.",
    });
  }

  if (validationErrors.length > 0) {
    return renderComputerForm(res, "computers/edit", {
      statusCode: 400,
      pageTitle: "Edit Computer",
      formAction: `/computers/${req.params.id}`,
      submitLabel: "Save Changes",
      intro: "Update the stored values for this computer record.",
      computer,
      errorMessage: validationErrors.join(" "),
    });
  }

  try {
    const updateQuery = `
      UPDATE mydb.computers
      SET
        asset_tag = $1,
        serial_number = $2,
        device_type = $3,
        manufacturer = $4,
        model = $5,
        purchase_date = $6,
        status = $7
      WHERE computer_id = $8
      RETURNING asset_tag
    `;

    const values = [...toComputerValues(computer), computerId];
    const { rows } = await pool.query(updateQuery, values);

    if (rows.length === 0) {
      return res.status(404).render("error", {
        pageTitle: "Computer Not Found",
        heading: "Computer not found",
        message:
          "That computer record does not exist or may have been deleted.",
      });
    }

    const successMessage = encodeURIComponent(
      `Computer ${rows[0].asset_tag} was updated successfully.`,
    );
    return res.redirect(`/computers?success=${successMessage}`);
  } catch (error) {
    if (
      error.code === "23503" ||
      error.code === "23505" ||
      error.code === "23514"
    ) {
      return renderComputerForm(res, "computers/edit", {
        statusCode: 400,
        pageTitle: "Edit Computer",
        formAction: `/computers/${req.params.id}`,
        submitLabel: "Save Changes",
        intro: "Update the stored values for this computer record.",
        computer,
        errorMessage: getDbErrorMessage(error),
      });
    }

    return next(error);
  }
});

app.post("/computers/:id/delete", async (req, res) => {
  const computerId = parsePositiveId(req.params.id);

  if (!computerId) {
    const errorMessage = encodeURIComponent(
      "Computer IDs must be positive whole numbers.",
    );
    return res.redirect(`/computers?error=${errorMessage}`);
  }

  try {
    const deleteQuery = `
      DELETE FROM mydb.computers
      WHERE computer_id = $1
      RETURNING asset_tag
    `;

    const { rows } = await pool.query(deleteQuery, [computerId]);

    if (rows.length === 0) {
      const errorMessage = encodeURIComponent(
        "That computer record could not be found.",
      );
      return res.redirect(`/computers?error=${errorMessage}`);
    }

    const successMessage = encodeURIComponent(
      `Computer ${rows[0].asset_tag} was deleted successfully.`,
    );
    return res.redirect(`/computers?success=${successMessage}`);
  } catch (error) {
    const errorMessage = encodeURIComponent(getDbErrorMessage(error));
    return res.redirect(`/computers?error=${errorMessage}`);
  }
});

app.use((req, res) => {
  res.status(404).render("error", {
    pageTitle: "Page Not Found",
    heading: "Page not found",
    message: "Try the computers list or return to the dashboard.",
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).render("error", {
    pageTitle: "Server Error",
    heading: "Something went wrong",
    message:
      "The app hit an unexpected error. Check the terminal for details and try again.",
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Inventory app running at http://localhost:${port}`);
  });
}

module.exports = { app, pool };
