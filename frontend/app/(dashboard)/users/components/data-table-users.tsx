"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Filter, Search, Plus, Eye, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserActionDialog } from "@/app/(dashboard)/users/components/user-action-dialog";
import { UserViewDrawer } from "@/app/(dashboard)/users/components/user-view-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------
// TODO(backend): this file currently owns static mock data + local state.
// Once a real endpoint exists, swap this out the same way LeaveTable uses
// `services/api/leave.ts`:
//   - create `services/api/users.ts` exporting `userAPI` with
//     getUsers / createUser / updateUser / activateUser / deactivateUser
//   - replace the `useState<UserType[]>(MOCK_USERS)` below with a fetch
//     in a `useCallback` + `useEffect`, matching `fetchLeaves()` in
//     data-table-leaves.tsx
//   - replace the client-side filter/paginate logic below with API params,
//     matching `LeaveFilters` / `apiFilters` in data-table-leaves.tsx
// The component's shape (columns, dialogs, drawer) is already written to
// make that swap a drop-in change.
// -----------------------------------------------------------------------

export type UserRole =
  | "super_admin"
  | "admin"
  | "hr_manager"
  | "hr_officer"
  | "payroll_manager"
  | "payroll_officer"
  | "finance_manager"
  | "auditor"
  | "department_manager"
  | "employee";

export type UserStatus = "active" | "inactive";

export interface UserType {
  id: number;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  department: string | null;
  status: UserStatus;
  last_login: string | null; // ISO string
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr_manager: "HR Manager",
  hr_officer: "HR Officer",
  payroll_manager: "Payroll Manager",
  payroll_officer: "Payroll Officer",
  finance_manager: "Finance Manager",
  auditor: "Auditor",
  department_manager: "Department Manager",
  employee: "Employee",
};

export const MOCK_USERS: UserType[] = [
  {
    id: 1,
    full_name: "Amina Njeri",
    username: "amina.njeri",
    email: "amina.njeri@example.com",
    role: "super_admin",
    department: "Executive",
    status: "active",
    last_login: "2026-07-30T08:12:00",
    created_at: "2025-01-14T09:00:00",
    updated_at: "2026-07-30T08:12:00",
  },
  {
    id: 2,
    full_name: "Brian Otieno",
    username: "brian.otieno",
    email: "brian.otieno@example.com",
    role: "admin",
    department: "IT",
    status: "active",
    last_login: "2026-07-29T14:45:00",
    created_at: "2025-02-03T09:00:00",
    updated_at: "2026-07-29T14:45:00",
  },
  {
    id: 3,
    full_name: "Cynthia Wambui",
    username: "cynthia.wambui",
    email: "cynthia.wambui@example.com",
    role: "hr_manager",
    department: "Human Resources",
    status: "active",
    last_login: "2026-07-28T11:20:00",
    created_at: "2025-03-18T09:00:00",
    updated_at: "2026-07-28T11:20:00",
  },
  {
    id: 4,
    full_name: "David Kimani",
    username: "david.kimani",
    email: "david.kimani@example.com",
    role: "hr_officer",
    department: "Human Resources",
    status: "inactive",
    last_login: "2026-05-02T10:05:00",
    created_at: "2025-04-01T09:00:00",
    updated_at: "2026-05-10T09:00:00",
  },
  {
    id: 5,
    full_name: "Esther Achieng",
    username: "esther.achieng",
    email: "esther.achieng@example.com",
    role: "payroll_manager",
    department: "Finance",
    status: "active",
    last_login: "2026-07-31T07:55:00",
    created_at: "2025-01-22T09:00:00",
    updated_at: "2026-07-31T07:55:00",
  },
  {
    id: 6,
    full_name: "Felix Mwangi",
    username: "felix.mwangi",
    email: "felix.mwangi@example.com",
    role: "payroll_officer",
    department: "Finance",
    status: "active",
    last_login: "2026-07-27T16:30:00",
    created_at: "2025-05-09T09:00:00",
    updated_at: "2026-07-27T16:30:00",
  },
  {
    id: 7,
    full_name: "Grace Wanjiru",
    username: "grace.wanjiru",
    email: "grace.wanjiru@example.com",
    role: "finance_manager",
    department: "Finance",
    status: "active",
    last_login: "2026-07-25T13:10:00",
    created_at: "2025-01-30T09:00:00",
    updated_at: "2026-07-25T13:10:00",
  },
  {
    id: 8,
    full_name: "Hassan Ali",
    username: "hassan.ali",
    email: "hassan.ali@example.com",
    role: "auditor",
    department: "Compliance",
    status: "inactive",
    last_login: "2026-03-14T09:40:00",
    created_at: "2024-11-11T09:00:00",
    updated_at: "2026-03-20T09:00:00",
  },
  {
    id: 9,
    full_name: "Irene Chebet",
    username: "irene.chebet",
    email: "irene.chebet@example.com",
    role: "department_manager",
    department: "Operations",
    status: "active",
    last_login: "2026-07-30T17:02:00",
    created_at: "2025-06-06T09:00:00",
    updated_at: "2026-07-30T17:02:00",
  },
];

