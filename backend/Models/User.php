<?php

namespace App\Models;

use App\Services\DB;

class User
{
    /**
     * Find a user by email
     *
     * @param string $email
     * @return array|null
     */
    public static function findByEmail($email)
    {
        $result = DB::table('users')
            ->where(['email' => $email])
            ->get();
        
        return !empty($result) ? (array)$result[0] : null;
    }

    /**
     * Find a user by ID
     *
     * @param int $id
     * @return array|null
     */
    public static function find($id)
    {
        $result = DB::table('users')
            ->where(['id' => $id])
            ->get();
        
        return !empty($result) ? (array)$result[0] : null;
    }

    /**
     * Find a user by username
     *
     * @param string $username
     * @return array|null
     */
    public static function findByUsername($username)
    {
        $result = DB::table('users')
            ->where(['username' => $username])
            ->get();
        
        return !empty($result) ? (array)$result[0] : null;
    }

    /**
     * Create a new user
     *
     * @param array $data
     * @return int Last inserted ID
     */
    public static function create($data)
    {
        $userData = [
            'organization_id' => $data['organization_id'],
            'username' => $data['username'],
            'first_name' => $data['first_name'],
            'middle_name' => $data['middle_name'] ?? null,
            'surname' => $data['surname'],
            'password_hash' => $data['password_hash'],
            'email' => $data['email'],
            'user_type' => $data['user_type'] ?? 'employee'
        ];

        DB::table('users')->insert($userData);
        return DB::lastInsertId();
    }

    /**
     * Update a user
     *
     * @param int $id
     * @param array $data
     * @return bool
     */
    public static function update($id, $data)
    {
        return DB::table('users')->update($data, 'id', $id);
    }

    /**
     * Delete a user
     *
     * @param int $id
     * @return bool
     */
    public static function delete($id)
    {
        return DB::table('users')->delete('id', $id);
    }

    /**
     * Get all users for an organization
     *
     * @param int $organizationId
     * @return array
     */
    public static function getByOrganization($organizationId)
    {
        return DB::table('users')
            ->where(['organization_id' => $organizationId])
            ->orderBy('created_at', 'DESC')
            ->get();
    }

    /**
     * Get all users by user type
     *
     * @param string $userType
     * @return array
     */
    public static function getByType($userType)
    {
        return DB::table('users')
            ->where(['user_type' => $userType])
            ->orderBy('created_at', 'DESC')
            ->get();
    }

    /**
     * Check if email exists
     *
     * @param string $email
     * @return bool
     */
    public static function emailExists($email)
    {
        $result = DB::table('users')
            ->where(['email' => $email])
            ->get(['id']);
        
        return !empty($result);
    }

    /**
     * Check if username exists
     *
     * @param string $username
     * @return bool
     */
    public static function usernameExists($username)
    {
        $result = DB::table('users')
            ->where(['username' => $username])
            ->get(['id']);
        
        return !empty($result);
    }

    /**
     * Get all users
     *
     * @return array
     */
    public static function all()
    {
        return DB::table('users')
            ->selectAll();
    }
}