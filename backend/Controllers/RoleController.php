<?php
// app/Controllers/RoleController.php

namespace App\Controllers;

use App\Services\DB;

class RoleController
{
    /**
     * GET /organizations/{org_id}/roles
     * List every role belonging to this org, with its permission grants nested.
     */
    public function index(int $orgId): mixed
    {
        try {
            $roles = DB::raw(
                "SELECT id, name, slug, description, is_system, created_at
                 FROM roles WHERE organization_id = :org_id ORDER BY is_system DESC, name ASC",
                [':org_id' => $orgId]
            );

            foreach ($roles as $role) {
                $role->permissions = $this->getRolePermissions((int) $role->id);
                $role->is_system   = (bool) $role->is_system;
                $role->user_count  = $this->getRoleUserCount((int) $role->id);
            }

            return responseJson(success: true, data: $roles, message: 'Roles retrieved successfully', code: 200);
        } catch (\Exception $e) {
            error_log('RoleController@index error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to retrieve roles', code: 500);
        }
    }

    /**
     * GET /organizations/{org_id}/roles/{id}
     */
    public function show(int $orgId, int $roleId): mixed
    {
        try {
            $role = $this->findRoleOrFail($orgId, $roleId);
            if ($role === null) {
                return responseJson(success: false, data: null, message: 'Role not found', code: 404);
            }

            $role->permissions = $this->getRolePermissions($roleId);
            $role->is_system   = (bool) $role->is_system;
            $role->users       = $this->getRoleUsers($roleId);

            return responseJson(success: true, data: $role, message: 'Role retrieved successfully', code: 200);
        } catch (\Exception $e) {
            error_log('RoleController@show error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to retrieve role', code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/roles
     * Body: { name, description?, permissions: [{ name, scope }, ...] }
     */
    public function store(int $orgId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            if (empty($data['name'])) {
                return responseJson(success: false, data: null, message: 'Validation failed', code: 400, errors: ['name' => 'Role name is required']);
            }

            $slug = $this->slugify($data['name']);

            $existing = DB::raw(
                "SELECT id FROM roles WHERE organization_id = :org_id AND slug = :slug",
                [':org_id' => $orgId, ':slug' => $slug]
            );
            if (!empty($existing)) {
                return responseJson(success: false, data: null, message: 'A role with this name already exists', code: 409);
            }

            DB::raw(
                "INSERT INTO roles (organization_id, name, slug, description, is_system, created_at)
                 VALUES (:org_id, :name, :slug, :description, 0, NOW())",
                [
                    ':org_id'      => $orgId,
                    ':name'        => $data['name'],
                    ':slug'        => $slug,
                    ':description' => $data['description'] ?? null,
                ]
            );

            $created = DB::raw(
                "SELECT id FROM roles WHERE organization_id = :org_id AND slug = :slug",
                [':org_id' => $orgId, ':slug' => $slug]
            );
            $roleId = (int) $created[0]->id;

            $this->syncPermissions($roleId, $data['permissions'] ?? []);

            return responseJson(
                success: true,
                data: ['id' => $roleId, 'name' => $data['name'], 'slug' => $slug, 'permissions' => $this->getRolePermissions($roleId)],
                message: 'Role created successfully',
                code: 201
            );
        } catch (\Exception $e) {
            error_log('RoleController@store error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to create role', code: 500);
        }
    }

    /**
     * PUT/PATCH /organizations/{org_id}/roles/{id}
     * Body: { name?, description?, permissions?: [{ name, scope }, ...] }
     * Renaming/deleting is_system roles is blocked; their permissions can
     * still be freely changed.
     */
    public function update(int $orgId, int $roleId): mixed
    {
        try {
            $role = $this->findRoleOrFail($orgId, $roleId);
            if ($role === null) {
                return responseJson(success: false, data: null, message: 'Role not found', code: 404);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            if (isset($data['name']) && $role->is_system) {
                return responseJson(success: false, data: null, message: 'Default system roles cannot be renamed', code: 403);
            }

            if (isset($data['name'])) {
                DB::raw(
                    "UPDATE roles SET name = :name, description = :description, updated_at = NOW() WHERE id = :id",
                    [':name' => $data['name'], ':description' => $data['description'] ?? $role->description, ':id' => $roleId]
                );
            }

            if (array_key_exists('permissions', $data)) {
                $this->syncPermissions($roleId, $data['permissions']);
            }

            return responseJson(
                success: true,
                data: ['id' => $roleId, 'permissions' => $this->getRolePermissions($roleId)],
                message: 'Role updated successfully',
                code: 200
            );
        } catch (\Exception $e) {
            error_log('RoleController@update error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to update role', code: 500);
        }
    }

    /**
     * DELETE /organizations/{org_id}/roles/{id}
     */
    public function destroy(int $orgId, int $roleId): mixed
    {
        try {
            $role = $this->findRoleOrFail($orgId, $roleId);
            if ($role === null) {
                return responseJson(success: false, data: null, message: 'Role not found', code: 404);
            }

            if ($role->is_system) {
                return responseJson(success: false, data: null, message: 'Default system roles cannot be deleted — remove its permissions instead', code: 403);
            }

            $userCount = $this->getRoleUserCount($roleId);
            if ($userCount > 0) {
                return responseJson(success: false, data: null, message: "Cannot delete a role assigned to {$userCount} user(s) — reassign them first", code: 409);
            }

            DB::raw("DELETE FROM roles WHERE id = :id", [':id' => $roleId]);

            return responseJson(success: true, data: null, message: 'Role deleted successfully', code: 200);
        } catch (\Exception $e) {
            error_log('RoleController@destroy error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to delete role', code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/roles/{id}/assign
     * Body: { user_id }
     */
    public function assignToUser(int $orgId, int $roleId): mixed
    {
        try {
            $role = $this->findRoleOrFail($orgId, $roleId);
            if ($role === null) {
                return responseJson(success: false, data: null, message: 'Role not found', code: 404);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $userId = (int) ($data['user_id'] ?? 0);

            if (!$userId) {
                return responseJson(success: false, data: null, message: 'user_id is required', code: 400);
            }

            $userInOrg = DB::raw(
                "SELECT id FROM users WHERE id = :user_id AND organization_id = :org_id",
                [':user_id' => $userId, ':org_id' => $orgId]
            );
            if (empty($userInOrg)) {
                return responseJson(success: false, data: null, message: 'User does not belong to this organization', code: 404);
            }

            DB::raw(
                "INSERT IGNORE INTO model_has_roles (user_id, role_id, created_at) VALUES (:user_id, :role_id, NOW())",
                [':user_id' => $userId, ':role_id' => $roleId]
            );

            return responseJson(success: true, data: null, message: 'Role assigned successfully', code: 200);
        } catch (\Exception $e) {
            error_log('RoleController@assignToUser error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to assign role', code: 500);
        }
    }

    /**
     * DELETE /organizations/{org_id}/roles/{id}/assign/{user_id}
     */
    public function unassignFromUser(int $orgId, int $roleId, int $userId): mixed
    {
        try {
            $role = $this->findRoleOrFail($orgId, $roleId);
            if ($role === null) {
                return responseJson(success: false, data: null, message: 'Role not found', code: 404);
            }

            DB::raw(
                "DELETE FROM model_has_roles WHERE user_id = :user_id AND role_id = :role_id",
                [':user_id' => $userId, ':role_id' => $roleId]
            );

            return responseJson(success: true, data: null, message: 'Role unassigned successfully', code: 200);
        } catch (\Exception $e) {
            error_log('RoleController@unassignFromUser error: ' . $e->getMessage());
            return responseJson(success: false, data: null, message: 'Failed to unassign role', code: 500);
        }
    }

    // -------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------

    private function findRoleOrFail(int $orgId, int $roleId): ?object
    {
        $rows = DB::raw(
            "SELECT id, organization_id, name, slug, description, is_system
             FROM roles WHERE id = :id AND organization_id = :org_id",
            [':id' => $roleId, ':org_id' => $orgId]
        );
        return $rows[0] ?? null;
    }

    private function getRolePermissions(int $roleId): array
    {
        return DB::raw(
            "SELECT p.name, p.module, rhp.scope
             FROM role_has_permissions rhp
             INNER JOIN permissions p ON p.id = rhp.permission_id
             WHERE rhp.role_id = :role_id
             ORDER BY p.module, p.name",
            [':role_id' => $roleId]
        );
    }

    private function getRoleUsers(int $roleId): array
    {
        return DB::raw(
            "SELECT u.id, u.username, u.email
             FROM model_has_roles mhr
             INNER JOIN users u ON u.id = mhr.user_id
             WHERE mhr.role_id = :role_id",
            [':role_id' => $roleId]
        );
    }

    private function getRoleUserCount(int $roleId): int
    {
        $result = DB::raw(
            "SELECT COUNT(*) as count FROM model_has_roles WHERE role_id = :role_id",
            [':role_id' => $roleId]
        );
        return (int) ($result[0]->count ?? 0);
    }

    /**
     * Replace a role's entire permission set with the given list.
     * $permissions: [{ name: 'leaves.approve', scope: 'team' }, ...]
     */
    private function syncPermissions(int $roleId, array $permissions): void
    {
        DB::raw("DELETE FROM role_has_permissions WHERE role_id = :role_id", [':role_id' => $roleId]);

        foreach ($permissions as $perm) {
            $name  = $perm['name']  ?? null;
            $scope = $perm['scope'] ?? 'all';

            if (!$name || !in_array($scope, ['own', 'team', 'department', 'all'], true)) {
                continue;
            }

            $permissionRow = DB::raw("SELECT id FROM permissions WHERE name = :name", [':name' => $name]);
            if (empty($permissionRow)) {
                continue; // unknown permission name — silently skipped
            }

            DB::raw(
                "INSERT INTO role_has_permissions (role_id, permission_id, scope, created_at)
                 VALUES (:role_id, :permission_id, :scope, NOW())",
                [':role_id' => $roleId, ':permission_id' => $permissionRow[0]->id, ':scope' => $scope]
            );
        }
    }

    private function slugify(string $name): string
    {
        $slug = strtolower(trim($name));
        $slug = preg_replace('/[^a-z0-9]+/', '_', $slug);
        return trim($slug, '_');
    }
}