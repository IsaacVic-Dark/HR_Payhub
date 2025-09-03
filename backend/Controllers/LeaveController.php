<?php

namespace App\Controllers;

use App\Services\DB;

class LeaveController
{
    public function index()
    {
        // Base SQL query
        $query = "
        SELECT 
            leaves.id AS leave_id,
            leaves.leave_type,
            leaves.start_date,
            leaves.end_date,
            leaves.status,
            employees.email AS employee_email,
            users.first_name,
            users.last_name
        FROM leaves
        INNER JOIN employees ON leaves.employee_id = employees.id
        INNER JOIN users ON employees.user_id = users.id
        ORDER BY leaves.created_at DESC
    ";

        // Fetch data
        $leaves = DB::raw($query);

        // Send JSON response
        return responseJson(
            data: $leaves,
            message: "Fetched Leaves Successfully"
        );
    }
}
