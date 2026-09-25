const bcrypt = require('bcrypt');
const db = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt.util');
require('dotenv').config();

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;

/**
 * Resolves a user's roles and the flattened, de-duplicated set of
 * permissions granted by those roles, by joining all five tables:
 * users -> user_roles -> roles -> role_permissions -> permissions
 */
function getRolesAndPermissions(userId) {
  const roles = db
    .prepare(
      `SELECT r.id, r.name
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?`
    )
    .all(userId);

  const permissions = db
    .prepare(
      `SELECT DISTINCT p.name
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = ?`
    )
    .all(userId)
    .map((row) => row.name);

  return { roles: roles.map((r) => r.name), permissions };
}

function register(req, res) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    const result = db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(username, email, passwordHash);

    // Default new users to the "viewer" role if it exists
    const viewerRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('viewer');
    if (viewerRole) {
      db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(
        result.lastInsertRowid,
        viewerRole.id
      );
    }

    return res.status(201).json({
      message: 'User registered successfully.',
      userId: result.lastInsertRowid,
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username or email already in use.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
}

function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required.' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(username, username);

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const passwordMatches = bcrypt.compareSync(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const { roles, permissions } = getRolesAndPermissions(user.id);

  const tokenPayload = {
    sub: user.id,
    username: user.username,
    roles,
    permissions,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ sub: user.id });

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      roles,
      permissions,
    },
  });
}

function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required.' });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.sub);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User no longer valid.' });
    }

    const { roles, permissions } = getRolesAndPermissions(user.id);
    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      roles,
      permissions,
    });

    return res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
}

function me(req, res) {
  // req.user comes from the authenticate middleware (decoded access token)
  return res.json({ user: req.user });
}

module.exports = { register, login, refresh, me, getRolesAndPermissions };
