const express = require("express");

const { pool } = require("../lib/db");
const {
  getDbErrorMessage,
  getFlash,
  redirectWithMessage,
} = require("../lib/helpers");

const router = express.Router();

function toTitleCase(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function buildLocationForm(source = {}) {
  return {
    building: source.building ? toTitleCase(source.building) : "",
    room: source.room ? String(source.room).trim() : "",
  };
}

function validateLocation(location) {
  const errors = [];

  if (!location.building) {
    errors.push("Building is required.");
  }

  if (!location.room) {
    errors.push("Room is required.");
  }

  return errors;
}

function buildLocationFields() {
  return [
    { label: "Building", name: "building", required: true, type: "text" },
    { label: "Room", name: "room", required: true, type: "text" },
  ];
}

function renderForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/locations",
    errorMessage: options.errorMessage || null,
    fields: buildLocationFields(),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "locations",
    pageTitle: options.pageTitle,
    record: options.location,
    submitLabel: options.submitLabel,
    title: options.title,
  });
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        l.location_id,
        l.building,
        l.room,
        COUNT(c.computer_id)::INT AS computer_count
      FROM mydb.locations l
      LEFT JOIN mydb.computers c
        ON c.current_location_id = l.location_id
      GROUP BY l.location_id, l.building, l.room
      ORDER BY l.building, l.room
    `);

    res.render("resource-list", {
      columns: [
        { label: "ID", key: "location_id" },
        { label: "Building", key: "building" },
        { label: "Room", key: "room" },
        { label: "Computers here", key: "computer_count" },
      ],
      createHref: "/locations/new",
      createLabel: "Add location",
      emptyMessage: "No locations have been added yet.",
      intro:
        "Locations drive the foreign-key selection for each computer record.",
      navKey: "locations",
      pageTitle: "Locations",
      rowActions: [
        {
          className: "button-secondary",
          href: (row) => `/locations/${row.location_id}/edit`,
          label: "Edit",
          method: "get",
        },
        {
          className: "button-danger",
          confirm: "Delete this location?",
          href: (row) => `/locations/${row.location_id}/delete`,
          label: "Delete",
          method: "post",
        },
      ],
      rows,
      title: "Locations",
      ...getFlash(req),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/new", (req, res) => {
  renderForm(res, {
    formAction: "/locations",
    intro: "Add a campus building and room so computers can reference it.",
    location: buildLocationForm(),
    pageTitle: "Add Location",
    submitLabel: "Create location",
    title: "Add location",
  });
});

router.post("/", async (req, res) => {
  const location = buildLocationForm(req.body);
  const errors = validateLocation(location);

  if (errors.length > 0) {
    return renderForm(res, {
      errorMessage: errors.join(" "),
      formAction: "/locations",
      intro: "Add a campus building and room so computers can reference it.",
      location,
      pageTitle: "Add Location",
      statusCode: 400,
      submitLabel: "Create location",
      title: "Add location",
    });
  }

  try {
    await pool.query(
      `
        INSERT INTO mydb.locations (building, room)
        VALUES ($1, $2)
      `,
      [location.building, location.room],
    );

    return redirectWithMessage(
      res,
      "/locations",
      "success",
      `Location ${location.building} ${location.room} was created.`,
    );
  } catch (error) {
    return renderForm(res, {
      errorMessage: getDbErrorMessage(error),
      formAction: "/locations",
      intro: "Add a campus building and room so computers can reference it.",
      location,
      pageTitle: "Add Location",
      statusCode: 400,
      submitLabel: "Create location",
      title: "Add location",
    });
  }
});

router.get("/:locationId/edit", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          location_id,
          building,
          room
        FROM mydb.locations
        WHERE location_id = $1
      `,
      [req.params.locationId],
    );

    if (rows.length === 0) {
      return res.status(404).render("error", {
        errorDetails: "The requested location could not be found.",
        navKey: "locations",
        pageTitle: "Location Not Found",
        title: "Location not found",
      });
    }

    return renderForm(res, {
      formAction: `/locations/${req.params.locationId}`,
      intro: "Update this location label before it is used elsewhere.",
      location: buildLocationForm(rows[0]),
      pageTitle: "Edit Location",
      submitLabel: "Save changes",
      title: "Edit location",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:locationId", async (req, res) => {
  const location = buildLocationForm(req.body);
  const errors = validateLocation(location);

  if (errors.length > 0) {
    return renderForm(res, {
      errorMessage: errors.join(" "),
      formAction: `/locations/${req.params.locationId}`,
      intro: "Update this location label before it is used elsewhere.",
      location,
      pageTitle: "Edit Location",
      statusCode: 400,
      submitLabel: "Save changes",
      title: "Edit location",
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE mydb.locations
        SET building = $1,
            room = $2
        WHERE location_id = $3
      `,
      [location.building, location.room, req.params.locationId],
    );

    if (result.rowCount === 0) {
      return res.status(404).render("error", {
        errorDetails: "The requested location could not be found.",
        navKey: "locations",
        pageTitle: "Location Not Found",
        title: "Location not found",
      });
    }

    return redirectWithMessage(
      res,
      "/locations",
      "success",
      `Location ${location.building} ${location.room} was updated.`,
    );
  } catch (error) {
    return renderForm(res, {
      errorMessage: getDbErrorMessage(error),
      formAction: `/locations/${req.params.locationId}`,
      intro: "Update this location label before it is used elsewhere.",
      location,
      pageTitle: "Edit Location",
      statusCode: 400,
      submitLabel: "Save changes",
      title: "Edit location",
    });
  }
});

router.post("/:locationId/delete", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM mydb.locations WHERE location_id = $1",
      [req.params.locationId],
    );

    if (result.rowCount === 0) {
      return redirectWithMessage(
        res,
        "/locations",
        "error",
        "That location could not be found.",
      );
    }

    return redirectWithMessage(
      res,
      "/locations",
      "success",
      "The location was deleted.",
    );
  } catch (error) {
    return redirectWithMessage(
      res,
      "/locations",
      "error",
      getDbErrorMessage(error),
    );
  }
});

module.exports = router;
