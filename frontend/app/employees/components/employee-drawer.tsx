"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCheck, X, Mail, Briefcase, Banknote, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import {
  employeeAPI,
  EmployeeType as ApiEmployeeType,
} from "@/services/api/employee";
import { departmentAPI } from "@/services/api/department";
import { toast } from "sonner";

type EmploymentType = "full_time" | "part_time" | "contract";

type WorkLocation = "on-site" | "remote" | "hybrid";

export type Employee = {
  id: string;
  img: React.ReactNode;
  salary: number;
  status:
    | "active"
    | "inactive"
    | "on_leave"
    | "terminated"
    | "resigned"
    | "suspended"
    | "probation";
  name: string;
  position: string;
  // department: number | string;
  department_id?: number;
  p_email: string;
  email: string;
  personal_email?: string;
  phone?: string;
  hire_date?: string;
  bank_account_number?: string;
  work_location?: string;
  employment_type?: string;
  reports_to?: string;
  location?: string;
};

const employeeStatuses: { label: string; value: Employee["status"] }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "On Leave", value: "on_leave" },
  { label: "Terminated", value: "terminated" },
  { label: "Resigned", value: "resigned" },
  { label: "Suspended", value: "suspended" },
  { label: "Probation", value: "probation" },
];

const employmentTypes = [
  { label: "Full Time", value: "full_time" },
  { label: "Part Time", value: "part_time" },
  { label: "Contract", value: "contract" },
  { label: "Intern", value: "intern" },
];

const workLocations = [
  { label: "On-site", value: "on-site" },
  { label: "Remote", value: "remote" },
  { label: "Hybrid", value: "hybrid" },
];

interface EmployeeDrawerAddProps {
  children: React.ReactNode;
  employees: ApiEmployeeType[];
  onEmployeeAdded?: () => void;
}

