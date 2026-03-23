const fs = require("fs");
const path = require("path");
const express = require("express");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();
const projectRoot = path.resolve(__dirname, "..");
const staticRoot = projectRoot;
const dashboardDist = path.join(projectRoot, "client", "dist");
const dashboardIndex = path.join(dashboardDist, "index.html");
const legacyAccessPage = path.join(staticRoot, "acceso.html");

app.use(express.json());
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", dashboardRoutes);

app.use("/dashboard", express.static(dashboardDist));
app.get(/^\/dashboard(\/.*)?$/, (req, res) => {
  if (fs.existsSync(dashboardIndex)) {
    return res.sendFile(dashboardIndex);
  }

  if (fs.existsSync(legacyAccessPage)) {
    return res.sendFile(legacyAccessPage);
  }

  return res.status(404).json({
    status: "error",
    message: "Dashboard not available",
  });
});

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
