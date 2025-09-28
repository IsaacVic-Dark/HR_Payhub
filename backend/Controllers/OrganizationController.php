<?php

namespace App\Controllers;

use App\Services\DB;

class OrganizationController
{
    public function index()
    {
        // Get query params from request
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $name = isset($_GET['name']) ? trim($_GET['name']) : null;
        $location = isset($_GET['location']) ? trim($_GET['location']) : null;
        $status = isset($_GET['status']) ? trim($_GET['status']) : null;

        $offset = ($page - 1) * $limit;

        // Build WHERE clause and bindings
        $whereClauses = [];
        $bindings = [];
        
        if ($name) {
            $whereClauses[] = "`name` LIKE :name";
            $bindings['name'] = "%{$name}%";
        }

        if ($location) {
            $whereClauses[] = "(`location` LIKE :location)";
            $bindings['location'] = "%{$location}%";
        }

        if ($status !== null) {
            if ($status === '1' || strtolower($status) === 'active') {
                $whereClauses[] = "`is_active` = 1";
            } elseif ($status === '0' || strtolower($status) === 'inactive') {
                $whereClauses[] = "`is_active` = 0";
            }
        }

        $whereClause = '';
        if (!empty($whereClauses)) {
            $whereClause = "WHERE " . implode(" AND ", $whereClauses);
        }

        // Get total count
        $countSql = "SELECT COUNT(*) as count FROM organizations {$whereClause}";
        $totalResult = DB::raw($countSql, $bindings);
        $total = isset($totalResult[0]) ? (int) $totalResult[0]->count : 0;

        // Build main query
        $sql = "SELECT * FROM organizations {$whereClause} ORDER BY `created_at` DESC LIMIT {$limit} OFFSET {$offset}";
        
        // Fetch paginated data
        $organizations = DB::raw($sql, $bindings);

        // Calculate pagination metadata
        $totalPages = ceil($total / $limit);

        return responseJson(
            success: true,
            data: $organizations,
            message: "Organizations fetched successfully",
            metadata: [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => $totalPages,
                'filters_applied' => [
                    'name' => $name,
                    'location' => $location,
                    'status' => $status
                ],
                'dev_mode' => true
            ]
        );
    }

