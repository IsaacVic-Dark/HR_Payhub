<?php

namespace App\Controllers;

class LeaveController {

    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Leave controller
     * Summary of fetchAllLeaves
     * @param mixed $pdo
     * @return array
     */
    public function fetchAllLeaves() {


        $stmt = $this->pdo->prepare("SELECT l.*, e.FirstName, e.LastName 
                               FROM leaves AS l 
                               JOIN employees AS e ON l.EmployeeID = e.EmployeeID 
                               LIMIT :limit OFFSET :offset");


        $stmt->execute();

        $leaves = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Admin leave controller
     * Summary of getEmployeeLeaves
     * @param mixed $pdo
     * @param mixed $employeeId
     */
    function getEmployeeLeaves($employeeId) {
        $stmt = $this->pdo->prepare("SELECT * FROM leaves WHERE EmployeeID = :id");
        $stmt->bindParam(':id', $employeeId, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    function alterLeaves($leaveId, $newStatus) {
        $stmt = $this->pdo->prepare("UPDATE leaves SET Status = :status WHERE LeaveID = :id");
        $stmt->bindParam(':status', $newStatus, \PDO::PARAM_STR);
        $stmt->bindParam(':id', $leaveId, \PDO::PARAM_INT);
        $stmt->execute();
    }


    /**
     * Employee profile controller
     * Summary of applyLeaveByID
     * @param mixed $pdo
     * @param mixed $leaveApplication
     * @return void
     */
    function applyLeaveByID($leaveApplication) {
        $stmt = $this->pdo->prepare("INSERT INTO leaves (
                EmployeeID, LeaveType, StartDate, EndDate, Status
            ) VALUES (
                :EmployeeID, :LeaveType, :StartDate, :EndDate, :Status
            )");

        $stmt->execute([
            ':EmployeeID' => $leaveApplication['id'],
            ':LeaveType' => $leaveApplication['LeaveType'],
            ':StartDate' => $leaveApplication['StartDate'],
            ':EndDate' => $leaveApplication['EndDate'],
            ':Status' => $leaveApplication['Status'],
        ]);
    }

    function checkLeaveStatus($id) {
        $stmt = $this->pdo->prepare("SELECT Status FROM leaves WHERE EmployeeID = :id ORDER BY LeaveID DESC LIMIT 1");
        $stmt->bindParam(':id', $id, \PDO::PARAM_INT);
        $stmt->execute();
        $status = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$status) {
            return "No leave application found.";
        }

        switch ($status['Status']) {
            case 'Pending':
                return "Leave application is awaiting HR action.";
            case 'aAccepted':
                return "Your leave application has been accepted.";
            case 'Rejected':
                return "Your leave application has been rejected.";
            default:
                return "Unknown leave status.";
        }
    }
}
