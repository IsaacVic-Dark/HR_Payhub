<?php

namespace App\Services;

if (!function_exists('loadTaxConfig')) {
    require_once __DIR__ . '/../helpers/tax.php';
}

/**
 * AdvancePolicyService
 *
 * Loads the tenant's salary-advance policy (organization_configs,
 * config_type = 'advance'), validates advance requests against it,
 * calculates the maximum allowed advance and builds the policy snapshot
 * that is stored in advances.metadata.
 */
class AdvancePolicyService
{
    /** Statuses that count towards max_active_advances. */
    public const ACTIVE_STATUSES = [
        'pending', 'validated', 'approved', 'scheduled', 'disbursed', 'partially_recovered',
    ];

    public const DISBURSEMENT_METHODS = ['payroll', 'bank_transfer', 'mpesa', 'cash', 'cheque'];

    public const DEFAULTS = [
        'max_percentage_of_basic'        => 50,
        'max_percentage_of_net'          => null,
        'minimum_amount'                 => 0,
        'maximum_amount'                 => null,
        'max_active_advances'            => 1,
        'allow_partial_recovery'         => true,
        'default_recovery_periods'       => 1,
        'max_recovery_periods'           => 1,
        'require_reason'                 => true,
        'require_supporting_document'    => false,
        'minimum_net_pay_after_recovery' => 0,
        'finance_approval_threshold'     => null, // stored, NOT enforced in v1 (admin-only approval)
        'disbursement_methods'           => ['payroll'],
        'request_cutoff_day'             => null,
        'allow_employee_request'         => true,
        'allowed_employee_statuses'      => ['active'],
    ];

    // -------------------------------------------------------------------------
    // Policy loading
    // -------------------------------------------------------------------------

    /** Raw config row (or null) for the org's active, approved advance policy. */
    public function getPolicyRow(int $orgId, ?int $configId = null): ?object
    {
        if ($configId) {
            $rows = DB::raw(
                "SELECT * FROM organization_configs
                  WHERE id = :id AND organization_id = :org AND config_type = 'advance'",
                [':id' => $configId, ':org' => $orgId]
            );
        } else {
            $rows = DB::raw(
                "SELECT * FROM organization_configs
                  WHERE organization_id = :org AND config_type = 'advance'
                    AND is_active = 1 AND status = 'approved'
                  ORDER BY id DESC LIMIT 1",
                [':org' => $orgId]
            );
        }
        return $rows[0] ?? null;
    }

    /**
     * @return array|null ['config_id','name','percentage','settings'=>[merged with defaults]]
     */
    public function getPolicy(int $orgId, ?int $configId = null): ?array
    {
        $row = $this->getPolicyRow($orgId, $configId);
        if (!$row) {
            return null;
        }

        $stored = [];
        if (!empty($row->settings)) {
            $decoded = is_array($row->settings) ? $row->settings : json_decode($row->settings, true);
            $stored  = is_array($decoded) ? $decoded : [];
        }

        $settings = array_merge(self::DEFAULTS, $stored);

        // Fallback: organization_configs.percentage doubles as the basic-salary cap.
        if (!array_key_exists('max_percentage_of_basic', $stored) && $row->percentage !== null) {
            $settings['max_percentage_of_basic'] = (float) $row->percentage;
        }

        return [
            'config_id'  => (int) $row->id,
            'name'       => $row->name,
            'percentage' => $row->percentage,
            'status'     => $row->status,
            'is_active'  => (int) $row->is_active,
            'settings'   => $settings,
        ];
    }

    // -------------------------------------------------------------------------
    // Maximum allowed advance
    // -------------------------------------------------------------------------

