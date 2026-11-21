import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface UserActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "add" | "edit" | "activate" | "deactivate";
  userName?: string;
  onConfirm: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export function UserActionDialog({
  open,
  onOpenChange,
  action,
  userName,
  onConfirm,
  loading = false,
  children,
}: UserActionDialogProps) {
  const isAdd = action === "add";
  const isEdit = action === "edit";
  const isActivate = action === "activate";
  const isDeactivate = action === "deactivate";
  const isFormAction = isAdd || isEdit;

  const getTitle = () => {
    if (isAdd) return "Add User";
    if (isEdit) return "Edit User";
    return isActivate ? "Activate User" : "Deactivate User";
  };

  const getDescription = () => {
    if (isFormAction) return null;
    if (isActivate) {
      return (
        <>
          Are you sure you want to activate <strong>{userName}</strong>? They
          will regain access to the system immediately.
        </>
      );
    }
    return (
      <>
        Are you sure you want to deactivate <strong>{userName}</strong>? They
        will immediately lose access to the system.
      </>
    );
  };

  const getButtonText = () => {
    if (loading) return "Processing...";
    if (isAdd) return "Create User";
    if (isEdit) return "Save Changes";
    return isActivate ? "Confirm Activation" : "Confirm Deactivation";
  };

  const getButtonClass = () => {
    if (isFormAction) return "bg-blue-600 hover:bg-blue-700 text-white";
    return isActivate
      ? "bg-green-600 hover:bg-green-700 text-white"
      : "bg-red-600 hover:bg-red-700 text-white";
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          {!isFormAction && (
            <AlertDialogDescription>{getDescription()}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {/* Custom form content for add/edit actions */}
        {isFormAction && children && <div className="py-4">{children}</div>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>

          {/*
            Plain Button instead of AlertDialogAction for the same reason as
            LeaveActionDialog: AlertDialogAction closes the dialog immediately
            on click, which would fire the parent's form-reset effect before
            onConfirm reads the current form state.
          */}
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={getButtonClass()}
          >
            {getButtonText()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}