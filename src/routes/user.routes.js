const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');

router.use(authenticate); // every route below requires a valid access token

router.get('/', requirePermission('users:read'), userController.listUsers);
router.get('/:id', requirePermission('users:read'), userController.getUser);
router.put('/:id', requirePermission('users:write'), userController.updateUser);
router.delete('/:id', requirePermission('users:delete'), userController.deleteUser);

router.post('/:id/roles', requirePermission('users:write'), userController.assignRole);
router.delete('/:id/roles/:roleId', requirePermission('users:write'), userController.revokeRole);

module.exports = router;
