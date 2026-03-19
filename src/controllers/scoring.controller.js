const axios = require("axios");
const db = require("../config/db");

// 1. The Local Calculator (Moved from Python)
function calculateSmartMetrics(payload) {
  const revenue = Number(payload.annual_revenue_amount_1) || 0;
  const expenses = Number(payload.monthly_expenses) * 12 || 0; 
  const debt = Number(payload.existing_liabilities) || 0;
  
  let impactScore = 0.2; 
  const employees = Number(payload.number_of_employees) || 0;
  if (employees >= 50) impactScore += 0.3;
  else if (employees >= 20) impactScore += 0.2;
  else if (employees >= 5) impactScore += 0.1;

  if (revenue >= 50000000) impactScore += 0.3;
  else if (revenue >= 15000000) impactScore += 0.2;
  else if (revenue >= 5000000) impactScore += 0.1;

  const sector = (payload.industry_sector || '').toLowerCase();
  const highImpact = ['health', 'education', 'agriculture', 'farming', 'clean energy'];
  const mediumImpact = ['manufacturing', 'technology', 'logistics', 'fintech'];

  if (highImpact.some(k => sector.includes(k))) impactScore += 0.2;
  else if (mediumImpact.some(k => sector.includes(k))) impactScore += 0.1;

  let consistencyScore = 0.5; 
  if (revenue > 0) {
    if (expenses < revenue) consistencyScore += 0.25;
    if (debt <= (revenue * 0.5)) consistencyScore += 0.25;
  }

  return {
    impact_score: Math.min(Number(impactScore.toFixed(2)), 1.0),
    consistency_score: Math.min(Number(consistencyScore.toFixed(2)), 1.0)
  };
}

// 2. The Smart Interceptor Endpoint
const generateScore = async (userId, payload) => {
  // Get the SME ID & current profile data from the database
  const [smeRows] = await db.execute("SELECT * FROM smes WHERE owner_user_id = ?", [userId]);
  if (smeRows.length === 0) throw { statusCode: 404, message: "SME profile not found" };
  const currentSme = smeRows[0];
  const smeId = currentSme.id;

  // Calculate the new logic locally
  const { impact_score, consistency_score } = calculateSmartMetrics(payload);

  // Fetch their most recent AI score
  const [scoreRows] = await db.execute(
    "SELECT * FROM sme_scores WHERE sme_id = ? ORDER BY created_at DESC LIMIT 1",
    [smeId]
  );

  if (scoreRows.length > 0) {
    const lastScore = scoreRows[0];
    
    // Parse the old JSON to see what their impact score used to be
    let oldImpact = 0.2;
    let oldConsistency = 0.5;
    try {
      const oldExpl = typeof lastScore.explanation_json === 'string' 
        ? JSON.parse(lastScore.explanation_json) 
        : lastScore.explanation_json;
      if (oldExpl && oldExpl.model_inputs) {
        oldImpact = oldExpl.model_inputs.impact_score || 0.2;
        oldConsistency = oldExpl.model_inputs.reporting_consistency || 0.5;
      }
    } catch (e) {}

    // CHECK 1: Did the core financial numbers change?
    const financialsChanged = 
      Number(currentSme.annual_revenue_amount_1) !== Number(payload.annual_revenue_amount_1) ||
      Number(currentSme.monthly_expenses) !== Number(payload.monthly_expenses) ||
      Number(currentSme.existing_liabilities) !== Number(payload.existing_liabilities);

    // CHECK 2: Did the impact or consistency thresholds actually shift?
    const impactChanged = oldImpact !== impact_score;
    const consistencyChanged = oldConsistency !== consistency_score;

    // THE INTERCEPT: If nothing mathematically significant changed, skip Python!
    if (!financialsChanged && !impactChanged && !consistencyChanged) {
      console.log("SMART DIFF: No significant changes detected. Bypassing ML Engine.");
      
      // Return the cached score with a dynamic, user-validating message
      return {
        sme_id: smeId,
        score_id: lastScore.id,
        score: lastScore.score,
        risk_level: lastScore.risk_level,
        model_version: lastScore.model_version,
        explanation: {
          source: "smart-cache",
          model_inputs: {
            revenue: Number(payload.annual_revenue_amount_1),
            expenses: Number(payload.monthly_expenses),
            debt: Number(payload.existing_liabilities),
            impact_score: impact_score,
            reporting_consistency: consistency_score
          },
          // This is the magic UX text that stops Score Fatigue!
          note: "Profile updated! We've saved your new details. Because your core financial ratios and impact bracket remained stable, your Credibility Score holds steady."
        }
      };
    }
  }

  // ==========================================
  // IF CHANGES WERE DETECTED -> WAKE UP PYTHON
  // ==========================================
  
  // Package exactly what Python needs
  const aiPayload = {
    revenue: Number(payload.annual_revenue_amount_1) || 0,
    expenses: Number(payload.monthly_expenses) * 12 || 0, 
    debt: Number(payload.existing_liabilities) || 0,
    revenue_growth: 0, // Add YoY calculation here if desired
    impact_score: impact_score,
    consistency_score: consistency_score
  };

  // Call the Python ML Engine
  const response = await axios.post(process.env.AI_SERVICE_URL, aiPayload);
  const aiData = response.data;

  // Insert the new AI score into the database here...
  // ...

  return aiData;
};

module.exports = { generateScore };

const scoringService = require("../services/scoring.service");

const runMyScore = async (req, res) => {
  try {
    const result = await scoringService.runScoreForSmeUser(req.user.id);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

module.exports = { runMyScore };