"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Filter, Search, Eye, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";
import {
  AttendanceDay,
  AttendanceFilters,
} from "@/services/api/attendance";
import { AttendanceViewDrawer } from "@/app/(dashboard)/attendance/components/attendance-view-drawer";
import { ManualPunchDialog } from "@/app/(dashboard)/attendance/components/manual-punch-dialog";

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  present: { color: "bg-green-100 text-green-800", label: "Present" },
  partial: { color: "bg-blue-100 text-blue-800", label: "Partial" },
  absent: { color: "bg-red-100 text-red-800", label: "Absent" },
  holiday: { color: "bg-purple-100 text-purple-800", label: "Holiday" },
  on_leave: { color: "bg-gray-100 text-gray-600", label: "On Leave" },
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
  if (minutes === undefined || minutes === null || minutes === 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(dateTimeStr?: string | null) {
  if (!dateTimeStr) return null;
  const d = new Date(dateTimeStr.replace(" ", "T"));
  if (isNaN(d.getTime())) return dateTimeStr;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ─── Small presentational pieces ────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { color: "bg-gray-100 text-gray-600", label: status };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// Reproduces the "10:00 AM ●----09h 50m----● 7:50 PM" timeline cell
function ClockInOutCell({ record }: { record: AttendanceDay }) {
  const clockIn = formatTime(record.check_in_time);
  const clockOut = formatTime(record.check_out_time);

  if (!clockIn) {
    return <span className="text-gray-400 text-xs">--</span>;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span className="font-medium text-gray-900">{clockIn}</span>
      <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
      <span className="border-t border-dashed border-gray-300 w-8 shrink-0" />
      <span className="text-gray-400 shrink-0">{formatMinutes(record.worked_minutes)}</span>
      <span className="border-t border-dashed border-gray-300 w-8 shrink-0" />
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${clockOut ? "bg-red-400" : "bg-gray-300"}`} />
      <span className="font-medium text-gray-900">{clockOut ?? "--"}</span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface AttendanceTableProps {
  records: AttendanceDay[];
  loading: boolean;
  error: string | null;
  fetchAttendance: (filters?: AttendanceFilters) => Promise<void>;
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({
  records,
  loading,
  error,
  fetchAttendance,
}) => {
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<AttendanceDay | null>(null);

  // Manual entry modal
  const [manualPunchOpen, setManualPunchOpen] = useState(false);

  useEffect(() => {
    fetchAttendance({ status: selectedStatus || undefined });
  }, [fetchAttendance, selectedStatus]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const fullName = [r.firstname, r.middlename, r.surname].filter(Boolean).join(" ").toLowerCase();
      return fullName.includes(searchTerm.toLowerCase());
    });
  }, [records, searchTerm]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("");
    setPage(1);
  };

  const hasActiveFilters = searchTerm || selectedStatus;

  const handleEditClick = (record: AttendanceDay) => {
    // TODO: wire up an attendance-correction modal against adjustDay() once designed
    const fullName = [record.firstname, record.middlename, record.surname].filter(Boolean).join(" ");
    toast.info(`Editing attendance for ${fullName} — coming soon`);
  };

  const columns: ColumnDef<AttendanceDay>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (record) => {
        const fullName = [record.firstname, record.middlename, record.surname].filter(Boolean).join(" ");
        return (
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
              <span className="font-medium text-gray-700">{getInitials(fullName)}</span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{fullName}</p>
              <p className="text-xs text-gray-500 truncate">
                {record.job_title?.title || "—"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "date",
      header: "Date",
      cell: (record) => (
        <span className="text-xs text-gray-700">
          {new Date(record.attendance_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "clock",
      header: "Clock-in & out",
      cell: (record) => <ClockInOutCell record={record} />,
    },
    {
      key: "overtime",
      header: "Overtime",
      cell: (record) => (
        <span className={record.overtime_minutes ? "font-medium text-amber-700" : "text-gray-400"}>
          {formatMinutes(record.overtime_minutes)}
        </span>
      ),
    },
    {
      key: "late",
      header: "Late",
      cell: (record) => (
        <span className={record.late_minutes ? "font-medium text-orange-700" : "text-gray-400"}>
          {formatMinutes(record.late_minutes)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (record) => <StatusBadge status={record.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (record) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => {
              setViewRecord(record);
              setDrawerOpen(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => handleEditClick(record)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const statuses = Object.keys(STATUS_CONFIG);

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white space-y-4">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Attendance</h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filter
              </button>
              <button
                onClick={() => setManualPunchOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Manual Entry
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Status</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_CONFIG[status].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          <DataTable
            data={paginated}
            columns={columns}
            pagination={{ page, limit, totalItems, totalPages }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={loading}
            emptyMessage={
              hasActiveFilters
                ? "No attendance records match your filters"
                : "No attendance records found"
            }
          />
        </div>
      </div>

      {/* Detail Drawer */}
      <AttendanceViewDrawer open={drawerOpen} onOpenChange={setDrawerOpen} record={viewRecord} />

      {/* Manual Entry Modal */}
      {user?.organization_id && (
        <ManualPunchDialog
          open={manualPunchOpen}
          onOpenChange={setManualPunchOpen}
          organizationId={user.organization_id}
          onSuccess={() => fetchAttendance({ status: selectedStatus || undefined })}
        />
      )}
    </>
  );
};

export default AttendanceTable;