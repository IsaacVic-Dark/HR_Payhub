"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Banknote, 
  Clock, 
  ArrowLeftRight, 
  Smartphone, 
  User, 
  Building, 
  Plane, 
  Wallet,
  Plus
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PaymentsModule() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activePaymentType, setActivePaymentType] = useState("");

  const handleOpenDrawer = (paymentType: string) => {
    setActivePaymentType(paymentType);
    setIsDrawerOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Payments</h1>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Clock className="mr-2 h-4 w-4" />
            Payment History
          </Button>
          <Button onClick={() => handleOpenDrawer("new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Payment
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Payroll Payouts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Payroll Payouts</CardTitle>
              <CardDescription>Process employee salaries</CardDescription>
            </div>
            <User className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="font-medium">24</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Processed</span>
                <span className="font-medium">156</span>
              </div>
              <Separator />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleOpenDrawer("payroll")}
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Process Payouts
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Refunds */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Refunds</CardTitle>
              <CardDescription>Employee expense refunds</CardDescription>
            </div>
            <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="font-medium">8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Processed</span>
                <span className="font-medium">42</span>
              </div>
              <Separator />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleOpenDrawer("refund")}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Initiate Refund
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Vendor Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Vendor Payments</CardTitle>
              <CardDescription>Pay suppliers and contractors</CardDescription>
            </div>
            <Building className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="font-medium">15</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Processed</span>
                <span className="font-medium">87</span>
              </div>
              <Separator />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleOpenDrawer("vendor")}
              >
                <Banknote className="mr-2 h-4 w-4" />
                Pay Vendor
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Airtime Disbursement */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Airtime</CardTitle>
              <CardDescription>Mobile credit disbursement</CardDescription>
            </div>
            <Smartphone className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="font-medium">3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Processed</span>
                <span className="font-medium">56</span>
              </div>
              <Separator />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleOpenDrawer("airtime")}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Send Airtime
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Per Diem & Allowances */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Per Diem</CardTitle>
              <CardDescription>Travel and expense allowances</CardDescription>
            </div>
            <Plane className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="font-medium">12</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Processed</span>
                <span className="font-medium">34</span>
              </div>
              <Separator />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleOpenDrawer("perdiem")}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Process Allowance
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {activePaymentType === "new" ? "New Payment" : `Process ${activePaymentType}`}
            </DrawerTitle>
            <DrawerDescription>
              {activePaymentType === "new" 
                ? "Select payment type and enter details" 
                : `Enter ${activePaymentType} details`}
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="p-4 space-y-4">
            {activePaymentType === "new" && (
              <div className="space-y-2">
                <Label htmlFor="paymentType">Payment Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payroll">Payroll Payout</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="vendor">Vendor Payment</SelectItem>
                    <SelectItem value="airtime">Airtime</SelectItem>
                    <SelectItem value="perdiem">Per Diem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient</Label>
              <Input 
                id="recipient" 
                placeholder={
                  activePaymentType === "payroll" ? "Employee ID" :
                  activePaymentType === "refund" ? "Employee Name" :
                  activePaymentType === "vendor" ? "Vendor Name" :
                  activePaymentType === "airtime" ? "Phone Number" :
                  activePaymentType === "perdiem" ? "Employee Name" :
                  "Name or ID"
                } 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="mobile">Mobile Money</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activePaymentType === "refund" && (
              <div className="space-y-2">
                <Label htmlFor="reference">Original Payment Reference</Label>
                <Input id="reference" placeholder="Transaction ID or Reference" />
              </div>
            )}
          </div>

          <DrawerFooter>
            <Button>Process Payment</Button>
            <Button 
              variant="outline" 
              onClick={() => setIsDrawerOpen(false)}
            >
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}