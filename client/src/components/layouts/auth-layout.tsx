import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-8">
      <div className="grid lg:grid-cols-2 gap-8 w-full max-w-6xl">
        {/* Auth Form Card */}
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="flex justify-center mb-8">
              <img 
                src="/images/sph-chat-logo.png" 
                alt="SPH Chat Logo" 
                className="h-16" 
              />
            </div>
            {children}
          </CardContent>
        </Card>

        {/* Hero Content */}
        <div className="hidden lg:flex flex-col justify-center p-8 rounded-lg bg-primary text-primary-foreground shadow-lg">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to SPH Chat
            </h1>
            <p className="text-lg opacity-90">
              A powerful AI-driven platform empowering homebuilding companies to create dynamic chatbots with project management capabilities.
            </p>
            <ul className="space-y-2 opacity-90">
              <li className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Asana project integration
              </li>
              <li className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Interactive AI-powered chatbots
              </li>
              <li className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Document storage and search
              </li>
              <li className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Slack channel sync
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}