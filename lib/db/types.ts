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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name?: string;
          files?: Json | null;
          phase?: string;
          approved_phases?: Json;
          history?: Json;
          messages?: Json;
          share_token?: string | null;
          share_role?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: {
      fittbuilder_accept_invites: { Args: { uid: string; mail: string }; Returns: undefined };
      fittbuilder_join_by_token: { Args: { tok: string; uid: string }; Returns: string | null };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
