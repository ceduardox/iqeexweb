const express = require("express");
const { checkDatabaseConnection } = require("../db/health");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "iqeex-api",
    timestamp: new Date().toISOString(),
  });
});

router.get("/health/db", async (req, res, next) => {
  try {
    const db = await checkDatabaseConnection();
    res.json({ status: "ok", database: db });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
