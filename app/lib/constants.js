const DEVICE_TYPES = ["desktop", "laptop", "tablet"];

const COMPUTER_STATUSES = [
  "available",
  "assigned",
  "available_loaner",
  "deaccessioned",
  "wiped",
  "in-repair",
];

const USER_ROLE_TYPES = ["staff", "faculty", "it"];
const ASSIGNMENT_TYPES = ["long_term", "loaner"];
const LONG_TERM_RETURN_STATUSES = ["available", "wiped", "in-repair"];

module.exports = {
  ASSIGNMENT_TYPES,
  COMPUTER_STATUSES,
  DEVICE_TYPES,
  LONG_TERM_RETURN_STATUSES,
  USER_ROLE_TYPES,
};
