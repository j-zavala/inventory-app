const express = require("express");

const { COMPUTER_STATUSES, DEVICE_TYPES } = require("../lib/constants");
const { pool } = require("../lib/db");
const {
  emptyToNull,
  getDbErrorMessage,
  getFlash,
  parsePositiveId,
  redirectWithMessage,
  toDateInput,
} = require("../lib/helpers");
const { getLocationOptions } = require("../lib/lookups");

const router = express.Router();

function buildComputerForm(source = {}) {
  return {
    asset_tag: source.asset_tag ? String(source.asset_tag).trim() : "",
    current_location_id: source.current_location_id
      ? String(source.current_location_id).trim()
      : "",
    device_type: source.device_type ? String(source.device_type).trim() : "",
    manufacturer: source.manufacturer ? String(source.manufacturer).trim() : "",
    model: source.model ? String(source.model).trim() : "",
    purchase_date: toDateInput(source.purchase_date),
    serial_number: source.serial_number
      ? String(source.serial_number).trim()
      : "",
    status: source.status ? String(source.status).trim() : "",
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

  if (!COMPUTER_STATUSES.includes(computer.status)) {
    errors.push("Choose a valid status.");
  }

  if (!parsePositiveId(computer.current_location_id)) {
    errors.push("Choose a valid location.");
  }

  return errors;
}

function buildComputerFields(locationOptions) {
  return [
    { label: "Asset tag", name: "asset_tag", required: true, type: "text" },
    {
      label: "Serial number",
      name: "serial_number",
      required: true,
      type: "text",
    },
    {
      label: "Device type",
      name: "device_type",
      options: DEVICE_TYPES.map((value) => ({ label: value, value })),
      required: true,
      type: "select",
    },
    { label: "Manufacturer", name: "manufacturer", type: "text" },
    { label: "Model", name: "model", type: "text" },
    { label: "Purchase date", name: "purchase_date", type: "date" },
    {
      helpText:
        "Use assignment and deaccession workflows for lifecycle changes when possible.",
      label: "Status",
      name: "status",
      options: COMPUTER_STATUSES.map((value) => ({ label: value, value })),
      required: true,
      type: "select",
    },
    {
      label: "Location",
      name: "current_location_id",
      options: locationOptions,
      required: true,
      type: "select",
    },
  ];
}

function renderForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/computers",
    errorMessage: options.errorMessage || null,
    fields: buildComputerFields(options.locationOptions),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "computers",
    pageTitle: options.pageTitle,
    record: options.computer,
    submitLabel: options.submitLabel,
    title: options.title,
  });
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        computer_id,
        asset_tag,
        serial_number,
        device_type,
        manufacturer,
        model,
        TO_CHAR(purchase_date, 'YYYY-MM-DD') AS purchase_date,
        status,
        location_label,
        installed_software_count,
        active_assignee,
        active_assignment_type
      FROM mydb.v_computer_overview
      ORDER BY computer_id DESC
    `);

    res.render("resource-list", {
      columns: [
        { label: "ID", key: "computer_id" },
        { label: "Asset tag", key: "asset_tag" },
        { label: "Serial", key: "serial_number" },
        { label: "Type", key: "device_type" },
        {
          label: "Make / model",
          render: (row) =>
            [row.manufacturer, row.model].filter(Boolean).join(" ") || "—",
        },
        {
          label: "Location",
          render: (row) => row.location_label || "—",
        },
        { label: "Status", key: "status" },
        {
          label: "Active assignee",
          render: (row) =>
            row.active_assignee
              ? `${row.active_assignee} (${row.active_assignment_type})`
              : "—",
        },
        {
          label: "Software count",
          key: "installed_software_count",
        },
      ],
      createHref: "/computers/new",
      createLabel: "Add computer",
      emptyMessage: "No computers have been added yet.",
      intro:
        "This table is the main inventory record. Users choose a location label, and the app stores the related foreign key for you.",
      navKey: "computers",
      pageTitle: "Computers",
      rowActions: [
        {
          className: "button-secondary",
          href: (row) => `/computers/${row.computer_id}/edit`,
          label: "Edit",
          method: "get",
        },
        {
          className: "button-danger",
          confirm: "Delete this computer?",
          href: (row) => `/computers/${row.computer_id}/delete`,
          label: "Delete",
          method: "post",
        },
      ],
      rows,
      title: "Computers",
      ...getFlash(req),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/new", async (req, res, next) => {
  try {
    const locationOptions = await getLocationOptions();

    return renderForm(res, {
      computer: buildComputerForm(),
      formAction: "/computers",
      intro:
        "Create a computer record with a required location selection from the locations table.",
      locationOptions,
      pageTitle: "Add Computer",
      submitLabel: "Create computer",
      title: "Add computer",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  const computer = buildComputerForm(req.body);
  const errors = validateComputer(computer);

  try {
    const locationOptions = await getLocationOptions();

    if (errors.length > 0) {
      return renderForm(res, {
        computer,
        errorMessage: errors.join(" "),
        formAction: "/computers",
        intro:
          "Create a computer record with a required location selection from the locations table.",
        locationOptions,
        pageTitle: "Add Computer",
        statusCode: 400,
        submitLabel: "Create computer",
        title: "Add computer",
      });
    }

    await pool.query(
      `
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        computer.asset_tag,
        computer.serial_number,
        computer.device_type,
        emptyToNull(computer.manufacturer),
        emptyToNull(computer.model),
        emptyToNull(computer.purchase_date),
        computer.status,
        parsePositiveId(computer.current_location_id),
      ],
    );

    return redirectWithMessage(
      res,
      "/computers",
      "success",
      `Computer ${computer.asset_tag} was created.`,
    );
  } catch (error) {
    try {
      const locationOptions = await getLocationOptions();

      return renderForm(res, {
        computer,
        errorMessage: getDbErrorMessage(error),
        formAction: "/computers",
        intro:
          "Create a computer record with a required location selection from the locations table.",
        locationOptions,
        pageTitle: "Add Computer",
        statusCode: 400,
        submitLabel: "Create computer",
        title: "Add computer",
      });
    } catch (lookupError) {
      return next(lookupError);
    }
  }
});

