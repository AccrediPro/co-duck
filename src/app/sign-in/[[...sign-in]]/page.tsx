import { SignIn } from '@clerk/nextjs';
import { CheckCircle, Shield, Users, Zap } from 'lucide-react';

const benefits = [
  {
    icon: Users,
    title: 'Expert Coaches',
    description: 'Access to certified coaches across various specialties',
  },
  {
    icon: Zap,
    title: 'Flexible Scheduling',
    description: 'Book sessions that fit your schedule, anytime',
  },
  {
    icon: Shield,
    title: 'Secure Platform',
    description: 'Your data and sessions are protected with encryption',
  },
  {
    icon: CheckCircle,
    title: 'Proven Results',
    description: 'Join thousands achieving their goals with coaching',
  },
];

export default function SignInPage() {
  return (
    <div className="flex min-h-screen">
      {/* Benefits Section - Hidden on mobile, visible on larger screens */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 text-white p-12 flex-col justify-center">
        <div className="max-w-md mx-auto">
          <h1 className="text-4xl font-bold mb-6">Welcome Back</h1>
          <p className="text-blue-100 text-lg mb-10">
            Continue your coaching journey and unlock your full potential.
          </p>

          <div className="space-y-6">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                  <benefit.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{benefit.title}</h3>
                  <p className="text-blue-100 text-sm">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-blue-500/30">
            <p className="text-blue-100 text-sm">
              &quot;This platform helped me find the perfect coach for my career transition.
              Highly recommend!&quot;
            </p>
            <p className="mt-2 font-medium">— Sarah M., Career Coaching Client</p>
          </div>
        </div>
      </div>

      {/* Sign In Form Section */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md">
          {/* Mobile-only header */}
          <div className="md:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-600 mt-2">Sign in to continue your coaching journey</p>
          </div>

          <SignIn
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-lg rounded-xl',
                headerTitle: 'text-xl font-bold',
                headerSubtitle: 'text-gray-600',
                socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50',
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
                footerActionLink: 'text-blue-600 hover:text-blue-700',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
