<?php

namespace App\Controllers;

use App\Services\DB;

/**
 * DevController - development-only helpers.
 *
 * Nothing here should ever respond outside a local development setup. Every
 * action is guarded by DevController::isEnabled(), which needs BOTH:
 *
 *   APP_ENVIRONMENT="Development"
 *   DEV_DEMO_CREDENTIALS="true"      (off unless you opt in, see .env.example)
 *
 * When either is missing the endpoint answers 404 exactly like an unknown route.
 */
class DevController
{
    /** Order the roles are listed in. Mirrors the users.user_type enum. */
    private const ROLE_ORDER = [
        'super_admin',
        'admin',
        'hr_manager',
        'hr_officer',
        'payroll_manager',
        'payroll_officer',
        'finance_manager',
        'auditor',
        'department_manager',
        'employee',
    ];

    /**
     * bcrypt checks are deliberately slow (~50-100ms). Cap how many users of one
     * role we test so a large users table cannot make this endpoint crawl.
     */
    private const MAX_PASSWORD_CHECKS_PER_ROLE = 5;

    public static function isEnabled(): bool
    {
        $environment = (string) ($_ENV['APP_ENVIRONMENT'] ?? '');
        $optedIn     = filter_var($_ENV['DEV_DEMO_CREDENTIALS'] ?? false, FILTER_VALIDATE_BOOLEAN);

        return strcasecmp($environment, 'Development') === 0 && $optedIn;
    }

    /**
     * GET /api/v1/dev/demo-credentials
     *
     * Returns one real, loginable account per role, read from the database.
     *
     * Passwords are stored as bcrypt hashes and cannot be read back, so the
     * shared demo password comes from DEV_DEMO_PASSWORD (default "password").
     * A user is only listed if password_verify() confirms that password against
     * their stored hash, which means every row returned will actually sign in.
     */
    public function demoCredentials(): void
    {
        header('Cache-Control: no-store');

        if (!self::isEnabled()) {
            responseJson(success: false, data: null, message: 'Not found', code: 404);
        }

        $demoPassword = (string) ($_ENV['DEV_DEMO_PASSWORD'] ?? 'password');

        $rows = DB::raw(
            'SELECT u.id, u.email, u.username, u.user_type, u.password_hash,
                    o.name AS organization_name,
                    e.firstname, e.surname, e.status AS employee_status,
                    jt.title AS job_title
               FROM users u
         INNER JOIN organizations o ON o.id = u.organization_id
          LEFT JOIN employees e     ON e.user_id = u.id
          LEFT JOIN job_titles jt   ON jt.id = e.job_title_id
              WHERE o.is_active = 1
           ORDER BY u.id ASC'
        );

        // Group candidates by role. A user can match several employee rows, so key by user id.
        $byRole = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            $row = (array) $row;
            $byRole[$row['user_type']][(int) $row['id']] ??= $row;
        }

        // Prefer accounts that are usable: active employees, or users with no employee record
        // (e.g. super_admin). Within that, the oldest account first.
        foreach ($byRole as $role => $users) {
            $users = array_values($users);
            usort($users, function (array $a, array $b): int {
                $rank = fn(array $r): int => ($r['employee_status'] === null || $r['employee_status'] === 'active') ? 0 : 1;
                return [$rank($a), (int) $a['id']] <=> [$rank($b), (int) $b['id']];
            });
            $byRole[$role] = $users;
        }

        $credentials     = [];
        $unmatchedRoles  = [];
        $rolesWithoutUsers = [];

        // Known roles first (stable order), then any role the enum gains later.
        $roles = array_values(array_unique(array_merge(self::ROLE_ORDER, array_keys($byRole))));

        foreach ($roles as $role) {
            if (empty($byRole[$role])) {
                $rolesWithoutUsers[] = $role;
                continue;
            }

            $match = null;
            foreach (array_slice($byRole[$role], 0, self::MAX_PASSWORD_CHECKS_PER_ROLE) as $candidate) {
                if (password_verify($demoPassword, $candidate['password_hash'])) {
                    $match = $candidate;
                    break;
                }
            }

            if ($match === null) {
                $unmatchedRoles[] = $role;
                continue;
            }

            $name = trim(($match['firstname'] ?? '') . ' ' . ($match['surname'] ?? ''));

            $credentials[] = [
                'role'         => $role,
                'email'        => $match['email'],
                'password'     => $demoPassword,
                'name'         => $name !== '' ? $name : $match['username'],
                'organization' => $match['organization_name'],
                'job_title'    => $match['job_title'] ?? null,
            ];
        }

        responseJson(
            success: true,
            data: ['credentials' => $credentials],
            message: empty($credentials)
                ? 'No active accounts in the database use DEV_DEMO_PASSWORD.'
                : 'Demo credentials loaded from the database.',
            code: 200,
            metadata: [
                'password_source'    => 'DEV_DEMO_PASSWORD',
                'unmatched_roles'    => $unmatchedRoles,     // users exist, but none use the demo password
                'roles_without_users' => $rolesWithoutUsers, // no user with this role at all
            ]
        );
    }
}
