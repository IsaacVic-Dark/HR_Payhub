"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  Mail,
  CheckCheck,
  Plus,
  ChevronDown,
  MoreHorizontal,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { EmployeeDrawer, EmployeeDrawerAdd, EmployeeDrawerEdit } from "@/app/employees/components/employee-drawer";
import { employeeAPI, EmployeeType } from "@/services/api/employee";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

export type Employee = {
  id: string;
  img: React.ReactNode;
  salary: number;
  status:
    | "deceased"
    | "retired"
    | "active"
    | "on leave"
    | "terminated"
    | "resigned"
    | "suspended"
    | "probation";
  name: string;
  position: string;
  department: string;
  p_email: string;
  email: string;
};

// Define the columns for the employee data table
export const columns: ColumnDef<Employee>[] = [
  {
    accessorKey: "img",
    header: ({ column }) => {
      return <Button variant="ghost">Profile</Button>;
    },
    cell: ({ row }) => <div className="">{row.getValue("img")}</div>,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return <Button variant="ghost">Name</Button>;
    },
    cell: ({ row }) => <EmployeeDrawer employee={row.original} />,
  },
  {
    accessorKey: "position",
    header: ({ column }) => {
      return <Button variant="ghost">Position</Button>;
    },
    cell: ({ row }) => <div className="">{row.getValue("position")}</div>,
  },
  {
    accessorKey: "department",
    header: ({ column }) => {
      return <Button variant="ghost">Department</Button>;
    },
    cell: ({ row }) => <div className="">{row.getValue("department")}</div>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Email
        </Button>
      );
    },
    cell: ({ row }) => <div className="lowercase">{row.getValue("email")}</div>,
  },
  {
    accessorKey: "salary",
    header: () => <div className="text-right">Salary</div>,
    cell: ({ row }) => {
      const salary = parseFloat(row.getValue("salary"));

      // Format the salary as a dollar salary
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(salary);

      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="capitalize">{row.getValue("status")}</div>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const employee = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <EmployeeDrawer employee={employee}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                View employee
              </DropdownMenuItem>
            </EmployeeDrawer>
            <EmployeeDrawerEdit employee={employee}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Edit employee
              </DropdownMenuItem>
            </EmployeeDrawerEdit>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              Delete employee
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function DataTableEmployees() {
  const { user } = useAuth(); // Get user from auth context
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // State management for employee data
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch employees data
  const fetchEmployeesData = React.useCallback(async () => {
    // Check if organization_id exists
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await employeeAPI.getEmployees(user.organization_id);

      if (response.success && response.data) {
        // Extract the employees array from the data property
        const employeesData = response.data.data || [];

        // Transform the data to match your Employee type
        const transformedEmployees: Employee[] = employeesData.map(
          (emp: EmployeeType) => ({
            id: emp.id.toString(),
            img: (
              <img
                src={emp.profileImage || "/profile.jpg"}
                alt="Profile"
                className="w-8 h-8 object-cover rounded-full ml-4"
              />
            ),
            salary: parseFloat(emp.base_salary),
            status: emp.status as Employee["status"],
            name: `${emp.first_name} ${emp.surname}`,
            position: emp.job_title,
            department: emp.department,
            p_email: emp.personal_email || "",
            email: emp.email,
          })
        );

        setEmployees(transformedEmployees);

        if (transformedEmployees.length > 0) {
          toast.success(`Loaded ${transformedEmployees.length} employees`);
        } else {
          console.warn("No employees found");
          toast.info("No employees found");
        }
      } else {
        // Handle "not found" scenario
        if (response.message?.includes("No employees found")) {
          setEmployees([]);
          setError(response.message);
        } else {
          setError(response.error || "Failed to fetch employees");
          setEmployees([]);
          toast.error(response.error || "Failed to fetch employees");
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch employees";
      console.error("Failed to fetch employees:", error);
      setError(errorMessage);
      setEmployees([]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id]);

  React.useEffect(() => {
    if (user?.organization_id) {
      fetchEmployeesData();
    }
  }, [fetchEmployeesData, user?.organization_id]);

  const table = useReactTable({
    data: employees,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // Show loading state while user is being fetched
  if (!user) {
    return (
      <div className="m-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading user information...</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="m-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading employees...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="m-6">
      {error ? (
        <div className="text-center py-16">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchEmployeesData}>Try Again</Button>
        </div>
      ) : !employees || employees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-600 mb-4">No employees yet.</p>
          <EmployeeDrawerAdd employees={employees}>
            <Button>
              <Plus />
              Add Employee
            </Button>
          </EmployeeDrawerAdd>
        </div>
      ) : (
        <>
          {/* Normal UI when employees exist */}
          <div className="flex items-center py-4">
            <Input
              placeholder="Filter names..."
              value={
                (table.getColumn("name")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("name")?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-2">
                  Columns <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <EmployeeDrawerAdd employees={employees}>
              <Button
                variant="outline"
                className="ml-auto"
                onSelect={(e) => e.preventDefault()}
              >
                <Plus />
                Add employee
              </Button>
            </EmployeeDrawerAdd>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <div className="text-muted-foreground flex-1 text-sm">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}