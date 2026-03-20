const db = require("../config/db");

// ==========================================
// 1. SAVE (CREATE OR UPDATE) INVESTOR PROFILE
// ==========================================
const saveProfile = async (userId, payload) => {
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

  // Safely stringify the sectors array for the MySQL JSON column
  const sectorsJson = Array.isArray(preferred_sectors) 
    ? JSON.stringify(preferred_sectors) 
    : null;

  // Check if the profile already exists
  const [existing] = await db.execute("SELECT id FROM investors WHERE owner_user_id = ?", [userId]);

  if (existing.length > 0) {
    // PROFILE EXISTS -> UPDATE IT
    await db.execute(
      `UPDATE investors 
       SET full_name = ?, organization = ?, location = ?, investor_type = ?, 
           preferred_sectors = ?, typical_ticket_size = ?
       WHERE owner_user_id = ?`,
      [
        full_name, 
        organization || null, 
        location || null, 
        investor_type || null, 
        sectorsJson, 
        typical_ticket_size || null, 
        userId
      ]
    );
    
    return { message: "Investor profile updated successfully", isNew: false };
  } else {
    // PROFILE DOES NOT EXIST -> CREATE IT
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
      isNew: true,
      investor: { id: result.insertId, owner_user_id: userId, full_name }
    };
  }
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
// 3. LIST SMES
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
      s.id AS sme_id, 
      s.business_name, 
      s.industry_sector AS industry, 
      s.location,
      s.years_of_operation, 
      s.number_of_employees AS employees, 
      
      /* ADDING THE FINANCIAL METRICS FOR THE FLUTTER APP */
      s.annual_revenue_amount_1,
      s.annual_revenue_amount_2,
      s.monthly_expenses,
      s.existing_liabilities,
      s.prior_funding_history,
      s.bio,
      s.website,
      
      s.phone_number,
      s.whatsapp,
      s.linkedin,
      s.twitter,
      s.allow_sharing,
      'Bank Data' AS data_source,

      /* Smart fallbacks! If the SME profile contact is blank, use the User signup data */
      COALESCE(s.contact_person_name, u.name) AS contact_person_name,
      COALESCE(s.contact_person_title, u.position) AS contact_person_title,
      COALESCE(s.email, u.email) AS email,
      
      sc.score, 
      sc.risk_level, 
      sc.explanation_json AS explanation, 
      sc.created_at AS scored_at_raw_timestamp
    FROM smes s
    
    /* Link the users table so we can read the signup data */
    LEFT JOIN users u ON s.owner_user_id = u.id 
    
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

  sql += ` ORDER BY (sc.score IS NULL), sc.score DESC LIMIT ${limit} OFFSET ${offset}`;
  // NOTE: We completely removed the params.push line!git 

  const [rows] = await db.execute(sql, params);
  return { smes: rows, meta: { limit, offset, count: rows.length } };
};

module.exports = { saveProfile, getMyProfile, listSmesWithScores };