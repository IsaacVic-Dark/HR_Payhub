'use client'
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Calculator, 
  Clock, 
  Shield, 
  TrendingUp, 
  FileText,
  Star,
  CheckCircle,
  ArrowRight,
  Smartphone,
  Globe,
  Award
} from 'lucide-react';

const PayrollLanding = () => {
  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const features = [
    {
      icon: <Users className="w-8 h-8 text-[#895bf5]" />,
      title: "Employee Management",
      description: "Comprehensive employee database with easy management tools"
    },
    {
      icon: <Calculator className="w-8 h-8 text-[#895bf5]" />,
      title: "Automated Calculations",
      description: "Accurate payroll calculations with tax deductions and benefits"
    },
    {
      icon: <Clock className="w-8 h-8 text-[#895bf5]" />,
      title: "Time Tracking",
      description: "Built-in time tracking with overtime and leave management"
    },
    {
      icon: <Shield className="w-8 h-8 text-[#895bf5]" />,
      title: "Secure & Compliant",
      description: "Bank-level security with full compliance to local regulations"
    },
    {
      icon: <FileText className="w-8 h-8 text-[#895bf5]" />,
      title: "Detailed Reports",
      description: "Comprehensive payroll reports and analytics at your fingertips"
    },
    {
      icon: <Smartphone className="w-8 h-8 text-[#895bf5]" />,
      title: "Mobile Access",
      description: "Access your payroll system anywhere, anytime from any device"
    }
  ];

  const benefits = [
    { percentage: "+40%", title: "Time Operational Saved", description: "Reduce manual work significantly" },
    { percentage: "+35%", title: "Organization Efficiency", description: "Streamlined payroll processes" },
    { percentage: "+70%", title: "Accurate & Fast Processes", description: "Error-free calculations every time" }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "HR Director",
      company: "TechCorp",
      rating: 5,
      comment: "This payroll system has transformed our HR operations. The automation features save us hours every week."
    },
    {
      name: "Michael Chen",
      role: "Finance Manager", 
      company: "StartupXYZ",
      rating: 5,
      comment: "Incredibly user-friendly and powerful. The reporting features give us insights we never had before."
    },
    {
      name: "Lisa Rodriguez",
      role: "Operations Head",
      company: "GrowthCo",
      rating: 5,
      comment: "Best investment we've made. The compliance features alone are worth the switch."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-[#895bf5] rounded-lg flex items-center justify-center">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">PayrollPro</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-[#895bf5] transition-colors">Features</a>
            <a href="#benefits" className="text-gray-600 hover:text-[#895bf5] transition-colors">Benefits</a>
            <a href="#testimonials" className="text-gray-600 hover:text-[#895bf5] transition-colors">Reviews</a>
            <Button variant="outline" className="border-[#895bf5] text-[#895bf5] hover:bg-[#895bf5] hover:text-white">
              Learn More
            </Button>
            <Button onClick={navigateToLogin} className="bg-[#895bf5] hover:bg-[#7c4ee0] text-white">
              Login
            </Button>
          </nav>
          <Button onClick={navigateToLogin} className="md:hidden bg-[#895bf5] hover:bg-[#7c4ee0] text-white">
            Login
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl lg:text-4xl font-bold text-gray-900 leading-tight">
                Enjoy the Experience of Managing{' '}
                <span className="text-[#895bf5]">HR & Payroll</span>{' '}
                at your Fingertips.
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Streamline your payroll processes with our powerful, intuitive platform. 
                Save time, reduce errors, and keep your team happy with automated payroll management.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={navigateToLogin}
                  className="bg-[#895bf5] hover:bg-[#7c4ee0] text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Get Started Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  variant="outline" 
                  className="border-2 border-[#895bf5] text-[#895bf5] hover:bg-[#895bf5] hover:text-white px-8 py-6 text-lg rounded-xl"
                >
                  Watch Demo
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-6 transform hover:scale-105 transition-transform duration-300">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Dashboard Overview</h3>
                    <Badge className="bg-green-100 text-green-800">Live</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#895bf5]/10 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-[#895bf5]">142</div>
                      <div className="text-sm text-gray-600">Active Employees</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">$89.2K</div>
                      <div className="text-sm text-gray-600">Monthly Payroll</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Processing Status</span>
                      <span className="text-sm text-[#895bf5] font-medium">85%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-[#895bf5] h-2 rounded-full w-[85%]"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-[#895bf5]/20 rounded-full blur-xl"></div>
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-yellow-400/30 rounded-full blur-lg"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-12 bg-white/50">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-500 mb-8">Trusted by leading companies worldwide</p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-200 rounded-lg px-8 py-4">
                <div className="w-24 h-8 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-[#895bf5]/10 text-[#895bf5] border-[#895bf5]/20 mb-4">
              Features
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Payroll so powerful it can run itself
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover the advanced features that make our payroll system the choice of modern businesses
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-16 h-16 bg-[#895bf5]/10 rounded-xl flex items-center justify-center mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl text-gray-900">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 bg-gradient-to-r from-[#895bf5]/5 to-purple-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-[#895bf5]/10 text-[#895bf5] border-[#895bf5]/20 mb-4">
              Benefits
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              HRIS Technology that benefits present & future
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur">
                <CardContent className="pt-8 pb-8">
                  <div className="w-16 h-16 bg-[#895bf5]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <TrendingUp className="w-8 h-8 text-[#895bf5]" />
                  </div>
                  <div className="text-4xl font-bold text-[#895bf5] mb-2">{benefit.percentage}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                  <p className="text-gray-600">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-[#895bf5]/10 text-[#895bf5] border-[#895bf5]/20 mb-4">
              Testimonials
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why our customers think we're the best
            </h2>
            <div className="flex justify-center items-center gap-2 mb-4">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="text-2xl font-bold text-gray-900 ml-2">4.9</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="pt-6">
                  <div className="flex mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-6 italic">"{testimonial.comment}"</p>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.role} at {testimonial.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-[#895bf5] to-[#7c4ee0]">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Start enjoying the best experience in managing HR with PayrollPro
          </h2>
          <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
            Join thousands of companies already using our platform to streamline their payroll processes
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={navigateToLogin}
              className="bg-white text-[#895bf5] hover:bg-gray-100 px-8 py-6 text-lg rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Start Free Trial
            </Button>
            <Button 
              variant="outline" 
              className="border-2 border-white text-white hover:bg-white hover:text-[#895bf5] px-8 py-6 text-lg rounded-xl font-semibold"
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-[#895bf5] rounded-lg flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold">PayrollPro</span>
              </div>
              <p className="text-gray-400 mb-4">
                Revolutionizing payroll management for modern businesses worldwide.
              </p>
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[#895bf5] transition-colors">
                  <Globe className="w-5 h-5" />
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400">&copy; 2024 PayrollPro. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PayrollLanding;