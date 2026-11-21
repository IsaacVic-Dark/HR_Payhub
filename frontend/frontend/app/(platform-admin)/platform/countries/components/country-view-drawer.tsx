"use client";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountryType } from "@/services/api/countries-counties";
import { Globe, Landmark, Clock } from "lucide-react";

interface CountryViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country: CountryType | null;
  onViewDetails?: (country: CountryType) => void;
}

export function CountryViewDrawer({
  open,
  onOpenChange,
  country,
  onViewDetails,
}: CountryViewDrawerProps) {
  if (!country) return null;

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (isActive: number) =>
    isActive === 1 ? (
      <Badge className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">Inactive</Badge>
    );

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className="h-full min-w-xl ml-auto bg-white"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DrawerHeader className="border-b">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Globe className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                {country.name}
              </DrawerTitle>
              <DrawerDescription>
                Country Details and Information
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Country Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center text-sm">
              <Globe className="h-4 w-4 mr-2" />
              Country Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Country Name</span>
                <p className="font-medium mt-0.5">{country.name}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Status</span>
                <div className="mt-1">{getStatusBadge(country.is_active)}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs">ISO2</span>
                <p className="font-medium mt-0.5 font-mono">{country.iso2}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">ISO3</span>
                <p className="font-medium mt-0.5 font-mono">{country.iso3}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Phone Code</span>
                <p className="font-medium mt-0.5">{country.phone_code || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Timezone</span>
                <p className="font-medium mt-0.5">{country.timezone || "—"}</p>
              </div>
            </div>
          </div>

          {/* Currency */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center text-sm">
              <Landmark className="h-4 w-4 mr-2" />
              Currency
            </h3>
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-2xl font-bold text-blue-600">
                {country.currency_code || "—"}
              </span>
              {country.currency_symbol && (
                <span className="text-sm text-blue-700">
                  Symbol: {country.currency_symbol}
                </span>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
            <div>
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> Created At
              </span>
              <p className="font-medium mt-0.5">{formatDateTime(country.created_at)}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> Last Updated
              </span>
              <p className="font-medium mt-0.5">{formatDateTime(country.updated_at)}</p>
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t p-6">
          <div className="flex gap-2">
            {onViewDetails && (
              <Button
                onClick={() => {
                  onViewDetails(country);
                  onOpenChange(false);
                }}
                className="flex-1"
              >
                View Country Details
              </Button>
            )}
            <DrawerClose asChild>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DrawerClose>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}