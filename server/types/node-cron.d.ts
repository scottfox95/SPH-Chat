declare module 'node-cron' {
  export interface ScheduledTask {
    stop(): void;
    start(): void;
    getStatus(): string;
  }

  export interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
  }

  /**
   * Schedules a task to be executed according to the cron expression
   * @param expression The cron expression
   * @param task Function to be executed
   * @param options Scheduling options
   * @returns A ScheduledTask object
   */
  export function schedule(
    expression: string,
    task: () => void,
    options?: ScheduleOptions
  ): ScheduledTask;

  /**
   * Validates a cron expression
   * @param expression The cron expression to validate
   * @returns Boolean indicating if the expression is valid
   */
  export function validate(expression: string): boolean;
}