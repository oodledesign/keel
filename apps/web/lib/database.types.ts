export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  feedflow: {
    Tables: {
      bunny_libraries: {
        Row: {
          account_id: string
          client_id: string | null
          created_at: string
          id: string
          library_id: string
        }
        Insert: {
          account_id: string
          client_id?: string | null
          created_at?: string
          id?: string
          library_id: string
        }
        Update: {
          account_id?: string
          client_id?: string | null
          created_at?: string
          id?: string
          library_id?: string
        }
        Relationships: []
      }
      feed_cache: {
        Row: {
          account_id: string
          cached_at: string | null
          created_at: string
          expires_at: string | null
          fetched_at: string
          id: string
          payload: Json
          raw_json: Json | null
          social_account_id: string | null
        }
        Insert: {
          account_id: string
          cached_at?: string | null
          created_at?: string
          expires_at?: string | null
          fetched_at?: string
          id?: string
          payload: Json
          raw_json?: Json | null
          social_account_id?: string | null
        }
        Update: {
          account_id?: string
          cached_at?: string | null
          created_at?: string
          expires_at?: string | null
          fetched_at?: string
          id?: string
          payload?: Json
          raw_json?: Json | null
          social_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_cache_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_accounts: {
        Row: {
          access_token: string
          account_id: string
          client_id: string | null
          connected_at: string | null
          created_at: string
          google_account_id: string | null
          id: string
          last_refreshed_at: string | null
          location_id: string | null
          location_name: string | null
          refresh_token: string
          token_expires_at: string | null
          token_status: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          client_id?: string | null
          connected_at?: string | null
          created_at?: string
          google_account_id?: string | null
          id?: string
          last_refreshed_at?: string | null
          location_id?: string | null
          location_name?: string | null
          refresh_token: string
          token_expires_at?: string | null
          token_status?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          client_id?: string | null
          connected_at?: string | null
          created_at?: string
          google_account_id?: string | null
          id?: string
          last_refreshed_at?: string | null
          location_id?: string | null
          location_name?: string | null
          refresh_token?: string
          token_expires_at?: string | null
          token_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      google_reviews_cache: {
        Row: {
          account_id: string
          average_rating: number | null
          cached_at: string | null
          excluded_review_ids: string[] | null
          expires_at: string | null
          google_account_id: string
          id: string
          raw_json: Json
          total_review_count: number | null
        }
        Insert: {
          account_id: string
          average_rating?: number | null
          cached_at?: string | null
          excluded_review_ids?: string[] | null
          expires_at?: string | null
          google_account_id: string
          id?: string
          raw_json: Json
          total_review_count?: number | null
        }
        Update: {
          account_id?: string
          average_rating?: number | null
          cached_at?: string | null
          excluded_review_ids?: string[] | null
          expires_at?: string | null
          google_account_id?: string
          id?: string
          raw_json?: Json
          total_review_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "google_reviews_cache_google_account_id_fkey"
            columns: ["google_account_id"]
            isOneToOne: false
            referencedRelation: "google_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token: string | null
          account_id: string
          client_id: string | null
          connected_at: string | null
          created_at: string
          external_account_id: string
          id: string
          last_refreshed_at: string | null
          platform: string | null
          platform_user_id: string | null
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          token_status: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          client_id?: string | null
          connected_at?: string | null
          created_at?: string
          external_account_id: string
          id?: string
          last_refreshed_at?: string | null
          platform?: string | null
          platform_user_id?: string | null
          provider: string
          refresh_token?: string | null
          token_expires_at?: string | null
          token_status?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          client_id?: string | null
          connected_at?: string | null
          created_at?: string
          external_account_id?: string
          id?: string
          last_refreshed_at?: string | null
          platform?: string | null
          platform_user_id?: string | null
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          token_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      token_refresh_log: {
        Row: {
          account_id: string
          attempted_at: string | null
          error_message: string | null
          id: string
          platform: string | null
          social_account_id: string | null
          success: boolean | null
        }
        Insert: {
          account_id: string
          attempted_at?: string | null
          error_message?: string | null
          id?: string
          platform?: string | null
          social_account_id?: string | null
          success?: boolean | null
        }
        Update: {
          account_id?: string
          attempted_at?: string | null
          error_message?: string | null
          id?: string
          platform?: string | null
          social_account_id?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "token_refresh_log_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          account_id: string
          bunny_video_id: string | null
          client_id: string | null
          created_at: string
          embed_key: string | null
          id: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          bunny_video_id?: string | null
          client_id?: string | null
          created_at?: string
          embed_key?: string | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          bunny_video_id?: string | null
          client_id?: string | null
          created_at?: string
          embed_key?: string | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      webflow_connections: {
        Row: {
          account_id: string
          auto_publish: boolean | null
          client_id: string | null
          created_at: string | null
          google_account_id: string | null
          id: string
          last_synced_at: string | null
          min_character_count: number | null
          sync_error: string | null
          sync_mode: string | null
          sync_status: string | null
          webflow_api_token: string
          webflow_collection_id: string
          webflow_site_id: string
        }
        Insert: {
          account_id: string
          auto_publish?: boolean | null
          client_id?: string | null
          created_at?: string | null
          google_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          min_character_count?: number | null
          sync_error?: string | null
          sync_mode?: string | null
          sync_status?: string | null
          webflow_api_token: string
          webflow_collection_id: string
          webflow_site_id: string
        }
        Update: {
          account_id?: string
          auto_publish?: boolean | null
          client_id?: string | null
          created_at?: string | null
          google_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          min_character_count?: number | null
          sync_error?: string | null
          sync_mode?: string | null
          sync_status?: string | null
          webflow_api_token?: string
          webflow_collection_id?: string
          webflow_site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webflow_connections_google_account_id_fkey"
            columns: ["google_account_id"]
            isOneToOne: false
            referencedRelation: "google_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      webflow_sync_log: {
        Row: {
          account_id: string
          error_message: string | null
          id: string
          reviews_fetched: number | null
          reviews_skipped: number | null
          reviews_synced: number | null
          success: boolean | null
          synced_at: string | null
          webflow_connection_id: string | null
        }
        Insert: {
          account_id: string
          error_message?: string | null
          id?: string
          reviews_fetched?: number | null
          reviews_skipped?: number | null
          reviews_synced?: number | null
          success?: boolean | null
          synced_at?: string | null
          webflow_connection_id?: string | null
        }
        Update: {
          account_id?: string
          error_message?: string | null
          id?: string
          reviews_fetched?: number | null
          reviews_skipped?: number | null
          reviews_synced?: number | null
          success?: boolean | null
          synced_at?: string | null
          webflow_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webflow_sync_log_webflow_connection_id_fkey"
            columns: ["webflow_connection_id"]
            isOneToOne: false
            referencedRelation: "webflow_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      widgets: {
        Row: {
          accent_colour: string | null
          account_id: string
          border_radius: number | null
          client_id: string | null
          columns_desktop: number | null
          columns_mobile: number | null
          columns_tablet: number | null
          created_at: string
          custom_css: string | null
          embed_key: string
          gap: number | null
          id: string
          layout: string | null
          name: string
          open_in: string | null
          post_count: number | null
          settings: Json
          show_captions: boolean | null
          show_likes: boolean | null
          slider_autoplay: boolean | null
          slider_autoplay_speed: number | null
          social_account_id: string | null
          updated_at: string
        }
        Insert: {
          accent_colour?: string | null
          account_id: string
          border_radius?: number | null
          client_id?: string | null
          columns_desktop?: number | null
          columns_mobile?: number | null
          columns_tablet?: number | null
          created_at?: string
          custom_css?: string | null
          embed_key: string
          gap?: number | null
          id?: string
          layout?: string | null
          name: string
          open_in?: string | null
          post_count?: number | null
          settings?: Json
          show_captions?: boolean | null
          show_likes?: boolean | null
          slider_autoplay?: boolean | null
          slider_autoplay_speed?: number | null
          social_account_id?: string | null
          updated_at?: string
        }
        Update: {
          accent_colour?: string | null
          account_id?: string
          border_radius?: number | null
          client_id?: string | null
          columns_desktop?: number | null
          columns_mobile?: number | null
          columns_tablet?: number | null
          created_at?: string
          custom_css?: string | null
          embed_key?: string
          gap?: number | null
          id?: string
          layout?: string | null
          name?: string
          open_in?: string | null
          post_count?: number | null
          settings?: Json
          show_captions?: boolean | null
          show_likes?: boolean | null
          slider_autoplay?: boolean | null
          slider_autoplay_speed?: number | null
          social_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "widgets_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  platform_merge: {
    Tables: {
      drift_checks: {
        Row: {
          checked_at: string
          delta: number
          details: Json
          entity_type: string
          id: string
          sampled_equal: boolean
          source_app: string
          source_count: number
          target_count: number
        }
        Insert: {
          checked_at?: string
          delta?: number
          details?: Json
          entity_type: string
          id?: string
          sampled_equal?: boolean
          source_app: string
          source_count?: number
          target_count?: number
        }
        Update: {
          checked_at?: string
          delta?: number
          details?: Json
          entity_type?: string
          id?: string
          sampled_equal?: boolean
          source_app?: string
          source_count?: number
          target_count?: number
        }
        Relationships: []
      }
      id_mappings: {
        Row: {
          created_at: string
          entity_type: string
          id: number
          metadata: Json
          source_app: string
          source_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: number
          metadata?: Json
          source_app: string
          source_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: number
          metadata?: Json
          source_app?: string
          source_id?: string
          target_id?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          source_app: string
          started_at: string
          stats: Json
          status: string
          sync_mode: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          source_app: string
          started_at?: string
          stats?: Json
          status: string
          sync_mode: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          source_app?: string
          started_at?: string
          stats?: Json
          status?: string
          sync_mode?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finish_sync: {
        Args: {
          p_error?: string
          p_run_id: string
          p_stats?: Json
          p_status: string
        }
        Returns: undefined
      }
      start_sync: {
        Args: { p_source_app: string; p_sync_mode: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_module_settings: {
        Row: {
          account_id: string
          enabled: boolean
          module_key: string
        }
        Insert: {
          account_id: string
          enabled?: boolean
          module_key: string
        }
        Update: {
          account_id?: string
          enabled?: boolean
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_module_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_module_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_module_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_personal_account: boolean
          name: string
          picture_url: string | null
          primary_owner_user_id: string
          public_data: Json
          slug: string | null
          space_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_personal_account?: boolean
          name: string
          picture_url?: string | null
          primary_owner_user_id?: string
          public_data?: Json
          slug?: string | null
          space_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_personal_account?: boolean
          name?: string
          picture_url?: string | null
          primary_owner_user_id?: string
          public_data?: Json
          slug?: string | null
          space_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      accounts_memberships: {
        Row: {
          account_id: string
          account_role: string
          company_role: string | null
          created_at: string
          created_by: string | null
          onboarding_completed: boolean
          onboarding_step: number
          trade_role: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          account_role: string
          company_role?: string | null
          created_at?: string
          created_by?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          trade_role?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          account_role?: string
          company_role?: string | null
          created_at?: string
          created_by?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          trade_role?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_role_fkey"
            columns: ["account_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      billing_customers: {
        Row: {
          account_id: string
          customer_id: string
          email: string | null
          id: number
          provider: Database["public"]["Enums"]["billing_provider"]
        }
        Insert: {
          account_id: string
          customer_id: string
          email?: string | null
          id?: number
          provider: Database["public"]["Enums"]["billing_provider"]
        }
        Update: {
          account_id?: string
          customer_id?: string
          email?: string | null
          id?: number
          provider?: Database["public"]["Enums"]["billing_provider"]
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          account_id: string
          author_user_id: string
          client_id: string
          created_at: string | null
          id: string
          note: string
        }
        Insert: {
          account_id: string
          author_user_id: string
          client_id: string
          created_at?: string | null
          id?: string
          note: string
        }
        Update: {
          account_id?: string
          author_user_id?: string
          client_id?: string
          created_at?: string | null
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_id: string
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          display_name: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          picture_url: string | null
          postcode: string | null
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          picture_url?: string | null
          postcode?: string | null
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          picture_url?: string | null
          postcode?: string | null
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          enable_account_billing: boolean
          enable_team_account_billing: boolean
          enable_team_accounts: boolean
        }
        Insert: {
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          enable_account_billing?: boolean
          enable_team_account_billing?: boolean
          enable_team_accounts?: boolean
        }
        Update: {
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          enable_account_billing?: boolean
          enable_team_account_billing?: boolean
          enable_team_accounts?: boolean
        }
        Relationships: []
      }
      invitations: {
        Row: {
          account_id: string
          company_role: string | null
          created_at: string
          email: string
          expires_at: string
          id: number
          invite_token: string
          invited_by: string
          role: string
          updated_at: string
        }
        Insert: {
          account_id: string
          company_role?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: number
          invite_token: string
          invited_by: string
          role: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          company_role?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: number
          invite_token?: string
          invited_by?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          account_id: string
          next_number: number
        }
        Insert: {
          account_id: string
          next_number?: number
        }
        Update: {
          account_id?: string
          next_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_counters_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_counters_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_counters_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_events: {
        Row: {
          account_id: string
          actor_id: string | null
          created_at: string | null
          event_type: string
          id: string
          invoice_id: string
          payload: Json | null
        }
        Insert: {
          account_id: string
          actor_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          invoice_id: string
          payload?: Json | null
        }
        Update: {
          account_id?: string
          actor_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          invoice_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          account_id: string
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          job_id: string | null
          quantity: number
          sort_order: number
          total_pence: number
          unit_price_pence: number
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          job_id?: string | null
          quantity?: number
          sort_order?: number
          total_pence: number
          unit_price_pence: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          job_id?: string | null
          quantity?: number
          sort_order?: number
          total_pence?: number
          unit_price_pence?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string
          client_id: string
          created_at: string | null
          created_by: string | null
          currency: string
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          notes: string | null
          paid_at: string | null
          public_token: string | null
          sent_at: string | null
          sent_to_email: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal_pence: number
          total_pence: number
          updated_at: string | null
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string | null
          created_by?: string | null
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          notes?: string | null
          paid_at?: string | null
          public_token?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal_pence?: number
          total_pence?: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          notes?: string | null
          paid_at?: string | null
          public_token?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal_pence?: number
          total_pence?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          job_id: string
          role_on_job: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          job_id: string
          role_on_job?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          job_id?: string
          role_on_job?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_event_assignments: {
        Row: {
          account_id: string
          created_at: string
          id: string
          job_event_id: string
          role_on_event: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          job_event_id: string
          role_on_event?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          job_event_id?: string
          role_on_event?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_event_assignments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_event_assignments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_event_assignments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_event_assignments_job_event_id_fkey"
            columns: ["job_event_id"]
            isOneToOne: false
            referencedRelation: "job_events"
            referencedColumns: ["id"]
          },
        ]
      }
      job_events: {
        Row: {
          account_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          event_type: string
          follow_up_at: string | null
          follow_up_required: boolean
          id: string
          job_id: string
          location: string | null
          outcome_notes: string | null
          prep_notes: string | null
          scheduled_end_at: string | null
          scheduled_start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: string
          follow_up_at?: string | null
          follow_up_required?: boolean
          id?: string
          job_id: string
          location?: string | null
          outcome_notes?: string | null
          prep_notes?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          follow_up_at?: string | null
          follow_up_required?: boolean
          id?: string
          job_id?: string
          location?: string | null
          outcome_notes?: string | null
          prep_notes?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notes: {
        Row: {
          account_id: string
          author_user_id: string
          created_at: string | null
          id: string
          job_id: string
          note: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          author_user_id: string
          created_at?: string | null
          id?: string
          job_id: string
          note: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          author_user_id?: string
          created_at?: string | null
          id?: string
          job_id?: string
          note?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          account_id: string
          actual_minutes: number | null
          client_id: string | null
          cost_pence: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_minutes: number | null
          id: string
          priority: string
          start_date: string | null
          status: string
          title: string
          updated_at: string | null
          value_pence: number | null
        }
        Insert: {
          account_id: string
          actual_minutes?: number | null
          client_id?: string | null
          cost_pence?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          priority: string
          start_date?: string | null
          status: string
          title: string
          updated_at?: string | null
          value_pence?: number | null
        }
        Update: {
          account_id?: string
          actual_minutes?: number | null
          client_id?: string | null
          cost_pence?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          priority?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          value_pence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      nonces: {
        Row: {
          client_token: string
          created_at: string
          expires_at: string
          id: string
          last_verification_at: string | null
          last_verification_ip: unknown
          last_verification_user_agent: string | null
          metadata: Json | null
          nonce: string
          purpose: string
          revoked: boolean
          revoked_reason: string | null
          scopes: string[] | null
          used_at: string | null
          user_id: string | null
          verification_attempts: number
        }
        Insert: {
          client_token: string
          created_at?: string
          expires_at: string
          id?: string
          last_verification_at?: string | null
          last_verification_ip?: unknown
          last_verification_user_agent?: string | null
          metadata?: Json | null
          nonce: string
          purpose: string
          revoked?: boolean
          revoked_reason?: string | null
          scopes?: string[] | null
          used_at?: string | null
          user_id?: string | null
          verification_attempts?: number
        }
        Update: {
          client_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_verification_at?: string | null
          last_verification_ip?: unknown
          last_verification_user_agent?: string | null
          metadata?: Json | null
          nonce?: string
          purpose?: string
          revoked?: boolean
          revoked_reason?: string | null
          scopes?: string[] | null
          used_at?: string | null
          user_id?: string | null
          verification_attempts?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          account_id: string
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          dismissed: boolean
          expires_at: string | null
          id: number
          link: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          account_id: string
          body: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dismissed?: boolean
          expires_at?: string | null
          id?: never
          link?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          account_id?: string
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dismissed?: boolean
          expires_at?: string | null
          id?: never
          link?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price_amount: number | null
          product_id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id: string
          order_id: string
          price_amount?: number | null
          product_id: string
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price_amount?: number | null
          product_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          account_id: string
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          created_at: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_id: string
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          created_at?: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          billing_customer_id?: number
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          created_at?: string
          currency?: string
          id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_billing_customer_id_fkey"
            columns: ["billing_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          project_id: string
          user_id: string
        }
        Insert: {
          project_id: string
          user_id: string
        }
        Update: {
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          account_id: string
          client_id: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: number
          permission: Database["public"]["Enums"]["app_permissions"]
          role: string
        }
        Insert: {
          id?: number
          permission: Database["public"]["Enums"]["app_permissions"]
          role: string
        }
        Update: {
          id?: number
          permission?: Database["public"]["Enums"]["app_permissions"]
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      roles: {
        Row: {
          hierarchy_level: number
          name: string
        }
        Insert: {
          hierarchy_level: number
          name: string
        }
        Update: {
          hierarchy_level?: number
          name?: string
        }
        Relationships: []
      }
      subscription_items: {
        Row: {
          created_at: string
          id: string
          interval: string
          interval_count: number
          price_amount: number | null
          product_id: string
          quantity: number
          subscription_id: string
          type: Database["public"]["Enums"]["subscription_item_type"]
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id: string
          interval: string
          interval_count: number
          price_amount?: number | null
          product_id: string
          quantity?: number
          subscription_id: string
          type: Database["public"]["Enums"]["subscription_item_type"]
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval?: string
          interval_count?: number
          price_amount?: number | null
          product_id?: string
          quantity?: number
          subscription_id?: string
          type?: Database["public"]["Enums"]["subscription_item_type"]
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          account_id: string
          active: boolean
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          id: string
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          active: boolean
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          created_at?: string
          currency: string
          id: string
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          billing_customer_id?: number
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          id?: string
          period_ends_at?: string
          period_starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_billing_customer_id_fkey"
            columns: ["billing_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          accessibility_dyslexia_font: boolean
          accessibility_enhanced_focus: boolean
          accessibility_high_contrast: boolean
          accessibility_simplified_mode: boolean
          accessibility_text_size: string
          created_at: string | null
          first_name: string | null
          last_name: string | null
          mobile: string | null
          updated_at: string | null
          use_keel_for_community: boolean
          use_keel_for_family: boolean
          use_keel_for_work: boolean
          user_id: string
        }
        Insert: {
          accessibility_dyslexia_font?: boolean
          accessibility_enhanced_focus?: boolean
          accessibility_high_contrast?: boolean
          accessibility_simplified_mode?: boolean
          accessibility_text_size?: string
          created_at?: string | null
          first_name?: string | null
          last_name?: string | null
          mobile?: string | null
          updated_at?: string | null
          use_keel_for_community?: boolean
          use_keel_for_family?: boolean
          use_keel_for_work?: boolean
          user_id: string
        }
        Update: {
          accessibility_dyslexia_font?: boolean
          accessibility_enhanced_focus?: boolean
          accessibility_high_contrast?: boolean
          accessibility_simplified_mode?: boolean
          accessibility_text_size?: string
          created_at?: string | null
          first_name?: string | null
          last_name?: string | null
          mobile?: string | null
          updated_at?: string | null
          use_keel_for_community?: boolean
          use_keel_for_family?: boolean
          use_keel_for_work?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_account_workspace: {
        Row: {
          id: string | null
          name: string | null
          picture_url: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
        }
        Relationships: []
      }
      user_accounts: {
        Row: {
          id: string | null
          name: string | null
          picture_url: string | null
          role: string | null
          slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_memberships_account_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { token: string; user_id: string }
        Returns: string
      }
      add_invitations_to_account: {
        Args: {
          account_slug: string
          invitations: Database["public"]["CompositeTypes"]["invitation"][]
          invited_by: string
        }
        Returns: Database["public"]["Tables"]["invitations"]["Row"][]
      }
      allocate_invoice_number: {
        Args: { p_account_id: string }
        Returns: string
      }
      can_action_account_member: {
        Args: { target_team_account_id: string; target_user_id: string }
        Returns: boolean
      }
      contractor_assigned_to_job: { Args: { job_id: string }; Returns: boolean }
      contractor_assigned_to_project: {
        Args: { project_id: string }
        Returns: boolean
      }
      contractor_can_see_job_event: {
        Args: { p_job_event_id: string }
        Returns: boolean
      }
      create_invitation: {
        Args: { account_id: string; email: string; role: string }
        Returns: {
          account_id: string
          company_role: string | null
          created_at: string
          email: string
          expires_at: string
          id: number
          invite_token: string
          invited_by: string
          role: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_nonce: {
        Args: {
          p_expires_in_seconds?: number
          p_metadata?: Json
          p_purpose?: string
          p_revoke_previous?: boolean
          p_scopes?: string[]
          p_user_id?: string
        }
        Returns: Json
      }
      create_team_account:
        | {
            Args: {
              account_name: string
              account_slug?: string
              user_id: string
            }
            Returns: {
              created_at: string | null
              created_by: string | null
              email: string | null
              id: string
              is_personal_account: boolean
              name: string
              picture_url: string | null
              primary_owner_user_id: string
              public_data: Json
              slug: string | null
              space_type: string | null
              updated_at: string | null
              updated_by: string | null
            }
            SetofOptions: {
              from: "*"
              to: "accounts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              account_name: string
              account_slug?: string
              account_space_type?: string
              user_id: string
            }
            Returns: {
              created_at: string | null
              created_by: string | null
              email: string | null
              id: string
              is_personal_account: boolean
              name: string
              picture_url: string | null
              primary_owner_user_id: string
              public_data: Json
              slug: string | null
              space_type: string | null
              updated_at: string | null
              updated_by: string | null
            }
            SetofOptions: {
              from: "*"
              to: "accounts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      get_account_invitations: {
        Args: { account_slug: string }
        Returns: {
          account_id: string
          created_at: string
          email: string
          expires_at: string
          id: number
          invited_by: string
          inviter_email: string
          inviter_name: string
          role: string
          updated_at: string
        }[]
      }
      get_account_members: {
        Args: { account_slug: string }
        Returns: {
          account_id: string
          created_at: string
          email: string
          id: string
          name: string
          picture_url: string
          primary_owner_user_id: string
          role: string
          role_hierarchy_level: number
          updated_at: string
          user_id: string
        }[]
      }
      get_config: { Args: never; Returns: Json }
      get_invoice_for_portal: { Args: { p_token: string }; Returns: Json }
      get_nonce_status: { Args: { p_id: string }; Returns: Json }
      get_upper_system_role: { Args: never; Returns: string }
      has_active_subscription: {
        Args: { target_account_id: string }
        Returns: boolean
      }
      has_more_elevated_role: {
        Args: {
          role_name: string
          target_account_id: string
          target_user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: {
          account_id: string
          permission_name: Database["public"]["Enums"]["app_permissions"]
          user_id: string
        }
        Returns: boolean
      }
      has_role_on_account: {
        Args: { account_id: string; account_role?: string }
        Returns: boolean
      }
      has_same_role_hierarchy_level: {
        Args: {
          role_name: string
          target_account_id: string
          target_user_id: string
        }
        Returns: boolean
      }
      is_aal2: { Args: never; Returns: boolean }
      is_account_admin: {
        Args: { target_account_id: string }
        Returns: boolean
      }
      is_account_member: {
        Args: { target_account_id: string }
        Returns: boolean
      }
      is_account_owner: { Args: { account_id: string }; Returns: boolean }
      is_account_team_member: {
        Args: { target_account_id: string }
        Returns: boolean
      }
      is_client_on_account: { Args: { account_id: string }; Returns: boolean }
      is_contractor_on_account: {
        Args: { account_id: string }
        Returns: boolean
      }
      is_mfa_compliant: { Args: never; Returns: boolean }
      is_set: { Args: { field_name: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_team_member: {
        Args: { account_id: string; user_id: string }
        Returns: boolean
      }
      revoke_nonce: {
        Args: { p_id: string; p_reason?: string }
        Returns: boolean
      }
      team_account_workspace: {
        Args: { account_slug: string }
        Returns: {
          company_role: string
          id: string
          name: string
          onboarding_completed: boolean
          permissions: Database["public"]["Enums"]["app_permissions"][]
          picture_url: string
          primary_owner_user_id: string
          role: string
          role_hierarchy_level: number
          slug: string
          space_type: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
        }[]
      }
      transfer_team_account_ownership: {
        Args: { new_owner_id: string; target_account_id: string }
        Returns: undefined
      }
      upsert_order: {
        Args: {
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          currency: string
          line_items: Json
          status: Database["public"]["Enums"]["payment_status"]
          target_account_id: string
          target_customer_id: string
          target_order_id: string
          total_amount: number
        }
        Returns: {
          account_id: string
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          created_at: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_subscription: {
        Args: {
          active: boolean
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          currency: string
          line_items: Json
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          target_account_id: string
          target_customer_id: string
          target_subscription_id: string
          trial_ends_at?: string
          trial_starts_at?: string
        }
        Returns: {
          account_id: string
          active: boolean
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          id: string
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_nonce: {
        Args: {
          p_ip?: unknown
          p_max_verification_attempts?: number
          p_purpose: string
          p_required_scopes?: string[]
          p_token: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_permissions:
        | "roles.manage"
        | "billing.manage"
        | "settings.manage"
        | "members.manage"
        | "invites.manage"
        | "projects.view"
        | "projects.edit"
        | "clients.view"
        | "clients.edit"
        | "jobs.view"
        | "jobs.edit"
        | "invoices.view"
        | "invoices.edit"
      billing_provider: "stripe" | "lemon-squeezy" | "paddle"
      notification_channel: "in_app" | "email"
      notification_type: "info" | "warning" | "error"
      payment_status: "pending" | "succeeded" | "failed"
      subscription_item_type: "flat" | "per_seat" | "metered"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | "paused"
    }
    CompositeTypes: {
      invitation: {
        email: string | null
        role: string | null
      }
    }
  }
  rankly: {
    Tables: {
      alert_history: {
        Row: {
          alert_id: string
          id: string
          new_position: number | null
          notified: boolean
          previous_position: number | null
          triggered_at: string
        }
        Insert: {
          alert_id: string
          id?: string
          new_position?: number | null
          notified?: boolean
          previous_position?: number | null
          triggered_at?: string
        }
        Update: {
          alert_id?: string
          id?: string
          new_position?: number | null
          notified?: boolean
          previous_position?: number | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          keyword_id: string
          last_triggered_at: string | null
          threshold: number | null
          threshold_position: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword_id: string
          last_triggered_at?: string | null
          threshold?: number | null
          threshold_position?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword_id?: string
          last_triggered_at?: string | null
          threshold?: number | null
          threshold_position?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_crawls: {
        Row: {
          completed_at: string | null
          id: string
          project_id: string
          started_at: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          project_id: string
          started_at?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          project_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_crawls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      backlinks: {
        Row: {
          anchor_text: string | null
          crawl_id: string | null
          crawled_at: string
          created_at: string
          discovered_at: string | null
          first_seen: string | null
          id: string
          last_seen: string | null
          link_type: string
          project_id: string
          source_domain: string | null
          source_dr: number | null
          source_url: string
          status: string
          target_url: string | null
        }
        Insert: {
          anchor_text?: string | null
          crawl_id?: string | null
          crawled_at?: string
          created_at?: string
          discovered_at?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          link_type?: string
          project_id: string
          source_domain?: string | null
          source_dr?: number | null
          source_url: string
          status?: string
          target_url?: string | null
        }
        Update: {
          anchor_text?: string | null
          crawl_id?: string | null
          crawled_at?: string
          created_at?: string
          discovered_at?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          link_type?: string
          project_id?: string
          source_domain?: string | null
          source_dr?: number | null
          source_url?: string
          status?: string
          target_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backlinks_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "backlink_crawls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlinks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_keywords: {
        Row: {
          competitor_domain: string
          competitor_position: number | null
          id: string
          keyword_id: string
          project_id: string
          recorded_at: string
        }
        Insert: {
          competitor_domain: string
          competitor_position?: number | null
          id?: string
          keyword_id: string
          project_id: string
          recorded_at: string
        }
        Update: {
          competitor_domain?: string
          competitor_position?: number | null
          id?: string
          keyword_id?: string
          project_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_keywords_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_keywords_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      dataforseo_api_log: {
        Row: {
          called_at: string
          endpoint: string
          estimated_cost_usd: number | null
          feature_area: string | null
          id: string
          project_id: string | null
          task_count: number
        }
        Insert: {
          called_at?: string
          endpoint: string
          estimated_cost_usd?: number | null
          feature_area?: string | null
          id?: string
          project_id?: string | null
          task_count?: number
        }
        Update: {
          called_at?: string
          endpoint?: string
          estimated_cost_usd?: number | null
          feature_area?: string | null
          id?: string
          project_id?: string | null
          task_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "dataforseo_api_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_metrics: {
        Row: {
          backlinks_total: number | null
          created_at: string
          da_score: number | null
          dofollow_count: number | null
          domain: string
          dr_score: number | null
          id: string
          is_competitor: boolean
          nofollow_count: number | null
          organic_traffic_estimate: number | null
          project_id: string
          recorded_at: string
          referring_domains: number | null
          source_endpoint: string | null
        }
        Insert: {
          backlinks_total?: number | null
          created_at?: string
          da_score?: number | null
          dofollow_count?: number | null
          domain: string
          dr_score?: number | null
          id?: string
          is_competitor?: boolean
          nofollow_count?: number | null
          organic_traffic_estimate?: number | null
          project_id: string
          recorded_at: string
          referring_domains?: number | null
          source_endpoint?: string | null
        }
        Update: {
          backlinks_total?: number | null
          created_at?: string
          da_score?: number | null
          dofollow_count?: number | null
          domain?: string
          dr_score?: number | null
          id?: string
          is_competitor?: boolean
          nofollow_count?: number | null
          organic_traffic_estimate?: number | null
          project_id?: string
          recorded_at?: string
          referring_domains?: number | null
          source_endpoint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_rankings: {
        Row: {
          ai_overview_present: boolean
          created_at: string
          date: string
          device: string
          id: string
          keyword_id: string
          position: number | null
          ranking_url: string | null
          serp_features: Json
        }
        Insert: {
          ai_overview_present?: boolean
          created_at?: string
          date: string
          device?: string
          id?: string
          keyword_id: string
          position?: number | null
          ranking_url?: string | null
          serp_features?: Json
        }
        Update: {
          ai_overview_present?: boolean
          created_at?: string
          date?: string
          device?: string
          id?: string
          keyword_id?: string
          position?: number | null
          ranking_url?: string | null
          serp_features?: Json
        }
        Relationships: [
          {
            foreignKeyName: "keyword_rankings_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_research_cache: {
        Row: {
          cached_at: string
          country: string
          expires_at: string
          id: string
          language: string
          results: Json
          seed_keyword: string
        }
        Insert: {
          cached_at?: string
          country: string
          expires_at: string
          id?: string
          language: string
          results: Json
          seed_keyword: string
        }
        Update: {
          cached_at?: string
          country?: string
          expires_at?: string
          id?: string
          language?: string
          results?: Json
          seed_keyword?: string
        }
        Relationships: []
      }
      keyword_tag_assignments: {
        Row: {
          keyword_id: string
          tag_id: string
        }
        Insert: {
          keyword_id: string
          tag_id: string
        }
        Update: {
          keyword_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_tag_assignments_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      keywords: {
        Row: {
          cpc: number | null
          created_at: string
          device: string
          id: string
          keyword: string
          keyword_difficulty: number | null
          keyword_normalized: string | null
          project_id: string
          search_engine: string
          search_volume: number | null
          updated_at: string
        }
        Insert: {
          cpc?: number | null
          created_at?: string
          device?: string
          id?: string
          keyword: string
          keyword_difficulty?: number | null
          keyword_normalized?: string | null
          project_id: string
          search_engine?: string
          search_volume?: number | null
          updated_at?: string
        }
        Update: {
          cpc?: number | null
          created_at?: string
          device?: string
          id?: string
          keyword?: string
          keyword_difficulty?: number | null
          keyword_normalized?: string | null
          project_id?: string
          search_engine?: string
          search_volume?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "keywords_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_competitors: {
        Row: {
          competitor_domain: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          competitor_domain: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          competitor_domain?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_competitors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_cron_state: {
        Row: {
          last_backlink_refresh_at: string | null
          last_competitor_labs_at: string | null
          last_domain_metrics_at: string | null
          last_rank_check_at: string | null
          project_id: string
        }
        Insert: {
          last_backlink_refresh_at?: string | null
          last_competitor_labs_at?: string | null
          last_domain_metrics_at?: string | null
          last_rank_check_at?: string | null
          project_id: string
        }
        Update: {
          last_backlink_refresh_at?: string | null
          last_competitor_labs_at?: string | null
          last_domain_metrics_at?: string | null
          last_rank_check_at?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_cron_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          account_id: string
          colour: string | null
          created_at: string
          domain: string
          id: string
          locale: string | null
          name: string
          notes: string | null
          target_country: string
          target_language: string
          track_desktop: boolean
          track_mobile: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          colour?: string | null
          created_at?: string
          domain: string
          id?: string
          locale?: string | null
          name: string
          notes?: string | null
          target_country?: string
          target_language?: string
          track_desktop?: boolean
          track_mobile?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          colour?: string | null
          created_at?: string
          domain?: string
          id?: string
          locale?: string | null
          name?: string
          notes?: string | null
          target_country?: string
          target_language?: string
          track_desktop?: boolean
          track_mobile?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  signatures: {
    Tables: {
      ms_connections: {
        Row: {
          access_token: string | null
          account_id: string
          connected_at: string
          connected_by: string | null
          id: string
          ms_tenant_id: string
          refresh_token: string | null
          token_expires_at: string | null
        }
        Insert: {
          access_token?: string | null
          account_id: string
          connected_at?: string
          connected_by?: string | null
          id?: string
          ms_tenant_id: string
          refresh_token?: string | null
          token_expires_at?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: string
          connected_at?: string
          connected_by?: string | null
          id?: string
          ms_tenant_id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
        }
        Relationships: []
      }
      push_log: {
        Row: {
          account_id: string
          error_message: string | null
          id: string
          pushed_at: string
          pushed_by: string | null
          staff_id: string
          status: string
        }
        Insert: {
          account_id: string
          error_message?: string | null
          id?: string
          pushed_at?: string
          pushed_by?: string | null
          staff_id: string
          status: string
        }
        Update: {
          account_id?: string
          error_message?: string | null
          id?: string
          pushed_at?: string
          pushed_by?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          account_id: string
          branch: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          job_title: string | null
          ms_user_id: string | null
          phone_direct: string | null
          phone_mobile: string | null
          photo_url: string | null
          signature_pushed_at: string | null
          signature_status: string
        }
        Insert: {
          account_id: string
          branch?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          ms_user_id?: string | null
          phone_direct?: string | null
          phone_mobile?: string | null
          photo_url?: string | null
          signature_pushed_at?: string | null
          signature_status?: string
        }
        Update: {
          account_id?: string
          branch?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          ms_user_id?: string | null
          phone_direct?: string | null
          phone_mobile?: string | null
          photo_url?: string | null
          signature_pushed_at?: string | null
          signature_status?: string
        }
        Relationships: []
      }
      staff_templates: {
        Row: {
          staff_id: string
          template_id: string
        }
        Insert: {
          staff_id: string
          template_id: string
        }
        Update: {
          staff_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_templates_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          account_id: string
          created_at: string
          html_template: string
          id: string
          is_default: boolean
          name: string
          preview_image_url: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          html_template: string
          id?: string
          is_default?: boolean
          name: string
          preview_image_url?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          html_template?: string
          id?: string
          is_default?: boolean
          name?: string
          preview_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  feedflow: {
    Enums: {},
  },
  graphql_public: {
    Enums: {},
  },
  platform_merge: {
    Enums: {},
  },
  public: {
    Enums: {
      app_permissions: [
        "roles.manage",
        "billing.manage",
        "settings.manage",
        "members.manage",
        "invites.manage",
        "projects.view",
        "projects.edit",
        "clients.view",
        "clients.edit",
        "jobs.view",
        "jobs.edit",
        "invoices.view",
        "invoices.edit",
      ],
      billing_provider: ["stripe", "lemon-squeezy", "paddle"],
      notification_channel: ["in_app", "email"],
      notification_type: ["info", "warning", "error"],
      payment_status: ["pending", "succeeded", "failed"],
      subscription_item_type: ["flat", "per_seat", "metered"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
        "paused",
      ],
    },
  },
  rankly: {
    Enums: {},
  },
  signatures: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

