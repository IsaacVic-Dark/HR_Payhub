import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, User, CalendarDays, LogIn, LogOut } from "lucide-react";
import { AttendanceDay } from "@/services/api/attendance";

interface AttendanceViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AttendanceDay | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  present: { label: "Present", className: "bg-green-100 text-green-800 border-green-200" },
  partial: { label: "Partial", className: "bg-blue-100 text-blue-800 border-blue-200" },
  absent: { label: "Absent", className: "bg-red-100 text-red-800 border-red-200" },
  holiday: { label: "Holiday", className: "bg-purple-100 text-purple-800 border-purple-200" },
  on_leave: { label: "On Leave", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const APPROVAL_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Approval Pending", className: "bg-amber-100 text-amber-800 border-amber-200" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200" },
  not_required: { label: "No Approval Needed", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMinutes(minutes?: number | null) {
  if (minutes === undefined || minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(dateTimeStr?: string | null) {
  if (!dateTimeStr) return "—";
  const d = new Date(dateTimeStr.replace(" ", "T"));
  if (isNaN(d.getTime())) return dateTimeStr;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function AttendanceViewDrawer({ open, onOpenChange, record }: AttendanceViewDrawerProps) {
  if (!record) return null;

  const fullName = [record.firstname, record.middlename, record.surname].filter(Boolean).join(" ");
  const statusCfg = STATUS_CONFIG[record.status] ?? { label: record.status, className: "bg-gray-100 text-gray-600 border-gray-200" };
  const approvalCfg = record.approval_status ? APPROVAL_CONFIG[record.approval_status] : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className="h-full min-w-xl ml-auto bg-white"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        {/* ── Header ── */}
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {getInitials(fullName)}
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">{fullName}</DrawerTitle>
              <DrawerDescription>
                {record.job_title?.title || "—"} · {record.employee_number}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ── Employee Info ── */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm text-gray-700">
              <User className="h-4 w-4" /> Employee Information
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Full Name</span>
                <p className="font-medium mt-0.5">{fullName}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Employee Number</span>
                <p className="font-medium mt-0.5">{record.employee_number}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Job Title</span>
                <p className="font-medium mt-0.5">{record.job_title?.title || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Employee ID</span>
                <p className="font-medium mt-0.5">#{record.employee_id}</p>
              </div>
            </div>
          </div>

          {/* ── Day Summary ── */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm text-gray-700">
              <CalendarDays className="h-4 w-4" /> Day Overview
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 text-sm mb-3">
              <p className="text-gray-500 text-xs mb-1">Date</p>
              <p className="font-medium">{formatDate(record.attendance_date)}</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${statusCfg.className} border text-xs font-medium`}>
                {statusCfg.label}
              </Badge>
              {approvalCfg && (
                <Badge className={`${approvalCfg.className} border text-xs font-medium`}>
                  {approvalCfg.label}
                </Badge>
              )}
              {!!record.is_public_holiday && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 border text-xs font-medium">
                  Public Holiday
                </Badge>
              )}
              {!record.salary_included && (
                <Badge className="bg-red-50 text-red-700 border-red-200 border text-xs font-medium">
                  Not Yet Payable
                </Badge>
              )}
            </div>
          </div>

          {/* ── Clock details ── */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm text-gray-700">
              <Clock className="h-4 w-4" /> Clock Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <LogIn className="h-3.5 w-3.5 text-green-500" /> Check In
                </div>
                <p className="font-medium text-gray-900">{formatTime(record.check_in_time)}</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <LogOut className="h-3.5 w-3.5 text-red-400" /> Check Out
                </div>
                <p className="font-medium text-gray-900">{formatTime(record.check_out_time)}</p>
              </div>
            </div>
          </div>

          {/* ── Hours callout ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs text-indigo-500 font-medium">Worked</p>
              <p className="text-2xl font-bold text-indigo-700">{formatMinutes(record.worked_minutes)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-medium">Overtime</p>
              <p className="text-2xl font-bold text-amber-700">{formatMinutes(record.overtime_minutes)}</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-xs text-orange-600 font-medium">Late</p>
              <p className="text-2xl font-bold text-orange-700">{formatMinutes(record.late_minutes)}</p>
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t p-6">
          <DrawerClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}