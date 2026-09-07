<?php

namespace App\Middleware;

use App\Services\JWTService;
use App\Services\DB;
use App\Services\PermissionService;
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

            // Store user in request context
            self::$currentUser = $user;
            self::$currentEmployee = self::getEmployeeByUserId($user['id']);

            // NOTE: $roles here is legacy — routes.php still has some inline
            // arrays like ['AuthMiddleware', ['super_admin']]. Those keep
            // working (matched against user_type) until you migrate each
            // route to a permission check instead. New routes should prefer
            // gating via a module AuthorizationMiddleware backed by
            // PermissionService rather than adding more of these.
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

        return !empty($result) ? json_decode(json_encode($result[0]), true) : null;
    }

    private static function checkRoles($allowedRoles, $userRole)
    {
        return in_array($userRole, (array)$allowedRoles);
    }

    /**
     * Was: `if ($user['user_type'] === 'super_admin') return false;`
     *
     * Now: users whose OWN organization is a 'platform' account (super_admin
     * accounts live in a platform-type org — see organizations.account_type)
     * are blocked from any tenant organization's data UNLESS they hold the
     * 'organizations.access_tenant_data' permission. Nobody is granted that
     * permission by default (see RoleSeederService), so behaviour is
     * unchanged today — but it's no longer a hardcoded role name, and can be
     * granted to a specific platform user later (e.g. for support access)
     * without touching this file.
     */
    private static function checkOrganizationAccess($orgId, $user)
    {
        if (self::belongsToPlatformAccount($user) &&
            !PermissionService::can($user['id'], 'organizations.access_tenant_data')) {
            return false;
        }

        // Users can only access their own organization
        return $user['organization_id'] == $orgId;
    }

    private static function belongsToPlatformAccount($user): bool
    {
        static $accountTypeCache = [];

        $orgId = $user['organization_id'];

        if (!array_key_exists($orgId, $accountTypeCache)) {
            $result = DB::raw(
                "SELECT account_type FROM organizations WHERE id = :id",
                [':id' => $orgId]
            );
            $accountTypeCache[$orgId] = $result[0]->account_type ?? 'tenant';
        }

        return $accountTypeCache[$orgId] === 'platform';
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