/**
 * Asana integration library for SPH ChatBot
 * Allows fetching tasks from Asana for specific projects
 */

// Simple implementation using fetch API without additional libraries
// This approach keeps dependencies minimal

// Check if Asana PAT is available
const ASANA_PAT = process.env.ASANA_PAT;
if (!ASANA_PAT) {
  console.warn("Warning: ASANA_PAT environment variable is not set. Asana integration will not work.");
}

// Base URL for Asana API
const ASANA_API_BASE = "https://app.asana.com/api/1.0";

// Create headers with authorization
const getHeaders = () => ({
  "Authorization": `Bearer ${ASANA_PAT}`,
  "Content-Type": "application/json",
  "Accept": "application/json"
});

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
    if (!ASANA_PAT) {
      return {
        connected: false,
        message: "Asana PAT is not configured",
        error: "Missing ASANA_PAT environment variable"
      };
    }

    // Test API access by fetching user data
    const response = await fetch(`${ASANA_API_BASE}/users/me`, {
      headers: getHeaders(),
    });

    const data = await response.json();

    if (response.status !== 200) {
      return {
        connected: false,
        message: "Failed to connect to Asana API",
        error: data.errors?.[0]?.message || "Unknown error"
      };
    }

    // If successful, also fetch workspaces for the user
    // This helps validate that the PAT has appropriate permissions
    const workspacesResponse = await fetch(`${ASANA_API_BASE}/workspaces`, {
      headers: getHeaders(),
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
    if (!ASANA_PAT) {
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

    // First, get project details to verify it exists and get the name
    const projectResponse = await fetch(`${ASANA_API_BASE}/projects/${projectId}`, {
      headers: getHeaders(),
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
        headers: getHeaders(),
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
    if (!ASANA_PAT) {
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

    const response = await fetch(
      `${ASANA_API_BASE}/tasks/${taskId}?opt_fields=name,completed,due_on,assignee,notes,projects,custom_fields,dependencies,dependents,subtasks`,
      {
        headers: getHeaders(),
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
export async function getAsanaProjects(workspaceId: string): Promise<{
  success: boolean;
  projects?: { id: string; name: string }[];
  error?: string;
}> {
  try {
    if (!ASANA_PAT) {
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

    const response = await fetch(
      `${ASANA_API_BASE}/projects?workspace=${workspaceId}&limit=100`,
      {
        headers: getHeaders(),
      }
    );

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

    return {
      success: true,
      projects
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