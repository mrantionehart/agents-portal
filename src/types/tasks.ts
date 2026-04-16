// Type Definitions for Task Management System
// Complete TypeScript interfaces for type safety

/**
 * Task Status
 * pending: Initial state, not started
 * in_progress: Task is being worked on
 * completed: Task is finished
 * blocked: Task is blocked/waiting for something
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'

/**
 * Task Priority
 * low: Can wait, not urgent
 * medium: Normal priority
 * high: Important, should be done soon
 * urgent: Critical, needs immediate attention
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Task Action Type
 * For activity log tracking
 */
export type TaskAction = 'created' | 'assigned' | 'status_changed' | 'commented' | 'updated' | 'deleted'

/**
 * Core Task Record
 * Represents a single task in the system
 */
export interface Task {
  id: string
  transaction_id: string
  assigned_by: string
  assigned_to: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date?: string | null
  completion_date?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

/**
 * Task with Related Data
 * Used in API responses with joined data
 */
export interface TaskWithRelations extends Task {
  assigned_to_profile?: {
    id: string
    email: string
    full_name?: string | null
  }
  assigned_by_profile?: {
    id: string
    email: string
    full_name?: string | null
  }
  transaction?: {
    id: string
    title: string
    status: string
  }
  comment_count?: Array<any>
  activity_count?: Array<any>
}

/**
 * Task Comment Record
 * Collaborative comments on tasks
 */
export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  comment_text: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

/**
 * Task Comment with User Info
 */
export interface TaskCommentWithUser extends TaskComment {
  user_profile?: {
    id: string
    email: string
    full_name?: string | null
  }
}

/**
 * Task Activity Log Entry
 * Audit trail for compliance
 */
export interface TaskActivity {
  id: string
  task_id: string
  action: TaskAction
  user_id: string
  changes?: Record<string, any>
  created_at: string
}

/**
 * Task Activity with User Info
 */
export interface TaskActivityWithUser extends TaskActivity {
  user_profile?: {
    id: string
    email: string
    full_name?: string | null
  }
}

/**
 * Detailed Task View
 * Used in modal/detail pages
 */
export interface TaskDetail extends TaskWithRelations {
  comments: TaskCommentWithUser[]
  activity: TaskActivityWithUser[]
}

/**
 * Task Statistics
 * Summary information for dashboards
 */
export interface TaskStats {
  total_tasks: number
  pending_count: number
  in_progress_count: number
  completed_count: number
  blocked_count: number
  overdue_count: number
  due_today_count: number
  high_priority_count: number
  urgent_count: number
  completion_rate: number
  avg_completion_days: number
}

/**
 * Task with Status Info
 * Includes computed properties like overdue status
 */
export interface TaskWithStatus extends TaskWithRelations {
  is_overdue: boolean
  days_overdue?: number
  days_until_due?: number
}

/**
 * Create Task Request
 * Input for creating a new task
 */
export interface CreateTaskRequest {
  transaction_id: string
  assigned_to: string
  title: string
  description?: string | null
  priority?: TaskPriority
  due_date?: string | null
}

/**
 * Update Task Request
 * Input for updating task details
 */
export interface UpdateTaskRequest {
  title?: string
  description?: string | null
  priority?: TaskPriority
  due_date?: string | null
  status?: TaskStatus
}

/**
 * Task Status Update Request
 * Input for updating task status specifically
 */
export interface UpdateTaskStatusRequest {
  status: TaskStatus
  completion_note?: string
}

/**
 * Create Comment Request
 * Input for adding a comment
 */
export interface CreateCommentRequest {
  comment_text: string
}

/**
 * Paginated Task Response
 * API response format for task lists
 */
export interface PaginatedTaskResponse {
  data: TaskWithRelations[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Overdue Task Info
 * Details about overdue tasks
 */
export interface OverdueTask {
  task_id: string
  title: string
  assigned_to: string
  assigned_by: string
  transaction_id: string
  due_date: string
  days_overdue: number
  priority: TaskPriority
}

/**
 * Task Summary for Transaction
 * Quick overview of tasks for a specific transaction
 */
export interface TransactionTaskSummary {
  task_count: number
  overdue_count: number
  in_progress_count: number
  due_today_count: number
  completion_percentage: number
}

/**
 * Task Filter Options
 * Parameters for filtering tasks
 */
export interface TaskFilterOptions {
  status?: TaskStatus
  priority?: TaskPriority
  assigned_to?: string
  assigned_by?: string
  due_before?: string
  due_after?: string
  search?: string
}

/**
 * Task Sort Options
 * Parameters for sorting tasks
 */
export interface TaskSortOptions {
  sort_by?: 'due_date' | 'priority' | 'created_at' | 'updated_at'
  sort_order?: 'asc' | 'desc'
}

/**
 * Task API Response Success
 * Standard success response format
 */
export interface TaskApiResponse<T = any> {
  data: T
  message?: string
  timestamp: string
}

/**
 * Task API Response Error
 * Standard error response format
 */
export interface TaskApiErrorResponse {
  error: string
  code?: string
  timestamp: string
}

/**
 * Task Notification Payload
 * Used for sending notifications
 */
export interface TaskNotificationPayload {
  task_id: string
  title: string
  action: 'assigned' | 'overdue' | 'completed' | 'commented' | 'updated'
  assigned_to?: string
  assigned_by?: string
  priority?: TaskPriority
  due_date?: string
  message?: string
}
