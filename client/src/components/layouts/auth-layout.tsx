import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex min-h-screen flex-1 flex-col bg-background lg:grid lg:grid-cols-2">
        {/* Left Column - Auth Form */}
        <div className="flex flex-col justify-center px-4 py-12 md:px-6 xl:px-24">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px]">
            <div className="flex flex-col space-y-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded bg-primary/10">
                <img 
                  src="/SPHChat_Icon_PNG.png" 
                  alt="SPH Chat" 
                  className="h-10 w-10"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<span class="text-xl font-bold text-primary">SPH</span>';
                  }}
                />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome to SPH ChatBot
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in to your account or create a new one
              </p>
            </div>
            
            {children}
          </div>
        </div>
        
        {/* Right Column - Hero Section */}
        <div className="hidden lg:flex bg-muted items-center justify-center p-12">
          <div className="max-w-md text-center">
            <div className="mb-8 flex justify-center">
              <div className="rounded-full bg-background p-8 shadow-lg">
                <img 
                  src="/images/sph-chat-logo.png" 
                  alt="SPH ChatBot" 
                  className="h-24 w-24"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<span class="text-5xl font-bold text-primary">SPH</span>';
                  }}
                />
              </div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Intelligent Home Building Chatbots
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Create AI-powered chatbots that enhance project management for your homebuilding company. 
              Connect to Asana projects, upload documents, and provide intelligent responses to client inquiries.
            </p>
            <ul className="mt-8 space-y-4 text-left">
              <li className="flex items-center">
                <svg
                  className="h-5 w-5 text-primary flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="ml-2">Integrate with Asana projects</span>
              </li>
              <li className="flex items-center">
                <svg
                  className="h-5 w-5 text-primary flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="ml-2">Upload project documents</span>
              </li>
              <li className="flex items-center">
                <svg
                  className="h-5 w-5 text-primary flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="ml-2">Create smart conversational interfaces</span>
              </li>
              <li className="flex items-center">
                <svg
                  className="h-5 w-5 text-primary flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="ml-2">Generate weekly project summaries</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}