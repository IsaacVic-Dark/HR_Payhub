<?php
// scripts/seed_existing_organizations_roles.php
//
// Run once, from the CLI, after applying 01_schema_roles_permissions.sql and
// 02_seed_permissions_catalog.sql:
//
//   php scripts/seed_existing_organizations_roles.php
//
// What it does:
//   1. For every existing organization, seeds the 10 default roles + their
//      permission grants (via RoleSeederService — same code path used for
//      new org registration).
//   2. For every existing user, assigns them the role in their own org that
//      matches their current `user_type` (via model_has_roles), so nothing
//      loses access the moment you cut middleware over to PermissionService.
//
// Safe to re-run — everything it does is idempotent (INSERT IGNORE / lookup
// before insert).

require __DIR__ . '/../vendor/autoload.php'; // adjust to your actual bootstrap
// require __DIR__ . '/../bootstrap.php';     // or whatever wires up DB config

use App\Services\DB;
use App\Services\RoleSeederService;

$organizations = DB::raw("SELECT id, name FROM organizations", []);

foreach ($organizations as $org) {
    echo "Seeding roles for organization #{$org->id} ({$org->name})...\n";
    RoleSeederService::seedForOrganization((int) $org->id);
}

echo "\nAssigning existing users to their matching role...\n";

$users = DB::raw("SELECT id, organization_id, user_type FROM users", []);

foreach ($users as $user) {
    $role = DB::raw(
        "SELECT id FROM roles WHERE organization_id = :org_id AND slug = :slug",
        [':org_id' => $user->organization_id, ':slug' => $user->user_type]
    );

    if (empty($role)) {
        echo "  - user #{$user->id}: no role found for user_type '{$user->user_type}' in org #{$user->organization_id} — skipped\n";
        continue;
    }

    DB::raw(
        "INSERT IGNORE INTO model_has_roles (user_id, role_id, created_at) VALUES (:user_id, :role_id, NOW())",
        [':user_id' => $user->id, ':role_id' => $role[0]->id]
    );
}

echo "\nDone.\n";