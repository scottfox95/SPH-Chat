/**
 * Asana integration library for SPH ChatBot
 * Allows fetching tasks from Asana for specific projects
 */

// Simple implementation using fetch API without additional libraries
// This approach keeps dependencies minimal
import { storage } from "../storage";

// Base URL for Asana API
const ASANA_API_BASE = "https://app.asana.com/api/1.0";

/**
 * Retrieves the Asana Personal Access Token (PAT)
 * First tries the environment variable (ASANA_PAT), then falls back to database
 * Validates token format and prioritizes tokens that match expected Asana PAT format
 * @returns The Asana PAT or null if not configured
 */
async function getAsanaPAT(): Promise<string | null> {
  try {
    console.log("Attempting to retrieve Asana PAT");
    
    // First try the environment variable as it will be most up-to-date
    const envToken = process.env.ASANA_PAT;
    console.log("Checking environment variable, token exists:", !!envToken);
    
    if (envToken) {
      console.log("Environment token found, length:", envToken.length);
      console.log("Environment token first 5 chars:", envToken.substring(0, 5));
      
      // Validate token format for Asana PAT (should start with "1/" or "2/" for Asana PATs)
      if (envToken.startsWith("1/") || envToken.startsWith("2/")) {
        console.log(`Environment token format appears valid (starts with ${envToken.substring(0, 2)})`);
        return envToken;
      } else {
        console.warn("Environment token format may be invalid - does not start with '1/' or '2/'");
        // Continue to try database token as fallback
      }
    }
    
    // If no environment token or format is invalid, try database
    console.log("Checking database for Asana PAT");
    const token = await storage.getApiToken('asana');
    
    if (token && token.tokenHash) {
      console.log("Asana token found in database, tokenHash length:", token.tokenHash.length);
      try {
        // Decode the token from base64
        const decodedToken = Buffer.from(token.tokenHash, 'base64').toString();
        console.log("Database token successfully decoded, length:", decodedToken.length);
        
        // Validate token format for Asana PAT (should start with "1/" or "2/" for Asana PATs)
        if (decodedToken.startsWith("1/") || decodedToken.startsWith("2/")) {
          console.log(`Database token format appears valid (starts with ${decodedToken.substring(0, 2)})`);
          return decodedToken;
        } else {
          console.warn("Database token format may be invalid - does not start with '1/' or '2/'");
          console.log("Database token first 5 chars:", decodedToken.substring(0, 5));
          
          // If we have environment token (even if invalid format), prefer it over invalid db token
          if (envToken) {
            console.log("Using environment token despite format concerns");
            return envToken;
          }
          
          // Otherwise return the database token as last resort
          return decodedToken;
        }
      } catch (decodeError) {
        console.error("Error decoding token from base64:", decodeError);
        console.log("Raw token hash (first 10 chars):", token.tokenHash.substring(0, 10));
        
        // If there was an error decoding but we have env token, return that
        if (envToken) {
          console.log("Using environment token due to decode error");
          return envToken;
        }
      }
    } else {
      console.log("No Asana token found in database");
    }
    
    // If we get here, no valid tokens were found
    console.log("No valid Asana tokens found in environment or database");
    return null;
  } catch (error) {
    console.error("Error retrieving Asana PAT:", error);
    // Last resort fallback to environment variable
    const envToken = process.env.ASANA_PAT;
    console.log("Error occurred, trying environment variable as last resort, token exists:", !!envToken);
    return envToken || null;
  }
}

// Interface for Asana API responses
interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
  assignee: {
    gid: string;
    name: string;
  } | null;
  notes: string;
  resource_type: string;
}

interface AsanaApiResponse<T> {
  data: T;
}

interface AsanaProject {
  gid: string;
  name: string;
  resource_type: string;
}

interface AsanaWorkspace {
  gid: string;
  name: string;
  resource_type: string;
}

