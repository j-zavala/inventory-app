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
const { getDeaccessionCandidateOptions } = require("../lib/lookups");

const router = express.Router();

function buildCreateForm(source = {}) {
  return {
    computer_id: source.computer_id ? String(source.computer_id).trim() : "",
    deaccession_date: toDateInput(source.deaccession_date),
    reason: source.reason ? String(source.reason).trim() : "",
  };
}

function validateCreateForm(record) {
  const errors = [];

  if (!parsePositiveId(record.computer_id)) {
    errors.push("Choose a valid computer.");
  }

  if (!record.deaccession_date) {
    errors.push("Deaccession date is required.");
  }

  return errors;
}

function buildCreateFields(computerOptions) {
  return [
    {
      helpText:
        "Only computers without an active assignment and without an existing deaccession record are listed.",
      label: "Computer",
      name: "computer_id",
      options: computerOptions,
      required: true,
      type: "select",
    },
    {
      label: "Deaccession date",
      name: "deaccession_date",
      required: true,
      type: "date",
    },
    {
      label: "Reason",
      name: "reason",
      span: "full",
      type: "textarea",
    },
  ];
}

function buildEditForm(source = {}) {
  return {
    computer_label: source.computer_label || "",
    deaccession_date: toDateInput(source.deaccession_date),
    reason: source.reason ? String(source.reason).trim() : "",
  };
}

function buildEditFields() {
  return [
    {
      label: "Computer",
      name: "computer_label",
      type: "readonly",
    },
    {
      label: "Deaccession date",
      name: "deaccession_date",
      required: true,
      type: "date",
    },
    {
      label: "Reason",
      name: "reason",
      span: "full",
      type: "textarea",
    },
  ];
}

async function getDeaccessionRecord(deaccessionId) {
  const { rows } = await pool.query(
    `
      SELECT
        d.deaccession_id,
        d.computer_id,
        d.deaccession_date,
        d.reason,
        CONCAT(c.asset_tag, ' - ', COALESCE(c.manufacturer, ''), CASE WHEN c.model IS NOT NULL THEN ' ' || c.model ELSE '' END) AS computer_label
      FROM mydb.deaccessions d
      JOIN mydb.computers c
        ON c.computer_id = d.computer_id
      WHERE d.deaccession_id = $1
    `,
    [deaccessionId],
  );

  return rows[0] || null;
}

function renderCreateForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/deaccessions",
    errorMessage: options.errorMessage || null,
    fields: buildCreateFields(options.computerOptions),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "deaccessions",
    pageTitle: options.pageTitle,
    record: options.record,
    submitLabel: options.submitLabel,
    title: options.title,
  });
}

function renderEditForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/deaccessions",
    errorMessage: options.errorMessage || null,
    fields: buildEditFields(),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "deaccessions",
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
        d.deaccession_id,
        c.asset_tag,
        c.device_type,
        TO_CHAR(d.deaccession_date, 'YYYY-MM-DD') AS deaccession_date,
        d.reason
      FROM mydb.deaccessions d
      JOIN mydb.computers c
        ON c.computer_id = d.computer_id
      ORDER BY d.deaccession_date DESC, d.deaccession_id DESC
    `);

    res.render("resource-list", {
      columns: [
        { label: "ID", key: "deaccession_id" },
        { label: "Computer", key: "asset_tag" },
        { label: "Device type", key: "device_type" },
        { label: "Date", key: "deaccession_date" },
        { label: "Reason", render: (row) => row.reason || "—" },
      ],
      createHref: "/deaccessions/new",
      createLabel: "Create deaccession",
      emptyMessage: "No deaccession records have been added yet.",
      intro:
        "Deaccession records are created through a workflow so active assignments are blocked and computer status syncs automatically.",
      navKey: "deaccessions",
      pageTitle: "Deaccessions",
      rowActions: [
        {
          className: "button-secondary",
          href: (row) => `/deaccessions/${row.deaccession_id}/edit`,
          label: "Edit",
          method: "get",
        },
        {
          className: "button-danger",
          confirm: "Delete this deaccession record?",
          href: (row) => `/deaccessions/${row.deaccession_id}/delete`,
          label: "Delete",
          method: "post",
        },
      ],
      rows,
      title: "Deaccessions",
      ...getFlash(req),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/new", async (req, res, next) => {
  try {
    const computerOptions = await getDeaccessionCandidateOptions();

    return renderCreateForm(res, {
      computerOptions,
      formAction: "/deaccessions",
      intro:
        "Record a computer deaccession through the stored-procedure backed workflow.",
      pageTitle: "Create Deaccession",
      record: buildCreateForm(),
      submitLabel: "Create deaccession",
      title: "Create deaccession",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  const record = buildCreateForm(req.body);
  const errors = validateCreateForm(record);

  try {
    const computerOptions = await getDeaccessionCandidateOptions();

    if (errors.length > 0) {
      return renderCreateForm(res, {
        computerOptions,
        errorMessage: errors.join(" "),
        formAction: "/deaccessions",
        intro:
          "Record a computer deaccession through the stored-procedure backed workflow.",
        pageTitle: "Create Deaccession",
        record,
        statusCode: 400,
        submitLabel: "Create deaccession",
        title: "Create deaccession",
      });
    }

    await pool.query("CALL mydb.sp_deaccession_computer($1, $2, $3)", [
      parsePositiveId(record.computer_id),
      record.deaccession_date,
      emptyToNull(record.reason),
    ]);

    return redirectWithMessage(
      res,
      "/deaccessions",
      "success",
      "The deaccession record was created and the computer status was updated automatically.",
    );
  } catch (error) {
    try {
      const computerOptions = await getDeaccessionCandidateOptions();

      return renderCreateForm(res, {
        computerOptions,
        errorMessage: getDbErrorMessage(error),
        formAction: "/deaccessions",
        intro:
          "Record a computer deaccession through the stored-procedure backed workflow.",
        pageTitle: "Create Deaccession",
        record,
        statusCode: 400,
        submitLabel: "Create deaccession",
        title: "Create deaccession",
      });
    } catch (lookupError) {
      return next(lookupError);
    }
  }
});

router.get("/:deaccessionId/edit", async (req, res, next) => {
  try {
    const record = await getDeaccessionRecord(req.params.deaccessionId);

    if (!record) {
      return res.status(404).render("error", {
        errorDetails: "The requested deaccession record could not be found.",
        navKey: "deaccessions",
        pageTitle: "Deaccession Not Found",
        title: "Deaccession not found",
      });
    }

    return renderEditForm(res, {
      formAction: `/deaccessions/${req.params.deaccessionId}`,
      intro:
        "You can edit the deaccession date and reason, but the related computer stays fixed.",
      pageTitle: "Edit Deaccession",
      record: buildEditForm(record),
      submitLabel: "Save changes",
      title: "Edit deaccession",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:deaccessionId", async (req, res, next) => {
  try {
    const existingRecord = await getDeaccessionRecord(req.params.deaccessionId);

    if (!existingRecord) {
      return res.status(404).render("error", {
        errorDetails: "The requested deaccession record could not be found.",
        navKey: "deaccessions",
        pageTitle: "Deaccession Not Found",
        title: "Deaccession not found",
      });
    }

    const record = buildEditForm({
      ...existingRecord,
      deaccession_date: req.body.deaccession_date,
      reason: req.body.reason,
    });

    if (!record.deaccession_date) {
      return renderEditForm(res, {
        errorMessage: "Deaccession date is required.",
        formAction: `/deaccessions/${req.params.deaccessionId}`,
        intro:
          "You can edit the deaccession date and reason, but the related computer stays fixed.",
        pageTitle: "Edit Deaccession",
        record,
        statusCode: 400,
        submitLabel: "Save changes",
        title: "Edit deaccession",
      });
    }

    await pool.query(
      `
        UPDATE mydb.deaccessions
        SET deaccession_date = $1,
            reason = $2
        WHERE deaccession_id = $3
      `,
      [
        record.deaccession_date,
        emptyToNull(record.reason),
        req.params.deaccessionId,
      ],
    );

    return redirectWithMessage(
      res,
      "/deaccessions",
      "success",
      "The deaccession record was updated.",
    );
  } catch (error) {
    try {
      const existingRecord = await getDeaccessionRecord(req.params.deaccessionId);

      if (!existingRecord) {
        return res.status(404).render("error", {
          errorDetails: "The requested deaccession record could not be found.",
          navKey: "deaccessions",
          pageTitle: "Deaccession Not Found",
          title: "Deaccession not found",
        });
      }

      return renderEditForm(res, {
        errorMessage: getDbErrorMessage(error),
        formAction: `/deaccessions/${req.params.deaccessionId}`,
        intro:
          "You can edit the deaccession date and reason, but the related computer stays fixed.",
        pageTitle: "Edit Deaccession",
        record: buildEditForm({
          ...existingRecord,
          deaccession_date: req.body.deaccession_date,
          reason: req.body.reason,
        }),
        statusCode: 400,
        submitLabel: "Save changes",
        title: "Edit deaccession",
      });
    } catch (lookupError) {
      return next(lookupError);
    }
  }
});

router.post("/:deaccessionId/delete", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM mydb.deaccessions WHERE deaccession_id = $1",
      [req.params.deaccessionId],
    );

    if (result.rowCount === 0) {
      return redirectWithMessage(
        res,
        "/deaccessions",
        "error",
        "That deaccession record could not be found.",
      );
    }

    return redirectWithMessage(
      res,
      "/deaccessions",
      "success",
      "The deaccession record was deleted.",
    );
  } catch (error) {
    return redirectWithMessage(
      res,
      "/deaccessions",
      "error",
      getDbErrorMessage(error),
    );
  }
});

module.exports = router;
