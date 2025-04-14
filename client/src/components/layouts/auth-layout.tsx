import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl bg-[#D2B48C] flex items-center justify-center">
              <span className="text-white font-semibold text-lg">SPH</span>
            </div>
            <span className="ml-3 text-xl font-semibold text-gray-900">HomeBuildBot</span>
          </div>
        </div>
        
        {children}
      </div>
    </div>
  );
}