    /**
     * @return array ['max_cents'=>int, 'basic_cents'=>int, 'estimated_net_cents'=>?int, 'limits'=>[name=>cents]]
     */
    public function calculateMaxAllowed(int $orgId, object $employee, array $settings): array
    {
        $basic  = Money::toCents($employee->base_salary);
        $limits = [];

        if ($settings['maximum_amount'] !== null) {
            $limits['maximum_amount'] = Money::toCents($settings['maximum_amount']);
        }
        if ($settings['max_percentage_of_basic'] !== null) {
            $limits['max_percentage_of_basic'] = Money::percentOf($basic, $settings['max_percentage_of_basic']);
        }

        $estimatedNet = null;
        if ($settings['max_percentage_of_net'] !== null) {
            $estimatedNet = $this->estimateNetPay($orgId, $basic);
            if ($estimatedNet !== null) {
                $limits['max_percentage_of_net'] = Money::percentOf($estimatedNet, $settings['max_percentage_of_net']);
            }
        }

        return [
            'max_cents'           => empty($limits) ? 0 : min($limits),
            'basic_cents'         => $basic,
            'estimated_net_cents' => $estimatedNet,
            'limits'              => $limits,
        ];
    }

    /** Net pay on basic salary alone, using the org's statutory configuration. */
    private function estimateNetPay(int $orgId, int $basicCents): ?int
    {
        try {
            $basic = (float) Money::format($basicCents); // boundary only: tax helper is float-based
            $calc  = calculateNetPay($basic, $basic, loadTaxConfig($orgId));
            return Money::toCents($calc['net_pay']);
        } catch (\Throwable $e) {
            error_log('Advance net-pay estimate failed: ' . $e->getMessage());
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Request validation
    // -------------------------------------------------------------------------

    /**
     * Validate an advance request against the org policy.
     *
     * $input keys: employee_id, amount_requested, reason, number_of_recoveries,
     *   recovery_start_date, recovery_end_date, requested_payrun_id,
     *   disbursement_method, supporting_document
     * $actor: ['user'=>array, 'employee'=>?array]
     *
     * @return array ['valid'=>bool, 'errors'=>[field=>message], 'policy'=>?array,
     *                'max_allowed'=>?string, 'snapshot'=>array]
     */
    public function validateRequest(int $orgId, array $input, array $actor, ?int $excludeAdvanceId = null): array
    {
        $errors = [];
        $policy = $this->getPolicy($orgId);

        if (!$policy) {
            return [
                'valid'       => false,
                'errors'      => ['policy' => 'No active salary advance policy is configured for this organization'],
                'policy'      => null,
                'max_allowed' => null,
                'snapshot'    => [],
            ];
        }

        $s       = $policy['settings'];
        $user    = $actor['user'];
        $isAdmin = ($user['user_type'] ?? '') === 'admin';
        $actorEmployeeId = (int) ($actor['employee']['id'] ?? 0);
        $employeeId      = (int) ($input['employee_id'] ?? $actorEmployeeId);
        $today           = date('Y-m-d');

        // 16. Only the employee can create their own request unless admin.
        if (!$isAdmin) {
            if ($employeeId !== $actorEmployeeId) {
                $errors['employee_id'] = 'You can only request an advance for yourself';
            }
            if (empty($s['allow_employee_request'])) {
                $errors['policy'] = 'Employee self-service advance requests are disabled by policy';
            }
            $cutoff = $s['request_cutoff_day'];
            if ($cutoff !== null && (int) date('j') > (int) $cutoff) {
                $errors['request_date'] = "Advance requests are only accepted up to day {$cutoff} of the month";
            }
        }

        // 6. Employee must belong to the same organization.
        $rows = DB::raw(
            "SELECT id, organization_id, status, base_salary, firstname, surname
               FROM employees WHERE id = :id AND organization_id = :org",
            [':id' => $employeeId, ':org' => $orgId]
        );
        $employee = $rows[0] ?? null;
        if (!$employee) {
            $errors['employee_id'] = 'Employee does not belong to this organization';
        }

        // 1-3. Amount rules.
        $amountCents = null;
        $raw = $input['amount_requested'] ?? null;
        if ($raw === null || $raw === '' || !is_numeric($raw)) {
            $errors['amount_requested'] = 'Amount must be a valid number';
        } else {
            $amountCents = Money::toCents($raw);
            if ($amountCents <= 0) {
                $errors['amount_requested'] = 'Amount must be greater than zero';
            } else {
                $min = Money::toCents($s['minimum_amount'] ?? 0);
                if ($amountCents < $min) {
                    $errors['amount_requested'] = 'Amount must be at least KES ' . Money::display($min);
                }
                if ($s['maximum_amount'] !== null && $amountCents > Money::toCents($s['maximum_amount'])) {
                    $errors['amount_requested'] = 'Amount must not exceed KES ' . Money::display(Money::toCents($s['maximum_amount']));
                }
            }
        }

        $maxInfo = null;
        if ($employee) {
            // 7. Employee must be active (unless policy allows other statuses).
            $allowedStatuses = (array) ($s['allowed_employee_statuses'] ?? ['active']);
            if (!in_array($employee->status, $allowedStatuses, true)) {
                $errors['employee_id'] = "Employee status '{$employee->status}' is not eligible for a salary advance";
            }

            // 4-5. Percentage-of-basic / percentage-of-net caps.
            $maxInfo = $this->calculateMaxAllowed($orgId, $employee, $s);
            if ($amountCents !== null && $amountCents > 0) {
                if (isset($maxInfo['limits']['max_percentage_of_basic'])
                    && $amountCents > $maxInfo['limits']['max_percentage_of_basic']) {
                    $errors['amount_requested'] = "Amount exceeds {$s['max_percentage_of_basic']}% of basic salary (max KES "
                        . Money::display($maxInfo['limits']['max_percentage_of_basic']) . ')';
                } elseif (isset($maxInfo['limits']['max_percentage_of_net'])
                    && $amountCents > $maxInfo['limits']['max_percentage_of_net']) {
                    $errors['amount_requested'] = "Amount exceeds {$s['max_percentage_of_net']}% of estimated net pay (max KES "
                        . Money::display($maxInfo['limits']['max_percentage_of_net']) . ')';
                }
            }

            // 8. Max active advances.
            if ($s['max_active_advances'] !== null && (int) $s['max_active_advances'] > 0) {
                $in = "'" . implode("','", self::ACTIVE_STATUSES) . "'";
                $sql = "SELECT COUNT(*) AS c FROM advances
                         WHERE organization_id = :org AND employee_id = :emp AND status IN ($in)";
                $params = [':org' => $orgId, ':emp' => $employeeId];
                if ($excludeAdvanceId) {
                    $sql .= " AND id <> :excl";
                    $params[':excl'] = $excludeAdvanceId;
                }
                $active = (int) (DB::raw($sql, $params)[0]->c ?? 0);
                if ($active >= (int) $s['max_active_advances']) {
                    $errors['max_active_advances'] = "Employee already has {$active} active advance(s); the policy allows "
                        . (int) $s['max_active_advances'];
                }
            }
        }

        // 9. Number of recoveries.
        $recoveries = $input['number_of_recoveries'] ?? $s['default_recovery_periods'];
        $maxPeriods = (int) $s['max_recovery_periods'];
        if (!is_numeric($recoveries) || (int) $recoveries != $recoveries || (int) $recoveries < 1 || (int) $recoveries > $maxPeriods) {
            $errors['number_of_recoveries'] = "Number of recoveries must be between 1 and {$maxPeriods}";
        }

        // 10-11. Recovery dates.
        $start = $input['recovery_start_date'] ?? null;
        $end   = $input['recovery_end_date'] ?? null;
        if ($start !== null && $start !== '') {
            if (!$this->isDate($start)) {
                $errors['recovery_start_date'] = 'recovery_start_date must be a valid date (YYYY-MM-DD)';
            } elseif ($start < $today) {
                $errors['recovery_start_date'] = 'recovery_start_date must not be before today';
            }
        }
        if ($end !== null && $end !== '') {
            if (!$this->isDate($end)) {
                $errors['recovery_end_date'] = 'recovery_end_date must be a valid date (YYYY-MM-DD)';
            } elseif ($start && $this->isDate($start) && $end < $start) {
                $errors['recovery_end_date'] = 'recovery_end_date must not be before recovery_start_date';
            }
        }

        // 12-13. Requested payrun: same org and draft.
        $payrunId = $input['requested_payrun_id'] ?? null;
        if ($payrunId !== null && $payrunId !== '') {
            $pr = DB::raw(
                "SELECT id, organization_id, status, deleted_at FROM payruns WHERE id = :id",
                [':id' => (int) $payrunId]
            );
            if (empty($pr) || (int) $pr[0]->organization_id !== $orgId || $pr[0]->deleted_at !== null) {
                $errors['requested_payrun_id'] = 'The requested payrun does not belong to this organization';
            } elseif ($pr[0]->status !== 'draft') {
                $errors['requested_payrun_id'] = 'The requested payrun must be in draft status';
            }
        }

        // 14-15. Reason / supporting document.
        if (!empty($s['require_reason']) && trim((string) ($input['reason'] ?? '')) === '') {
            $errors['reason'] = 'A reason is required';
        }
        if (!empty($s['require_supporting_document']) && trim((string) ($input['supporting_document'] ?? '')) === '') {
            $errors['supporting_document'] = 'A supporting document reference is required';
        }

        // Disbursement method must be enabled by policy.
        $method = $input['disbursement_method'] ?? null;
        if ($method !== null && $method !== '') {
            if (!in_array($method, self::DISBURSEMENT_METHODS, true)) {
                $errors['disbursement_method'] = 'Invalid disbursement method';
            } elseif (!empty($s['disbursement_methods']) && !in_array($method, $s['disbursement_methods'], true)) {
                $errors['disbursement_method'] = "Disbursement method '{$method}' is not enabled by policy (allowed: "
                    . implode(', ', $s['disbursement_methods']) . ')';
            }
        }

        $snapshot = [
            'policy_config_id'    => $policy['config_id'],
            'policy_name'         => $policy['name'],
            'settings'            => $s,
            'validated_at'        => date('Y-m-d H:i:s'),
            'basic_salary'        => $maxInfo ? Money::format($maxInfo['basic_cents']) : null,
            'estimated_net_pay'   => ($maxInfo && $maxInfo['estimated_net_cents'] !== null)
                ? Money::format($maxInfo['estimated_net_cents']) : null,
            'limits'              => $maxInfo ? array_map([Money::class, 'format'], $maxInfo['limits']) : [],
            'max_allowed'         => $maxInfo ? Money::format($maxInfo['max_cents']) : null,
        ];

        return [
            'valid'       => empty($errors),
            'errors'      => $errors,
            'policy'      => $policy,
            'max_allowed' => $snapshot['max_allowed'],
            'snapshot'    => $snapshot,
        ];
    }

    private function isDate($value): bool
    {
        $d = \DateTime::createFromFormat('Y-m-d', (string) $value);
        return $d && $d->format('Y-m-d') === (string) $value;
    }

    // -------------------------------------------------------------------------
    // Policy administration (PUT /advance-policy)
    // -------------------------------------------------------------------------

    /** Validate a (partial) settings patch. Returns [field=>message]. */
    public function validateSettingsPatch(array $patch, array $current): array
    {
        $e = [];
        $merged = array_merge($current, $patch);

        $num = function (string $k, bool $nullable, float $min = 0, ?float $max = null) use ($patch, &$e) {
            if (!array_key_exists($k, $patch)) return;
            $v = $patch[$k];
            if ($v === null) {
                if (!$nullable) $e[$k] = "$k cannot be null";
                return;
            }
            if (!is_numeric($v) || $v < $min || ($max !== null && $v > $max)) {
                $e[$k] = "$k must be a number" . ($max !== null ? " between $min and $max" : " >= $min");
            }
        };
        $num('max_percentage_of_basic', true, 0, 100);
        $num('max_percentage_of_net', true, 0, 100);
        $num('minimum_amount', false, 0);
        $num('maximum_amount', true, 0);
        $num('max_active_advances', true, 1);
        $num('default_recovery_periods', false, 1);
        $num('max_recovery_periods', false, 1);
        $num('minimum_net_pay_after_recovery', false, 0);
        $num('finance_approval_threshold', true, 0);
        $num('request_cutoff_day', true, 1, 31);

        foreach (['allow_partial_recovery', 'require_reason', 'require_supporting_document', 'allow_employee_request'] as $k) {
            if (array_key_exists($k, $patch) && !is_bool($patch[$k])) {
                $e[$k] = "$k must be true or false";
            }
        }
        if (array_key_exists('disbursement_methods', $patch)) {
            $m = $patch['disbursement_methods'];
            if (!is_array($m) || empty($m) || array_diff($m, self::DISBURSEMENT_METHODS)) {
                $e['disbursement_methods'] = 'disbursement_methods must be a non-empty subset of: '
                    . implode(', ', self::DISBURSEMENT_METHODS);
            }
        }
        if (empty($e)) {
            if ($merged['maximum_amount'] !== null && Money::toCents($merged['maximum_amount']) < Money::toCents($merged['minimum_amount'])) {
                $e['maximum_amount'] = 'maximum_amount must be >= minimum_amount';
            }
            if ((int) $merged['default_recovery_periods'] > (int) $merged['max_recovery_periods']) {
                $e['default_recovery_periods'] = 'default_recovery_periods must be <= max_recovery_periods';
            }
        }
        return $e;
    }

    /**
     * Update the existing policy row in place (creates it if the org has none).
     */
    public function updatePolicy(int $orgId, int $userId, array $input): array
    {
        $row = $this->getPolicyRow($orgId);
        $patch = (isset($input['settings']) && is_array($input['settings'])) ? $input['settings'] : [];

        $current = $row ? $this->getPolicy($orgId)['settings'] : self::DEFAULTS;
        $errors  = $this->validateSettingsPatch($patch, $current);

        if (isset($input['percentage']) && (!is_numeric($input['percentage']) || $input['percentage'] < 0 || $input['percentage'] > 100)) {
            $errors['percentage'] = 'percentage must be between 0 and 100';
        }
        if (!empty($errors)) {
            throw new AdvanceException('Invalid advance policy', 422, $errors);
        }

        $before = $row ? ['name' => $row->name, 'percentage' => $row->percentage, 'settings' => json_decode($row->settings ?? '{}', true)] : null;

        return AdvanceService::tx(function () use ($orgId, $userId, $row, $patch, $input, $before) {
            if ($row) {
                $stored = json_decode($row->settings ?? '{}', true) ?: [];
                $newSettings = array_merge($stored, $patch);
                $data = ['settings' => json_encode($newSettings)];
                if (isset($input['name']) && trim($input['name']) !== '') $data['name'] = trim($input['name']);
                if (isset($input['percentage'])) $data['percentage'] = $input['percentage'];
                DB::table('organization_configs')->update($data, 'id', (int) $row->id);
                $configId = (int) $row->id;
            } else {
                $newSettings = array_merge(self::DEFAULTS, $patch);
                DB::table('organization_configs')->insert([
                    'organization_id' => $orgId,
                    'config_type'     => 'advance',
                    'name'            => trim($input['name'] ?? 'Salary Advance Policy'),
                    'percentage'      => $input['percentage'] ?? ($newSettings['max_percentage_of_basic'] ?? null),
                    'settings'        => json_encode($newSettings),
                    'status'          => 'approved',
                    'is_active'       => 1,
                    'created_by'      => $userId,
                ]);
                $configId = (int) DB::lastInsertId();
            }

            AdvanceService::writeAudit($orgId, $userId, 'organization_config', $configId, 'update', [
                'event'  => 'advance_policy_updated',
                'before' => $before,
                'after'  => ['settings' => $newSettings, 'name' => $input['name'] ?? null],
            ]);

            return $this->getPolicy($orgId);
        });
    }
}