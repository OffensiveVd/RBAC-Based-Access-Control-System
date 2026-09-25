const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permission.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');

router.use(authenticate);

router.get('/', requirePermission('permissions:read'), permissionController.listPermissions);
router.post('/', requirePermission('permissions:assign'), permissionController.createPermission);
router.delete('/:id', requirePermission('permissions:assign'), permissionController.deletePermission);

module.exports = router;
