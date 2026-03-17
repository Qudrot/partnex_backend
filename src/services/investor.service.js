const db = require("../config/db");

// ==========================================
// 1. CREATE INVESTOR PROFILE
// ==========================================
const createProfile = async (userId, payload) => {
  const { 
    full_name, 
    organization, 
    location, 
    investor_type, 
    preferred_sectors, 
    typical_ticket_size 
  } = payload;

  if (!full_name) {
    throw { statusCode: 400, message: "full_name is required" };
  }

  // Prevent duplicate profiles
  const [existing] = await db.execute("SELECT id FROM investors WHERE owner_user_id = ?", [userId]);
  if (existing.length > 0) {
    throw { statusCode: 409, message: "Investor profile already exists for this user" };
  }

  // Safely stringify the sectors array for the MySQL JSON column
  const sectorsJson = Array.isArray(preferred_sectors) 
    ? JSON.stringify(preferred_sectors) 
    : null;

  const [result] = await db.execute(
    `INSERT INTO investors (
      owner_user_id, full_name, organization, location, 
      investor_type, preferred_sectors, typical_ticket_size
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId, 
      full_name, 
      organization || null, 
      location || null, 
      investor_type || null, 
      sectorsJson, 
      typical_ticket_size || null
    ]
  );

  return {
    message: "Investor profile created successfully",
    investor: {
      id: result.insertId,
      owner_user_id: userId,
      full_name,
      investor_type,
      preferred_sectors
    }
  };
};

// ==========================================
// 2. GET MY INVESTOR PROFILE
// ==========================================
const getMyProfile = async (userId) => {
  const [rows] = await db.execute("SELECT * FROM investors WHERE owner_user_id = ?", [userId]);
  if (rows.length === 0) throw { statusCode: 404, message: "Investor profile not found" };
  return { investor: rows[0] };
};

// ==========================================
// 3. LIST SMES (Your original code)
// ==========================================
const listSmesWithScores = async (query) => {
  let minScore = null;
  if (query.minScore !== undefined) {
    const n = Number(query.minScore);
    if (!Number.isFinite(n)) throw { statusCode: 400, message: "minScore must be a valid number" };
    minScore = n;
  }

  let risk = null;
  if (query.risk) {
    const r = String(query.risk).trim().toUpperCase();
    const allowed = new Set(["LOW", "MEDIUM", "HIGH"]);
    if (!allowed.has(r)) throw { statusCode: 400, message: "risk must be LOW, MEDIUM, or HIGH" };
    risk = r;
  }

  const rawLimit = Number(query.limit ?? 50);
  const rawOffset = Number(query.offset ?? 0);

  if (!Number.isFinite(rawLimit) || rawLimit < 1) throw { statusCode: 400, message: "limit must be a positive number" };
  if (!Number.isFinite(rawOffset) || rawOffset < 0) throw { statusCode: 400, message: "offset must be zero or a positive number" };

  const limit = Math.min(rawLimit, 100);
  const offset = rawOffset;

  let sql = `
    SELECT 
      s.id AS sme_id, s.business_name, s.industry_sector AS industry, s.location,
      s.years_of_operation, s.number_of_employees AS employees, sc.score, sc.risk_level, sc.created_at AS scored_at
    FROM smes s
    LEFT JOIN (
      SELECT t1.* FROM sme_scores t1
      INNER JOIN (
        SELECT sme_id, MAX(created_at) AS max_created FROM sme_scores GROUP BY sme_id
      ) t2 ON t1.sme_id = t2.sme_id AND t1.created_at = t2.max_created
    ) sc ON sc.sme_id = s.id
    WHERE 1=1
  `;

  const params = [];
  if (minScore !== null) {
    sql += " AND (sc.score IS NOT NULL AND sc.score >= ?)";
    params.push(minScore);
  }
  if (risk) {
    sql += " AND sc.risk_level = ?";
    params.push(risk);
  }

  sql += " ORDER BY (sc.score IS NULL), sc.score DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const [rows] = await db.execute(sql, params);
  return { smes: rows, meta: { limit, offset, count: rows.length } };
};

module.exports = { createProfile, getMyProfile, listSmesWithScores };