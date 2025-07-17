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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type Employee = {
  id: string;
  img: React.ReactNode;
  salary: number;
  status: "pending" | "retired" | "active" | "on leave";
  name: string;
  position: string;
  department: string;
  email: string;
};

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
          {/* <ArrowUpDown /> */}
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
  // State management for table functionality
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // State management for employee data
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch employees data
  React.useEffect(() => {
    const fetchEmployeesData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("http://localhost:8000/api/v1/employees");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        console.log("Fetched employees:", responseData);

        // Extract the employees array from the data property
        const employeesData = responseData.data || [];

        // Transform the data to match your Employee type
        const transformedEmployees: Employee[] = employeesData.map(
          (emp: any) => ({
            id: emp.id.toString(),
            img: (
              <img
                src={emp.profileImage || "/profile.jpg"}
                alt="Profile"
                className="w-8 h-8 object-cover rounded-full ml-4"
              />
            ),
            salary: parseFloat(emp.salary),
            status: "active" as const, // You might want to derive this from your data
            name: `${emp.f_name} ${emp.l_name}`,
            position: emp.position,
            department: emp.department,
            email: emp.email,
          })
        );

        setEmployees(transformedEmployees);

        if (transformedEmployees.length > 0) {
          console.log("Employees fetched successfully:", transformedEmployees);
        } else {
          console.warn("No employees found");
        }
      } catch (error) {
        console.error("Failed to fetch employees:", error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch employees"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeesData();
  }, []);

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

  // Error state
  if (error) {
    return (
      <div className="m-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error loading employees:</p>
            <p className="text-sm text-gray-600">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="m-6">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter names..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
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
              .map((column) => {
                return (
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
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" className="ml-auto">
          <Plus />
          Add employee
        </Button>
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
    </div>
  );
}

function EmployeeDrawer({
  employee,
  children,
}: {
  employee: Employee;
  children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        {children || (
          <Button variant="link" className="p-0 h-auto">
            {employee.name}
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent className="w-[400px] sm:w-[540px]">
        <div className="bg-opacity-50 flex items-center justify-center">
          <div className="bg-white">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-small text-gray-500 bg-blue-100/50 p-2 rounded">
                  EMPLOYEE DETAILS
                </p>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </Button>
              </DrawerClose>
            </div>

            <div className="p-6">
              <div className="flex items-start space-x-4 mb-8 bg-blue-100/50 p-4 rounded-lg">
                <div className="relative">
                  <img
                    src="/profile.jpg"
                    alt="No photo"
                    className="w-16 h-16 object-cover rounded-full"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-sm text-gray-500">{employee.id}</span>
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-1">
                    {employee.name}
                  </h3>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm text-gray-600">
                      Product Designer (Remote)
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full border-2 border-white">
                    <CheckCheck size={16} />
                    Active
                  </span>
                </div>

                <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md bg-gray-50">
                  <span className="flex items-center space-x-2">
                    <span>Edit</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
                    </svg>
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      ></path>
                    </svg>
                    <span className="text-sm text-gray-500">Department</span>
                    <span className="text-sm font-medium text-gray-800">
                      {employee.department}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6"
                      ></path>
                    </svg>
                    <span className="text-sm text-gray-500">Employment</span>
                    <span className="text-sm font-medium text-gray-800">
                      Full Time
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                    </svg>

                    <span className="text-sm text-gray-500">Email</span>
                    <span className="text-sm font-medium text-gray-800">
                      {employee.email}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      ></path>
                    </svg>
                    <span className="text-sm text-gray-500">Role</span>
                    <span className="text-sm font-medium text-gray-800">
                      {employee.position}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                      <path d="M12 18V6" />
                    </svg>

                    <span className="text-sm text-gray-500">Salary</span>
                    <span className="text-sm font-medium text-gray-800">
                      {employee.salary}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  Attendance Summary
                </h4>
                <div className="grid grid-cols-4 gap-4 border rounded-lg">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">
                      Year of Employment
                    </p>
                    <p className="text-lg font-semibold text-gray-800">2021</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">
                      Total Present Days
                    </p>
                    <p className="text-lg font-semibold text-gray-800">
                      1,298 days
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">
                      Total Absent Days
                    </p>
                    <p className="text-lg font-semibold text-gray-800">
                      30 Days
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">
                      Total Leave Days
                    </p>
                    <p className="text-lg font-semibold text-gray-800">
                      423 Days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function EmployeeDrawerAdd({ employee }: { employee: Employee }) {
  const isMobile = useIsMobile();
  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="p-0 h-auto">
          {employee.name}
        </Button>
      </DrawerTrigger>
      {/* <DrawerTrigger asChild>
        {children || (
          <Button variant="link" className="p-0 h-auto">
            {employee.name}
          </Button>
        )}
      </DrawerTrigger> */}
      <DrawerContent>
        <DrawerHeader>
          <div className="relative">
            <img
              src="/profile.jpg"
              alt="Employee Photo"
              className="h-52 w-full object-cover rounded-xl"
            />

            <div className="absolute top-4 right-4 text-right text-white">
              <h2 className="text-2xl font-bold mb-1">{employee.name}</h2>
              <p className="text-sm">{employee.position}</p>
              <p className="text-xs">{employee.department}</p>
            </div>
          </div>
          <DrawerDescription>
            Details for employee <strong>{employee.name}</strong>
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4 space-y-2">
          <div>
            <strong>ID:</strong> {employee.id}
          </div>
          <div>
            <strong>Salary:</strong> {employee.salary}
          </div>
          <div>
            <strong>Status:</strong> {employee.status}
          </div>
          <div>
            <strong>Position:</strong> {employee.position}
          </div>
          <div>
            <strong>Department:</strong> {employee.department}
          </div>
          <div>
            <strong>Email:</strong> {employee.email}
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function EmployeeDrawerEdit({
  employee,
  children,
}: {
  employee: Employee;
  children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [emp, setEmployee] = React.useState(false);
  return (
    <Drawer
      direction={isMobile ? "bottom" : "right"}
      open={isDrawerOpen}
      onOpenChange={setIsDrawerOpen}
    >
      <DrawerTrigger asChild>
        {children || (
          <Button variant="link" className="p-0 h-auto">
            {employee.name}
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent className="w-[400px] sm:w-[540px]">
        <div className="bg-opacity-50 flex items-center justify-center">
          <div className="bg-white">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-small text-gray-500 bg-blue-100/50 p-2 rounded">
                  EDIT EMPLOYEE DETAILS
                </p>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </Button>
              </DrawerClose>
            </div>

            <div className="p-6">
              <div className="flex items-start space-x-4 mb-8 bg-blue-100/50 p-4 rounded-lg">
                <div className="relative">
                  <img
                    src="/profile.jpg"
                    alt="No photo"
                    className="w-16 h-16 object-cover rounded-full"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-sm text-gray-500">{employee.id}</span>
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-1">
                    <Input
                      type="text"
                      value={employee.name}
                      className="bg-white"
                    />
                  </h3>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm text-gray-600 flex">
                      <Input
                        type="text"
                        value={employee.position}
                        className="bg-white"
                      />{" "}
                      <Input
                        type="text"
                        value="remote"
                        className="bg-white ml-2"
                      />
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full border-2 border-white">
                    <CheckCheck size={16} />
                    Active
                  </span>
                </div>

                <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md bg-gray-50">
                  <span className="flex items-center space-x-2">
                    <span>Save</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
                      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
                    </svg>
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      ></path>
                    </svg>
                    <span className="text-sm font-medium text-gray-800">
                      <Input
                        type="text"
                        value={employee.department}
                        onChange={(e) =>
                          setEmployee({ ...employee, department: e.target.value })
                        }
                      />
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6"
                      ></path>
                    </svg>
                    <span className="text-sm font-medium text-gray-800">
                      <Input type="text" value={"Full Time"} />
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                    </svg>

                    <span className="text-sm font-medium text-gray-800">
                      <Input type="text" value={employee.email} />
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      ></path>
                    </svg>
                    <span className="text-sm font-medium text-gray-800">
                      <Input type="text" value={employee.position} />
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                      <path d="M12 18V6" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">
                      <Input type="text" value={employee.salary} />
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  Attendance Summary
                </h4>
                <div className="grid grid-cols-4 gap-4 border rounded-lg">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">
                      Year of Employment
                    </p>
                    <p className="text-lg font-semibold text-gray-800">2021</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">
                      Total Present Days
                    </p>
                    <p className="text-lg font-semibold text-gray-800">
                      1,298 days
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">
                      Total Absent Days
                    </p>
                    <p className="text-lg font-semibold text-gray-800">
                      30 Days
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">
                      Total Leave Days
                    </p>
                    <p className="text-lg font-semibold text-gray-800">
                      423 Days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
