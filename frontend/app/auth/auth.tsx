import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  User,
  Mail,
  Shield,
  Users,
  ArrowRight,
  Upload,
} from "lucide-react";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const UntitledUISignup = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    companyName: "",
    location: "",
    currency: "",
    logo: null,
  });

  const kenyanCounties = [
    "Baringo",
    "Bomet",
    "Bungoma",
    "Busia",
    "Elgeyo-Marakwet",
    "Embu",
    "Garissa",
    "Homa Bay",
    "Isiolo",
    "Kajiado",
    "Kakamega",
    "Kericho",
    "Kiambu",
    "Kilifi",
    "Kirinyaga",
    "Kisii",
    "Kisumu",
    "Kitui",
    "Kwale",
    "Laikipia",
    "Lamu",
    "Machakos",
    "Makueni",
    "Mandera",
    "Marsabit",
    "Meru",
    "Migori",
    "Mombasa",
    "Murang'a",
    "Nairobi",
    "Nakuru",
    "Nandi",
    "Narok",
    "Nyamira",
    "Nyandarua",
    "Nyeri",
    "Samburu",
    "Siaya",
    "Taita-Taveta",
    "Tana River",
    "Tharaka-Nithi",
    "Trans Nzoia",
    "Turkana",
    "Uasin Gishu",
    "Vihiga",
    "Wajir",
    "West Pokot",
  ];

  const currencies = [
    { code: "KES", name: "Kenyan Shilling (KES)" },
    { code: "USD", name: "US Dollar (USD)" },
    { code: "EUR", name: "Euro (EUR)" },
    { code: "GBP", name: "British Pound (GBP)" },
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, logo: file }));
    }
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const steps = [
    {
      id: 1,
      title: "Your details",
      description: "Provide an email and password",
      icon: User,
    },
    {
      id: 2,
      title: "Verify your email",
      description: "Enter your verification code",
      icon: Mail,
    },
    {
      id: 3,
      title: "Organization setup",
      description: "Set up your organization details",
      icon: Shield,
    },
    {
      id: 4,
      title: "Welcome to Payhub",
      description: "Get up and running in 3 minutes",
      icon: Users,
    },
  ];

  const renderProgressBar = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map((step) => (
        <React.Fragment key={step}>
          <div
            className={`w-3 h-3 rounded-full ${
              step <= currentStep ? "bg-green-600" : "bg-gray-300"
            }`}
          />
          {step < 4 && (
            <div
              className={`w-16 h-0.5 ${
                step < currentStep ? "bg-green-600" : "bg-gray-300"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderSidebar = () => (
    <div className="w-80 bg-gray-50 p-8 space-y-6 m-2 rounded-lg ">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
          <div className="w-4 h-4 bg-white rounded-sm"></div>
        </div>
        <span className="text-xl font-semibold">Pay hub.</span>
      </div>

      <div className="space-y-6">
        {steps.map((step) => {
          const IconComponent = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <div key={step.id} className="flex items-start space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isActive
                    ? "bg-black text-white"
                    : isCompleted
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3
                  className={`font-medium ${
                    isActive ? "text-black" : "text-gray-600"
                  }`}
                >
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Create a free account</CardTitle>
              <CardDescription>
                Provide your email and choose a password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Email</Label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                />
              </div>
              <Button
                onClick={nextStep}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Continue
              </Button>
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-background text-muted-foreground relative z-10 px-2">
                  Or continue with
                </span>
              </div>

              <div className="flex flex-wrap gap-4 justify-center">
                {/* Google */}
                <Button variant="outline" className="flex items-center">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </Button>

                {/* Microsoft */}
                <Button variant="outline" className="flex items-center">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 23 23">
                    <path fill="#f35022" d="M1 1h10v10H1z" />
                    <path fill="#7fba00" d="M12 1h10v10H12z" />
                    <path fill="#00a4ef" d="M1 12h10v10H1z" />
                    <path fill="#ffb900" d="M12 12h10v10H12z" />
                  </svg>
                  Microsoft
                </Button>

                {/* Zoho */}
                <Button variant="outline" className="flex items-center">
                  <svg
                    className="size-5 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 980 470"
                  >
                    <path
                      fill="#089949"
                      d="M458.1 353c-7.7 0-15.5-1.6-23-4.9l-160-71.3c-28.6-12.7-41.5-46.4-28.8-75l71.3-160C330.3 13.2 364 .3 392.6 13l160 71.3c28.6 12.7 41.5 46.4 28.8 75l-71.3 160c-9.5 21.2-30.3 33.7-52 33.7zm-9.7-34.9c12.1 5.4 26.3-.1 31.7-12.1l71.3-160c5.4-12.1-.1-26.3-12.1-31.7L379.2 43c-12.1-5.4-26.3.1-31.7 12.1l-71.3 160c-5.4 12.1.1 26.3 12.1 31.7z"
                    />
                    <path
                      fill="#f9b21d"
                      d="M960 353.1H784.8c-31.3 0-56.8-25.5-56.8-56.8V121.1c0-31.3 25.5-56.8 56.8-56.8H960c31.3 0 56.8 25.5 56.8 56.8v175.2c0 31.3-25.5 56.8-56.8 56.8zm-175.2-256c-13.2 0-24 10.8-24 24v175.2c0 13.2 10.8 24 24 24H960c13.2 0 24-10.8 24-24V121.1c0-13.2-10.8-24-24-24z"
                    />
                    <path
                      fill="#e42527"
                      d="M303.9 153.2 280.3 206c-.3.6-.6 1.1-.9 1.6l9.2 56.8c2.1 13.1-6.8 25.4-19.8 27.5l-173 28c-6.3 1-12.7-.5-17.9-4.2s-8.6-9.3-9.6-15.6l-28-173c-1-6.3.5-12.7 4.2-17.9s9.3-8.6 15.6-9.6l173-28c1.3-.2 2.6-.3 3.8-.3 11.5 0 21.8 8.4 23.7 20.2l9.3 57.2L294.3 94l-1.3-7.7c-5-30.9-34.2-52-65.1-47l-173 28C40 69.6 26.8 77.7 18 90c-8.9 12.3-12.4 27.3-10 42.3l28 173c2.4 15 10.5 28.1 22.8 37C68.5 349.4 80 353 91.9 353c3 0 6.1-.2 9.2-.7l173-28c30.9-5 52-34.2 47-65.1z"
                    />
                    <path
                      fill="#226db4"
                      d="m511.4 235.8 25.4-56.9-7.2-52.9c-.9-6.3.8-12.6 4.7-17.7s9.5-8.4 15.9-9.2l173.6-23.6c1.1-.1 2.2-.2 3.3-.2 5.2 0 10.2 1.7 14.5 4.9.8.6 1.5 1.3 2.2 1.9 7.7-8.1 17.8-13.9 29.1-16.4-3.2-4.4-7-8.3-11.5-11.7-12.1-9.2-27-13.1-42-11.1L545.6 66.5c-15 2-28.4 9.8-37.5 21.9-9.2 12.1-13.1 27-11.1 42zm295.4 29.3L784 97.1c-12.8.4-23.1 11-23.1 23.9v49.3l13.5 99.2c.9 6.3-.8 12.6-4.7 17.7s-9.5 8.4-15.9 9.2L580.2 320c-6.3.9-12.6-.8-17.7-4.7s-8.4-9.5-9.2-15.9l-8-58.9-25.4 56.9.9 6.4c2 15 9.8 28.4 21.9 37.5 10 7.6 21.9 11.6 34.3 11.6 2.6 0 5.2-.2 7.8-.5L758.2 329c15-2 28.4-9.8 37.5-21.9 9.2-12.1 13.1-27 11.1-42z"
                    />
                    <path d="M655.4 415.6c0-15 11-25.8 26-25.8 15.5 0 26 10.6 26 25.9 0 15.5-10.7 26.2-26.2 26.2-15.6 0-25.8-10.7-25.8-26.3zm40 .2c0-9.1-4.4-16.9-14.3-16.9-10 0-13.8 8.1-13.8 17.3 0 8.7 4.7 16.7 14.3 16.7 9.9-.1 13.8-8.6 13.8-17.1zm-150.9-25.2h7.4c1.1 0 2 .9 2 2v18.6h21v-18.6c0-1.1.9-2 2-2h7.4c1.1 0 2 .9 2 2v46.5c0 1.1-.9 2-2 2H577c-1.1 0-2-.9-2-2v-18.8h-21v18.8c0 1.1-.9 2-2 2h-7.4c-1.1 0-2-.9-2-2v-46.5c-.1-1.1.8-2 1.9-2zm-123.1 25c0-15 11-25.8 26-25.8 15.5 0 26 10.6 26 25.9 0 15.5-10.7 26.2-26.2 26.2-15.6 0-25.8-10.7-25.8-26.3zm40.1.2c0-9.1-4.4-16.9-14.3-16.9-10 0-13.8 8.1-13.8 17.3 0 8.7 4.7 16.7 14.3 16.7 9.9-.1 13.8-8.6 13.8-17.1zM317 436.2l24.8-36.6h-20.4c-1.1 0-2-.9-2-2v-4.9c0-1.1.9-2 2-2h33.5c1.1 0 2 .9 2 2v1.9c0 .4-.1.8-.3 1.1l-24.3 36.6h21.8c1.1 0 2 .9 2 2v4.9c0 1.1-.9 2-2 2h-35.4c-1.1 0-2-.9-2-2v-1.8c-.1-.5.1-.9.3-1.2z" />
                  </svg>
                  Zoho
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Verify your email</CardTitle>
              <CardDescription>Enter your verification code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-center space-y-2">
                <InputOTP maxLength={6} pattern={"[0-9]*"}>
                  <InputOTPGroup className="grid grid-cols-6 gap-2">
                    <InputOTPSlot className="rounded-md !border-l !border-gray-400" index={0} />
                    <InputOTPSlot className="rounded-md !border-l !border-gray-400" index={1} />
                    <InputOTPSlot className="rounded-md !border-l !border-gray-400" index={2} />
                    <InputOTPSlot className="rounded-md !border-l !border-gray-400" index={3} />
                    <InputOTPSlot className="rounded-md !border-l !border-gray-400" index={4} />
                    <InputOTPSlot className="rounded-md !border-l !border-gray-400" index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={prevStep} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={nextStep}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Verify
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Organization Setup</CardTitle>
              <CardDescription>
                Set up your organization details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name*</Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Enter company name"
                  value={formData.companyName}
                  onChange={(e) =>
                    handleInputChange("companyName", e.target.value)
                  }
                />
              </div>

              <div className="flex space-x-4 justify-between">
                <div className="w-full">
                  <Label htmlFor="currency" className="mb-2">
                    Currency*
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      handleInputChange("currency", value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full">
                  <Label htmlFor="location" className="mb-2">
                    Location*
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      handleInputChange("location", value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select county" />
                    </SelectTrigger>
                    <SelectContent>
                      {kenyanCounties.map((county) => (
                        <SelectItem key={county} value={county}>
                          {county}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Company Logo</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                  <Input
                    type="file"
                    id="logo"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="logo" className="cursor-pointer">
                    <Upload className="size-6 mx-auto mb-2 text-gray-400" />
                    <div className="text-sm text-gray-600">
                      
                      {formData.logo
                        ? formData.logo.name
                        : "Click to upload logo"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      PNG, JPG up to 4MB
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button variant="outline" onClick={prevStep} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={nextStep}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome to Payhub</CardTitle>
              <CardDescription>Get up and running in 3 minutes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-600">
                  Your account has been successfully created!
                </p>
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {renderSidebar()}

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={prevStep}
            className={currentStep === 1 ? "invisible" : ""}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to home
          </Button>
          <Button variant="ghost">Sign in</Button>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {renderProgressBar()}
            {renderStepContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UntitledUISignup;
