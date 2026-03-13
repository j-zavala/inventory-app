const express = require("express");

const {
  ASSIGNMENT_TYPES,
  LONG_TERM_RETURN_STATUSES,
} = require("../lib/constants");
const { pool } = require("../lib/db");
const {
  getDbErrorMessage,
  getFlash,
  parsePositiveId,
  redirectWithMessage,
  toDateInput,
} = require("../lib/helpers");
const {
  getAssignableComputerOptions,
  getUserOptions,
} = require("../lib/lookups");

const router = express.Router();

function buildAssignmentCreateForm(source = {}) {
  return {
    assigned_date: toDateInput(source.assigned_date),
    assignment_type: source.assignment_type
      ? String(source.assignment_type).trim()
      : "",
    computer_id: source.computer_id ? String(source.computer_id).trim() : "",
    user_id: source.user_id ? String(source.user_id).trim() : "",
  };
}

function validateAssignmentCreate(assignment) {
  const errors = [];

  if (!parsePositiveId(assignment.user_id)) {
    errors.push("Choose a valid user.");
  }

  if (!parsePositiveId(assignment.computer_id)) {
    errors.push("Choose a valid computer.");
  }

  if (!ASSIGNMENT_TYPES.includes(assignment.assignment_type)) {
    errors.push("Choose a valid assignment type.");
  }

  if (!assignment.assigned_date) {
    errors.push("Assigned date is required.");
  }

  return errors;
}

function buildAssignmentCreateFields(userOptions, computerOptions) {
  return [
    {
      label: "User",
      name: "user_id",
      options: userOptions,
      required: true,
      type: "select",
    },
    {
      helpText:
        "Computers listed here are in available or available_loaner status. Long-term assignments need available; loaners need available_loaner.",
      label: "Computer",
      name: "computer_id",
      options: computerOptions,
      required: true,
      type: "select",
    },
    {
      label: "Assignment type",
      name: "assignment_type",
      options: ASSIGNMENT_TYPES.map((value) => ({ label: value, value })),
      required: true,
      type: "select",
    },
    {
      label: "Assigned date",
      name: "assigned_date",
      required: true,
      type: "date",
    },
  ];
}

function buildAssignmentEditForm(source = {}) {
  return {
    assigned_date: toDateInput(source.assigned_date),
    assignment_type: source.assignment_type || "",
    computer_label: source.computer_label || "",
    post_return_status: source.post_return_status || "",
    returned_date: toDateInput(source.returned_date),
    user_label: source.user_label || "",
  };
}

function buildAssignmentEditFields(assignment) {
  const isLoaner = assignment.assignment_type === "loaner";
  const hasReturned = Boolean(assignment.returned_date);

  return [
    {
      label: "User",
      name: "user_label",
      type: "readonly",
    },
    {
      label: "Computer",
      name: "computer_label",
      type: "readonly",
    },
    {
      label: "Assignment type",
      name: "assignment_type",
      type: "readonly",
    },
    {
      label: "Assigned date",
      name: "assigned_date",
      type: "readonly",
    },
    {
      helpText: hasReturned
        ? "You can correct the returned date if needed."
        : "This field stays blank until the computer is returned.",
      label: "Returned date",
      name: "returned_date",
      type: "date",
    },
    {
      disabled: isLoaner,
      helpText: isLoaner
        ? "Loaner returns automatically move the computer back to available_loaner."
        : "Long-term returns must choose the status the computer moves into.",
      label: "Post-return status",
      name: "post_return_status",
      options: LONG_TERM_RETURN_STATUSES.map((value) => ({
        label: value,
        value,
      })),
      type: "select",
    },
  ];
}

function validateAssignmentEdit(assignment) {
  const errors = [];

  if (assignment.returned_date && assignment.assignment_type === "long_term") {
    if (!LONG_TERM_RETURN_STATUSES.includes(assignment.post_return_status)) {
      errors.push(
        "Returned long-term assignments require a valid post-return status.",
      );
    }
  }

  return errors;
}

