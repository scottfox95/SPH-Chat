import axios from 'axios';

/**
 * Fetches details about an Asana connection from MCP
 * @param connectionId The MCP connection ID for Asana
 * @returns Connection details including user information
 */
export async function getAsanaConnection(connectionId: string) {
  try {
    const response = await axios.get(`https://mcp.so/server/asana/${connectionId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching Asana connection:", error);
    throw new Error(`Failed to fetch Asana connection: ${(error as any).message}`);
  }
}

/**
 * Lists all Asana projects accessible via the connection
 * @param connectionId The MCP connection ID for Asana
 * @returns Array of Asana projects with ID and name
 */
export async function listAsanaProjects(connectionId: string) {
  try {
    const response = await axios.get(`https://mcp.so/server/asana/${connectionId}/projects`);
    return response.data;
  } catch (error) {
    console.error("Error listing Asana projects:", error);
    throw new Error(`Failed to list Asana projects: ${(error as any).message}`);
  }
}

/**
 * Fetches all tasks for a specific Asana project
 * @param connectionId The MCP connection ID for Asana
 * @param projectId The Asana project ID
 * @returns Array of tasks with details (name, due date, assignee, completion status)
 */
export async function getAsanaProjectTasks(connectionId: string, projectId: string) {
  try {
    const url = `https://mcp.so/server/asana/${connectionId}/project-tasks?project=${projectId}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching Asana project tasks:", error);
    throw new Error(`Failed to fetch Asana project tasks: ${(error as any).message}`);
  }
}

/**
 * Tests whether an Asana connection is valid
 * @param connectionId The MCP connection ID for Asana
 * @returns Object with validation result
 */
export async function testAsanaConnection(connectionId: string) {
  try {
    await getAsanaConnection(connectionId);
    return { 
      valid: true, 
      message: "Asana connection is valid" 
    };
  } catch (error) {
    return { 
      valid: false, 
      message: `Asana connection is invalid: ${(error as any).message}`
    };
  }
}

/**
 * Formats Asana task data for the chatbot context
 * @param tasks Array of Asana tasks
 * @returns Formatted task information suitable for chatbot context
 */
export function formatAsanaTasksForContext(tasks: any[]) {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  return tasks.map(task => {
    const dueDate = task.due_on ? new Date(task.due_on).toLocaleDateString() : 'No due date';
    const assignee = task.assignee ? task.assignee : 'Unassigned';
    const status = task.completed ? 'Completed' : 'In Progress';
    
    return `Task "${task.name}" - Due: ${dueDate}, Assigned to: ${assignee}, Status: ${status}`;
  });
}

/**
 * Gets overdue tasks from a list of Asana tasks
 * @param tasks Array of Asana tasks
 * @returns Array of overdue tasks
 */
export function getOverdueTasks(tasks: any[]) {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to beginning of day for comparison

  return tasks.filter(task => {
    // Skip completed tasks
    if (task.completed) return false;
    
    // Skip tasks with no due date
    if (!task.due_on) return false;
    
    const dueDate = new Date(task.due_on);
    dueDate.setHours(0, 0, 0, 0); // Set to beginning of day for comparison
    
    // Task is overdue if due date is before today
    return dueDate < today;
  });
}

/**
 * Gets incomplete tasks from a list of Asana tasks
 * @param tasks Array of Asana tasks
 * @returns Array of incomplete tasks
 */
export function getIncompleteTasks(tasks: any[]) {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  return tasks.filter(task => !task.completed);
}

/**
 * Gets tasks assigned to a specific person
 * @param tasks Array of Asana tasks
 * @param assigneeName Name of the assignee to filter by
 * @returns Array of tasks assigned to the specified person
 */
export function getTasksByAssignee(tasks: any[], assigneeName: string) {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0 || !assigneeName) {
    return [];
  }

  const lowerCaseAssigneeName = assigneeName.toLowerCase();

  return tasks.filter(task => {
    if (!task.assignee) return false;
    return task.assignee.toLowerCase().includes(lowerCaseAssigneeName);
  });
}