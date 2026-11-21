"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Filter, RefreshCw, Search, X } from "lucide-react";
import { format } from "date-fns";
import { type DateRange } from "react-day-picker";
import { DataTable, type ColumnDef } from "@/components/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import { useUrlDrawer } from "@/hooks/use-url-drawer";
import {
  auditLogAPI,
  type AuditLogFilterOptions,
  type AuditLogFilters,
  type AuditLogType,
} from "@/services/api/audit-log";
import { AuditLogViewDrawer } from "./audit-log-view-drawer";
import {
  actionBadgeClass,
  entityDisplayName,
  entityLabel,
  humanize,
  parseDbDate,
  toApiDate,
  userDisplayName,
} from "./audit-utils";

const ALL = "all";

const AuditLogTable: React.FC = () => {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>(ALL);
  const [entityType, setEntityType] = useState<string>(ALL);
  const [userId, setUserId] = useState<string>(ALL);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [dateOpen, setDateOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [options, setOptions] = useState<AuditLogFilterOptions>({
    entity_types: [],
    actions: [],
    users: [],
  });

  // URL-driven drawer (?drawer=view&id=<audit_log_id>)
  const urlDrawer = useUrlDrawer<AuditLogType>({
    rows: logs,
    getId: (l) => l.id,
    rowsReady: !loading,
    enabled: !!orgId,
    fetchById: async (id) => {
      const r = await auditLogAPI.getAuditLogById(orgId!, Number(id));
      return r.success ? (r.data ?? null) : null;
    },
  });

  // Debounce free-text search and reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filter dropdown options
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    auditLogAPI.getFilterOptions(orgId).then((r) => {
      if (!cancelled && r.success && r.data) setOptions(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  const apiFilters: AuditLogFilters = useMemo(
    () => ({
      page,
      per_page: perPage,
      search: search || undefined,
      action: action !== ALL ? action : undefined,
      entity_type: entityType !== ALL ? entityType : undefined,
      user_id: userId !== ALL ? Number(userId) : undefined,
      date_from: dateRange?.from ? toApiDate(dateRange.from) : undefined,
      // a single clicked day means "that day only"
      date_to: dateRange?.from
        ? toApiDate(dateRange.to ?? dateRange.from)
        : undefined,
    }),
    [page, perPage, search, action, entityType, userId, dateRange]
  );

  const fetchLogs = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await auditLogAPI.getAuditLogs(orgId, apiFilters);
      if (res.success) {
        setLogs(Array.isArray(res.data) ? res.data : []);
        setTotalItems(res.metadata?.pagination?.total ?? 0);
        setTotalPages(res.metadata?.pagination?.total_pages ?? 0);
      } else {
        setError(res.error || "Failed to fetch audit logs");
        setLogs([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, apiFilters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshKey]);

  const hasActiveFilters =
    !!search ||
    action !== ALL ||
    entityType !== ALL ||
    userId !== ALL ||
    !!dateRange?.from;

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setAction(ALL);
    setEntityType(ALL);
    setUserId(ALL);
    setDateRange(undefined);
    setPage(1);
  };

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "dd MMM yyyy")} – ${format(dateRange.to, "dd MMM yyyy")}`
      : format(dateRange.from, "dd MMM yyyy")
    : "Any date";

  const columns: ColumnDef<AuditLogType>[] = [
    {
      key: "created_at",
      header: "When",
      cell: (log) => {
        const d = parseDbDate(log.created_at);
        return d ? (
          <div className="leading-tight">
            <div className="text-xs font-medium text-gray-900">
              {format(d, "dd MMM yyyy")}
            </div>
            <div className="text-xs text-gray-500">{format(d, "HH:mm:ss")}</div>
          </div>
        ) : (
          <span className="text-xs text-gray-500">{log.created_at}</span>
        );
      },
    },
    {
      key: "user",
      header: "User",
      cell: (log) => (
        <div className="leading-tight">
          <div className="text-xs font-medium text-gray-900">
            {userDisplayName(log)}
          </div>
          {log.user_role && (
            <div className="text-xs text-gray-500">{humanize(log.user_role)}</div>
          )}
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      cell: (log) => (
        <Badge className={actionBadgeClass(log.action)}>
          {humanize(log.action)}
        </Badge>
      ),
    },
    {
      key: "entity",
      header: "Record",
      cell: (log) => {
        const name = entityDisplayName(log);
        return (
          <div className="leading-tight">
            <div className="text-xs font-medium text-gray-900">
              {name ?? `${entityLabel(log.entity_type)} #${log.entity_id}`}
            </div>
            <div className="text-xs text-gray-500">
              {entityLabel(log.entity_type)}
              {name ? ` · #${log.entity_id}` : ""}
            </div>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (log) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => urlDrawer.show(log)}
          className="h-8 w-8 p-0"
          aria-label={`View audit log ${log.id}`}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900">Audit Logs</h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search user, action, record, details…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 pr-3 py-2 w-72 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters((s) => !s)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="h-9 text-xs"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Action
                  </label>
                  <Select
                    value={action}
                    onValueChange={(v) => {
                      setAction(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white text-xs">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent searchable searchPlaceholder="Search actions...">
                      <SelectGroup>
                        <SelectItem value={ALL}>All actions</SelectItem>
                        {options.actions.map((a) => (
                          <SelectItem key={a} value={a}>
                            {humanize(a)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Record Type
                  </label>
                  <Select
                    value={entityType}
                    onValueChange={(v) => {
                      setEntityType(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white text-xs">
                      <SelectValue placeholder="All record types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL}>All record types</SelectItem>
                        {options.entity_types.map((t) => (
                          <SelectItem key={t} value={t}>
                            {entityLabel(t)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    User
                  </label>
                  <Select
                    value={userId}
                    onValueChange={(v) => {
                      setUserId(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white text-xs">
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent searchable searchPlaceholder="Search users...">
                      <SelectGroup>
                        <SelectItem value={ALL}>All users</SelectItem>
                        {options.users.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {(u.full_name ?? "").trim() || u.email || `User #${u.id}`}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Date Range
                  </label>
                  <Popover open={dateOpen} onOpenChange={setDateOpen} modal={true}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start font-normal bg-white text-xs"
                      >
                        {dateLabel}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={(r) => {
                          setDateRange(r);
                          setPage(1);
                          if (r?.from && r?.to) setDateOpen(false);
                        }}
                        numberOfMonths={2}
                        disabled={{ after: new Date() }}
                        className="rounded-lg"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <X className="w-3 h-3" />
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          <DataTable
            data={logs}
            columns={columns}
            pagination={{
              page,
              limit: perPage,
              totalItems,
              totalPages,
            }}
            onPageChange={setPage}
            onLimitChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            loading={loading}
            error={error}
            emptyMessage={
              hasActiveFilters
                ? "No audit logs match your filters"
                : "No audit logs found"
            }
          />
        </div>
      </div>

      <AuditLogViewDrawer
        open={urlDrawer.open}
        onOpenChange={urlDrawer.onOpenChange}
        log={urlDrawer.record}
      />
    </>
  );
};

export default AuditLogTable;
