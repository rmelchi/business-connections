export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      match_feedback: {
        Row: {
          created_at: string
          id: string
          interest: Database["public"]["Enums"]["interest_state"]
          match_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest?: Database["public"]["Enums"]["interest_state"]
          match_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          interest?: Database["public"]["Enums"]["interest_state"]
          match_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_feedback_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          engine: string
          explanation: string
          factors: Json
          id: string
          offer_excerpt: string
          offer_id: string
          provider_id: string
          reciprocal: boolean
          reciprocal_match_id: string | null
          request_excerpt: string
          request_id: string
          requester_id: string
          score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          engine?: string
          explanation?: string
          factors?: Json
          id: string
          offer_excerpt?: string
          offer_id: string
          provider_id: string
          reciprocal?: boolean
          reciprocal_match_id?: string | null
          request_excerpt?: string
          request_id: string
          requester_id: string
          score?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          engine?: string
          explanation?: string
          factors?: Json
          id?: string
          offer_excerpt?: string
          offer_id?: string
          provider_id?: string
          reciprocal?: boolean
          reciprocal_match_id?: string | null
          request_excerpt?: string
          request_id?: string
          requester_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_roles: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          match_id: string | null
          profile_id: string
          read: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id: string
          match_id?: string | null
          profile_id: string
          read?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          match_id?: string | null
          profile_id?: string
          read?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          audience: Database["public"]["Enums"]["audience_type"]
          category: string
          created_at: string
          description: string
          embedding: Json | null
          geography: string
          id: string
          industry: string
          keywords: string[]
          member_id: string
          product_service: Database["public"]["Enums"]["product_service_type"]
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience_type"]
          category?: string
          created_at?: string
          description?: string
          embedding?: Json | null
          geography?: string
          id?: string
          industry?: string
          keywords?: string[]
          member_id: string
          product_service?: Database["public"]["Enums"]["product_service_type"]
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_type"]
          category?: string
          created_at?: string
          description?: string
          embedding?: Json | null
          geography?: string
          id?: string
          industry?: string
          keywords?: string[]
          member_id?: string
          product_service?: Database["public"]["Enums"]["product_service_type"]
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          avatar_initials: string
          bio: string
          company: string
          created_at: string
          email: string
          geography: string
          id: string
          industry: string
          last_synced_at: string
          matching_enabled: boolean
          membership_level: string
          membership_status: Database["public"]["Enums"]["membership_status"]
          name: string
          phone: string | null
          title: string
          updated_at: string
          wildapricot_contact_id: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_initials?: string
          bio?: string
          company?: string
          created_at?: string
          email: string
          geography?: string
          id: string
          industry?: string
          last_synced_at?: string
          matching_enabled?: boolean
          membership_level?: string
          membership_status?: Database["public"]["Enums"]["membership_status"]
          name: string
          phone?: string | null
          title?: string
          updated_at?: string
          wildapricot_contact_id: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_initials?: string
          bio?: string
          company?: string
          created_at?: string
          email?: string
          geography?: string
          id?: string
          industry?: string
          last_synced_at?: string
          matching_enabled?: boolean
          membership_level?: string
          membership_status?: Database["public"]["Enums"]["membership_status"]
          name?: string
          phone?: string | null
          title?: string
          updated_at?: string
          wildapricot_contact_id?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          audience: Database["public"]["Enums"]["audience_type"]
          category: string
          created_at: string
          description: string
          embedding: Json | null
          expires_at: string | null
          geography: string
          id: string
          industry: string
          keywords: string[]
          member_id: string
          product_service: Database["public"]["Enums"]["product_service_type"]
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience_type"]
          category?: string
          created_at?: string
          description?: string
          embedding?: Json | null
          expires_at?: string | null
          geography?: string
          id?: string
          industry?: string
          keywords?: string[]
          member_id: string
          product_service?: Database["public"]["Enums"]["product_service_type"]
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_type"]
          category?: string
          created_at?: string
          description?: string
          embedding?: Json | null
          expires_at?: string | null
          geography?: string
          id?: string
          industry?: string
          keywords?: string[]
          member_id?: string
          product_service?: Database["public"]["Enums"]["product_service_type"]
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      member_directory: {
        Row: {
          avatar_initials: string | null
          bio: string | null
          company: string | null
          created_at: string | null
          geography: string | null
          id: string | null
          industry: string | null
          last_synced_at: string | null
          matching_enabled: boolean | null
          membership_level: string | null
          membership_status:
            | Database["public"]["Enums"]["membership_status"]
            | null
          name: string | null
          title: string | null
          updated_at: string | null
          wildapricot_contact_id: string | null
        }
        Insert: {
          avatar_initials?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string | null
          geography?: string | null
          id?: string | null
          industry?: string | null
          last_synced_at?: string | null
          matching_enabled?: boolean | null
          membership_level?: string | null
          membership_status?:
            | Database["public"]["Enums"]["membership_status"]
            | null
          name?: string | null
          title?: string | null
          updated_at?: string | null
          wildapricot_contact_id?: string | null
        }
        Update: {
          avatar_initials?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string | null
          geography?: string | null
          id?: string | null
          industry?: string | null
          last_synced_at?: string | null
          matching_enabled?: boolean | null
          membership_level?: string | null
          membership_status?:
            | Database["public"]["Enums"]["membership_status"]
            | null
          name?: string | null
          title?: string | null
          updated_at?: string | null
          wildapricot_contact_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_profile_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sync_wildapricot_contact: {
        Args: {
          _company: string
          _contact_id: string
          _email: string
          _membership_level: string
          _membership_status: Database["public"]["Enums"]["membership_status"]
          _name: string
          _phone: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "member" | "admin"
      audience_type: "b2b" | "b2c" | "both"
      interest_state: "none" | "interested" | "not_relevant"
      listing_status: "active" | "inactive"
      membership_status: "active" | "lapsed" | "pending" | "suspended"
      product_service_type: "product" | "service" | "both"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["member", "admin"],
      audience_type: ["b2b", "b2c", "both"],
      interest_state: ["none", "interested", "not_relevant"],
      listing_status: ["active", "inactive"],
      membership_status: ["active", "lapsed", "pending", "suspended"],
      product_service_type: ["product", "service", "both"],
    },
  },
} as const
