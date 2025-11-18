'use client';

import { ChevronLeft } from "lucide-react"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="flex flex-col p-6 md:p-10">
      <div className="flex justify-center gap-2 md:justify-start">
        <a 
          href="/"
          style={{ 
            color: '#895bf5',
          }}
          className="flex items-center space-x-1 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>back</span>
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}