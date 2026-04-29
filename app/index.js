require("dotenv").config({ quiet: true });

const express = require("express");
const path = require("path");

const { pool } = require("./lib/db");
const resources = require("./resources");

const app = express();
const navItems = resources
  .map((resource) => ({
    href: resource.path,
    key: resource.key,
    label: resource.label,
  }))
  .concat({ href: "/reports", key: "reports", label: "Reports" });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

function emptyToNull(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function toDateInput(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function getFlash(req) {
  return {
    errorMessage: req.query.error || null,
    successMessage: req.query.success || null,
  };
}

function redirectWithMessage(res, pathname, type, message) {
  const params = new URLSearchParams({ [type]: message });
  res.redirect(`${pathname}?${params.toString()}`);
}

function getDbMessage(error) {
  if (error.code === "23505") {
    return "That record conflicts with a unique database rule.";
  }

  if (error.code === "23503") {
    return "That change conflicts with a related table.";
  }

  if (error.code === "23514") {
    return "That change conflicts with a check constraint.";
  }

  return error.message || "The database could not save that change.";
}

function getWhereClause(resource, offset = 0) {
  return resource.idColumns
    .map((column, index) => `${column} = $${index + 1 + offset}`)
    .join(" AND ");
}

function getIdValues(resource, source) {
  return resource.idColumns.map((column) => source[column]);
}

function getItemPath(resource, row) {
  return getIdValues(resource, row).map(encodeURIComponent).join("/");
}

function getRouteParams(resource) {
  return resource.idColumns.map((column) => `:${column}`).join("/");
}

function getDefaultListSql(resource) {
  return `SELECT * FROM mydb.${resource.table} ORDER BY ${resource.orderBy}`;
}

function getFormValues(resource, body) {
  return resource.fields.reduce((values, field) => {
    values[field.name] = emptyToNull(body[field.name]);
    return values;
  }, {});
}

function getFieldValue(field, record) {
  const value = record?.[field.name] ?? "";
  return field.type === "date" ? toDateInput(value) : value;
}

async function getFields(resource, record, mode) {
  return Promise.all(
    resource.fields.map(async (field) => {
      const prepared = {
        ...field,
        disabled: mode === "edit" && resource.idColumns.includes(field.name),
        value: getFieldValue(field, record),
      };

      if (field.options) {
        prepared.options = field.options.map((option) => ({
          label: option,
          value: option,
        }));
      }

      if (field.optionsSql) {
        const { rows } = await pool.query(field.optionsSql);
        prepared.options = rows.map((row) => ({
          label: row.label,
          value: String(row.value),
        }));
      }

      return prepared;
    }),
  );
}

async function getRecord(resource, req) {
  const values = getIdValues(resource, req.params);
  const { rows } = await pool.query(
    `SELECT * FROM mydb.${resource.table} WHERE ${getWhereClause(resource)}`,
    values,
  );

  return rows[0] || null;
}

function renderForm(res, resource, mode, fields, record = {}, errorMessage = null) {
  const isEdit = mode === "edit";

  res.render("resource-form", {
    cancelHref: resource.path,
    errorMessage,
    fields,
    formAction: isEdit
      ? `${resource.path}/${getItemPath(resource, record)}`
      : resource.path,
    navItems,
    navKey: resource.key,
    pageTitle: `${isEdit ? "Edit" : "Add"} ${resource.label}`,
    record,
    submitLabel: isEdit ? "Save changes" : "Add record",
    title: `${isEdit ? "Edit" : "Add"} ${resource.label}`,
    intro: resource.intro,
  });
}

async function createRecord(resource, values) {
  if (resource.createProcedure) {
    const params = resource.createProcedure.params.map((name) => values[name]);
    await pool.query(resource.createProcedure.sql, params);
    return;
  }

  const columns = resource.fields.map((field) => field.name);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const params = columns.map((column) => values[column]);

  await pool.query(
    `INSERT INTO mydb.${resource.table} (${columns.join(", ")}) VALUES (${placeholders})`,
    params,
  );
}

async function updateRecord(resource, req, values) {
  const columns = resource.fields
    .map((field) => field.name)
    .filter((column) => !resource.idColumns.includes(column));
  const assignments = columns
    .map((column, index) => `${column} = $${index + 1}`)
    .join(", ");
  const params = columns.map((column) => values[column]);
  const idValues = getIdValues(resource, req.params);

  await pool.query(
    `UPDATE mydb.${resource.table} SET ${assignments} WHERE ${getWhereClause(resource, params.length)}`,
    params.concat(idValues),
  );
}

resources.forEach((resource) => {
  const itemParams = getRouteParams(resource);

  app.get(resource.path, async (req, res, next) => {
    try {
      const { rows } = await pool.query(resource.listSql || getDefaultListSql(resource));

      res.render("resource-list", {
        ...getFlash(req),
        columns: resource.listColumns,
        createHref: `${resource.path}/new`,
        createLabel: `Add ${resource.label}`,
        intro: resource.intro,
        navItems,
        navKey: resource.key,
        pageTitle: resource.label,
        rowActions: [
          {
            href: (row) => `${resource.path}/${getItemPath(resource, row)}/edit`,
            label: "Edit",
          },
          {
            className: "button-danger",
            confirm: "Delete this record?",
            href: (row) => `${resource.path}/${getItemPath(resource, row)}/delete`,
            label: "Delete",
            method: "post",
          },
        ],
        rows,
        title: resource.label,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get(`${resource.path}/new`, async (req, res, next) => {
    try {
      const fields = await getFields(resource, {}, "new");
      renderForm(res, resource, "new", fields);
    } catch (error) {
      next(error);
    }
  });

  app.post(resource.path, async (req, res, next) => {
    const values = getFormValues(resource, req.body);

    try {
      await createRecord(resource, values);
      redirectWithMessage(res, resource.path, "success", "Record added.");
    } catch (error) {
      try {
        const fields = await getFields(resource, values, "new");
        renderForm(res, resource, "new", fields, values, getDbMessage(error));
      } catch (innerError) {
        next(innerError);
      }
    }
  });

  app.get(`${resource.path}/${itemParams}/edit`, async (req, res, next) => {
    try {
      const record = await getRecord(resource, req);
      if (!record) {
        redirectWithMessage(res, resource.path, "error", "Record not found.");
        return;
      }

      const fields = await getFields(resource, record, "edit");
      renderForm(res, resource, "edit", fields, record);
    } catch (error) {
      next(error);
    }
  });

  app.post(`${resource.path}/${itemParams}`, async (req, res, next) => {
    const values = getFormValues(resource, req.body);

    try {
      await updateRecord(resource, req, values);
      redirectWithMessage(res, resource.path, "success", "Record updated.");
    } catch (error) {
      try {
        const record = { ...values, ...req.params };
        const fields = await getFields(resource, record, "edit");
        renderForm(res, resource, "edit", fields, record, getDbMessage(error));
      } catch (innerError) {
        next(innerError);
      }
    }
  });

  app.post(`${resource.path}/${itemParams}/delete`, async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM mydb.${resource.table} WHERE ${getWhereClause(resource)}`,
        getIdValues(resource, req.params),
      );
      redirectWithMessage(res, resource.path, "success", "Record deleted.");
    } catch (error) {
      redirectWithMessage(res, resource.path, "error", getDbMessage(error));
    }
  });
});

app.get("/", (req, res) => {
  res.redirect("/computers");
});

app.get("/reports", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM mydb.v_computers_by_status");

    res.render("reports", {
      navItems,
      navKey: "reports",
      pageTitle: "Reports",
      rows,
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).render("error", {
    errorDetails: "The requested page does not exist.",
    navItems,
    navKey: "computers",
    pageTitle: "Page Not Found",
    title: "Page not found",
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).render("error", {
    errorDetails: error.message || "The application ran into an unexpected problem.",
    navItems,
    navKey: "computers",
    pageTitle: "Application Error",
    title: "Something went wrong",
  });
});

module.exports = app;
