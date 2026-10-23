export type UserRole = "admin" | "hr" | "hiring_manager" | "interviewer" | "manager" | "employee";
export type JobStatus = "draft" | "open" | "closed";
export type CandidateStage = "applied" | "screened" | "interview" | "offer" | "hired" | "rejected";
export type GoalStatus = "not_started" | "in_progress" | "at_risk" | "completed" | "cancelled";
export type GoalLevel = "company" | "team" | "individual";
export type CheckinStatus = "draft" | "submitted" | "reviewed";
export type FeedbackVisibility = "public" | "private";
export type VoiceOutStatus = "new" | "in_review" | "resolved" | "archived";
export type VoiceOutPriority = "low" | "normal" | "high" | "urgent";
export type ReviewCycle = "quarterly" | "biannual" | "annual";
export type ReviewStatus = "pending" | "self_review" | "manager_review" | "peer_review" | "completed";
export type ReviewType = "self" | "manager" | "peer";
export type SurveyStatus = "draft" | "active" | "closed";
export type IdpStatus = "active" | "completed" | "cancelled";
export type RedemptionStatus = "pending" | "approved" | "fulfilled" | "rejected";
export type MilestoneType = "work_anniversary" | "birthday" | "onboarding_complete" | "service_achievement";
export type AutomationTrigger = "milestone_anniversary" | "campaign_start" | "quest_ends_soon" | "recognition_received";
export type AutomationAction = "send_notification" | "award_points";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          password_hash: string;
          role: UserRole;
          department: string | null;
          avatar_url: string | null;
          is_active: boolean;
          manager_id: string | null;
          job_title: string | null;
          location: string | null;
          start_date: string | null;
          date_of_birth: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at" | "updated_at" | "department" | "avatar_url" | "is_active" | "manager_id" | "job_title" | "location" | "start_date" | "date_of_birth"> & {
          department?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          manager_id?: string | null;
          job_title?: string | null;
          location?: string | null;
          start_date?: string | null;
          date_of_birth?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          session_token: string;
          expires: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sessions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          title: string;
          department: string | null;
          location: string | null;
          description: string | null;
          requirements: { must_haves: string[]; nice_to_haves: string[] };
          scoring_rubric: { criterion: string; weight: number; description: string }[];
          status: JobStatus;
          published_at: string | null;
          closes_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["jobs"]["Row"], "id" | "created_at" | "updated_at" | "published_at" | "closes_at"> & {
          published_at?: string | null;
          closes_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      candidates: {
        Row: {
          id: string;
          job_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          location: string | null;
          cv_url: string | null;
          cv_text: string | null;
          cv_parsed: {
            experience: { title: string; company: string; duration: string }[];
            skills: string[];
            education: { degree: string; institution: string; year: string }[];
          } | null;
          stage: CandidateStage;
          assigned_to: string | null;
          source: string | null;
          ai_score: number | null;
          ai_justification: string | null;
          shortlisted: boolean;
          consented_at: string | null;
          hired_user_id: string | null;
          applied_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["candidates"]["Row"],
          "id" | "created_at" | "updated_at" | "phone" | "location" | "cv_url" | "cv_text" | "cv_parsed" | "assigned_to" | "source" | "ai_score" | "ai_justification" | "consented_at" | "hired_user_id" | "stage" | "shortlisted"
        > & {
          phone?: string | null;
          location?: string | null;
          cv_url?: string | null;
          cv_text?: string | null;
          cv_parsed?: Database["public"]["Tables"]["candidates"]["Row"]["cv_parsed"];
          assigned_to?: string | null;
          source?: string | null;
          ai_score?: number | null;
          ai_justification?: string | null;
          stage?: CandidateStage;
          shortlisted?: boolean;
          consented_at?: string | null;
          hired_user_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["candidates"]["Insert"]>;
        Relationships: [];
      };
      candidate_notes: {
        Row: {
          id: string;
          candidate_id: string;
          user_id: string;
          note: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["candidate_notes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["candidate_notes"]["Insert"]>;
        Relationships: [];
      };
      interview_scorecards: {
        Row: {
          id: string;
          candidate_id: string;
          interviewer_id: string;
          questions: { question: string; answer: string; score: number }[];
          overall_score: number | null;
          recommendation: "hire" | "no_hire" | "maybe" | null;
          ai_summary: string | null;
          submitted_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["interview_scorecards"]["Row"], "id" | "created_at" | "overall_score" | "recommendation" | "ai_summary" | "submitted_at"> & {
          overall_score?: number | null;
          recommendation?: "hire" | "no_hire" | "maybe" | null;
          ai_summary?: string | null;
          submitted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["interview_scorecards"]["Insert"]>;
        Relationships: [];
      };
      ai_logs: {
        Row: {
          id: string;
          operation: string;
          entity_type: string;
          entity_id: string;
          model: string;
          prompt: string;
          response: string;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ai_logs"]["Row"], "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
      // ── Kazi Pulse ──────────────────────────────────────────
      checkins: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          wins: string | null;
          priorities: string | null;
          blockers: string | null;
          mood: number | null;
          status: CheckinStatus;
          manager_comment: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          ai_summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["checkins"]["Row"], "id" | "created_at" | "updated_at" | "status" | "manager_comment" | "reviewed_by" | "reviewed_at" | "ai_summary" | "wins" | "priorities" | "blockers" | "mood"> & {
          wins?: string | null;
          priorities?: string | null;
          blockers?: string | null;
          mood?: number | null;
          status?: CheckinStatus;
          manager_comment?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          ai_summary?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["checkins"]["Row"]>;
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          level: GoalLevel;
          owner_id: string | null;
          parent_id: string | null;
          status: GoalStatus;
          progress: number;
          due_date: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["goals"]["Row"], "id" | "created_at" | "updated_at" | "status" | "progress" | "description" | "owner_id" | "parent_id" | "due_date"> & {
          description?: string | null;
          owner_id?: string | null;
          parent_id?: string | null;
          due_date?: string | null;
          status?: GoalStatus;
          progress?: number;
        };
        Update: Partial<Database["public"]["Tables"]["goals"]["Row"]>;
        Relationships: [];
      };
      one_on_ones: {
        Row: {
          id: string;
          manager_id: string;
          report_id: string;
          scheduled_at: string | null;
          agenda: string | null;
          notes: string | null;
          action_items: { text: string; done: boolean; carried_from?: string }[];
          ai_talking_points: string | null;
          google_event_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["one_on_ones"]["Row"], "id" | "created_at" | "updated_at" | "scheduled_at" | "agenda" | "notes" | "action_items" | "ai_talking_points" | "google_event_id"> & {
          scheduled_at?: string | null;
          agenda?: string | null;
          notes?: string | null;
          action_items?: { text: string; done: boolean; carried_from?: string }[];
          ai_talking_points?: string | null;
          google_event_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["one_on_ones"]["Row"]>;
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          from_user_id: string;
          to_user_id: string;
          message: string;
          visibility: FeedbackVisibility;
          emoji: string | null;
          value_id: string | null;
          campaign_id: string | null;
          media_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["feedback"]["Row"], "id" | "created_at" | "visibility" | "emoji" | "value_id" | "campaign_id" | "media_url"> & {
          visibility?: FeedbackVisibility;
          emoji?: string | null;
          value_id?: string | null;
          campaign_id?: string | null;
          media_url?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      feedback_recipients: {
        Row: { feedback_id: string; user_id: string; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["feedback_recipients"]["Row"], "created_at">;
        Update: never;
        Relationships: [];
      };
      recognition_values: {
        Row: { id: string; name: string; description: string | null; color: string; is_active: boolean; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["recognition_values"]["Row"], "id" | "created_at" | "description" | "color" | "is_active"> & { description?: string | null; color?: string; is_active?: boolean };
        Update: Partial<Database["public"]["Tables"]["recognition_values"]["Insert"]>;
        Relationships: [];
      };
      recognition_campaigns: {
        Row: { id: string; name: string; goal: string | null; audience_type: "company" | "department" | "location" | "manager_group" | "staff"; audience_filters: string[]; value_ids: string[]; starts_at: string | null; ends_at: string | null; status: "draft" | "upcoming" | "live" | "paused" | "completed" | "archived"; visual_color: string; created_by: string; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["recognition_campaigns"]["Row"], "id" | "created_at" | "updated_at" | "goal" | "audience_filters" | "value_ids" | "starts_at" | "ends_at" | "status" | "visual_color"> & { goal?: string | null; audience_filters?: string[]; value_ids?: string[]; starts_at?: string | null; ends_at?: string | null; status?: "draft" | "upcoming" | "live" | "paused" | "completed" | "archived"; visual_color?: string };
        Update: Partial<Database["public"]["Tables"]["recognition_campaigns"]["Insert"]>;
        Relationships: [];
      };
      side_quests: {
        Row: { id: string; title: string; brief: string; completion_criteria: string; audience_type: "company" | "department" | "location" | "manager_group" | "staff"; audience_filters: string[]; starts_at: string | null; ends_at: string | null; status: "draft" | "upcoming" | "live" | "closed" | "archived"; created_by: string; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["side_quests"]["Row"], "id" | "created_at" | "updated_at" | "audience_filters" | "starts_at" | "ends_at" | "status"> & { audience_filters?: string[]; starts_at?: string | null; ends_at?: string | null; status?: "draft" | "upcoming" | "live" | "closed" | "archived" };
        Update: Partial<Database["public"]["Tables"]["side_quests"]["Insert"]>;
        Relationships: [];
      };
      side_quest_completions: {
        Row: { side_quest_id: string; user_id: string; completed_at: string };
        Insert: Omit<Database["public"]["Tables"]["side_quest_completions"]["Row"], "completed_at">;
        Update: never;
        Relationships: [];
      };
      voice_out_reports: {
        Row: {
          id: string;
          topic: "workplace" | "wellbeing" | "inclusion" | "leadership" | "other";
          message: string;
          status: VoiceOutStatus;
          priority: VoiceOutPriority;
          owner_id: string | null;
          internal_notes: string | null;
          resolved_at: string | null;
          attachments: string[];
          allows_follow_up: boolean;
          reply_access_hash: string | null;
          sentiment: "negative" | "neutral" | "positive";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["voice_out_reports"]["Row"], "id" | "created_at" | "updated_at" | "status" | "priority" | "owner_id" | "internal_notes" | "resolved_at" | "attachments" | "allows_follow_up" | "reply_access_hash" | "sentiment"> & {
          status?: VoiceOutStatus;
          priority?: VoiceOutPriority;
          owner_id?: string | null;
          internal_notes?: string | null;
          resolved_at?: string | null;
          attachments?: string[];
          allows_follow_up?: boolean;
          reply_access_hash?: string | null;
          sentiment?: "negative" | "neutral" | "positive";
        };
        Update: Partial<Database["public"]["Tables"]["voice_out_reports"]["Insert"]>;
        Relationships: [];
      };
      voice_out_messages: {
        Row: { id: string; report_id: string; author_role: "staff" | "hr"; message: string; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["voice_out_messages"]["Row"], "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
      asana_connections: {
        Row: {
          id: string;
          user_id: string;
          asana_user_gid: string;
          asana_email: string | null;
          workspace_gid: string;
          workspace_name: string | null;
          access_token_ciphertext: string;
          refresh_token_ciphertext: string;
          token_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["asana_connections"]["Row"], "id" | "created_at" | "updated_at" | "asana_email" | "workspace_name" | "token_expires_at"> & {
          asana_email?: string | null;
          workspace_name?: string | null;
          token_expires_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["asana_connections"]["Row"]>;
        Relationships: [];
      };
      // ── Phase 3: Reviews, Surveys, IDPs, PIPs ───────────────
      review_cycles: {
        Row: {
          id: string;
          title: string;
          cycle: ReviewCycle;
          start_date: string;
          end_date: string;
          status: ReviewStatus;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["review_cycles"]["Row"], "id" | "created_at" | "updated_at" | "status"> & { status?: ReviewStatus };
        Update: Partial<Database["public"]["Tables"]["review_cycles"]["Row"]>;
        Relationships: [];
      };
      performance_reviews: {
        Row: {
          id: string;
          cycle_id: string;
          reviewee_id: string;
          reviewer_id: string;
          review_type: ReviewType;
          competency_ratings: { criterion: string; rating: number; comment: string }[];
          overall_rating: number | null;
          strengths: string | null;
          development_areas: string | null;
          ai_draft: string | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["performance_reviews"]["Row"], "id" | "created_at" | "updated_at" | "competency_ratings" | "overall_rating" | "strengths" | "development_areas" | "ai_draft" | "submitted_at"> & {
          competency_ratings?: { criterion: string; rating: number; comment: string }[];
          overall_rating?: number | null;
          strengths?: string | null;
          development_areas?: string | null;
          ai_draft?: string | null;
          submitted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["performance_reviews"]["Row"]>;
        Relationships: [];
      };
      surveys: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          questions: { id: string; text: string; type: "scale" | "text" | "choice" | "quiz"; options?: string[]; correct_answer?: string; time_limit_seconds?: number }[];
          status: SurveyStatus;
          anonymous: boolean;
          created_by: string;
          opens_at: string | null;
          closes_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["surveys"]["Row"], "id" | "created_at" | "updated_at" | "status" | "anonymous" | "description" | "opens_at" | "closes_at"> & {
          description?: string | null;
          status?: SurveyStatus;
          anonymous?: boolean;
          opens_at?: string | null;
          closes_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["surveys"]["Row"]>;
        Relationships: [];
      };
      survey_responses: {
        Row: {
          id: string;
          survey_id: string;
          respondent_id: string | null;
          answers: Record<string, string | number>;
          submitted_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["survey_responses"]["Row"], "id" | "submitted_at" | "respondent_id"> & { respondent_id?: string | null };
        Update: never;
        Relationships: [];
      };
      idps: {
        Row: {
          id: string;
          user_id: string;
          manager_id: string | null;
          title: string;
          goals: string | null;
          actions: { text: string; due_date: string | null; done: boolean }[];
          status: IdpStatus;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["idps"]["Row"], "id" | "created_at" | "updated_at" | "manager_id" | "goals" | "actions" | "status" | "due_date"> & {
          manager_id?: string | null;
          goals?: string | null;
          actions?: { text: string; due_date: string | null; done: boolean }[];
          status?: IdpStatus;
          due_date?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["idps"]["Row"]>;
        Relationships: [];
      };
      pips: {
        Row: {
          id: string;
          user_id: string;
          manager_id: string;
          hr_id: string | null;
          concern: string;
          expected_outcomes: string;
          support_provided: string | null;
          check_in_frequency: string | null;
          actions: { text: string; due_date: string | null; done: boolean }[];
          start_date: string;
          review_date: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pips"]["Row"], "id" | "created_at" | "updated_at" | "hr_id" | "support_provided" | "check_in_frequency" | "actions" | "review_date" | "resolved_at"> & {
          hr_id?: string | null;
          support_provided?: string | null;
          check_in_frequency?: string | null;
          actions?: { text: string; due_date: string | null; done: boolean }[];
          review_date?: string | null;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pips"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          link: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at" | "read" | "link"> & {
          read?: boolean;
          link?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: { name: string };
        Update: Partial<{ name: string }>;
        Relationships: [];
      };
      // ── New tables (FEAT-001) ─────────────────────────────────
      staff_groups: {
        Row: { id: string; name: string; member_ids: string[]; created_by: string; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["staff_groups"]["Row"], "id" | "created_at">;
        Update: Partial<{ name: string; member_ids: string[] }>;
        Relationships: [];
      };
      engagement_notification_preferences: {
        Row: { user_id: string; show_on_leaderboard: boolean; campaign_updates: boolean; side_quest_updates: boolean; created_at: string; updated_at: string };
        Insert: { user_id: string; show_on_leaderboard?: boolean; campaign_updates?: boolean; side_quest_updates?: boolean };
        Update: Partial<Database["public"]["Tables"]["engagement_notification_preferences"]["Insert"]>;
        Relationships: [];
      };
      reward_wallets: {
        Row: { user_id: string; balance: number; updated_at: string };
        Insert: { user_id: string; balance?: number };
        Update: { balance?: number };
        Relationships: [];
      };
      reward_ledger: {
        Row: { id: string; user_id: string; amount: number; reason: string; reference_type: string | null; reference_id: string | null; created_by: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["reward_ledger"]["Row"], "id" | "created_at"> & { reference_type?: string | null; reference_id?: string | null; created_by?: string | null };
        Update: never;
        Relationships: [];
      };
      reward_catalogue: {
        Row: { id: string; name: string; description: string | null; points_cost: number; image_url: string | null; is_active: boolean; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["reward_catalogue"]["Row"], "id" | "created_at" | "description" | "image_url" | "is_active"> & { description?: string | null; image_url?: string | null; is_active?: boolean };
        Update: Partial<Database["public"]["Tables"]["reward_catalogue"]["Insert"]>;
        Relationships: [];
      };
      reward_redemptions: {
        Row: { id: string; user_id: string; catalogue_item_id: string; points_spent: number; status: RedemptionStatus; approved_by: string | null; fulfilled_at: string | null; notes: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["reward_redemptions"]["Row"], "id" | "created_at" | "status" | "approved_by" | "fulfilled_at" | "notes"> & { status?: RedemptionStatus; approved_by?: string | null; fulfilled_at?: string | null; notes?: string | null };
        Update: Partial<{ status: RedemptionStatus; approved_by: string | null; fulfilled_at: string | null; notes: string | null }>;
        Relationships: [];
      };
      milestones: {
        Row: { id: string; user_id: string; type: MilestoneType; milestone_date: string; years_count: number | null; acknowledged: boolean; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["milestones"]["Row"], "id" | "created_at" | "acknowledged" | "years_count"> & { acknowledged?: boolean; years_count?: number | null };
        Update: Partial<{ acknowledged: boolean }>;
        Relationships: [];
      };
      automation_rules: {
        Row: { id: string; trigger_type: AutomationTrigger; action_type: AutomationAction; config: Record<string, unknown>; is_active: boolean; created_by: string; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["automation_rules"]["Row"], "id" | "created_at" | "config" | "is_active"> & { config?: Record<string, unknown>; is_active?: boolean };
        Update: Partial<{ config: Record<string, unknown>; is_active: boolean }>;
        Relationships: [];
      };
      automation_rule_executions: {
        Row: { id: string; rule_id: string; event_key: string; user_id: string; action_type: AutomationAction; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["automation_rule_executions"]["Row"], "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
      // ── FEAT-001: Slack ───────────────────────────────────────
      slack_connections: {
        Row: {
          id: string;
          webhook_url: string;
          channel_name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["slack_connections"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<{ webhook_url: string; channel_name: string }>;
        Relationships: [];
      };
      // ── Google Calendar integration ───────────────────────────
      google_calendar_connections: {
        Row: {
          id: string;
          user_id: string;
          access_token_ciphertext: string;
          refresh_token_ciphertext: string;
          token_expiry: string | null;
          calendar_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token_ciphertext: string;
          refresh_token_ciphertext: string;
          token_expiry?: string | null;
          calendar_id?: string;
        };
        Update: Partial<{
          access_token_ciphertext: string;
          refresh_token_ciphertext: string;
          token_expiry: string | null;
          calendar_id: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      rename_department: {
        Args: { p_id: string; p_name: string };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      job_status: JobStatus;
      candidate_stage: CandidateStage;
      goal_status: GoalStatus;
      goal_level: GoalLevel;
      checkin_status: CheckinStatus;
      feedback_visibility: FeedbackVisibility;
      voice_out_status: VoiceOutStatus;
      voice_out_priority: VoiceOutPriority;
      review_cycle: ReviewCycle;
      review_status: ReviewStatus;
      review_type: ReviewType;
      survey_status: SurveyStatus;
      idp_status: IdpStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Hire types
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Candidate = Database["public"]["Tables"]["candidates"]["Row"];
export type CandidateNote = Database["public"]["Tables"]["candidate_notes"]["Row"];
export type InterviewScorecard = Database["public"]["Tables"]["interview_scorecards"]["Row"];
export type AiLog = Database["public"]["Tables"]["ai_logs"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

// Pulse types
export type Checkin = Database["public"]["Tables"]["checkins"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type OneOnOne = Database["public"]["Tables"]["one_on_ones"]["Row"];
export type Feedback = Database["public"]["Tables"]["feedback"]["Row"];
export type RecognitionValue = Database["public"]["Tables"]["recognition_values"]["Row"];
export type VoiceOutReport = Database["public"]["Tables"]["voice_out_reports"]["Row"];
export type VoiceOutMessage = Database["public"]["Tables"]["voice_out_messages"]["Row"];

// Reviews & Development types
export type ReviewCycleRow = Database["public"]["Tables"]["review_cycles"]["Row"];
export type PerformanceReview = Database["public"]["Tables"]["performance_reviews"]["Row"];
export type Survey = Database["public"]["Tables"]["surveys"]["Row"];
export type SurveyResponse = Database["public"]["Tables"]["survey_responses"]["Row"];
export type Idp = Database["public"]["Tables"]["idps"]["Row"];
export type Pip = Database["public"]["Tables"]["pips"]["Row"];

// New types (FEAT-001)
export type StaffGroup = Database["public"]["Tables"]["staff_groups"]["Row"];
export type RewardWallet = Database["public"]["Tables"]["reward_wallets"]["Row"];
export type RewardLedger = Database["public"]["Tables"]["reward_ledger"]["Row"];
export type RewardCatalogue = Database["public"]["Tables"]["reward_catalogue"]["Row"];
export type RewardRedemption = Database["public"]["Tables"]["reward_redemptions"]["Row"];
export type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
export type AutomationRule = Database["public"]["Tables"]["automation_rules"]["Row"];
export type EngagementNotificationPreferences = Database["public"]["Tables"]["engagement_notification_preferences"]["Row"];

// FEAT-001: Slack
export type SlackConnection = Database["public"]["Tables"]["slack_connections"]["Row"];

// Google Calendar integration
export type GoogleCalendarConnection = Database["public"]["Tables"]["google_calendar_connections"]["Row"];
