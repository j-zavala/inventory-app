const express = require("express");

const { pool } = require("../lib/db");
const {
  emptyToNull,
  getDbErrorMessage,
  getFlash,
  parsePositiveId,
  redirectWithMessage,
  toDateInput,
} = require("../lib/helpers");
const {
  getComputerOptions,
  getSoftwareOptions,
} = require("../lib/lookups");

const router = express.Router();

function buildCreateForm(source = {}) {
  return {
    computer_id: source.computer_id ? String(source.computer_id).trim() : "",
    install_date: toDateInput(source.install_date),
    installed_version: source.installed_version
      ? String(source.installed_version).trim()
      : "",
    software_id: source.software_id ? String(source.software_id).trim() : "",
  };
}

function validateCreateForm(record) {
  const errors = [];

  if (!parsePositiveId(record.computer_id)) {
    errors.push("Choose a valid computer.");
  }

  if (!parsePositiveId(record.software_id)) {
    errors.push("Choose valid software.");
  }

  return errors;
}

function buildCreateFields(computerOptions, softwareOptions) {
  return [
    {
      label: "Computer",
      name: "computer_id",
      options: computerOptions,
      required: true,
      type: "select",
    },
    {
      label: "Software",
      name: "software_id",
      options: softwareOptions,
      required: true,
      type: "select",
    },
    {
      label: "Installed version",
      name: "installed_version",
      type: "text",
    },
    {
      label: "Install date",
      name: "install_date",
      type: "date",
    },
  ];
}

function buildEditForm(source = {}) {
  return {
    computer_label: source.computer_label || "",
    install_date: toDateInput(source.install_date),
    installed_version: source.installed_version
      ? String(source.installed_version).trim()
      : "",
    software_label: source.software_label || "",
  };
}

function buildEditFields() {
  return [
    { label: "Computer", name: "computer_label", type: "readonly" },
    { label: "Software", name: "software_label", type: "readonly" },
    {
      label: "Installed version",
      name: "installed_version",
      type: "text",
    },
    {
      label: "Install date",
      name: "install_date",
      type: "date",
    },
  ];
}

async function getInstallation(computerId, softwareId) {
  const { rows } = await pool.query(
    `
      SELECT
        cs.computer_id,
        cs.software_id,
        cs.installed_version,
        cs.install_date,
        CONCAT(c.asset_tag, ' - ', COALESCE(c.manufacturer, ''), CASE WHEN c.model IS NOT NULL THEN ' ' || c.model ELSE '' END) AS computer_label,
        s.software_name AS software_label
      FROM mydb.computers_software cs
      JOIN mydb.computers c
        ON c.computer_id = cs.computer_id
      JOIN mydb.software s
        ON s.software_id = cs.software_id
      WHERE cs.computer_id = $1
        AND cs.software_id = $2
    `,
    [computerId, softwareId],
  );

  return rows[0] || null;
}

function renderCreateForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/software-installations",
    errorMessage: options.errorMessage || null,
    fields: buildCreateFields(options.computerOptions, options.softwareOptions),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "software-installations",
    pageTitle: options.pageTitle,
    record: options.record,
    submitLabel: options.submitLabel,
    title: options.title,
  });
}

function renderEditForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/software-installations",
    errorMessage: options.errorMessage || null,
    fields: buildEditFields(),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "software-installations",
    pageTitle: options.pageTitle,
    record: options.record,
    submitLabel: options.submitLabel,
    title: options.title,
  });
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        computer_id,
        software_id,
        asset_tag,
        software_name,
        vendor,
        software_category,
        installed_version,
        TO_CHAR(install_date, 'YYYY-MM-DD') AS install_date
      FROM mydb.v_software_installations
      ORDER BY asset_tag, software_name
    `);

    res.render("resource-list", {
      columns: [
        { label: "Computer", key: "asset_tag" },
        { label: "Software", key: "software_name" },
        { label: "Vendor", render: (row) => row.vendor || "—" },
        {
          label: "Category",
          render: (row) => row.software_category || "—",
        },
        {
          label: "Version",
          render: (row) => row.installed_version || "—",
        },
        {
          label: "Install date",
          render: (row) => row.install_date || "—",
        },
      ],
      createHref: "/software-installations/new",
      createLabel: "Add installation",
      emptyMessage: "No software installations have been recorded yet.",
      intro:
        "This join table shows which software titles are installed on each computer.",
      navKey: "software-installations",
      pageTitle: "Software Installations",
      rowActions: [
        {
          className: "button-secondary",
          href: (row) =>
            `/software-installations/${row.computer_id}/${row.software_id}/edit`,
          label: "Edit",
          method: "get",
        },
        {
          className: "button-danger",
          confirm: "Delete this installation record?",
          href: (row) =>
            `/software-installations/${row.computer_id}/${row.software_id}/delete`,
          label: "Delete",
          method: "post",
        },
      ],
      rows,
      title: "Software installations",
      ...getFlash(req),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/new", async (req, res, next) => {
  try {
    const [computerOptions, softwareOptions] = await Promise.all([
      getComputerOptions(),
      getSoftwareOptions(),
    ]);

    return renderCreateForm(res, {
      computerOptions,
      formAction: "/software-installations",
      intro:
        "Add a join-table row to track software installed on a computer.",
      pageTitle: "Add Installation",
      record: buildCreateForm(),
      softwareOptions,
      submitLabel: "Create installation",
      title: "Add installation",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  const record = buildCreateForm(req.body);
  const errors = validateCreateForm(record);

  try {
    const [computerOptions, softwareOptions] = await Promise.all([
      getComputerOptions(),
      getSoftwareOptions(),
    ]);

    if (errors.length > 0) {
      return renderCreateForm(res, {
        computerOptions,
        errorMessage: errors.join(" "),
        formAction: "/software-installations",
        intro:
          "Add a join-table row to track software installed on a computer.",
        pageTitle: "Add Installation",
        record,
        softwareOptions,
        statusCode: 400,
        submitLabel: "Create installation",
        title: "Add installation",
      });
    }

    await pool.query(
      `
        INSERT INTO mydb.computers_software (
          computer_id,
          software_id,
          installed_version,
          install_date
        )
        VALUES ($1, $2, $3, $4)
      `,
      [
        parsePositiveId(record.computer_id),
        parsePositiveId(record.software_id),
        emptyToNull(record.installed_version),
        emptyToNull(record.install_date),
      ],
    );

    return redirectWithMessage(
      res,
      "/software-installations",
      "success",
      "The installation record was created.",
    );
  } catch (error) {
    try {
      const [computerOptions, softwareOptions] = await Promise.all([
        getComputerOptions(),
        getSoftwareOptions(),
      ]);

      return renderCreateForm(res, {
        computerOptions,
        errorMessage: getDbErrorMessage(error),
        formAction: "/software-installations",
        intro:
          "Add a join-table row to track software installed on a computer.",
        pageTitle: "Add Installation",
        record,
        softwareOptions,
        statusCode: 400,
        submitLabel: "Create installation",
        title: "Add installation",
      });
    } catch (lookupError) {
      return next(lookupError);
    }
  }
});

router.get("/:computerId/:softwareId/edit", async (req, res, next) => {
  try {
    const record = await getInstallation(
      req.params.computerId,
      req.params.softwareId,
    );

    if (!record) {
      return res.status(404).render("error", {
        errorDetails: "The requested installation record could not be found.",
        navKey: "software-installations",
        pageTitle: "Installation Not Found",
        title: "Installation not found",
      });
    }

    return renderEditForm(res, {
      formAction: `/software-installations/${req.params.computerId}/${req.params.softwareId}`,
      intro:
        "You can edit the installation metadata here. Changing the computer or software pair is handled by delete plus recreate.",
      pageTitle: "Edit Installation",
      record: buildEditForm(record),
      submitLabel: "Save changes",
      title: "Edit installation",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:computerId/:softwareId", async (req, res, next) => {
  try {
    const existingRecord = await getInstallation(
      req.params.computerId,
      req.params.softwareId,
    );

    if (!existingRecord) {
      return res.status(404).render("error", {
        errorDetails: "The requested installation record could not be found.",
        navKey: "software-installations",
        pageTitle: "Installation Not Found",
        title: "Installation not found",
      });
    }

    const record = buildEditForm({
      ...existingRecord,
      install_date: req.body.install_date,
      installed_version: req.body.installed_version,
    });

    await pool.query(
      `
        UPDATE mydb.computers_software
        SET installed_version = $1,
            install_date = $2
        WHERE computer_id = $3
          AND software_id = $4
      `,
      [
        emptyToNull(record.installed_version),
        emptyToNull(record.install_date),
        req.params.computerId,
        req.params.softwareId,
      ],
    );

    return redirectWithMessage(
      res,
      "/software-installations",
      "success",
      "The installation record was updated.",
    );
  } catch (error) {
    try {
      const existingRecord = await getInstallation(
        req.params.computerId,
        req.params.softwareId,
      );

      if (!existingRecord) {
        return res.status(404).render("error", {
          errorDetails: "The requested installation record could not be found.",
          navKey: "software-installations",
          pageTitle: "Installation Not Found",
          title: "Installation not found",
        });
      }

      return renderEditForm(res, {
        errorMessage: getDbErrorMessage(error),
        formAction: `/software-installations/${req.params.computerId}/${req.params.softwareId}`,
        intro:
          "You can edit the installation metadata here. Changing the computer or software pair is handled by delete plus recreate.",
        pageTitle: "Edit Installation",
        record: buildEditForm({
          ...existingRecord,
          install_date: req.body.install_date,
          installed_version: req.body.installed_version,
        }),
        statusCode: 400,
        submitLabel: "Save changes",
        title: "Edit installation",
      });
    } catch (lookupError) {
      return next(lookupError);
    }
  }
});

router.post("/:computerId/:softwareId/delete", async (req, res) => {
  try {
    const result = await pool.query(
      `
        DELETE FROM mydb.computers_software
        WHERE computer_id = $1
          AND software_id = $2
      `,
      [req.params.computerId, req.params.softwareId],
    );

    if (result.rowCount === 0) {
      return redirectWithMessage(
        res,
        "/software-installations",
        "error",
        "That installation record could not be found.",
      );
    }

    return redirectWithMessage(
      res,
      "/software-installations",
      "success",
      "The installation record was deleted.",
    );
  } catch (error) {
    return redirectWithMessage(
      res,
      "/software-installations",
      "error",
      getDbErrorMessage(error),
    );
  }
});

module.exports = router;