    public function store()
    {
        try {
            // Handle file upload for logo
            $logoUrl = handleFileUpload('logo');

            $data = validate([
                'tenant_id' => 'integer',
                'name' => 'required,string,max:100',
                'payroll_number_prefix' => 'string,max:10',
                'kra_pin' => 'string,max:11',
                'nssf_number' => 'string,max:15',
                'nhif_number' => 'string,max:15',
                'legal_type' => 'string,in:LTD,PLC,Sole_Proprietor,Partnership,NGO,Government,School,Other',
                'registration_number' => 'string,max:50',
                'physical_address' => 'string,max:255',
                'location' => 'required,string,max:255',
                'postal_address' => 'string,max:255',
                'postal_code_id' => 'integer',
                'county_id' => 'integer',
                'primary_phone' => 'string,max:20',
                'secondary_phone' => 'string,max:20',
                'official_email' => 'email,max:255',
                'logo_url' => $logoUrl ? '' : 'string,max:255',
                'currency' => 'string,max:10',
                'payroll_schedule' => 'string,in:Monthly,Bi-Monthly,Weekly',
                'payroll_lock_date' => 'date',
                'default_payday' => 'integer,min:1,max:31',
                'bank_id' => 'integer',
                'bank_account_name' => 'string,max:255',
                'bank_account_number' => 'string,max:255',
                'bank_branch' => 'string,max:255',
                'swift_code' => 'string,max:11',
                'nssf_branch_code' => 'string,max:50',
                'nhif_branch_code' => 'string,max:50',
                'primary_administrator_id' => 'integer',
                'domain' => 'string,max:100'
            ]);

            $finalLogoUrl = $logoUrl ?: ($data['logo_url'] ?? null);

            // Prepare insert data
            $insertData = [
                'tenant_id' => $data['tenant_id'] ?? null,
                'name' => $data['name'],
                'payroll_number_prefix' => $data['payroll_number_prefix'] ?? 'EMP',
                'kra_pin' => $data['kra_pin'] ?? null,
                'nssf_number' => $data['nssf_number'] ?? null,
                'nhif_number' => $data['nhif_number'] ?? null,
                'legal_type' => $data['legal_type'] ?? null,
                'registration_number' => $data['registration_number'] ?? null,
                'physical_address' => $data['physical_address'] ?? null,
                'location' => $data['location'],
                'postal_address' => $data['postal_address'] ?? null,
                'postal_code_id' => $data['postal_code_id'] ?? null,
                'county_id' => $data['county_id'] ?? null,
                'primary_phone' => $data['primary_phone'] ?? null,
                'secondary_phone' => $data['secondary_phone'] ?? null,
                'official_email' => $data['official_email'] ?? null,
                'logo_url' => $finalLogoUrl,
                'currency' => strtoupper($data['currency'] ?? 'KES'),
                'payroll_schedule' => $data['payroll_schedule'] ?? 'Monthly',
                'payroll_lock_date' => $data['payroll_lock_date'] ?? null,
                'default_payday' => $data['default_payday'] ?? null,
                'bank_id' => $data['bank_id'] ?? null,
                'bank_account_name' => $data['bank_account_name'] ?? null,
                'bank_account_number' => $data['bank_account_number'] ?? null,
                'bank_branch' => $data['bank_branch'] ?? null,
                'swift_code' => $data['swift_code'] ?? null,
                'nssf_branch_code' => $data['nssf_branch_code'] ?? null,
                'nhif_branch_code' => $data['nhif_branch_code'] ?? null,
                'primary_administrator_id' => $data['primary_administrator_id'] ?? null,
                'domain' => $data['domain'] ?? null,
                'is_active' => 1
            ];

            // Insert into db
            $inserted = DB::table('organizations')->insert($insertData);

            return responseJson(
                success: true,
                data: $inserted,
                message: "Organization created successfully",
                metadata: ['dev_mode' => true]
            );

        } catch (ValidationException $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Validation failed",
                error: $e->getErrors(),
                code: 422
            );
        } catch (Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create organization",
                error: $e->getMessage(),
                code: 500
            );
        }
    }

    public function show($id)
    {
        try {
            $org = DB::table('organizations')->selectAllWhereID($id);
            if (!$org || count($org) === 0) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    error: "Organization with ID {$id} does not exist",
                    code: 404
                );
            }

            return responseJson(
                success: true,
                data: $org[0],
                message: "Organization fetched successfully",
                metadata: ['dev_mode' => true]
            );
        } catch (Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch organization",
                error: $e->getMessage(),
                code: 500
            );
        }
    }

    public function update($id)
    {
        try {
            // Check if organization exists
            $org = DB::table('organizations')->selectAllWhereID($id);
            if (!$org || count($org) === 0) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    error: "Organization with ID {$id} does not exist",
                    code: 404
                );
            }

            // Handle file upload for logo
            $logoUrl = handleFileUpload('logo');

            $data = validate([
                'tenant_id' => 'integer',
                'name' => 'string,max:100',
                'payroll_number_prefix' => 'string,max:10',
                'kra_pin' => 'string,max:11',
                'nssf_number' => 'string,max:15',
                'nhif_number' => 'string,max:15',
                'legal_type' => 'string,in:LTD,PLC,Sole_Proprietor,Partnership,NGO,Government,School,Other',
                'registration_number' => 'string,max:50',
                'physical_address' => 'string,max:255',
                'location' => 'string,max:255',
                'postal_address' => 'string,max:255',
                'postal_code_id' => 'integer',
                'county_id' => 'integer',
                'primary_phone' => 'string,max:20',
                'secondary_phone' => 'string,max:20',
                'official_email' => 'email,max:255',
                'logo_url' => 'string,max:255',
                'currency' => 'string,max:10',
                'payroll_schedule' => 'string,in:Monthly,Bi-Monthly,Weekly',
                'payroll_lock_date' => 'date',
                'default_payday' => 'integer,min:1,max:31',
                'bank_id' => 'integer',
                'bank_account_name' => 'string,max:255',
                'bank_account_number' => 'string,max:255',
                'bank_branch' => 'string,max:255',
                'swift_code' => 'string,max:11',
                'nssf_branch_code' => 'string,max:50',
                'nhif_branch_code' => 'string,max:50',
                'primary_administrator_id' => 'integer',
                'is_active' => 'boolean',
                'domain' => 'string,max:100'
            ]);

            // Remove nulls (fields not provided)
            $updateData = array_filter($data, fn($v) => $v !== null);
            
            if ($logoUrl) {
                $updateData['logo_url'] = $logoUrl;
            }

            // Convert currency to uppercase if provided
            if (isset($updateData['currency'])) {
                $updateData['currency'] = strtoupper($updateData['currency']);
            }

            if (empty($updateData)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "No data provided for update",
                    error: "At least one field must be provided for update",
                    code: 400
                );
            }

            $updated = DB::table('organizations')->update($updateData, 'id', $id);
            if ($updated) {
                $org = DB::table('organizations')->selectAllWhereID($id);
                return responseJson(
                    success: true,
                    data: $org[0],
                    message: "Organization updated successfully",
                    metadata: ['dev_mode' => true]
                );
            } else {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Failed to update organization",
                    error: "Database update operation failed",
                    code: 500
                );
            }

        } catch (ValidationException $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Validation failed",
                error: $e->getErrors(),
                code: 422
            );
        } catch (Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update organization",
                error: $e->getMessage(),
                code: 500
            );
        }
    }

    public function destroy($id)
    {
        try {
            $org = DB::table('organizations')->selectAllWhereID($id);
            if (!$org || count($org) === 0) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    error: "Organization with ID {$id} does not exist",
                    code: 404
                );
            }

            $deleted = DB::table('organizations')->delete('id', $id);
            if ($deleted) {
                return responseJson(
                    success: true,
                    data: null,
                    message: "Organization deleted successfully",
                    metadata: ['dev_mode' => true]
                );
            } else {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Failed to delete organization",
                    error: "Database delete operation failed",
                    code: 500
                );
            }
        } catch (Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete organization",
                error: $e->getMessage(),
                code: 500
            );
        }
    }
}