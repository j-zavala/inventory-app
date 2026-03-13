const FRIENDLY_CONSTRAINT_MESSAGES = {
  chk_assignment_dates: "Returned date cannot be earlier than assigned date.",
  chk_assignment_loaner_post_return_status:
    "Loaner assignments do not use a post-return status.",
  chk_assignment_post_return_status:
    "Returned long-term assignments require a post-return status.",
  computers_asset_tag_key: "That asset tag is already in use.",
  computers_serial_number_key: "That serial number is already in use.",
  computers_software_pkey:
    "That software is already installed on the selected computer.",
  deaccessions_computer_id_key:
    "That computer already has a deaccession record.",
  uq_active_assignment_per_computer:
    "That computer already has an active assignment.",
  uq_locations_building_room_ci: "That location already exists.",
  users_email_key: "That email address is already in use.",
};

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

  return String(value).slice(0, 10);
}

function parsePositiveId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildRedirectUrl(pathname, type, message) {
  const search = new URLSearchParams();

  if (message) {
    search.set(type, message);
  }

  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function redirectWithMessage(res, pathname, type, message) {
  res.redirect(buildRedirectUrl(pathname, type, message));
}

function getFlash(req) {
  return {
    errorMessage: req.query.error || null,
    successMessage: req.query.success || null,
  };
}

function mapOptions(rows, valueKey, labelBuilder) {
  return rows.map((row) => ({
    label: labelBuilder(row),
    value: String(row[valueKey]),
  }));
}

function getDbErrorMessage(error) {
  if (!error) {
    return "The database could not save that change.";
  }

  if (error.code === "P0001") {
    return error.message;
  }

  if (error.code === "23505" || error.code === "23514") {
    return (
      FRIENDLY_CONSTRAINT_MESSAGES[error.constraint] ||
      "That change conflicts with an existing database rule."
    );
  }

  if (error.code === "23503") {
    if (error.constraint === "fk_computers_location") {
      return "Choose a valid location: A location with 1 or more computers cannot be deleted.";
    }

    if (error.constraint === "fk_assignments_user") {
      return "Choose a valid user.";
    }

    if (error.constraint === "fk_assignments_computer") {
      return "Choose a valid computer.";
    }

    if (error.constraint === "fk_deaccessions_computer") {
      return "Choose a valid computer for the deaccession record.";
    }

    return "This record is linked to other data. Remove the related records first or choose a different value.";
  }

  if (error.code === "23502") {
    return "A required field is missing.";
  }

  if (error.code === "22P02") {
    return "One of the entered values has the wrong format.";
  }

  return "The database could not save that change. Please review the form and try again.";
}

module.exports = {
  emptyToNull,
  getDbErrorMessage,
  getFlash,
  mapOptions,
  parsePositiveId,
  redirectWithMessage,
  toDateInput,
};
