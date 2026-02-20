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
          address: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          sector: string | null
          siret: string | null
          type: Database["public"]["Enums"]["compte_type"] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          sector?: string | null
          siret?: string | null
          type?: Database["public"]["Enums"]["compte_type"] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          sector?: string | null
          siret?: string | null
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
      activation_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_used: boolean
          key: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          key: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          key?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          ai_generated: boolean | null
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          deal_id: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          name: string
          organization_id: string
          priority: Database["public"]["Enums"]["activity_priority"]
          property_id: string | null
          status: Database["public"]["Enums"]["activity_status"] | null
          type: Database["public"]["Enums"]["activity_type"] | null
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["activity_priority"]
          property_id?: string | null
          status?: Database["public"]["Enums"]["activity_status"] | null
          type?: Database["public"]["Enums"]["activity_type"] | null
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["activity_priority"]
          property_id?: string | null
          status?: Database["public"]["Enums"]["activity_status"] | null
          type?: Database["public"]["Enums"]["activity_type"] | null
          updated_at?: string | null
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
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
            foreignKeyName: "activities_property_id_fkey"
            columns: ["property_id"]
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
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
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
      contact_searches: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          cities: string[] | null
          contact_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          max_bedrooms: number | null
          max_rooms: number | null
          max_surface: number | null
          min_bedrooms: number | null
          min_rooms: number | null
          min_surface: number | null
          notes: string | null
          organization_id: string
          postal_codes: string[] | null
          property_types: string[] | null
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          cities?: string[] | null
          contact_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_bedrooms?: number | null
          max_rooms?: number | null
          max_surface?: number | null
          min_bedrooms?: number | null
          min_rooms?: number | null
          min_surface?: number | null
          notes?: string | null
          organization_id: string
          postal_codes?: string[] | null
          property_types?: string[] | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          cities?: string[] | null
          contact_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_bedrooms?: number | null
          max_rooms?: number | null
          max_surface?: number | null
          min_bedrooms?: number | null
          min_rooms?: number | null
          min_surface?: number | null
          notes?: string | null
          organization_id?: string
          postal_codes?: string[] | null
          property_types?: string[] | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_searches_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_searches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
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
          postal_code: string | null
          role: Database["public"]["Enums"]["contact_role"] | null
          source: string | null
          tags: string[] | null
          updated_at: string | null
          urgency_score: number | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
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
          postal_code?: string | null
          role?: Database["public"]["Enums"]["contact_role"] | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string | null
          urgency_score?: number | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
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
          postal_code?: string | null
          role?: Database["public"]["Enums"]["contact_role"] | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string | null
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
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
          actual_close_date: string | null
          amount: number | null
          assigned_to: string | null
          commission_amount: number | null
          commission_rate: number | null
          contact_id: string | null
          created_at: string | null
          expected_close_date: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          probability: number | null
          property_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"] | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          actual_close_date?: string | null
          amount?: number | null
          assigned_to?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          contact_id?: string | null
          created_at?: string | null
          expected_close_date?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          probability?: number | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          actual_close_date?: string | null
          amount?: number | null
          assigned_to?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          contact_id?: string | null
          created_at?: string | null
          expected_close_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          probability?: number | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
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
      email_sequences: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          steps: Json
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_predefined: boolean | null
          name: string
          organization_id: string
          subject: string
          updated_at: string | null
          usage_count: number | null
          variables: string[] | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_predefined?: boolean | null
          name: string
          organization_id: string
          subject: string
          updated_at?: string | null
          usage_count?: number | null
          variables?: string[] | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_predefined?: boolean | null
          name?: string
          organization_id?: string
          subject?: string
          updated_at?: string | null
          usage_count?: number | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_stats_cache: {
        Row: {
          avg_price_m2: number
          city_name: string
          last_updated_at: string
          median_price_m2: number
          postal_code: string
          recent_transactions: Json
          transaction_count: number
        }
        Insert: {
          avg_price_m2?: number
          city_name?: string
          last_updated_at?: string
          median_price_m2?: number
          postal_code: string
          recent_transactions?: Json
          transaction_count?: number
        }
        Update: {
          avg_price_m2?: number
          city_name?: string
          last_updated_at?: string
          median_price_m2?: number
          postal_code?: string
          recent_transactions?: Json
          transaction_count?: number
        }
        Relationships: []
      }
      months: {
        Row: {
          activities_count: number | null
          ca_total: number | null
          contacts_added: number | null
          conversion_rate: number | null
          created_at: string | null
          deals_count: number | null
          deals_lost: number | null
          deals_won: number | null
          id: string
          month: number
          month_date: string | null
          nb_visites: number | null
          objectif_ca: number | null
          organization_id: string
          properties_added: number | null
          revenue: number | null
          title: string | null
          total_commissions: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          activities_count?: number | null
          ca_total?: number | null
          contacts_added?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          deals_count?: number | null
          deals_lost?: number | null
          deals_won?: number | null
          id?: string
          month: number
          month_date?: string | null
          nb_visites?: number | null
          objectif_ca?: number | null
          organization_id: string
          properties_added?: number | null
          revenue?: number | null
          title?: string | null
          total_commissions?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          activities_count?: number | null
          ca_total?: number | null
          contacts_added?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          deals_count?: number | null
          deals_lost?: number | null
          deals_won?: number | null
          id?: string
          month?: number
          month_date?: string | null
          nb_visites?: number | null
          objectif_ca?: number | null
          organization_id?: string
          properties_added?: number | null
          revenue?: number | null
          title?: string | null
          total_commissions?: number | null
          updated_at?: string | null
          year?: number
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
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          organization_id: string
          phone: string | null
          settings: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
          user_id?: string
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
          address: string | null
          assigned_to: string | null
          bathrooms: number | null
          bedrooms: number | null
          cadastral_ref: string | null
          city: string | null
          co_ownership_charges: number | null
          contact_id: string | null
          created_at: string | null
          description: string | null
          dpe_analyzed_at: string | null
          dpe_label: string | null
          energy_rating: string | null
          features: Json | null
          floor: number | null
          ges_label: string | null
          heating_type: string | null
          id: string
          images: string[] | null
          mandate_number: string | null
          mandate_type: string | null
          organization_id: string
          postal_code: string | null
          price: number | null
          rooms: number | null
          status: Database["public"]["Enums"]["property_status"] | null
          surface: number | null
          tax_property: number | null
          title: string
          total_floors: number | null
          transaction_type: string | null
          type: Database["public"]["Enums"]["property_type"] | null
          updated_at: string | null
          year_built: number | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          cadastral_ref?: string | null
          city?: string | null
          co_ownership_charges?: number | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          dpe_analyzed_at?: string | null
          dpe_label?: string | null
          energy_rating?: string | null
          features?: Json | null
          floor?: number | null
          ges_label?: string | null
          heating_type?: string | null
          id?: string
          images?: string[] | null
          mandate_number?: string | null
          mandate_type?: string | null
          organization_id: string
          postal_code?: string | null
          price?: number | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"] | null
          surface?: number | null
          tax_property?: number | null
          title?: string
          total_floors?: number | null
          transaction_type?: string | null
          type?: Database["public"]["Enums"]["property_type"] | null
          updated_at?: string | null
          year_built?: number | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          cadastral_ref?: string | null
          city?: string | null
          co_ownership_charges?: number | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          dpe_analyzed_at?: string | null
          dpe_label?: string | null
          energy_rating?: string | null
          features?: Json | null
          floor?: number | null
          ges_label?: string | null
          heating_type?: string | null
          id?: string
          images?: string[] | null
          mandate_number?: string | null
          mandate_type?: string | null
          organization_id?: string
          postal_code?: string | null
          price?: number | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"] | null
          surface?: number | null
          tax_property?: number | null
          title?: string
          total_floors?: number | null
          transaction_type?: string | null
          type?: Database["public"]["Enums"]["property_type"] | null
          updated_at?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_proposals: {
        Row: {
          clicked_at: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          opened_at: string | null
          organization_id: string
          property_id: string | null
          sent_at: string | null
          template_id: string | null
        }
        Insert: {
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          opened_at?: string | null
          organization_id: string
          property_id?: string | null
          sent_at?: string | null
          template_id?: string | null
        }
        Update: {
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          opened_at?: string | null
          organization_id?: string
          property_id?: string | null
          sent_at?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_proposals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_proposals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          completed_at: string | null
          contact_id: string
          created_at: string
          current_step: number | null
          enrolled_at: string
          id: string
          next_send_at: string | null
          organization_id: string
          sequence_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          created_at?: string
          current_step?: number | null
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          organization_id: string
          sequence_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          current_step?: number | null
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          organization_id?: string
          sequence_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      activity_priority: "basse" | "normale" | "haute" | "urgente"
      activity_status: "planifie" | "en_cours" | "termine" | "annule"
      activity_type:
        | "appel"
        | "email"
        | "visite"
        | "rdv"
        | "relance"
        | "signature"
        | "note"
        | "tache"
        | "autre"
      app_role: "admin" | "manager" | "agent" | "viewer"
      compte_type: "client" | "fournisseur" | "partenaire" | "prospect"
      contact_role:
        | "vendeur"
        | "acheteur"
        | "vendeur_acheteur"
        | "locataire"
        | "proprietaire"
        | "prospect"
        | "partenaire"
        | "notaire"
        | "banquier"
        | "autre"
      deal_stage:
        | "nouveau"
        | "qualification"
        | "estimation"
        | "mandat"
        | "commercialisation"
        | "visite"
        | "offre"
        | "negociation"
        | "compromis"
        | "financement"
        | "acte"
        | "vendu"
        | "perdu"
      pipeline_stage:
        | "nouveau"
        | "qualification"
        | "estimation"
        | "mandat"
        | "commercialisation"
        | "visite"
        | "offre"
        | "negociation"
        | "compromis"
        | "financement"
        | "acte"
        | "vendu"
        | "perdu"
      property_status:
        | "disponible"
        | "sous_compromis"
        | "vendu"
        | "loue"
        | "retire"
      property_type:
        | "appartement"
        | "maison"
        | "terrain"
        | "commerce"
        | "bureau"
        | "immeuble"
        | "parking"
        | "autre"
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
      activity_priority: ["basse", "normale", "haute", "urgente"],
      activity_status: ["planifie", "en_cours", "termine", "annule"],
      activity_type: [
        "appel",
        "email",
        "visite",
        "rdv",
        "relance",
        "signature",
        "note",
        "tache",
        "autre",
      ],
      app_role: ["admin", "manager", "agent", "viewer"],
      compte_type: ["client", "fournisseur", "partenaire", "prospect"],
      contact_role: [
        "vendeur",
        "acheteur",
        "vendeur_acheteur",
        "locataire",
        "proprietaire",
        "prospect",
        "partenaire",
        "notaire",
        "banquier",
        "autre",
      ],
      deal_stage: [
        "nouveau",
        "qualification",
        "estimation",
        "mandat",
        "commercialisation",
        "visite",
        "offre",
        "negociation",
        "compromis",
        "financement",
        "acte",
        "vendu",
        "perdu",
      ],
      pipeline_stage: [
        "nouveau",
        "qualification",
        "estimation",
        "mandat",
        "commercialisation",
        "visite",
        "offre",
        "negociation",
        "compromis",
        "financement",
        "acte",
        "vendu",
        "perdu",
      ],
      property_status: [
        "disponible",
        "sous_compromis",
        "vendu",
        "loue",
        "retire",
      ],
      property_type: [
        "appartement",
        "maison",
        "terrain",
        "commerce",
        "bureau",
        "immeuble",
        "parking",
        "autre",
      ],
    },
  },
} as const
