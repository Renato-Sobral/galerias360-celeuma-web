const express = require('express');
const router = express.Router();
const {deleteUser, unblockUser, blockUser, updateUserRole, userDetailsById, listUsers, listRoles} = require('../controllers/userController');

router.get('/list', listUsers);
router.get('/details/:id_user', userDetailsById);
router.get('/roles', listRoles);
router.patch('/update-role/:id_user', updateUserRole);
router.patch("/block/:id_user", blockUser);
router.patch("/unblock/:id_user", unblockUser);
router.delete("/delete/:id_user", deleteUser);
module.exports = router;
