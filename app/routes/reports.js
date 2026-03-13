const express = require("express");

const { pool } = require("../lib/db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const [
      computersByStatusResult,
      assignmentsByDepartmentResult,
      softwareCountsResult,
      deaccessionsByReasonResult,
    ] = await Promise.all([
      pool.query("SELECT * FROM mydb.v_report_computers_by_status_device"),
      pool.query("SELECT * FROM mydb.v_report_active_assignments_by_department"),
      pool.query("SELECT * FROM mydb.v_report_software_install_counts"),
      pool.query("SELECT * FROM mydb.v_report_deaccessions_by_reason"),
    ]);

    res.render("reports", {
      assignmentsByDepartment: assignmentsByDepartmentResult.rows,
      computersByStatus: computersByStatusResult.rows,
      deaccessionsByReason: deaccessionsByReasonResult.rows,
      navKey: "reports",
      pageTitle: "Reports",
      softwareCounts: softwareCountsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
