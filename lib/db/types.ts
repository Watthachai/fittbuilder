// Hand-authored from supabase/migrations/0001_init.sql; regenerate with `supabase gen types typescript` once the project exists.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
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
      fittbuilder_projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          files: Json | null;
          phase: string;
          approved_phases: Json;
          history: Json;
          messages: Json;
          share_token: string | null;
          share_role: string | null;
          skill_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name?: string;
          files?: Json | null;
          phase?: string;
          approved_phases?: Json;
          history?: Json;
          messages?: Json;
          share_token?: string | null;
          share_role?: string | null;
          skill_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          files?: Json | null;
          phase?: string;
          approved_phases?: Json;
          history?: Json;
          messages?: Json;
          share_token?: string | null;
          share_role?: string | null;
          skill_id?: string | null;
          created_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      fittbuilder_accept_invites: { Args: { uid: string; mail: string }; Returns: undefined };
      fittbuilder_join_by_token: { Args: { tok: string; uid: string }; Returns: string | null };
      fittbuilder_ai_usage_report: { Args: Record<string, never>; Returns: Json };
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
