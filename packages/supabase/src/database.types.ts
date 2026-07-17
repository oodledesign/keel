export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.4';
  };
  feedflow: {
    Tables: {
      bunny_libraries: {
        Row: {
          account_id: string;
          client_id: string | null;
          created_at: string;
          id: string;
          library_id: string;
        };
        Insert: {
          account_id: string;
          client_id?: string | null;
          created_at?: string;
          id?: string;
          library_id: string;
        };
        Update: {
          account_id?: string;
          client_id?: string | null;
          created_at?: string;
          id?: string;
          library_id?: string;
        };
        Relationships: [];
      };
      feed_cache: {
        Row: {
          account_id: string;
          cached_at: string | null;
          created_at: string;
          expires_at: string | null;
          fetched_at: string;
          id: string;
          payload: Json;
          raw_json: Json | null;
          social_account_id: string | null;
        };
        Insert: {
          account_id: string;
          cached_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          fetched_at?: string;
          id?: string;
          payload: Json;
          raw_json?: Json | null;
          social_account_id?: string | null;
        };
        Update: {
          account_id?: string;
          cached_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          fetched_at?: string;
          id?: string;
          payload?: Json;
          raw_json?: Json | null;
          social_account_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'feed_cache_social_account_id_fkey';
            columns: ['social_account_id'];
            isOneToOne: false;
            referencedRelation: 'social_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      google_accounts: {
        Row: {
          access_token: string;
          account_id: string;
          client_id: string | null;
          connected_at: string | null;
          created_at: string;
          google_account_id: string | null;
          id: string;
          last_refreshed_at: string | null;
          location_id: string | null;
          location_name: string | null;
          refresh_token: string;
          token_expires_at: string | null;
          token_status: string | null;
          updated_at: string;
        };
        Insert: {
          access_token: string;
          account_id: string;
          client_id?: string | null;
          connected_at?: string | null;
          created_at?: string;
          google_account_id?: string | null;
          id?: string;
          last_refreshed_at?: string | null;
          location_id?: string | null;
          location_name?: string | null;
          refresh_token: string;
          token_expires_at?: string | null;
          token_status?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          account_id?: string;
          client_id?: string | null;
          connected_at?: string | null;
          created_at?: string;
          google_account_id?: string | null;
          id?: string;
          last_refreshed_at?: string | null;
          location_id?: string | null;
          location_name?: string | null;
          refresh_token?: string;
          token_expires_at?: string | null;
          token_status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_reviews_cache: {
        Row: {
          account_id: string;
          average_rating: number | null;
          cached_at: string | null;
          excluded_review_ids: string[] | null;
          expires_at: string | null;
          google_account_id: string;
          id: string;
          raw_json: Json;
          total_review_count: number | null;
        };
        Insert: {
          account_id: string;
          average_rating?: number | null;
          cached_at?: string | null;
          excluded_review_ids?: string[] | null;
          expires_at?: string | null;
          google_account_id: string;
          id?: string;
          raw_json: Json;
          total_review_count?: number | null;
        };
        Update: {
          account_id?: string;
          average_rating?: number | null;
          cached_at?: string | null;
          excluded_review_ids?: string[] | null;
          expires_at?: string | null;
          google_account_id?: string;
          id?: string;
          raw_json?: Json;
          total_review_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'google_reviews_cache_google_account_id_fkey';
            columns: ['google_account_id'];
            isOneToOne: false;
            referencedRelation: 'google_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      social_accounts: {
        Row: {
          access_token: string | null;
          account_id: string;
          client_id: string | null;
          connected_at: string | null;
          created_at: string;
          external_account_id: string;
          id: string;
          last_refreshed_at: string | null;
          platform: string | null;
          platform_user_id: string | null;
          provider: string;
          refresh_token: string | null;
          token_expires_at: string | null;
          token_status: string | null;
          updated_at: string;
        };
        Insert: {
          access_token?: string | null;
          account_id: string;
          client_id?: string | null;
          connected_at?: string | null;
          created_at?: string;
          external_account_id: string;
          id?: string;
          last_refreshed_at?: string | null;
          platform?: string | null;
          platform_user_id?: string | null;
          provider: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          token_status?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token?: string | null;
          account_id?: string;
          client_id?: string | null;
          connected_at?: string | null;
          created_at?: string;
          external_account_id?: string;
          id?: string;
          last_refreshed_at?: string | null;
          platform?: string | null;
          platform_user_id?: string | null;
          provider?: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          token_status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      token_refresh_log: {
        Row: {
          account_id: string;
          attempted_at: string | null;
          error_message: string | null;
          id: string;
          platform: string | null;
          social_account_id: string | null;
          success: boolean | null;
        };
        Insert: {
          account_id: string;
          attempted_at?: string | null;
          error_message?: string | null;
          id?: string;
          platform?: string | null;
          social_account_id?: string | null;
          success?: boolean | null;
        };
        Update: {
          account_id?: string;
          attempted_at?: string | null;
          error_message?: string | null;
          id?: string;
          platform?: string | null;
          social_account_id?: string | null;
          success?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'token_refresh_log_social_account_id_fkey';
            columns: ['social_account_id'];
            isOneToOne: false;
            referencedRelation: 'social_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      videos: {
        Row: {
          account_id: string;
          bunny_video_id: string | null;
          client_id: string | null;
          created_at: string;
          embed_key: string | null;
          id: string;
          status: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          bunny_video_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          embed_key?: string | null;
          id?: string;
          status?: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          bunny_video_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          embed_key?: string | null;
          id?: string;
          status?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      webflow_connections: {
        Row: {
          account_id: string;
          auto_publish: boolean | null;
          client_id: string | null;
          created_at: string | null;
          google_account_id: string | null;
          id: string;
          last_synced_at: string | null;
          min_character_count: number | null;
          sync_error: string | null;
          sync_mode: string | null;
          sync_status: string | null;
          webflow_api_token: string;
          webflow_collection_id: string;
          webflow_site_id: string;
        };
        Insert: {
          account_id: string;
          auto_publish?: boolean | null;
          client_id?: string | null;
          created_at?: string | null;
          google_account_id?: string | null;
          id?: string;
          last_synced_at?: string | null;
          min_character_count?: number | null;
          sync_error?: string | null;
          sync_mode?: string | null;
          sync_status?: string | null;
          webflow_api_token: string;
          webflow_collection_id: string;
          webflow_site_id: string;
        };
        Update: {
          account_id?: string;
          auto_publish?: boolean | null;
          client_id?: string | null;
          created_at?: string | null;
          google_account_id?: string | null;
          id?: string;
          last_synced_at?: string | null;
          min_character_count?: number | null;
          sync_error?: string | null;
          sync_mode?: string | null;
          sync_status?: string | null;
          webflow_api_token?: string;
          webflow_collection_id?: string;
          webflow_site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'webflow_connections_google_account_id_fkey';
            columns: ['google_account_id'];
            isOneToOne: false;
            referencedRelation: 'google_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      webflow_sync_log: {
        Row: {
          account_id: string;
          error_message: string | null;
          id: string;
          reviews_fetched: number | null;
          reviews_skipped: number | null;
          reviews_synced: number | null;
          success: boolean | null;
          synced_at: string | null;
          webflow_connection_id: string | null;
        };
        Insert: {
          account_id: string;
          error_message?: string | null;
          id?: string;
          reviews_fetched?: number | null;
          reviews_skipped?: number | null;
          reviews_synced?: number | null;
          success?: boolean | null;
          synced_at?: string | null;
          webflow_connection_id?: string | null;
        };
        Update: {
          account_id?: string;
          error_message?: string | null;
          id?: string;
          reviews_fetched?: number | null;
          reviews_skipped?: number | null;
          reviews_synced?: number | null;
          success?: boolean | null;
          synced_at?: string | null;
          webflow_connection_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'webflow_sync_log_webflow_connection_id_fkey';
            columns: ['webflow_connection_id'];
            isOneToOne: false;
            referencedRelation: 'webflow_connections';
            referencedColumns: ['id'];
          },
        ];
      };
      widgets: {
        Row: {
          accent_colour: string | null;
          account_id: string;
          border_radius: number | null;
          client_id: string | null;
          columns_desktop: number | null;
          columns_mobile: number | null;
          columns_tablet: number | null;
          created_at: string;
          custom_css: string | null;
          embed_key: string;
          gap: number | null;
          id: string;
          layout: string | null;
          name: string;
          open_in: string | null;
          post_count: number | null;
          settings: Json;
          show_captions: boolean | null;
          show_likes: boolean | null;
          slider_autoplay: boolean | null;
          slider_autoplay_speed: number | null;
          social_account_id: string | null;
          updated_at: string;
        };
        Insert: {
          accent_colour?: string | null;
          account_id: string;
          border_radius?: number | null;
          client_id?: string | null;
          columns_desktop?: number | null;
          columns_mobile?: number | null;
          columns_tablet?: number | null;
          created_at?: string;
          custom_css?: string | null;
          embed_key: string;
          gap?: number | null;
          id?: string;
          layout?: string | null;
          name: string;
          open_in?: string | null;
          post_count?: number | null;
          settings?: Json;
          show_captions?: boolean | null;
          show_likes?: boolean | null;
          slider_autoplay?: boolean | null;
          slider_autoplay_speed?: number | null;
          social_account_id?: string | null;
          updated_at?: string;
        };
        Update: {
          accent_colour?: string | null;
          account_id?: string;
          border_radius?: number | null;
          client_id?: string | null;
          columns_desktop?: number | null;
          columns_mobile?: number | null;
          columns_tablet?: number | null;
          created_at?: string;
          custom_css?: string | null;
          embed_key?: string;
          gap?: number | null;
          id?: string;
          layout?: string | null;
          name?: string;
          open_in?: string | null;
          post_count?: number | null;
          settings?: Json;
          show_captions?: boolean | null;
          show_likes?: boolean | null;
          slider_autoplay?: boolean | null;
          slider_autoplay_speed?: number | null;
          social_account_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'widgets_social_account_id_fkey';
            columns: ['social_account_id'];
            isOneToOne: false;
            referencedRelation: 'social_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  platform_merge: {
    Tables: {
      drift_checks: {
        Row: {
          checked_at: string;
          delta: number;
          details: Json;
          entity_type: string;
          id: string;
          sampled_equal: boolean;
          source_app: string;
          source_count: number;
          target_count: number;
        };
        Insert: {
          checked_at?: string;
          delta?: number;
          details?: Json;
          entity_type: string;
          id?: string;
          sampled_equal?: boolean;
          source_app: string;
          source_count?: number;
          target_count?: number;
        };
        Update: {
          checked_at?: string;
          delta?: number;
          details?: Json;
          entity_type?: string;
          id?: string;
          sampled_equal?: boolean;
          source_app?: string;
          source_count?: number;
          target_count?: number;
        };
        Relationships: [];
      };
      id_mappings: {
        Row: {
          created_at: string;
          entity_type: string;
          id: number;
          metadata: Json;
          source_app: string;
          source_id: string;
          target_id: string;
        };
        Insert: {
          created_at?: string;
          entity_type: string;
          id?: number;
          metadata?: Json;
          source_app: string;
          source_id: string;
          target_id: string;
        };
        Update: {
          created_at?: string;
          entity_type?: string;
          id?: number;
          metadata?: Json;
          source_app?: string;
          source_id?: string;
          target_id?: string;
        };
        Relationships: [];
      };
      sync_runs: {
        Row: {
          error: string | null;
          finished_at: string | null;
          id: string;
          source_app: string;
          started_at: string;
          stats: Json;
          status: string;
          sync_mode: string;
        };
        Insert: {
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          source_app: string;
          started_at?: string;
          stats?: Json;
          status: string;
          sync_mode: string;
        };
        Update: {
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          source_app?: string;
          started_at?: string;
          stats?: Json;
          status?: string;
          sync_mode?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      finish_sync: {
        Args: {
          p_error?: string;
          p_run_id: string;
          p_stats?: Json;
          p_status: string;
        };
        Returns: undefined;
      };
      start_sync: {
        Args: { p_source_app: string; p_sync_mode: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      account_billing_exempt: {
        Row: {
          account_id: string;
          created_at: string;
          granted_by: string | null;
          reason: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          granted_by?: string | null;
          reason?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          granted_by?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'account_billing_exempt_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_billing_exempt_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_billing_exempt_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      account_branches: {
        Row: {
          account_id: string;
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_default: boolean;
          name: string;
          phone: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          phone?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          phone?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_branches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_branches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_branches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      account_brand_settings: {
        Row: {
          accent_color: string | null;
          account_id: string;
          address: string | null;
          created_at: string;
          logo_url: string | null;
          primary_color: string;
          secondary_color: string | null;
          updated_at: string;
          website_url: string | null;
        };
        Insert: {
          accent_color?: string | null;
          account_id: string;
          address?: string | null;
          created_at?: string;
          logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string | null;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          accent_color?: string | null;
          account_id?: string;
          address?: string | null;
          created_at?: string;
          logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string | null;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'account_brand_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_brand_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_brand_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      account_calendar_events: {
        Row: {
          account_id: string;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          evening_parts: Json;
          id: string;
          location: string | null;
          meal_plan: string | null;
          series_id: string | null;
          series_label: string | null;
          session_notes: string | null;
          starts_at: string;
          status: string;
          template_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          evening_parts?: Json;
          id?: string;
          location?: string | null;
          meal_plan?: string | null;
          series_id?: string | null;
          series_label?: string | null;
          session_notes?: string | null;
          starts_at: string;
          status?: string;
          template_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          evening_parts?: Json;
          id?: string;
          location?: string | null;
          meal_plan?: string | null;
          series_id?: string | null;
          series_label?: string | null;
          session_notes?: string | null;
          starts_at?: string;
          status?: string;
          template_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_calendar_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_calendar_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_calendar_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_calendar_events_series_id_fkey';
            columns: ['series_id'];
            isOneToOne: false;
            referencedRelation: 'community_meetup_series';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_calendar_events_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'community_meetup_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      account_entitlements: {
        Row: {
          account_id: string;
          created_at: string;
          entitlement_key: string;
          expires_at: string | null;
          granted_by: string | null;
          id: string;
          metadata: Json;
          source: string;
          stripe_subscription_id: string | null;
          stripe_variant_id: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          entitlement_key: string;
          expires_at?: string | null;
          granted_by?: string | null;
          id?: string;
          metadata?: Json;
          source?: string;
          stripe_subscription_id?: string | null;
          stripe_variant_id?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          entitlement_key?: string;
          expires_at?: string | null;
          granted_by?: string | null;
          id?: string;
          metadata?: Json;
          source?: string;
          stripe_subscription_id?: string | null;
          stripe_variant_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_entitlements_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_entitlements_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_entitlements_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      account_module_settings: {
        Row: {
          account_id: string;
          enabled: boolean;
          module_key: string;
        };
        Insert: {
          account_id: string;
          enabled?: boolean;
          module_key: string;
        };
        Update: {
          account_id?: string;
          enabled?: boolean;
          module_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_module_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_module_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_module_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      account_payment_settings: {
        Row: {
          account_id: string;
          bank_account_name: string | null;
          bank_account_number: string | null;
          bank_bic: string | null;
          bank_iban: string | null;
          bank_sort_code: string | null;
          bank_transfer_enabled: boolean;
          bank_transfer_instructions: string | null;
          created_at: string;
          invoice_starting_number: number;
          stripe_account_id: string | null;
          stripe_connect_enabled: boolean;
          stripe_pay_now_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_bic?: string | null;
          bank_iban?: string | null;
          bank_sort_code?: string | null;
          bank_transfer_enabled?: boolean;
          bank_transfer_instructions?: string | null;
          created_at?: string;
          invoice_starting_number?: number;
          stripe_account_id?: string | null;
          stripe_connect_enabled?: boolean;
          stripe_pay_now_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_bic?: string | null;
          bank_iban?: string | null;
          bank_sort_code?: string | null;
          bank_transfer_enabled?: boolean;
          bank_transfer_instructions?: string | null;
          created_at?: string;
          invoice_starting_number?: number;
          stripe_account_id?: string | null;
          stripe_connect_enabled?: boolean;
          stripe_pay_now_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_payment_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_payment_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_payment_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      account_plan_limits: {
        Row: {
          account_id: string;
          max_members: number | null;
          max_properties: number | null;
          max_videos: number | null;
          plan_family: string | null;
          plan_id: string | null;
          plan_product_id: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          max_members?: number | null;
          max_properties?: number | null;
          max_videos?: number | null;
          plan_family?: string | null;
          plan_id?: string | null;
          plan_product_id?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          max_members?: number | null;
          max_properties?: number | null;
          max_videos?: number | null;
          plan_family?: string | null;
          plan_id?: string | null;
          plan_product_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_plan_limits_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_plan_limits_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_plan_limits_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      account_task_automation_settings: {
        Row: {
          account_id: string;
          auto_schedule_on_calendar: boolean;
          calendar_lead_time_minutes: number;
          created_at: string;
          email_tasks_mode: string;
          exclude_personal_calendar_busy: boolean;
          meeting_tasks_mode: string;
          updated_at: string;
          working_hours_end: string;
          working_hours_start: string;
        };
        Insert: {
          account_id: string;
          auto_schedule_on_calendar?: boolean;
          calendar_lead_time_minutes?: number;
          created_at?: string;
          email_tasks_mode?: string;
          exclude_personal_calendar_busy?: boolean;
          meeting_tasks_mode?: string;
          updated_at?: string;
          working_hours_end?: string;
          working_hours_start?: string;
        };
        Update: {
          account_id?: string;
          auto_schedule_on_calendar?: boolean;
          calendar_lead_time_minutes?: number;
          created_at?: string;
          email_tasks_mode?: string;
          exclude_personal_calendar_busy?: boolean;
          meeting_tasks_mode?: string;
          updated_at?: string;
          working_hours_end?: string;
          working_hours_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_task_automation_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_task_automation_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_task_automation_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      accounts: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          email: string | null;
          id: string;
          is_personal_account: boolean;
          name: string;
          picture_url: string | null;
          primary_owner_user_id: string;
          public_data: Json;
          slug: string | null;
          space_type: string | null;
          updated_at: string | null;
          updated_by: string | null;
          video_settings: Json;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          is_personal_account?: boolean;
          name: string;
          picture_url?: string | null;
          primary_owner_user_id?: string;
          public_data?: Json;
          slug?: string | null;
          space_type?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          video_settings?: Json;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          is_personal_account?: boolean;
          name?: string;
          picture_url?: string | null;
          primary_owner_user_id?: string;
          public_data?: Json;
          slug?: string | null;
          space_type?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          video_settings?: Json;
        };
        Relationships: [];
      };
      accounts_memberships: {
        Row: {
          account_id: string;
          account_role: string;
          company_role: string | null;
          created_at: string;
          created_by: string | null;
          onboarding_completed: boolean;
          onboarding_step: number;
          trade_role: string | null;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          account_id: string;
          account_role: string;
          company_role?: string | null;
          created_at?: string;
          created_by?: string | null;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          trade_role?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string;
          account_role?: string;
          company_role?: string | null;
          created_at?: string;
          created_by?: string | null;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          trade_role?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_memberships_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accounts_memberships_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accounts_memberships_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accounts_memberships_account_role_fkey';
            columns: ['account_role'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['name'];
          },
        ];
      };
      admin_action_log: {
        Row: {
          action: string;
          actor_user_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          target_account_id: string | null;
        };
        Insert: {
          action: string;
          actor_user_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_account_id?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_account_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_action_log_target_account_id_fkey';
            columns: ['target_account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admin_action_log_target_account_id_fkey';
            columns: ['target_account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admin_action_log_target_account_id_fkey';
            columns: ['target_account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_user_invites: {
        Row: {
          accepted_at: string | null;
          accepted_user_id: string | null;
          access_config: Json;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invite_token: string;
          invited_by: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          access_config?: Json;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invite_token?: string;
          invited_by: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          access_config?: Json;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invite_token?: string;
          invited_by?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agency_branding: {
        Row: {
          brand_name: string | null;
          business_id: string;
          created_at: string;
          custom_domain: string | null;
          favicon_url: string | null;
          id: string;
          logo_url: string | null;
          primary_colour: string | null;
          slug: string | null;
          support_email: string | null;
          updated_at: string;
        };
        Insert: {
          brand_name?: string | null;
          business_id: string;
          created_at?: string;
          custom_domain?: string | null;
          favicon_url?: string | null;
          id?: string;
          logo_url?: string | null;
          primary_colour?: string | null;
          slug?: string | null;
          support_email?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_name?: string | null;
          business_id?: string;
          created_at?: string;
          custom_domain?: string | null;
          favicon_url?: string | null;
          id?: string;
          logo_url?: string | null;
          primary_colour?: string | null;
          slug?: string | null;
          support_email?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agency_branding_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: true;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      agency_stripe: {
        Row: {
          application_fee_percent: number;
          business_id: string;
          created_at: string;
          id: string;
          stripe_account_email: string | null;
          stripe_account_id: string | null;
          stripe_connect_enabled: boolean;
          stripe_pay_now_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          application_fee_percent?: number;
          business_id: string;
          created_at?: string;
          id?: string;
          stripe_account_email?: string | null;
          stripe_account_id?: string | null;
          stripe_connect_enabled?: boolean;
          stripe_pay_now_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          application_fee_percent?: number;
          business_id?: string;
          created_at?: string;
          id?: string;
          stripe_account_email?: string | null;
          stripe_account_id?: string | null;
          stripe_connect_enabled?: boolean;
          stripe_pay_now_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agency_stripe_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: true;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_batch_jobs: {
        Row: {
          account_id: string;
          completed_at: string | null;
          created_at: string | null;
          credits_reserved: number;
          error_message: string | null;
          external_batch_id: string | null;
          feature: string;
          id: string;
          provider: string;
          requests: Json;
          results: Json | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          completed_at?: string | null;
          created_at?: string | null;
          credits_reserved?: number;
          error_message?: string | null;
          external_batch_id?: string | null;
          feature: string;
          id?: string;
          provider?: string;
          requests?: Json;
          results?: Json | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          completed_at?: string | null;
          created_at?: string | null;
          credits_reserved?: number;
          error_message?: string | null;
          external_batch_id?: string | null;
          feature?: string;
          id?: string;
          provider?: string;
          requests?: Json;
          results?: Json | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_batch_jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_batch_jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_batch_jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_credit_balances: {
        Row: {
          account_id: string;
          created_at: string | null;
          credits_monthly_limit: number;
          credits_purchased: number;
          credits_remaining: number;
          id: string;
          period_end: string;
          period_start: string;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string | null;
          credits_monthly_limit?: number;
          credits_purchased?: number;
          credits_remaining?: number;
          id?: string;
          period_end?: string;
          period_start?: string;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string | null;
          credits_monthly_limit?: number;
          credits_purchased?: number;
          credits_remaining?: number;
          id?: string;
          period_end?: string;
          period_start?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_credit_balances_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_credit_balances_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_credit_balances_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_credit_purchases: {
        Row: {
          account_id: string;
          amount_total: number | null;
          created_at: string;
          credits: number;
          currency: string | null;
          id: string;
          stripe_checkout_session_id: string;
          stripe_price_id: string;
        };
        Insert: {
          account_id: string;
          amount_total?: number | null;
          created_at?: string;
          credits: number;
          currency?: string | null;
          id?: string;
          stripe_checkout_session_id: string;
          stripe_price_id: string;
        };
        Update: {
          account_id?: string;
          amount_total?: number | null;
          created_at?: string;
          credits?: number;
          currency?: string | null;
          id?: string;
          stripe_checkout_session_id?: string;
          stripe_price_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_credit_purchases_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_credit_purchases_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_credit_purchases_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_credit_transactions: {
        Row: {
          account_id: string;
          created_at: string | null;
          credits_used: number;
          feature: string;
          id: string;
          input_tokens: number | null;
          metadata: Json | null;
          model_used: string;
          output_tokens: number | null;
          provider: string;
          was_batched: boolean | null;
        };
        Insert: {
          account_id: string;
          created_at?: string | null;
          credits_used: number;
          feature: string;
          id?: string;
          input_tokens?: number | null;
          metadata?: Json | null;
          model_used: string;
          output_tokens?: number | null;
          provider: string;
          was_batched?: boolean | null;
        };
        Update: {
          account_id?: string;
          created_at?: string | null;
          credits_used?: number;
          feature?: string;
          id?: string;
          input_tokens?: number | null;
          metadata?: Json | null;
          model_used?: string;
          output_tokens?: number | null;
          provider?: string;
          was_batched?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_credit_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_credit_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_credit_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      api_tokens: {
        Row: {
          account_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          last_used_at: string | null;
          name: string;
          revoked_at: string | null;
          token_hash: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name: string;
          revoked_at?: string | null;
          token_hash: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name?: string;
          revoked_at?: string | null;
          token_hash?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'api_tokens_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'api_tokens_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'api_tokens_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      areas: {
        Row: {
          colour: string | null;
          created_at: string | null;
          group_id: string | null;
          icon: string | null;
          id: string;
          name: string;
          sort_order: number | null;
          user_id: string | null;
        };
        Insert: {
          colour?: string | null;
          created_at?: string | null;
          group_id?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          sort_order?: number | null;
          user_id?: string | null;
        };
        Update: {
          colour?: string | null;
          created_at?: string | null;
          group_id?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          sort_order?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'areas_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_customers: {
        Row: {
          account_id: string;
          customer_id: string;
          email: string | null;
          id: number;
          provider: Database['public']['Enums']['billing_provider'];
        };
        Insert: {
          account_id: string;
          customer_id: string;
          email?: string | null;
          id?: number;
          provider: Database['public']['Enums']['billing_provider'];
        };
        Update: {
          account_id?: string;
          customer_id?: string;
          email?: string | null;
          id?: number;
          provider?: Database['public']['Enums']['billing_provider'];
        };
        Relationships: [
          {
            foreignKeyName: 'billing_customers_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_customers_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_customers_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_notification_log: {
        Row: {
          account_id: string;
          id: string;
          notification_type: string;
          sent_at: string;
          subscription_id: string;
        };
        Insert: {
          account_id: string;
          id?: string;
          notification_type: string;
          sent_at?: string;
          subscription_id: string;
        };
        Update: {
          account_id?: string;
          id?: string;
          notification_type?: string;
          sent_at?: string;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_notification_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_notification_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_notification_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      blog_posts: {
        Row: {
          author_avatar_url: string | null;
          author_bio: string | null;
          author_name: string;
          author_url: string | null;
          author_user_id: string | null;
          canonical_url: string | null;
          content: string | null;
          created_at: string;
          excerpt: string | null;
          featured_image_alt: string | null;
          featured_image_url: string | null;
          id: string;
          meta_description: string | null;
          og_description: string | null;
          og_title: string | null;
          primary_keyword: string | null;
          published_at: string | null;
          reading_time_minutes: number | null;
          schema_json: Json | null;
          secondary_keywords: string[] | null;
          slug: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_avatar_url?: string | null;
          author_bio?: string | null;
          author_name?: string;
          author_url?: string | null;
          author_user_id?: string | null;
          canonical_url?: string | null;
          content?: string | null;
          created_at?: string;
          excerpt?: string | null;
          featured_image_alt?: string | null;
          featured_image_url?: string | null;
          id?: string;
          meta_description?: string | null;
          og_description?: string | null;
          og_title?: string | null;
          primary_keyword?: string | null;
          published_at?: string | null;
          reading_time_minutes?: number | null;
          schema_json?: Json | null;
          secondary_keywords?: string[] | null;
          slug: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_avatar_url?: string | null;
          author_bio?: string | null;
          author_name?: string;
          author_url?: string | null;
          author_user_id?: string | null;
          canonical_url?: string | null;
          content?: string | null;
          created_at?: string;
          excerpt?: string | null;
          featured_image_alt?: string | null;
          featured_image_url?: string | null;
          id?: string;
          meta_description?: string | null;
          og_description?: string | null;
          og_title?: string | null;
          primary_keyword?: string | null;
          published_at?: string | null;
          reading_time_minutes?: number | null;
          schema_json?: Json | null;
          secondary_keywords?: string[] | null;
          slug?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      brain_chat_messages: {
        Row: {
          account_id: string;
          content: string;
          context_refs: Json;
          created_at: string;
          id: string;
          role: string;
          thread_id: string;
        };
        Insert: {
          account_id: string;
          content: string;
          context_refs?: Json;
          created_at?: string;
          id?: string;
          role: string;
          thread_id: string;
        };
        Update: {
          account_id?: string;
          content?: string;
          context_refs?: Json;
          created_at?: string;
          id?: string;
          role?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brain_chat_messages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brain_chat_messages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brain_chat_messages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brain_chat_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'brain_chat_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      brain_chat_threads: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          scope: Json;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          scope?: Json;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          scope?: Json;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brain_chat_threads_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brain_chat_threads_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brain_chat_threads_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      brain_chunks: {
        Row: {
          account_id: string;
          chunk_index: number;
          content_text: string;
          created_at: string;
          embedding: string | null;
          id: string;
          indexed_at: string | null;
          metadata: Json;
          source_id: string;
          source_type: string;
        };
        Insert: {
          account_id: string;
          chunk_index?: number;
          content_text: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          indexed_at?: string | null;
          metadata?: Json;
          source_id: string;
          source_type: string;
        };
        Update: {
          account_id?: string;
          chunk_index?: number;
          content_text?: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          indexed_at?: string | null;
          metadata?: Json;
          source_id?: string;
          source_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brain_chunks_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brain_chunks_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brain_chunks_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      business_members: {
        Row: {
          business_id: string | null;
          id: string;
          joined_at: string | null;
          role: string | null;
          user_id: string | null;
        };
        Insert: {
          business_id?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string | null;
          user_id?: string | null;
        };
        Update: {
          business_id?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'business_members_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      businesses: {
        Row: {
          account_id: string | null;
          colour: string | null;
          created_at: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          owner_id: string | null;
          slug: string;
          type: string | null;
          updated_at: string | null;
        };
        Insert: {
          account_id?: string | null;
          colour?: string | null;
          created_at?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          owner_id?: string | null;
          slug: string;
          type?: string | null;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string | null;
          colour?: string | null;
          created_at?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          owner_id?: string | null;
          slug?: string;
          type?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'businesses_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'businesses_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'businesses_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_message_attachments: {
        Row: {
          attachment_id: string;
          attachment_type: string;
          created_at: string;
          id: string;
          message_id: string;
          title: string;
        };
        Insert: {
          attachment_id: string;
          attachment_type: string;
          created_at?: string;
          id?: string;
          message_id: string;
          title: string;
        };
        Update: {
          attachment_id?: string;
          attachment_type?: string;
          created_at?: string;
          id?: string;
          message_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_message_attachments_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'chat_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_message_reads: {
        Row: {
          message_id: string;
          read_at: string;
          user_id: string;
        };
        Insert: {
          message_id: string;
          read_at?: string;
          user_id: string;
        };
        Update: {
          message_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_message_reads_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'chat_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_messages: {
        Row: {
          body: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by_user_id: string | null;
          edited_at: string | null;
          id: string;
          image_url: string | null;
          sender_user_id: string;
          thread_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by_user_id?: string | null;
          edited_at?: string | null;
          id?: string;
          image_url?: string | null;
          sender_user_id: string;
          thread_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by_user_id?: string | null;
          edited_at?: string | null;
          id?: string;
          image_url?: string | null;
          sender_user_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'chat_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_thread_participants: {
        Row: {
          archived_at: string | null;
          id: string;
          joined_at: string;
          last_read_at: string | null;
          participant_client_id: string | null;
          participant_kind: Database['public']['Enums']['chat_participant_kind'];
          participant_user_id: string | null;
          thread_id: string;
        };
        Insert: {
          archived_at?: string | null;
          id?: string;
          joined_at?: string;
          last_read_at?: string | null;
          participant_client_id?: string | null;
          participant_kind: Database['public']['Enums']['chat_participant_kind'];
          participant_user_id?: string | null;
          thread_id: string;
        };
        Update: {
          archived_at?: string | null;
          id?: string;
          joined_at?: string;
          last_read_at?: string | null;
          participant_client_id?: string | null;
          participant_kind?: Database['public']['Enums']['chat_participant_kind'];
          participant_user_id?: string | null;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_thread_participants_participant_client_id_fkey';
            columns: ['participant_client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_thread_participants_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'chat_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_threads: {
        Row: {
          account_id: string;
          created_at: string;
          created_by: string;
          id: string;
          job_id: string | null;
          last_message_at: string;
          title: string | null;
          type: Database['public']['Enums']['chat_thread_type'];
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          job_id?: string | null;
          last_message_at?: string;
          title?: string | null;
          type: Database['public']['Enums']['chat_thread_type'];
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          job_id?: string | null;
          last_message_at?: string;
          title?: string | null;
          type?: Database['public']['Enums']['chat_thread_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_threads_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_threads_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_threads_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_threads_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      client_invitations: {
        Row: {
          accepted_at: string | null;
          client_org_id: string | null;
          created_at: string | null;
          email: string;
          expires_at: string | null;
          id: string;
          invited_by: string | null;
          role: string | null;
          token: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          email: string;
          expires_at?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: string | null;
          token?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          email?: string;
          expires_at?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: string | null;
          token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_invitations_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      client_members: {
        Row: {
          client_org_id: string | null;
          id: string;
          is_primary_contact: boolean | null;
          job_title: string | null;
          joined_at: string | null;
          role: string | null;
          user_id: string | null;
        };
        Insert: {
          client_org_id?: string | null;
          id?: string;
          is_primary_contact?: boolean | null;
          job_title?: string | null;
          joined_at?: string | null;
          role?: string | null;
          user_id?: string | null;
        };
        Update: {
          client_org_id?: string | null;
          id?: string;
          is_primary_contact?: boolean | null;
          job_title?: string | null;
          joined_at?: string | null;
          role?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_members_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      client_notes: {
        Row: {
          account_id: string;
          author_user_id: string;
          client_id: string;
          created_at: string | null;
          id: string;
          note: string;
        };
        Insert: {
          account_id: string;
          author_user_id: string;
          client_id: string;
          created_at?: string | null;
          id?: string;
          note: string;
        };
        Update: {
          account_id?: string;
          author_user_id?: string;
          client_id?: string;
          created_at?: string | null;
          id?: string;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'client_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_notes_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
      client_orgs: {
        Row: {
          business_id: string | null;
          client_type: string | null;
          created_at: string | null;
          id: string;
          industry: string | null;
          name: string;
          notes: string | null;
          pipeline_stage: string | null;
          slug: string;
          status: string | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          business_id?: string | null;
          client_type?: string | null;
          created_at?: string | null;
          id?: string;
          industry?: string | null;
          name: string;
          notes?: string | null;
          pipeline_stage?: string | null;
          slug: string;
          status?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          business_id?: string | null;
          client_type?: string | null;
          created_at?: string | null;
          id?: string;
          industry?: string | null;
          name?: string;
          notes?: string | null;
          pipeline_stage?: string | null;
          slug?: string;
          status?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_orgs_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      client_portal_items: {
        Row: {
          client_org_id: string | null;
          content: string | null;
          created_at: string | null;
          id: string;
          project_id: string | null;
          sort_order: number | null;
          title: string;
          type: string;
          url: string | null;
        };
        Insert: {
          client_org_id?: string | null;
          content?: string | null;
          created_at?: string | null;
          id?: string;
          project_id?: string | null;
          sort_order?: number | null;
          title: string;
          type: string;
          url?: string | null;
        };
        Update: {
          client_org_id?: string | null;
          content?: string | null;
          created_at?: string | null;
          id?: string;
          project_id?: string | null;
          sort_order?: number | null;
          title?: string;
          type?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_portal_items_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_portal_items_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      client_subscriptions: {
        Row: {
          billing_day: number | null;
          business_id: string;
          cancelled_at: string | null;
          client_org_id: string;
          created_at: string;
          currency: string;
          id: string;
          monthly_amount: number;
          next_billing_date: string | null;
          notes: string | null;
          plan_name: string;
          plan_template_id: string | null;
          setup_fee: number;
          setup_fee_paid: boolean;
          setup_fee_paid_at: string | null;
          started_at: string | null;
          status: string;
          stripe_customer_id: string | null;
          stripe_customer_id_connect: string | null;
          stripe_payment_link: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          website_id: string | null;
        };
        Insert: {
          billing_day?: number | null;
          business_id: string;
          cancelled_at?: string | null;
          client_org_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          monthly_amount?: number;
          next_billing_date?: string | null;
          notes?: string | null;
          plan_name: string;
          plan_template_id?: string | null;
          setup_fee?: number;
          setup_fee_paid?: boolean;
          setup_fee_paid_at?: string | null;
          started_at?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_customer_id_connect?: string | null;
          stripe_payment_link?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          website_id?: string | null;
        };
        Update: {
          billing_day?: number | null;
          business_id?: string;
          cancelled_at?: string | null;
          client_org_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          monthly_amount?: number;
          next_billing_date?: string | null;
          notes?: string | null;
          plan_name?: string;
          plan_template_id?: string | null;
          setup_fee?: number;
          setup_fee_paid?: boolean;
          setup_fee_paid_at?: string | null;
          started_at?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_customer_id_connect?: string | null;
          stripe_payment_link?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          website_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_subscriptions_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_subscriptions_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_subscriptions_plan_template_id_fkey';
            columns: ['plan_template_id'];
            isOneToOne: false;
            referencedRelation: 'plan_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_subscriptions_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
            referencedColumns: ['id'];
          },
        ];
      };
      clients: {
        Row: {
          account_id: string;
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          client_org_id: string | null;
          client_type: string | null;
          company_name: string | null;
          country: string | null;
          created_at: string | null;
          created_by: string | null;
          display_name: string;
          email: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          phone: string | null;
          postcode: string | null;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          client_org_id?: string | null;
          client_type?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          display_name: string;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          phone?: string | null;
          postcode?: string | null;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          client_org_id?: string | null;
          client_type?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          display_name?: string;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          phone?: string | null;
          postcode?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'clients_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      community_meetup_attendees: {
        Row: {
          account_id: string;
          created_at: string;
          event_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          event_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          event_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_meetup_attendees_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_attendees_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_attendees_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_attendees_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'account_calendar_events';
            referencedColumns: ['id'];
          },
        ];
      };
      community_meetup_content_items: {
        Row: {
          account_id: string;
          body: string | null;
          created_at: string;
          event_id: string;
          id: string;
          kind: string;
          sort_order: number;
          title: string;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          account_id: string;
          body?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          kind: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          account_id?: string;
          body?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          kind?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'community_meetup_content_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_content_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_content_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_content_items_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'account_calendar_events';
            referencedColumns: ['id'];
          },
        ];
      };
      community_meetup_records: {
        Row: {
          account_id: string;
          ai_summary: string | null;
          created_at: string;
          event_id: string;
          reflection_notes: string | null;
          summarized_at: string | null;
          transcript: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          ai_summary?: string | null;
          created_at?: string;
          event_id: string;
          reflection_notes?: string | null;
          summarized_at?: string | null;
          transcript?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          ai_summary?: string | null;
          created_at?: string;
          event_id?: string;
          reflection_notes?: string | null;
          summarized_at?: string | null;
          transcript?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_meetup_records_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_records_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_records_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_records_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: true;
            referencedRelation: 'account_calendar_events';
            referencedColumns: ['id'];
          },
        ];
      };
      community_meetup_series: {
        Row: {
          account_id: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_meetup_series_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_series_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_series_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      community_meetup_templates: {
        Row: {
          account_id: string;
          content_items: Json;
          created_at: string;
          default_title: string | null;
          evening_parts: Json;
          id: string;
          meal_plan: string | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          content_items?: Json;
          created_at?: string;
          default_title?: string | null;
          evening_parts?: Json;
          id?: string;
          meal_plan?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          content_items?: Json;
          created_at?: string;
          default_title?: string | null;
          evening_parts?: Json;
          id?: string;
          meal_plan?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_meetup_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_meetup_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      community_member_notes: {
        Row: {
          account_id: string;
          author_user_id: string;
          category: string;
          content: string;
          created_at: string;
          id: string;
          subject_user_id: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          account_id: string;
          author_user_id: string;
          category?: string;
          content?: string;
          created_at?: string;
          id?: string;
          subject_user_id: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          account_id?: string;
          author_user_id?: string;
          category?: string;
          content?: string;
          created_at?: string;
          id?: string;
          subject_user_id?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_member_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_member_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_member_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      config: {
        Row: {
          billing_provider: Database['public']['Enums']['billing_provider'];
          enable_account_billing: boolean;
          enable_team_account_billing: boolean;
          enable_team_accounts: boolean;
        };
        Insert: {
          billing_provider?: Database['public']['Enums']['billing_provider'];
          enable_account_billing?: boolean;
          enable_team_account_billing?: boolean;
          enable_team_accounts?: boolean;
        };
        Update: {
          billing_provider?: Database['public']['Enums']['billing_provider'];
          enable_account_billing?: boolean;
          enable_team_account_billing?: boolean;
          enable_team_accounts?: boolean;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          client_id: string | null;
          client_org_id: string | null;
          created_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          is_primary: boolean;
          notes: string | null;
          phone: string | null;
          role: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          client_id?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          is_primary?: boolean;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          client_id?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_primary?: boolean;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contacts_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      contract_events: {
        Row: {
          account_id: string;
          actor_id: string | null;
          contract_id: string;
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
        };
        Insert: {
          account_id: string;
          actor_id?: string | null;
          contract_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          payload?: Json;
        };
        Update: {
          account_id?: string;
          actor_id?: string | null;
          contract_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'contract_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contract_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contract_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contract_events_contract_id_fkey';
            columns: ['contract_id'];
            isOneToOne: false;
            referencedRelation: 'contracts';
            referencedColumns: ['id'];
          },
        ];
      };
      contracts: {
        Row: {
          account_id: string;
          author_company: string | null;
          author_name: string | null;
          author_signature_data: string | null;
          author_signature_type: string | null;
          author_signed_at: string | null;
          author_type: string | null;
          auto_send_on_approval: boolean;
          client_id: string | null;
          content_html: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          deal_id: string | null;
          email_body: string | null;
          email_signature: string | null;
          email_subject: string | null;
          id: string;
          invoices_generated_at: string | null;
          payment_plan: Json;
          private_note: string | null;
          proposal_id: string | null;
          public_token: string | null;
          read_at: string | null;
          recipient_company: string | null;
          recipient_email: string | null;
          recipient_name: string | null;
          recipient_signature_data: string | null;
          recipient_signature_type: string | null;
          recipient_signed_at: string | null;
          recipient_type: string | null;
          sent_at: string | null;
          sent_to_email: string | null;
          status: string;
          title: string;
          total_pence: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          author_company?: string | null;
          author_name?: string | null;
          author_signature_data?: string | null;
          author_signature_type?: string | null;
          author_signed_at?: string | null;
          author_type?: string | null;
          auto_send_on_approval?: boolean;
          client_id?: string | null;
          content_html?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deal_id?: string | null;
          email_body?: string | null;
          email_signature?: string | null;
          email_subject?: string | null;
          id?: string;
          invoices_generated_at?: string | null;
          payment_plan?: Json;
          private_note?: string | null;
          proposal_id?: string | null;
          public_token?: string | null;
          read_at?: string | null;
          recipient_company?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          recipient_signature_data?: string | null;
          recipient_signature_type?: string | null;
          recipient_signed_at?: string | null;
          recipient_type?: string | null;
          sent_at?: string | null;
          sent_to_email?: string | null;
          status?: string;
          title?: string;
          total_pence?: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          author_company?: string | null;
          author_name?: string | null;
          author_signature_data?: string | null;
          author_signature_type?: string | null;
          author_signed_at?: string | null;
          author_type?: string | null;
          auto_send_on_approval?: boolean;
          client_id?: string | null;
          content_html?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deal_id?: string | null;
          email_body?: string | null;
          email_signature?: string | null;
          email_subject?: string | null;
          id?: string;
          invoices_generated_at?: string | null;
          payment_plan?: Json;
          private_note?: string | null;
          proposal_id?: string | null;
          public_token?: string | null;
          read_at?: string | null;
          recipient_company?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          recipient_signature_data?: string | null;
          recipient_signature_type?: string | null;
          recipient_signed_at?: string | null;
          recipient_type?: string | null;
          sent_at?: string | null;
          sent_to_email?: string | null;
          status?: string;
          title?: string;
          total_pence?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contracts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_deal_id_fkey';
            columns: ['deal_id'];
            isOneToOne: false;
            referencedRelation: 'pipeline_deals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_proposal_id_fkey';
            columns: ['proposal_id'];
            isOneToOne: false;
            referencedRelation: 'proposals';
            referencedColumns: ['id'];
          },
        ];
      };
      dictation_history: {
        Row: {
          account_id: string | null;
          character_count: number;
          created_at: string;
          id: string;
          paste_mode: boolean;
          source: string;
          text: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          character_count?: number;
          created_at?: string;
          id?: string;
          paste_mode?: boolean;
          source?: string;
          text: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          character_count?: number;
          created_at?: string;
          id?: string;
          paste_mode?: boolean;
          source?: string;
          text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dictation_history_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dictation_history_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dictation_history_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      docs: {
        Row: {
          account_id: string;
          category: string;
          client_id: string | null;
          client_org_id: string | null;
          content: string | null;
          context_refs: Json;
          created_at: string | null;
          created_by: string | null;
          doc_type: string;
          file_path: string | null;
          file_size_bytes: number | null;
          file_url: string | null;
          id: string;
          is_pinned: boolean;
          is_public: boolean;
          job_id: string | null;
          kind: string;
          mime_type: string | null;
          phase_id: string | null;
          project_id: string | null;
          property_id: string | null;
          public_enabled_at: string | null;
          public_token: string | null;
          source: string | null;
          storage_path: string | null;
          tags: string[] | null;
          task_id: string | null;
          title: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          account_id: string;
          category?: string;
          client_id?: string | null;
          client_org_id?: string | null;
          content?: string | null;
          context_refs?: Json;
          created_at?: string | null;
          created_by?: string | null;
          doc_type?: string;
          file_path?: string | null;
          file_size_bytes?: number | null;
          file_url?: string | null;
          id?: string;
          is_pinned?: boolean;
          is_public?: boolean;
          job_id?: string | null;
          kind?: string;
          mime_type?: string | null;
          phase_id?: string | null;
          project_id?: string | null;
          property_id?: string | null;
          public_enabled_at?: string | null;
          public_token?: string | null;
          source?: string | null;
          storage_path?: string | null;
          tags?: string[] | null;
          task_id?: string | null;
          title?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          account_id?: string;
          category?: string;
          client_id?: string | null;
          client_org_id?: string | null;
          content?: string | null;
          context_refs?: Json;
          created_at?: string | null;
          created_by?: string | null;
          doc_type?: string;
          file_path?: string | null;
          file_size_bytes?: number | null;
          file_url?: string | null;
          id?: string;
          is_pinned?: boolean;
          is_public?: boolean;
          job_id?: string | null;
          kind?: string;
          mime_type?: string | null;
          phase_id?: string | null;
          project_id?: string | null;
          property_id?: string | null;
          public_enabled_at?: string | null;
          public_token?: string | null;
          source?: string | null;
          storage_path?: string | null;
          tags?: string[] | null;
          task_id?: string | null;
          title?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'docs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'docs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'docs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'docs_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'docs_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'docs_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'docs_phase_id_fkey';
            columns: ['phase_id'];
            isOneToOne: false;
            referencedRelation: 'project_phases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'docs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'docs_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'docs_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      email_action_items: {
        Row: {
          assignee_confidence: number | null;
          created_at: string;
          detail: string | null;
          id: string;
          message_id: string | null;
          source_excerpt: string | null;
          status: string;
          suggested_assignee_id: string | null;
          suggested_due_date: string | null;
          task_id: string | null;
          thread_id: string;
          title: string;
          user_id: string;
        };
        Insert: {
          assignee_confidence?: number | null;
          created_at?: string;
          detail?: string | null;
          id?: string;
          message_id?: string | null;
          source_excerpt?: string | null;
          status?: string;
          suggested_assignee_id?: string | null;
          suggested_due_date?: string | null;
          task_id?: string | null;
          thread_id: string;
          title: string;
          user_id: string;
        };
        Update: {
          assignee_confidence?: number | null;
          created_at?: string;
          detail?: string | null;
          id?: string;
          message_id?: string | null;
          source_excerpt?: string | null;
          status?: string;
          suggested_assignee_id?: string | null;
          suggested_due_date?: string | null;
          task_id?: string | null;
          thread_id?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_action_items_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'email_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_action_items_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_action_items_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'email_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      email_assistant_settings: {
        Row: {
          auto_draft_enabled: boolean;
          auto_save_gmail_drafts: boolean;
          auto_triage_enabled: boolean;
          created_at: string;
          last_history_id: string | null;
          last_synced_at: string | null;
          signature: string | null;
          signature_is_html: boolean;
          style_notes: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_draft_enabled?: boolean;
          auto_save_gmail_drafts?: boolean;
          auto_triage_enabled?: boolean;
          created_at?: string;
          last_history_id?: string | null;
          last_synced_at?: string | null;
          signature?: string | null;
          signature_is_html?: boolean;
          style_notes?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_draft_enabled?: boolean;
          auto_save_gmail_drafts?: boolean;
          auto_triage_enabled?: boolean;
          created_at?: string;
          last_history_id?: string | null;
          last_synced_at?: string | null;
          signature?: string | null;
          signature_is_html?: boolean;
          style_notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      email_campaign_metrics: {
        Row: {
          bounced: boolean | null;
          campaign_id: string | null;
          click_count: number | null;
          clicked_at: string | null;
          contact_id: string | null;
          email: string;
          id: string;
          open_count: number | null;
          opened_at: string | null;
          recipient_id: string | null;
          sent_at: string | null;
          unsubscribed: boolean | null;
        };
        Insert: {
          bounced?: boolean | null;
          campaign_id?: string | null;
          click_count?: number | null;
          clicked_at?: string | null;
          contact_id?: string | null;
          email: string;
          id?: string;
          open_count?: number | null;
          opened_at?: string | null;
          recipient_id?: string | null;
          sent_at?: string | null;
          unsubscribed?: boolean | null;
        };
        Update: {
          bounced?: boolean | null;
          campaign_id?: string | null;
          click_count?: number | null;
          clicked_at?: string | null;
          contact_id?: string | null;
          email?: string;
          id?: string;
          open_count?: number | null;
          opened_at?: string | null;
          recipient_id?: string | null;
          sent_at?: string | null;
          unsubscribed?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'email_campaign_metrics_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'email_campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_campaign_metrics_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'email_contacts';
            referencedColumns: ['id'];
          },
        ];
      };
      email_campaigns: {
        Row: {
          contact_list_id: string | null;
          created_at: string | null;
          created_by: string | null;
          custom_recipient_ids: string[] | null;
          html_body: string;
          id: string;
          manual_recipient_emails: string[] | null;
          plain_text_body: string | null;
          preview_text: string | null;
          recipient_list: string;
          scheduled_at: string | null;
          sent_at: string | null;
          sent_count: number | null;
          status: string;
          subject: string;
          template_id: string | null;
          title: string;
          total_recipients: number | null;
          updated_at: string | null;
        };
        Insert: {
          contact_list_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          custom_recipient_ids?: string[] | null;
          html_body: string;
          id?: string;
          manual_recipient_emails?: string[] | null;
          plain_text_body?: string | null;
          preview_text?: string | null;
          recipient_list: string;
          scheduled_at?: string | null;
          sent_at?: string | null;
          sent_count?: number | null;
          status?: string;
          subject: string;
          template_id?: string | null;
          title: string;
          total_recipients?: number | null;
          updated_at?: string | null;
        };
        Update: {
          contact_list_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          custom_recipient_ids?: string[] | null;
          html_body?: string;
          id?: string;
          manual_recipient_emails?: string[] | null;
          plain_text_body?: string | null;
          preview_text?: string | null;
          recipient_list?: string;
          scheduled_at?: string | null;
          sent_at?: string | null;
          sent_count?: number | null;
          status?: string;
          subject?: string;
          template_id?: string | null;
          title?: string;
          total_recipients?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'email_campaigns_contact_list_id_fkey';
            columns: ['contact_list_id'];
            isOneToOne: false;
            referencedRelation: 'email_contact_lists';
            referencedColumns: ['id'];
          },
        ];
      };
      email_contact_list_exclusions: {
        Row: {
          contact_id: string;
          created_at: string | null;
          id: string;
          list_key: string;
        };
        Insert: {
          contact_id: string;
          created_at?: string | null;
          id?: string;
          list_key: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string | null;
          id?: string;
          list_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_contact_list_exclusions_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'email_contacts';
            referencedColumns: ['id'];
          },
        ];
      };
      email_contact_list_members: {
        Row: {
          contact_id: string;
          created_at: string | null;
          list_id: string;
        };
        Insert: {
          contact_id: string;
          created_at?: string | null;
          list_id: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string | null;
          list_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_contact_list_members_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'email_contacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_contact_list_members_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'email_contact_lists';
            referencedColumns: ['id'];
          },
        ];
      };
      email_contact_lists: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      email_contacts: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          notes: string | null;
          source: string | null;
          subscribed: boolean | null;
          trade: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          email: string;
          first_name: string;
          id?: string;
          last_name: string;
          notes?: string | null;
          source?: string | null;
          subscribed?: boolean | null;
          trade?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          notes?: string | null;
          source?: string | null;
          subscribed?: boolean | null;
          trade?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      email_drafts: {
        Row: {
          body_text: string;
          created_at: string;
          gmail_draft_id: string | null;
          id: string;
          model: string | null;
          reply_to_message_id: string | null;
          status: string;
          subject: string | null;
          thread_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body_text: string;
          created_at?: string;
          gmail_draft_id?: string | null;
          id?: string;
          model?: string | null;
          reply_to_message_id?: string | null;
          status?: string;
          subject?: string | null;
          thread_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body_text?: string;
          created_at?: string;
          gmail_draft_id?: string | null;
          id?: string;
          model?: string | null;
          reply_to_message_id?: string | null;
          status?: string;
          subject?: string | null;
          thread_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_drafts_reply_to_message_id_fkey';
            columns: ['reply_to_message_id'];
            isOneToOne: false;
            referencedRelation: 'email_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_drafts_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'email_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      email_messages: {
        Row: {
          body_html: string | null;
          body_text: string | null;
          cc_addresses: string[] | null;
          created_at: string;
          from_address: string | null;
          gmail_message_id: string;
          id: string;
          internal_date: string | null;
          snippet: string | null;
          subject: string | null;
          thread_id: string;
          to_addresses: string[] | null;
          user_id: string;
        };
        Insert: {
          body_html?: string | null;
          body_text?: string | null;
          cc_addresses?: string[] | null;
          created_at?: string;
          from_address?: string | null;
          gmail_message_id: string;
          id?: string;
          internal_date?: string | null;
          snippet?: string | null;
          subject?: string | null;
          thread_id: string;
          to_addresses?: string[] | null;
          user_id: string;
        };
        Update: {
          body_html?: string | null;
          body_text?: string | null;
          cc_addresses?: string[] | null;
          created_at?: string;
          from_address?: string | null;
          gmail_message_id?: string;
          id?: string;
          internal_date?: string | null;
          snippet?: string | null;
          subject?: string | null;
          thread_id?: string;
          to_addresses?: string[] | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'email_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      email_threads: {
        Row: {
          account_id: string | null;
          assistant_category: string | null;
          assistant_category_reason: string | null;
          assistant_processed_message_id: string | null;
          client_id: string | null;
          created_at: string;
          gmail_thread_id: string;
          id: string;
          is_unread: boolean;
          label_ids: string[] | null;
          last_message_at: string | null;
          link_source: string | null;
          participants: Json;
          project_id: string | null;
          snippet: string | null;
          subject: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          assistant_category?: string | null;
          assistant_category_reason?: string | null;
          assistant_processed_message_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          gmail_thread_id: string;
          id?: string;
          is_unread?: boolean;
          label_ids?: string[] | null;
          last_message_at?: string | null;
          link_source?: string | null;
          participants?: Json;
          project_id?: string | null;
          snippet?: string | null;
          subject?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          assistant_category?: string | null;
          assistant_category_reason?: string | null;
          assistant_processed_message_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          gmail_thread_id?: string;
          id?: string;
          is_unread?: boolean;
          label_ids?: string[] | null;
          last_message_at?: string | null;
          link_source?: string | null;
          participants?: Json;
          project_id?: string | null;
          snippet?: string | null;
          subject?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_threads_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_threads_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_threads_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_threads_assistant_processed_message_id_fkey';
            columns: ['assistant_processed_message_id'];
            isOneToOne: false;
            referencedRelation: 'email_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_threads_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_threads_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      email_unsubscribes: {
        Row: {
          contact_id: string | null;
          email: string;
          id: string;
          reason: string | null;
          unsubscribed_at: string | null;
          user_id: string | null;
        };
        Insert: {
          contact_id?: string | null;
          email: string;
          id?: string;
          reason?: string | null;
          unsubscribed_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          contact_id?: string | null;
          email?: string;
          id?: string;
          reason?: string | null;
          unsubscribed_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'email_unsubscribes_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'email_contacts';
            referencedColumns: ['id'];
          },
        ];
      };
      family_meal_plan_entries: {
        Row: {
          account_id: string | null;
          created_at: string;
          id: string;
          meal_type: string;
          notes: string | null;
          plan_date: string;
          recipe_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          id?: string;
          meal_type?: string;
          notes?: string | null;
          plan_date: string;
          recipe_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          id?: string;
          meal_type?: string;
          notes?: string | null;
          plan_date?: string;
          recipe_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_meal_plan_entries_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_meal_plan_entries_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_meal_plan_entries_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_meal_plan_entries_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'family_recipes';
            referencedColumns: ['id'];
          },
        ];
      };
      family_meal_preferences: {
        Row: {
          account_id: string | null;
          created_at: string;
          dietary_requirements: string[];
          disliked_ingredients: string[];
          household_size: number;
          id: string;
          notes: string | null;
          priorities: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          dietary_requirements?: string[];
          disliked_ingredients?: string[];
          household_size?: number;
          id?: string;
          notes?: string | null;
          priorities?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          dietary_requirements?: string[];
          disliked_ingredients?: string[];
          household_size?: number;
          id?: string;
          notes?: string | null;
          priorities?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_meal_preferences_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_meal_preferences_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_meal_preferences_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      family_recipes: {
        Row: {
          account_id: string | null;
          cook_minutes: number | null;
          created_at: string;
          description: string | null;
          id: string;
          ingredients: string[];
          instructions: string | null;
          is_favorite: boolean;
          meal_type: string;
          name: string;
          prep_minutes: number | null;
          servings: number | null;
          source: string;
          tags: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          cook_minutes?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          ingredients?: string[];
          instructions?: string | null;
          is_favorite?: boolean;
          meal_type?: string;
          name: string;
          prep_minutes?: number | null;
          servings?: number | null;
          source?: string;
          tags?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          cook_minutes?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          ingredients?: string[];
          instructions?: string | null;
          is_favorite?: boolean;
          meal_type?: string;
          name?: string;
          prep_minutes?: number | null;
          servings?: number | null;
          source?: string;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_recipes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_recipes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_recipes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      finance_bank_accounts: {
        Row: {
          account_id: string;
          created_at: string;
          currency: string;
          freeagent_bank_account_id: string | null;
          freeagent_bank_account_url: string | null;
          id: string;
          is_active: boolean;
          last_synced_at: string | null;
          name: string;
          source: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          currency?: string;
          freeagent_bank_account_id?: string | null;
          freeagent_bank_account_url?: string | null;
          id?: string;
          is_active?: boolean;
          last_synced_at?: string | null;
          name: string;
          source?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          currency?: string;
          freeagent_bank_account_id?: string | null;
          freeagent_bank_account_url?: string | null;
          id?: string;
          is_active?: boolean;
          last_synced_at?: string | null;
          name?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'finance_bank_accounts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_bank_accounts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_bank_accounts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      finance_categories: {
        Row: {
          account_id: string;
          color: string | null;
          created_at: string;
          freeagent_category_id: string | null;
          freeagent_category_url: string | null;
          id: string;
          is_system: boolean;
          kind: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          color?: string | null;
          created_at?: string;
          freeagent_category_id?: string | null;
          freeagent_category_url?: string | null;
          id?: string;
          is_system?: boolean;
          kind: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          color?: string | null;
          created_at?: string;
          freeagent_category_id?: string | null;
          freeagent_category_url?: string | null;
          id?: string;
          is_system?: boolean;
          kind?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'finance_categories_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_categories_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_categories_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      finance_connections: {
        Row: {
          access_token: string;
          account_id: string;
          connected_by: string | null;
          created_at: string;
          freeagent_company_name: string | null;
          freeagent_company_url: string | null;
          id: string;
          last_sync_at: string | null;
          provider: string;
          refresh_token: string;
          sync_state: Json;
          token_expires_at: string;
          updated_at: string;
        };
        Insert: {
          access_token: string;
          account_id: string;
          connected_by?: string | null;
          created_at?: string;
          freeagent_company_name?: string | null;
          freeagent_company_url?: string | null;
          id?: string;
          last_sync_at?: string | null;
          provider?: string;
          refresh_token: string;
          sync_state?: Json;
          token_expires_at: string;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          account_id?: string;
          connected_by?: string | null;
          created_at?: string;
          freeagent_company_name?: string | null;
          freeagent_company_url?: string | null;
          id?: string;
          last_sync_at?: string | null;
          provider?: string;
          refresh_token?: string;
          sync_state?: Json;
          token_expires_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'finance_connections_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_connections_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_connections_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      finance_import_batches: {
        Row: {
          account_id: string;
          bank_account_id: string | null;
          column_mapping: Json;
          created_at: string;
          created_by: string | null;
          error_message: string | null;
          filename: string;
          id: string;
          imported_count: number;
          row_count: number;
          status: string;
        };
        Insert: {
          account_id: string;
          bank_account_id?: string | null;
          column_mapping?: Json;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          filename: string;
          id?: string;
          imported_count?: number;
          row_count?: number;
          status?: string;
        };
        Update: {
          account_id?: string;
          bank_account_id?: string | null;
          column_mapping?: Json;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          filename?: string;
          id?: string;
          imported_count?: number;
          row_count?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'finance_import_batches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_import_batches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_import_batches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_import_batches_bank_account_id_fkey';
            columns: ['bank_account_id'];
            isOneToOne: false;
            referencedRelation: 'finance_bank_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      finance_transactions: {
        Row: {
          account_id: string;
          amount_pence: number;
          bank_account_id: string | null;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          external_id: string | null;
          freeagent_explanation_url: string | null;
          freeagent_transaction_url: string | null;
          id: string;
          import_batch_id: string | null;
          is_transfer: boolean;
          source: string;
          sync_error: string | null;
          sync_status: string;
          transaction_date: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          amount_pence: number;
          bank_account_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          external_id?: string | null;
          freeagent_explanation_url?: string | null;
          freeagent_transaction_url?: string | null;
          id?: string;
          import_batch_id?: string | null;
          is_transfer?: boolean;
          source?: string;
          sync_error?: string | null;
          sync_status?: string;
          transaction_date: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          amount_pence?: number;
          bank_account_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          external_id?: string | null;
          freeagent_explanation_url?: string | null;
          freeagent_transaction_url?: string | null;
          id?: string;
          import_batch_id?: string | null;
          is_transfer?: boolean;
          source?: string;
          sync_error?: string | null;
          sync_status?: string;
          transaction_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'finance_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_transactions_bank_account_id_fkey';
            columns: ['bank_account_id'];
            isOneToOne: false;
            referencedRelation: 'finance_bank_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_transactions_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'finance_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_transactions_import_batch_id_fkey';
            columns: ['import_batch_id'];
            isOneToOne: false;
            referencedRelation: 'finance_import_batches';
            referencedColumns: ['id'];
          },
        ];
      };
      google_calendar_connections: {
        Row: {
          access_token_encrypted: string;
          busy_calendar_ids: Json;
          calendar_id: string;
          connected_at: string;
          personal_calendar_ids: Json;
          planner_calendar_id: string | null;
          refresh_token_encrypted: string | null;
          scopes: string | null;
          token_expires_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token_encrypted: string;
          busy_calendar_ids?: Json;
          calendar_id?: string;
          connected_at?: string;
          personal_calendar_ids?: Json;
          planner_calendar_id?: string | null;
          refresh_token_encrypted?: string | null;
          scopes?: string | null;
          token_expires_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token_encrypted?: string;
          busy_calendar_ids?: Json;
          calendar_id?: string;
          connected_at?: string;
          personal_calendar_ids?: Json;
          planner_calendar_id?: string | null;
          refresh_token_encrypted?: string | null;
          scopes?: string | null;
          token_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      google_connections: {
        Row: {
          access_token_encrypted: string;
          connected_at: string;
          google_email: string;
          refresh_token_encrypted: string | null;
          scopes: string[];
          token_expires_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token_encrypted: string;
          connected_at?: string;
          google_email: string;
          refresh_token_encrypted?: string | null;
          scopes?: string[];
          token_expires_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token_encrypted?: string;
          connected_at?: string;
          google_email?: string;
          refresh_token_encrypted?: string | null;
          scopes?: string[];
          token_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      group_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string | null;
          email: string;
          expires_at: string | null;
          group_id: string | null;
          id: string;
          invited_by: string | null;
          role: string | null;
          token: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string | null;
          email: string;
          expires_at?: string | null;
          group_id?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: string | null;
          token?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string | null;
          email?: string;
          expires_at?: string | null;
          group_id?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: string | null;
          token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_invitations_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      group_members: {
        Row: {
          group_id: string | null;
          id: string;
          joined_at: string | null;
          role: string | null;
          user_id: string | null;
        };
        Insert: {
          group_id?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string | null;
          user_id?: string | null;
        };
        Update: {
          group_id?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          account_id: string | null;
          created_at: string | null;
          created_by: string | null;
          id: string;
          name: string;
          type: string | null;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          name: string;
          type?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          name?: string;
          type?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'groups_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'groups_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: {
          account_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: number;
          invite_token: string;
          invited_by: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: number;
          invite_token: string;
          invited_by: string;
          role: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: number;
          invite_token?: string;
          invited_by?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_role_fkey';
            columns: ['role'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['name'];
          },
        ];
      };
      invoice_counters: {
        Row: {
          account_id: string;
          next_number: number;
        };
        Insert: {
          account_id: string;
          next_number?: number;
        };
        Update: {
          account_id?: string;
          next_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_counters_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_counters_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_counters_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_events: {
        Row: {
          account_id: string;
          actor_id: string | null;
          created_at: string | null;
          event_type: string;
          id: string;
          invoice_id: string;
          payload: Json | null;
        };
        Insert: {
          account_id: string;
          actor_id?: string | null;
          created_at?: string | null;
          event_type: string;
          id?: string;
          invoice_id: string;
          payload?: Json | null;
        };
        Update: {
          account_id?: string;
          actor_id?: string | null;
          created_at?: string | null;
          event_type?: string;
          id?: string;
          invoice_id?: string;
          payload?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_events_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_items: {
        Row: {
          account_id: string;
          created_at: string | null;
          description: string;
          description_detail: string | null;
          id: string;
          invoice_id: string;
          job_id: string | null;
          quantity: number;
          sort_order: number;
          total_pence: number;
          unit_price_pence: number;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string | null;
          description: string;
          description_detail?: string | null;
          id?: string;
          invoice_id: string;
          job_id?: string | null;
          quantity?: number;
          sort_order?: number;
          total_pence: number;
          unit_price_pence: number;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string | null;
          description?: string;
          description_detail?: string | null;
          id?: string;
          invoice_id?: string;
          job_id?: string | null;
          quantity?: number;
          sort_order?: number;
          total_pence?: number;
          unit_price_pence?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_payments: {
        Row: {
          account_id: string;
          amount_pence: number;
          created_at: string;
          created_by: string | null;
          id: string;
          invoice_id: string;
          note: string | null;
          paid_at: string;
          payment_method: string;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
        };
        Insert: {
          account_id: string;
          amount_pence: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_id: string;
          note?: string | null;
          paid_at?: string;
          payment_method: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
        };
        Update: {
          account_id?: string;
          amount_pence?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_id?: string;
          note?: string | null;
          paid_at?: string;
          payment_method?: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_payments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_payments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_payments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_payments_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_recurring_series: {
        Row: {
          account_id: string;
          auto_send: boolean;
          client_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          end_at: string | null;
          frequency: string;
          id: string;
          max_occurrences: number | null;
          next_issue_at: string;
          occurrences_issued: number;
          status: string;
          template: Json;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          auto_send?: boolean;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          end_at?: string | null;
          frequency: string;
          id?: string;
          max_occurrences?: number | null;
          next_issue_at: string;
          occurrences_issued?: number;
          status?: string;
          template?: Json;
          title?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          auto_send?: boolean;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          end_at?: string | null;
          frequency?: string;
          id?: string;
          max_occurrences?: number | null;
          next_issue_at?: string;
          occurrences_issued?: number;
          status?: string;
          template?: Json;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_recurring_series_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_recurring_series_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_recurring_series_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_recurring_series_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
      invoices: {
        Row: {
          account_id: string;
          amount_paid_pence: number;
          archived_at: string | null;
          client_id: string;
          created_at: string | null;
          created_by: string | null;
          currency: string;
          deposit_type: string | null;
          deposit_value: number | null;
          discount_type: string | null;
          discount_value: number | null;
          due_at: string | null;
          email_body: string | null;
          email_signature: string | null;
          email_subject: string | null;
          footer_message: string | null;
          id: string;
          invoice_number: string;
          issued_at: string | null;
          late_fee_type: string | null;
          late_fee_value: number | null;
          notes: string | null;
          paid_at: string | null;
          private_note: string | null;
          public_token: string | null;
          read_at: string | null;
          recurring_series_id: string | null;
          reference_number: string | null;
          sent_at: string | null;
          sent_to_email: string | null;
          status: string;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          subtotal_pence: number;
          tax_rate_bp: number | null;
          title: string | null;
          total_pence: number;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          amount_paid_pence?: number;
          archived_at?: string | null;
          client_id: string;
          created_at?: string | null;
          created_by?: string | null;
          currency?: string;
          deposit_type?: string | null;
          deposit_value?: number | null;
          discount_type?: string | null;
          discount_value?: number | null;
          due_at?: string | null;
          email_body?: string | null;
          email_signature?: string | null;
          email_subject?: string | null;
          footer_message?: string | null;
          id?: string;
          invoice_number: string;
          issued_at?: string | null;
          late_fee_type?: string | null;
          late_fee_value?: number | null;
          notes?: string | null;
          paid_at?: string | null;
          private_note?: string | null;
          public_token?: string | null;
          read_at?: string | null;
          recurring_series_id?: string | null;
          reference_number?: string | null;
          sent_at?: string | null;
          sent_to_email?: string | null;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          subtotal_pence?: number;
          tax_rate_bp?: number | null;
          title?: string | null;
          total_pence?: number;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          amount_paid_pence?: number;
          archived_at?: string | null;
          client_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          currency?: string;
          deposit_type?: string | null;
          deposit_value?: number | null;
          discount_type?: string | null;
          discount_value?: number | null;
          due_at?: string | null;
          email_body?: string | null;
          email_signature?: string | null;
          email_subject?: string | null;
          footer_message?: string | null;
          id?: string;
          invoice_number?: string;
          issued_at?: string | null;
          late_fee_type?: string | null;
          late_fee_value?: number | null;
          notes?: string | null;
          paid_at?: string | null;
          private_note?: string | null;
          public_token?: string | null;
          read_at?: string | null;
          recurring_series_id?: string | null;
          reference_number?: string | null;
          sent_at?: string | null;
          sent_to_email?: string | null;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          subtotal_pence?: number;
          tax_rate_bp?: number | null;
          title?: string | null;
          total_pence?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_recurring_series_id_fkey';
            columns: ['recurring_series_id'];
            isOneToOne: false;
            referencedRelation: 'invoice_recurring_series';
            referencedColumns: ['id'];
          },
        ];
      };
      job_assignments: {
        Row: {
          account_id: string;
          created_at: string | null;
          id: string;
          job_id: string;
          role_on_job: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string | null;
          id?: string;
          job_id: string;
          role_on_job?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string | null;
          id?: string;
          job_id?: string;
          role_on_job?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_assignments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_assignments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_assignments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_assignments_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      job_notes: {
        Row: {
          account_id: string;
          author_user_id: string;
          created_at: string | null;
          id: string;
          job_id: string;
          note: string;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          author_user_id: string;
          created_at?: string | null;
          id?: string;
          job_id: string;
          note: string;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          author_user_id?: string;
          created_at?: string | null;
          id?: string;
          job_id?: string;
          note?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'job_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_notes_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      jobs: {
        Row: {
          account_id: string;
          actual_minutes: number | null;
          client_id: string | null;
          cost_pence: number | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          estimated_minutes: number | null;
          id: string;
          priority: string;
          start_date: string | null;
          status: string;
          title: string;
          updated_at: string | null;
          value_pence: number | null;
        };
        Insert: {
          account_id: string;
          actual_minutes?: number | null;
          client_id?: string | null;
          cost_pence?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          estimated_minutes?: number | null;
          id?: string;
          priority: string;
          start_date?: string | null;
          status: string;
          title: string;
          updated_at?: string | null;
          value_pence?: number | null;
        };
        Update: {
          account_id?: string;
          actual_minutes?: number | null;
          client_id?: string | null;
          cost_pence?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          estimated_minutes?: number | null;
          id?: string;
          priority?: string;
          start_date?: string | null;
          status?: string;
          title?: string;
          updated_at?: string | null;
          value_pence?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
      keel_subscriptions: {
        Row: {
          addons: Json | null;
          business_id: string;
          cancelled_at: string | null;
          created_at: string;
          currency: string;
          id: string;
          monthly_amount: number | null;
          next_billing_date: string | null;
          plan: string;
          started_at: string | null;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          addons?: Json | null;
          business_id: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          monthly_amount?: number | null;
          next_billing_date?: string | null;
          plan?: string;
          started_at?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          addons?: Json | null;
          business_id?: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          monthly_amount?: number | null;
          next_billing_date?: string | null;
          plan?: string;
          started_at?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'keel_subscriptions_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: true;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      meal_plan_days: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          plan_date: string;
          summary: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          plan_date: string;
          summary?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          plan_date?: string;
          summary?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meal_plan_days_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meal_plan_days_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meal_plan_days_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_action_items: {
        Row: {
          account_id: string;
          assignee_confidence: number | null;
          created_at: string;
          id: string;
          job_id: string | null;
          meeting_transcript_id: string;
          planner_task_id: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          source_excerpt: string | null;
          status: string;
          suggested_assignee_id: string | null;
          suggested_description: string | null;
          suggested_due_date: string | null;
          suggested_title: string;
        };
        Insert: {
          account_id: string;
          assignee_confidence?: number | null;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          meeting_transcript_id: string;
          planner_task_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_excerpt?: string | null;
          status?: string;
          suggested_assignee_id?: string | null;
          suggested_description?: string | null;
          suggested_due_date?: string | null;
          suggested_title: string;
        };
        Update: {
          account_id?: string;
          assignee_confidence?: number | null;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          meeting_transcript_id?: string;
          planner_task_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_excerpt?: string | null;
          status?: string;
          suggested_assignee_id?: string | null;
          suggested_description?: string | null;
          suggested_due_date?: string | null;
          suggested_title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_action_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_action_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_action_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_action_items_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_action_items_meeting_transcript_id_fkey';
            columns: ['meeting_transcript_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_transcripts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_action_items_planner_task_id_fkey';
            columns: ['planner_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_summaries: {
        Row: {
          account_id: string;
          attendee_emails: string[];
          generated_at: string;
          id: string;
          meeting_transcript_id: string;
          summary_text: string;
        };
        Insert: {
          account_id: string;
          attendee_emails?: string[];
          generated_at?: string;
          id?: string;
          meeting_transcript_id: string;
          summary_text?: string;
        };
        Update: {
          account_id?: string;
          attendee_emails?: string[];
          generated_at?: string;
          id?: string;
          meeting_transcript_id?: string;
          summary_text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_summaries_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_summaries_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_summaries_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_summaries_meeting_transcript_id_fkey';
            columns: ['meeting_transcript_id'];
            isOneToOne: true;
            referencedRelation: 'meeting_transcripts';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_transcripts: {
        Row: {
          account_id: string;
          calendar_attendees: Json;
          calendar_event_end: string | null;
          calendar_event_id: string | null;
          calendar_event_start: string | null;
          client_id: string | null;
          content: string;
          created_at: string;
          created_by: string | null;
          deal_id: string | null;
          duration_seconds: number | null;
          file_path: string | null;
          id: string;
          meeting_date: string | null;
          recorded_at: string | null;
          source: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          calendar_attendees?: Json;
          calendar_event_end?: string | null;
          calendar_event_id?: string | null;
          calendar_event_start?: string | null;
          client_id?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          deal_id?: string | null;
          duration_seconds?: number | null;
          file_path?: string | null;
          id?: string;
          meeting_date?: string | null;
          recorded_at?: string | null;
          source?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          calendar_attendees?: Json;
          calendar_event_end?: string | null;
          calendar_event_id?: string | null;
          calendar_event_start?: string | null;
          client_id?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          deal_id?: string | null;
          duration_seconds?: number | null;
          file_path?: string | null;
          id?: string;
          meeting_date?: string | null;
          recorded_at?: string | null;
          source?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_transcripts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_transcripts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_transcripts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_transcripts_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_transcripts_deal_id_fkey';
            columns: ['deal_id'];
            isOneToOne: false;
            referencedRelation: 'pipeline_deals';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          created_at: string | null;
          id: string;
          project_id: string | null;
          read_at: string | null;
          recipient_id: string | null;
          sender_id: string | null;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          id?: string;
          project_id?: string | null;
          read_at?: string | null;
          recipient_id?: string | null;
          sender_id?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          id?: string;
          project_id?: string | null;
          read_at?: string | null;
          recipient_id?: string | null;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      notes: {
        Row: {
          account_id: string | null;
          area_id: string | null;
          category: string;
          client_id: string | null;
          client_org_id: string | null;
          content: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          is_pinned: boolean;
          is_public: boolean;
          job_id: string | null;
          phase_id: string | null;
          project_id: string | null;
          property_id: string | null;
          public_enabled_at: string | null;
          public_token: string | null;
          source: string | null;
          tags: string[] | null;
          task_id: string | null;
          title: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          account_id?: string | null;
          area_id?: string | null;
          category?: string;
          client_id?: string | null;
          client_org_id?: string | null;
          content: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          is_pinned?: boolean;
          is_public?: boolean;
          job_id?: string | null;
          phase_id?: string | null;
          project_id?: string | null;
          property_id?: string | null;
          public_enabled_at?: string | null;
          public_token?: string | null;
          source?: string | null;
          tags?: string[] | null;
          task_id?: string | null;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          area_id?: string | null;
          category?: string;
          client_id?: string | null;
          client_org_id?: string | null;
          content?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          is_pinned?: boolean;
          is_public?: boolean;
          job_id?: string | null;
          phase_id?: string | null;
          project_id?: string | null;
          property_id?: string | null;
          public_enabled_at?: string | null;
          public_token?: string | null;
          source?: string | null;
          tags?: string[] | null;
          task_id?: string | null;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_area_id_fkey';
            columns: ['area_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_phase_id_fkey';
            columns: ['phase_id'];
            isOneToOne: false;
            referencedRelation: 'project_phases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          account_id: string;
          body: string;
          channel: Database['public']['Enums']['notification_channel'];
          created_at: string;
          dismissed: boolean;
          expires_at: string | null;
          id: number;
          muted: boolean;
          link: string | null;
          type: Database['public']['Enums']['notification_type'];
        };
        Insert: {
          account_id: string;
          body: string;
          channel?: Database['public']['Enums']['notification_channel'];
          created_at?: string;
          dismissed?: boolean;
          muted?: boolean;
          expires_at?: string | null;
          id?: never;
          link?: string | null;
          type?: Database['public']['Enums']['notification_type'];
        };
        Update: {
          account_id?: string;
          body?: string;
          channel?: Database['public']['Enums']['notification_channel'];
          created_at?: string;
          dismissed?: boolean;
          muted?: boolean;
          expires_at?: string | null;
          id?: never;
          link?: string | null;
          type?: Database['public']['Enums']['notification_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          price_amount: number | null;
          product_id: string;
          quantity: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          order_id: string;
          price_amount?: number | null;
          product_id: string;
          quantity?: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          price_amount?: number | null;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          account_id: string;
          billing_customer_id: number;
          billing_provider: Database['public']['Enums']['billing_provider'];
          created_at: string;
          currency: string;
          id: string;
          status: Database['public']['Enums']['payment_status'];
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          billing_customer_id: number;
          billing_provider: Database['public']['Enums']['billing_provider'];
          created_at?: string;
          currency: string;
          id: string;
          status: Database['public']['Enums']['payment_status'];
          total_amount: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          billing_customer_id?: number;
          billing_provider?: Database['public']['Enums']['billing_provider'];
          created_at?: string;
          currency?: string;
          id?: string;
          status?: Database['public']['Enums']['payment_status'];
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_billing_customer_id_fkey';
            columns: ['billing_customer_id'];
            isOneToOne: false;
            referencedRelation: 'billing_customers';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_people: {
        Row: {
          account_id: string;
          avatar_url: string | null;
          catchup_cadence_days: number | null;
          circle_tier: string;
          created_at: string;
          email: string | null;
          full_name: string;
          general_notes: string | null;
          id: string;
          last_catchup_on: string | null;
          nickname: string | null;
          phone: string | null;
          relationship_label: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          avatar_url?: string | null;
          catchup_cadence_days?: number | null;
          circle_tier?: string;
          created_at?: string;
          email?: string | null;
          full_name: string;
          general_notes?: string | null;
          id?: string;
          last_catchup_on?: string | null;
          nickname?: string | null;
          phone?: string | null;
          relationship_label?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          avatar_url?: string | null;
          catchup_cadence_days?: number | null;
          circle_tier?: string;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          general_notes?: string | null;
          id?: string;
          last_catchup_on?: string | null;
          nickname?: string | null;
          phone?: string | null;
          relationship_label?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_people_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_people_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_people_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_people_reminder_log: {
        Row: {
          id: string;
          person_id: string;
          reference_date: string;
          reminder_type: string;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          reference_date: string;
          reminder_type: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          person_id?: string;
          reference_date?: string;
          reminder_type?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_people_reminder_log_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'personal_people';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_person_catchups: {
        Row: {
          conversation_notes: string | null;
          created_at: string;
          id: string;
          location: string | null;
          met_on: string;
          person_id: string;
          updated_at: string;
        };
        Insert: {
          conversation_notes?: string | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          met_on?: string;
          person_id: string;
          updated_at?: string;
        };
        Update: {
          conversation_notes?: string | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          met_on?: string;
          person_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_person_catchups_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'personal_people';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_person_dates: {
        Row: {
          created_at: string;
          day: number;
          id: string;
          kind: string;
          label: string | null;
          month: number;
          notes: string | null;
          person_id: string;
          updated_at: string;
          year_optional: number | null;
        };
        Insert: {
          created_at?: string;
          day: number;
          id?: string;
          kind: string;
          label?: string | null;
          month: number;
          notes?: string | null;
          person_id: string;
          updated_at?: string;
          year_optional?: number | null;
        };
        Update: {
          created_at?: string;
          day?: number;
          id?: string;
          kind?: string;
          label?: string | null;
          month?: number;
          notes?: string | null;
          person_id?: string;
          updated_at?: string;
          year_optional?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_person_dates_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'personal_people';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_person_gift_ideas: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          occasion: string | null;
          person_id: string;
          purchased: boolean;
          title: string;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          occasion?: string | null;
          person_id: string;
          purchased?: boolean;
          title: string;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          occasion?: string | null;
          person_id?: string;
          purchased?: boolean;
          title?: string;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_person_gift_ideas_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'personal_people';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_person_notes: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          person_id: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          person_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          person_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_person_notes_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'personal_people';
            referencedColumns: ['id'];
          },
        ];
      };
      pipeline_activities: {
        Row: {
          content: string | null;
          deal_id: string | null;
          id: string;
          occurred_at: string | null;
          type: string;
          user_id: string | null;
        };
        Insert: {
          content?: string | null;
          deal_id?: string | null;
          id?: string;
          occurred_at?: string | null;
          type: string;
          user_id?: string | null;
        };
        Update: {
          content?: string | null;
          deal_id?: string | null;
          id?: string;
          occurred_at?: string | null;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pipeline_activities_deal_id_fkey';
            columns: ['deal_id'];
            isOneToOne: false;
            referencedRelation: 'pipeline_deals';
            referencedColumns: ['id'];
          },
        ];
      };
      pipeline_deals: {
        Row: {
          account_id: string | null;
          business_id: string | null;
          client_org_id: string | null;
          company_name: string | null;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string | null;
          expected_close: string | null;
          id: string;
          lost_at: string | null;
          lost_reason: string | null;
          name: string;
          next_action: string | null;
          next_action_date: string | null;
          notes: string | null;
          probability: number | null;
          source: string | null;
          stage: string | null;
          updated_at: string | null;
          value: number | null;
          won_at: string | null;
        };
        Insert: {
          account_id?: string | null;
          business_id?: string | null;
          client_org_id?: string | null;
          company_name?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          expected_close?: string | null;
          id?: string;
          lost_at?: string | null;
          lost_reason?: string | null;
          name: string;
          next_action?: string | null;
          next_action_date?: string | null;
          notes?: string | null;
          probability?: number | null;
          source?: string | null;
          stage?: string | null;
          updated_at?: string | null;
          value?: number | null;
          won_at?: string | null;
        };
        Update: {
          account_id?: string | null;
          business_id?: string | null;
          client_org_id?: string | null;
          company_name?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          expected_close?: string | null;
          id?: string;
          lost_at?: string | null;
          lost_reason?: string | null;
          name?: string;
          next_action?: string | null;
          next_action_date?: string | null;
          notes?: string | null;
          probability?: number | null;
          source?: string | null;
          stage?: string | null;
          updated_at?: string | null;
          value?: number | null;
          won_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pipeline_deals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pipeline_deals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pipeline_deals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pipeline_deals_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pipeline_deals_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_templates: {
        Row: {
          business_id: string;
          created_at: string;
          currency: string;
          description: string | null;
          features: Json | null;
          id: string;
          is_active: boolean;
          monthly_amount: number;
          name: string;
          setup_fee: number;
          support_tickets_per_month: number | null;
          update_hours_per_month: number | null;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: Json | null;
          id?: string;
          is_active?: boolean;
          monthly_amount?: number;
          name: string;
          setup_fee?: number;
          support_tickets_per_month?: number | null;
          update_hours_per_month?: number | null;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: Json | null;
          id?: string;
          is_active?: boolean;
          monthly_amount?: number;
          name?: string;
          setup_fee?: number;
          support_tickets_per_month?: number | null;
          update_hours_per_month?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_templates_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      planner_plans: {
        Row: {
          created_at: string;
          id: string;
          markdown: string;
          mode: string;
          plan_date: string;
          scope_key: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          markdown: string;
          mode?: string;
          plan_date: string;
          scope_key: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          markdown?: string;
          mode?: string;
          plan_date?: string;
          scope_key?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      planner_push_settings: {
        Row: {
          created_at: string;
          enabled: boolean;
          lead_minutes: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          lead_minutes?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          lead_minutes?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      planner_reminders: {
        Row: {
          block_end: string;
          block_start: string;
          block_title: string;
          created_at: string;
          id: string;
          is_break: boolean;
          notify_at: string;
          plan_date: string;
          scope_key: string;
          sent_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          block_end: string;
          block_start: string;
          block_title: string;
          created_at?: string;
          id?: string;
          is_break?: boolean;
          notify_at: string;
          plan_date: string;
          scope_key: string;
          sent_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          block_end?: string;
          block_start?: string;
          block_title?: string;
          created_at?: string;
          id?: string;
          is_break?: boolean;
          notify_at?: string;
          plan_date?: string;
          scope_key?: string;
          sent_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      platform_email_log: {
        Row: {
          account_id: string | null;
          created_at: string;
          email_type: string;
          error_message: string | null;
          id: string;
          metadata: Json;
          recipient_email: string;
          sender_email: string | null;
          status: string;
          subject: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          email_type: string;
          error_message?: string | null;
          id?: string;
          metadata?: Json;
          recipient_email: string;
          sender_email?: string | null;
          status?: string;
          subject: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          email_type?: string;
          error_message?: string | null;
          id?: string;
          metadata?: Json;
          recipient_email?: string;
          sender_email?: string | null;
          status?: string;
          subject?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_email_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_email_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_email_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_support_messages: {
        Row: {
          author_user_id: string;
          body: string;
          created_at: string;
          id: string;
          is_internal_note: boolean;
          ticket_id: string;
        };
        Insert: {
          author_user_id: string;
          body: string;
          created_at?: string;
          id?: string;
          is_internal_note?: boolean;
          ticket_id: string;
        };
        Update: {
          author_user_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_internal_note?: boolean;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_support_messages_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'platform_support_tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_support_tickets: {
        Row: {
          account_id: string | null;
          admin_notes: string | null;
          assigned_to: string | null;
          body: string;
          created_at: string;
          id: string;
          priority: string;
          status: string;
          subject: string;
          ticket_number: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          admin_notes?: string | null;
          assigned_to?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          priority?: string;
          status?: string;
          subject: string;
          ticket_number?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          admin_notes?: string | null;
          assigned_to?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          priority?: string;
          status?: string;
          subject?: string;
          ticket_number?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_support_tickets_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_support_tickets_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_support_tickets_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          account_type: string | null;
          avatar_url: string | null;
          created_at: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string | null;
        };
        Insert: {
          account_type?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string | null;
        };
        Update: {
          account_type?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      project_phase_reminder_log: {
        Row: {
          account_id: string;
          due_date: string;
          id: string;
          notified_at: string;
          phase_id: string;
        };
        Insert: {
          account_id: string;
          due_date: string;
          id?: string;
          notified_at?: string;
          phase_id: string;
        };
        Update: {
          account_id?: string;
          due_date?: string;
          id?: string;
          notified_at?: string;
          phase_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_phase_reminder_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_phase_reminder_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_phase_reminder_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_phase_reminder_log_phase_id_fkey';
            columns: ['phase_id'];
            isOneToOne: false;
            referencedRelation: 'project_phases';
            referencedColumns: ['id'];
          },
        ];
      };
      project_phase_templates: {
        Row: {
          account_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          phases: Json;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          phases?: Json;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          phases?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_phase_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_phase_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_phase_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      project_phases: {
        Row: {
          account_id: string;
          colour: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          is_milestone: boolean;
          job_id: string;
          name: string;
          sort_order: number;
          start_date: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          colour?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_milestone?: boolean;
          job_id: string;
          name: string;
          sort_order?: number;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          colour?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_milestone?: boolean;
          job_id?: string;
          name?: string;
          sort_order?: number;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_phases_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_phases_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_phases_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_phases_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          area_id: string | null;
          business_id: string | null;
          client_org_id: string | null;
          colour: string | null;
          created_at: string | null;
          description: string | null;
          icon: string | null;
          id: string;
          name: string;
          sort_order: number | null;
          start_date: string | null;
          status: string | null;
          target_date: string | null;
          updated_at: string | null;
        };
        Insert: {
          area_id?: string | null;
          business_id?: string | null;
          client_org_id?: string | null;
          colour?: string | null;
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          sort_order?: number | null;
          start_date?: string | null;
          status?: string | null;
          target_date?: string | null;
          updated_at?: string | null;
        };
        Update: {
          area_id?: string | null;
          business_id?: string | null;
          client_org_id?: string | null;
          colour?: string | null;
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          sort_order?: number | null;
          start_date?: string | null;
          status?: string | null;
          target_date?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_area_id_fkey';
            columns: ['area_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      properties: {
        Row: {
          account_id: string;
          address: string | null;
          bathrooms: number | null;
          bedrooms: number | null;
          created_at: string | null;
          current_value: number | null;
          id: string;
          name: string;
          notes: string | null;
          property_type: string | null;
          purchase_date: string | null;
          purchase_price: number | null;
          square_footage: number | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          address?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          created_at?: string | null;
          current_value?: number | null;
          id?: string;
          name: string;
          notes?: string | null;
          property_type?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          square_footage?: number | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          address?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          created_at?: string | null;
          current_value?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          property_type?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          square_footage?: number | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'properties_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'properties_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'properties_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      property_documents: {
        Row: {
          account_id: string;
          created_at: string | null;
          document_type: string | null;
          file_path: string;
          file_size: number | null;
          id: string;
          mime_type: string | null;
          name: string;
          property_id: string;
          updated_at: string | null;
          uploaded_by: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string | null;
          document_type?: string | null;
          file_path: string;
          file_size?: number | null;
          id?: string;
          mime_type?: string | null;
          name: string;
          property_id: string;
          updated_at?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string | null;
          document_type?: string | null;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          mime_type?: string | null;
          name?: string;
          property_id?: string;
          updated_at?: string | null;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'property_documents_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'property_documents_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'property_documents_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'property_documents_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_comments: {
        Row: {
          account_id: string;
          author_id: string | null;
          author_name: string | null;
          body: string;
          created_at: string;
          id: string;
          proposal_id: string;
        };
        Insert: {
          account_id: string;
          author_id?: string | null;
          author_name?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          proposal_id: string;
        };
        Update: {
          account_id?: string;
          author_id?: string | null;
          author_name?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          proposal_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_comments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposal_comments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposal_comments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposal_comments_proposal_id_fkey';
            columns: ['proposal_id'];
            isOneToOne: false;
            referencedRelation: 'proposals';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_events: {
        Row: {
          account_id: string;
          actor_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
          proposal_id: string;
        };
        Insert: {
          account_id: string;
          actor_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          payload?: Json;
          proposal_id: string;
        };
        Update: {
          account_id?: string;
          actor_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          proposal_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposal_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposal_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposal_events_proposal_id_fkey';
            columns: ['proposal_id'];
            isOneToOne: false;
            referencedRelation: 'proposals';
            referencedColumns: ['id'];
          },
        ];
      };
      proposals: {
        Row: {
          account_id: string;
          approved_at: string | null;
          client_id: string | null;
          content_html: string;
          context_refs: Json;
          contract_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          deal_id: string | null;
          declined_at: string | null;
          email_body: string | null;
          email_signature: string | null;
          email_subject: string | null;
          expires_at: string | null;
          id: string;
          private_note: string | null;
          public_token: string | null;
          read_at: string | null;
          recipient_email: string | null;
          recipient_name: string | null;
          sent_at: string | null;
          sent_to_email: string | null;
          status: string;
          title: string;
          total_pence: number | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          approved_at?: string | null;
          client_id?: string | null;
          content_html?: string;
          context_refs?: Json;
          contract_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deal_id?: string | null;
          declined_at?: string | null;
          email_body?: string | null;
          email_signature?: string | null;
          email_subject?: string | null;
          expires_at?: string | null;
          id?: string;
          private_note?: string | null;
          public_token?: string | null;
          read_at?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          sent_at?: string | null;
          sent_to_email?: string | null;
          status?: string;
          title?: string;
          total_pence?: number | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          approved_at?: string | null;
          client_id?: string | null;
          content_html?: string;
          context_refs?: Json;
          contract_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deal_id?: string | null;
          declined_at?: string | null;
          email_body?: string | null;
          email_signature?: string | null;
          email_subject?: string | null;
          expires_at?: string | null;
          id?: string;
          private_note?: string | null;
          public_token?: string | null;
          read_at?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          sent_at?: string | null;
          sent_to_email?: string | null;
          status?: string;
          title?: string;
          total_pence?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposals_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposals_contract_id_fkey';
            columns: ['contract_id'];
            isOneToOne: false;
            referencedRelation: 'contracts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposals_deal_id_fkey';
            columns: ['deal_id'];
            isOneToOne: false;
            referencedRelation: 'pipeline_deals';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      recorder_connect_codes: {
        Row: {
          code_hash: string;
          created_at: string;
          expires_at: string;
          id: string;
          raw_token: string;
          state: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          code_hash: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          raw_token: string;
          state: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          raw_token?: string;
          state?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      recorder_usage_monthly: {
        Row: {
          duration_seconds: number;
          period: string;
          sync_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          duration_seconds?: number;
          period: string;
          sync_count?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          duration_seconds?: number;
          period?: string;
          sync_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          id: number;
          permission: Database['public']['Enums']['app_permissions'];
          role: string;
        };
        Insert: {
          id?: number;
          permission: Database['public']['Enums']['app_permissions'];
          role: string;
        };
        Update: {
          id?: number;
          permission?: Database['public']['Enums']['app_permissions'];
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'role_permissions_role_fkey';
            columns: ['role'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['name'];
          },
        ];
      };
      roles: {
        Row: {
          hierarchy_level: number;
          name: string;
        };
        Insert: {
          hierarchy_level: number;
          name: string;
        };
        Update: {
          hierarchy_level?: number;
          name?: string;
        };
        Relationships: [];
      };
      subscription_items: {
        Row: {
          created_at: string;
          id: string;
          interval: string;
          interval_count: number;
          price_amount: number | null;
          product_id: string;
          quantity: number;
          subscription_id: string;
          type: Database['public']['Enums']['subscription_item_type'];
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          interval: string;
          interval_count: number;
          price_amount?: number | null;
          product_id: string;
          quantity?: number;
          subscription_id: string;
          type: Database['public']['Enums']['subscription_item_type'];
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          interval?: string;
          interval_count?: number;
          price_amount?: number | null;
          product_id?: string;
          quantity?: number;
          subscription_id?: string;
          type?: Database['public']['Enums']['subscription_item_type'];
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscription_items_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      subscription_line_items: {
        Row: {
          amount: number;
          client_subscription_id: string;
          created_at: string;
          currency: string;
          description: string;
          due_date: string | null;
          id: string;
          item_type: string;
          notes: string | null;
          paid_at: string | null;
          status: string;
          stripe_invoice_item_id: string | null;
        };
        Insert: {
          amount: number;
          client_subscription_id: string;
          created_at?: string;
          currency?: string;
          description: string;
          due_date?: string | null;
          id?: string;
          item_type?: string;
          notes?: string | null;
          paid_at?: string | null;
          status?: string;
          stripe_invoice_item_id?: string | null;
        };
        Update: {
          amount?: number;
          client_subscription_id?: string;
          created_at?: string;
          currency?: string;
          description?: string;
          due_date?: string | null;
          id?: string;
          item_type?: string;
          notes?: string | null;
          paid_at?: string | null;
          status?: string;
          stripe_invoice_item_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'subscription_line_items_client_subscription_id_fkey';
            columns: ['client_subscription_id'];
            isOneToOne: false;
            referencedRelation: 'client_subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          account_id: string;
          active: boolean;
          billing_customer_id: number;
          billing_provider: Database['public']['Enums']['billing_provider'];
          cancel_at_period_end: boolean;
          created_at: string;
          currency: string;
          id: string;
          period_ends_at: string;
          period_starts_at: string;
          status: Database['public']['Enums']['subscription_status'];
          trial_ends_at: string | null;
          trial_starts_at: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          active: boolean;
          billing_customer_id: number;
          billing_provider: Database['public']['Enums']['billing_provider'];
          cancel_at_period_end: boolean;
          created_at?: string;
          currency: string;
          id: string;
          period_ends_at: string;
          period_starts_at: string;
          status: Database['public']['Enums']['subscription_status'];
          trial_ends_at?: string | null;
          trial_starts_at?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          active?: boolean;
          billing_customer_id?: number;
          billing_provider?: Database['public']['Enums']['billing_provider'];
          cancel_at_period_end?: boolean;
          created_at?: string;
          currency?: string;
          id?: string;
          period_ends_at?: string;
          period_starts_at?: string;
          status?: Database['public']['Enums']['subscription_status'];
          trial_ends_at?: string | null;
          trial_starts_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_billing_customer_id_fkey';
            columns: ['billing_customer_id'];
            isOneToOne: false;
            referencedRelation: 'billing_customers';
            referencedColumns: ['id'];
          },
        ];
      };
      support_tickets: {
        Row: {
          assigned_to: string | null;
          client_org_id: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          priority: string | null;
          project_id: string | null;
          raised_by: string | null;
          resolved_at: string | null;
          status: string | null;
          title: string;
          type: string | null;
          updated_at: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          priority?: string | null;
          project_id?: string | null;
          raised_by?: string | null;
          resolved_at?: string | null;
          status?: string | null;
          title: string;
          type?: string | null;
          updated_at?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          priority?: string | null;
          project_id?: string | null;
          raised_by?: string | null;
          resolved_at?: string | null;
          status?: string | null;
          title?: string;
          type?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'support_tickets_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          colour: string | null;
          id: string;
          name: string;
          user_id: string | null;
        };
        Insert: {
          colour?: string | null;
          id?: string;
          name: string;
          user_id?: string | null;
        };
        Update: {
          colour?: string | null;
          id?: string;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      task_tags: {
        Row: {
          tag_id: string;
          task_id: string;
        };
        Insert: {
          tag_id: string;
          task_id: string;
        };
        Update: {
          tag_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_tags_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          account_id: string | null;
          area_id: string | null;
          calendar_schedule_status: string | null;
          client_id: string | null;
          completed_at: string | null;
          created_at: string | null;
          due_date: string | null;
          google_calendar_event_id: string | null;
          group_id: string | null;
          id: string;
          job_id: string | null;
          notes: string | null;
          parent_task_id: string | null;
          phase_id: string | null;
          priority: string | null;
          project_id: string | null;
          sort_order: number | null;
          source: string | null;
          status: string | null;
          title: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          account_id?: string | null;
          area_id?: string | null;
          calendar_schedule_status?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          due_date?: string | null;
          google_calendar_event_id?: string | null;
          group_id?: string | null;
          id?: string;
          job_id?: string | null;
          notes?: string | null;
          parent_task_id?: string | null;
          phase_id?: string | null;
          priority?: string | null;
          project_id?: string | null;
          sort_order?: number | null;
          source?: string | null;
          status?: string | null;
          title: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          area_id?: string | null;
          calendar_schedule_status?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          due_date?: string | null;
          google_calendar_event_id?: string | null;
          group_id?: string | null;
          id?: string;
          job_id?: string | null;
          notes?: string | null;
          parent_task_id?: string | null;
          phase_id?: string | null;
          priority?: string | null;
          project_id?: string | null;
          sort_order?: number | null;
          source?: string | null;
          status?: string | null;
          title?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_area_id_fkey';
            columns: ['area_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_parent_task_id_fkey';
            columns: ['parent_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_phase_id_fkey';
            columns: ['phase_id'];
            isOneToOne: false;
            referencedRelation: 'project_phases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      ticket_messages: {
        Row: {
          content: string;
          created_at: string | null;
          id: string;
          is_internal: boolean | null;
          sender_id: string | null;
          ticket_id: string | null;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          id?: string;
          is_internal?: boolean | null;
          sender_id?: string | null;
          ticket_id?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          id?: string;
          is_internal?: boolean | null;
          sender_id?: string | null;
          ticket_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_messages_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'support_tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      user_settings: {
        Row: {
          accessibility_dyslexia_font: boolean;
          accessibility_enhanced_focus: boolean;
          accessibility_high_contrast: boolean;
          accessibility_simplified_mode: boolean;
          accessibility_text_size: string;
          created_at: string | null;
          default_landing_type: string;
          default_workspace_slug: string | null;
          first_name: string | null;
          last_name: string | null;
          mobile: string | null;
          personal_dashboard_shortcuts: Json;
          personal_include_workspace_tasks: boolean;
          personal_mobile_nav_shortcuts: Json;
          updated_at: string | null;
          use_ozer_for_community: boolean;
          use_ozer_for_family: boolean;
          use_ozer_for_work: boolean;
          user_id: string;
        };
        Insert: {
          accessibility_dyslexia_font?: boolean;
          accessibility_enhanced_focus?: boolean;
          accessibility_high_contrast?: boolean;
          accessibility_simplified_mode?: boolean;
          accessibility_text_size?: string;
          created_at?: string | null;
          default_landing_type?: string;
          default_workspace_slug?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          mobile?: string | null;
          personal_dashboard_shortcuts?: Json;
          personal_include_workspace_tasks?: boolean;
          personal_mobile_nav_shortcuts?: Json;
          updated_at?: string | null;
          use_ozer_for_community?: boolean;
          use_ozer_for_family?: boolean;
          use_ozer_for_work?: boolean;
          user_id: string;
        };
        Update: {
          accessibility_dyslexia_font?: boolean;
          accessibility_enhanced_focus?: boolean;
          accessibility_high_contrast?: boolean;
          accessibility_simplified_mode?: boolean;
          accessibility_text_size?: string;
          created_at?: string | null;
          default_landing_type?: string;
          default_workspace_slug?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          mobile?: string | null;
          personal_dashboard_shortcuts?: Json;
          personal_include_workspace_tasks?: boolean;
          personal_mobile_nav_shortcuts?: Json;
          updated_at?: string | null;
          use_ozer_for_community?: boolean;
          use_ozer_for_family?: boolean;
          use_ozer_for_work?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      video_events: {
        Row: {
          account_id: string | null;
          bunny_video_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          ip_address: string | null;
          payload: Json;
        };
        Insert: {
          account_id?: string | null;
          bunny_video_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          ip_address?: string | null;
          payload?: Json;
        };
        Update: {
          account_id?: string | null;
          bunny_video_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          ip_address?: string | null;
          payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'video_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      video_folders: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          name: string;
          parent_folder_id: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          name: string;
          parent_folder_id?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          parent_folder_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'video_folders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_folders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_folders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_folders_parent_folder_id_fkey';
            columns: ['parent_folder_id'];
            isOneToOne: false;
            referencedRelation: 'video_folders';
            referencedColumns: ['id'];
          },
        ];
      };
      video_player_configs: {
        Row: {
          account_id: string;
          allow_download: boolean;
          allowed_speeds: number[];
          aspect_ratio: string;
          autoplay: boolean;
          created_at: string;
          custom_logo_url: string | null;
          default_caption_language: string;
          default_playback_speed: number;
          enable_captions: boolean;
          id: string;
          is_preset: boolean;
          logo_position: string;
          loop: boolean;
          max_width_px: number | null;
          muted: boolean;
          name: string;
          preload: string;
          primary_color: string;
          responsive: boolean;
          show_bunny_watermark: boolean;
          show_captions_button: boolean;
          show_controls: boolean;
          show_fullscreen_button: boolean;
          show_play_button: boolean;
          show_progress_bar: boolean;
          show_speed_control: boolean;
          show_volume_control: boolean;
          token_auth_enabled: boolean;
          updated_at: string;
          video_id: string | null;
        };
        Insert: {
          account_id: string;
          allow_download?: boolean;
          allowed_speeds?: number[];
          aspect_ratio?: string;
          autoplay?: boolean;
          created_at?: string;
          custom_logo_url?: string | null;
          default_caption_language?: string;
          default_playback_speed?: number;
          enable_captions?: boolean;
          id?: string;
          is_preset?: boolean;
          logo_position?: string;
          loop?: boolean;
          max_width_px?: number | null;
          muted?: boolean;
          name?: string;
          preload?: string;
          primary_color?: string;
          responsive?: boolean;
          show_bunny_watermark?: boolean;
          show_captions_button?: boolean;
          show_controls?: boolean;
          show_fullscreen_button?: boolean;
          show_play_button?: boolean;
          show_progress_bar?: boolean;
          show_speed_control?: boolean;
          show_volume_control?: boolean;
          token_auth_enabled?: boolean;
          updated_at?: string;
          video_id?: string | null;
        };
        Update: {
          account_id?: string;
          allow_download?: boolean;
          allowed_speeds?: number[];
          aspect_ratio?: string;
          autoplay?: boolean;
          created_at?: string;
          custom_logo_url?: string | null;
          default_caption_language?: string;
          default_playback_speed?: number;
          enable_captions?: boolean;
          id?: string;
          is_preset?: boolean;
          logo_position?: string;
          loop?: boolean;
          max_width_px?: number | null;
          muted?: boolean;
          name?: string;
          preload?: string;
          primary_color?: string;
          responsive?: boolean;
          show_bunny_watermark?: boolean;
          show_captions_button?: boolean;
          show_controls?: boolean;
          show_fullscreen_button?: boolean;
          show_play_button?: boolean;
          show_progress_bar?: boolean;
          show_speed_control?: boolean;
          show_volume_control?: boolean;
          token_auth_enabled?: boolean;
          updated_at?: string;
          video_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'video_player_configs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_player_configs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_player_configs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_player_configs_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: false;
            referencedRelation: 'videos';
            referencedColumns: ['id'];
          },
        ];
      };
      videos: {
        Row: {
          account_id: string;
          bunny_library_id: string;
          bunny_video_id: string;
          created_at: string;
          description: string | null;
          duration_seconds: number | null;
          file_size_bytes: number | null;
          folder_id: string | null;
          id: string;
          original_filename: string | null;
          public_share_enabled: boolean;
          public_share_token: string | null;
          status: string;
          tags: string[];
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          bunny_library_id: string;
          bunny_video_id: string;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          file_size_bytes?: number | null;
          folder_id?: string | null;
          id?: string;
          original_filename?: string | null;
          public_share_enabled?: boolean;
          public_share_token?: string | null;
          status?: string;
          tags?: string[];
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          bunny_library_id?: string;
          bunny_video_id?: string;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          file_size_bytes?: number | null;
          folder_id?: string | null;
          id?: string;
          original_filename?: string | null;
          public_share_enabled?: boolean;
          public_share_token?: string | null;
          status?: string;
          tags?: string[];
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'videos_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'videos_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'videos_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'videos_folder_id_fkey';
            columns: ['folder_id'];
            isOneToOne: false;
            referencedRelation: 'video_folders';
            referencedColumns: ['id'];
          },
        ];
      };
      website_content_docs: {
        Row: {
          account_id: string;
          content_md: string;
          created_at: string;
          created_by: string | null;
          id: string;
          sort_order: number;
          title: string;
          updated_at: string;
          website_id: string;
        };
        Insert: {
          account_id: string;
          content_md?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
          website_id: string;
        };
        Update: {
          account_id?: string;
          content_md?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          website_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'website_content_docs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_content_docs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_content_docs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_content_docs_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
            referencedColumns: ['id'];
          },
        ];
      };
      websites: {
        Row: {
          business_id: string;
          client_org_id: string | null;
          cms_admin_url: string | null;
          created_at: string;
          domain: string | null;
          github_repo_url: string | null;
          hosting_notes: string | null;
          id: string;
          job_id: string | null;
          launched_at: string | null;
          name: string;
          notes: string | null;
          sitemap: Json;
          stack: string;
          staging_url: string | null;
          status: string;
          supabase_schema: string | null;
          umami_share_url: string | null;
          umami_website_id: string | null;
          updated_at: string;
          vercel_project_id: string | null;
          wireframes: Json;
        };
        Insert: {
          business_id: string;
          client_org_id?: string | null;
          cms_admin_url?: string | null;
          created_at?: string;
          domain?: string | null;
          github_repo_url?: string | null;
          hosting_notes?: string | null;
          id?: string;
          job_id?: string | null;
          launched_at?: string | null;
          name?: string;
          notes?: string | null;
          sitemap?: Json;
          stack?: string;
          staging_url?: string | null;
          status?: string;
          supabase_schema?: string | null;
          umami_share_url?: string | null;
          umami_website_id?: string | null;
          updated_at?: string;
          vercel_project_id?: string | null;
          wireframes?: Json;
        };
        Update: {
          business_id?: string;
          client_org_id?: string | null;
          cms_admin_url?: string | null;
          created_at?: string;
          domain?: string | null;
          github_repo_url?: string | null;
          hosting_notes?: string | null;
          id?: string;
          job_id?: string | null;
          launched_at?: string | null;
          name?: string;
          notes?: string | null;
          sitemap?: Json;
          stack?: string;
          staging_url?: string | null;
          status?: string;
          supabase_schema?: string | null;
          umami_share_url?: string | null;
          umami_website_id?: string | null;
          updated_at?: string;
          vercel_project_id?: string | null;
          wireframes?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'websites_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'websites_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'websites_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'websites_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'websites_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_dashboard_shortcuts: {
        Row: {
          account_id: string;
          created_at: string;
          mobile_nav_shortcuts: Json;
          shortcuts: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          mobile_nav_shortcuts?: Json;
          shortcuts?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          mobile_nav_shortcuts?: Json;
          shortcuts?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_dashboard_shortcuts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_dashboard_shortcuts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_dashboard_shortcuts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      user_account_workspace: {
        Row: {
          id: string | null;
          name: string | null;
          picture_url: string | null;
          subscription_status:
            | Database['public']['Enums']['subscription_status']
            | null;
        };
        Relationships: [];
      };
      user_accounts: {
        Row: {
          id: string | null;
          name: string | null;
          picture_url: string | null;
          role: string | null;
          slug: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_memberships_account_role_fkey';
            columns: ['role'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['name'];
          },
        ];
      };
    };
    Functions: {
      accept_invitation: {
        Args: { token: string; user_id: string };
        Returns: string;
      };
      add_invitations_to_account: {
        Args: {
          account_slug: string;
          invitations: Database['public']['CompositeTypes']['invitation'][];
        };
        Returns: Database['public']['Tables']['invitations']['Row'][];
      };
      allocate_invoice_number: {
        Args: { p_account_id: string };
        Returns: string;
      };
      can_action_account_member: {
        Args: { target_team_account_id: string; target_user_id: string };
        Returns: boolean;
      };
      can_read_community_member_note: {
        Args: {
          p_account_id: string;
          p_author_user_id: string;
          p_subject_user_id: string;
          p_visibility: string;
        };
        Returns: boolean;
      };
      contractor_assigned_to_job: {
        Args: { job_id: string };
        Returns: boolean;
      };
      create_invitation: {
        Args: { account_id: string; email: string; role: string };
        Returns: {
          account_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: number;
          invite_token: string;
          invited_by: string;
          role: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'invitations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_team_account:
        | {
            Args: {
              account_name: string;
              account_slug?: string;
              user_id: string;
            };
            Returns: {
              created_at: string | null;
              created_by: string | null;
              email: string | null;
              id: string;
              is_personal_account: boolean;
              name: string;
              picture_url: string | null;
              primary_owner_user_id: string;
              public_data: Json;
              slug: string | null;
              space_type: string | null;
              updated_at: string | null;
              updated_by: string | null;
              video_settings: Json;
            };
            SetofOptions: {
              from: '*';
              to: 'accounts';
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              account_name: string;
              account_slug?: string;
              account_space_type?: string;
              user_id: string;
            };
            Returns: {
              created_at: string | null;
              created_by: string | null;
              email: string | null;
              id: string;
              is_personal_account: boolean;
              name: string;
              picture_url: string | null;
              primary_owner_user_id: string;
              public_data: Json;
              slug: string | null;
              space_type: string | null;
              updated_at: string | null;
              updated_by: string | null;
              video_settings: Json;
            };
            SetofOptions: {
              from: '*';
              to: 'accounts';
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              account_business_type?: string;
              account_name: string;
              account_slug?: string;
              account_space_type?: string;
              user_id: string;
            };
            Returns: {
              created_at: string | null;
              created_by: string | null;
              email: string | null;
              id: string;
              is_personal_account: boolean;
              name: string;
              picture_url: string | null;
              primary_owner_user_id: string;
              public_data: Json;
              slug: string | null;
              space_type: string | null;
              updated_at: string | null;
              updated_by: string | null;
              video_settings: Json;
            };
            SetofOptions: {
              from: '*';
              to: 'accounts';
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              account_business_type?: string;
              account_complete_onboarding?: boolean;
              account_name: string;
              account_slug?: string;
              account_space_type?: string;
              user_id: string;
            };
            Returns: {
              created_at: string | null;
              created_by: string | null;
              email: string | null;
              id: string;
              is_personal_account: boolean;
              name: string;
              picture_url: string | null;
              primary_owner_user_id: string;
              public_data: Json;
              slug: string | null;
              space_type: string | null;
              updated_at: string | null;
              updated_by: string | null;
              video_settings: Json;
            };
            SetofOptions: {
              from: '*';
              to: 'accounts';
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      get_account_invitations: {
        Args: { account_slug: string };
        Returns: {
          account_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: number;
          invited_by: string;
          inviter_email: string;
          inviter_name: string;
          role: string;
          updated_at: string;
        }[];
      };
      get_account_members: {
        Args: { account_slug: string };
        Returns: {
          account_id: string;
          created_at: string;
          email: string;
          id: string;
          name: string;
          picture_url: string;
          primary_owner_user_id: string;
          role: string;
          role_hierarchy_level: number;
          updated_at: string;
          user_id: string;
        }[];
      };
      get_config: { Args: never; Returns: Json };
      get_invoice_for_portal: { Args: { p_token: string }; Returns: Json };
      get_upper_system_role: { Args: never; Returns: string };
      has_active_subscription: {
        Args: { target_account_id: string };
        Returns: boolean;
      };
      has_more_elevated_role: {
        Args: {
          role_name: string;
          target_account_id: string;
          target_user_id: string;
        };
        Returns: boolean;
      };
      has_permission: {
        Args: {
          account_id: string;
          permission_name: Database['public']['Enums']['app_permissions'];
          user_id: string;
        };
        Returns: boolean;
      };
      has_role_on_account: {
        Args: { account_id: string; account_role?: string };
        Returns: boolean;
      };
      has_same_role_hierarchy_level: {
        Args: {
          role_name: string;
          target_account_id: string;
          target_user_id: string;
        };
        Returns: boolean;
      };
      is_aal2: { Args: never; Returns: boolean };
      is_account_admin: {
        Args: { target_account_id: string };
        Returns: boolean;
      };
      is_account_member: {
        Args: { target_account_id: string };
        Returns: boolean;
      };
      is_account_owner: { Args: { account_id: string }; Returns: boolean };
      is_account_team_member: {
        Args: { target_account_id: string };
        Returns: boolean;
      };
      is_chat_thread_participant: {
        Args: { thread_id: string };
        Returns: boolean;
      };
      is_client_on_account: { Args: { account_id: string }; Returns: boolean };
      is_contractor_on_account: {
        Args: { account_id: string };
        Returns: boolean;
      };
      is_set: { Args: { field_name: string }; Returns: boolean };
      is_super_admin: { Args: never; Returns: boolean };
      is_team_member: {
        Args: { account_id: string; user_id: string };
        Returns: boolean;
      };
      match_brain_chunks: {
        Args: {
          match_account_id: string;
          match_count?: number;
          match_threshold?: number;
          query_embedding: string;
        };
        Returns: {
          chunk_index: number;
          content_text: string;
          id: string;
          metadata: Json;
          similarity: number;
          source_id: string;
          source_type: string;
        }[];
      };
      personal_person_owned_by_user: {
        Args: { p_person_id: string };
        Returns: boolean;
      };
      grant_ai_credit_purchase: {
        Args: {
          p_account_id: string;
          p_amount_total?: number | null;
          p_credits: number;
          p_currency?: string | null;
          p_stripe_checkout_session_id: string;
          p_stripe_price_id: string;
        };
        Returns: {
          account_id: string;
          created_at: string | null;
          credits_monthly_limit: number;
          credits_purchased: number;
          credits_remaining: number;
          id: string;
          period_end: string;
          period_start: string;
          updated_at: string | null;
        };
      };
      reset_ai_credits_if_expired: {
        Args: { p_account_id: string };
        Returns: {
          account_id: string;
          created_at: string | null;
          credits_monthly_limit: number;
          credits_remaining: number;
          id: string;
          period_end: string;
          period_start: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'ai_credit_balances';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      seed_account_module_settings: {
        Args: {
          p_account_id: string;
          p_business_type?: string;
          p_space_type?: string;
        };
        Returns: undefined;
      };
      team_account_workspace: {
        Args: { account_slug: string };
        Returns: {
          company_role: string;
          id: string;
          name: string;
          onboarding_completed: boolean;
          permissions: Database['public']['Enums']['app_permissions'][];
          picture_url: string;
          primary_owner_user_id: string;
          role: string;
          role_hierarchy_level: number;
          slug: string;
          space_type: string;
          subscription_status: Database['public']['Enums']['subscription_status'];
        }[];
      };
      transfer_team_account_ownership: {
        Args: { new_owner_id: string; target_account_id: string };
        Returns: undefined;
      };
      upsert_order: {
        Args: {
          billing_provider: Database['public']['Enums']['billing_provider'];
          currency: string;
          line_items: Json;
          status: Database['public']['Enums']['payment_status'];
          target_account_id: string;
          target_customer_id: string;
          target_order_id: string;
          total_amount: number;
        };
        Returns: {
          account_id: string;
          billing_customer_id: number;
          billing_provider: Database['public']['Enums']['billing_provider'];
          created_at: string;
          currency: string;
          id: string;
          status: Database['public']['Enums']['payment_status'];
          total_amount: number;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upsert_subscription: {
        Args: {
          active: boolean;
          billing_provider: Database['public']['Enums']['billing_provider'];
          cancel_at_period_end: boolean;
          currency: string;
          line_items: Json;
          period_ends_at: string;
          period_starts_at: string;
          status: Database['public']['Enums']['subscription_status'];
          target_account_id: string;
          target_customer_id: string;
          target_subscription_id: string;
          trial_ends_at?: string;
          trial_starts_at?: string;
        };
        Returns: {
          account_id: string;
          active: boolean;
          billing_customer_id: number;
          billing_provider: Database['public']['Enums']['billing_provider'];
          cancel_at_period_end: boolean;
          created_at: string;
          currency: string;
          id: string;
          period_ends_at: string;
          period_starts_at: string;
          status: Database['public']['Enums']['subscription_status'];
          trial_ends_at: string | null;
          trial_starts_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'subscriptions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_permissions:
        | 'roles.manage'
        | 'billing.manage'
        | 'settings.manage'
        | 'members.manage'
        | 'invites.manage'
        | 'jobs.view'
        | 'jobs.edit'
        | 'invoices.view'
        | 'invoices.edit'
        | 'clients.view'
        | 'clients.edit';
      billing_provider: 'stripe' | 'lemon-squeezy' | 'paddle';
      chat_participant_kind: 'member' | 'client';
      chat_thread_type: 'direct' | 'group' | 'job';
      notification_channel: 'in_app' | 'email';
      notification_type: 'info' | 'warning' | 'error';
      payment_status: 'pending' | 'succeeded' | 'failed';
      subscription_item_type: 'flat' | 'per_seat' | 'metered';
      subscription_status:
        | 'active'
        | 'trialing'
        | 'past_due'
        | 'canceled'
        | 'unpaid'
        | 'incomplete'
        | 'incomplete_expired'
        | 'paused';
    };
    CompositeTypes: {
      invitation: {
        email: string | null;
        role: string | null;
      };
    };
  };
  rankly: {
    Tables: {
      ai_audit_jobs: {
        Row: {
          created_at: string;
          credits_used: number | null;
          error_msg: string | null;
          id: string;
          pages_crawled: number | null;
          project_id: string;
          status: string;
          target_domain: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          credits_used?: number | null;
          error_msg?: string | null;
          id?: string;
          pages_crawled?: number | null;
          project_id: string;
          status?: string;
          target_domain: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          credits_used?: number | null;
          error_msg?: string | null;
          id?: string;
          pages_crawled?: number | null;
          project_id?: string;
          status?: string;
          target_domain?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_audit_jobs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_audit_recommendations: {
        Row: {
          created_at: string;
          description: string;
          dimension: string;
          display_order: number | null;
          example_urls: string[] | null;
          fix_snippet: string | null;
          id: string;
          is_quick_win: boolean;
          is_starred: boolean;
          magnitude: string | null;
          outcome: string | null;
          priority: string;
          project_id: string;
          report_id: string;
          title: string;
          why: string | null;
        };
        Insert: {
          created_at?: string;
          description: string;
          dimension: string;
          display_order?: number | null;
          example_urls?: string[] | null;
          fix_snippet?: string | null;
          id?: string;
          is_quick_win?: boolean;
          is_starred?: boolean;
          magnitude?: string | null;
          outcome?: string | null;
          priority: string;
          project_id: string;
          report_id: string;
          title: string;
          why?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string;
          dimension?: string;
          display_order?: number | null;
          example_urls?: string[] | null;
          fix_snippet?: string | null;
          id?: string;
          is_quick_win?: boolean;
          is_starred?: boolean;
          magnitude?: string | null;
          outcome?: string | null;
          priority?: string;
          project_id?: string;
          report_id?: string;
          title?: string;
          why?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_audit_recommendations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_audit_recommendations_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'ai_audit_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_audit_reports: {
        Row: {
          ai_citations_by_platform: Json | null;
          ai_cited: boolean | null;
          ai_cited_queries: string[] | null;
          ai_competing_brands: string[] | null;
          ai_competing_brands_opr: Json | null;
          competitor_backlinks: Json | null;
          crawl_data: Json | null;
          created_at: string;
          executive_summary: string | null;
          id: string;
          job_id: string;
          opr_decimal: number | null;
          opr_score: number | null;
          overall_score: number | null;
          project_id: string;
          referring_domains: number | null;
          score_content: number | null;
          score_eeat: number | null;
          score_entity: number | null;
          score_tech: number | null;
          target_domain: string;
          top_referring_domains: Json | null;
        };
        Insert: {
          ai_citations_by_platform?: Json | null;
          ai_cited?: boolean | null;
          ai_cited_queries?: string[] | null;
          ai_competing_brands?: string[] | null;
          ai_competing_brands_opr?: Json | null;
          competitor_backlinks?: Json | null;
          crawl_data?: Json | null;
          created_at?: string;
          executive_summary?: string | null;
          id?: string;
          job_id: string;
          opr_decimal?: number | null;
          opr_score?: number | null;
          overall_score?: number | null;
          project_id: string;
          referring_domains?: number | null;
          score_content?: number | null;
          score_eeat?: number | null;
          score_entity?: number | null;
          score_tech?: number | null;
          target_domain: string;
          top_referring_domains?: Json | null;
        };
        Update: {
          ai_citations_by_platform?: Json | null;
          ai_cited?: boolean | null;
          ai_cited_queries?: string[] | null;
          ai_competing_brands?: string[] | null;
          ai_competing_brands_opr?: Json | null;
          competitor_backlinks?: Json | null;
          crawl_data?: Json | null;
          created_at?: string;
          executive_summary?: string | null;
          id?: string;
          job_id?: string;
          opr_decimal?: number | null;
          opr_score?: number | null;
          overall_score?: number | null;
          project_id?: string;
          referring_domains?: number | null;
          score_content?: number | null;
          score_eeat?: number | null;
          score_entity?: number | null;
          score_tech?: number | null;
          target_domain?: string;
          top_referring_domains?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_audit_reports_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'ai_audit_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_audit_reports_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_audit_score_history: {
        Row: {
          id: string;
          overall_score: number | null;
          project_id: string;
          report_id: string;
          run_at: string;
          score_content: number | null;
          score_eeat: number | null;
          score_entity: number | null;
          score_tech: number | null;
        };
        Insert: {
          id?: string;
          overall_score?: number | null;
          project_id: string;
          report_id: string;
          run_at?: string;
          score_content?: number | null;
          score_eeat?: number | null;
          score_entity?: number | null;
          score_tech?: number | null;
        };
        Update: {
          id?: string;
          overall_score?: number | null;
          project_id?: string;
          report_id?: string;
          run_at?: string;
          score_content?: number | null;
          score_eeat?: number | null;
          score_entity?: number | null;
          score_tech?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_audit_score_history_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_audit_score_history_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'ai_audit_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      alert_history: {
        Row: {
          alert_id: string;
          id: string;
          new_position: number | null;
          notified: boolean;
          previous_position: number | null;
          triggered_at: string;
        };
        Insert: {
          alert_id: string;
          id?: string;
          new_position?: number | null;
          notified?: boolean;
          previous_position?: number | null;
          triggered_at?: string;
        };
        Update: {
          alert_id?: string;
          id?: string;
          new_position?: number | null;
          notified?: boolean;
          previous_position?: number | null;
          triggered_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'alert_history_alert_id_fkey';
            columns: ['alert_id'];
            isOneToOne: false;
            referencedRelation: 'alerts';
            referencedColumns: ['id'];
          },
        ];
      };
      alerts: {
        Row: {
          alert_type: string;
          created_at: string;
          id: string;
          is_active: boolean;
          keyword_id: string;
          last_triggered_at: string | null;
          threshold: number | null;
          threshold_position: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alert_type: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          keyword_id: string;
          last_triggered_at?: string | null;
          threshold?: number | null;
          threshold_position?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alert_type?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          keyword_id?: string;
          last_triggered_at?: string | null;
          threshold?: number | null;
          threshold_position?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'alerts_keyword_id_fkey';
            columns: ['keyword_id'];
            isOneToOne: false;
            referencedRelation: 'keywords';
            referencedColumns: ['id'];
          },
        ];
      };
      backlink_crawls: {
        Row: {
          completed_at: string | null;
          id: string;
          project_id: string;
          started_at: string;
        };
        Insert: {
          completed_at?: string | null;
          id?: string;
          project_id: string;
          started_at?: string;
        };
        Update: {
          completed_at?: string | null;
          id?: string;
          project_id?: string;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'backlink_crawls_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      backlinks: {
        Row: {
          anchor_text: string | null;
          crawl_id: string | null;
          crawled_at: string;
          created_at: string;
          discovered_at: string | null;
          first_seen: string | null;
          id: string;
          last_seen: string | null;
          link_type: string;
          project_id: string;
          source_domain: string | null;
          source_dr: number | null;
          source_url: string;
          status: string;
          target_url: string | null;
        };
        Insert: {
          anchor_text?: string | null;
          crawl_id?: string | null;
          crawled_at?: string;
          created_at?: string;
          discovered_at?: string | null;
          first_seen?: string | null;
          id?: string;
          last_seen?: string | null;
          link_type?: string;
          project_id: string;
          source_domain?: string | null;
          source_dr?: number | null;
          source_url: string;
          status?: string;
          target_url?: string | null;
        };
        Update: {
          anchor_text?: string | null;
          crawl_id?: string | null;
          crawled_at?: string;
          created_at?: string;
          discovered_at?: string | null;
          first_seen?: string | null;
          id?: string;
          last_seen?: string | null;
          link_type?: string;
          project_id?: string;
          source_domain?: string | null;
          source_dr?: number | null;
          source_url?: string;
          status?: string;
          target_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'backlinks_crawl_id_fkey';
            columns: ['crawl_id'];
            isOneToOne: false;
            referencedRelation: 'backlink_crawls';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'backlinks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      competitor_keywords: {
        Row: {
          competitor_domain: string;
          competitor_position: number | null;
          id: string;
          keyword_id: string;
          project_id: string;
          recorded_at: string;
        };
        Insert: {
          competitor_domain: string;
          competitor_position?: number | null;
          id?: string;
          keyword_id: string;
          project_id: string;
          recorded_at: string;
        };
        Update: {
          competitor_domain?: string;
          competitor_position?: number | null;
          id?: string;
          keyword_id?: string;
          project_id?: string;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'competitor_keywords_keyword_id_fkey';
            columns: ['keyword_id'];
            isOneToOne: false;
            referencedRelation: 'keywords';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'competitor_keywords_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      content_brief_jobs: {
        Row: {
          country: string;
          created_at: string;
          credits_used: number | null;
          error_msg: string | null;
          id: string;
          mode: string;
          project_id: string;
          spoke_id: string | null;
          status: string;
          target_domain: string;
          target_keyword: string | null;
          topic_reasoning: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          country?: string;
          created_at?: string;
          credits_used?: number | null;
          error_msg?: string | null;
          id?: string;
          mode?: string;
          project_id: string;
          spoke_id?: string | null;
          status?: string;
          target_domain: string;
          target_keyword?: string | null;
          topic_reasoning?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          country?: string;
          created_at?: string;
          credits_used?: number | null;
          error_msg?: string | null;
          id?: string;
          mode?: string;
          project_id?: string;
          spoke_id?: string | null;
          status?: string;
          target_domain?: string;
          target_keyword?: string | null;
          topic_reasoning?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'content_brief_jobs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_brief_jobs_spoke_id_fkey';
            columns: ['spoke_id'];
            isOneToOne: false;
            referencedRelation: 'keyword_cluster_spokes';
            referencedColumns: ['id'];
          },
        ];
      };
      content_briefs: {
        Row: {
          ai_cited_brands: string[] | null;
          ai_search_actions: string[] | null;
          angle: string | null;
          competitor_avg_wc: number | null;
          competitor_backlinks: Json | null;
          competitor_data: Json | null;
          competitor_domains: Json | null;
          content_gaps: string[] | null;
          created_at: string;
          domain_keywords: Json | null;
          eeat_notes: string | null;
          h1: string | null;
          id: string;
          job_id: string;
          outline: Json | null;
          primary_keyword: string | null;
          project_id: string;
          required_assets: string | null;
          secondary_keywords: string[] | null;
          serp_snapshot: Json | null;
          suggested_links: Json | null;
          suggested_meta_desc: string | null;
          target_keyword: string;
          target_referring_domains: number | null;
          template_rationale: string | null;
          template_type: string | null;
          title_options: string[] | null;
          tone_notes: string | null;
          traffic_position_1_3: number | null;
          traffic_position_5: number | null;
          word_count_max: number | null;
          word_count_min: number | null;
          word_count_target: number | null;
        };
        Insert: {
          ai_cited_brands?: string[] | null;
          ai_search_actions?: string[] | null;
          angle?: string | null;
          competitor_avg_wc?: number | null;
          competitor_backlinks?: Json | null;
          competitor_data?: Json | null;
          competitor_domains?: Json | null;
          content_gaps?: string[] | null;
          created_at?: string;
          domain_keywords?: Json | null;
          eeat_notes?: string | null;
          h1?: string | null;
          id?: string;
          job_id: string;
          outline?: Json | null;
          primary_keyword?: string | null;
          project_id: string;
          required_assets?: string | null;
          secondary_keywords?: string[] | null;
          serp_snapshot?: Json | null;
          suggested_links?: Json | null;
          suggested_meta_desc?: string | null;
          target_keyword: string;
          target_referring_domains?: number | null;
          template_rationale?: string | null;
          template_type?: string | null;
          title_options?: string[] | null;
          tone_notes?: string | null;
          traffic_position_1_3?: number | null;
          traffic_position_5?: number | null;
          word_count_max?: number | null;
          word_count_min?: number | null;
          word_count_target?: number | null;
        };
        Update: {
          ai_cited_brands?: string[] | null;
          ai_search_actions?: string[] | null;
          angle?: string | null;
          competitor_avg_wc?: number | null;
          competitor_backlinks?: Json | null;
          competitor_data?: Json | null;
          competitor_domains?: Json | null;
          content_gaps?: string[] | null;
          created_at?: string;
          domain_keywords?: Json | null;
          eeat_notes?: string | null;
          h1?: string | null;
          id?: string;
          job_id?: string;
          outline?: Json | null;
          primary_keyword?: string | null;
          project_id?: string;
          required_assets?: string | null;
          secondary_keywords?: string[] | null;
          serp_snapshot?: Json | null;
          suggested_links?: Json | null;
          suggested_meta_desc?: string | null;
          target_keyword?: string;
          target_referring_domains?: number | null;
          template_rationale?: string | null;
          template_type?: string | null;
          title_options?: string[] | null;
          tone_notes?: string | null;
          traffic_position_1_3?: number | null;
          traffic_position_5?: number | null;
          word_count_max?: number | null;
          word_count_min?: number | null;
          word_count_target?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'content_briefs_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'content_brief_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_briefs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      dataforseo_api_log: {
        Row: {
          called_at: string;
          endpoint: string;
          estimated_cost_usd: number | null;
          feature_area: string | null;
          id: string;
          project_id: string | null;
          task_count: number;
        };
        Insert: {
          called_at?: string;
          endpoint: string;
          estimated_cost_usd?: number | null;
          feature_area?: string | null;
          id?: string;
          project_id?: string | null;
          task_count?: number;
        };
        Update: {
          called_at?: string;
          endpoint?: string;
          estimated_cost_usd?: number | null;
          feature_area?: string | null;
          id?: string;
          project_id?: string | null;
          task_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'dataforseo_api_log_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      domain_metrics: {
        Row: {
          backlinks_total: number | null;
          created_at: string;
          da_score: number | null;
          dofollow_count: number | null;
          domain: string;
          dr_score: number | null;
          id: string;
          is_competitor: boolean;
          nofollow_count: number | null;
          organic_traffic_estimate: number | null;
          project_id: string;
          recorded_at: string;
          referring_domains: number | null;
          source_endpoint: string | null;
        };
        Insert: {
          backlinks_total?: number | null;
          created_at?: string;
          da_score?: number | null;
          dofollow_count?: number | null;
          domain: string;
          dr_score?: number | null;
          id?: string;
          is_competitor?: boolean;
          nofollow_count?: number | null;
          organic_traffic_estimate?: number | null;
          project_id: string;
          recorded_at: string;
          referring_domains?: number | null;
          source_endpoint?: string | null;
        };
        Update: {
          backlinks_total?: number | null;
          created_at?: string;
          da_score?: number | null;
          dofollow_count?: number | null;
          domain?: string;
          dr_score?: number | null;
          id?: string;
          is_competitor?: boolean;
          nofollow_count?: number | null;
          organic_traffic_estimate?: number | null;
          project_id?: string;
          recorded_at?: string;
          referring_domains?: number | null;
          source_endpoint?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'domain_metrics_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      keyword_cluster_jobs: {
        Row: {
          candidate_count: number | null;
          country: string;
          created_at: string;
          credits_used: number | null;
          error_msg: string | null;
          id: string;
          max_kd: number;
          min_volume: number;
          project_id: string;
          seeds: string[];
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          candidate_count?: number | null;
          country?: string;
          created_at?: string;
          credits_used?: number | null;
          error_msg?: string | null;
          id?: string;
          max_kd?: number;
          min_volume?: number;
          project_id: string;
          seeds: string[];
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          candidate_count?: number | null;
          country?: string;
          created_at?: string;
          credits_used?: number | null;
          error_msg?: string | null;
          id?: string;
          max_kd?: number;
          min_volume?: number;
          project_id?: string;
          seeds?: string[];
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'keyword_cluster_jobs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      keyword_cluster_keywords: {
        Row: {
          cluster_id: string | null;
          cpc: number | null;
          id: string;
          intent: string | null;
          job_id: string;
          kd: number | null;
          keyword: string;
          role: string | null;
          volume: number | null;
        };
        Insert: {
          cluster_id?: string | null;
          cpc?: number | null;
          id?: string;
          intent?: string | null;
          job_id: string;
          kd?: number | null;
          keyword: string;
          role?: string | null;
          volume?: number | null;
        };
        Update: {
          cluster_id?: string | null;
          cpc?: number | null;
          id?: string;
          intent?: string | null;
          job_id?: string;
          kd?: number | null;
          keyword?: string;
          role?: string | null;
          volume?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'keyword_cluster_keywords_cluster_id_fkey';
            columns: ['cluster_id'];
            isOneToOne: false;
            referencedRelation: 'keyword_clusters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'keyword_cluster_keywords_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'keyword_cluster_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      keyword_cluster_links: {
        Row: {
          from_cluster_id: string | null;
          id: string;
          job_id: string;
          link_type: string | null;
          to_cluster_id: string | null;
        };
        Insert: {
          from_cluster_id?: string | null;
          id?: string;
          job_id: string;
          link_type?: string | null;
          to_cluster_id?: string | null;
        };
        Update: {
          from_cluster_id?: string | null;
          id?: string;
          job_id?: string;
          link_type?: string | null;
          to_cluster_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'keyword_cluster_links_from_cluster_id_fkey';
            columns: ['from_cluster_id'];
            isOneToOne: false;
            referencedRelation: 'keyword_clusters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'keyword_cluster_links_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'keyword_cluster_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'keyword_cluster_links_to_cluster_id_fkey';
            columns: ['to_cluster_id'];
            isOneToOne: false;
            referencedRelation: 'keyword_clusters';
            referencedColumns: ['id'];
          },
        ];
      };
      keyword_cluster_quality: {
        Row: {
          created_at: string;
          detail: string | null;
          gate: string;
          id: string;
          job_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          detail?: string | null;
          gate: string;
          id?: string;
          job_id: string;
          status: string;
        };
        Update: {
          created_at?: string;
          detail?: string | null;
          gate?: string;
          id?: string;
          job_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'keyword_cluster_quality_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'keyword_cluster_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      keyword_cluster_spokes: {
        Row: {
          cluster_id: string;
          created_at: string;
          h1: string | null;
          h2s: string[] | null;
          id: string;
          position: number | null;
          target_keyword: string;
          title: string;
          volume: number | null;
        };
        Insert: {
          cluster_id: string;
          created_at?: string;
          h1?: string | null;
          h2s?: string[] | null;
          id?: string;
          position?: number | null;
          target_keyword: string;
          title: string;
          volume?: number | null;
        };
        Update: {
          cluster_id?: string;
          created_at?: string;
          h1?: string | null;
          h2s?: string[] | null;
          id?: string;
          position?: number | null;
          target_keyword?: string;
          title?: string;
          volume?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'keyword_cluster_spokes_cluster_id_fkey';
            columns: ['cluster_id'];
            isOneToOne: false;
            referencedRelation: 'keyword_clusters';
            referencedColumns: ['id'];
          },
        ];
      };
      keyword_clusters: {
        Row: {
          build_order: number | null;
          created_at: string;
          id: string;
          intent: string | null;
          job_id: string;
          name: string;
          pillar_h1: string | null;
          pillar_h2s: string[] | null;
          primary_keyword: string;
          priority_score: number | null;
          role: string;
          secondary_keywords: string[] | null;
          total_volume: number | null;
          weighted_kd: number | null;
        };
        Insert: {
          build_order?: number | null;
          created_at?: string;
          id?: string;
          intent?: string | null;
          job_id: string;
          name: string;
          pillar_h1?: string | null;
          pillar_h2s?: string[] | null;
          primary_keyword: string;
          priority_score?: number | null;
          role: string;
          secondary_keywords?: string[] | null;
          total_volume?: number | null;
          weighted_kd?: number | null;
        };
        Update: {
          build_order?: number | null;
          created_at?: string;
          id?: string;
          intent?: string | null;
          job_id?: string;
          name?: string;
          pillar_h1?: string | null;
          pillar_h2s?: string[] | null;
          primary_keyword?: string;
          priority_score?: number | null;
          role?: string;
          secondary_keywords?: string[] | null;
          total_volume?: number | null;
          weighted_kd?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'keyword_clusters_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'keyword_cluster_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      keyword_rankings: {
        Row: {
          ai_overview_present: boolean;
          created_at: string;
          date: string;
          device: string;
          id: string;
          keyword_id: string;
          position: number | null;
          ranking_url: string | null;
          serp_features: Json;
        };
        Insert: {
          ai_overview_present?: boolean;
          created_at?: string;
          date: string;
          device?: string;
          id?: string;
          keyword_id: string;
          position?: number | null;
          ranking_url?: string | null;
          serp_features?: Json;
        };
        Update: {
          ai_overview_present?: boolean;
          created_at?: string;
          date?: string;
          device?: string;
          id?: string;
          keyword_id?: string;
          position?: number | null;
          ranking_url?: string | null;
          serp_features?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'keyword_rankings_keyword_id_fkey';
            columns: ['keyword_id'];
            isOneToOne: false;
            referencedRelation: 'keywords';
            referencedColumns: ['id'];
          },
        ];
      };
      keyword_research_cache: {
        Row: {
          cached_at: string;
          country: string;
          expires_at: string;
          id: string;
          language: string;
          results: Json;
          seed_keyword: string;
        };
        Insert: {
          cached_at?: string;
          country: string;
          expires_at: string;
          id?: string;
          language: string;
          results: Json;
          seed_keyword: string;
        };
        Update: {
          cached_at?: string;
          country?: string;
          expires_at?: string;
          id?: string;
          language?: string;
          results?: Json;
          seed_keyword?: string;
        };
        Relationships: [];
      };
      keyword_tag_assignments: {
        Row: {
          keyword_id: string;
          tag_id: string;
        };
        Insert: {
          keyword_id: string;
          tag_id: string;
        };
        Update: {
          keyword_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'keyword_tag_assignments_keyword_id_fkey';
            columns: ['keyword_id'];
            isOneToOne: false;
            referencedRelation: 'keywords';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'keyword_tag_assignments_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
        ];
      };
      keywords: {
        Row: {
          cpc: number | null;
          created_at: string;
          device: string;
          id: string;
          intent: string | null;
          keyword: string;
          keyword_difficulty: number | null;
          keyword_normalized: string | null;
          metrics_updated_at: string | null;
          project_id: string;
          search_engine: string;
          search_volume: number | null;
          updated_at: string;
        };
        Insert: {
          cpc?: number | null;
          created_at?: string;
          device?: string;
          id?: string;
          intent?: string | null;
          keyword: string;
          keyword_difficulty?: number | null;
          keyword_normalized?: string | null;
          metrics_updated_at?: string | null;
          project_id: string;
          search_engine?: string;
          search_volume?: number | null;
          updated_at?: string;
        };
        Update: {
          cpc?: number | null;
          created_at?: string;
          device?: string;
          id?: string;
          intent?: string | null;
          keyword?: string;
          keyword_difficulty?: number | null;
          keyword_normalized?: string | null;
          metrics_updated_at?: string | null;
          project_id?: string;
          search_engine?: string;
          search_volume?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'keywords_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      page_optimization_jobs: {
        Row: {
          country: string;
          created_at: string;
          credits_used: number | null;
          error_msg: string | null;
          id: string;
          project_id: string;
          source_url: string;
          status: string;
          target_keyword: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          country?: string;
          created_at?: string;
          credits_used?: number | null;
          error_msg?: string | null;
          id?: string;
          project_id: string;
          source_url: string;
          status?: string;
          target_keyword?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          country?: string;
          created_at?: string;
          credits_used?: number | null;
          error_msg?: string | null;
          id?: string;
          project_id?: string;
          source_url?: string;
          status?: string;
          target_keyword?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'page_optimization_jobs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      page_optimization_reports: {
        Row: {
          competitor_data: Json | null;
          created_at: string;
          id: string;
          job_id: string;
          meta_suggestion: string | null;
          page_snapshot: Json | null;
          project_id: string;
          recommendations: Json;
          rewrite_summary: string | null;
          score: number | null;
          serp_snapshot: Json | null;
          source_url: string;
          target_keyword: string;
          title_suggestions: Json | null;
        };
        Insert: {
          competitor_data?: Json | null;
          created_at?: string;
          id?: string;
          job_id: string;
          meta_suggestion?: string | null;
          page_snapshot?: Json | null;
          project_id: string;
          recommendations?: Json;
          rewrite_summary?: string | null;
          score?: number | null;
          serp_snapshot?: Json | null;
          source_url: string;
          target_keyword: string;
          title_suggestions?: Json | null;
        };
        Update: {
          competitor_data?: Json | null;
          created_at?: string;
          id?: string;
          job_id?: string;
          meta_suggestion?: string | null;
          page_snapshot?: Json | null;
          project_id?: string;
          recommendations?: Json;
          rewrite_summary?: string | null;
          score?: number | null;
          serp_snapshot?: Json | null;
          source_url?: string;
          target_keyword?: string;
          title_suggestions?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'page_optimization_reports_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: true;
            referencedRelation: 'page_optimization_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'page_optimization_reports_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      pagespeed_check_jobs: {
        Row: {
          created_at: string;
          error_msg: string | null;
          finished_at: string | null;
          id: string;
          project_id: string;
          started_at: string | null;
          status: string;
          tasks_completed: number;
          tasks_total: number;
          trigger_source: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          error_msg?: string | null;
          finished_at?: string | null;
          id?: string;
          project_id: string;
          started_at?: string | null;
          status?: string;
          tasks_completed?: number;
          tasks_total?: number;
          trigger_source?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          error_msg?: string | null;
          finished_at?: string | null;
          id?: string;
          project_id?: string;
          started_at?: string | null;
          status?: string;
          tasks_completed?: number;
          tasks_total?: number;
          trigger_source?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pagespeed_check_jobs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      pagespeed_pages: {
        Row: {
          created_at: string;
          id: string;
          is_homepage: boolean;
          label: string | null;
          project_id: string;
          updated_at: string;
          url: string;
          url_normalized: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_homepage?: boolean;
          label?: string | null;
          project_id: string;
          updated_at?: string;
          url: string;
          url_normalized?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_homepage?: boolean;
          label?: string | null;
          project_id?: string;
          updated_at?: string;
          url?: string;
          url_normalized?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pagespeed_pages_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      pagespeed_recommendations: {
        Row: {
          audit_id: string;
          category: string;
          description: string;
          display_value: string | null;
          id: string;
          is_quick_win: boolean;
          kind: string;
          priority: string;
          result_id: string;
          savings_ms: number | null;
          sort_order: number;
          title: string;
        };
        Insert: {
          audit_id: string;
          category: string;
          description?: string;
          display_value?: string | null;
          id?: string;
          is_quick_win?: boolean;
          kind: string;
          priority: string;
          result_id: string;
          savings_ms?: number | null;
          sort_order?: number;
          title: string;
        };
        Update: {
          audit_id?: string;
          category?: string;
          description?: string;
          display_value?: string | null;
          id?: string;
          is_quick_win?: boolean;
          kind?: string;
          priority?: string;
          result_id?: string;
          savings_ms?: number | null;
          sort_order?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pagespeed_recommendations_result_id_fkey';
            columns: ['result_id'];
            isOneToOne: false;
            referencedRelation: 'pagespeed_results';
            referencedColumns: ['id'];
          },
        ];
      };
      pagespeed_results: {
        Row: {
          accessibility_score: number | null;
          best_practices_score: number | null;
          cls: number | null;
          error_msg: string | null;
          fcp_ms: number | null;
          fetched_at: string;
          id: string;
          lcp_ms: number | null;
          page_id: string;
          performance_score: number | null;
          seo_score: number | null;
          speed_index_ms: number | null;
          strategy: string;
          tbt_ms: number | null;
        };
        Insert: {
          accessibility_score?: number | null;
          best_practices_score?: number | null;
          cls?: number | null;
          error_msg?: string | null;
          fcp_ms?: number | null;
          fetched_at?: string;
          id?: string;
          lcp_ms?: number | null;
          page_id: string;
          performance_score?: number | null;
          seo_score?: number | null;
          speed_index_ms?: number | null;
          strategy: string;
          tbt_ms?: number | null;
        };
        Update: {
          accessibility_score?: number | null;
          best_practices_score?: number | null;
          cls?: number | null;
          error_msg?: string | null;
          fcp_ms?: number | null;
          fetched_at?: string;
          id?: string;
          lcp_ms?: number | null;
          page_id?: string;
          performance_score?: number | null;
          seo_score?: number | null;
          speed_index_ms?: number | null;
          strategy?: string;
          tbt_ms?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pagespeed_results_page_id_fkey';
            columns: ['page_id'];
            isOneToOne: false;
            referencedRelation: 'pagespeed_pages';
            referencedColumns: ['id'];
          },
        ];
      };
      project_competitors: {
        Row: {
          competitor_domain: string;
          created_at: string;
          id: string;
          project_id: string;
        };
        Insert: {
          competitor_domain: string;
          created_at?: string;
          id?: string;
          project_id: string;
        };
        Update: {
          competitor_domain?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_competitors_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_cron_state: {
        Row: {
          last_backlink_refresh_at: string | null;
          last_competitor_labs_at: string | null;
          last_domain_metrics_at: string | null;
          last_pagespeed_check_at: string | null;
          last_rank_check_at: string | null;
          next_pagespeed_check_at: string | null;
          next_rank_check_at: string | null;
          project_id: string;
        };
        Insert: {
          last_backlink_refresh_at?: string | null;
          last_competitor_labs_at?: string | null;
          last_domain_metrics_at?: string | null;
          last_pagespeed_check_at?: string | null;
          last_rank_check_at?: string | null;
          next_pagespeed_check_at?: string | null;
          next_rank_check_at?: string | null;
          project_id: string;
        };
        Update: {
          last_backlink_refresh_at?: string | null;
          last_competitor_labs_at?: string | null;
          last_domain_metrics_at?: string | null;
          last_pagespeed_check_at?: string | null;
          last_rank_check_at?: string | null;
          next_pagespeed_check_at?: string | null;
          next_rank_check_at?: string | null;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_cron_state_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: true;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          account_id: string;
          brief_brand_name: string | null;
          brief_mention_rules: string | null;
          brief_research_depth: string;
          brief_voice_notes: string | null;
          client_id: string | null;
          colour: string | null;
          created_at: string;
          domain: string;
          id: string;
          locale: string | null;
          name: string;
          notes: string | null;
          pagespeed_refresh_interval: string;
          rank_refresh_interval: string;
          target_country: string;
          target_language: string;
          track_desktop: boolean;
          track_mobile: boolean;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          brief_brand_name?: string | null;
          brief_mention_rules?: string | null;
          brief_research_depth?: string;
          brief_voice_notes?: string | null;
          client_id?: string | null;
          colour?: string | null;
          created_at?: string;
          domain: string;
          id?: string;
          locale?: string | null;
          name: string;
          notes?: string | null;
          pagespeed_refresh_interval?: string;
          rank_refresh_interval?: string;
          target_country?: string;
          target_language?: string;
          track_desktop?: boolean;
          track_mobile?: boolean;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          brief_brand_name?: string | null;
          brief_mention_rules?: string | null;
          brief_research_depth?: string;
          brief_voice_notes?: string | null;
          client_id?: string | null;
          colour?: string | null;
          created_at?: string;
          domain?: string;
          id?: string;
          locale?: string | null;
          name?: string;
          notes?: string | null;
          pagespeed_refresh_interval?: string;
          rank_refresh_interval?: string;
          target_country?: string;
          target_language?: string;
          track_desktop?: boolean;
          track_mobile?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      rank_check_jobs: {
        Row: {
          api_cost_usd: number;
          created_at: string;
          device_count: number;
          error_msg: string | null;
          estimated_cost_usd: number | null;
          finished_at: string | null;
          id: string;
          keyword_count: number;
          last_worker_trigger_at: string | null;
          project_id: string;
          started_at: string | null;
          status: string;
          tasks_completed: number;
          tasks_total: number;
          trigger_source: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          api_cost_usd?: number;
          created_at?: string;
          device_count?: number;
          error_msg?: string | null;
          estimated_cost_usd?: number | null;
          finished_at?: string | null;
          id?: string;
          keyword_count?: number;
          last_worker_trigger_at?: string | null;
          project_id: string;
          started_at?: string | null;
          status?: string;
          tasks_completed?: number;
          tasks_total?: number;
          trigger_source?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          api_cost_usd?: number;
          created_at?: string;
          device_count?: number;
          error_msg?: string | null;
          estimated_cost_usd?: number | null;
          finished_at?: string | null;
          id?: string;
          keyword_count?: number;
          last_worker_trigger_at?: string | null;
          project_id?: string;
          started_at?: string | null;
          status?: string;
          tasks_completed?: number;
          tasks_total?: number;
          trigger_source?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rank_check_jobs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      rank_check_tasks: {
        Row: {
          attempts: number;
          created_at: string;
          device: string;
          error_msg: string | null;
          id: string;
          job_id: string;
          keyword_id: string;
          locked_at: string | null;
          locked_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          device: string;
          error_msg?: string | null;
          id?: string;
          job_id: string;
          keyword_id: string;
          locked_at?: string | null;
          locked_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          device?: string;
          error_msg?: string | null;
          id?: string;
          job_id?: string;
          keyword_id?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rank_check_tasks_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'rank_check_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rank_check_tasks_keyword_id_fkey';
            columns: ['keyword_id'];
            isOneToOne: false;
            referencedRelation: 'keywords';
            referencedColumns: ['id'];
          },
        ];
      };
      site_crawl_jobs: {
        Row: {
          created_at: string;
          error_msg: string | null;
          finished_at: string | null;
          id: string;
          issue_summary: Json;
          last_worker_trigger_at: string | null;
          pending_urls: Json;
          project_id: string;
          start_url: string;
          started_at: string | null;
          status: string;
          trigger_source: string;
          updated_at: string;
          url_limit: number;
          urls_crawled: number;
          urls_discovered: number;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          error_msg?: string | null;
          finished_at?: string | null;
          id?: string;
          issue_summary?: Json;
          last_worker_trigger_at?: string | null;
          pending_urls?: Json;
          project_id: string;
          start_url: string;
          started_at?: string | null;
          status?: string;
          trigger_source?: string;
          updated_at?: string;
          url_limit?: number;
          urls_crawled?: number;
          urls_discovered?: number;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          error_msg?: string | null;
          finished_at?: string | null;
          id?: string;
          issue_summary?: Json;
          last_worker_trigger_at?: string | null;
          pending_urls?: Json;
          project_id?: string;
          start_url?: string;
          started_at?: string | null;
          status?: string;
          trigger_source?: string;
          updated_at?: string;
          url_limit?: number;
          urls_crawled?: number;
          urls_discovered?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'site_crawl_jobs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      site_crawl_pages: {
        Row: {
          canonical: string;
          crawl_error: string | null;
          crawled_at: string;
          external_links_out: number;
          final_url: string | null;
          h1: string;
          h1_count: number;
          id: string;
          indexable: boolean;
          internal_links_out: number;
          issues: Json;
          job_id: string;
          meta_description: string;
          project_id: string;
          schema_objects: Json;
          schema_types: Json;
          status_code: number;
          title: string;
          url: string;
          word_count: number;
        };
        Insert: {
          canonical?: string;
          crawl_error?: string | null;
          crawled_at?: string;
          external_links_out?: number;
          final_url?: string | null;
          h1?: string;
          h1_count?: number;
          id?: string;
          indexable?: boolean;
          internal_links_out?: number;
          issues?: Json;
          job_id: string;
          meta_description?: string;
          project_id: string;
          schema_objects?: Json;
          schema_types?: Json;
          status_code?: number;
          title?: string;
          url: string;
          word_count?: number;
        };
        Update: {
          canonical?: string;
          crawl_error?: string | null;
          crawled_at?: string;
          external_links_out?: number;
          final_url?: string | null;
          h1?: string;
          h1_count?: number;
          id?: string;
          indexable?: boolean;
          internal_links_out?: number;
          issues?: Json;
          job_id?: string;
          meta_description?: string;
          project_id?: string;
          schema_objects?: Json;
          schema_types?: Json;
          status_code?: number;
          title?: string;
          url?: string;
          word_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'site_crawl_pages_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'site_crawl_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_crawl_pages_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      site_overviews: {
        Row: {
          ai_overviews_count: number | null;
          authority_rank: number | null;
          backlinks_count: number | null;
          brand_signal: number | null;
          brand_visibility: Json | null;
          citation_strength: number | null;
          country_code: string;
          created_at: string;
          domain: string;
          domain_power: number | null;
          expires_at: string;
          fetched_at: string;
          id: string;
          link_trust: number | null;
          organic_keywords: number | null;
          organic_keywords_delta: number | null;
          organic_top3: number | null;
          organic_traffic: number | null;
          organic_traffic_delta: number | null;
          organic_value: number | null;
          organic_value_delta: number | null;
          page_authority: number | null;
          paid_keywords: number | null;
          paid_traffic: number | null;
          paid_value: number | null;
          project_id: string;
          referring_domains: number | null;
          spam_score: number | null;
          updated_at: string;
        };
        Insert: {
          ai_overviews_count?: number | null;
          authority_rank?: number | null;
          backlinks_count?: number | null;
          brand_signal?: number | null;
          brand_visibility?: Json | null;
          citation_strength?: number | null;
          country_code?: string;
          created_at?: string;
          domain: string;
          domain_power?: number | null;
          expires_at: string;
          fetched_at?: string;
          id?: string;
          link_trust?: number | null;
          organic_keywords?: number | null;
          organic_keywords_delta?: number | null;
          organic_top3?: number | null;
          organic_traffic?: number | null;
          organic_traffic_delta?: number | null;
          organic_value?: number | null;
          organic_value_delta?: number | null;
          page_authority?: number | null;
          paid_keywords?: number | null;
          paid_traffic?: number | null;
          paid_value?: number | null;
          project_id: string;
          referring_domains?: number | null;
          spam_score?: number | null;
          updated_at?: string;
        };
        Update: {
          ai_overviews_count?: number | null;
          authority_rank?: number | null;
          backlinks_count?: number | null;
          brand_signal?: number | null;
          brand_visibility?: Json | null;
          citation_strength?: number | null;
          country_code?: string;
          created_at?: string;
          domain?: string;
          domain_power?: number | null;
          expires_at?: string;
          fetched_at?: string;
          id?: string;
          link_trust?: number | null;
          organic_keywords?: number | null;
          organic_keywords_delta?: number | null;
          organic_top3?: number | null;
          organic_traffic?: number | null;
          organic_traffic_delta?: number | null;
          organic_value?: number | null;
          organic_value_delta?: number | null;
          page_authority?: number | null;
          paid_keywords?: number | null;
          paid_traffic?: number | null;
          paid_value?: number | null;
          project_id?: string;
          referring_domains?: number | null;
          spam_score?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'site_overviews_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: true;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          project_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          project_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tags_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_rank_check_tasks: {
        Args: { p_job_id: string; p_limit: number; p_worker_id: string };
        Returns: {
          attempts: number;
          created_at: string;
          device: string;
          error_msg: string | null;
          id: string;
          job_id: string;
          keyword_id: string;
          locked_at: string | null;
          locked_by: string | null;
          status: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'rank_check_tasks';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      release_stale_rank_check_tasks: {
        Args: { p_stale_minutes?: number };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  signatures: {
    Tables: {
      department_badges: {
        Row: {
          account_id: string;
          award_badge_url: string;
          created_at: string;
          department: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          award_badge_url: string;
          created_at?: string;
          department: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          award_badge_url?: string;
          created_at?: string;
          department?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_connections: {
        Row: {
          account_id: string;
          connected_at: string;
          connected_by: string | null;
          delegated_admin_email: string;
          id: string;
          primary_domain: string;
        };
        Insert: {
          account_id: string;
          connected_at?: string;
          connected_by?: string | null;
          delegated_admin_email: string;
          id?: string;
          primary_domain: string;
        };
        Update: {
          account_id?: string;
          connected_at?: string;
          connected_by?: string | null;
          delegated_admin_email?: string;
          id?: string;
          primary_domain?: string;
        };
        Relationships: [];
      };
      integration_connect_invites: {
        Row: {
          account_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          label: string | null;
          provider: string;
          revoked_at: string | null;
          token_hash: string;
          used_at: string | null;
          used_by_email: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          label?: string | null;
          provider: string;
          revoked_at?: string | null;
          token_hash: string;
          used_at?: string | null;
          used_by_email?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          label?: string | null;
          provider?: string;
          revoked_at?: string | null;
          token_hash?: string;
          used_at?: string | null;
          used_by_email?: string | null;
        };
        Relationships: [];
      };
      ms_connections: {
        Row: {
          access_token: string | null;
          account_id: string;
          connected_at: string;
          connected_by: string | null;
          id: string;
          ms_tenant_id: string;
          refresh_token: string | null;
          token_expires_at: string | null;
        };
        Insert: {
          access_token?: string | null;
          account_id: string;
          connected_at?: string;
          connected_by?: string | null;
          id?: string;
          ms_tenant_id: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
        };
        Update: {
          access_token?: string | null;
          account_id?: string;
          connected_at?: string;
          connected_by?: string | null;
          id?: string;
          ms_tenant_id?: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
        };
        Relationships: [];
      };
      push_log: {
        Row: {
          account_id: string;
          error_message: string | null;
          id: string;
          pushed_at: string;
          pushed_by: string | null;
          staff_id: string;
          status: string;
        };
        Insert: {
          account_id: string;
          error_message?: string | null;
          id?: string;
          pushed_at?: string;
          pushed_by?: string | null;
          staff_id: string;
          status: string;
        };
        Update: {
          account_id?: string;
          error_message?: string | null;
          id?: string;
          pushed_at?: string;
          pushed_by?: string | null;
          staff_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_log_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      staff: {
        Row: {
          account_id: string;
          branch: string | null;
          branch_id: string | null;
          created_at: string;
          department: string | null;
          email: string;
          full_name: string | null;
          google_user_id: string | null;
          id: string;
          job_title: string | null;
          ms_user_id: string | null;
          phone_direct: string | null;
          phone_mobile: string | null;
          photo_url: string | null;
          signature_email: string | null;
          signature_pushed_at: string | null;
          signature_status: string;
        };
        Insert: {
          account_id: string;
          branch?: string | null;
          branch_id?: string | null;
          created_at?: string;
          department?: string | null;
          email: string;
          full_name?: string | null;
          google_user_id?: string | null;
          id?: string;
          job_title?: string | null;
          ms_user_id?: string | null;
          phone_direct?: string | null;
          phone_mobile?: string | null;
          photo_url?: string | null;
          signature_email?: string | null;
          signature_pushed_at?: string | null;
          signature_status?: string;
        };
        Update: {
          account_id?: string;
          branch?: string | null;
          branch_id?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string;
          full_name?: string | null;
          google_user_id?: string | null;
          id?: string;
          job_title?: string | null;
          ms_user_id?: string | null;
          phone_direct?: string | null;
          phone_mobile?: string | null;
          photo_url?: string | null;
          signature_email?: string | null;
          signature_pushed_at?: string | null;
          signature_status?: string;
        };
        Relationships: [];
      };
      staff_templates: {
        Row: {
          staff_id: string;
          template_id: string;
        };
        Insert: {
          staff_id: string;
          template_id: string;
        };
        Update: {
          staff_id?: string;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_templates_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_templates_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'templates';
            referencedColumns: ['id'];
          },
        ];
      };
      templates: {
        Row: {
          account_id: string;
          created_at: string;
          html_template: string;
          id: string;
          is_default: boolean;
          name: string;
          preview_image_url: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          html_template: string;
          id?: string;
          is_default?: boolean;
          name: string;
          preview_image_url?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          html_template?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
          preview_image_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          format: string;
          id: string;
          name: string;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name?: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Relationships: [];
      };
      buckets_vectors: {
        Row: {
          created_at: string;
          id: string;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'objects_bucketId_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          metadata: Json | null;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_parts_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 's3_multipart_uploads_parts_upload_id_fkey';
            columns: ['upload_id'];
            isOneToOne: false;
            referencedRelation: 's3_multipart_uploads';
            referencedColumns: ['id'];
          },
        ];
      };
      vector_indexes: {
        Row: {
          bucket_id: string;
          created_at: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id: string;
          metadata_configuration: Json | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id?: string;
          metadata_configuration?: Json | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          data_type?: string;
          dimension?: number;
          distance_metric?: string;
          id?: string;
          metadata_configuration?: Json | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vector_indexes_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_vectors';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] };
        Returns: boolean;
      };
      allow_only_operation: {
        Args: { expected_operation: string };
        Returns: boolean;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      extension: { Args: { name: string }; Returns: string };
      filename: { Args: { name: string }; Returns: string };
      foldername: { Args: { name: string }; Returns: string[] };
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string };
        Returns: string;
      };
      get_size_by_bucket: {
        Args: never;
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          prefix_param: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      operation: { Args: never; Returns: string };
      search: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_by_timestamp: {
        Args: {
          p_bucket_id: string;
          p_level: number;
          p_limit: number;
          p_prefix: string;
          p_sort_column: string;
          p_sort_column_after: string;
          p_sort_order: string;
          p_start_after: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          levels?: number;
          limits?: number;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      buckettype: 'STANDARD' | 'ANALYTICS' | 'VECTOR';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

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
        'roles.manage',
        'billing.manage',
        'settings.manage',
        'members.manage',
        'invites.manage',
        'jobs.view',
        'jobs.edit',
        'invoices.view',
        'invoices.edit',
        'clients.view',
        'clients.edit',
      ],
      billing_provider: ['stripe', 'lemon-squeezy', 'paddle'],
      chat_participant_kind: ['member', 'client'],
      chat_thread_type: ['direct', 'group', 'job'],
      notification_channel: ['in_app', 'email'],
      notification_type: ['info', 'warning', 'error'],
      payment_status: ['pending', 'succeeded', 'failed'],
      subscription_item_type: ['flat', 'per_seat', 'metered'],
      subscription_status: [
        'active',
        'trialing',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused',
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
      buckettype: ['STANDARD', 'ANALYTICS', 'VECTOR'],
    },
  },
} as const;
