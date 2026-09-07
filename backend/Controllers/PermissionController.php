<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\PermissionService;

class PermissionController
{
    /**
     * GET /organizations/{org_id}/permissions
     * The full platform catalog, grouped by module — org admin picks from
     * this when building/editing a role.
     */
    public function index(int $orgId): mixed
    {
        try {
            $rows = DB::raw("SELECT name, module, description FROM permissions ORDER BY module, name", []);

            $grouped = [];
            foreach ($rows as $row) {
                $grouped[$row->module][] = ['name' => $row->name, 'description' => $row->description];
            }

            return responseJson(success: true, data: $grouped, message: 'Permissions retrieved successfully', code: 200);
        } catch (\Exception $e) {
            error_log('PermissionController@index error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to retrieve permissions', code: 500);
        }
    }

    /**
     * GET /organizations/{org_id}/users/{user_id}/permissions
     * All effective permissions for a user (role-derived + direct grants,
     * minus revokes) plus their direct overrides listed separately so the
     * UI can show "inherited from role X" vs "granted directly".
     */
    public function forUser(int $orgId, int $userId): mixed
    {
        try {
            $user = DB::raw(
                "SELECT id FROM users WHERE id = :id AND organization_id = :org_id",
                [':id' => $userId, ':org_id' => $orgId]
            );
            if (empty($user)) {
                return responseJson(success: false, data: null, message: 'User not found in this organization', code: 404);
            }

            $overrides = DB::raw(
                "SELECT p.name, mhp.type, mhp.scope
                 FROM model_has_permissions mhp
                 INNER JOIN permissions p ON p.id = mhp.permission_id
                 WHERE mhp.user_id = :user_id",
                [':user_id' => $userId]
            );

            return responseJson(
                success: true,
                data: [
                    'effective_permissions' => PermissionService::allPermissionsFor($userId),
                    'direct_overrides'      => $overrides,
                ],
                message: 'User permissions retrieved successfully',
                code: 200
            );
        } catch (\Exception $e) {
            error_log('PermissionController@forUser error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to retrieve user permissions', code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/users/{user_id}/permissions
     * Body: { permission: 'leaves.approve', type: 'grant'|'revoke', scope?: 'own'|'team'|'department'|'all' }
     * A direct grant/revoke always overrides whatever the user's role(s) say.
     */
    public function grantOrRevoke(int $orgId, int $userId): mixed
    {
        try {
            $userRow = DB::raw(
                "SELECT id FROM users WHERE id = :id AND organization_id = :org_id",
                [':id' => $userId, ':org_id' => $orgId]
            );
            if (empty($userRow)) {
                return responseJson(success: false, data: null, message: 'User not found in this organization', code: 404);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $permissionName = $data['permission'] ?? null;
            $type           = $data['type'] ?? 'grant';
            $scope          = $data['scope'] ?? 'all';

            if (!$permissionName || !in_array($type, ['grant', 'revoke'], true)) {
                return responseJson(success: false, data: null, message: 'permission and a valid type (grant|revoke) are required', code: 400);
            }

            $permission = DB::raw("SELECT id FROM permissions WHERE name = :name", [':name' => $permissionName]);
            if (empty($permission)) {
                return responseJson(success: false, data: null, message: 'Unknown permission', code: 404);
            }

            DB::raw(
                "INSERT INTO model_has_permissions (user_id, permission_id, type, scope, created_at)
                 VALUES (:user_id, :permission_id, :type, :scope, NOW())
                 ON DUPLICATE KEY UPDATE type = VALUES(type), scope = VALUES(scope)",
                [
                    ':user_id'       => $userId,
                    ':permission_id' => $permission[0]->id,
                    ':type'          => $type,
                    ':scope'         => $type === 'grant' ? $scope : null,
                ]
            );

            return responseJson(success: true, data: null, message: 'Permission override saved successfully', code: 200);
        } catch (\Exception $e) {
            error_log('PermissionController@grantOrRevoke error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to save permission override', code: 500);
        }
    }

    /**
     * DELETE /organizations/{org_id}/users/{user_id}/permissions/{permission_name}
     * Removes a direct override entirely, falling back to whatever the
     * user's role(s) grant.
     */
    public function clearOverride(int $orgId, int $userId, string $permissionName): mixed
    {
        try {
            $permission = DB::raw("SELECT id FROM permissions WHERE name = :name", [':name' => $permissionName]);
            if (empty($permission)) {
                return responseJson(success: false, data: null, message: 'Unknown permission', code: 404);
            }

            DB::raw(
                "DELETE FROM model_has_permissions WHERE user_id = :user_id AND permission_id = :permission_id",
                [':user_id' => $userId, ':permission_id' => $permission[0]->id]
            );

            return responseJson(success: true, data: null, message: 'Override cleared successfully', code: 200);
        } catch (\Exception $e) {
            error_log('PermissionController@clearOverride error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to clear override', code: 500);
        }
    }
}