async function getAssignmentById(assignmentId) {
  const { rows } = await pool.query(
    `
      SELECT
        a.assignment_id,
        a.user_id,
        a.computer_id,
        a.assignment_type,
        TO_CHAR(a.assigned_date, 'YYYY-MM-DD') AS assigned_date,
        TO_CHAR(a.returned_date, 'YYYY-MM-DD') AS returned_date,
        a.post_return_status,
        CONCAT(u.first_name, ' ', u.last_name) AS user_label,
        CONCAT(c.asset_tag, ' - ', COALESCE(c.manufacturer, ''), CASE WHEN c.model IS NOT NULL THEN ' ' || c.model ELSE '' END) AS computer_label
      FROM mydb.assignments a
      JOIN mydb.users u
        ON u.user_id = a.user_id
      JOIN mydb.computers c
        ON c.computer_id = a.computer_id
      WHERE a.assignment_id = $1
    `,
    [assignmentId],
  );

  return rows[0] || null;
}

function renderCreateForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/assignments",
    errorMessage: options.errorMessage || null,
    fields: buildAssignmentCreateFields(
      options.userOptions,
      options.computerOptions,
    ),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "assignments",
    pageTitle: options.pageTitle,
    record: options.assignment,
    submitLabel: options.submitLabel,
    title: options.title,
  });
}

