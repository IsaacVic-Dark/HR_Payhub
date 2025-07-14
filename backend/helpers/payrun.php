<?php



// PayRun.php - Main PayRun Class
class PayRun {


    private $db;
    private $userId;
    
    public function __construct($database, $userId) {
        $this->db = $database;
        $this->userId = $userId;
    }
    
    // Create new pay run
    public function createPayRun($data) {
        $sql = "INSERT INTO payruns (payrun_name, pay_period_start, pay_period_end, 
                pay_frequency, created_by) VALUES (?, ?, ?, ?, ?)";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $data['payrun_name'],
            $data['pay_period_start'],
            $data['pay_period_end'],
            $data['pay_frequency'],
            $this->userId
        ]);
    }
    
    // Calculate pay run for all employees
    public function calculatePayRun($payrunId) {
        // Get all active employees
        $employees = $this->getActiveEmployees();

        $deductionCalc = calculateNetPay($employees['Salary']);

        // $deductionCalc = new DeductionCalculation();
        
        foreach ($employees as $employee) {
            $calculation = $this->calculateEmployeePay($employee, $deductionCalc);
            $this->saveEmployeePayrun($payrunId, $employee['id'], $calculation);
        }
        
        $this->updatePayrunTotals($payrunId);
        return true;
    }
    
    // Calculate individual employee pay
    private function calculateEmployeePay($employee, $deductionCalc) {
        $basicSalary = $employee['basic_salary'];
        $overtime = $this->getOvertimeAmount($employee['id']);
        $bonus = $this->getBonusAmount($employee['id']);
        $commission = $this->getCommissionAmount($employee['id']);
        
        $grossPay = $basicSalary + $overtime + $bonus + $commission;
        
        // Calculate deductions using existing calculation class
        $paye = $deductionCalc->calculatePAYE($grossPay);
        $nhif = $deductionCalc->calculateNHIF($grossPay);
        $nssf = $deductionCalc->calculateNSSF($grossPay);
        $housingLevy = $deductionCalc->calculateHousingLevy($grossPay);
        
        $totalDeductions = $paye + $nhif + $nssf + $housingLevy;
        $netPay = $grossPay - $totalDeductions;
        
        return [
            'basic_salary' => $basicSalary,
            'overtime_amount' => $overtime,
            'bonus_amount' => $bonus,
            'commission_amount' => $commission,
            'gross_pay' => $grossPay,
            'paye_tax' => $paye,
            'nhif_deduction' => $nhif,
            'nssf_deduction' => $nssf,
            'housing_levy' => $housingLevy,
            'total_deductions' => $totalDeductions,
            'net_pay' => $netPay
        ];
    }
    
    // Save employee payrun details
    private function saveEmployeePayrun($payrunId, $employeeId, $calculation) {
        $sql = "INSERT INTO payrun_details (payrun_id, employee_id, basic_salary, 
                overtime_amount, bonus_amount, commission_amount, gross_pay, 
                paye_tax, nhif_deduction, nssf_deduction, housing_levy, 
                total_deductions, net_pay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $payrunId, $employeeId, $calculation['basic_salary'],
            $calculation['overtime_amount'], $calculation['bonus_amount'],
            $calculation['commission_amount'], $calculation['gross_pay'],
            $calculation['paye_tax'], $calculation['nhif_deduction'],
            $calculation['nssf_deduction'], $calculation['housing_levy'],
            $calculation['total_deductions'], $calculation['net_pay']
        ]);
    }
    
    // Update pay run workflow status
    public function updateStatus($payrunId, $status) {
        $allowedStatuses = ['draft', 'reviewed', 'finalized'];
        if (!in_array($status, $allowedStatuses)) {
            return false;
        }
        
        $field = $status === 'reviewed' ? 'reviewed_by' : 
                ($status === 'finalized' ? 'finalized_by' : null);
        $dateField = $status === 'reviewed' ? 'reviewed_at' : 
                    ($status === 'finalized' ? 'finalized_at' : null);
        
        $sql = "UPDATE payruns SET status = ?";
        $params = [$status];
        
        if ($field) {
            $sql .= ", $field = ?, $dateField = NOW()";
            $params[] = $this->userId;
        }
        
        $sql .= " WHERE id = ?";
        $params[] = $payrunId;
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }
    
    // Get active employees
    private function getActiveEmployees() {
        $sql = "SELECT id, first_name, last_name, basic_salary 
                FROM employees WHERE status = 'active'";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Get overtime amount (placeholder - implement based on your overtime tracking)
    private function getOvertimeAmount($employeeId) {
        // Implement overtime calculation logic
        return 0.00;
    }
    
    // Get bonus amount (placeholder)
    private function getBonusAmount($employeeId) {
        // Implement bonus calculation logic
        return 0.00;
    }
    
    // Get commission amount (placeholder)
    private function getCommissionAmount($employeeId) {
        // Implement commission calculation logic
        return 0.00;
    }
    
    // Update payrun totals
    private function updatePayrunTotals($payrunId) {
        $sql = "UPDATE payruns SET 
                total_gross_pay = (SELECT SUM(gross_pay) FROM payrun_details WHERE payrun_id = ?),
                total_deductions = (SELECT SUM(total_deductions) FROM payrun_details WHERE payrun_id = ?),
                total_net_pay = (SELECT SUM(net_pay) FROM payrun_details WHERE payrun_id = ?),
                employee_count = (SELECT COUNT(*) FROM payrun_details WHERE payrun_id = ?)
                WHERE id = ?";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$payrunId, $payrunId, $payrunId, $payrunId, $payrunId]);
    }
    
    // Get all pay runs
    public function getPayRuns() {
        $sql = "SELECT p.*, u.username as created_by_name 
                FROM payruns p 
                LEFT JOIN users u ON p.created_by = u.id 
                ORDER BY p.created_at DESC";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Get pay run details
    public function getPayRunDetails($payrunId) {
        $sql = "SELECT pd.*, e.first_name, e.last_name, e.employee_number 
                FROM payrun_details pd 
                JOIN employees e ON pd.employee_id = e.id 
                WHERE pd.payrun_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$payrunId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

// payrun_create.php - Create Pay Run Page
session_start();


// Check admin access
// if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
//     header('Location: login.php');
//     exit;
// }

$id = isset($_SESSION['user']['UserID']) ? $_SESSION['user']['UserID'] : null;

$payrun = new PayRun($pdo, $id);

if ($_POST) {
    $data = [
        'payrun_name' => $_POST['payrun_name'],
        'pay_period_start' => $_POST['pay_period_start'],
        'pay_period_end' => $_POST['pay_period_end'],
        'pay_frequency' => $_POST['pay_frequency'] ?? 'monthly'
    ];
    
    if ($payrun->createPayRun($data)) {
        $message = "Pay run created successfully!";
    } else {
        $error = "Failed to create pay run.";
    }
}
?>

