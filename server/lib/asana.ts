import axios from 'axios';

const MCP_API_BASE_URL = 'https://mcp.so/api';

/**
 * Fetches details about an Asana connection from MCP
 * @param connectionId The MCP connection ID for Asana
 * @returns Connection details including user information
 */
export async function getAsanaConnection(connectionId: string) {
  try {
    const response = await axios.get(`${MCP_API_BASE_URL}/connections/${connectionId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Asana connection:', error);
    throw new Error('Failed to fetch Asana connection details');
  }
}

/**
 * Lists all Asana projects accessible via the connection
 * @param connectionId The MCP connection ID for Asana
 * @returns Array of Asana projects with ID and name
 */
export async function listAsanaProjects(connectionId: string) {
  try {
    const response = await axios.get(`${MCP_API_BASE_URL}/connections/${connectionId}/asana/projects`);
    return response.data.projects || [];
  } catch (error) {
    console.error('Error listing Asana projects:', error);
    throw new Error('Failed to fetch Asana projects');
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
    const response = await axios.get(
      `${MCP_API_BASE_URL}/connections/${connectionId}/asana/projects/${projectId}/tasks`
    );
    return response.data.tasks || [];
  } catch (error) {
    console.error('Error fetching Asana project tasks:', error);
    throw new Error('Failed to fetch Asana project tasks');
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
    return { valid: true, message: 'Asana connection is valid' };
  } catch (error) {
    return { valid: false, message: 'Invalid Asana connection' };
  }
}

/**
 * Formats Asana task data for the chatbot context
 * @param tasks Array of Asana tasks
 * @returns Formatted task information suitable for chatbot context
 */
export function formatAsanaTasksForContext(tasks: any[]) {
  if (!tasks || !tasks.length) {
    return ['No tasks found in the connected Asana project.'];
  }
  
  return tasks.map((task) => {
    const dueDate = task.due_on ? ` (Due: ${task.due_on})` : '';
    const assignee = task.assignee ? ` [Assigned to: ${task.assignee.name}]` : ' [Unassigned]';
    const status = task.completed ? '✓' : '○';
    
    return `${status} Task: ${task.name}${dueDate}${assignee}`;
  });
}