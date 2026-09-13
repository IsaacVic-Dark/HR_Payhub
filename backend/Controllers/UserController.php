<?php

namespace App\Controllers;

use App\Services\DB;

class UserController
{
    public function index()
    {
        $orgId = $_GET['organization_id'] ?? null;
        $query = DB::table('users');
        if ($orgId) {
            $users = $query->selectAllWhere('organization_id', $orgId);
        } else {
            $users = $query->selectAll();
        }
        // Remove password_hash from all users
        $users = array_map(function ($u) {
            unset($u->password_hash);
            return $u;
        }, $users);
        return responseJson(
            data: array_values($users),
            message: "Fetched users",
            metadata: ['dev_mode' => true]
        );
    }
    public function create()
    {
        $data = validate([
            'organization_id' => 'required,numeric',
            'username' => 'required,string',
            'password' => 'required,string',
            'email' => 'required,email',
            'user_type' => 'string'
        ]);
        // Check unique username/email
        $existingUser = DB::table('users')->selectAllWhere('username', $data['username']);
        if ($existingUser) {
            return responseJson(null, "Username already exists", 400);
        }
        $existingEmail = DB::table('users')->selectAllWhere('email', $data['email']);
        if ($existingEmail) {
            return responseJson(null, "Email already exists", 400);
        }
        $roleSlug = $data['user_type'] ?? 'employee';
        $roleRow = DB::raw(
            "SELECT id FROM roles WHERE organization_id = :org_id AND slug = :slug",
            [':org_id' => $data['organization_id'], ':slug' => $roleSlug]
        );
        if (empty($roleRow)) {
            return responseJson(null, "Invalid user_type '{$roleSlug}' for this organization", 400);
        }
        // $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
        $passwordHash = $data['password'];
        $inserted = DB::table('users')->insert([
            'organization_id' => $data['organization_id'],
            'username' => $data['username'],
            'password_hash' => $passwordHash,
            'email' => $data['email'],
            'user_type' => $roleSlug,
        ]);
        DB::raw(
            "INSERT IGNORE INTO model_has_roles (user_id, role_id, created_at) VALUES (:user_id, :role_id, NOW())",
            [':user_id' => $inserted->id, ':role_id' => $roleRow[0]->id]
        );
        // Return user without password_hash
        unset($inserted->password_hash);
        return responseJson(
            data: $inserted,
            message: "User created successfully",
            metadata: ['dev_mode' => true]
        );
    }
    public function show($id)
    {
        $user = DB::table('users')->selectAllWhereID($id);
        if (!$user || count($user) === 0) {
            return responseJson(null, "User not found", 404);
        }
        $user = $user[0];
        unset($user->password_hash);
        return responseJson(
            data: $user,
            message: "User fetched successfully",
            metadata: ['dev_mode' => true]
        );
    }
    public function update($id)
    {
        $data = validate([
            'organization_id' => 'numeric',
            'username' => 'string',
            'password' => 'string',
            'email' => 'email',
            'user_type' => 'string'
        ]);
        $updateData = array_filter($data, fn($v) => $v !== null);
        if (isset($updateData['username'])) {
            $existingUser = DB::table('users')->selectAllWhere('username', $updateData['username']);
            if ($existingUser && $existingUser[0]->id != $id) {
                return responseJson(null, "Username already exists", 400);
            }
        }
        if (isset($updateData['email'])) {
            $existingEmail = DB::table('users')->selectAllWhere('email', $updateData['email']);
            if ($existingEmail && $existingEmail[0]->id != $id) {
                return responseJson(null, "Email already exists", 400);
            }
        }
        if (isset($updateData['password'])) {
            $updateData['password_hash'] = password_hash($updateData['password'], PASSWORD_DEFAULT);
            unset($updateData['password']);
        }
        if (empty($updateData)) {
            return responseJson(null, "No data provided for update", 400);
        }
        $targetUser = DB::table('users')->selectAllWhereID($id);
        if (!$targetUser || count($targetUser) === 0) {
            return responseJson(null, "User not found", 404);
        }

        $newRole = null;
        if (isset($updateData['user_type'])) {
            $roleOrgId = $updateData['organization_id'] ?? $targetUser[0]->organization_id;
            $roleRow = DB::raw(
                "SELECT id FROM roles WHERE organization_id = :org_id AND slug = :slug",
                [':org_id' => $roleOrgId, ':slug' => $updateData['user_type']]
            );
            if (empty($roleRow)) {
                return responseJson(null, "Invalid user_type '{$updateData['user_type']}' for this organization", 400);
            }
            $newRole = $roleRow[0];
        }

        $updated = DB::table('users')->update($updateData, 'id', $id);
        if ($updated) {
            if ($newRole) {
                DB::raw("DELETE FROM model_has_roles WHERE user_id = :user_id", [':user_id' => $id]);
                DB::raw(
                    "INSERT INTO model_has_roles (user_id, role_id, created_at) VALUES (:user_id, :role_id, NOW())",
                    [':user_id' => $id, ':role_id' => $newRole->id]
                );
            }
            $user = DB::table('users')->selectAllWhereID($id);
            $user = $user[0];
            unset($user->password_hash);
            return responseJson(
                data: $user,
                message: "User updated successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to update user", 500);
        }
    }
    public function delete($id) {
    {
        $user = DB::table('users')->selectAllWhereID($id);
        if (!$user || count($user) === 0) {
            return responseJson(null, "User not found", 404);
        }
        $deleted = DB::table('users')->delete('id', $id);
        if ($deleted) {
            return responseJson(
                data: null,
                message: "User deleted successfully",
                metadata: ['dev_mode' => true]
            );
        } else {
            return responseJson(null, "Failed to delete user", 500);
        }
    }
}
