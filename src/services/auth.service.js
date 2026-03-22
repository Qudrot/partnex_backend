const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validatePassword = (password) => {
  if (typeof password !== "string") return "Password must be a string";

  const p = password.trim();
  if (p.length === 0) return "Password cannot be empty or spaces";
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 72) return "Password must be 72 characters or less";

  if (!/[A-Z]/.test(p)) return "Password must include at least 1 uppercase letter";
  if (!/[a-z]/.test(p)) return "Password must include at least 1 lowercase letter";
  if (!/[0-9]/.test(p)) return "Password must include at least 1 number";
  if (!/[^A-Za-z0-9]/.test(p)) return "Password must include at least 1 symbol";

  // blocks: 111111111, aaaaaaaa, --------, @@@@@@@@
  if (/^(.)\1+$/.test(p)) return "Password is too weak";

  return null;
};

const signToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

// Added name and position to the destructuring payload
const registerUser = async ({ email, password, role, name, position }) => {
  email = normalizeEmail(email);
  role = String(role || "").trim().toLowerCase();
  
  // Sanitize the new fields
  const sanitizedName = name ? String(name).trim() : null;
  const sanitizedPosition = position ? String(position).trim() : null;

  if (!email) throw { statusCode: 400, message: "Email is required" };
  if (!isValidEmail(email)) throw { statusCode: 400, message: "Invalid email address" };

  const passwordError = validatePassword(password);
  if (passwordError) throw { statusCode: 400, message: passwordError };

  if (!role) throw { statusCode: 400, message: "Role is required" };

  const allowedRoles = ["sme", "investor", "admin"];
  if (!allowedRoles.includes(role)) {
    throw { statusCode: 400, message: "role must be sme, investor, or admin" };
  }

  const [existing] = await db.execute("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length > 0) {
    throw { statusCode: 409, message: "Unable to register with provided details"};
  }

  const password_hash = await bcrypt.hash(password.trim(), 12);

  // Added name and position to the INSERT query and values array
  const [result] = await db.execute(
    "INSERT INTO users (email, password_hash, role, name, position) VALUES (?, ?, ?, ?, ?)",
    [email, password_hash, role, sanitizedName, sanitizedPosition]
  );

  // Return the name and position to the frontend immediately after signup
  const user = { 
    id: result.insertId, 
    email, 
    role, 
    name: sanitizedName, 
    position: sanitizedPosition 
  };
  const token = signToken(user);

  return { user, token };
};

const loginUser = async ({ email, password }) => {
  email = normalizeEmail(email);

  if (!email) throw { statusCode: 400, message: "Email is required" };
  if (!isValidEmail(email)) throw { statusCode: 400, message: "Invalid email address" };

  if (typeof password !== "string" || password.trim().length === 0) {
    throw { statusCode: 400, message: "Password is required" };
  }

  // Added name and position to the SELECT query so the frontend gets them on login
  const [rows] = await db.execute(
    "SELECT id, email, password_hash, role, name, position FROM users WHERE email = ?",
    [email]
  );

  if (rows.length === 0) {
    throw { statusCode: 401, message: "Invalid credentials" };
  }

  const userRow = rows[0];

  const ok = await bcrypt.compare(password.trim(), userRow.password_hash);
  if (!ok) {
    throw { statusCode: 401, message: "Invalid credentials" };
  }

// Include name and position in the returned user object
  const user = { 
    id: userRow.id, 
    email: userRow.email, 
    role: userRow.role,
    name: userRow.name,
    position: userRow.position
  };
  const token = signToken(user);

  return { user, token };
};

module.exports = { registerUser, loginUser };