import { QueryClient } from "@tanstack/react-query";

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Helper function for API requests
export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  data?: any
) {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  return fetch(url, options);
}

// Helper function to create a queryFn
export function getQueryFn(options?: { on401?: "returnNull" | "throw" }) {
  return async ({ queryKey }: { queryKey: string[] }) => {
    const url = queryKey[0];
    const response = await apiRequest("GET", url);

    if (response.status === 401) {
      if (options?.on401 === "returnNull") {
        return null;
      }
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  };
}