<?php
// app/Services/PermissionService.php

namespace App\Services;

/**
 * PermissionService
 *
 * Resolution order for both can() and scopeOf():
 *   1. A direct user override in model_has_permissions.
 *      - type = 'revoke' -> always denies, no matter what roles say.
 *      - type = 'grant'  -> allowed, using that row's own `scope`.
 *   2. Otherwise, the user's role(s) via model_has_roles -> role_has_permissions.
 *      If more than one role grants the same permission with different
 *      scopes, the BROADEST scope wins (all > department > team > own).
 *   3. Otherwise, denied.
 *
 * No caching layer by design (per project decision) — each call hits the
 * DB directly, same as the existing AuthMiddleware/DB::raw() calls
 * elsewhere in this codebase. Add a cache later if profiling shows it's
 * needed; the public API here won't need to change.
 */
class PermissionService
{
    private const SCOPE_RANK = [
        'own'        => 1,
        'team'       => 2,
        'department' => 3,
        'all'        => 4,
    ];

    /**
     * Does this user have this permission at all (any scope)?
     */
    public static function can(int $userId, string $permissionName): bool
    {
        $override = self::getDirectOverride($userId, $permissionName);

        if ($override !== null) {
            return $override->type === 'grant';
        }

        return self::scopeFromRoles($userId, $permissionName) !== null;
    }

    /**
     * Convenience: true if the user has ANY of the given permissions.
     */
    public static function canAny(int $userId, array $permissionNames): bool
    {
        foreach ($permissionNames as $name) {
            if (self::can($userId, $name)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Convenience: true only if the user has ALL of the given permissions.
     */
    public static function canAll(int $userId, array $permissionNames): bool
    {
        foreach ($permissionNames as $name) {
            if (!self::can($userId, $name)) {
                return false;
            }
        }
        return true;
    }

    /**
     * The effective scope ('own'|'team'|'department'|'all') this user holds
     * for a permission, or null if they don't have it at all. Middleware and
     * controllers use this to decide how to filter rows (same job your
     * existing isEmployeeInTeam()/isOwnPayslip() helpers already do — just
     * triggered by this instead of $user['user_type']).
     */
    public static function scopeOf(int $userId, string $permissionName): ?string
    {
        $override = self::getDirectOverride($userId, $permissionName);

        if ($override !== null) {
            return $override->type === 'grant' ? $override->scope : null;
        }

        return self::scopeFromRoles($userId, $permissionName);
    }

    /**
     * All permission names the user currently holds (role-derived + direct
     * grants, minus direct revokes). Useful for a /auth/me payload so the
     * frontend can show/hide UI without guessing.
     */
    public static function allPermissionsFor(int $userId): array
    {
        $rows = DB::raw(
            "SELECT DISTINCT p.name
             FROM permissions p
             INNER JOIN role_has_permissions rhp ON rhp.permission_id = p.id
             INNER JOIN model_has_roles mhr ON mhr.role_id = rhp.role_id
             WHERE mhr.user_id = :user_id",
            [':user_id' => $userId]
        );

        $granted = array_column((array) $rows, 'name');

        $overrides = DB::raw(
            "SELECT p.name, mhp.type
             FROM permissions p
             INNER JOIN model_has_permissions mhp ON mhp.permission_id = p.id
             WHERE mhp.user_id = :user_id",
            [':user_id' => $userId]
        );

        foreach ($overrides as $o) {
            if ($o->type === 'grant' && !in_array($o->name, $granted, true)) {
                $granted[] = $o->name;
            }
            if ($o->type === 'revoke') {
                $granted = array_values(array_diff($granted, [$o->name]));
            }
        }

        return $granted;
    }

    // -------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------

    private static function getDirectOverride(int $userId, string $permissionName): ?object
    {
        $rows = DB::raw(
            "SELECT mhp.type, mhp.scope
             FROM model_has_permissions mhp
             INNER JOIN permissions p ON p.id = mhp.permission_id
             WHERE mhp.user_id = :user_id AND p.name = :name
             LIMIT 1",
            [':user_id' => $userId, ':name' => $permissionName]
        );

        return $rows[0] ?? null;
    }

    private static function scopeFromRoles(int $userId, string $permissionName): ?string
    {
        $rows = DB::raw(
            "SELECT rhp.scope
             FROM role_has_permissions rhp
             INNER JOIN permissions p ON p.id = rhp.permission_id
             INNER JOIN model_has_roles mhr ON mhr.role_id = rhp.role_id
             WHERE mhr.user_id = :user_id AND p.name = :name",
            [':user_id' => $userId, ':name' => $permissionName]
        );

        if (empty($rows)) {
            return null;
        }

        $best = null;
        foreach ($rows as $row) {
            $rank = self::SCOPE_RANK[$row->scope] ?? 0;
            if ($best === null || $rank > self::SCOPE_RANK[$best]) {
                $best = $row->scope;
            }
        }

        return $best;
    }
}