import { redirect } from "next/navigation";

// The advance policy now lives in Settings → Advances (admins only).
export default function AdvancePolicyRedirect() {
  redirect("/company-settings?section=advance");
}
