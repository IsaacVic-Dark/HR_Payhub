"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { p9FormAPI } from "@/services/api/p9forms";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface P9FormGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function P9FormGenerateModal({
  open,
  onOpenChange,
  onSuccess,
}: P9FormGenerateModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [regenerate, setRegenerate] = useState(false);

  const handleGenerate = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      
      const response = await p9FormAPI.generateP9Forms(user.organization_id, {
        year: selectedYear,
        regenerate,
      });

      if (response.success) {
        toast.success("P9 forms generated successfully");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(response.error || "Failed to generate P9 forms");
      }
    } catch {
      toast.error("An error occurred while generating P9 forms");
    } finally {
      setLoading(false);
    }
  };

  const years = [2024, 2025, 2026];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate P9 Forms</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="regenerate"
                checked={regenerate}
                onChange={(e) => setRegenerate(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="regenerate" className="text-sm text-gray-700">
                Regenerate existing forms
              </label>
            </div>

            <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-md">
              This will generate P9 forms for all active employees based on finalized
              payrun data from {selectedYear}. Existing generated forms will be
              {regenerate ? " overwritten." : " skipped."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}