/**
 * Tests the connection to Asana using the provided PAT
 * @returns Object with connection status and details
 */
export async function testAsanaConnection(): Promise<{
  connected: boolean;
  message?: string;
  workspaces?: { id: string; name: string }[];
  error?: string;
}> {
  try {
    console.log("Testing Asana connection");
    
    // Check if Asana PAT is available
    const token = await getAsanaPAT();
    if (!token) {
      console.log("No Asana token available");
      return {
        connected: false,
        message: "Asana PAT is not configured",
        error: "No Asana PAT found in storage or environment variables"
      };
    }
    
    console.log("Asana token retrieved, first 5 chars:", token.substring(0, 5));
    console.log("Token length:", token.length);

    // Test API access by fetching user data
    // Try different authorization formats based on token structure
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    
    // For Asana Personal Access Tokens, the format should be "Bearer" + token
    // Asana PAT format can start with "1/" or "2/"
    if (token.startsWith("1/") || token.startsWith("2/")) {
      console.log(`Using standard Bearer authorization format for ${token.substring(0, 2)} token`);
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      // If token doesn't have the expected format, try standard format anyway
      console.log("Token format not recognized, trying standard Bearer format anyway");
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    console.log("Making request to Asana API /users/me");
    const response = await fetch(`${ASANA_API_BASE}/users/me`, {
      headers,
    });

    console.log("Asana API response status:", response.status);
    const data = await response.json();
    console.log("Asana API response data:", JSON.stringify(data).substring(0, 200) + "...");

    if (response.status !== 200) {
      console.log("Asana API connection failed:", data.errors?.[0]?.message);
      return {
        connected: false,
        message: "Failed to connect to Asana API",
        error: data.errors?.[0]?.message || "Unknown error"
      };
    }

    // If successful, also fetch workspaces for the user
    // This helps validate that the PAT has appropriate permissions
    const workspacesResponse = await fetch(`${ASANA_API_BASE}/workspaces`, {
      headers,
    });

    const workspacesData = await workspacesResponse.json();
    const workspaces = workspacesData.data?.map((workspace: AsanaWorkspace) => ({
      id: workspace.gid,
      name: workspace.name
    })) || [];

    return {
      connected: true,
      message: `Successfully connected to Asana as ${data.data.name}`,
      workspaces
    };
  } catch (error: any) {
    console.error("Error testing Asana connection:", error);
    return {
      connected: false,
      message: "Failed to connect to Asana API",
      error: error.message || "Unknown error"
    };
  }
}

/**
 * Gets tasks from a specific Asana project
 * @param projectId The ID of the Asana project to fetch tasks from
 * @param completed Whether to include completed tasks (default: false)
 * @returns Array of task objects
 */
export async function getAsanaProjectTasks(
  projectId: string,
  completed: boolean = false
): Promise<{
  success: boolean;
  tasks?: any[];
  projectName?: string;
  error?: string;
}> {
  try {
    // Check if Asana PAT is available
    const token = await getAsanaPAT();
    if (!token) {
      return {
        success: false,
        error: "Asana PAT is not configured"
      };
    }

    if (!projectId) {
      return {
        success: false,
        error: "Project ID is required"
      };
    }

    // Create headers with authorization
    // Try different authorization formats based on token structure
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    
    // For Asana Personal Access Tokens, the format should be "Bearer" + token
    // Asana PAT format can start with "1/" or "2/"
    if (token.startsWith("1/") || token.startsWith("2/")) {
      console.log(`Using standard Bearer authorization format for ${token.substring(0, 2)} token (tasks request)`);
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      console.log("Token format not recognized, trying standard Bearer format anyway for tasks request");
      headers["Authorization"] = `Bearer ${token}`;
    }

    // First, get project details to verify it exists and get the name
    const projectResponse = await fetch(`${ASANA_API_BASE}/projects/${projectId}`, {
      headers,
    });

    if (projectResponse.status !== 200) {
      const errorData = await projectResponse.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.message || `Project with ID ${projectId} not found`
      };
    }

    const projectData: AsanaApiResponse<AsanaProject> = await projectResponse.json();
    const projectName = projectData.data.name;

    // Get tasks for the project
    const tasksResponse = await fetch(
      `${ASANA_API_BASE}/tasks?project=${projectId}&completed=${completed}&opt_fields=name,completed,due_on,assignee,notes`,
      {
        headers,
      }
    );

    if (tasksResponse.status !== 200) {
      const errorData = await tasksResponse.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.message || "Failed to fetch tasks"
      };
    }

    const tasksData = await tasksResponse.json();
    
    // Format the tasks for easier consumption
    const formattedTasks = tasksData.data.map((task: AsanaTask) => ({
      id: task.gid,
      name: task.name,
      completed: task.completed,
      dueDate: task.due_on,
      assignee: task.assignee?.name || null,
      notes: task.notes || ""
    }));

    return {
      success: true,
      tasks: formattedTasks,
      projectName
    };
  } catch (error: any) {
    console.error("Error fetching Asana tasks:", error);
    return {
      success: false,
      error: error.message || "Unknown error"
    };
  }
}