export function EmployeeDrawerAdd({
  children,
  employees,
  onEmployeeAdded,
}: EmployeeDrawerAddProps) {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const { user } = useAuth();

  const [formData, setFormData] = React.useState({
    employee_number: "",
    first_name: "",
    middle_name: "",
    surname: "",
    email: "",
    personal_email: "",
    phone: "",
    hire_date: new Date().toISOString().split("T")[0],
    job_title: "",
    department: "",
    reports_to: "",
    base_salary: "",
    bank_account_number: "",
    status: "active" as const,
    employment_type: "full_time" as const,
    work_location: "on-site" as const,
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [departments, setDepartments] = React.useState<
    { id: number; name: string }[]
  >([]);

  React.useEffect(() => {
    if (!user?.organization_id) return;
    departmentAPI.getDepartments(user.organization_id).then((res) => {
      if (res.success && res.data) {
        setDepartments(res.data.map((d) => ({ id: d.id, name: d.name })));
      }
    });
  }, [user?.organization_id]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }
    if (!formData.surname.trim()) {
      newErrors.surname = "Surname is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!formData.job_title.trim()) {
      newErrors.job_title = "Job title is required";
    }
    if (!formData.department.trim()) {
      newErrors.department = "Department is required";
    }
    if (!formData.base_salary.trim()) {
      newErrors.base_salary = "Base salary is required";
    } else if (
      isNaN(parseFloat(formData.base_salary)) ||
      parseFloat(formData.base_salary) <= 0
    ) {
      newErrors.base_salary = "Please enter a valid salary";
    }
    if (!formData.hire_date.trim()) {
      newErrors.hire_date = "Hire date is required";
    }

    if (!formData.employee_number.trim()) {
      newErrors.employee_number = "Employee number is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !user?.organization_id) {
      return;
    }

    setLoading(true);
    try {
      // Build payload with proper types - no null values
      const payload: {
        first_name: string;
        middle_name?: string;
        surname: string;
        email: string;
        employee_number: string;
        personal_email?: string;
        phone: string;
        hire_date: string;
        job_title: string;
        department_id: number;
        reports_to?: number;
        base_salary: string;
        bank_account_number?: string;
        tax_id?: string;
        status: Employee["status"]; // Use the specific type
        employment_type: EmploymentType;
        work_location: WorkLocation;
        username: string;
        user_id: number;
      } = {
        first_name: formData.first_name,
        surname: formData.surname,
        email: formData.email,
        employee_number: formData.employee_number,
        phone: formData.phone,
        hire_date: formData.hire_date,
        job_title: formData.job_title,
        department: parseInt(formData.department),
        base_salary: formData.base_salary,
        status: formData.status as Employee["status"], // Cast to the correct type
        employment_type: formData.employment_type as EmploymentType,
        work_location: formData.work_location as WorkLocation,
        username: `${formData.first_name.toLowerCase()}.${formData.surname.toLowerCase()}`,
        user_id: 0, // This should come from user creation
      };

      // Only add optional fields if they have values
      if (formData.middle_name && formData.middle_name.trim()) {
        payload.middle_name = formData.middle_name;
      }

      if (formData.personal_email && formData.personal_email.trim()) {
        payload.personal_email = formData.personal_email;
      }

      if (
        formData.reports_to &&
        formData.reports_to.trim() &&
        formData.reports_to !== "none"
      ) {
        payload.reports_to = parseInt(formData.reports_to);
      }

      if (formData.bank_account_number && formData.bank_account_number.trim()) {
        payload.bank_account_number = formData.bank_account_number;
      }

      const response = await employeeAPI.createEmployee(
        user.organization_id,
        payload,
      );

      if (response.success) {
        toast.success("Employee created successfully!");
        setIsDrawerOpen(false);
        resetForm();
        if (onEmployeeAdded) {
          onEmployeeAdded();
        }
      } else {
        toast.error(response.error || "Failed to create employee");
      }
    } catch (error) {
      console.error("Error creating employee:", error);
      toast.error("An error occurred while creating employee");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_number: "",
      first_name: "",
      middle_name: "",
      surname: "",
      email: "",
      personal_email: "",
      phone: "",
      hire_date: new Date().toISOString().split("T")[0],
      job_title: "",
      department: "",
      reports_to: "",
      base_salary: "",
      bank_account_number: "",
      status: "active",
      employment_type: "full_time",
      work_location: "on-site",
    });
    setErrors({});
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const initials =
    `${formData.first_name[0] || ""}${formData.surname[0] || ""}`.toUpperCase();

  const operationsManagers =
    employees?.filter((emp) =>
      emp.job_title?.toLowerCase().includes("manager"),
    ) || [];

  console.log("Departments loaded in EmployeeDrawerAdd:", departments);
  console.log("All employees for 'Reports To' dropdown:", employees);
  console.log(
    "Operations Managers for 'Reports To' dropdown:",
    operationsManagers,
  );

  return (
    <>
      <div onClick={() => setIsDrawerOpen(true)}>{children}</div>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        direction={isMobile ? "bottom" : "right"}
      >
        <DrawerContent className="h-full min-w-xl ml-auto bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <DrawerTitle className="text-xl font-semibold">
                    Add New Employee
                  </DrawerTitle>
                  <DrawerDescription>
                    Fill in the employee details below
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Employee Profile Section */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center border-2 border-blue-200">
                      <span className="text-xl font-bold text-blue-600">
                        {initials || "?"}
                      </span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex-1">
<div className="flex items-center space-x-2 mb-1">
  <div className="flex-1">
    <Input
      placeholder="Employee Number (e.g. EMP001)"
      value={formData.employee_number}
      onChange={(e) => handleInputChange("employee_number", e.target.value)}
      className={errors.employee_number ? "border-red-500" : ""}
    />
    {errors.employee_number && (
      <p className="text-xs text-red-500 mt-1">{errors.employee_number}</p>
    )}
  </div>
</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Input
                          placeholder="First Name"
                          value={formData.first_name}
                          onChange={(e) =>
                            handleInputChange("first_name", e.target.value)
                          }
                          className={errors.first_name ? "border-red-500" : ""}
                        />
                        {errors.first_name && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.first_name}
                          </p>
                        )}
                      </div>
                      <div>
                        <Input
                          placeholder="Middle Name (Optional)"
                          value={formData.middle_name}
                          onChange={(e) =>
                            handleInputChange("middle_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="Surname"
                          value={formData.surname}
                          onChange={(e) =>
                            handleInputChange("surname", e.target.value)
                          }
                          className={errors.surname ? "border-red-500" : ""}
                        />
                        {errors.surname && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.surname}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        <CheckCheck size={12} className="mr-1" />
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Work Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="employee@company.com"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Personal Email (Optional)
                    </label>
                    <Input
                      type="email"
                      placeholder="personal@email.com"
                      value={formData.personal_email}
                      onChange={(e) =>
                        handleInputChange("personal_email", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      className={errors.phone ? "border-red-500" : ""}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500">{errors.phone}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Hire Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) =>
                        handleInputChange("hire_date", e.target.value)
                      }
                      className={errors.hire_date ? "border-red-500" : ""}
                    />
                    {errors.hire_date && (
                      <p className="text-xs text-red-500">{errors.hire_date}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Employment Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g., Software Engineer"
                      value={formData.job_title}
                      onChange={(e) =>
                        handleInputChange("job_title", e.target.value)
                      }
                      className={errors.job_title ? "border-red-500" : ""}
                    />
                    {errors.job_title && (
                      <p className="text-xs text-red-500">{errors.job_title}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) =>
                        handleInputChange("department", value)
                      }
                    >
                      <SelectTrigger
                        className={errors.department ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.length > 0 ? (
                          departments.map((dept) => (
                            <SelectItem
                              key={dept.id}
                              value={dept.id.toString()}
                            >
                              {dept.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-departments" disabled>
                            No departments found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.department && (
                      <p className="text-xs text-red-500">
                        {errors.department}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Employment Type
                    </label>
                    <Select
                      value={formData.employment_type}
                      onValueChange={(value: EmploymentType) =>
                        handleInputChange("employment_type", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>

                      <SelectContent>
                        {employmentTypes && employmentTypes.length > 0 ? (
                          employmentTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-employment-types" disabled>
                            No employment types found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Work Location
                    </label>
                    <Select
                      value={formData.work_location}
                      onValueChange={(value: WorkLocation) =>
                        handleInputChange("work_location", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>

                      <SelectContent>
                        {workLocations && workLocations.length > 0 ? (
                          workLocations.map((location) => (
                            <SelectItem
                              key={location.value}
                              value={location.value}
                            >
                              {location.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-work-locations" disabled>
                            No work locations found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Reports To (Optional)
                    </label>
                    <Select
                      value={formData.reports_to}
                      onValueChange={(value) =>
                        handleInputChange("reports_to", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>

                        {operationsManagers && operationsManagers.length > 0 ? (
                          operationsManagers.map((manager) => (
                            <SelectItem
                              key={manager.id}
                              value={manager.id.toString()}
                            >
                              {manager.first_name} {manager.surname} -{" "}
                              {manager.job_title}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-manager" disabled>
                            No high rank employee found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Compensation Details */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <Banknote className="h-4 w-4 mr-2" />
                  Compensation Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Base Salary ($) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g., 75000"
                      value={formData.base_salary}
                      onChange={(e) =>
                        handleInputChange("base_salary", e.target.value)
                      }
                      className={errors.base_salary ? "border-red-500" : ""}
                    />
                    {errors.base_salary && (
                      <p className="text-xs text-red-500">
                        {errors.base_salary}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Bank Account Number (Optional)
                    </label>
                    <Input
                      placeholder="e.g., 1234567890"
                      value={formData.bank_account_number}
                      onChange={(e) =>
                        handleInputChange("bank_account_number", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="font-semibold mb-4">Status</h3>
                <div className="grid grid-cols-4 gap-2">
                  {employeeStatuses.map(({ label, value }) => (
                    <div key={value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${value}`}
                        checked={formData.status === value}
                        onCheckedChange={() =>
                          handleInputChange("status", value)
                        }
                      />
                      <Label htmlFor={`status-${value}`} className="text-sm">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>

          <DrawerFooter className="border-t p-6">
            <div className="flex items-center justify-end space-x-3">
              <DrawerClose asChild>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Save Employee
                  </>
                )}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function EmployeeDrawer({
  employee,
  children,
}: {
  employee: Employee;
  children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      active: { color: "bg-green-100 text-green-800", label: "Active" },
      inactive: { color: "bg-gray-100 text-gray-800", label: "Inactive" },
      on_leave: { color: "bg-blue-100 text-blue-800", label: "On Leave" },
      terminated: { color: "bg-red-100 text-red-800", label: "Terminated" },
      resigned: { color: "bg-orange-100 text-orange-800", label: "Resigned" },
      suspended: { color: "bg-yellow-100 text-yellow-800", label: "Suspended" },
      probation: { color: "bg-purple-100 text-purple-800", label: "Probation" },
    };

    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <>
      <div onClick={() => setIsDrawerOpen(true)}>
        {children || (
          <Button variant="link" className="p-0 h-auto">
            {employee.name}
          </Button>
        )}
      </div>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        direction={isMobile ? "bottom" : "right"}
      >
        <DrawerContent className="h-full min-w-xl ml-auto bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <DrawerTitle className="text-xl font-semibold">
                    Employee Details
                  </DrawerTitle>
                  <DrawerDescription>{employee.name}</DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Employee Profile */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center border-2 border-blue-200">
                    <span className="text-xl font-bold text-blue-600">
                      {employee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                      ID: {employee.id}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    {employee.name}
                  </h3>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm text-gray-600">
                      {employee.position}
                      {employee.location && ` (${employee.location})`}
                    </span>
                  </div>
                  <div className="mt-2">{getStatusBadge(employee.status)}</div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Work Email</span>
                  <p className="font-medium">{employee.email}</p>
                </div>
                <div>
                  <span className="text-gray-600">Personal Email</span>
                  <p className="font-medium">
                    {employee.personal_email || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Phone</span>
                  <p className="font-medium">{employee.phone || "N/A"}</p>
                </div>
                <div>
                  <span className="text-gray-600">Hire Date</span>
                  <p className="font-medium">
                    {formatDate(employee.hire_date)}
                  </p>
                </div>
              </div>
            </div>

            {/* Employment Details */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center">
                <Briefcase className="h-4 w-4 mr-2" />
                Employment Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Department</span>
                  <p className="font-medium">{employee.department}</p>
                </div>
                <div>
                  <span className="text-gray-600">Position</span>
                  <p className="font-medium">{employee.position}</p>
                </div>
                <div>
                  <span className="text-gray-600">Employment Type</span>
                  <p className="font-medium">
                    {employee.employment_type || "Full Time"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Work Location</span>
                  <p className="font-medium">
                    {employee.work_location || "On-site"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Reports To</span>
                  <p className="font-medium">{employee.reports_to || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* Compensation Details */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center">
                <Banknote className="h-4 w-4 mr-2" />
                Compensation Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Base Salary</span>
                  <p className="font-medium">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(employee.salary)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Bank Account</span>
                  <p className="font-medium">
                    {employee.bank_account_number || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DrawerFooter className="border-t p-6">
            <div className="flex items-center justify-end space-x-3">
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
              <EmployeeDrawerEdit employee={employee}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Edit Employee
                </Button>
              </EmployeeDrawerEdit>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function EmployeeDrawerEdit({
  employee,
  children,
}: {
  employee: Employee;
  children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const { user } = useAuth();

  const [formData, setFormData] = React.useState({
    first_name: employee.name.split(" ")[0] || "",
    middle_name: "",
    surname: employee.name.split(" ").slice(1).join(" ") || "",
    email: employee.email || "",
    personal_email: employee.personal_email || "",
    phone: employee.phone || "",
    hire_date: employee.hire_date || new Date().toISOString().split("T")[0],
    job_title: employee.position || "",
    department: employee.department_id?.toString() || "",
    reports_to: employee.reports_to || "",
    base_salary: employee.salary.toString() || "",
    bank_account_number: employee.bank_account_number || "",
    status: employee.status || ("active" as const),
    employment_type:
      (employee.employment_type as any) || ("full_time" as const),
    work_location: (employee.work_location as any) || ("on-site" as const),
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [departments, setDepartments] = React.useState<
    { id: number; name: string }[]
  >([]);

  React.useEffect(() => {
    if (!user?.organization_id) return;
    departmentAPI.getDepartments(user.organization_id).then((res) => {
      if (res.success && res.data) {
        setDepartments(res.data.map((d) => ({ id: d.id, name: d.name })));
      }
    });
  }, [user?.organization_id]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }
    if (!formData.surname.trim()) {
      newErrors.surname = "Surname is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!formData.job_title.trim()) {
      newErrors.job_title = "Job title is required";
    }
    if (!formData.department.trim()) {
      newErrors.department = "Department is required";
    }
    if (!formData.base_salary.trim()) {
      newErrors.base_salary = "Base salary is required";
    } else if (
      isNaN(parseFloat(formData.base_salary)) ||
      parseFloat(formData.base_salary) <= 0
    ) {
      newErrors.base_salary = "Please enter a valid salary";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !user?.organization_id) {
      return;
    }

    setLoading(true);
    try {
      // Build payload with only changed fields
      const payload: {
        first_name?: string;
        middle_name?: string;
        surname?: string;
        email?: string;
        employee_number: string;
        personal_email?: string;
        phone?: string;
        hire_date?: string;
        job_title?: string;
        department_id?: number;
        reports_to?: number;
        base_salary?: string;
        bank_account_number?: string;
        status?: Employee["status"];
        employment_type?: EmploymentType;
        work_location?: WorkLocation;
      } = {};

      // Compare with original employee data
      const originalFirstName = employee.name.split(" ")[0] || "";
      const originalSurname = employee.name.split(" ").slice(1).join(" ") || "";

      if (formData.first_name !== originalFirstName)
        payload.first_name = formData.first_name;

      // Handle middle_name - only include if it has a value, otherwise omit it
      if (formData.middle_name && formData.middle_name.trim()) {
        payload.middle_name = formData.middle_name;
      }

      if (formData.surname !== originalSurname)
        payload.surname = formData.surname;
      if (formData.email !== employee.email) payload.email = formData.email;

      // Fix for personal_email - use undefined instead of null
      if (formData.personal_email !== (employee.personal_email || "")) {
        // Only include if it has a value, otherwise omit (undefined)
        if (formData.personal_email && formData.personal_email.trim()) {
          payload.personal_email = formData.personal_email;
        }
        // If it's empty and the original had a value, we want to clear it
        // But since we can't send null, we need to check if the API accepts empty string
        // Option 1: Send empty string if the API accepts it
        else if (employee.personal_email) {
          payload.personal_email = ""; // or omit this line if you don't want to clear it
        }
      }

      if (formData.phone !== (employee.phone || ""))
        payload.phone = formData.phone;
      if (formData.hire_date !== employee.hire_date)
        payload.hire_date = formData.hire_date;
      if (formData.job_title !== employee.position)
        payload.job_title = formData.job_title;
      if (formData.department !== employee.department_id?.toString())
        payload.department_id = parseInt(formData.department);
      if (formData.reports_to !== (employee.reports_to || "")) {
        payload.reports_to = formData.reports_to
          ? parseInt(formData.reports_to)
          : undefined;
      }
      if (formData.base_salary !== employee.salary.toString())
        payload.base_salary = formData.base_salary;

      // Fix for bank_account_number - use undefined instead of null
      if (
        formData.bank_account_number !== (employee.bank_account_number || "")
      ) {
        if (
          formData.bank_account_number &&
          formData.bank_account_number.trim()
        ) {
          payload.bank_account_number = formData.bank_account_number;
        }
        // If clearing the field, omit it (undefined) or send empty string if API accepts it
        else if (employee.bank_account_number) {
          payload.bank_account_number = ""; // or omit this line
        }
      }

      if (formData.status !== employee.status) payload.status = formData.status;
      if (
        formData.employment_type !==
        (employee.employment_type as EmploymentType)
      )
        payload.employment_type = formData.employment_type;
      if (formData.work_location !== (employee.work_location as WorkLocation))
        payload.work_location = formData.work_location;

      // Fix the syntax error in your if statements (they were nested incorrectly)
      // The original code had a syntax error with nested if statements without braces

      if (Object.keys(payload).length === 0) {
        // If nothing changed, don't make API call
        toast.info("No changes detected");
        setLoading(false);
        return;
      }

      const response = await employeeAPI.updateEmployee(
        user.organization_id,
        parseInt(employee.id),
        payload,
      );

      if (response.success) {
        toast.success("Employee updated successfully!");
        setIsDrawerOpen(false);
      } else {
        toast.error(response.error || "Failed to update employee");
      }
    } catch (error) {
      console.error("Error updating employee:", error);
      toast.error("An error occurred while updating employee");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const initials =
    `${formData.first_name[0] || ""}${formData.surname[0] || ""}`.toUpperCase();

  return (
    <>
      <div onClick={() => setIsDrawerOpen(true)}>{children}</div>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        direction={isMobile ? "bottom" : "right"}
      >
        <DrawerContent className="h-full min-w-xl ml-auto bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <DrawerTitle className="text-xl font-semibold">
                    Edit Employee
                  </DrawerTitle>
                  <DrawerDescription>Update employee details</DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Employee Profile Section */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center border-2 border-blue-200">
                      <span className="text-xl font-bold text-blue-600">
                        {initials || "?"}
                      </span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                        ID: {employee.id}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Input
                          placeholder="First Name"
                          value={formData.first_name}
                          onChange={(e) =>
                            handleInputChange("first_name", e.target.value)
                          }
                          className={errors.first_name ? "border-red-500" : ""}
                        />
                        {errors.first_name && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.first_name}
                          </p>
                        )}
                      </div>
                      <div>
                        <Input
                          placeholder="Middle Name (Optional)"
                          value={formData.middle_name}
                          onChange={(e) =>
                            handleInputChange("middle_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="Surname"
                          value={formData.surname}
                          onChange={(e) =>
                            handleInputChange("surname", e.target.value)
                          }
                          className={errors.surname ? "border-red-500" : ""}
                        />
                        {errors.surname && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.surname}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        <CheckCheck size={12} className="mr-1" />
                        {formData.status.charAt(0).toUpperCase() +
                          formData.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Work Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="employee@company.com"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Personal Email (Optional)
                    </label>
                    <Input
                      type="email"
                      placeholder="personal@email.com"
                      value={formData.personal_email}
                      onChange={(e) =>
                        handleInputChange("personal_email", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      className={errors.phone ? "border-red-500" : ""}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500">{errors.phone}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Hire Date
                    </label>
                    <Input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) =>
                        handleInputChange("hire_date", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Employment Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g., Software Engineer"
                      value={formData.job_title}
                      onChange={(e) =>
                        handleInputChange("job_title", e.target.value)
                      }
                      className={errors.job_title ? "border-red-500" : ""}
                    />
                    {errors.job_title && (
                      <p className="text-xs text-red-500">{errors.job_title}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) =>
                        handleInputChange("department", value)
                      }
                    >
                      <SelectTrigger
                        className={errors.department ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.length > 0 ? (
                          departments.map((dept) => (
                            <SelectItem
                              key={dept.id}
                              value={dept.id.toString()}
                            >
                              {dept.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-departments" disabled>
                            No departments found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.department && (
                      <p className="text-xs text-red-500">
                        {errors.department}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Employment Type
                    </label>
                    <Select
                      value={formData.employment_type}
                      onValueChange={(value: EmploymentType) =>
                        handleInputChange("employment_type", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>

                      <SelectContent>
                        {employmentTypes && employmentTypes.length > 0 ? (
                          employmentTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-employment-types" disabled>
                            No employment types found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Work Location
                    </label>
                    <Select
                      value={formData.work_location}
                      onValueChange={(value: WorkLocation) =>
                        handleInputChange("work_location", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>

                      <SelectContent>
                        {workLocations && workLocations.length > 0 ? (
                          workLocations.map((location) => (
                            <SelectItem
                              key={location.value}
                              value={location.value}
                            >
                              {location.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-locations" disabled>
                            No work locations found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Reports To (Optional)
                    </label>
                    <Input
                      placeholder="Manager ID or Name"
                      value={formData.reports_to}
                      onChange={(e) =>
                        handleInputChange("reports_to", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Compensation Details */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <Banknote className="h-4 w-4 mr-2" />
                  Compensation Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Base Salary ($) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g., 75000"
                      value={formData.base_salary}
                      onChange={(e) =>
                        handleInputChange("base_salary", e.target.value)
                      }
                      className={errors.base_salary ? "border-red-500" : ""}
                    />
                    {errors.base_salary && (
                      <p className="text-xs text-red-500">
                        {errors.base_salary}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Bank Account Number (Optional)
                    </label>
                    <Input
                      placeholder="e.g., 1234567890"
                      value={formData.bank_account_number}
                      onChange={(e) =>
                        handleInputChange("bank_account_number", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="font-semibold mb-4">Status</h3>
                <div className="grid grid-cols-4 gap-2">
                  {employeeStatuses.map(({ label, value }) => (
                    <div key={value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-status-${value}`}
                        checked={formData.status === value}
                        onCheckedChange={() =>
                          handleInputChange("status", value)
                        }
                      />
                      <Label
                        htmlFor={`edit-status-${value}`}
                        className="text-sm"
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>

          <DrawerFooter className="border-t p-6">
            <div className="flex items-center justify-end space-x-3">
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
