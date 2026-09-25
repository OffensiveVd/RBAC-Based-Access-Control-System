const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');

router.use(authenticate);

router.get('/', requirePermission('roles:read'), roleController.listRoles);
router.post('/', requirePermission('roles:write'), roleController.createRole);
router.put('/:id', requirePermission('roles:write'), roleController.updateRole);
router.delete('/:id', requirePermission('roles:delete'), roleController.deleteRole);

router.post(
  '/:id/permissions',
  requirePermission('permissions:assign'),
  roleController.grantPermission
);
router.delete(
  '/:id/permissions/:permissionId',
  requirePermission('permissions:assign'),
  roleController.revokePermission
);

module.exports = router;
