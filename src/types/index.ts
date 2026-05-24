export interface Cycle {
  id: number
  label: string
  type: 'weekly' | 'biweekly'
  opens_at: string
  closes_at: string
  is_current: boolean
  created_at: string
}

export interface Submission {
  id: number
  cycle_id: number
  person_name: string
  headline: string
  progress: string
  risks: string
  metrics: string | null
  board_update: string | null
  focus: string | null
  priorities: string | null
  submitted_at: string
  updated_at: string
}

export interface Report {
  id: number
  cycle_id: number | null
  period: string
  type: 'weekly' | 'biweekly'
  content: string
  generated_at: string
  source: 'generated' | 'uploaded'
}

export interface SlackMessage {
  id: number
  cycle_id: number
  message_type: SlackMessageType
  ts: string | null
  posted_at: string
  cancelled: boolean
}

export type SlackMessageType =
  | 'opening'
  | 'reminder_1'
  | 'reminder_2'
  | 'reminder_3'
  | 'final_warning'
  | 'last_call'
  | 'celebration'
  | 'closed'

export interface TeamMember {
  name: string
  firstName: string
}

export interface SubmissionStatus {
  name: string
  firstName: string
  submitted: boolean
  submitted_at?: string
}

export interface DraftFields {
  headline: string
  progress: string
  risks: string
  metrics: string
  board: string
  focus: string
  priorities: string
}

export interface AdminSession {
  isAdmin: boolean
}
