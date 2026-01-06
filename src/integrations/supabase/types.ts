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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string
          sector: string | null
          type: Database["public"]["Enums"]["compte_type"] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
          sector?: string | null
          type?: Database["public"]["Enums"]["compte_type"] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          sector?: string | null
          type?: Database["public"]["Enums"]["compte_type"] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comptes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          assigned_to: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          id: string
          organization_id: string
          related_contact_id: string | null
          related_property_id: string | null
          status: Database["public"]["Enums"]["activity_status"] | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          assigned_to?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          id?: string
          organization_id: string
          related_contact_id?: string | null
          related_property_id?: string | null
          status?: Database["public"]["Enums"]["activity_status"] | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          assigned_to?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          id?: string
          organization_id?: string
          related_contact_id?: string | null
          related_property_id?: string | null
          status?: Database["public"]["Enums"]["activity_status"] | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_related_property_id_fkey"
            columns: ["related_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity: string
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_agent_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          last_contact_date: string | null
          next_followup_date: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"] | null
          role: Database["public"]["Enums"]["contact_role"] | null
          source: string | null
          updated_at: string | null
          urgency_score: number | null
        }
        Insert: {
          assigned_agent_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_contact_date?: string | null
          next_followup_date?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          role?: Database["public"]["Enums"]["contact_role"] | null
          source?: string | null
          updated_at?: string | null
          urgency_score?: number | null
        }
        Update: {
          assigned_agent_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_contact_date?: string | null
          next_followup_date?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          role?: Database["public"]["Enums"]["contact_role"] | null
          source?: string | null
          updated_at?: string | null
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number
          assigned_agent_id: string | null
          commission_amount: number | null
          commission_rate: number | null
          contact_id: string | null
          created_at: string | null
          expected_close_date: string | null
          id: string
          name: string
          organization_id: string
          probability: number | null
          property_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"] | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          assigned_agent_id?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          contact_id?: string | null
          created_at?: string | null
          expected_close_date?: string | null
          id?: string
          name: string
          organization_id: string
          probability?: number | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          assigned_agent_id?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          contact_id?: string | null
          created_at?: string | null
          expected_close_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          probability?: number | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      months: {
        Row: {
          ca_total: number | null
          conversion_rate: number | null
          created_at: string | null
          id: string
          month_date: string
          nb_visites: number | null
          objectif_ca: number | null
          organization_id: string
          title: string
          total_commissions: number | null
        }
        Insert: {
          ca_total?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          month_date: string
          nb_visites?: number | null
          objectif_ca?: number | null
          organization_id: string
          title: string
          total_commissions?: number | null
        }
        Update: {
          ca_total?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          month_date?: string
          nb_visites?: number | null
          objectif_ca?: number | null
          organization_id?: string
          title?: string
          total_commissions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mois_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          assigned_agent_id: string | null
          bedrooms: number | null
          created_at: string | null
          description: string | null
          id: string
          organization_id: string
          owner_id: string | null
          photos_url: string[] | null
          price: number | null
          rooms: number | null
          status: Database["public"]["Enums"]["property_status"] | null
          surface_m2: number | null
          type: Database["public"]["Enums"]["property_type"] | null
          updated_at: string | null
        }
        Insert: {
          address: string
          assigned_agent_id?: string | null
          bedrooms?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id: string
          owner_id?: string | null
          photos_url?: string[] | null
          price?: number | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"] | null
          surface_m2?: number | null
          type?: Database["public"]["Enums"]["property_type"] | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          assigned_agent_id?: string | null
          bedrooms?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          owner_id?: string | null
          photos_url?: string[] | null
          price?: number | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"] | null
          surface_m2?: number | null
          type?: Database["public"]["Enums"]["property_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth_user_org_id: { Args: never; Returns: string }
      get_user_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_status: "À faire" | "En cours" | "Terminé" | "Annulé"
      activity_type: "Call" | "SMS" | "Email" | "Meeting" | "Visite" | "Relance"
      app_role: "Admin" | "Manager" | "Agent"
      compte_type: "Particulier" | "Entreprise" | "SCI"
      contact_role: "Acheteur" | "Vendeur" | "Investisseur" | "Locataire"
      deal_stage:
        | "nouveau"
        | "estimation"
        | "mandat"
        | "visite"
        | "offre"
        | "negociation"
        | "compromis"
        | "vendu"
        | "perdu"
      pipeline_stage:
        | "lead"
        | "contacted"
        | "qualified"
        | "proposal"
        | "won"
        | "lost"
      property_status:
        | "Estimation"
        | "Mandat"
        | "Sous Offre"
        | "Vendu"
        | "Archivé"
      property_type:
        | "Appartement"
        | "Maison"
        | "Terrain"
        | "Commerce"
        | "Immeuble"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      activity_status: ["À faire", "En cours", "Terminé", "Annulé"],
      activity_type: ["Call", "SMS", "Email", "Meeting", "Visite", "Relance"],
      app_role: ["Admin", "Manager", "Agent"],
      compte_type: ["Particulier", "Entreprise", "SCI"],
      contact_role: ["Acheteur", "Vendeur", "Investisseur", "Locataire"],
      deal_stage: [
        "nouveau",
        "estimation",
        "mandat",
        "visite",
        "offre",
        "negociation",
        "compromis",
        "vendu",
        "perdu",
      ],
      pipeline_stage: [
        "lead",
        "contacted",
        "qualified",
        "proposal",
        "won",
        "lost",
      ],
      property_status: [
        "Estimation",
        "Mandat",
        "Sous Offre",
        "Vendu",
        "Archivé",
      ],
      property_type: [
        "Appartement",
        "Maison",
        "Terrain",
        "Commerce",
        "Immeuble",
      ],
    },
  },
} as const
