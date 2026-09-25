const db = require('../config/db');

function listPermissions(req, res) {
  const permissions = db.prepare('SELECT * FROM permissions ORDER BY resource, action').all();
  res.json({ permissions });
}

function createPermission(req, res) {
  const { name, resource, action, description } = req.body;
  if (!name || !resource || !action) {
    return res.status(400).json({ error: 'name, resource, and action are required.' });
  }

  try {
    const result = db
      .prepare('INSERT INTO permissions (name, resource, action, description) VALUES (?, ?, ?, ?)')
      .run(name, resource, action, description || null);
    res.status(201).json({ message: 'Permission created.', permissionId: result.lastInsertRowid });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Permission name already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create permission.' });
  }
}

function deletePermission(req, res) {
  const result = db.prepare('DELETE FROM permissions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Permission not found.' });
  res.json({ message: 'Permission deleted.' });
}

module.exports = { listPermissions, createPermission, deletePermission };
