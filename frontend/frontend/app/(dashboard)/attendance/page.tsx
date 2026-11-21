"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { UserCheck, Clock4, Plane, UserX } from "lucide-react";
import AttendanceTable from "@/app/(dashboard)/attendance/components/data-table-attendance";
import { useAuth } from "@/lib/AuthContext";
import {
  attendanceAPI,
  AttendanceDay,
  AttendanceDashboardMetadata,
  AttendanceFilters,
} from "@/services/api/attendance";

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Page() {
  const { user } = useAuth();

  const [records, setRecords] = useState<AttendanceDay[]>([]);
  const [metadata, setMetadata] = useState<AttendanceDashboardMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(
    async (filters: AttendanceFilters = {}) => {
      if (!user?.organization_id) return;

      setLoading(true);
      setError(null);
      try {
        const defaultDate = getTodayDateString();
        const finalFilters: AttendanceFilters = {
          date_from: defaultDate,
          date_to: defaultDate,
          ...filters,
        };
        const result = await attendanceAPI.getAttendance(user.organization_id, finalFilters);

        if (result.success && result.data) {
          setRecords(result.data);
          setMetadata(result.metadata ?? null);
        } else {
          setError(result.error || result.message || "Failed to fetch attendance");
          setRecords([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setRecords([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.organization_id],
  );

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const cardDetails: CardDetail[] = [
    {
      title: "Present Today",
      value: (metadata?.present_count ?? 0).toString(),
      change: `${metadata?.total_employees ?? 0} Total Employees`,
      changeIcon: <UserCheck className="h-4 w-4 text-green-600" />,
      description: "Employees who have clocked in today.",
      footerText: "Updated in real-time",
    },
    {
      title: "Late Entry",
      value: (metadata?.late_count ?? 0).toString(),
      change: metadata?.dashboard_date ?? "",
      changeIcon: <Clock4 className="h-4 w-4 text-orange-500" />,
      description: "Employees who arrived after scheduled start.",
      footerText: "Based on shift schedule",
    },
    {
      title: "On Leave",
      value: (metadata?.on_leave_count ?? 0).toString().padStart(2, "0"),
      change: "Approved Leave",
      changeIcon: <Plane className="h-4 w-4 text-blue-500" />,
      description: "Employees on approved leave today.",
      footerText: "Cross-referenced with leave requests",
    },
    {
      title: "Absent",
      value: (metadata?.absent_count ?? 0).toString().padStart(2, "0"),
      change: "Without Informing",
      changeIcon: <UserX className="h-4 w-4 text-red-500" />,
      description: "Employees absent without approved leave.",
      footerText: "Flagged for HR review",
    },
  ];

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="mt-4 mx-6 space-y-2">
            <h1 className="text-2xl font-medium">Employee Attendance</h1>
            <p className="text-base text-muted-foreground">
              Analyse attendance records of employees
            </p>
          </div>
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
              <SectionCards details={cardDetails} loading={loading} error={error} />
            </div>
            <AttendanceTable
              records={records}
              loading={loading}
              error={error}
              fetchAttendance={fetchAttendance}
            />
          </div>
        </div>
      </div>
    </>
  );
}