function renderEditForm(res, options) {
  res.status(options.statusCode || 200).render("resource-form", {
    cancelHref: "/assignments",
    errorMessage: options.errorMessage || null,
    fields: buildAssignmentEditFields(options.assignment),
    formAction: options.formAction,
    intro: options.intro,
    navKey: "assignments",
    pageTitle: options.pageTitle,
    record: options.assignment,
    submitLabel: options.submitLabel,
    title: options.title,
  });
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        a.assignment_id,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        c.asset_tag,
        a.assignment_type,
        TO_CHAR(a.assigned_date, 'YYYY-MM-DD') AS assigned_date,
        TO_CHAR(a.returned_date, 'YYYY-MM-DD') AS returned_date,
        a.post_return_status,
        CASE
          WHEN a.returned_date IS NULL THEN 'active'
          ELSE 'returned'
        END AS lifecycle_state
      FROM mydb.assignments a
      JOIN mydb.users u
        ON u.user_id = a.user_id
      JOIN mydb.computers c
        ON c.computer_id = a.computer_id
      ORDER BY a.assignment_id DESC
    `);

    res.render("resource-list", {
      columns: [
        { label: "ID", key: "assignment_id" },
        { label: "User", key: "user_name" },
        { label: "Computer", key: "asset_tag" },
        { label: "Type", key: "assignment_type" },
        { label: "Assigned", key: "assigned_date" },
        {
          label: "Returned",
          render: (row) => row.returned_date || "—",
        },
        {
          label: "Post-return status",
          render: (row) => row.post_return_status || "—",
        },
        { label: "State", key: "lifecycle_state" },
      ],
      createHref: "/assignments/new",
      createLabel: "Create assignment",
      emptyMessage: "No assignments have been added yet.",
      intro:
        "Assignments are created through the procedure-backed workflow and can be returned through a dedicated return action.",
      navKey: "assignments",
      pageTitle: "Assignments",
      rowActions: [
        {
          className: "button-secondary",
          href: (row) => `/assignments/${row.assignment_id}/edit`,
          label: "Edit",
          method: "get",
        },
        {
          className: "button-secondary",
          href: (row) => `/assignments/${row.assignment_id}/return`,
          label: "Return",
          method: "get",
          when: (row) => row.lifecycle_state === "active",
        },
        {
          className: "button-danger",
          confirm: "Delete this assignment?",
          href: (row) => `/assignments/${row.assignment_id}/delete`,
          label: "Delete",
          method: "post",
        },
      ],
      rows,
      title: "Assignments",
      ...getFlash(req),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/new", async (req, res, next) => {
  try {
    const [userOptions, computerOptions] = await Promise.all([
      getUserOptions(),
      getAssignableComputerOptions(),
    ]);

    return renderCreateForm(res, {
      assignment: buildAssignmentCreateForm(),
      computerOptions,
      formAction: "/assignments",
      intro:
        "Create a new assignment using readable user and computer selections instead of raw IDs.",
      pageTitle: "Create Assignment",
      submitLabel: "Create assignment",
      title: "Create assignment",
      userOptions,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  const assignment = buildAssignmentCreateForm(req.body);
  const errors = validateAssignmentCreate(assignment);

  try {
    const [userOptions, computerOptions] = await Promise.all([
      getUserOptions(),
      getAssignableComputerOptions(),
    ]);

    if (errors.length > 0) {
      return renderCreateForm(res, {
        assignment,
        computerOptions,
        errorMessage: errors.join(" "),
        formAction: "/assignments",
        intro:
          "Create a new assignment using readable user and computer selections instead of raw IDs.",
        pageTitle: "Create Assignment",
        statusCode: 400,
        submitLabel: "Create assignment",
        title: "Create assignment",
        userOptions,
      });
    }

    await pool.query(
      "CALL mydb.sp_assign_computer($1, $2, $3, $4)",
      [
        parsePositiveId(assignment.user_id),
        parsePositiveId(assignment.computer_id),
        assignment.assignment_type,
        assignment.assigned_date,
      ],
    );

    return redirectWithMessage(
      res,
      "/assignments",
      "success",
      "The assignment was created and the computer status was updated automatically.",
    );
  } catch (error) {
    try {
      const [userOptions, computerOptions] = await Promise.all([
        getUserOptions(),
        getAssignableComputerOptions(),
      ]);

      return renderCreateForm(res, {
        assignment,
        computerOptions,
        errorMessage: getDbErrorMessage(error),
        formAction: "/assignments",
        intro:
          "Create a new assignment using readable user and computer selections instead of raw IDs.",
        pageTitle: "Create Assignment",
        statusCode: 400,
        submitLabel: "Create assignment",
        title: "Create assignment",
        userOptions,
      });
    } catch (lookupError) {
      return next(lookupError);
    }
  }
});

router.get("/:assignmentId/edit", async (req, res, next) => {
  try {
    const assignment = await getAssignmentById(req.params.assignmentId);

    if (!assignment) {
      return res.status(404).render("error", {
        errorDetails: "The requested assignment could not be found.",
        navKey: "assignments",
        pageTitle: "Assignment Not Found",
        title: "Assignment not found",
      });
    }

    return renderEditForm(res, {
      assignment: buildAssignmentEditForm(assignment),
      formAction: `/assignments/${req.params.assignmentId}`,
      intro:
        "Use this edit screen to adjust return metadata while keeping the original user and computer fixed.",
      pageTitle: "Edit Assignment",
      submitLabel: "Save changes",
      title: "Edit assignment",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:assignmentId", async (req, res, next) => {
  try {
    const existingAssignment = await getAssignmentById(req.params.assignmentId);

    if (!existingAssignment) {
      return res.status(404).render("error", {
        errorDetails: "The requested assignment could not be found.",
        navKey: "assignments",
        pageTitle: "Assignment Not Found",
        title: "Assignment not found",
      });
    }

    const assignment = buildAssignmentEditForm({
      ...existingAssignment,
      post_return_status: req.body.post_return_status,
      returned_date: req.body.returned_date,
    });

    const errors = validateAssignmentEdit({
      assignment_type: existingAssignment.assignment_type,
      post_return_status: assignment.post_return_status,
      returned_date: assignment.returned_date,
    });

    if (errors.length > 0) {
      return renderEditForm(res, {
        assignment,
        errorMessage: errors.join(" "),
        formAction: `/assignments/${req.params.assignmentId}`,
        intro:
          "Use this edit screen to adjust return metadata while keeping the original user and computer fixed.",
        pageTitle: "Edit Assignment",
        statusCode: 400,
        submitLabel: "Save changes",
        title: "Edit assignment",
      });
    }

    await pool.query(
      `
        UPDATE mydb.assignments
        SET returned_date = $1,
            post_return_status = $2
        WHERE assignment_id = $3
      `,
      [
        assignment.returned_date || null,
        existingAssignment.assignment_type === "loaner"
          ? null
          : assignment.post_return_status || null,
        req.params.assignmentId,
      ],
    );

    return redirectWithMessage(
      res,
      "/assignments",
      "success",
      "The assignment was updated.",
    );
  } catch (error) {
    try {
      const existingAssignment = await getAssignmentById(req.params.assignmentId);

      if (!existingAssignment) {
        return res.status(404).render("error", {
          errorDetails: "The requested assignment could not be found.",
          navKey: "assignments",
          pageTitle: "Assignment Not Found",
          title: "Assignment not found",
        });
      }

      return renderEditForm(res, {
        assignment: buildAssignmentEditForm({
          ...existingAssignment,
          post_return_status: req.body.post_return_status,
          returned_date: req.body.returned_date,
        }),
        errorMessage: getDbErrorMessage(error),
        formAction: `/assignments/${req.params.assignmentId}`,
        intro:
          "Use this edit screen to adjust return metadata while keeping the original user and computer fixed.",
        pageTitle: "Edit Assignment",
        statusCode: 400,
        submitLabel: "Save changes",
        title: "Edit assignment",
      });
    } catch (lookupError) {
      return next(lookupError);
    }
  }
});

router.get("/:assignmentId/return", async (req, res, next) => {
  try {
    const assignment = await getAssignmentById(req.params.assignmentId);

    if (!assignment) {
      return res.status(404).render("error", {
        errorDetails: "The requested assignment could not be found.",
        navKey: "assignments",
        pageTitle: "Assignment Not Found",
        title: "Assignment not found",
      });
    }

    if (assignment.returned_date) {
      return redirectWithMessage(
        res,
        "/assignments",
        "error",
        "That assignment has already been returned.",
      );
    }

    return renderEditForm(res, {
      assignment: buildAssignmentEditForm(assignment),
      formAction: `/assignments/${req.params.assignmentId}/return`,
      intro:
        "Return the computer through the procedure-backed workflow so the related computer status updates automatically.",
      pageTitle: "Return Assignment",
      submitLabel: "Return computer",
      title: "Return assignment",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:assignmentId/return", async (req, res, next) => {
  try {
    const assignment = await getAssignmentById(req.params.assignmentId);

    if (!assignment) {
      return res.status(404).render("error", {
        errorDetails: "The requested assignment could not be found.",
        navKey: "assignments",
        pageTitle: "Assignment Not Found",
        title: "Assignment not found",
      });
    }

    const formAssignment = buildAssignmentEditForm({
      ...assignment,
      post_return_status: req.body.post_return_status,
      returned_date: req.body.returned_date,
    });

    if (!formAssignment.returned_date) {
      return renderEditForm(res, {
        assignment: formAssignment,
        errorMessage: "Returned date is required.",
        formAction: `/assignments/${req.params.assignmentId}/return`,
        intro:
          "Return the computer through the procedure-backed workflow so the related computer status updates automatically.",
        pageTitle: "Return Assignment",
        statusCode: 400,
        submitLabel: "Return computer",
        title: "Return assignment",
      });
    }

    await pool.query(
      "CALL mydb.sp_return_computer($1, $2, $3)",
      [
        req.params.assignmentId,
        formAssignment.returned_date,
        assignment.assignment_type === "loaner"
          ? null
          : formAssignment.post_return_status || null,
      ],
    );

    return redirectWithMessage(
      res,
      "/assignments",
      "success",
      "The assignment was returned and the computer status was updated automatically.",
    );
  } catch (error) {
    try {
      const assignment = await getAssignmentById(req.params.assignmentId);

      if (!assignment) {
        return res.status(404).render("error", {
          errorDetails: "The requested assignment could not be found.",
          navKey: "assignments",
          pageTitle: "Assignment Not Found",
          title: "Assignment not found",
        });
      }

      return renderEditForm(res, {
        assignment: buildAssignmentEditForm({
          ...assignment,
          post_return_status: req.body.post_return_status,
          returned_date: req.body.returned_date,
        }),
        errorMessage: getDbErrorMessage(error),
        formAction: `/assignments/${req.params.assignmentId}/return`,
        intro:
          "Return the computer through the procedure-backed workflow so the related computer status updates automatically.",
        pageTitle: "Return Assignment",
        statusCode: 400,
        submitLabel: "Return computer",
        title: "Return assignment",
      });
    } catch (lookupError) {
      return next(lookupError);
    }
  }
});

router.post("/:assignmentId/delete", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM mydb.assignments WHERE assignment_id = $1",
      [req.params.assignmentId],
    );

    if (result.rowCount === 0) {
      return redirectWithMessage(
        res,
        "/assignments",
        "error",
        "That assignment could not be found.",
      );
    }

    return redirectWithMessage(
      res,
      "/assignments",
      "success",
      "The assignment was deleted.",
    );
  } catch (error) {
    return redirectWithMessage(
      res,
      "/assignments",
      "error",
      getDbErrorMessage(error),
    );
  }
});

module.exports = router;
