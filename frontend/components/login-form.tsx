'use client';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  const { login } = useAuth();

  // Block user after 5 failed attempts for 5 minutes
  const MAX_ATTEMPTS = 5;
  const BLOCK_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBlocked && blockTimeRemaining > 0) {
      interval = setInterval(() => {
        setBlockTimeRemaining((prev) => {
          if (prev <= 1000) {
            setIsBlocked(false);
            setLoginAttempts(0);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBlocked, blockTimeRemaining]);

  const validateEmail = (email: string): string | undefined => {
    if (!email) return 'Email is required';
    if (email.length < 3) return 'Email must be at least 3 characters';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password.length > 100) return 'Password must be less than 100 characters';
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: 'email' | 'password', value: string) => {
    if (field === 'email') {
      setEmail(value);
      if (touched.email) {
        const error = validateEmail(value);
        setErrors(prev => ({ ...prev, email: error }));
      }
    } else {
      setPassword(value);
      if (touched.password) {
        const error = validatePassword(value);
        setErrors(prev => ({ ...prev, password: error }));
      }
    }
    
    // Clear general error when user starts typing
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: undefined }));
    }
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    if (field === 'email') {
      const error = validateEmail(email);
      setErrors(prev => ({ ...prev, email: error }));
    } else {
      const error = validatePassword(password);
      setErrors(prev => ({ ...prev, password: error }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBlocked) {
      setErrors({ general: `Too many failed attempts. Please try again in ${Math.ceil(blockTimeRemaining / 1000)} seconds.` });
      return;
    }

    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      const success = await login(email, password);
      
      if (!success) {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        
        if (newAttempts >= MAX_ATTEMPTS) {
          setIsBlocked(true);
          setBlockTimeRemaining(BLOCK_DURATION);
          setErrors({ 
            general: `Too many failed attempts. Account temporarily blocked for ${BLOCK_DURATION / 60000} minutes.` 
          });
        } else {
          setErrors({ 
            general: `Invalid email or password. ${MAX_ATTEMPTS - newAttempts} attempts remaining.` 
          });
        }
      } else {
        // Reset attempts on successful login
        setLoginAttempts(0);
        setIsBlocked(false);
        setBlockTimeRemaining(0);
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          setErrors({ general: 'Network error. Please check your connection and try again.' });
        } else if (error.message.includes('timeout')) {
          setErrors({ general: 'Request timed out. Please try again.' });
        } else {
          setErrors({ general: 'An unexpected error occurred. Please try again later.' });
        }
      } else {
        setErrors({ general: 'An unexpected error occurred. Please try again later.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col items-center gap-2 text-center">
        {/* <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: '#895bf5' }}>
            P
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#895bf5' }}>PayHub</h1>
        </div> */}
        <h2 className="text-xl font-semibold">Welcome back</h2>
      </div>

      {errors.general && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.general}</AlertDescription>
        </Alert>
      )}

      {isBlocked && blockTimeRemaining > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Account temporarily blocked. Try again in {formatTime(blockTimeRemaining)}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            className={cn(
              "transition-all duration-200",
              errors.email 
                ? "border-red-500 focus:border-red-500 focus:ring-red-200" 
                : "focus:border-[#895bf5] focus:ring-[#895bf5]/20",
              !errors.email && touched.email && email && "border-green-500 focus:border-green-500"
            )}
            disabled={isLoading || isBlocked}
            autoComplete="email"
            aria-describedby={errors.email ? "email-error" : undefined}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.email}
            </p>
          )}
          {!errors.email && touched.email && email && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Valid email address
            </p>
          )}
        </div>

        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline transition-colors"
              style={{ color: '#895bf5' }}
              tabIndex={isLoading || isBlocked ? -1 : 0}
            >
              Forgot your password?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              className={cn(
                "pr-10 transition-all duration-200",
                errors.password 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200" 
                  : "focus:border-[#895bf5] focus:ring-[#895bf5]/20",
                !errors.password && touched.password && password && "border-green-500 focus:border-green-500"
              )}
              placeholder="Enter your password"
              disabled={isLoading || isBlocked}
              autoComplete="current-password"
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
              disabled={isLoading || isBlocked}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.password}
            </p>
          )}
          {!errors.password && touched.password && password && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Password meets requirements
            </p>
          )}
        </div>

        <Button 
          type="submit" 
          className="w-full transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            backgroundColor: '#895bf5',
            borderColor: '#895bf5'
          }}
          disabled={isLoading || isBlocked || !!errors.email || !!errors.password || !!errors.general || !email || !password}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              Signing in...
            </div>
          ) : (
            'Sign in to PayHub'
          )}
        </Button>

        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="bg-background text-muted-foreground relative z-10 px-2">
            Or continue with
          </span>
        </div>

        <Button 
          variant="outline" 
          type="button"
          className="w-full transition-all duration-200 hover:shadow-md"
          disabled={isLoading || isBlocked}
          style={{
            borderColor: '#895bf5',
            color: '#895bf5'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 mr-2">
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
              fill="currentColor"
            />
          </svg>
          Continue with GitHub
        </Button>
      </div>

      <div className="text-center text-sm">
        Don't have an account?{" "}
        <a 
          href="#" 
          className="underline underline-offset-4 font-medium transition-colors hover:opacity-80"
          style={{ color: '#895bf5' }}
          tabIndex={isLoading || isBlocked ? -1 : 0}
        >
          Create account
        </a>
      </div>
    </form>
  );
}