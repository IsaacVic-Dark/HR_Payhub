<?php

namespace App\Controllers;

use App\Services\DB;

class NotificationController
{
    public function index()
    {
        // Base SQL query
        $query = "
            SELECT 
                notifications.*, 
                employees.email AS employee_email,
                users.first_name,
                users.last_name
            FROM notifications
            INNER JOIN employees ON notifications.employee_id = employees.id
            INNER JOIN users ON employees.user_id = users.id
            ORDER BY notifications.created_at DESC;
        ";

        // Fetch data
        $notifications = DB::raw($query);

        // Send JSON response
        return responseJson(
            data: $notifications,
            message: "Fetched Notifications Successfully"
        );
    }
}
