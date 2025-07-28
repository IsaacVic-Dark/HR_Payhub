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

import { PhoneInput } from "@/components/ui/phone-input";

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
  email: string;
};

const employeeStatuses: { label: string; value: Employee["status"] }[] = [
  { label: "Deceased", value: "deceased" },
  { label: "Retired", value: "retired" },
  { label: "Active", value: "active" },
  { label: "On Leave", value: "on leave" },
  { label: "Terminated", value: "terminated" },
  { label: "Resigned", value: "resigned" },
  { label: "Suspended", value: "suspended" },
  { label: "Probation", value: "probation" },
];

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

  const fetchEmployeesData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        "http://localhost:8000/api/v1/organizations/51/employees"
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

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
          salary: parseFloat(emp.base_salary),
          status: "active" as const, // You might want to derive this from your data
          name: `${emp.first_name} ${emp.last_name}`,
          position: emp.job_title,
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

  // Fetch employees data
  React.useEffect(() => {
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
  // if (error) {
  //   return (
  //     <div className="m-6">
  //       <div className="flex items-center justify-center h-64">
  //         <div className="text-center">
  //           <p className="text-red-600 mb-2">Error loading employees:</p>
  //           <p className="text-sm text-gray-600">{error}</p>
  //           <Button
  //             onClick={() => window.location.reload()}
  //             variant="outline"
  //             className="mt-4"
  //           >
  //             Try Again
  //           </Button>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="m-6">
      {loading ? (
        <p className="text-center py-16 text-gray-500">Loading employees...</p>
      ) : error ? (
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

            {/* CHANGE 1: Pass employees data to EmployeeDrawerAdd */}
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

function EmployeeDrawerAdd({
  children,
  employees,
}: {
  children: React.ReactNode;
  employees: Employee[]; // Add employees prop
}) {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  // const [position, setPosition] = React.useState("");
  // const [location, setLocation] = React.useState("");
  // const [firstName, setFirstName] = React.useState("");
  // const [lastName, setLastName] = React.useState("");
  // const [reportsTo, setReportsTo] = React.useState("");
  // const [department, setDepartment] = React.useState("");
  // const [phone, setPhone] = React.useState("");
  // const [bankaccountnumber, setBankaccountnumber] = React.useState("");
  // const [salary, setSalary] = React.useState("");

  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [formData, setFormData] = React.useState({
    firstName: "",
    lastName: "",
    reportsTo: "",
    position: "",
    location: "",
    department: "",
    phone: "",
    bankaccountnumber: "",
    employment_type: "",
    salary: "",
  });

  const operationsManagers = React.useMemo(() => {
    return employees.filter((emp) =>
      emp.position?.toLowerCase().includes("operations manager")
    );
  }, [employees]);

  const initials = `${formData.firstName[0] || ""}${
    formData.lastName[0] || ""
  }`.toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    //show loading on #add_new_employee_btn when submitting
    setMessage("Adding employee...");

    const payload = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      reports_to: formData.reportsTo,
      job_title: formData.position,
      location: formData.location,
      department: formData.department,
      phone: formData.phone,
      bank_account_number: formData.bankaccountnumber,
      base_salary: formData.salary,
      employment_type: formData.employment_type,
      hire_date: new Date().toISOString(),
    };

    try {
      const response = await fetch(
        "http://localhost:8000/api/v1/organizations/51/employees",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        setMessage("Failed to add employee.");
        setStatus("error");
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Success:", result);
      setMessage("Employee added successfully!");
      setStatus("success");

      setFormData({
        firstName: "",
        lastName: "",
        reportsTo: "",
        position: "",
        location: "",
        employment_type: "",
        department: "",
        phone: "",
        bankaccountnumber: "",
        salary: "",
      });

      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Error:", error);
      setMessage("Failed to add employee.");
      setStatus("error");
    }
  };

  return (
    <Drawer
      direction={isMobile ? "bottom" : "right"}
      open={isDrawerOpen}
      onOpenChange={setIsDrawerOpen}
    >
      <DrawerTrigger asChild>
        <Input type="button" value="Add Employee" />
      </DrawerTrigger>
      <DrawerContent className="w-[400px] sm:w-[540px] flex flex-col max-h-full">
        <form onSubmit={handleSubmit}>
          <div className="bg-white flex flex-col h-full">
            <div className="bg-white h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-small text-gray-500 bg-blue-100/50 p-2 rounded">
                    ADD EMPLOYEE
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
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </Button>
                </DrawerClose>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="flex items-start space-x-4 mb-8 bg-blue-100/50 p-4 rounded-lg">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-gray-700 font-bold text-lg border">
                      {initials}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-sm text-gray-500">
                        id is auto generated
                      </span>
                    </div>
                    <h3 className="flex text-sm text-gray-60 mb-1 space-x-2">
                      <Input
                        type="text"
                        placeholder="Employee first name ..."
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            firstName: e.target.value,
                          })
                        }
                        className="bg-white"
                      />
                      <Input
                        type="text"
                        placeholder="Employee last name ..."
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        className="bg-white"
                      />
                    </h3>
                    <div className="flex items-center mb-2">
                      <span className="text-sm text-gray-600 flex w-full space-x-1">
                        <p>{formData.position}</p>
                        <span> </span>
                        {location && (
                          <p>
                            <span>(</span>
                            {formData.location}
                            <span>)</span>
                          </p>
                        )}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full border-2 border-white">
                      <CheckCheck size={16} />
                      Active
                    </span>
                  </div>

                  <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md bg-gray-50">
                    <span className="flex items-center space-x-2">
                      <span>Add</span>
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
                        <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                        <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
                        <path d="M7 3v4a1 1 0 0 0 1 1h7" />
                      </svg>
                    </span>
                  </button>
                </div>

                <div className="flex items-center mb-4 space-x-3">
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

                  <span className="text-sm font-small text-gray-800 w-full">
                    <Input
                      type="text"
                      placeholder="Email will automatically generated"
                      readOnly
                    />
                  </span>
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
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        ></path>
                      </svg>
                      <span className="text-sm font-small text-gray-800 w-full">
                        <Input
                          type="text"
                          placeholder="department ..."
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              department: e.target.value,
                            })
                          }
                          className="w-full"
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
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6"
                        ></path>
                      </svg>
                      <span className="text-sm font-small text-gray-800 w-full">
                        <Select
                          value={formData.employment_type}
                          onValueChange={(value) =>
                            setFormData((f) => ({
                              ...f,
                              employment_type: value,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Employment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_time">Full time</SelectItem>
                            <SelectItem value="part_time">Part time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                          </SelectContent>
                        </Select>
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 512 512"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="32"
                          d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"
                        />
                      </svg>
                      <span className="text-sm font-small text-gray-800 w-full">
                        <PhoneInput
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                        />
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 576 512"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="32"
                          d="M64 64C28.7 64 0 92.7 0 128L0 384c0 35.3 28.7 64 64 64l448 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64L64 64zm48 160l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16zM96 336c0-8.8 7.2-16 16-16l352 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-352 0c-8.8 0-16-7.2-16-16zM376 160l80 0c13.3 0 24 10.7 24 24l0 48c0 13.3-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24l0-48c0-13.3 10.7-24 24-24z"
                        />
                      </svg>
                      <span className="text-sm font-small text-gray-800 w-full">
                        <Input
                          type="text"
                          value={formData.bankaccountnumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankaccountnumber: e.target.value,
                            })
                          }
                          placeholder="Bank Account Number"
                        />
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
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        ></path>
                      </svg>
                      <span className="text-sm font-small text-gray-800 w-full">
                        <Input
                          type="text"
                          placeholder="position ..."
                          value={formData.position}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              position: e.target.value,
                            })
                          }
                          className="w-full"
                        />
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 384 512"
                      >
                        <path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z" />
                      </svg>

                      <span className="text-sm font-small text-gray-800 w-full">
                        <Select
                          value={formData.location}
                          onValueChange={(value) =>
                            setFormData((f) => ({ ...f, location: value }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Work location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="On site">On site</SelectItem>
                            <SelectItem value="Remote">Remote</SelectItem>
                            <SelectItem value="Hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
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
                      <span className="text-sm font-small text-gray-800 w-full">
                        <Input
                          type="number"
                          value={formData.salary}
                          onChange={(e) =>
                            setFormData({ ...formData, salary: e.target.value })
                          }
                          placeholder="Salary"
                        />
                      </span>
                    </div>

                    {/* CHANGE 4: Fixed "Reports to" select with operations managers */}
                    <div className="flex items-center space-x-3">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 448 512"
                      >
                        <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm55.2 48h-13.6l23.2 112-48.2-48-48.2 48 23.2-112h-13.6c-101.5 0-183.8 82.3-183.8 183.8c0 13 10.6 23.5 23.5 23.5H416c13 0 23.5-10.6 23.5-23.5c0-101.5-82.3-183.8-183.8-183.8z" />
                      </svg>

                      <span className="text-sm font-small text-gray-800 w-full">
                        <Select
                          value={formData.reportsTo}
                          onValueChange={(value) =>
                            setFormData((f) => ({ ...f, reportsTo: value }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Reports to" />
                          </SelectTrigger>
                          <SelectContent>
                            {operationsManagers.length === 0 ? (
                              <SelectItem value="none" disabled>
                                No operations managers found
                              </SelectItem>
                            ) : (
                              operationsManagers.map((manager) => (
                                <SelectItem key={manager.id} value={manager.id}>
                                  {manager.name} - {manager.department}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-small text-gray-800 w-full">
                    <Button
                      id="add_new_employee_btn"
                      type="submit"
                      className={`w-full ${
                        status === "success"
                          ? "bg-green-500"
                          : status === "error"
                          ? "bg-red-500"
                          : "bg-gray-500"
                      }`}
                    >
                      Add {message ? message : formData.firstName || "Employee"}
                    </Button>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
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

function EmployeeDrawerEdit({
  employee,
  children,
}: {
  employee: Employee;
  children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [emp, setEmployee] = React.useState<Employee>(employee);
  const [selected, setSelected] = React.useState<Employee["status"][]>([]);

  // Update local state when employee prop changes
  React.useEffect(() => {
    setEmployee(employee);
  }, [employee]);

  const toggle = (value: Employee["status"]) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  // Helper function to update employee fields
  const updateEmployee = (field: keyof Employee, value: any) => {
    setEmployee((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

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
      <DrawerContent className="w-[400px] sm:w-[540px] flex flex-col max-h-full">
        <div className="bg-white flex flex-col h-full">
          <div className="bg-white h-full flex flex-col">
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
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </Button>
              </DrawerClose>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
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
                    <span className="text-sm text-gray-500">{emp.id}</span>
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-1">
                    {/* Added onChange handler for name */}
                    <Input
                      type="text"
                      value={emp.name}
                      onChange={(e) => updateEmployee("name", e.target.value)}
                      className="bg-white"
                    />
                  </h3>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm text-gray-600 flex">
                      {/* Added onChange handler for position */}
                      <Input
                        type="text"
                        value={emp.position}
                        onChange={(e) =>
                          updateEmployee("position", e.target.value)
                        }
                        className="border-none shadow-none p-0 w-auto bg-transparent"
                        style={{ width: `${emp.position.length + 1}ch` }} // or use state to measure text
                      />

                      <Input
                        type="text"
                        value="remote"
                        className="border-none shadow-none ml-2"
                        readOnly
                      />
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    {employeeStatuses.map(({ label, value }) => (
                      <div
                        key={value}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <Checkbox
                          id={value}
                          name="status[]"
                          value={value}
                          checked={selected.includes(value)}
                          onCheckedChange={() => toggle(value)}
                          className="w-4 h-4 rounded-full bg-white border border-gray-300 data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor={value}>{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md bg-gray-50">
                  <span className="flex items-center space-x-2">
                    <span>Save</span>
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
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      ></path>
                    </svg>
                    <span className="text-sm font-medium text-gray-800">
                      {/* Fixed: Updated to use emp state and proper onChange */}
                      <Input
                        type="text"
                        value={emp.department}
                        onChange={(e) =>
                          updateEmployee("department", e.target.value)
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
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6"
                      ></path>
                    </svg>
                    <span className="text-sm font-medium text-gray-800">
                      <Input type="text" value={"Full Time"} readOnly />
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
                      {/* Added onChange handler for email */}
                      <Input
                        type="text"
                        value={emp.email}
                        onChange={(e) =>
                          updateEmployee("email", e.target.value)
                        }
                      />
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
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      ></path>
                    </svg>
                    <span className="text-sm font-medium text-gray-800">
                      {/* Updated to use emp state and added onChange */}
                      <Input
                        type="text"
                        value={emp.position}
                        onChange={(e) =>
                          updateEmployee("position", e.target.value)
                        }
                      />
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
                      {/* Added onChange handler for salary */}
                      <Input
                        type="text"
                        value={emp.salary}
                        onChange={(e) =>
                          updateEmployee("salary", e.target.value)
                        }
                      />
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
