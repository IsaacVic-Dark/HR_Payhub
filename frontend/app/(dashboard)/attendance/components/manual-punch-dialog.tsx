"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { attendanceAPI, PunchType } from "@/services/api/attendance";
import { employeeAPI, MinimalEmployeeType } from "@/services/api/employee";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ManualPunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: number;
  // Called after a successful manual punch so the parent can refetch the list.
  onSuccess: () => void;
}

const todayDate = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

export function ManualPunchDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: ManualPunchDialogProps) {
  const [employees, setEmployees] = useState<MinimalEmployeeType[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [employeeId, setEmployeeId] = useState<string>("");
  const [punchType, setPunchType] = useState<PunchType>("check_in");
  const [punchDate, setPunchDate] = useState(todayDate());
  const [punchTime, setPunchTime] = useState(nowTime());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch the minimal employee list once the dialog is opened.
  useEffect(() => {
    if (!open || !organizationId) return;

    const loadEmployees = async () => {
      setEmployeesLoading(true);
      const result = await employeeAPI.getEmployeesMinimal(organizationId);
      if (result.success && result.data) {
        setEmployees(result.data);
      } else {
        toast.error(result.error || "Failed to load employees");
      }
      setEmployeesLoading(false);
    };

    loadEmployees();
  }, [open, organizationId]);

  // Reset the form each time the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setEmployeeId("");
      setPunchType("check_in");
      setPunchDate(todayDate());
      setPunchTime(nowTime());
      setReason("");
    }
  }, [open]);

  const isValid = employeeId && punchDate && punchTime && reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error("Please fill in all fields before submitting");
      return;
    }

    setSubmitting(true);
    try {
      const punch_time = `${punchDate} ${punchTime}:00`;

      const result = await attendanceAPI.manualPunch(
        organizationId,
        parseInt(employeeId),
        {
          punch_type: punchType,
          punch_time,
          source: "manual",
          remarks: reason,
          reason,
        },
      );

      if (result.success) {
        toast.success(result.message || "Manual punch recorded successfully");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || result.message || "Failed to record manual punch");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Manual Attendance Entry</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          {/* Employee */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Employee
            </label>
            <Select
              value={employeeId}
              onValueChange={(value) => setEmployeeId(value)}
              disabled={employeesLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={employeesLoading ? "Loading employees..." : "Select employee"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Employees</SelectLabel>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {[emp.firstname, emp.middlename, emp.surname].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Punch type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Punch Type
            </label>
            <Select
              value={punchType}
              onValueChange={(value) => setPunchType(value as PunchType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="check_in">Check In</SelectItem>
                  <SelectItem value="check_out">Check Out</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={punchDate}
                onChange={(e) => setPunchDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Time
              </label>
              <input
                type="time"
                value={punchTime}
                onChange={(e) => setPunchTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Reason (also sent as remarks) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Biometric device offline, entered manually"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-800">
              This entry will be recorded as a manual punch (source: manual) and
              audit-logged against your account.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            disabled={submitting || !isValid}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Save Entry"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}