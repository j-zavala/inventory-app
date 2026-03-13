const express = require("express");

const { USER_ROLE_TYPES } = require("../lib/constants");
const { pool } = require("../lib/db");
const {
  emptyToNull,
  getDbErrorMessage,
  getFlash,
  redirectWithMessage,
} = require("../lib/helpers");

const router = express.Router();

function buildUserForm(source = {}) {
  return {
    department: source.department ? String(source.department).trim() : "",
    email: source.email ? String(source.email).trim() : "",
    first_name: source.first_name ? String(source.first_name).trim() : "",
    last_name: source.last_name ? String(source.last_name).trim() : "",
    role_type: source.role_type ? String(source.role_type).trim() : "",
  };
}

function validateUser(user) {
  const errors = [];

  if (!user.first_name) {
    errors.push("First name is required.");
  }

  if (!user.last_name) {
    errors.push("Last name is required.");
  }

  if (!user.email) {
    errors.push("Email is required.");
  }

  if (!USER_ROLE_TYPES.includes(user.role_type)) {
    errors.push("Choose a valid role type.");
  }

  return errors;
}

function buildUserFields() {
  return [
    { label: "First name", name: "first_name", required: true, type: "text" },
    { label: "Last name", name: "last_name", required: true, type: "text" },
    { label: "Email", name: "email", required: true, type: "email" },
    { label: "Department", name: "department", type: "text" },
    {
      label: "Role",
      name: "role_type",
      options: USER_ROLE_TYPES.map((value) => ({
        label: value.replace("_", " "),
        value,
      })),
      required: true,
      type: "select",
    },
  ];
}

function renderForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/users",
    errorMessage: options.errorMessage || null,
    fields: buildUserFields(),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "users",
    pageTitle: options.pageTitle,
    record: options.user,
    submitLabel: options.submitLabel,
    title: options.title,
  });
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.department,
        u.role_type,
        mydb.fn_user_active_assignment_count(u.user_id) AS active_assignment_count
      FROM mydb.users u
      ORDER BY u.last_name, u.first_name
    `);

    res.render("resource-list", {
      columns: [
        { label: "ID", key: "user_id" },
        {
          label: "Name",
          render: (row) => `${row.first_name} ${row.last_name}`,
        },
        { label: "Email", key: "email" },
        { label: "Department", render: (row) => row.department || "—" },
        { label: "Role", key: "role_type" },
        { label: "Active assignments", key: "active_assignment_count" },
      ],
      createHref: "/users/new",
      createLabel: "Add user",
      emptyMessage: "No users have been added yet.",
      intro:
        "Manage the people who receive computers or participate in inventory workflows.",
      navKey: "users",
      pageTitle: "Users",
      rowActions: [
        {
          className: "button-secondary",
          href: (row) => `/users/${row.user_id}/edit`,
          label: "Edit",
          method: "get",
        },
        {
          className: "button-danger",
          confirm: "Delete this user?",
          href: (row) => `/users/${row.user_id}/delete`,
          label: "Delete",
          method: "post",
        },
      ],
      rows,
      title: "Users",
      ...getFlash(req),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/new", (req, res) => {
  renderForm(res, {
    formAction: "/users",
    intro: "Create a user record for staff, faculty, or IT team members.",
    pageTitle: "Add User",
    submitLabel: "Create user",
    title: "Add user",
    user: buildUserForm(),
  });
});

router.post("/", async (req, res) => {
  const user = buildUserForm(req.body);
  const errors = validateUser(user);

  if (errors.length > 0) {
    return renderForm(res, {
      errorMessage: errors.join(" "),
      formAction: "/users",
      intro: "Create a user record for staff, faculty, or IT team members.",
      pageTitle: "Add User",
      statusCode: 400,
      submitLabel: "Create user",
      title: "Add user",
      user,
    });
  }

  try {
    await pool.query(
      `
        INSERT INTO mydb.users (
          first_name,
          last_name,
          email,
          department,
          role_type
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        user.first_name,
        user.last_name,
        user.email,
        emptyToNull(user.department),
        user.role_type,
      ],
    );

    return redirectWithMessage(
      res,
      "/users",
      "success",
      `User ${user.first_name} ${user.last_name} was created.`,
    );
  } catch (error) {
    return renderForm(res, {
      errorMessage: getDbErrorMessage(error),
      formAction: "/users",
      intro: "Create a user record for staff, faculty, or IT team members.",
      pageTitle: "Add User",
      statusCode: 400,
      submitLabel: "Create user",
      title: "Add user",
      user,
    });
  }
});

router.get("/:userId/edit", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          user_id,
          first_name,
          last_name,
          email,
          department,
          role_type
        FROM mydb.users
        WHERE user_id = $1
      `,
      [req.params.userId],
    );

    if (rows.length === 0) {
      return res.status(404).render("error", {
        errorDetails: "The requested user could not be found.",
        navKey: "users",
        pageTitle: "User Not Found",
        title: "User not found",
      });
    }

    return renderForm(res, {
      formAction: `/users/${req.params.userId}`,
      intro: "Update contact details or department information for this user.",
      pageTitle: "Edit User",
      submitLabel: "Save changes",
      title: "Edit user",
      user: buildUserForm(rows[0]),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:userId", async (req, res, next) => {
  const user = buildUserForm(req.body);
  const errors = validateUser(user);

  if (errors.length > 0) {
    return renderForm(res, {
      errorMessage: errors.join(" "),
      formAction: `/users/${req.params.userId}`,
      intro: "Update contact details or department information for this user.",
      pageTitle: "Edit User",
      statusCode: 400,
      submitLabel: "Save changes",
      title: "Edit user",
      user,
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE mydb.users
        SET first_name = $1,
            last_name = $2,
            email = $3,
            department = $4,
            role_type = $5
        WHERE user_id = $6
      `,
      [
        user.first_name,
        user.last_name,
        user.email,
        emptyToNull(user.department),
        user.role_type,
        req.params.userId,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).render("error", {
        errorDetails: "The requested user could not be found.",
        navKey: "users",
        pageTitle: "User Not Found",
        title: "User not found",
      });
    }

    return redirectWithMessage(
      res,
      "/users",
      "success",
      `User ${user.first_name} ${user.last_name} was updated.`,
    );
  } catch (error) {
    if (error.code === "22P02") {
      return next(error);
    }

    return renderForm(res, {
      errorMessage: getDbErrorMessage(error),
      formAction: `/users/${req.params.userId}`,
      intro: "Update contact details or department information for this user.",
      pageTitle: "Edit User",
      statusCode: 400,
      submitLabel: "Save changes",
      title: "Edit user",
      user,
    });
  }
});

router.post("/:userId/delete", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM mydb.users WHERE user_id = $1",
      [req.params.userId],
    );

    if (result.rowCount === 0) {
      return redirectWithMessage(
        res,
        "/users",
        "error",
        "That user could not be found.",
      );
    }

    return redirectWithMessage(
      res,
      "/users",
      "success",
      "The user record was deleted.",
    );
  } catch (error) {
    return redirectWithMessage(
      res,
      "/users",
      "error",
      getDbErrorMessage(error),
    );
  }
});

module.exports = router;
