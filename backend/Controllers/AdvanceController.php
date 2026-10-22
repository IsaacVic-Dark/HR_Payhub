<?php

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Services\AdvanceException;
use App\Services\AdvancePolicyService;
use App\Services\AdvanceService;

/**
 * Salary Advances API.
 *
 * Authorization (role, tenant, ownership) is enforced by
 * AdvanceAuthorizationMiddleware; every query here is additionally scoped by
 * the authenticated user's organization_id.
 */
class AdvanceController
{
    private AdvanceService $service;
    private AdvancePolicyService $policy;

    public function __construct()
    {
        $this->service = new AdvanceService();
        $this->policy  = new AdvancePolicyService();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function actor(): array
    {
        return ['user' => AuthMiddleware::getCurrentUser(), 'employee' => AuthMiddleware::getCurrentEmployee()];
    }

    private function orgId(): int
    {
        return (int) AuthMiddleware::getCurrentOrganizationId();
    }

    private function input(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw !== false && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
        return $_POST ?: [];
    }

    private function isEmployeeRole(): bool
    {
        return ($this->actor()['user']['user_type'] ?? '') === 'employee';
    }

    private function run(callable $fn)
    {
        try {
            return $fn();
        } catch (AdvanceException $e) {
            return responseJson(success: false, data: null, message: $e->getMessage(), code: $e->httpCode, errors: $e->errors);
        } catch (\Throwable $e) {
            error_log('Advance module error: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
            return responseJson(success: false, data: null, message: 'An unexpected error occurred', code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // Advances
    // -------------------------------------------------------------------------

    /** POST /api/v1/advances */
    public function store()
    {
        return $this->run(function () {
            $result = $this->service->create($this->input(), $this->actor());

            if ($result['validation'] !== null && !$result['validation']['valid']) {
                return responseJson(
                    success: false,
                    data: ['advance' => $result['advance'], 'max_allowed' => $result['validation']['max_allowed']],
                    message: 'Advance request failed policy validation',
                    code: 422,
                    errors: $result['validation']['errors']
                );
            }
            return responseJson(
                success: true,
                data: $result['advance'],
                message: $result['advance']['status'] === 'draft' ? 'Advance saved as draft' : 'Advance request submitted successfully',
                code: 201
            );
        });
    }

    /** GET /api/v1/advances */
    public function index()
    {
        return $this->run(function () {
            $forceEmployee = $this->isEmployeeRole() ? (int) $this->actor()['employee']['id'] : null;
            $res = $this->service->list($this->orgId(), $_GET, $forceEmployee);
            return responseJson(success: true, data: $res['rows'], message: 'Fetched advances successfully', code: 200,
                metadata: ['pagination' => $res['pagination'], 'statistics' => $res['statistics']]);
        });
    }

    /** GET /api/v1/advances/{advance} */
    public function show($advance)
    {
        return $this->run(function () use ($advance) {
            $row = $this->service->detail($this->orgId(), (int) $advance);
            if (!$row) {
                return responseJson(success: false, data: null, message: 'Advance not found', code: 404);
            }
            return responseJson(success: true, data: $row, message: 'Advance fetched successfully', code: 200);
        });
    }

    /** PUT /api/v1/advances/{advance} */
    public function update($advance)
    {
        return $this->run(function () use ($advance) {
            $row = $this->service->update((int) $advance, $this->input(), $this->actor());
            return responseJson(success: true, data: $row, message: 'Advance updated successfully', code: 200);
        });
    }

    /** DELETE /api/v1/advances/{advance} */
    public function destroy($advance)
    {
        return $this->run(function () use ($advance) {
            $this->service->delete((int) $advance, $this->actor());
            return responseJson(success: true, data: null, message: 'Advance deleted successfully', code: 200);
        });
    }

    /** POST /api/v1/advances/{advance}/submit */
    public function submit($advance)
    {
        return $this->run(function () use ($advance) {
            $result = $this->service->submit((int) $advance, $this->actor());
            if (!$result['validation']['valid']) {
                return responseJson(
                    success: false,
                    data: ['advance' => $result['advance'], 'max_allowed' => $result['validation']['max_allowed']],
                    message: 'Advance request failed policy validation',
                    code: 422,
                    errors: $result['validation']['errors']
                );
            }
            return responseJson(success: true, data: $result['advance'], message: 'Advance submitted for approval', code: 200);
        });
    }

    /** POST /api/v1/advances/{advance}/approve */
    public function approve($advance)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->approve((int) $advance, $this->input(), $this->actor()),
            message: 'Advance approved successfully', code: 200));
    }

    /** POST /api/v1/advances/{advance}/reject */
    public function reject($advance)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->reject((int) $advance, $this->input(), $this->actor()),
            message: 'Advance rejected', code: 200));
    }

    /** POST /api/v1/advances/{advance}/cancel */
    public function cancel($advance)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->cancel((int) $advance, $this->input(), $this->actor()),
            message: 'Advance cancelled', code: 200));
    }

    /** POST /api/v1/advances/{advance}/disburse */
    public function disburse($advance)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->disburse((int) $advance, $this->input(), $this->actor()),
            message: 'Advance disbursed successfully', code: 200));
    }

    // -------------------------------------------------------------------------
    // Payrun recovery
    // -------------------------------------------------------------------------

    /** POST /api/v1/advances/{advance}/attach-payrun */
    public function attachPayrun($advance)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->attachPayrun((int) $advance, $this->input(), $this->actor()),
            message: 'Recovery attached to payrun', code: 201));
    }

    /** POST /api/v1/advances/{advance}/detach-payrun */
    public function detachPayrun($advance)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->detachPayrun((int) $advance, $this->input(), $this->actor()),
            message: 'Recovery detached from payrun', code: 200));
    }

    /** GET /api/v1/advances/{advance}/payrun-lines */
    public function payrunLines($advance)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->payrunLines($this->orgId(), (int) $advance),
            message: 'Fetched payrun lines successfully', code: 200));
    }

    /** GET /api/v1/advance-payruns : draft payruns available for recovery */
    public function payrunOptions()
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->draftPayruns($this->orgId()),
            message: 'Fetched draft payruns successfully', code: 200));
    }

    // -------------------------------------------------------------------------
    // Repayments
    // -------------------------------------------------------------------------

    /** POST /api/v1/advances/{advance}/manual-repayment */
    public function manualRepayment($advance)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->manualRepayment((int) $advance, $this->input(), $this->actor()),
            message: 'Manual repayment recorded', code: 201));
    }

    /** GET /api/v1/advances/{advance}/repayments */
    public function repayments($advance)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->repayments($this->orgId(), (int) $advance),
            message: 'Fetched repayments successfully', code: 200));
    }

    /** POST /api/v1/advances/{advance}/repayments/{repayment}/reverse */
    public function reverseRepayment($advance, $repayment)
    {
        return $this->run(fn() => responseJson(success: true,
            data: $this->service->reverseRepayment((int) $advance, (int) $repayment, $this->input(), $this->actor()),
            message: 'Repayment reversed', code: 200));
    }

    // -------------------------------------------------------------------------
    // Employee views
    // -------------------------------------------------------------------------

    /** GET /api/v1/employees/{employee}/advances */
    public function employeeAdvances($employee)
    {
        return $this->run(function () use ($employee) {
            $res = $this->service->list($this->orgId(), $_GET, (int) $employee);
            return responseJson(success: true, data: $res['rows'], message: 'Fetched employee advances successfully', code: 200,
                metadata: ['pagination' => $res['pagination'], 'statistics' => $res['statistics']]);
        });
    }

    /** GET /api/v1/employees/{employee}/advance-balance */
    public function employeeBalance($employee)
    {
        return $this->run(function () use ($employee) {
            $data = $this->service->balance($this->orgId(), (int) $employee);
            if (!$data) {
                return responseJson(success: false, data: null, message: 'Employee not found', code: 404);
            }
            return responseJson(success: true, data: $data, message: 'Fetched advance balance successfully', code: 200);
        });
    }

    // -------------------------------------------------------------------------
    // Policy
    // -------------------------------------------------------------------------

    /** GET /api/v1/advance-policy */
    public function showPolicy()
    {
        return $this->run(function () {
            $policy = $this->policy->getPolicy($this->orgId());
            if (!$policy) {
                return responseJson(success: false, data: null, message: 'No advance policy is configured for this organization', code: 404);
            }
            return responseJson(success: true, data: $policy, message: 'Fetched advance policy successfully', code: 200);
        });
    }

    /** PUT /api/v1/advance-policy */
    public function updatePolicy()
    {
        return $this->run(function () {
            $policy = $this->policy->updatePolicy($this->orgId(), (int) $this->actor()['user']['id'], $this->input());
            return responseJson(success: true, data: $policy, message: 'Advance policy updated successfully', code: 200);
        });
    }
}
