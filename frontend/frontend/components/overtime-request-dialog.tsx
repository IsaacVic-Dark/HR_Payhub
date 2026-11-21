"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { employeeAPI, MinimalEmployeeType } from "@/services/api/employee";
import {
  overtimeRequestAPI,
  type OvertimeRequestMeta,
} from "@/services/api/overtime-request";

interface OvertimeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: number;
  /**
   * "self"  – employee portal: the request is always for the logged-in employee.
   * "admin" – approvals page (admin / hr_manager): pick any employee, including yourself.
   */
  mode: "self" | "admin";
  /** The logged-in user's own employee id (used for the "Myself" shortcut in admin mode). */
  currentEmployeeId?: number | null;
  /** Called after a successful submit so the parent can refetch. */
  onSuccess: () => void;
}

const MAX_REASON_LENGTH = 1000;

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const localToday = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const nowHHmm = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function OvertimeRequestDialog({
  open,
  onOpenChange,
  organizationId,
  mode,
  currentEmployeeId,
  onSuccess,
}: OvertimeRequestDialogProps) {
  const [meta, setMeta] = useState<OvertimeRequestMeta | null>(null);

  const [employees, setEmployees] = useState<MinimalEmployeeType[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [employeeComboOpen, setEmployeeComboOpen] = useState(false);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const today = meta?.today ?? localToday();
  const minDate = meta?.min_date;

  // Reset the form + load the allowed date window each time the modal opens.
  useEffect(() => {
    if (!open || !organizationId) return;

    setEmployeeId("");
    setEmployeeComboOpen(false);
    setDate(localToday());
    setStartTime("");
    setEndTime("");
    setReason("");

    let cancelled = false;
    (async () => {
      const res = await overtimeRequestAPI.getMeta(organizationId);
      if (cancelled) return;
      if (res.success && res.data) {
        setMeta(res.data);
        setDate(res.data.today);
      } else {
        toast.error(res.error || "Failed to load the overtime request window");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  // Admin mode: load the employee picker list.
  useEffect(() => {
    if (!open || mode !== "admin" || !organizationId) return;
    let cancelled = false;
    (async () => {
      setEmployeesLoading(true);
      const res = await employeeAPI.getEmployeesMinimal(organizationId);
      if (cancelled) return;
      if (res.success && res.data) {
        setEmployees(res.data);
      } else {
        toast.error(res.error || "Failed to load employees");
      }
      setEmployeesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, organizationId]);

  const employeeName = (emp: MinimalEmployeeType) =>
    [emp.firstname, emp.middlename, emp.surname].filter(Boolean).join(" ");
  const selectedEmployee = employees.find((e) => e.id.toString() === employeeId);
  const myself = currentEmployeeId
    ? employees.find((e) => e.id === currentEmployeeId)
    : undefined;

  // ---- Live validation (the backend re-checks all of this) ------------------
  const validation = useMemo(() => {
    const errors: { date?: string; time?: string } = {};

    if (date) {
      if (date > today) errors.date = "Date cannot be in the future.";
      else if (minDate && date < minDate)
        errors.date = `Date cannot be earlier than ${minDate} (start of the current pay period).`;
    }

    let minutes = 0;
    if (startTime && endTime) {
      minutes = toMinutes(endTime) - toMinutes(startTime);
      if (minutes <= 0) {
        errors.time = "End time must be after start time.";
        minutes = 0;
      } else if (date === today && endTime > nowHHmm()) {
        errors.time = "End time cannot be in the future.";
      }
    }

    return { errors, minutes };
  }, [date, startTime, endTime, today, minDate]);

  const hasEmployee = mode === "self" || !!employeeId;
  const isValid =
    hasEmployee &&
    !!date &&
    !!startTime &&
    !!endTime &&
    reason.trim().length > 0 &&
    !validation.errors.date &&
    !validation.errors.time &&
    validation.minutes > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const res = await overtimeRequestAPI.submitRequest(organizationId, {
        ...(mode === "admin" ? { employee_id: parseInt(employeeId) } : {}),
        date,
        start_time: startTime,
        end_time: endTime,
        reason: reason.trim(),
      });

      if (res.success) {
        toast.success(res.message || "Overtime request submitted");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error || res.message || "Failed to submit overtime request");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Overtime</DialogTitle>
          <DialogDescription>
            {mode === "self"
              ? "Submit the overtime you worked. It goes to an administrator for approval."
              : "Raise overtime for an employee (or yourself). It is created as pending and must be approved by an administrator."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Employee (admin mode only) */}
          {mode === "admin" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-700">Employee</Label>
                {myself && employeeId !== myself.id.toString() && (
                  <button
                    type="button"
                    onClick={() => setEmployeeId(myself.id.toString())}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Select myself
                  </button>
                )}
              </div>
              <Popover open={employeeComboOpen} onOpenChange={setEmployeeComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeeComboOpen}
                    disabled={employeesLoading}
                    className="w-full justify-between font-normal text-sm px-3 py-2 h-auto border-gray-300"
                  >
                    {employeesLoading
                      ? "Loading employees..."
                      : selectedEmployee
                        ? employeeName(selectedEmployee) +
                        (selectedEmployee.id === currentEmployeeId ? " (you)" : "")
                        : "Select employee"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employee..." />
                    <CommandList>
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={`${emp.id} ${employeeName(emp)} ${emp.personalemail ?? ""}`}
                            onSelect={() => {
                              setEmployeeId(emp.id.toString());
                              setEmployeeComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                employeeId === emp.id.toString() ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col">
                              <span>
                                {employeeName(emp)}
                                {emp.id === currentEmployeeId && (
                                  <span className="ml-1 text-xs text-gray-400">(you)</span>
                                )}
                              </span>
                              {emp.personalemail && (
                                <span className="text-xs text-gray-500">{emp.personalemail}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="ot-date" className="text-xs text-gray-700">
              Date
            </Label>
            <Input
              id="ot-date"
              type="date"
              value={date}
              min={minDate}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
            {validation.errors.date ? (
              <p className="text-xs text-red-600">{validation.errors.date}</p>
            ) : meta ? (
              <p className="text-xs text-gray-500">
                Allowed: {meta.min_date} to {meta.today} ({meta.period_label})
              </p>
            ) : null}
          </div>

          {/* Start / end time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ot-start" className="text-xs text-gray-700">
                Start time
              </Label>
              <Input
                id="ot-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ot-end" className="text-xs text-gray-700">
                End time
              </Label>
              <Input
                id="ot-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {validation.errors.time ? (
            <p className="text-xs text-red-600 -mt-1">{validation.errors.time}</p>
          ) : validation.minutes > 0 ? (
            <p className="text-xs text-gray-600 -mt-1">
              Duration: <span className="font-medium">{formatDuration(validation.minutes)}</span>
            </p>
          ) : null}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="ot-reason" className="text-xs text-gray-700">
              Reason
            </Label>
            <Textarea
              id="ot-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
              rows={3}
              placeholder="e.g. Month-end close, system migration, covering a colleague"
              className="resize-none"
            />
            <p className="text-right text-[11px] text-gray-400">
              {reason.length}/{MAX_REASON_LENGTH}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              One overtime request per day. The request is sent to Overtime Approvals, and the rate is
              applied by the approver.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !isValid}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
