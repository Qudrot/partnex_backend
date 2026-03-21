const db = require("../config/db");

const createProfile = async (userId, payload) => {
  const {
    business_name,
    industry_sector,
    location,
    years_of_operation,
    number_of_employees,

    annual_revenue_year_1,
    annual_revenue_amount_1,
    annual_revenue_year_2,
    annual_revenue_amount_2,
    annual_revenue_year_3,
    annual_revenue_amount_3,

    monthly_revenue,
    monthly_expenses,
    existing_liabilities,

    prior_funding_history,
    repayment_history,

    phone_number,
    website,
    whatsapp,
    linkedin,
    twitter,
    bio,
    
    // Extracted from payload for the new columns
    contact_person_name,
    contact_person_title,
    email,
    allow_sharing,
    data_source
  } = payload;

  // Validate required fields and types
  const missing = [];
  const required = {
    business_name,
    industry_sector,
    location,
    years_of_operation,
    number_of_employees,
    annual_revenue_year_1,
    annual_revenue_amount_1,
    annual_revenue_year_2,
    annual_revenue_amount_2,
    monthly_expenses,
    existing_liabilities,
    prior_funding_history
  };

  for (const [k, v] of Object.entries(required)) {
    if (v === undefined || v === null || v === "") missing.push(k);
  }

  if (missing.length > 0) {
    throw { statusCode: 400, message: `Missing required SME fields: ${missing.join(", ")}` };
  }

  // Validate numeric fields
  const numericFields = {
    years_of_operation,
    number_of_employees,
    annual_revenue_year_1,
    annual_revenue_amount_1,
    annual_revenue_year_2,
    annual_revenue_amount_2,
    monthly_expenses,
    existing_liabilities
  };

  for (const [key, value] of Object.entries(numericFields)) {
    if (!Number.isFinite(Number(value))) {
      throw { statusCode: 400, message: `${key} must be a valid number` };
    }
  }

  // Optional numeric fields
  if (annual_revenue_year_3 != null && !Number.isFinite(Number(annual_revenue_year_3))) {
    throw { statusCode: 400, message: "annual_revenue_year_3 must be a valid number" };
  }

  if (annual_revenue_amount_3 != null && !Number.isFinite(Number(annual_revenue_amount_3))) {
    throw { statusCode: 400, message: "annual_revenue_amount_3 must be a valid number" };
  }

  if (monthly_revenue != null && !Number.isFinite(Number(monthly_revenue))) {
    throw { statusCode: 400, message: "monthly_revenue must be a valid number" };
  }

  // If year 3 is used, both year and amount must be provided
  const y3Provided = annual_revenue_year_3 != null || annual_revenue_amount_3 != null;
  if (y3Provided && (annual_revenue_year_3 == null || annual_revenue_amount_3 == null)) {
    throw { statusCode: 400, message: "annual_revenue_year_3 and annual_revenue_amount_3 must be provided together" };
  }

  // prevent duplicates: one SME profile per user
  const [existing] = await db.execute("SELECT id FROM smes WHERE owner_user_id = ?", [userId]);
  if (existing.length > 0) {
    throw { statusCode: 409, message: "SME profile already exists for this user" };
  }

  const [result] = await db.execute(
    `INSERT INTO smes (
      owner_user_id,
      business_name,
      industry_sector,
      location,
      phone_number,   
      website,       
      whatsapp,      
      linkedin,       
      twitter,        
      bio,      
      years_of_operation,
      number_of_employees,
      annual_revenue_year_1,
      annual_revenue_amount_1,
      annual_revenue_year_2,
      annual_revenue_amount_2,
      annual_revenue_year_3,
      annual_revenue_amount_3,
      monthly_revenue,
      monthly_expenses,
      existing_liabilities,
      prior_funding_history,
      repayment_history,
      contact_person_name,
      contact_person_title,
      email,
      allow_sharing,
      data_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [
      userId,
      business_name,
      industry_sector,
      location,
      phone_number || null,
      website || null,
      whatsapp || null,
      linkedin || null,
      twitter || null,
      bio || null,
      Number(years_of_operation),
      Number(number_of_employees),
      Number(annual_revenue_year_1),
      Number(annual_revenue_amount_1),
      Number(annual_revenue_year_2),
      Number(annual_revenue_amount_2),
      annual_revenue_year_3 != null ? Number(annual_revenue_year_3) : null,
      annual_revenue_amount_3 != null ? Number(annual_revenue_amount_3) : null,
      monthly_revenue != null ? Number(monthly_revenue) : null,
      Number(monthly_expenses),
      Number(existing_liabilities),
      String(prior_funding_history),
      repayment_history != null ? String(repayment_history) : null,
      contact_person_name || null,
      contact_person_title || null,
      email || null,
      allow_sharing === 0 ? 0 : 1, // Ensure strict boolean-to-int mapping
      data_source || 'selfReported' // Fallback to self-reported if missing
    ]
  );

  return {
    sme: {
      id: result.insertId,
      owner_user_id: userId,
      business_name,
      industry_sector,
      location,
      years_of_operation: Number(years_of_operation),
      number_of_employees: Number(number_of_employees),
      annual_revenue_year_1: Number(annual_revenue_year_1),
      annual_revenue_amount_1: Number(annual_revenue_amount_1),
      annual_revenue_year_2: Number(annual_revenue_year_2),
      annual_revenue_amount_2: Number(annual_revenue_amount_2),
      annual_revenue_year_3: annual_revenue_year_3 != null ? Number(annual_revenue_year_3) : null,
      annual_revenue_amount_3: annual_revenue_amount_3 != null ? Number(annual_revenue_amount_3) : null,
      monthly_revenue: monthly_revenue != null ? Number(monthly_revenue) : null,
      monthly_expenses: Number(monthly_expenses),
      existing_liabilities: Number(existing_liabilities),
      prior_funding_history: String(prior_funding_history),
      repayment_history: repayment_history != null ? String(repayment_history) : null,
      data_source: data_source || 'selfReported'
    }
  };
};

const updateProfile = async (userId, payload) => {
  const [existingRows] = await db.execute(
    "SELECT id FROM smes WHERE owner_user_id = ?",
    [userId]
  );

  if (existingRows.length === 0) {
    throw { statusCode: 404, message: "SME profile not found" };
  }

  const smeId = existingRows[0].id;

  const allowedFields = {
    business_name: payload.business_name,
    industry_sector: payload.industry_sector,
    location: payload.location,
    years_of_operation: payload.years_of_operation,
    number_of_employees: payload.number_of_employees,

    annual_revenue_year_1: payload.annual_revenue_year_1,
    annual_revenue_amount_1: payload.annual_revenue_amount_1,
    annual_revenue_year_2: payload.annual_revenue_year_2,
    annual_revenue_amount_2: payload.annual_revenue_amount_2,
    annual_revenue_year_3: payload.annual_revenue_year_3,
    annual_revenue_amount_3: payload.annual_revenue_amount_3,

    monthly_revenue: payload.monthly_revenue,
    monthly_expenses: payload.monthly_expenses,
    existing_liabilities: payload.existing_liabilities,

    prior_funding_history: payload.prior_funding_history,
    repayment_history: payload.repayment_history,

    phone_number: payload.phone_number,
    website: payload.website,
    whatsapp: payload.whatsapp,
    linkedin: payload.linkedin,
    twitter: payload.twitter,
    bio: payload.bio,

    contact_person_name: payload.contact_person_name,
    contact_person_title: payload.contact_person_title,
    email: payload.email,
    allow_sharing: payload.allow_sharing,
    data_source: payload.data_source //Added data_source here
  };

  // Validate numeric fields only if provided
  const numericFields = [
    "years_of_operation",
    "number_of_employees",
    "annual_revenue_year_1",
    "annual_revenue_amount_1",
    "annual_revenue_year_2",
    "annual_revenue_amount_2",
    "annual_revenue_year_3",
    "annual_revenue_amount_3",
    "monthly_revenue",
    "monthly_expenses",
    "existing_liabilities"
  ];

  for (const field of numericFields) {
    if (allowedFields[field] !== undefined && allowedFields[field] !== null) {
      if (!Number.isFinite(Number(allowedFields[field]))) {
        throw { statusCode: 400, message: `${field} must be a valid number` };
      }
    }
  }

  // If year 3 is being updated, require both fields together when either is present
  const year3Touched =
    payload.annual_revenue_year_3 !== undefined ||
    payload.annual_revenue_amount_3 !== undefined;

  if (year3Touched) {
    const year3 = payload.annual_revenue_year_3;
    const amount3 = payload.annual_revenue_amount_3;

    if (
      (year3 === undefined || year3 === null) &&
      (amount3 !== undefined && amount3 !== null)
    ) {
      throw {
        statusCode: 400,
        message: "annual_revenue_year_3 and annual_revenue_amount_3 must be provided together"
      };
    }

    if (
      (amount3 === undefined || amount3 === null) &&
      (year3 !== undefined && year3 !== null)
    ) {
      throw {
        statusCode: 400,
        message: "annual_revenue_year_3 and annual_revenue_amount_3 must be provided together"
      };
    }
  }

  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(allowedFields)) {
    if (value !== undefined) {
      updates.push(`${key} = ?`);

      if (
        numericFields.includes(key) &&
        value !== null
      ) {
        values.push(Number(value));
      } else {
        values.push(value);
      }
    }
  }

  if (updates.length === 0) {
    throw { statusCode: 400, message: "No fields provided for update" };
  }

  values.push(smeId);

  await db.execute(
    `UPDATE smes
     SET ${updates.join(", ")}
     WHERE id = ?`,
    values
  );

  const [rows] = await db.execute("SELECT * FROM smes WHERE id = ?", [smeId]);

  return {
    message: "SME profile updated successfully",
    sme: rows[0]
  };
};

const getMyProfile = async (userId) => {
  // 1. Fetch the core SME Profile
  const [rows] = await db.execute(
    "SELECT * FROM smes WHERE owner_user_id = ?", 
    [userId]
  );
  
  if (rows.length === 0) {
    throw { statusCode: 404, message: "SME profile not found" };
  }

  const sme = rows[0];

  // 2. Fetch their most recent score from the sme_scores table
  const [scoreRows] = await db.execute(
    "SELECT * FROM sme_scores WHERE sme_id = ? ORDER BY created_at DESC LIMIT 1",
    [sme.id]
  );

  // 3. Attach the score data securely to the payload
  if (scoreRows.length > 0) {
    sme.credibility = scoreRows[0];
  }

  return { sme };
};

module.exports = { createProfile, getMyProfile, updateProfile };