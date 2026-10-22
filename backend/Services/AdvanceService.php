<?php

namespace App\Services;

/**
 * AdvanceService
 *
 * Workflow engine for salary advances:
 *   draft -> validated -> pending -> approved -> disbursed
 *         -> partially_recovered -> repaid
 * (plus system_rejected, rejected, cancelled).
 *
 * Every state change runs inside a transaction, locks the advance row with
 * SELECT ... FOR UPDATE, writes an audit log and (where relevant) a
 * notification. Admin approval is the only approval step in v1.
 *
 * $actor is always ['user' => array, 'employee' => ?array] as exposed by
 * AuthMiddleware::getCurrentUser() / getCurrentEmployee().
 */
class AdvanceService
{
    private AdvancePolicyService $policy;
    private AdvanceRecoveryService $recovery;

    public function __construct()
    {
        $this->policy   = new AdvancePolicyService();
        $this->recovery = new AdvanceRecoveryService();
    }

    // =========================================================================
    // Infrastructure helpers
    // =========================================================================

    /**
     * DB::transaction() re-wraps exceptions and loses their type, so business
     * exceptions are captured and re-thrown untouched after the rollback.
     */
    public static function tx(callable $fn)
    {
        $captured = null;
        try {
            return DB::transaction(function () use ($fn, &$captured) {
                try {
                    return $fn();
                } catch (AdvanceException $e) {
                    $captured = $e;
                    throw new \RuntimeException('rollback');
                }
            });
        } catch (\Exception $e) {
            throw $captured ?? $e;
        }
    }

    /** Audit insert. Deliberately NOT swallowed: a failed audit rolls the change back. */
    public static function writeAudit(int $orgId, int $userId, string $entityType, int $entityId, string $action, array $details = []): void
    {
        DB::table('audit_logs')->insert([
            'organization_id' => $orgId,
            'user_id'         => $userId,
            'entity_type'     => $entityType,
            'entity_id'       => $entityId,
            'action'          => $action,
            'details'         => json_encode($details),
            'created_at'      => date('Y-m-d H:i:s'),
        ]);
    }

    private function audit(array $adv, int $userId, string $action, array $details = []): void
    {
        self::writeAudit((int) $adv['organization_id'], $userId, 'advance', (int) $adv['id'], $action, $details);
    }

    public static function notify(int $orgId, int $employeeId, string $title, string $message, array $meta = []): void
    {
        DB::table('notifications')->insert([
            'employee_id'     => $employeeId,
            'organization_id' => $orgId,
            'title'           => $title,
            'message'         => $message,
            'type'            => 'advance',
            'metadata'        => json_encode($meta),
        ]);
    }

    private function notifyAdmins(int $orgId, string $title, string $message, array $meta = []): void
    {
        $rows = DB::raw(
            "SELECT e.id FROM employees e
               INNER JOIN users u ON u.id = e.user_id
              WHERE e.organization_id = :org AND u.user_type = 'admin'",
            [':org' => $orgId]
        );
        foreach ($rows as $r) {
            self::notify($orgId, (int) $r->id, $title, $message, $meta);
        }
    }

    public function find(int $orgId, int $id, bool $lock = false): ?array
    {
        $rows = DB::raw(
            'SELECT * FROM advances WHERE id = :id AND organization_id = :org' . ($lock ? ' FOR UPDATE' : ''),
            [':id' => $id, ':org' => $orgId]
        );
        return $rows ? (array) $rows[0] : null;
    }

    private function lockOrFail(int $orgId, int $id): array
    {
        $adv = $this->find($orgId, $id, true);
        if (!$adv) {
            throw new AdvanceException('Advance not found', 404);
        }
        return $adv;
    }

    private static function meta(array $adv): array
    {
        $m = $adv['metadata'] ?? null;
        if (is_string($m)) $m = json_decode($m, true);
        return is_array($m) ? $m : [];
    }

    private function state(array $adv): array
    {
        return [
            'status'            => $adv['status'],
            'amount_requested'  => $adv['amount_requested'],
            'amount_approved'   => $adv['amount_approved'],
            'amount_disbursed'  => $adv['amount_disbursed'],
            'amount_recovered'  => $adv['amount_recovered'],
            'balance_remaining' => $adv['balance_remaining'],
        ];
    }

    private function nz($v)
    {
        return ($v === '' || $v === null) ? null : $v;
    }

    private function now(): string
    {
        return date('Y-m-d H:i:s');
    }

    private function userId(array $actor): int
    {
        return (int) $actor['user']['id'];
    }

    private function orgId(array $actor): int
    {
        return (int) $actor['user']['organization_id'];
    }

    /** repaid / partially_recovered / disbursed from cents. */
    public static function statusFor(int $balanceCents, int $recoveredCents): string
    {
        if ($balanceCents <= 0) return 'repaid';
        if ($recoveredCents > 0) return 'partially_recovered';
        return 'disbursed';
    }

    // =========================================================================
    // 1. Create / update / delete
    // =========================================================================

