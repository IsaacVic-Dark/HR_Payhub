<?php
// app/Middleware/AuthMiddleware.php

namespace App\Middleware;

use App\Services\JWTService;
use App\Services\DB;
use App\Models\User;

class AuthMiddleware
{
    private static $currentUser = null;
    private static $currentEmployee = null;

    public static function handle($request, $next, $roles = [])
    {
        try {
            // Get token from header
            $token = self::getBearerToken();
            
            if (!$token) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Access token is required',
                    code: 401
                );
            }

            // Validate JWT token
            $tokenData = JWTService::validateToken($token);
            
            if (!$tokenData) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Invalid or expired token',
                    code: 401
                );
            }

            // Get user data (with caching for performance)
            $user = self::getCachedUser($tokenData['user_id']);
            
            if (!$user) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'User not found',
                    code: 401
                );
            }

            // Check if user is active
            // if ($user['status'] !== 'active') {
            //     return responseJson(
            //         success: false,
            //         data: null,
            //         message: 'User account is inactive',
            //         code: 403
            //     );
            // }

            // Store user in request context
            self::$currentUser = $user;
            self::$currentEmployee = self::getEmployeeByUserId($user['id']);

            // Check role-based authorization
            if (!empty($roles) && !self::checkRoles($roles, $user['user_type'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Insufficient permissions',
                    code: 403
                );
            }

            // Verify organization access for organization-specific routes
            if (isset($request['org_id']) && !self::checkOrganizationAccess($request['org_id'], $user)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Access to this organization is denied',
                    code: 403
                );
            }

            return $next($request);

        } catch (\Exception $e) {
            error_log('Auth middleware error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication failed',
                code: 500
            );
        }
    }

    private static function getBearerToken()
    {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
                return $matches[1];
            }
        }
        return null;
    }

    private static function getCachedUser($userId)
    {
        // Simple in-request caching to reduce DB queries
        static $userCache = [];
        
        if (!isset($userCache[$userId])) {
            $userCache[$userId] = User::find($userId);
        }
        
        return $userCache[$userId];
    }

    private static function getEmployeeByUserId($userId)
    {
        $result = DB::table('employees')
            ->where(['user_id' => $userId])
            ->get(['*']);

        return $result[0] ? json_decode(json_encode($result[0]), true) : null;
    }

    private static function checkRoles($allowedRoles, $userRole)
    {
        return in_array($userRole, (array)$allowedRoles);
    }

    private static function checkOrganizationAccess($orgId, $user)
    {
        // Super admins don't have organization access for privacy
        if ($user['user_type'] === 'super_admin') {
            return false;
        }

        // Users can only access their own organization
        return $user['organization_id'] == $orgId;
    }

    public static function getCurrentUser()
    {
        return self::$currentUser;
    }

    public static function getCurrentEmployee()
    {
        return self::$currentEmployee;
    }


    public static function getCurrentOrganizationId()
    {
        return self::$currentUser ? self::$currentUser['organization_id'] : null;
    }
}