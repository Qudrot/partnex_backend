const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const db = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const smeRoutes = require("./routes/sme.routes");

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
  })
);

app.get("/db-health", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT 1 AS ok");
    res.json({ ok: true, db: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
})

app.get("/", (req, res) => res.json({ ok: true, name: "partnex-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/sme", smeRoutes);
app.use("/api/score", require("./routes/scoring.route"));
app.use("/api/investor", require("./routes/investor.route"));

module.exports = app;