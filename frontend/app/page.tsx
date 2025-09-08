import Image from "next/image";
// import ProtectedRoute from '@/lib/ProtectedRoute';
import PayrollLanding from "./landing/page";

export default function Home() {
  return (
    // <ProtectedRoute>
      <PayrollLanding />
    // </ProtectedRoute>      
  );
}
