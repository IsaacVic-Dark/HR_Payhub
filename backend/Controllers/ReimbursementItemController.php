<?php

namespace App\Controllers;
require_once __DIR__ . '/ReimbursementResponseWrapper.php';
use App\Services\DB;
use App\Middleware\AuthMiddleware;

class ReimbursementItemController
{
    public function index($org_id, $reimbursement_id)
    {
        try {
            $reimbursement = $this->findReimbursementOrFail($org_id, $reimbursement_id);
            if ($reimbursement instanceof ReimbursementResponseWrapper) return $reimbursement->response;

            $items = DB::raw(
                "SELECT * FROM reimbursementitems WHERE reimbursement_id = :id ORDER BY expense_date ASC",
                [':id' => $reimbursement_id]
            );

            return responseJson(success: true, data: $items, message: "Fetched reimbursement items successfully");
        } catch (\Exception $e) {
            error_log("ReimbursementItem index error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to fetch items", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function store($org_id, $reimbursement_id)
    {
        try {
            $reimbursement = $this->findReimbursementOrFail($org_id, $reimbursement_id);
            if ($reimbursement instanceof ReimbursementResponseWrapper) return $reimbursement->response;

            if (!in_array($reimbursement->status, ['draft', 'pending'])) {
                return responseJson(success: false, message: "Items can only be added while a claim is draft or pending", code: 409);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            foreach (['expense_category', 'amount', 'expense_date'] as $field) {
                if (empty($data[$field])) {
                    return responseJson(success: false, message: "Field '$field' is required", code: 400);
                }
            }

            $user = AuthMiddleware::getCurrentUser();

            DB::table('reimbursementitems')->insert([
                'reimbursement_id' => $reimbursement_id,
                'expense_category' => $data['expense_category'],
                'expense_item' => $data['expense_item'] ?? null,
                'receipt_number' => $data['receipt_number'] ?? null,
                'amount' => $data['amount'],
                'tax_amount' => $data['tax_amount'] ?? 0,
                'currency' => $data['currency'] ?? $reimbursement->currency,
                'expense_date' => $data['expense_date'],
                'vendor_name' => $data['vendor_name'] ?? null,
                'notes' => $data['notes'] ?? null,
                'receipt_path' => $data['receipt_path'] ?? null,
                'file_hash' => $data['file_hash'] ?? null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
            $itemId = (int) DB::lastInsertId();

            $this->recomputeTotals($org_id, $reimbursement_id, $user['id']);

            return responseJson(success: true, data: ['id' => $itemId], message: "Item added successfully", code: 201);
        } catch (\Exception $e) {
            error_log("ReimbursementItem store error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to add item", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function update($org_id, $reimbursement_id, $item_id)
    {
        try {
            $reimbursement = $this->findReimbursementOrFail($org_id, $reimbursement_id);
            if ($reimbursement instanceof ReimbursementResponseWrapper) return $reimbursement->response;

            if (!in_array($reimbursement->status, ['draft', 'pending'])) {
                return responseJson(success: false, message: "Items can only be edited while a claim is draft or pending", code: 409);
            }

            $item = DB::raw("SELECT * FROM reimbursementitems WHERE id = :id AND reimbursement_id = :rid",
                [':id' => $item_id, ':rid' => $reimbursement_id]);
            if (empty($item)) {
                return responseJson(success: false, message: "Item not found", code: 404);
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $allowed = ['expense_category', 'expense_item', 'receipt_number', 'amount', 'tax_amount', 'currency',
                'expense_date', 'vendor_name', 'notes', 'receipt_path', 'file_hash'];
            $updateData = [];
            foreach ($allowed as $field) {
                if (isset($data[$field])) $updateData[$field] = $data[$field];
            }
            if (empty($updateData)) {
                return responseJson(success: false, message: "No fields to update", code: 400);
            }

            $user = AuthMiddleware::getCurrentUser();
            DB::table('reimbursementitems')->update($updateData, 'id', $item_id);
            $this->recomputeTotals($org_id, $reimbursement_id, $user['id']);

            return responseJson(success: true, data: null, message: "Item updated successfully");
        } catch (\Exception $e) {
            error_log("ReimbursementItem update error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to update item", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    public function destroy($org_id, $reimbursement_id, $item_id)
    {
        try {
            $reimbursement = $this->findReimbursementOrFail($org_id, $reimbursement_id);
            if ($reimbursement instanceof ReimbursementResponseWrapper) return $reimbursement->response;

            if (!in_array($reimbursement->status, ['draft', 'pending'])) {
                return responseJson(success: false, message: "Items can only be removed while a claim is draft or pending", code: 409);
            }

            $itemCount = DB::raw("SELECT COUNT(*) as cnt FROM reimbursementitems WHERE reimbursement_id = :rid", [':rid' => $reimbursement_id]);
            if (($itemCount[0]->cnt ?? 0) <= 1) {
                return responseJson(success: false, message: "A claim must have at least one item — cancel the claim instead", code: 409);
            }

            $user = AuthMiddleware::getCurrentUser();
            DB::raw("DELETE FROM reimbursementitems WHERE id = :id AND reimbursement_id = :rid", [':id' => $item_id, ':rid' => $reimbursement_id]);
            $this->recomputeTotals($org_id, $reimbursement_id, $user['id']);

            return responseJson(success: true, data: null, message: "Item removed successfully");
        } catch (\Exception $e) {
            error_log("ReimbursementItem destroy error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to remove item", code: 500,
                errors: ['exception' => $e->getMessage()]);
        }
    }

    // -------------------------------------------------------------------

    private function findReimbursementOrFail($org_id, $reimbursement_id)
    {
        if (!$org_id || !is_numeric($org_id) || !$reimbursement_id || !is_numeric($reimbursement_id)) {
            return new ReimbursementResponseWrapper(responseJson(success: false, message: "Invalid organization or reimbursement ID", code: 400));
        }
        $rows = DB::raw("SELECT * FROM reimbursements WHERE id = :id AND organization_id = :org_id",
            [':id' => $reimbursement_id, ':org_id' => $org_id]);
        if (empty($rows)) {
            return new ReimbursementResponseWrapper(responseJson(success: false, message: "Reimbursement not found", code: 404));
        }
        return $rows[0];
    }

    /** Re-sum item amounts back onto the parent claim (amount_requested, receipt_count) after any item mutation. */
    private function recomputeTotals($org_id, $reimbursement_id, $userId): void
    {
        $sum = DB::raw(
            "SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as cnt FROM reimbursementitems WHERE reimbursement_id = :id",
            [':id' => $reimbursement_id]
        );
        DB::table('reimbursements')->update([
            'amount_requested' => $sum[0]->total,
            'receipt_count' => $sum[0]->cnt,
            'updated_by' => $userId,
        ], 'id', $reimbursement_id);

        DB::table('audit_logs')->insert([
            'organization_id' => $org_id,
            'user_id' => $userId,
            'entity_type' => 'reimbursements',
            'entity_id' => $reimbursement_id,
            'action' => 'update',
            'details' => json_encode(['items_recomputed' => true, 'new_total' => $sum[0]->total]),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }
}