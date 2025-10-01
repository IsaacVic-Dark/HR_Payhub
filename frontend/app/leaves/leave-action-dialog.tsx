import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LeaveActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "approve" | "reject";
  leavePeriod: string;
  employeeName: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function LeaveActionDialog({
  open,
  onOpenChange,
  action,
  leavePeriod,
  employeeName,
  onConfirm,
  loading = false,
}: LeaveActionDialogProps) {
  const isApprove = action === "approve";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isApprove ? "Approve Leave Request" : "Reject Leave Request"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {isApprove ? "approve" : "reject"} the leave
            request for <strong>{employeeName}</strong>?
            <br />
            <br />
            <strong>Leave Period:</strong>
            <br />
            <strong className="text-gray-900">{leavePeriod}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={
              isApprove
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }
          >
            {loading ? "Processing..." : `Confirm ${isApprove ? "Approval" : "Rejection"}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}