router.get("/:computerId/edit", async (req, res, next) => {
  try {
    const [computerResult, locationOptions] = await Promise.all([
      pool.query(
        `
          SELECT
            computer_id,
            asset_tag,
            serial_number,
            device_type,
            manufacturer,
            model,
            purchase_date,
            status,
            current_location_id
          FROM mydb.computers
          WHERE computer_id = $1
        `,
        [req.params.computerId],
      ),
      getLocationOptions(),
    ]);

    if (computerResult.rows.length === 0) {
      return res.status(404).render("error", {
        errorDetails: "The requested computer could not be found.",
        navKey: "computers",
        pageTitle: "Computer Not Found",
        title: "Computer not found",
      });
    }

    return renderForm(res, {
      computer: buildComputerForm(computerResult.rows[0]),
      formAction: `/computers/${req.params.computerId}`,
      intro:
        "Update inventory details and the related location selection for this computer.",
      locationOptions,
      pageTitle: "Edit Computer",
      submitLabel: "Save changes",
      title: "Edit computer",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:computerId", async (req, res, next) => {
  const computer = buildComputerForm(req.body);
  const errors = validateComputer(computer);

  try {
    const locationOptions = await getLocationOptions();

    if (errors.length > 0) {
      return renderForm(res, {
        computer,
        errorMessage: errors.join(" "),
        formAction: `/computers/${req.params.computerId}`,
        intro:
          "Update inventory details and the related location selection for this computer.",
        locationOptions,
        pageTitle: "Edit Computer",
        statusCode: 400,
        submitLabel: "Save changes",
        title: "Edit computer",
      });
    }

    const result = await pool.query(
      `
        UPDATE mydb.computers
        SET asset_tag = $1,
            serial_number = $2,
            device_type = $3,
            manufacturer = $4,
            model = $5,
            purchase_date = $6,
            status = $7,
            current_location_id = $8
        WHERE computer_id = $9
      `,
      [
        computer.asset_tag,
        computer.serial_number,
        computer.device_type,
        emptyToNull(computer.manufacturer),
        emptyToNull(computer.model),
        emptyToNull(computer.purchase_date),
        computer.status,
        parsePositiveId(computer.current_location_id),
        req.params.computerId,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).render("error", {
        errorDetails: "The requested computer could not be found.",
        navKey: "computers",
        pageTitle: "Computer Not Found",
        title: "Computer not found",
      });
    }

    return redirectWithMessage(
      res,
      "/computers",
      "success",
      `Computer ${computer.asset_tag} was updated.`,
    );
  } catch (error) {
    try {
      const locationOptions = await getLocationOptions();

      return renderForm(res, {
        computer,
        errorMessage: getDbErrorMessage(error),
        formAction: `/computers/${req.params.computerId}`,
        intro:
          "Update inventory details and the related location selection for this computer.",
        locationOptions,
        pageTitle: "Edit Computer",
        statusCode: 400,
        submitLabel: "Save changes",
        title: "Edit computer",
      });
    } catch (lookupError) {
      return next(lookupError);
    }
  }
});

router.post("/:computerId/delete", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM mydb.computers WHERE computer_id = $1",
      [req.params.computerId],
    );

    if (result.rowCount === 0) {
      return redirectWithMessage(
        res,
        "/computers",
        "error",
        "That computer could not be found.",
      );
    }

    return redirectWithMessage(
      res,
      "/computers",
      "success",
      "The computer record was deleted.",
    );
  } catch (error) {
    return redirectWithMessage(
      res,
      "/computers",
      "error",
      getDbErrorMessage(error),
    );
  }
});

module.exports = router;