/**
 * Gets task details from Asana
 * @param taskId The ID of the task to fetch details for
 * @returns Task details object
 */
export async function getAsanaTaskDetails(taskId: string): Promise<{
  success: boolean;
  task?: any;
  error?: string;
}> {
  try {
    // Check if Asana PAT is available
    const token = await getAsanaPAT();
    if (!token) {
      return {
        success: false,
        error: "Asana PAT is not configured"
      };
    }

    if (!taskId) {
      return {
        success: false,
        error: "Task ID is required"
      };
    }

    // Create headers with authorization
    // Try different authorization formats based on token structure
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    
    // For Asana Personal Access Tokens, the format should be "Bearer" + token
    // Asana PAT format can start with "1/" or "2/"
    if (token.startsWith("1/") || token.startsWith("2/")) {
      console.log(`Using standard Bearer authorization format for ${token.substring(0, 2)} token (task details request)`);
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      console.log("Token format not recognized, trying standard Bearer format anyway for task details request");
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `${ASANA_API_BASE}/tasks/${taskId}?opt_fields=name,completed,due_on,assignee,notes,projects,custom_fields,dependencies,dependents,subtasks`,
      {
        headers,
      }
    );

    if (response.status !== 200) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.message || `Task with ID ${taskId} not found`
      };
    }

    const data = await response.json();
    
    // Format the task for easier consumption
    const task = data.data;
    const formattedTask = {
      id: task.gid,
      name: task.name,
      completed: task.completed,
      dueDate: task.due_on,
      assignee: task.assignee?.name || null,
      notes: task.notes || "",
      projects: task.projects?.map((p: any) => ({ id: p.gid, name: p.name })) || [],
      customFields: task.custom_fields?.map((cf: any) => ({
        name: cf.name,
        value: cf.display_value || cf.text_value || cf.number_value || cf.enum_value?.name || null
      })) || [],
      dependencies: task.dependencies?.map((d: any) => d.gid) || [],
      dependents: task.dependents?.map((d: any) => d.gid) || [],
      subtasks: task.subtasks?.map((s: any) => ({
        id: s.gid,
        name: s.name,
        completed: s.completed
      })) || []
    };

    return {
      success: true,
      task: formattedTask
    };
  } catch (error: any) {
    console.error("Error fetching Asana task details:", error);
    return {
      success: false,
      error: error.message || "Unknown error"
    };
  }
}

/**
 * Gets all projects from a workspace
 * @param workspaceId The ID of the workspace to fetch projects from
 * @returns Array of project objects
 */
