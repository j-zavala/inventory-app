require("dotenv").config({ quiet: true });

const express = require("express");
const path = require("path");

const assignmentsRouter = require("./routes/assignments");
const computersRouter = require("./routes/computers");
const deaccessionsRouter = require("./routes/deaccessions");
const locationsRouter = require("./routes/locations");
const reportsRouter = require("./routes/reports");
const softwareRouter = require("./routes/software");
const softwareInstallationsRouter = require("./routes/software-installations");
const usersRouter = require("./routes/users");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.redirect("/computers");
});
app.use("/users", usersRouter);
app.use("/locations", locationsRouter);
app.use("/software", softwareRouter);
app.use("/computers", computersRouter);
app.use("/assignments", assignmentsRouter);
app.use("/deaccessions", deaccessionsRouter);
app.use("/software-installations", softwareInstallationsRouter);
app.use("/reports", reportsRouter);

app.use((req, res) => {
  res.status(404).render("error", {
    errorDetails: "The requested page does not exist.",
    navKey: "computers",
    pageTitle: "Page Not Found",
    title: "Page not found",
  });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).render("error", {
    errorDetails:
      error.message ||
      "The application ran into an unexpected problem while processing that request.",
    navKey: "computers",
    pageTitle: "Application Error",
    title: "Something went wrong",
  });
});

module.exports = app;
