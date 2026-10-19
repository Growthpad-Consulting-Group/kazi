export type UserRole = "admin" | "hr" | "hiring_manager" | "interviewer" | "manager" | "employee";
export type JobStatus = "draft" | "open" | "closed";
export type CandidateStage = "applied" | "screened" | "interview" | "offer" | "hired" | "rejected";

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
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
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
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["jobs"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
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
          applied_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["candidates"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["candidates"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["interview_scorecards"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["interview_scorecards"]["Insert"]>;
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
      };
    };
  };
}

// Convenience type aliases
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Candidate = Database["public"]["Tables"]["candidates"]["Row"];
export type CandidateNote = Database["public"]["Tables"]["candidate_notes"]["Row"];
export type InterviewScorecard = Database["public"]["Tables"]["interview_scorecards"]["Row"];
export type AiLog = Database["public"]["Tables"]["ai_logs"]["Row"];