export async function getAsanaProjects(workspaceId: string, offset?: string): Promise<{
  success: boolean;
  projects?: { id: string; name: string }[];
  next_page?: { offset: string };
  error?: string;
}> {
  try {
    // Check if Asana PAT is available
    const token = await getAsanaPAT();
    if (!token) {
      return {
        success: false,
        error: "Asana PAT is not configured"
      };
    }

    if (!workspaceId) {
      return {
        success: false,
        error: "Workspace ID is required"
      };
    }

    // Create headers with authorization
    // Try different authorization formats based on token structure
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    
    // For Asana Personal Access Tokens, the format should be "Bearer" + token
    // Asana PAT format can start with "1/" or "2/"
    if (token.startsWith("1/") || token.startsWith("2/")) {
      console.log(`Using standard Bearer authorization format for ${token.substring(0, 2)} token (projects request)`);
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      console.log("Token format not recognized, trying standard Bearer format anyway for projects request");
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Build URL with pagination
    let url = `${ASANA_API_BASE}/projects?workspace=${workspaceId}&limit=100`;
    if (offset) {
      url += `&offset=${offset}`;
    }

    console.log(`Fetching Asana projects with URL: ${url}`);
    const response = await fetch(url, { headers });

    if (response.status !== 200) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.message || "Failed to fetch projects"
      };
    }

    const data = await response.json();
    
    // Format the projects for easier consumption
    const projects = data.data.map((project: AsanaProject) => ({
      id: project.gid,
      name: project.name
    }));

    // Check for pagination info
    const next_page = data.next_page ? { offset: data.next_page.offset } : undefined;

    return {
      success: true,
      projects,
      next_page
    };
  } catch (error: any) {
    console.error("Error fetching Asana projects:", error);
    return {
      success: false,
      error: error.message || "Unknown error"
    };
  }
}

/**
 * Formats Asana tasks for display in a chatbot response
 * @param tasks Array of Asana tasks
 * @param projectName Name of the project
 * @returns Formatted string for chatbot response
 */
export function formatTasksForChatbot(
  tasks: any[],
  projectName: string,
  filter: 'all' | 'overdue' | 'upcoming' | 'completed' = 'all'
): string {
  if (!tasks || tasks.length === 0) {
    return `No tasks found for project "${projectName}".`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let filteredTasks = [...tasks];

  // Apply filters
  if (filter === 'overdue') {
    filteredTasks = tasks.filter(task => {
      if (!task.dueDate || task.completed) return false;
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
  } else if (filter === 'upcoming') {
    filteredTasks = tasks.filter(task => {
      if (!task.dueDate || task.completed) return false;
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today;
    });
  } else if (filter === 'completed') {
    filteredTasks = tasks.filter(task => task.completed);
  }

  if (filteredTasks.length === 0) {
    if (filter === 'overdue') {
      return `No overdue tasks found for project "${projectName}".`;
    } else if (filter === 'upcoming') {
      return `No upcoming tasks found for project "${projectName}".`;
    } else if (filter === 'completed') {
      return `No completed tasks found for project "${projectName}".`;
    }
    return `No tasks found for project "${projectName}".`;
  }

  // Format the tasks
  let result = '';
  
  if (filter === 'overdue') {
    result = `Here are the overdue tasks for project "${projectName}":\n\n`;
  } else if (filter === 'upcoming') {
    result = `Here are the upcoming tasks for project "${projectName}":\n\n`;
  } else if (filter === 'completed') {
    result = `Here are the completed tasks for project "${projectName}":\n\n`;
  } else {
    result = `Here are the tasks for project "${projectName}":\n\n`;
  }

  filteredTasks.forEach(task => {
    const status = task.completed ? '✓' : '○';
    const dueString = task.dueDate ? ` (due ${task.dueDate})` : '';
    const assigneeString = task.assignee ? ` - Assigned to: ${task.assignee}` : '';
    
    result += `${status} ${task.name}${dueString}${assigneeString}\n`;
  });

  result += `\n[Source: Asana project "${projectName}"]`;
  
  return result;
}