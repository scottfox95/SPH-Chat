import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, PlusCircle, Pencil, Trash2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Redirect } from "wouter";

// Define user type
interface User {
  id: number;
  username: string;
  displayName: string;
  initial: string;
  role: string;
}

// Define project type
interface Project {
  id: number;
  name: string;
  description: string | null;
  createdById: number;
  createdAt: string;
}

// Define user-project assignment type
interface UserProject {
  id: number;
  userId: number;
  projectId: number;
  createdAt: string;
}

// Form schema for creating/editing users
const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  initial: z.string().min(1, "Initial is required").max(3, "Initial must be at most 3 characters"),
  role: z.enum(["admin", "user"], {
    required_error: "Please select a role",
  }),
});

type UserFormValues = z.infer<typeof userFormSchema>;

// Project assignment form schema
const projectAssignmentSchema = z.object({
  projectId: z.string().min(1, "Please select a project"),
});

type ProjectAssignmentFormValues = z.infer<typeof projectAssignmentSchema>;

export default function UserManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isProjectAssignOpen, setIsProjectAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);

  // Redirect if not an admin
  if (user && user.role !== "admin") {
    return <Redirect to="/" />;
  }

  // Fetch users
  const {
    data: users,
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery<User[]>({
    queryKey: ["/api/users"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await fetch("/api/users", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch users: ${res.statusText}`);
      }
      return res.json();
    },
  });
  
  // Fetch all projects
  const {
    data: projects,
    isLoading: isLoadingProjects,
    error: projectsError
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await fetch("/api/projects", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch projects: ${res.statusText}`);
      }
      return res.json();
    },
  });
  
  // Fetch user's project assignments when a user is selected
  const {
    data: userProjectAssignments,
    isLoading: isLoadingAssignments,
    refetch: refetchUserProjects
  } = useQuery<UserProject[]>({
    queryKey: ["/api/users", selectedUser?.id, "projects"],
    enabled: !!selectedUser,
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/users/${selectedUser.id}/projects`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch user projects: ${res.statusText}`);
      }
      return res.json();
    }
  });
  
  // Update local state when user project assignments change
  useEffect(() => {
    if (userProjectAssignments && projects) {
      setUserProjects(userProjectAssignments);
      
      // Map project assignments to actual project objects
      const projectMap = new Map(projects.map((p: Project) => [p.id, p]));
      const assignedProjectsList = userProjectAssignments
        .map((up: UserProject) => projectMap.get(up.projectId))
        .filter((p): p is Project => !!p);
      setAssignedProjects(assignedProjectsList);
    }
  }, [userProjectAssignments, projects]);

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      const res = await apiRequest("POST", "/api/users", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create user");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateOpen(false);
      toast({
        title: "User created",
        description: "The user has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UserFormValues }) => {
      const res = await apiRequest("PUT", `/api/users/${id}`, data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update user");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditOpen(false);
      setSelectedUser(null);
      toast({
        title: "User updated",
        description: "The user has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete user");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDeleteOpen(false);
      setSelectedUser(null);
      toast({
        title: "User deleted",
        description: "The user has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create user form
  const createForm = useForm<UserFormValues>({
    resolver: zodResolver(
      userFormSchema.extend({
        password: z.string().min(6, "Password must be at least 6 characters"),
      })
    ),
    defaultValues: {
      username: "",
      password: "",
      displayName: "",
      initial: "",
      role: "user",
    },
  });

  // Edit user form
  const editForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      password: "", // Optional for edit
      displayName: "",
      initial: "",
      role: "user",
    },
  });

  // Set edit form values when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      editForm.reset({
        username: selectedUser.username,
        password: "", // Don't fill password field for security
        displayName: selectedUser.displayName,
        initial: selectedUser.initial,
        role: selectedUser.role as "admin" | "user",
      });
    }
  }, [selectedUser, editForm]);

  // Handle create form submission
  const onCreateSubmit = (data: UserFormValues) => {
    createUserMutation.mutate(data);
  };

  // Handle edit form submission
  const onEditSubmit = (data: UserFormValues) => {
    if (selectedUser) {
      // Remove empty password if not changed
      if (!data.password) {
        const { password, ...restData } = data;
        updateUserMutation.mutate({ id: selectedUser.id, data: restData });
      } else {
        updateUserMutation.mutate({ id: selectedUser.id, data });
      }
    }
  };

  // Handle delete confirmation
  const onDeleteConfirm = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  // Create project assignment form
  const projectAssignmentForm = useForm<ProjectAssignmentFormValues>({
    resolver: zodResolver(projectAssignmentSchema),
    defaultValues: {
      projectId: "",
    },
  });
  
  // Create mutation for assigning a project to a user
  const assignProjectMutation = useMutation({
    mutationFn: async ({ userId, projectId }: { userId: number; projectId: number }) => {
      const res = await apiRequest("POST", `/api/users/${userId}/projects`, { projectId });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to assign project");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "projects"] });
      toast({
        title: "Project assigned",
        description: "The project has been assigned to the user successfully",
      });
      // Reset the form
      projectAssignmentForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Create mutation for removing a project assignment from a user
  const removeProjectAssignmentMutation = useMutation({
    mutationFn: async ({ userId, projectId }: { userId: number; projectId: number }) => {
      const res = await apiRequest("DELETE", `/api/users/${userId}/projects/${projectId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to remove project assignment");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "projects"] });
      toast({
        title: "Project removed",
        description: "The project has been removed from the user successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle project assignment form submission
  const onProjectAssignSubmit = (data: ProjectAssignmentFormValues) => {
    if (selectedUser && data.projectId) {
      assignProjectMutation.mutate({ 
        userId: selectedUser.id, 
        projectId: parseInt(data.projectId) 
      });
    }
  };
  
  // Handle removing a project assignment
  const handleRemoveProjectAssignment = (projectId: number) => {
    if (selectedUser) {
      removeProjectAssignmentMutation.mutate({
        userId: selectedUser.id,
        projectId
      });
    }
  };

  const isLoading = isLoadingUsers || isLoadingProjects;
  const error = usersError || projectsError;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
          <p>Error: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system. All fields are required.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit(onCreateSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={createForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter display name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="initial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter initial (1-3 characters)"
                          maxLength={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        1-3 characters for avatar display
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createUserMutation.isPending}
                  >
                    {createUserMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create User
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Initial</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users && users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>{user.initial}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        user.role === "admin"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsProjectAssignOpen(true);
                          // Fetch user projects when opening the dialog
                          refetchUserProjects();
                        }}
                      >
                        <Briefcase className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsEditOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={user.id === 1} // Prevent deleting admin
                        onClick={() => {
                          setSelectedUser(user);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave password blank to keep current password.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Leave blank to keep current password"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave blank to keep current password
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter display name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="initial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter initial (1-3 characters)"
                        maxLength={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      1-3 characters for avatar display
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the user "{selectedUser?.displayName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDeleteConfirm}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Project Assignment Dialog */}
      <Dialog open={isProjectAssignOpen} onOpenChange={setIsProjectAssignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Project Assignments</DialogTitle>
            <DialogDescription>
              Manage which projects "{selectedUser?.displayName}" has access to.
            </DialogDescription>
          </DialogHeader>
          
          {/* Add new project assignment */}
          <div className="mb-5">
            <h3 className="text-sm font-medium mb-3">Assign New Project</h3>
            <Form {...projectAssignmentForm}>
              <form onSubmit={projectAssignmentForm.handleSubmit(onProjectAssignSubmit)} className="flex space-x-2">
                <div className="flex-grow">
                  <FormField
                    control={projectAssignmentForm.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a project" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projects && projects
                              .filter(project => !assignedProjects.some(ap => ap.id === project.id))
                              .map(project => (
                                <SelectItem key={project.id} value={project.id.toString()}>
                                  {project.name}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={assignProjectMutation.isPending}
                >
                  {assignProjectMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-2 h-4 w-4" />
                  )}
                  Assign
                </Button>
              </form>
            </Form>
          </div>
          
          {/* Current project assignments */}
          <div>
            <h3 className="text-sm font-medium mb-3">Current Project Assignments</h3>
            {isLoadingAssignments ? (
              <div className="py-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : assignedProjects.length === 0 ? (
              <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-600 text-center">
                User is not assigned to any projects
              </div>
            ) : (
              <div className="space-y-2">
                {assignedProjects.map(project => (
                  <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{project.description || "No description"}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProjectAssignment(project.id)}
                      disabled={removeProjectAssignmentMutation.isPending}
                    >
                      {removeProjectAssignmentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsProjectAssignOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}