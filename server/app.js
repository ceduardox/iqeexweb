const fs = require("fs");
const path = require("path");
const express = require("express");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();
const staticRoot = path.resolve(process.cwd());
const dashboardDist = path.resolve(process.cwd(), "client", "dist");
const dashboardIndex = path.join(dashboardDist, "index.html");
const hasDashboardBuild = fs.existsSync(dashboardIndex);

app.use(express.json());
app.use("/api", healthRoutes);
app.use("/api", authRoutes);

if (hasDashboardBuild) {
  app.use("/dashboard", express.static(dashboardDist));

  app.get(/^\/dashboard(\/.*)?$/, (req, res) => {
    res.sendFile(dashboardIndex);
  });
}

app.use(express.static(staticRoot));

app.use("/api", (req, res) => {
  res.status(404).json({
    status: "error",
    message: "API route not found",
  });
});

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
    detail: err.message,
  });
});

module.exports = app;
