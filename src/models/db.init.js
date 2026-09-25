/**
 * db.init.js
 * Defines and seeds the five-table relational RBAC schema:
 *   1. users            - application accounts
 *   2. roles            - named roles (e.g. admin, manager, viewer)
 *   3. permissions      - fine-grained action grants (e.g. users:delete)
 *   4. user_roles       - junction table: many-to-many users <-> roles
 *   5. role_permissions - junction table: many-to-many roles <-> permissions
 */

const bcrypt = require('bcrypt');
const db = require('../config/db');
require('dotenv').config();

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,   -- e.g. "users:read", "users:delete"
      resource    TEXT NOT NULL,          -- e.g. "users"
      action      TEXT NOT NULL,          -- e.g. "read", "write", "delete"
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id     INTEGER NOT NULL,
      role_id     INTEGER NOT NULL,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id       INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
    CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions(role_id);
    CREATE INDEX IF NOT EXISTS idx_role_perms_perm ON role_permissions(permission_id);
  `);
  console.log('Schema created (5 tables: users, roles, permissions, user_roles, role_permissions).');
}

function seed() {
  const roleCount = db.prepare('SELECT COUNT(*) AS c FROM roles').get().c;
  if (roleCount > 0) {
    console.log('Seed skipped — data already exists.');
    return;
  }

  const insertRole = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
  const insertPermission = db.prepare(
    'INSERT INTO permissions (name, resource, action, description) VALUES (?, ?, ?, ?)'
  );
  const insertUser = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  );
  const linkRolePermission = db.prepare(
    'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
  );
  const linkUserRole = db.prepare(
    'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)'
  );

  const seedTransaction = db.transaction(() => {
    // --- Roles ---
    const adminRoleId = insertRole.run('admin', 'Full system access').lastInsertRowid;
    const managerRoleId = insertRole.run('manager', 'Manage users, read-only on system config').lastInsertRowid;
    const viewerRoleId = insertRole.run('viewer', 'Read-only access').lastInsertRowid;

    // --- Permissions (resource:action pattern) ---
    const perms = [
      ['users:read', 'users', 'read', 'View user accounts'],
      ['users:write', 'users', 'write', 'Create or update user accounts'],
      ['users:delete', 'users', 'delete', 'Delete user accounts'],
      ['roles:read', 'roles', 'read', 'View roles'],
      ['roles:write', 'roles', 'write', 'Create or update roles'],
      ['roles:delete', 'roles', 'delete', 'Delete roles'],
      ['permissions:read', 'permissions', 'read', 'View permissions'],
      ['permissions:assign', 'permissions', 'assign', 'Assign permissions to roles'],
    ];
    const permIds = {};
    for (const [name, resource, action, description] of perms) {
      permIds[name] = insertPermission.run(name, resource, action, description).lastInsertRowid;
    }

    // --- Role -> Permission mapping ---
    // admin: everything
    Object.values(permIds).forEach((pid) => linkRolePermission.run(adminRoleId, pid));

    // manager: read/write users, read roles/permissions
    [permIds['users:read'], permIds['users:write'], permIds['roles:read'], permIds['permissions:read']]
      .forEach((pid) => linkRolePermission.run(managerRoleId, pid));

    // viewer: read-only across the board
    [permIds['users:read'], permIds['roles:read'], permIds['permissions:read']]
      .forEach((pid) => linkRolePermission.run(viewerRoleId, pid));

    // --- Seed users (password for all demo accounts: "Passw0rd!123") ---
    const passwordHash = bcrypt.hashSync('Passw0rd!123', SALT_ROUNDS);
    const adminUserId = insertUser.run('admin', 'admin@example.com', passwordHash).lastInsertRowid;
    const managerUserId = insertUser.run('manager1', 'manager1@example.com', passwordHash).lastInsertRowid;
    const viewerUserId = insertUser.run('viewer1', 'viewer1@example.com', passwordHash).lastInsertRowid;

    // --- User -> Role mapping ---
    linkUserRole.run(adminUserId, adminRoleId);
    linkUserRole.run(managerUserId, managerRoleId);
    linkUserRole.run(viewerUserId, viewerRoleId);
  });

  seedTransaction();
  console.log('Seed complete:');
  console.log('  admin    / Passw0rd!123  (role: admin)');
  console.log('  manager1 / Passw0rd!123  (role: manager)');
  console.log('  viewer1  / Passw0rd!123  (role: viewer)');
}

createSchema();
seed();

module.exports = { createSchema, seed };
