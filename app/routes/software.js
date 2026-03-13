const express = require("express");

const { pool } = require("../lib/db");
const {
  emptyToNull,
  getDbErrorMessage,
  getFlash,
  redirectWithMessage,
} = require("../lib/helpers");

const router = express.Router();

function buildSoftwareForm(source = {}) {
  return {
    software_category: source.software_category
      ? String(source.software_category).trim()
      : "",
    software_name: source.software_name
      ? String(source.software_name).trim()
      : "",
    vendor: source.vendor ? String(source.vendor).trim() : "",
  };
}

function validateSoftware(software) {
  const errors = [];

  if (!software.software_name) {
    errors.push("Software name is required.");
  }

  return errors;
}

function buildFields() {
  return [
    {
      label: "Software name",
      name: "software_name",
      required: true,
      type: "text",
    },
    {
      label: "Category",
      name: "software_category",
      type: "text",
    },
    {
      label: "Vendor",
      name: "vendor",
      type: "text",
    },
  ];
}

function renderForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/software",
    errorMessage: options.errorMessage || null,
    fields: buildFields(),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "software",
    pageTitle: options.pageTitle,
    record: options.software,
    submitLabel: options.submitLabel,
    title: options.title,
  });
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        s.software_id,
        s.software_name,
        s.software_category,
        s.vendor,
        COUNT(cs.computer_id)::INT AS install_count
      FROM mydb.software s
      LEFT JOIN mydb.computers_software cs
        ON cs.software_id = s.software_id
      GROUP BY s.software_id, s.software_name, s.software_category, s.vendor
      ORDER BY s.software_name
    `);

    res.render("resource-list", {
      columns: [
        { label: "ID", key: "software_id" },
        { label: "Software", key: "software_name" },
        {
          label: "Category",
          render: (row) => row.software_category || "—",
        },
        { label: "Vendor", render: (row) => row.vendor || "—" },
        { label: "Install count", key: "install_count" },
      ],
      createHref: "/software/new",
      createLabel: "Add software",
      emptyMessage: "No software titles have been added yet.",
      intro: "Maintain the software catalog used by the installation join table.",
      navKey: "software",
      pageTitle: "Software",
      rowActions: [
        {
          className: "button-secondary",
          href: (row) => `/software/${row.software_id}/edit`,
          label: "Edit",
          method: "get",
        },
        {
          className: "button-danger",
          confirm: "Delete this software record?",
          href: (row) => `/software/${row.software_id}/delete`,
          label: "Delete",
          method: "post",
        },
      ],
      rows,
      title: "Software",
      ...getFlash(req),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/new", (req, res) => {
  renderForm(res, {
    formAction: "/software",
    intro: "Add a software title so it can be assigned in the installation table.",
    pageTitle: "Add Software",
    software: buildSoftwareForm(),
    submitLabel: "Create software",
    title: "Add software",
  });
});

router.post("/", async (req, res) => {
  const software = buildSoftwareForm(req.body);
  const errors = validateSoftware(software);

  if (errors.length > 0) {
    return renderForm(res, {
      errorMessage: errors.join(" "),
      formAction: "/software",
      intro: "Add a software title so it can be assigned in the installation table.",
      pageTitle: "Add Software",
      software,
      statusCode: 400,
      submitLabel: "Create software",
      title: "Add software",
    });
  }

  try {
    await pool.query(
      `
        INSERT INTO mydb.software (
          software_name,
          software_category,
          vendor
        )
        VALUES ($1, $2, $3)
      `,
      [
        software.software_name,
        emptyToNull(software.software_category),
        emptyToNull(software.vendor),
      ],
    );

    return redirectWithMessage(
      res,
      "/software",
      "success",
      `Software ${software.software_name} was created.`,
    );
  } catch (error) {
    return renderForm(res, {
      errorMessage: getDbErrorMessage(error),
      formAction: "/software",
      intro: "Add a software title so it can be assigned in the installation table.",
      pageTitle: "Add Software",
      software,
      statusCode: 400,
      submitLabel: "Create software",
      title: "Add software",
    });
  }
});

router.get("/:softwareId/edit", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          software_id,
          software_name,
          software_category,
          vendor
        FROM mydb.software
        WHERE software_id = $1
      `,
      [req.params.softwareId],
    );

    if (rows.length === 0) {
      return res.status(404).render("error", {
        errorDetails: "The requested software record could not be found.",
        navKey: "software",
        pageTitle: "Software Not Found",
        title: "Software not found",
      });
    }

    return renderForm(res, {
      formAction: `/software/${req.params.softwareId}`,
      intro: "Update the software catalog entry used by installation records.",
      pageTitle: "Edit Software",
      software: buildSoftwareForm(rows[0]),
      submitLabel: "Save changes",
      title: "Edit software",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:softwareId", async (req, res) => {
  const software = buildSoftwareForm(req.body);
  const errors = validateSoftware(software);

  if (errors.length > 0) {
    return renderForm(res, {
      errorMessage: errors.join(" "),
      formAction: `/software/${req.params.softwareId}`,
      intro: "Update the software catalog entry used by installation records.",
      pageTitle: "Edit Software",
      software,
      statusCode: 400,
      submitLabel: "Save changes",
      title: "Edit software",
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE mydb.software
        SET software_name = $1,
            software_category = $2,
            vendor = $3
        WHERE software_id = $4
      `,
      [
        software.software_name,
        emptyToNull(software.software_category),
        emptyToNull(software.vendor),
        req.params.softwareId,
      ],
    );

    if (result.rowCount === 0) {
      return redirectWithMessage(
        res,
        "/software",
        "error",
        "That software record could not be found.",
      );
    }

    return redirectWithMessage(
      res,
      "/software",
      "success",
      `Software ${software.software_name} was updated.`,
    );
  } catch (error) {
    return renderForm(res, {
      errorMessage: getDbErrorMessage(error),
      formAction: `/software/${req.params.softwareId}`,
      intro: "Update the software catalog entry used by installation records.",
      pageTitle: "Edit Software",
      software,
      statusCode: 400,
      submitLabel: "Save changes",
      title: "Edit software",
    });
  }
});

router.post("/:softwareId/delete", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM mydb.software WHERE software_id = $1",
      [req.params.softwareId],
    );

    if (result.rowCount === 0) {
      return redirectWithMessage(
        res,
        "/software",
        "error",
        "That software record could not be found.",
      );
    }

    return redirectWithMessage(
      res,
      "/software",
      "success",
      "The software record was deleted.",
    );
  } catch (error) {
    return redirectWithMessage(
      res,
      "/software",
      "error",
      getDbErrorMessage(error),
    );
  }
});

module.exports = router;
