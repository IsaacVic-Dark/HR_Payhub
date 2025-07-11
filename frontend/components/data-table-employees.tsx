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
import { ArrowUpDown, Plus, ChevronDown, MoreHorizontal } from "lucide-react";

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

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconPlus,
  IconTrendingUp,
} from "@tabler/icons-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";
import { z } from "zod";

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

const data: Payment[] = [
  {
    id: "m5gr84i9",
    salary: 31600,
    img: (
      <img
        src="/profile.jpg"
        alt="Profile"
        className="h-8 w-8 rounded-full object-cover"
      />
    ),
    status: "active",
    name: "Bruce Banner",
    position: "Sales Executive",
    department: "Sales",
    email: "ken99@example.com",
  },
  {
    id: "3u1reuv4",
    salary: 242,
    img: (
      <img
        src="/profile.jpg"
        alt="Profile"
        className="h-8 w-8 rounded-full object-cover"
      />
    ),
    status: "active",
    name: "Tony",
    position: "Software Engineer",
    department: "Engineering",
    email: "Abe45@example.com",
  },
  {
    id: "derv1ws0",
    salary: 837,
    img: (
      <img
        src="/profile.jpg"
        alt="Profile"
        className="h-8 w-8 rounded-full object-cover"
      />
    ),
    status: "retired",
    name: "Stark",
    position: "Social Media Manager",
    department: "Marketing",
    email: "Monserrat44@example.com",
  },
  {
    id: "5kma53ae",
    salary: 874,
    img: (
      <img
        src="/profile.jpg"
        alt="Profile"
        className="h-8 w-8 rounded-full object-cover"
      />
    ),
    status: "active",
    name: "Ken",
    position: "Software Engineer",
    department: "Engineering",
    email: "Silas22@example.com",
  },
  {
    id: "bhqecj4p",
    salary: 721,
    img: (
      <img
        src="/profile.jpg"
        alt="Profile"
        className="h-8 w-8 rounded-full object-cover"
      />
    ),
    status: "on leave",
    name: "John",
    position: "Business Analyst",
    department: "Business",
    email: "carmella@example.com",
  },
];

export type Payment = {
  id: string;
  img: React.ReactNode;
  salary: number;
  status: "pending" | "retired" | "active" | "on leave";
  name: string;
  position: string;
  department: string;
  email: string;
};

export const columns: ColumnDef<Payment>[] = [
  // {
  //   id: "select",
  //   header: ({ table }) => (
  //     <Checkbox
  //       checked={
  //         table.getIsAllPageRowsSelected() ||
  //         (table.getIsSomePageRowsSelected() && "indeterminate")
  //       }
  //       onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
  //       aria-label="Select all"
  //     />
  //   ),
  //   cell: ({ row }) => (
  //     <Checkbox
  //       checked={row.getIsSelected()}
  //       onCheckedChange={(value) => row.toggleSelected(!!value)}
  //       aria-label="Select row"
  //     />
  //   ),
  //   enableSorting: false,
  //   enableHiding: false,
  // },
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
      const payment = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <EmployeeDrawer employee={payment}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                View employee
              </DropdownMenuItem>
            </EmployeeDrawer>
            <DropdownMenuItem>
              <EmployeeDrawerEdit employee={payment}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Edit employee
                </DropdownMenuItem>
              </EmployeeDrawerEdit>
            </DropdownMenuItem>
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
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
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
  employee: Payment;
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

function EmployeeDrawerAdd({ employee }: { employee: Payment }) {
  const isMobile = useIsMobile();
  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="p-0 h-auto">
          {employee.name}
        </Button>
      </DrawerTrigger>
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
  employee: Payment;
  children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  return (
    <Drawer
      direction={isMobile ? "bottom" : "right"}
      open={isDrawerOpen}
      onOpenChange={setIsDrawerOpen}
    >
      <DrawerTrigger asChild>
        <Button variant="link" className="p-0 h-auto">
          {employee.name}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <Input type="text" value={employee.name} />
        </DrawerHeader>
        <div className="p-4 space-y-2">
          <div>
            <strong>ID:</strong> {employee.id}
          </div>
          <div>
            <Input type="text" value={employee.name} />
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
            <Button>Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