    /**
     * Create an advance request. By default it is submitted straight away
     * (draft -> validated -> pending); pass submit=false to keep a draft.
     *
     * @return array ['advance'=>array, 'validation'=>?array]
     */
    public function create(array $input, array $actor): array
    {
        $orgId   = $this->orgId($actor);
        $userId  = $this->userId($actor);
        $isAdmin = $actor['user']['user_type'] === 'admin';
        $ownId   = (int) ($actor['employee']['id'] ?? 0);

        $employeeId = (int) ($input['employee_id'] ?? $ownId);
        if (!$isAdmin && $employeeId !== $ownId) {
            throw new AdvanceException('You can only request an advance for yourself', 403, ['employee_id' => 'Not allowed']);
        }
        if ($employeeId <= 0) {
            throw new AdvanceException('employee_id is required', 422, ['employee_id' => 'employee_id is required']);
        }
        $this->assertAmount($input['amount_requested'] ?? null);

        $emp = DB::raw('SELECT id FROM employees WHERE id = :id AND organization_id = :org', [':id' => $employeeId, ':org' => $orgId]);
        if (empty($emp)) {
            throw new AdvanceException('Employee does not belong to this organization', 422, ['employee_id' => 'Employee does not belong to this organization']);
        }

        $policy = $this->policy->getPolicy($orgId);
        if (!$policy) {
            throw new AdvanceException('No active salary advance policy is configured', 422, ['policy' => 'No active salary advance policy']);
        }

        $meta = [];
        if (!empty($input['supporting_document'])) {
            $meta['supporting_document'] = $input['supporting_document'];
        }

        $advanceId = null;
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            try {
                $advanceId = self::tx(function () use ($input, $orgId, $userId, $employeeId, $policy, $meta) {
                    $number = $this->nextNumber($orgId);
                    DB::table('advances')->insert([
                        'organization_id'      => $orgId,
                        'employee_id'          => $employeeId,
                        'policy_config_id'     => $policy['config_id'],
                        'advance_number'       => $number,
                        'amount_requested'     => Money::format(Money::toCents($input['amount_requested'])),
                        'balance_remaining'    => '0.00',
                        'reason'               => $this->nz($input['reason'] ?? null),
                        'request_date'         => date('Y-m-d'),
                        'requested_payrun_id'  => $this->nz($input['requested_payrun_id'] ?? null),
                        'recovery_start_date'  => $this->nz($input['recovery_start_date'] ?? null),
                        'recovery_end_date'    => $this->nz($input['recovery_end_date'] ?? null),
                        'number_of_recoveries' => (int) ($input['number_of_recoveries'] ?? $policy['settings']['default_recovery_periods']),
                        'disbursement_method'  => $this->nz($input['disbursement_method'] ?? null) ?? 'payroll',
                        'status'               => 'draft',
                        'metadata'             => json_encode($meta),
                        'created_by'           => $userId,
                        'updated_by'           => $userId,
                    ]);
                    $id  = (int) DB::lastInsertId();
                    $adv = $this->find($orgId, $id);
                    $this->audit($adv, $userId, 'advance_created', [
                        'new_status'       => 'draft',
                        'advance_number'   => $number,
                        'employee_id'      => $employeeId,
                        'amount_requested' => $adv['amount_requested'],
                    ]);
                    return $id;
                });
                break;
            } catch (\Exception $e) {
                if ($attempt === 3 || stripos($e->getMessage(), 'Duplicate entry') === false) {
                    throw $e;
                }
            }
        }

        $submit = filter_var($input['submit'] ?? true, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($submit === false) {
            return ['advance' => $this->find($orgId, $advanceId), 'validation' => null];
        }
        return $this->submit($advanceId, $actor);
    }

    private function nextNumber(int $orgId): string
    {
        $prefix = 'ADV-' . date('Y') . '-';
        $rows = DB::raw(
            "SELECT advance_number FROM advances
              WHERE organization_id = :org AND advance_number LIKE :p
              ORDER BY advance_number DESC LIMIT 1 FOR UPDATE",
            [':org' => $orgId, ':p' => $prefix . '%']
        );
        $seq = $rows ? ((int) substr($rows[0]->advance_number, -6)) + 1 : 1;
        return $prefix . str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
    }

    private function assertAmount($raw): void
    {
        if ($raw === null || $raw === '' || !is_numeric($raw) || Money::toCents($raw) <= 0) {
            throw new AdvanceException('Amount must be greater than zero', 422, ['amount_requested' => 'Amount must be greater than zero']);
        }
    }

