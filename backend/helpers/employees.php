<?php 

use App\Controllers\EmployeeController;


$employeeController = new EmployeeController($GLOBALS['pdo']);
$data = $employeeController->fetchAllEmployees();

// Part of react
echo json_encode($data);
// End of react