interface UserFormState {
  full_name: string;
  username: string;
  email: string;
  role: UserRole | "";
  department: string;
}

const EMPTY_FORM: UserFormState = {
  full_name: "",
  username: "",
  email: "",
  role: "",
  department: "",
};

const UserTable: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>(MOCK_USERS);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog state (edit / activate / deactivate)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [actionType, setActionType] = useState<
    "edit" | "activate" | "deactivate"
  >("edit");
  const [editFormData, setEditFormData] = useState<UserFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewUser, setViewUser] = useState<UserType | null>(null);

  // Add User dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addFormData, setAddFormData] = useState<UserFormState>(EMPTY_FORM);
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>(
    {}
  );

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Client-side pagination (swap for server pagination once an API exists)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Reset edit form whenever the dialog opens for a different user
  useEffect(() => {
    if (dialogOpen && actionType === "edit" && selectedUser) {
      setEditFormData({
        full_name: selectedUser.full_name,
        username: selectedUser.username,
        email: selectedUser.email,
        role: selectedUser.role,
        department: selectedUser.department || "",
      });
      setFormErrors({});
    }
  }, [dialogOpen, actionType, selectedUser]);

  // Reset add form whenever the add dialog closes
  useEffect(() => {
    if (!addDialogOpen) {
      setAddFormData(EMPTY_FORM);
      setAddFormErrors({});
    }
  }, [addDialogOpen]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !term ||
        u.full_name.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term);
      const matchesRole = !selectedRole || u.role === selectedRole;
      const matchesStatus = !selectedStatus || u.status === selectedStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, selectedRole, selectedStatus]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedRole, selectedStatus]);

  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * limit,
    (page - 1) * limit + limit
  );

  const hasActiveFilters = searchTerm || selectedRole || selectedStatus;

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedRole("");
    setSelectedStatus("");
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const getRoleBadge = (role: UserRole) => (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
      {ROLE_LABELS[role]}
    </span>
  );

  const getStatusBadge = (status: UserStatus) => {
    const config =
      status === "active"
        ? { color: "bg-green-100 text-green-800", label: "Active" }
        : { color: "bg-gray-100 text-gray-800", label: "Inactive" };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  const formatLastLogin = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleViewClick = (user: UserType) => {
    setViewUser(user);
    setDrawerOpen(true);
  };

  const handleEditClick = (user: UserType) => {
    setSelectedUser(user);
    setActionType("edit");
    setDialogOpen(true);
  };

  const handleStatusToggleClick = (user: UserType) => {
    setSelectedUser(user);
    setActionType(user.status === "active" ? "deactivate" : "activate");
    setDialogOpen(true);
  };

  const validateForm = (form: UserFormState): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!form.full_name.trim()) errors.full_name = "Full name is required";
    if (!form.username.trim()) errors.username = "Username is required";
    if (!form.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      errors.email = "Enter a valid email address";
    }
    if (!form.role) errors.role = "Please select a role";
    return errors;
  };

  const handleConfirmAction = () => {
    if (!selectedUser) return;

    if (actionType === "edit") {
      const errors = validateForm(editFormData);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      setActionLoading(true);
      // TODO(backend): replace with `userAPI.updateUser(orgId, selectedUser.id, editFormData)`
      setTimeout(() => {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id
              ? {
                  ...u,
                  full_name: editFormData.full_name,
                  username: editFormData.username,
                  email: editFormData.email,
                  role: editFormData.role as UserRole,
                  department: editFormData.department || null,
                  updated_at: new Date().toISOString(),
                }
              : u
          )
        );
        toast.success("User updated (mock) — connect a backend to persist this");
        setActionLoading(false);
        setDialogOpen(false);
      }, 400);
      return;
    }

    // activate / deactivate
    setActionLoading(true);
    const nextStatus: UserStatus =
      actionType === "activate" ? "active" : "inactive";
    // TODO(backend): replace with `userAPI.activateUser` / `userAPI.deactivateUser`
    setTimeout(() => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, status: nextStatus, updated_at: new Date().toISOString() }
            : u
        )
      );
      toast.success(
        `User ${actionType === "activate" ? "activated" : "deactivated"} (mock)`
      );
      setActionLoading(false);
      setDialogOpen(false);
    }, 400);
  };

  const handleAddUser = () => {
    const errors = validateForm(addFormData);
    if (Object.keys(errors).length > 0) {
      setAddFormErrors(errors);
      return;
    }

    setAddLoading(true);
    // TODO(backend): replace with `userAPI.createUser(orgId, addFormData)`
    setTimeout(() => {
      const nextId = Math.max(0, ...users.map((u) => u.id)) + 1;
      const now = new Date().toISOString();
      setUsers((prev) => [
        {
          id: nextId,
          full_name: addFormData.full_name,
          username: addFormData.username,
          email: addFormData.email,
          role: addFormData.role as UserRole,
          department: addFormData.department || null,
          status: "active",
          last_login: null,
          created_at: now,
          updated_at: now,
        },
        ...prev,
      ]);
      toast.success("User created (mock) — connect a backend to persist this");
      setAddLoading(false);
      setAddDialogOpen(false);
    }, 400);
  };

  const renderRoleSelect = (
    value: string,
    onChange: (value: UserRole) => void,
    error?: string
  ) => (
    <Select value={value} onValueChange={(v) => onChange(v as UserRole)}>
      <SelectTrigger className={cn("w-full", error && "border-red-500")}>
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Roles</SelectLabel>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  const columns: ColumnDef<UserType>[] = [
    {
      key: "user",
      header: "User",
      cell: (user) => (
        <div>
          <p className="font-medium text-gray-900">{user.full_name}</p>
          <p className="text-xs text-gray-500">@{user.username}</p>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (user) => user.email,
    },
    {
      key: "role",
      header: "Role",
      cell: (user) => getRoleBadge(user.role),
    },
    {
      key: "department",
      header: "Department",
      cell: (user) => user.department || "—",
    },
    {
      key: "status",
      header: "Status",
      cell: (user) => getStatusBadge(user.status),
    },
    {
      key: "last_login",
      header: "Last Login",
      cell: (user) => formatLastLogin(user.last_login),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (user) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(user)}
            className="h-8 w-8 p-0"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditClick(user)}
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            title="Edit user"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleStatusToggleClick(user)}
            className={cn(
              "h-8 w-8 p-0",
              user.status === "active"
                ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                : "text-green-600 hover:text-green-700 hover:bg-green-50"
            )}
            title={user.status === "active" ? "Deactivate user" : "Activate user"}
          >
            <Power className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Users</h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, username, or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add User
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Roles</option>
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
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

          <DataTable
            data={paginatedUsers}
            columns={columns}
            pagination={{
              page,
              limit,
              totalItems,
              totalPages,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={false}
            error={null}
            emptyMessage={
              hasActiveFilters ? "No users match your filters" : "No users found"
            }
          />
        </div>
      </div>

      {/* Edit / Activate / Deactivate dialog */}
      <UserActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={actionType}
        userName={selectedUser?.full_name}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      >
        {actionType === "edit" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editFormData.full_name}
                onChange={(e) => {
                  setEditFormData((prev) => ({
                    ...prev,
                    full_name: e.target.value,
                  }));
                  setFormErrors((prev) => ({ ...prev, full_name: "" }));
                }}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  formErrors.full_name ? "border-red-500" : "border-gray-300"
                )}
                disabled={actionLoading}
              />
              {formErrors.full_name && (
                <p className="text-xs text-red-500">{formErrors.full_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editFormData.username}
                onChange={(e) => {
                  setEditFormData((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }));
                  setFormErrors((prev) => ({ ...prev, username: "" }));
                }}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  formErrors.username ? "border-red-500" : "border-gray-300"
                )}
                disabled={actionLoading}
              />
              {formErrors.username && (
                <p className="text-xs text-red-500">{formErrors.username}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={editFormData.email}
                onChange={(e) => {
                  setEditFormData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }));
                  setFormErrors((prev) => ({ ...prev, email: "" }));
                }}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  formErrors.email ? "border-red-500" : "border-gray-300"
                )}
                disabled={actionLoading}
              />
              {formErrors.email && (
                <p className="text-xs text-red-500">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Role <span className="text-red-500">*</span>
              </label>
              {renderRoleSelect(
                editFormData.role,
                (role) => {
                  setEditFormData((prev) => ({ ...prev, role }));
                  setFormErrors((prev) => ({ ...prev, role: "" }));
                },
                formErrors.role
              )}
              {formErrors.role && (
                <p className="text-xs text-red-500">{formErrors.role}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Department (Optional)
              </label>
              <input
                type="text"
                value={editFormData.department}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={actionLoading}
              />
            </div>
          </div>
        )}
      </UserActionDialog>

      {/* Add User dialog */}
      <UserActionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        action="add"
        onConfirm={handleAddUser}
        loading={addLoading}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addFormData.full_name}
              onChange={(e) => {
                setAddFormData((prev) => ({
                  ...prev,
                  full_name: e.target.value,
                }));
                setAddFormErrors((prev) => ({ ...prev, full_name: "" }));
              }}
              placeholder="e.g., Jane Doe"
              className={cn(
                "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                addFormErrors.full_name ? "border-red-500" : "border-gray-300"
              )}
              disabled={addLoading}
            />
            {addFormErrors.full_name && (
              <p className="text-xs text-red-500">{addFormErrors.full_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addFormData.username}
              onChange={(e) => {
                setAddFormData((prev) => ({
                  ...prev,
                  username: e.target.value,
                }));
                setAddFormErrors((prev) => ({ ...prev, username: "" }));
              }}
              placeholder="e.g., jane.doe"
              className={cn(
                "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                addFormErrors.username ? "border-red-500" : "border-gray-300"
              )}
              disabled={addLoading}
            />
            {addFormErrors.username && (
              <p className="text-xs text-red-500">{addFormErrors.username}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={addFormData.email}
              onChange={(e) => {
                setAddFormData((prev) => ({ ...prev, email: e.target.value }));
                setAddFormErrors((prev) => ({ ...prev, email: "" }));
              }}
              placeholder="e.g., jane.doe@example.com"
              className={cn(
                "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                addFormErrors.email ? "border-red-500" : "border-gray-300"
              )}
              disabled={addLoading}
            />
            {addFormErrors.email && (
              <p className="text-xs text-red-500">{addFormErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Role <span className="text-red-500">*</span>
            </label>
            {renderRoleSelect(
              addFormData.role,
              (role) => {
                setAddFormData((prev) => ({ ...prev, role }));
                setAddFormErrors((prev) => ({ ...prev, role: "" }));
              },
              addFormErrors.role
            )}
            {addFormErrors.role && (
              <p className="text-xs text-red-500">{addFormErrors.role}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Department (Optional)
            </label>
            <input
              type="text"
              value={addFormData.department}
              onChange={(e) =>
                setAddFormData((prev) => ({
                  ...prev,
                  department: e.target.value,
                }))
              }
              placeholder="e.g., Finance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={addLoading}
            />
          </div>
        </div>
      </UserActionDialog>

      <UserViewDrawer open={drawerOpen} onOpenChange={setDrawerOpen} user={viewUser} />
    </>
  );
};

export default UserTable;