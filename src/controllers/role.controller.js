const db = require('../config/db');

function listRoles(req, res) {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();

  const withPermissions = roles.map((role) => {
    const permissions = db
      .prepare(
        `SELECT p.name FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = ?`
      )
      .all(role.id)
      .map((p) => p.name);
    return { ...role, permissions };
  });

  res.json({ roles: withPermissions });
}

function createRole(req, res) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Role name is required.' });

  try {
    const result = db
      .prepare('INSERT INTO roles (name, description) VALUES (?, ?)')
      .run(name, description || null);
    res.status(201).json({ message: 'Role created.', roleId: result.lastInsertRowid });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Role name already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create role.' });
  }
}

function updateRole(req, res) {
  const { description } = req.body;
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Role not found.' });

  db.prepare('UPDATE roles SET description = COALESCE(?, description) WHERE id = ?').run(
    description ?? null,
    req.params.id
  );
  res.json({ message: 'Role updated.' });
}

function deleteRole(req, res) {
  const result = db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Role not found.' });
  res.json({ message: 'Role deleted.' });
}

/**
 * Grants a permission to a role (writes to the role_permissions junction table).
 */
function grantPermission(req, res) {
  const { permissionId } = req.body;
  const roleId = req.params.id;

  const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(roleId);
  if (!role) return res.status(404).json({ error: 'Role not found.' });

  const permission = db.prepare('SELECT id FROM permissions WHERE id = ?').get(permissionId);
  if (!permission) return res.status(404).json({ error: 'Permission not found.' });

  try {
    db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(
      roleId,
      permissionId
    );
    res.status(201).json({ message: 'Permission granted to role.' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: 'Role already has this permission.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to grant permission.' });
  }
}

function revokePermission(req, res) {
  const { id: roleId, permissionId } = req.params;
  const result = db
    .prepare('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?')
    .run(roleId, permissionId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Role does not have this permission.' });
  }
  res.json({ message: 'Permission revoked from role.' });
}

module.exports = {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  grantPermission,
  revokePermission,
};
