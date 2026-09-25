const bcrypt = require('bcrypt');
const db = require('../config/db');
const { getRolesAndPermissions } = require('./auth.controller');
require('dotenv').config();

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;

function listUsers(req, res) {
  const users = db
    .prepare('SELECT id, username, email, is_active, created_at FROM users ORDER BY id')
    .all();

  const withRoles = users.map((u) => ({
    ...u,
    roles: getRolesAndPermissions(u.id).roles,
  }));

  res.json({ users: withRoles });
}

function getUser(req, res) {
  const user = db
    .prepare('SELECT id, username, email, is_active, created_at FROM users WHERE id = ?')
    .get(req.params.id);

  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { roles, permissions } = getRolesAndPermissions(user.id);
  res.json({ user: { ...user, roles, permissions } });
}

function updateUser(req, res) {
  const { email, isActive } = req.body;
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  db.prepare(
    `UPDATE users SET
      email = COALESCE(?, email),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(email ?? null, typeof isActive === 'boolean' ? (isActive ? 1 : 0) : null, req.params.id);

  res.json({ message: 'User updated.' });
}

function deleteUser(req, res) {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found.' });
  res.json({ message: 'User deleted.' });
}

/**
 * Assigns a role to a user (writes to the user_roles junction table).
 */
function assignRole(req, res) {
  const { roleId } = req.body;
  const userId = req.params.id;

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(roleId);
  if (!role) return res.status(404).json({ error: 'Role not found.' });

  try {
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, roleId);
    res.status(201).json({ message: 'Role assigned to user.' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: 'User already has this role.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to assign role.' });
  }
}

function revokeRole(req, res) {
  const { id: userId, roleId } = req.params;
  const result = db
    .prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?')
    .run(userId, roleId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'User does not have this role.' });
  }
  res.json({ message: 'Role revoked from user.' });
}

module.exports = { listUsers, getUser, updateUser, deleteUser, assignRole, revokeRole };
