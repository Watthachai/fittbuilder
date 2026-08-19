// Hand-authored from supabase/migrations/0001_init.sql; regenerate with `supabase gen types typescript` once the project exists.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      fittbuilder_project_revisions: {
        Row: {
          id: string;
          project_id: string;
          sha: string;
          parent_sha: string | null;
          label: string;
          kind: string;
          target_loc: string | null;
          files: Json;
          author_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          sha: string;
          parent_sha?: string | null;
          label: string;
          kind?: string;
          target_loc?: string | null;
          files: Json;
          author_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          sha?: string;
          parent_sha?: string | null;
          label?: string;
          kind?: string;
          target_loc?: string | null;
          files?: Json;
          author_id?: string | null;
          created_at?: string;
        };
        // Every table MUST carry this — one table without it collapses the whole
        // Database type to `never` for every query in the app.
        Relationships: [];
      };
      /** Inactive tier versions; the ACTIVE one lives in projects.files (0031). */
      fittbuilder_project_versions: {
        Row: {
          project_id: string;
          key: string;
          files: Json;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          key: string;
          files: Json;
          updated_at?: string;
        };
        Update: {
          project_id?: string;
          key?: string;
          files?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      /** RLS on, no policies (migration 0030) — service role only. */
      fittbuilder_partner_leads: {
        Row: {
          id: string;
          name: string;
          company: string;
          email: string;
          phone: string;
          note: string;
          source: string;
          status: "new" | "contacted" | "won" | "lost";
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          company: string;
          email: string;
          phone?: string;
          note?: string;
          source?: string;
          status?: "new" | "contacted" | "won" | "lost";
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          company?: string;
          email?: string;
          phone?: string;
          note?: string;
          source?: string;
          status?: "new" | "contacted" | "won" | "lost";
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_project_quotes: {
        Row: {
          project_id: string;
          payload: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          payload: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          project_id?: string;
          payload?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_advisor_reports: {
        Row: {
          id: string;
          org_id: string;
          kind: string;
          result: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          kind: string;
          result: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          kind?: string;
          result?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          plan: string;
          last_seen_changelog: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          plan?: string;
          last_seen_changelog?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          plan?: string;
          last_seen_changelog?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_orgs: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          color: string;
          icon: string;
          org_dna: Json;
          pain_radar: Json | null;
          /** Company identity printed on quotations (migration 0029). */
          brand: Json;
          /** White-label. Pinned against anon/authenticated by a trigger — an
           *  Update that sets it through the Data API is silently ignored. */
          is_partner: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name?: string;
          color?: string;
          icon?: string;
          org_dna?: Json;
          pain_radar?: Json | null;
          brand?: Json;
          is_partner?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          color?: string;
          icon?: string;
          org_dna?: Json;
          pain_radar?: Json | null;
          brand?: Json;
          is_partner?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          files: Json | null;
          /** Maintained by a trigger (migration 0027) so listing never reads `files`. */
          file_count: number;
          /** Which tier version projects.files currently holds (migration 0031). */
          active_version: string;
          phase: string;
          approved_phases: Json;
          history: Json;
          /** Maintained by a trigger (migration 0032); the stack itself never
           *  leaves the database — see fittbuilder_history_push/pop. */
          history_count: number;
          messages: Json;
          share_token: string | null;
          share_role: string | null;
          share_expires_at: string | null;
          skill_id: string | null;
          org_id: string | null;
          runner_last: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name?: string;
          files?: Json | null;
          file_count?: number;
          active_version?: string;
          phase?: string;
          approved_phases?: Json;
          history?: Json;
          history_count?: number;
          messages?: Json;
          share_token?: string | null;
          share_role?: string | null;
          share_expires_at?: string | null;
          skill_id?: string | null;
          org_id?: string | null;
          runner_last?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          files?: Json | null;
          file_count?: number;
          active_version?: string;
          phase?: string;
          approved_phases?: Json;
          history?: Json;
          history_count?: number;
          messages?: Json;
          share_token?: string | null;
          share_role?: string | null;
          share_expires_at?: string | null;
          skill_id?: string | null;
          org_id?: string | null;
          runner_last?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_project_drafts: {
        Row: {
          project_id: string;
          files: Json;
          prompt: string;
          updated_at: string;
          updated_by: string | null;
          /** Maintained by a trigger (0036) so a list never reads `files`. */
          file_count: number;
        };
        Insert: {
          project_id: string;
          files: Json;
          prompt?: string;
          updated_at?: string;
          updated_by?: string | null;
          file_count?: number;
        };
        Update: {
          project_id?: string;
          files?: Json;
          prompt?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_project_members: {
        Row: {
          project_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_phase_approvals: {
        Row: {
          project_id: string;
          phase: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          project_id: string;
          phase: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          phase?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_ai_usage: {
        Row: {
          id: string;
          user_id: string | null;
          project_id: string | null;
          kind: string;
          model: string;
          prompt_tokens: number;
          output_tokens: number;
          total_tokens: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          project_id?: string | null;
          kind: string;
          model: string;
          prompt_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          project_id?: string | null;
          kind?: string;
          model?: string;
          prompt_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_project_invites: {
        Row: {
          id: string;
          project_id: string;
          email: string;
          role: string;
          token: string;
          status: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          email: string;
          role: string;
          token: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          email?: string;
          role?: string;
          token?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_skill_templates: {
        Row: {
          id: string;
          slug: string;
          name: string;
          name_en: string;
          tagline: string;
          icon: string;
          keywords: Json;
          persona: string;
          domain_knowledge: string;
          build_guidance: string;
          seed_data: string;
          design_hints: string | null;
          question_bank: Json;
          org_id: string | null;
          source: string;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          name_en: string;
          tagline?: string;
          icon?: string;
          keywords?: Json;
          persona?: string;
          domain_knowledge?: string;
          build_guidance?: string;
          seed_data?: string;
          design_hints?: string | null;
          question_bank?: Json;
          org_id?: string | null;
          source?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          name_en?: string;
          tagline?: string;
          icon?: string;
          keywords?: Json;
          persona?: string;
          domain_knowledge?: string;
          build_guidance?: string;
          seed_data?: string;
          design_hints?: string | null;
          question_bank?: Json;
          org_id?: string | null;
          source?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_project_chat: {
        Row: {
          id: string;
          project_id: string;
          user_id: string | null;
          author_name: string | null;
          author_avatar: string | null;
          kind: string;
          body: string;
          attachments: Json;
          reply_to: string | null;
          reply_author: string | null;
          reply_excerpt: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id?: string | null;
          author_name?: string | null;
          author_avatar?: string | null;
          kind?: string;
          body?: string;
          attachments?: Json;
          reply_to?: string | null;
          reply_author?: string | null;
          reply_excerpt?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string | null;
          author_name?: string | null;
          author_avatar?: string | null;
          kind?: string;
          body?: string;
          attachments?: Json;
          reply_to?: string | null;
          reply_author?: string | null;
          reply_excerpt?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_chat_reactions: {
        Row: {
          message_id: string;
          project_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          project_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          message_id?: string;
          project_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_org_members: {
        Row: {
          org_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          org_id: string;
          user_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          org_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      fittbuilder_org_invites: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: string;
          token: string;
          status: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role: string;
          token: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email?: string;
          role?: string;
          token?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      fittbuilder_accept_invites: { Args: { uid: string; mail: string }; Returns: undefined };
      fittbuilder_accept_org_invites: { Args: { uid: string; mail: string }; Returns: undefined };
      fittbuilder_join_by_token: { Args: { tok: string; uid: string }; Returns: string | null };
      /** Push a snapshot onto the undo stack; returns the new depth. */
      fittbuilder_history_push: { Args: { pid: string; snapshot: Json }; Returns: number };
      /** Move a project between tier versions in one transaction; returns the
       *  files that are now active. */
      fittbuilder_switch_version: {
        Args: { pid: string; from_key: string; to_key: string; outgoing: Json };
        Returns: Json;
      };
      /** Pop the newest snapshot into `files` and return it (null when empty). */
      fittbuilder_history_pop: { Args: { pid: string }; Returns: Json | null };
      fittbuilder_ai_usage_report: { Args: Record<string, never>; Returns: Json };
      fittbuilder_shared_project_owners: {
        Args: Record<string, never>;
        Returns: {
          project_id: string;
          name: string | null;
          email: string | null;
        }[];
      };
      fittbuilder_project_members_detailed: {
        Args: { pid: string };
        Returns: {
          user_id: string;
          email: string | null;
          name: string | null;
          role: string;
          created_at: string;
        }[];
      };
      fittbuilder_org_members_detailed: {
        Args: { oid: string };
        Returns: {
          user_id: string;
          email: string | null;
          name: string | null;
          role: string;
          created_at: string;
        }[];
      };
      fittbuilder_my_invites: {
        Args: Record<string, never>;
        Returns: {
          kind: string;
          invite_id: string;
          entity_id: string;
          entity_name: string | null;
          role: string;
          created_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