    /** Edit a draft (or system-rejected) request; it returns to draft for re-submission. */
    public function update(int $id, array $input, array $actor): array
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);

        return self::tx(function () use ($id, $input, $orgId, $userId) {
            $adv = $this->lockOrFail($orgId, $id);
            if (!in_array($adv['status'], ['draft', 'system_rejected'], true)) {
                throw new AdvanceException("Only draft or system-rejected advances can be edited (current status: {$adv['status']})", 409);
            }

            $data = [];
            if (array_key_exists('amount_requested', $input)) {
                $this->assertAmount($input['amount_requested']);
                $data['amount_requested'] = Money::format(Money::toCents($input['amount_requested']));
            }
            foreach (['reason', 'requested_payrun_id', 'recovery_start_date', 'recovery_end_date', 'disbursement_method'] as $f) {
                if (array_key_exists($f, $input)) {
                    $data[$f] = $this->nz($input[$f]);
                }
            }
            if (array_key_exists('disbursement_method', $data) && $data['disbursement_method'] === null) {
                unset($data['disbursement_method']);
            }
            if (array_key_exists('number_of_recoveries', $input)) {
                $data['number_of_recoveries'] = (int) $input['number_of_recoveries'];
            }
            if (array_key_exists('supporting_document', $input)) {
                $meta = self::meta($adv);
                $meta['supporting_document'] = $input['supporting_document'];
                $data['metadata'] = json_encode($meta);
            }

            $data['status']                  = 'draft';
            $data['system_rejection_reason'] = null;
            $data['updated_by']              = $userId;
            DB::table('advances')->update($data, 'id', $id);

            $new = $this->find($orgId, $id);
            $this->audit($adv, $userId, 'update', [
                'old_status' => $adv['status'],
                'new_status' => 'draft',
                'old'        => array_intersect_key($adv, $data),
                'new'        => array_intersect_key($new, $data),
            ]);
            return $new;
        });
    }

    public function delete(int $id, array $actor): void
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);

        self::tx(function () use ($id, $orgId, $userId) {
            $adv = $this->lockOrFail($orgId, $id);
            if (!in_array($adv['status'], ['draft', 'system_rejected'], true)) {
                throw new AdvanceException('Only draft or system-rejected advances can be deleted; use cancel instead', 409);
            }
            $this->audit($adv, $userId, 'delete', $this->state($adv) + ['advance_number' => $adv['advance_number']]);
            DB::table('advances')->delete('id', $id);
        });
    }

    // =========================================================================
    // 2. Submit (validate against policy)
    // =========================================================================

    /** @return array ['advance'=>array, 'validation'=>array] ; validation.valid=false => system_rejected */
    public function submit(int $id, array $actor): array
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);

        return self::tx(function () use ($id, $actor, $orgId, $userId) {
            $adv = $this->lockOrFail($orgId, $id);
            if ($adv['status'] !== 'draft') {
                throw new AdvanceException("Only draft advances can be submitted (current status: {$adv['status']})", 409);
            }

            $meta = self::meta($adv);
            $result = $this->policy->validateRequest($orgId, [
                'employee_id'          => $adv['employee_id'],
                'amount_requested'     => $adv['amount_requested'],
                'reason'               => $adv['reason'],
                'number_of_recoveries' => $adv['number_of_recoveries'],
                'recovery_start_date'  => $adv['recovery_start_date'],
                'recovery_end_date'    => $adv['recovery_end_date'],
                'requested_payrun_id'  => $adv['requested_payrun_id'],
                'disbursement_method'  => $adv['disbursement_method'],
                'supporting_document'  => $meta['supporting_document'] ?? null,
            ], $actor, $id);

            if (!$result['valid']) {
                $meta['policy_snapshot'] = $result['snapshot'];
                $meta['validation_errors'] = $result['errors'];
                DB::table('advances')->update([
                    'status'                  => 'system_rejected',
                    'system_rejection_reason' => implode('; ', $result['errors']),
                    'metadata'                => json_encode($meta),
                    'updated_by'              => $userId,
                ], 'id', $id);

                $this->audit($adv, $userId, 'advance_policy_failed', [
                    'old_status' => 'draft',
                    'new_status' => 'system_rejected',
                    'errors'     => $result['errors'],
                    'max_allowed' => $result['max_allowed'],
                ]);
                self::notify($orgId, (int) $adv['employee_id'], 'Salary advance request rejected by policy',
                    "Advance {$adv['advance_number']} did not meet the policy: " . implode('; ', $result['errors']),
                    ['advance_id' => $id]);

                return ['advance' => $this->find($orgId, $id), 'validation' => $result];
            }

            $meta['policy_snapshot'] = $result['snapshot'];
            unset($meta['validation_errors']);
            DB::table('advances')->update([
                'status'                  => 'pending',
                'policy_config_id'        => $result['policy']['config_id'],
                'system_rejection_reason' => null,
                'metadata'                => json_encode($meta),
                'updated_by'              => $userId,
            ], 'id', $id);

            $this->audit($adv, $userId, 'advance_policy_validated', [
                'old_status'  => 'draft',
                'new_status'  => 'validated',
                'max_allowed' => $result['max_allowed'],
                'policy_config_id' => $result['policy']['config_id'],
            ]);
            $this->audit($adv, $userId, 'advance_submitted', [
                'old_status'       => 'validated',
                'new_status'       => 'pending',
                'amount_requested' => $adv['amount_requested'],
            ]);

            $this->notifyAdmins($orgId, 'New salary advance request',
                "Advance {$adv['advance_number']} for KES " . Money::display(Money::toCents($adv['amount_requested'])) . ' is awaiting approval.',
                ['advance_id' => $id]);

            return ['advance' => $this->find($orgId, $id), 'validation' => $result];
        });
    }

    // =========================================================================
    // 3. Approve / reject / cancel
    // =========================================================================

    public function approve(int $id, array $input, array $actor): array
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);

        return self::tx(function () use ($id, $input, $orgId, $userId) {
            $adv = $this->lockOrFail($orgId, $id);
            if ($adv['status'] !== 'pending') {
                throw new AdvanceException("Only pending advances can be approved (current status: {$adv['status']})", 409);
            }

            $requested = Money::toCents($adv['amount_requested']);
            $approved  = $requested;
            if (isset($input['amount_approved']) && $input['amount_approved'] !== '') {
                if (!is_numeric($input['amount_approved'])) {
                    throw new AdvanceException('amount_approved must be a number', 422, ['amount_approved' => 'Invalid amount']);
                }
                $approved = Money::toCents($input['amount_approved']);
            }
            if ($approved <= 0 || $approved > $requested) {
                throw new AdvanceException('amount_approved must be greater than zero and not exceed the amount requested', 422,
                    ['amount_approved' => 'Must be > 0 and <= KES ' . Money::display($requested)]);
            }

            DB::table('advances')->update([
                'amount_approved'   => Money::format($approved),
                'balance_remaining' => Money::format($approved - Money::toCents($adv['amount_recovered'])),
                'status'            => 'approved',
                'approved_by'       => $userId,
                'approved_at'       => $this->now(),
                'updated_by'        => $userId,
            ], 'id', $id);

            $new = $this->find($orgId, $id);
            $this->audit($adv, $userId, 'advance_approved', [
                'old_status'        => 'pending',
                'new_status'        => 'approved',
                'amount_requested'  => $adv['amount_requested'],
                'amount_approved'   => $new['amount_approved'],
                'balance_remaining' => $new['balance_remaining'],
            ]);
            self::notify($orgId, (int) $adv['employee_id'], 'Salary advance approved',
                "Your advance {$adv['advance_number']} of KES " . Money::display($approved) . ' has been approved.',
                ['advance_id' => $id]);
            return $new;
        });
    }

    public function reject(int $id, array $input, array $actor): array
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);
        $reason = trim((string) ($input['reason'] ?? $input['rejection_reason'] ?? ''));
        if ($reason === '') {
            throw new AdvanceException('A rejection reason is required', 422, ['reason' => 'A rejection reason is required']);
        }

        return self::tx(function () use ($id, $reason, $orgId, $userId) {
            $adv = $this->lockOrFail($orgId, $id);
            if ($adv['status'] !== 'pending') {
                throw new AdvanceException("Only pending advances can be rejected (current status: {$adv['status']})", 409);
            }
            DB::table('advances')->update([
                'status'           => 'rejected',
                'rejection_reason' => $reason,
                'rejected_by'      => $userId,
                'rejected_at'      => $this->now(),
                'updated_by'       => $userId,
            ], 'id', $id);

            $this->audit($adv, $userId, 'advance_rejected', [
                'old_status' => 'pending', 'new_status' => 'rejected', 'reason' => $reason,
                'amount_requested' => $adv['amount_requested'],
            ]);
            self::notify($orgId, (int) $adv['employee_id'], 'Salary advance rejected',
                "Your advance {$adv['advance_number']} was rejected: {$reason}", ['advance_id' => $id]);
            return $this->find($orgId, $id);
        });
    }

    public function cancel(int $id, array $input, array $actor): array
    {
        $orgId   = $this->orgId($actor);
        $userId  = $this->userId($actor);
        $isAdmin = $actor['user']['user_type'] === 'admin';
        $allowed = $isAdmin
            ? ['draft', 'pending', 'validated', 'approved', 'scheduled']
            : ['pending', 'validated'];

        return self::tx(function () use ($id, $input, $orgId, $userId, $allowed) {
            $adv = $this->lockOrFail($orgId, $id);
            if (!in_array($adv['status'], $allowed, true)) {
                throw new AdvanceException(
                    "An advance in status '{$adv['status']}' cannot be cancelled by you (allowed: " . implode(', ', $allowed) . ')', 409);
            }
            $reason = $this->nz(trim((string) ($input['reason'] ?? '')));

            DB::table('advances')->update([
                'status'              => 'cancelled',
                'cancelled_by'        => $userId,
                'cancelled_at'        => $this->now(),
                'cancellation_reason' => $reason,
                'updated_by'          => $userId,
            ], 'id', $id);
            DB::raw("UPDATE advance_payrun_lines SET status = 'detached' WHERE advance_id = :id AND status = 'attached'", [':id' => $id]);

            $this->audit($adv, $userId, 'advance_cancelled', [
                'old_status' => $adv['status'], 'new_status' => 'cancelled', 'reason' => $reason,
            ]);
            self::notify($orgId, (int) $adv['employee_id'], 'Salary advance cancelled',
                "Advance {$adv['advance_number']} has been cancelled.", ['advance_id' => $id]);
            return $this->find($orgId, $id);
        });
    }

    // =========================================================================
    // 4. Disburse
    // =========================================================================

    public function disburse(int $id, array $input, array $actor): array
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);

        return self::tx(function () use ($id, $input, $orgId, $userId) {
            $adv = $this->lockOrFail($orgId, $id);
            // 17. Admin approval is required before disbursement.
            if (!in_array($adv['status'], ['approved', 'scheduled'], true)) {
                throw new AdvanceException("Only approved advances can be disbursed (current status: {$adv['status']})", 409);
            }

            $method = $input['disbursement_method'] ?? $adv['disbursement_method'];
            if (!in_array($method, AdvancePolicyService::DISBURSEMENT_METHODS, true)) {
                throw new AdvanceException('Invalid disbursement method', 422, ['disbursement_method' => 'Invalid disbursement method']);
            }
            $policy = $this->policy->getPolicy($orgId, (int) $adv['policy_config_id']);
            $enabled = $policy['settings']['disbursement_methods'] ?? [];
            if (!empty($enabled) && !in_array($method, $enabled, true)) {
                throw new AdvanceException("Disbursement method '{$method}' is not enabled by policy", 422,
                    ['disbursement_method' => 'Allowed: ' . implode(', ', $enabled)]);
            }

            $reference = $this->nz(trim((string) ($input['disbursement_reference'] ?? '')));
            if (in_array($method, ['bank_transfer', 'mpesa', 'cheque'], true) && $reference === null) {
                throw new AdvanceException('disbursement_reference is required for this method', 422,
                    ['disbursement_reference' => 'Required for ' . $method]);
            }

            $date = $this->nz($input['disbursement_date'] ?? null) ?? date('Y-m-d');
            $d = \DateTime::createFromFormat('Y-m-d', $date);
            if (!$d || $d->format('Y-m-d') !== $date) {
                throw new AdvanceException('disbursement_date must be YYYY-MM-DD', 422, ['disbursement_date' => 'Invalid date']);
            }

            $approved = Money::toCents($adv['amount_approved']);
            $amount   = isset($input['amount_disbursed']) && $input['amount_disbursed'] !== ''
                ? Money::toCents($input['amount_disbursed']) : $approved;
            if ($amount !== $approved) {
                throw new AdvanceException('amount_disbursed must equal the approved amount (KES ' . Money::display($approved) . ')', 422,
                    ['amount_disbursed' => 'Must equal amount_approved']);
            }

            DB::table('advances')->update([
                'amount_disbursed'       => Money::format($amount),
                'disbursement_method'    => $method,
                'disbursement_reference' => $reference,
                'disbursement_date'      => $date,
                'balance_remaining'      => Money::format($approved - Money::toCents($adv['amount_recovered'])),
                'status'                 => 'disbursed',
                'disbursed_by'           => $userId,
                'disbursed_at'           => $this->now(),
                'updated_by'             => $userId,
            ], 'id', $id);

            $new = $this->find($orgId, $id);
            $this->audit($adv, $userId, 'advance_disbursed', [
                'old_status'             => $adv['status'],
                'new_status'             => 'disbursed',
                'amount_disbursed'       => $new['amount_disbursed'],
                'disbursement_method'    => $method,
                'disbursement_reference' => $reference,
                'disbursement_date'      => $date,
                'balance_remaining'      => $new['balance_remaining'],
            ]);
            self::notify($orgId, (int) $adv['employee_id'], 'Salary advance disbursed',
                "Advance {$adv['advance_number']} of KES " . Money::display($amount) . " has been disbursed via {$method}.",
                ['advance_id' => $id]);
            return $new;
        });
    }

    // =========================================================================
    // 5. Attach / detach payrun recovery
    // =========================================================================

    public function attachPayrun(int $id, array $input, array $actor): array
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);
        $payrunId = (int) ($input['payrun_id'] ?? 0);
        if ($payrunId <= 0) {
            throw new AdvanceException('payrun_id is required', 422, ['payrun_id' => 'payrun_id is required']);
        }

        return self::tx(function () use ($id, $input, $orgId, $userId, $payrunId) {
            $adv = $this->lockOrFail($orgId, $id);

            // 18. Recovery can only be attached after disbursement.
            if (!in_array($adv['status'], ['disbursed', 'partially_recovered'], true)) {
                throw new AdvanceException("Recovery can only be attached to a disbursed advance (current status: {$adv['status']})", 409);
            }

            // 12/19. Payrun: same org, draft (never reviewed/finalized).
            $pr = DB::raw('SELECT id, organization_id, status, payrun_name FROM payruns WHERE id = :id AND organization_id = :org AND deleted_at IS NULL',
                [':id' => $payrunId, ':org' => $orgId]);
            if (empty($pr)) {
                throw new AdvanceException('Payrun not found in this organization', 422, ['payrun_id' => 'Payrun not found in this organization']);
            }
            if ($pr[0]->status !== 'draft') {
                throw new AdvanceException("A payrun in status '{$pr[0]->status}' cannot accept advance recovery; it must be draft", 422,
                    ['payrun_id' => 'Payrun must be in draft status']);
            }

            $meta = self::meta($adv);
            $mode = $input['recovery_mode'] ?? ($meta['recovery_mode'] ?? AdvanceRecoveryService::MODE_EQUAL);
            if (!in_array($mode, [AdvanceRecoveryService::MODE_EQUAL, AdvanceRecoveryService::MODE_CUSTOM], true)) {
                throw new AdvanceException("recovery_mode must be 'equal' or 'custom'", 422, ['recovery_mode' => 'Invalid mode']);
            }

            $existingLines = DB::raw(
                "SELECT * FROM advance_payrun_lines WHERE advance_id = :id FOR UPDATE", [':id' => $id]);
            $sameLine = null; $attachedSum = 0; $attachedCount = 0; $processedCount = 0;
            foreach ($existingLines as $l) {
                if ((int) $l->payrun_id === $payrunId) $sameLine = $l;
                if ($l->status === 'attached' && (int) $l->payrun_id !== $payrunId) {
                    $attachedSum += Money::toCents($l->scheduled_amount);
                    $attachedCount++;
                }
                if ($l->status === 'processed') $processedCount++;
            }
            if ($sameLine && in_array($sameLine->status, ['attached', 'processed'], true)) {
                throw new AdvanceException('This advance is already attached to that payrun', 409, ['payrun_id' => 'Already attached']);
            }
            if (isset($meta['recovery_mode']) && $meta['recovery_mode'] !== $mode && ($attachedCount + $processedCount) > 0) {
                throw new AdvanceException("This advance already uses '{$meta['recovery_mode']}' recovery; the mode cannot change", 409,
                    ['recovery_mode' => 'Mode mismatch']);
            }

            if ($mode === AdvanceRecoveryService::MODE_CUSTOM) {
                $raw = $input['scheduled_amount'] ?? null;
                if ($raw === null || $raw === '' || !is_numeric($raw) || Money::toCents($raw) <= 0) {
                    throw new AdvanceException('scheduled_amount is required and must be greater than zero for custom recovery', 422,
                        ['scheduled_amount' => 'Required for custom recovery']);
                }
                $scheduled = Money::toCents($raw);
            } else {
                $n = max(1, (int) $adv['number_of_recoveries']);
                if ($processedCount + $attachedCount + 1 > $n) {
                    throw new AdvanceException("All {$n} planned recoveries are already scheduled or processed", 422,
                        ['payrun_id' => 'Recovery count exceeded']);
                }
                $scheduled = $this->recovery->equalInstalment($adv);
            }

            // 20. Sum of scheduled amounts must not exceed balance_remaining.
            $balance = Money::toCents($adv['balance_remaining']);
            if ($attachedSum + $scheduled > $balance) {
                throw new AdvanceException(
                    'Total scheduled recovery (KES ' . Money::display($attachedSum + $scheduled)
                    . ') would exceed the remaining balance (KES ' . Money::display($balance) . ')', 422,
                    ['scheduled_amount' => 'Exceeds balance_remaining']);
            }

            if ($sameLine) { // re-attach a previously detached / failed line
                DB::table('advance_payrun_lines')->update([
                    'scheduled_amount' => Money::format($scheduled),
                    'status'           => 'attached',
                    'attached_by'      => $userId,
                    'processed_at'     => null,
                ], 'id', (int) $sameLine->id);
                $lineId = (int) $sameLine->id;
            } else {
                DB::table('advance_payrun_lines')->insert([
                    'organization_id'  => $orgId,
                    'advance_id'       => $id,
                    'payrun_id'        => $payrunId,
                    'employee_id'      => (int) $adv['employee_id'],
                    'scheduled_amount' => Money::format($scheduled),
                    'status'           => 'attached',
                    'attached_by'      => $userId,
                ]);
                $lineId = (int) DB::lastInsertId();
            }

            $meta['recovery_mode'] = $mode;
            DB::table('advances')->update(['metadata' => json_encode($meta), 'updated_by' => $userId], 'id', $id);

            $this->audit($adv, $userId, 'advance_recovery_attached', [
                'payrun_id'         => $payrunId,
                'payrun_name'       => $pr[0]->payrun_name,
                'line_id'           => $lineId,
                'recovery_mode'     => $mode,
                'scheduled_amount'  => Money::format($scheduled),
                'balance_remaining' => $adv['balance_remaining'],
            ]);

            return (array) DB::raw('SELECT * FROM advance_payrun_lines WHERE id = :id', [':id' => $lineId])[0];
        });
    }

    public function detachPayrun(int $id, array $input, array $actor): array
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);
        $payrunId = (int) ($input['payrun_id'] ?? 0);
        if ($payrunId <= 0) {
            throw new AdvanceException('payrun_id is required', 422, ['payrun_id' => 'payrun_id is required']);
        }

        return self::tx(function () use ($id, $orgId, $userId, $payrunId) {
            $adv = $this->lockOrFail($orgId, $id);

            $lines = DB::raw(
                'SELECT * FROM advance_payrun_lines WHERE advance_id = :a AND payrun_id = :p AND organization_id = :o FOR UPDATE',
                [':a' => $id, ':p' => $payrunId, ':o' => $orgId]);
            if (empty($lines) || $lines[0]->status !== 'attached') {
                throw new AdvanceException('No attached recovery line found for that payrun', 404);
            }
            $pr = DB::raw('SELECT status FROM payruns WHERE id = :id AND organization_id = :o', [':id' => $payrunId, ':o' => $orgId]);
            if (empty($pr) || $pr[0]->status !== 'draft') {
                throw new AdvanceException('Recovery can only be detached from a draft payrun', 422, ['payrun_id' => 'Payrun must be draft']);
            }

            DB::table('advance_payrun_lines')->update(['status' => 'detached'], 'id', (int) $lines[0]->id);
            $this->audit($adv, $userId, 'advance_recovery_detached', [
                'payrun_id' => $payrunId, 'line_id' => (int) $lines[0]->id,
                'scheduled_amount' => $lines[0]->scheduled_amount,
            ]);
            return (array) DB::raw('SELECT * FROM advance_payrun_lines WHERE id = :id', [':id' => (int) $lines[0]->id])[0];
        });
    }

    // =========================================================================
    // 6. Repayment ledger (shared by payroll recovery and manual repayment)
    // =========================================================================

    /**
     * Apply a repayment to an advance. MUST be called inside a transaction with
     * $adv freshly locked (FOR UPDATE).
     *
     * @param array $opts payrun_id, payrun_detail_id, date, notes
     * @return array ['advance'=>array, 'repayment_id'=>int, 'balance_before'=>string, 'balance_after'=>string]
     */
    public function recordRepayment(array $adv, int $cents, string $method, int $userId, array $opts = []): array
    {
        $orgId         = (int) $adv['organization_id'];
        $balanceBefore = Money::toCents($adv['balance_remaining']);
        $recovered     = Money::toCents($adv['amount_recovered']);
        $approved      = Money::toCents($adv['amount_approved']);

        if (!in_array($adv['status'], ['disbursed', 'partially_recovered'], true)) {
            throw new AdvanceException("Advance {$adv['advance_number']} is '{$adv['status']}' and cannot receive repayments", 409);
        }
        if ($cents <= 0) {
            throw new AdvanceException('Repayment amount must be greater than zero', 422, ['amount' => 'Must be greater than zero']);
        }
        if ($cents > $balanceBefore) {
            throw new AdvanceException('Repayment (KES ' . Money::display($cents) . ') exceeds the remaining balance (KES ' . Money::display($balanceBefore) . ')', 422,
                ['amount' => 'Exceeds balance_remaining']);
        }

        $newRecovered = $recovered + $cents;
        $balanceAfter = $approved - $newRecovered;           // balance = approved - recovered, always
        $newStatus    = self::statusFor($balanceAfter, $newRecovered);

        DB::table('advance_repayments')->insert([
            'organization_id'  => $orgId,
            'advance_id'       => (int) $adv['id'],
            'employee_id'      => (int) $adv['employee_id'],
            'payrun_id'        => $opts['payrun_id'] ?? null,
            'payrun_detail_id' => $opts['payrun_detail_id'] ?? null,
            'amount'           => Money::format($cents),
            'balance_after'    => Money::format($balanceAfter),
            'repayment_date'   => $opts['date'] ?? date('Y-m-d'),
            'method'           => $method,
            'status'           => 'applied',
            'notes'            => $opts['notes'] ?? null,
            'recorded_by'      => $userId,
        ]);
        $repaymentId = (int) DB::lastInsertId();

        DB::table('advances')->update([
            'amount_recovered'  => Money::format($newRecovered),
            'balance_remaining' => Money::format($balanceAfter),
            'status'            => $newStatus,
            'updated_by'        => $userId,
        ], 'id', (int) $adv['id']);

        $details = [
            'old_status'        => $adv['status'],
            'new_status'        => $newStatus,
            'repayment_id'      => $repaymentId,
            'amount'            => Money::format($cents),
            'balance_before'    => Money::format($balanceBefore),
            'balance_after'     => Money::format($balanceAfter),
            'amount_recovered'  => Money::format($newRecovered),
            'payrun_id'         => $opts['payrun_id'] ?? null,
        ];
        $this->audit($adv, $userId, $method === 'manual' ? 'advance_manual_repayment' : 'advance_recovery_processed', $details);

        if ($newStatus === 'repaid') {
            DB::raw("UPDATE advance_payrun_lines SET status = 'detached'
                      WHERE advance_id = :id AND status = 'attached'
                        AND payrun_id <> :p", [':id' => (int) $adv['id'], ':p' => (int) ($opts['payrun_id'] ?? 0)]);
            $this->audit($adv, $userId, 'advance_repaid', $details);
            self::notify($orgId, (int) $adv['employee_id'], 'Salary advance fully repaid',
                "Advance {$adv['advance_number']} has been fully repaid.", ['advance_id' => (int) $adv['id']]);
        } else {
            $this->audit($adv, $userId, 'advance_partially_recovered', $details);
        }

        return [
            'advance'        => $this->find($orgId, (int) $adv['id']),
            'repayment_id'   => $repaymentId,
            'balance_before' => Money::format($balanceBefore),
            'balance_after'  => Money::format($balanceAfter),
        ];
    }

    public function manualRepayment(int $id, array $input, array $actor): array
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);
        $raw    = $input['amount'] ?? null;
        if ($raw === null || $raw === '' || !is_numeric($raw) || Money::toCents($raw) <= 0) {
            throw new AdvanceException('amount must be greater than zero', 422, ['amount' => 'Must be greater than zero']);
        }
        $date = $this->nz($input['repayment_date'] ?? null) ?? date('Y-m-d');
        $d = \DateTime::createFromFormat('Y-m-d', $date);
        if (!$d || $d->format('Y-m-d') !== $date) {
            throw new AdvanceException('repayment_date must be YYYY-MM-DD', 422, ['repayment_date' => 'Invalid date']);
        }

        return self::tx(function () use ($id, $raw, $date, $input, $orgId, $userId) {
            $adv = $this->lockOrFail($orgId, $id);
            return $this->recordRepayment($adv, Money::toCents($raw), 'manual', $userId, [
                'date'  => $date,
                'notes' => $this->nz($input['notes'] ?? null),
            ]);
        });
    }

    /** Reverse a manual repayment (admin / finance_manager). */
    public function reverseRepayment(int $advanceId, int $repaymentId, array $input, array $actor): array
    {
        $orgId  = $this->orgId($actor);
        $userId = $this->userId($actor);
        $reason = trim((string) ($input['reason'] ?? ''));
        if ($reason === '') {
            throw new AdvanceException('A reversal reason is required', 422, ['reason' => 'Required']);
        }

        return self::tx(function () use ($advanceId, $repaymentId, $reason, $orgId, $userId) {
            $adv = $this->lockOrFail($orgId, $advanceId);
            $rows = DB::raw(
                'SELECT * FROM advance_repayments WHERE id = :r AND advance_id = :a AND organization_id = :o FOR UPDATE',
                [':r' => $repaymentId, ':a' => $advanceId, ':o' => $orgId]);
            if (empty($rows)) {
                throw new AdvanceException('Repayment not found', 404);
            }
            $rep = $rows[0];
            if ($rep->status !== 'applied') {
                throw new AdvanceException("Only applied repayments can be reversed (current status: {$rep->status})", 409);
            }
            if ($rep->method !== 'manual') {
                throw new AdvanceException('Only manual repayments can be reversed here; payroll recoveries are reversed by reprocessing the draft payrun', 409);
            }

            $cents        = Money::toCents($rep->amount);
            $newRecovered = Money::toCents($adv['amount_recovered']) - $cents;
            $balanceAfter = Money::toCents($adv['amount_approved']) - $newRecovered;
            $newStatus    = self::statusFor($balanceAfter, $newRecovered);

            DB::table('advance_repayments')->update(['status' => 'reversed'], 'id', $repaymentId);
            DB::table('advance_repayments')->insert([
                'organization_id' => $orgId,
                'advance_id'      => $advanceId,
                'employee_id'     => (int) $adv['employee_id'],
                'amount'          => Money::format($cents),
                'balance_after'   => Money::format($balanceAfter),
                'repayment_date'  => date('Y-m-d'),
                'method'          => 'reversal',
                'status'          => 'applied',
                'notes'           => "Reversal of repayment #{$repaymentId}: {$reason}",
                'recorded_by'     => $userId,
            ]);
            DB::table('advances')->update([
                'amount_recovered'  => Money::format($newRecovered),
                'balance_remaining' => Money::format($balanceAfter),
                'status'            => $newStatus,
                'updated_by'        => $userId,
            ], 'id', $advanceId);

            $this->audit($adv, $userId, 'advance_reversed', [
                'old_status' => $adv['status'], 'new_status' => $newStatus,
                'repayment_id' => $repaymentId, 'amount' => Money::format($cents),
                'balance_remaining' => Money::format($balanceAfter), 'reason' => $reason,
            ]);
            return $this->find($orgId, $advanceId);
        });
    }

    // =========================================================================
    // Read models
    // =========================================================================

    /**
     * @param array $filters status, employee_id, from, to, page, per_page
     * @return array ['rows'=>array, 'pagination'=>array]
     */
    public function list(int $orgId, array $filters, ?int $forceEmployeeId = null): array
    {
        $where  = ['a.organization_id = :org'];
        $params = [':org' => $orgId];

        $employeeId = $forceEmployeeId ?? (isset($filters['employee_id']) && $filters['employee_id'] !== '' ? (int) $filters['employee_id'] : null);
        if ($employeeId) { $where[] = 'a.employee_id = :emp'; $params[':emp'] = $employeeId; }
        if (!empty($filters['status'])) { $where[] = 'a.status = :status'; $params[':status'] = $filters['status']; }
        if (!empty($filters['from']))   { $where[] = 'a.request_date >= :from'; $params[':from'] = $filters['from']; }
        if (!empty($filters['to']))     { $where[] = 'a.request_date <= :to';   $params[':to'] = $filters['to']; }
        if (!empty($filters['name'])) {
            $where[] = "(CONCAT(e.firstname, ' ', e.surname) LIKE :name OR e.employee_number LIKE :name OR a.advance_number LIKE :name)";
            $params[':name'] = '%' . trim($filters['name']) . '%';
        }
        if (!empty($filters['month']) && ctype_digit((string) $filters['month'])) {
            $where[] = 'MONTH(a.request_date) = :month'; $params[':month'] = (int) $filters['month'];
        }
        if (!empty($filters['year']) && ctype_digit((string) $filters['year'])) {
            $where[] = 'YEAR(a.request_date) = :year'; $params[':year'] = (int) $filters['year'];
        }
        $w = implode(' AND ', $where);

        $page    = max(1, (int) ($filters['page'] ?? 1));
        $perPage = max(1, min(100, (int) ($filters['per_page'] ?? 10)));
        $offset  = ($page - 1) * $perPage;

        $total = (int) (DB::raw("SELECT COUNT(*) AS c FROM advances a INNER JOIN employees e ON e.id = a.employee_id WHERE $w", $params)[0]->c ?? 0);

        $rows = DB::raw(
            "SELECT a.*, CONCAT(e.firstname, ' ', e.surname) AS employee_name, e.employee_number,
                    COALESCE(e.workemail, e.personalemail) AS employee_email
               FROM advances a
               INNER JOIN employees e ON e.id = a.employee_id
              WHERE $w
              ORDER BY a.created_at DESC, a.id DESC
              LIMIT $perPage OFFSET $offset",
            $params
        );
        foreach ($rows as $r) {
            $r->metadata = $r->metadata ? json_decode($r->metadata, true) : null;
        }

        $pages = (int) ceil($total / $perPage);
        return [
            'rows' => $rows,
            'statistics' => $this->statistics($orgId, $employeeId),
            'pagination' => [
                'current_page' => $page, 'per_page' => $perPage, 'total' => $total,
                'total_pages' => $pages, 'has_next' => $page < $pages, 'has_prev' => $page > 1,
            ],
        ];
    }

    /**
     * Dashboard figures for the whole organization (or one employee), independent
     * of the list filters. Money is returned as exact decimal strings.
     */
    public function statistics(int $orgId, ?int $employeeId = null): array
    {
        $params = [':org' => $orgId];
        $w = 'organization_id = :org';
        if ($employeeId) { $w .= ' AND employee_id = :emp'; $params[':emp'] = $employeeId; }

        $r = DB::raw(
            "SELECT COUNT(*) AS total_advances,
                    COALESCE(SUM(amount_requested), 0) AS total_requested,
                    COALESCE(SUM(amount_disbursed), 0) AS total_disbursed,
                    COALESCE(SUM(amount_recovered), 0) AS total_recovered,
                    COALESCE(SUM(CASE WHEN status IN ('disbursed','partially_recovered') THEN balance_remaining ELSE 0 END), 0) AS total_outstanding,
                    COALESCE(SUM(status IN ('pending','validated')), 0) AS in_approval,
                    COALESCE(SUM(status IN ('approved','scheduled')), 0) AS approved,
                    COALESCE(SUM(status IN ('disbursed','partially_recovered')), 0) AS active,
                    COALESCE(SUM(status = 'repaid'), 0) AS repaid,
                    COALESCE(SUM(status IN ('rejected','system_rejected')), 0) AS rejected
               FROM advances WHERE $w",
            $params
        )[0];

        return [
            'total_advances'    => (int) $r->total_advances,
            'total_requested'   => $r->total_requested,
            'total_disbursed'   => $r->total_disbursed,
            'total_recovered'   => $r->total_recovered,
            'total_outstanding' => $r->total_outstanding,
            'by_status' => [
                'in_approval' => (int) $r->in_approval,
                'approved'    => (int) $r->approved,
                'active'      => (int) $r->active,
                'repaid'      => (int) $r->repaid,
                'rejected'    => (int) $r->rejected,
            ],
        ];
    }

    /** Draft payruns an advance recovery can be attached to. */
    public function draftPayruns(int $orgId): array
    {
        return DB::raw(
            "SELECT id, payrun_name, pay_period_start, pay_period_end, status
               FROM payruns
              WHERE organization_id = :o AND status = 'draft' AND deleted_at IS NULL
              ORDER BY pay_period_end DESC, id DESC",
            [':o' => $orgId]
        );
    }

    public function detail(int $orgId, int $id): ?array
    {
        $rows = DB::raw(
            "SELECT a.*, CONCAT(e.firstname, ' ', e.surname) AS employee_name, e.employee_number,
                    COALESCE(e.workemail, e.personalemail) AS employee_email
               FROM advances a INNER JOIN employees e ON e.id = a.employee_id
              WHERE a.id = :id AND a.organization_id = :org",
            [':id' => $id, ':org' => $orgId]
        );
        if (empty($rows)) return null;
        $adv = $rows[0];
        $adv->metadata = $adv->metadata ? json_decode($adv->metadata, true) : null;
        $adv->payrun_lines = $this->payrunLines($orgId, $id);
        $adv->repayments   = $this->repayments($orgId, $id);
        return (array) $adv;
    }

    public function repayments(int $orgId, int $advanceId): array
    {
        return DB::raw(
            "SELECT r.*, p.payrun_name,
                    NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))), '') AS recorded_by_name
               FROM advance_repayments r
               LEFT JOIN payruns p ON p.id = r.payrun_id
               LEFT JOIN users u ON u.id = r.recorded_by
              WHERE r.advance_id = :a AND r.organization_id = :o
              ORDER BY r.id ASC",
            [':a' => $advanceId, ':o' => $orgId]
        );
    }

    public function payrunLines(int $orgId, int $advanceId): array
    {
        return DB::raw(
            "SELECT l.*, p.payrun_name, p.status AS payrun_status, p.pay_period_start, p.pay_period_end
               FROM advance_payrun_lines l
               INNER JOIN payruns p ON p.id = l.payrun_id
              WHERE l.advance_id = :a AND l.organization_id = :o
              ORDER BY l.id ASC",
            [':a' => $advanceId, ':o' => $orgId]
        );
    }

    /** Outstanding advance position + what the employee could still request. */
    public function balance(int $orgId, int $employeeId): ?array
    {
        $rows = DB::raw(
            'SELECT id, organization_id, status, base_salary, firstname, surname FROM employees WHERE id = :id AND organization_id = :o',
            [':id' => $employeeId, ':o' => $orgId]);
        if (empty($rows)) return null;
        $employee = $rows[0];

        $adv = DB::raw(
            "SELECT id, advance_number, status, amount_approved, amount_recovered, balance_remaining
               FROM advances
              WHERE organization_id = :o AND employee_id = :e AND status IN ('disbursed','partially_recovered')
              ORDER BY id",
            [':o' => $orgId, ':e' => $employeeId]);
        $outstanding = 0;
        foreach ($adv as $a) $outstanding += Money::toCents($a->balance_remaining);

        $in = "'" . implode("','", AdvancePolicyService::ACTIVE_STATUSES) . "'";
        $activeCount = (int) (DB::raw("SELECT COUNT(*) AS c FROM advances WHERE organization_id = :o AND employee_id = :e AND status IN ($in)",
            [':o' => $orgId, ':e' => $employeeId])[0]->c ?? 0);

        $policy = $this->policy->getPolicy($orgId);
        $maxEligible = null; $canRequest = false;
        if ($policy) {
            $s = $policy['settings'];
            $info = $this->policy->calculateMaxAllowed($orgId, $employee, $s);
            $maxEligible = Money::format($info['max_cents']);
            $canRequest = $employee->status === 'active'
                && ($s['max_active_advances'] === null || $activeCount < (int) $s['max_active_advances']);
        }

        return [
            'employee_id'         => $employeeId,
            'employee_name'       => $employee->firstname . ' ' . $employee->surname,
            'outstanding_balance' => Money::format($outstanding),
            'active_advances'     => $activeCount,
            'advances'            => $adv,
            'max_eligible_amount' => $maxEligible,
            'can_request'         => $canRequest,
        ];
    }
}
