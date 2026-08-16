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
  public: {
    Tables: {
      account_billing: {
        Row: {
          account_id: string;
          canceled_at: string | null;
          created_at: string;
          grace_period_ends_at: string | null;
          restricted_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status:
            | Database['public']['Enums']['account_billing_status']
            | null;
          suspended_at: string | null;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          canceled_at?: string | null;
          created_at?: string;
          grace_period_ends_at?: string | null;
          restricted_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?:
            | Database['public']['Enums']['account_billing_status']
            | null;
          suspended_at?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          canceled_at?: string | null;
          created_at?: string;
          grace_period_ends_at?: string | null;
          restricted_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?:
            | Database['public']['Enums']['account_billing_status']
            | null;
          suspended_at?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_billing_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_billing_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_billing_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
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
          contact_email: string | null;
          created_at: string;
          logo_url: string | null;
          phone: string | null;
          primary_color: string;
          secondary_color: string | null;
          updated_at: string;
          website_url: string | null;
        };
        Insert: {
          accent_color?: string | null;
          account_id: string;
          address?: string | null;
          contact_email?: string | null;
          created_at?: string;
          logo_url?: string | null;
          phone?: string | null;
          primary_color?: string;
          secondary_color?: string | null;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          accent_color?: string | null;
          account_id?: string;
          address?: string | null;
          contact_email?: string | null;
          created_at?: string;
          logo_url?: string | null;
          phone?: string | null;
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
      account_content_templates: {
        Row: {
          account_id: string;
          body_html: string;
          body_text: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_default: boolean;
          kind: string;
          name: string;
          signature: string | null;
          source_system_template_id: string | null;
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          body_html?: string;
          body_text?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          kind: string;
          name: string;
          signature?: string | null;
          source_system_template_id?: string | null;
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          body_html?: string;
          body_text?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          kind?: string;
          name?: string;
          signature?: string | null;
          source_system_template_id?: string | null;
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_content_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_content_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_content_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_content_templates_source_system_template_id_fkey';
            columns: ['source_system_template_id'];
            isOneToOne: false;
            referencedRelation: 'content_templates';
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
          application_fee_percent: number | null;
          bank_account_name: string | null;
          bank_account_number: string | null;
          bank_bic: string | null;
          bank_iban: string | null;
          bank_sort_code: string | null;
          bank_transfer_enabled: boolean;
          bank_transfer_instructions: string | null;
          created_at: string;
          default_hourly_rate_pence: number | null;
          default_invoice_currency: string;
          default_invoice_due_days: number;
          invoice_quantity_label: string;
          invoice_starting_number: number;
          stripe_account_id: string | null;
          stripe_billing_portal_configuration_id: string | null;
          stripe_card_fee_mode: string;
          stripe_connect_enabled: boolean;
          stripe_pay_now_enabled: boolean;
          stripe_smart_retries_configured_at: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          application_fee_percent?: number | null;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_bic?: string | null;
          bank_iban?: string | null;
          bank_sort_code?: string | null;
          bank_transfer_enabled?: boolean;
          bank_transfer_instructions?: string | null;
          created_at?: string;
          default_hourly_rate_pence?: number | null;
          default_invoice_currency?: string;
          default_invoice_due_days?: number;
          invoice_quantity_label?: string;
          invoice_starting_number?: number;
          stripe_account_id?: string | null;
          stripe_billing_portal_configuration_id?: string | null;
          stripe_card_fee_mode?: string;
          stripe_connect_enabled?: boolean;
          stripe_pay_now_enabled?: boolean;
          stripe_smart_retries_configured_at?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          application_fee_percent?: number | null;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_bic?: string | null;
          bank_iban?: string | null;
          bank_sort_code?: string | null;
          bank_transfer_enabled?: boolean;
          bank_transfer_instructions?: string | null;
          created_at?: string;
          default_hourly_rate_pence?: number | null;
          default_invoice_currency?: string;
          default_invoice_due_days?: number;
          invoice_quantity_label?: string;
          invoice_starting_number?: number;
          stripe_account_id?: string | null;
          stripe_billing_portal_configuration_id?: string | null;
          stripe_card_fee_mode?: string;
          stripe_connect_enabled?: boolean;
          stripe_pay_now_enabled?: boolean;
          stripe_smart_retries_configured_at?: string | null;
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
          default_currency: string;
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
          default_currency?: string;
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
          default_currency?: string;
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
      activity_blocks: {
        Row: {
          account_id: string;
          app_name: string;
          bundle_id: string;
          client_id: string | null;
          confidence_score: number | null;
          created_at: string;
          domain: string | null;
          duration_seconds: number;
          email_from: string | null;
          email_to: string | null;
          ended_at: string;
          id: string;
          is_confirmed: boolean;
          is_excluded: boolean;
          project_id: string | null;
          repo_name: string | null;
          started_at: string;
          url: string | null;
          user_id: string;
          window_title: string;
          work_classification: string;
        };
        Insert: {
          account_id: string;
          app_name: string;
          bundle_id?: string;
          client_id?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          domain?: string | null;
          duration_seconds: number;
          email_from?: string | null;
          email_to?: string | null;
          ended_at: string;
          id?: string;
          is_confirmed?: boolean;
          is_excluded?: boolean;
          project_id?: string | null;
          repo_name?: string | null;
          started_at: string;
          url?: string | null;
          user_id: string;
          window_title?: string;
          work_classification?: string;
        };
        Update: {
          account_id?: string;
          app_name?: string;
          bundle_id?: string;
          client_id?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          domain?: string | null;
          duration_seconds?: number;
          email_from?: string | null;
          email_to?: string | null;
          ended_at?: string;
          id?: string;
          is_confirmed?: boolean;
          is_excluded?: boolean;
          project_id?: string | null;
          repo_name?: string | null;
          started_at?: string;
          url?: string | null;
          user_id?: string;
          window_title?: string;
          work_classification?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_blocks_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_blocks_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_blocks_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_blocks_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_blocks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      activity_privacy_settings: {
        Row: {
          account_id: string;
          capture_full_urls: boolean;
          created_at: string;
          excluded_apps: string[];
          excluded_domains: string[];
          idle_threshold_seconds: number;
          tracking_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          capture_full_urls?: boolean;
          created_at?: string;
          excluded_apps?: string[];
          excluded_domains?: string[];
          idle_threshold_seconds?: number;
          tracking_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          capture_full_urls?: boolean;
          created_at?: string;
          excluded_apps?: string[];
          excluded_domains?: string[];
          idle_threshold_seconds?: number;
          tracking_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_privacy_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_privacy_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_privacy_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      activity_rules: {
        Row: {
          account_id: string;
          client_id: string | null;
          created_at: string;
          created_from: string;
          id: string;
          match_type: string;
          match_value: string;
          project_id: string | null;
          user_id: string;
        };
        Insert: {
          account_id: string;
          client_id?: string | null;
          created_at?: string;
          created_from?: string;
          id?: string;
          match_type: string;
          match_value: string;
          project_id?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string;
          client_id?: string | null;
          created_at?: string;
          created_from?: string;
          id?: string;
          match_type?: string;
          match_value?: string;
          project_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_rules_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_rules_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_rules_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_rules_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_rules_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
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
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agency_branding_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agency_branding_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
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
      ai_model_cost_rates: {
        Row: {
          input_usd_per_mtok: number;
          model: string;
          notes: string | null;
          output_usd_per_mtok: number;
          provider: string;
          updated_at: string;
        };
        Insert: {
          input_usd_per_mtok: number;
          model: string;
          notes?: string | null;
          output_usd_per_mtok: number;
          provider: string;
          updated_at?: string;
        };
        Update: {
          input_usd_per_mtok?: number;
          model?: string;
          notes?: string | null;
          output_usd_per_mtok?: number;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
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
      availability_overrides: {
        Row: {
          created_at: string;
          date: string;
          end_time: string | null;
          id: string;
          schedule_id: string;
          start_time: string | null;
        };
        Insert: {
          created_at?: string;
          date: string;
          end_time?: string | null;
          id?: string;
          schedule_id: string;
          start_time?: string | null;
        };
        Update: {
          created_at?: string;
          date?: string;
          end_time?: string | null;
          id?: string;
          schedule_id?: string;
          start_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_overrides_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'availability_schedules';
            referencedColumns: ['id'];
          },
        ];
      };
      availability_rules: {
        Row: {
          created_at: string;
          day_of_week: number;
          end_time: string;
          id: string;
          schedule_id: string;
          start_time: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: number;
          end_time: string;
          id?: string;
          schedule_id: string;
          start_time: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          schedule_id?: string;
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_rules_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'availability_schedules';
            referencedColumns: ['id'];
          },
        ];
      };
      availability_schedules: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          is_default: boolean;
          name: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_schedules_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'availability_schedules_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'availability_schedules_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
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
      billing_email_outbox: {
        Row: {
          account_id: string;
          created_at: string;
          email_kind: string;
          error: string | null;
          id: string;
          payload: Json;
          processed_at: string | null;
          status: string;
          stripe_event_id: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          email_kind: string;
          error?: string | null;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          status?: string;
          stripe_event_id?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          email_kind?: string;
          error?: string | null;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          status?: string;
          stripe_event_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_email_outbox_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_email_outbox_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_email_outbox_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_events: {
        Row: {
          account_id: string;
          created_at: string;
          from_status:
            | Database['public']['Enums']['account_billing_status']
            | null;
          id: string;
          stripe_event_id: string | null;
          to_status: Database['public']['Enums']['account_billing_status'];
        };
        Insert: {
          account_id: string;
          created_at?: string;
          from_status?:
            | Database['public']['Enums']['account_billing_status']
            | null;
          id?: string;
          stripe_event_id?: string | null;
          to_status: Database['public']['Enums']['account_billing_status'];
        };
        Update: {
          account_id?: string;
          created_at?: string;
          from_status?:
            | Database['public']['Enums']['account_billing_status']
            | null;
          id?: string;
          stripe_event_id?: string | null;
          to_status?: Database['public']['Enums']['account_billing_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'billing_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_events_account_id_fkey';
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
      booking_form_fields: {
        Row: {
          created_at: string;
          event_type_id: string;
          field_type: string;
          id: string;
          is_required: boolean;
          label: string;
          options: Json | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          event_type_id: string;
          field_type: string;
          id?: string;
          is_required?: boolean;
          label: string;
          options?: Json | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          event_type_id?: string;
          field_type?: string;
          id?: string;
          is_required?: boolean;
          label?: string;
          options?: Json | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_form_fields_event_type_id_fkey';
            columns: ['event_type_id'];
            isOneToOne: false;
            referencedRelation: 'event_types';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_form_responses: {
        Row: {
          booking_id: string;
          created_at: string;
          form_field_id: string;
          id: string;
          value: Json;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          form_field_id: string;
          id?: string;
          value: Json;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          form_field_id?: string;
          id?: string;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_form_responses_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_form_responses_form_field_id_fkey';
            columns: ['form_field_id'];
            isOneToOne: false;
            referencedRelation: 'booking_form_fields';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_guests: {
        Row: {
          booking_id: string;
          created_at: string;
          email: string;
          id: string;
          name: string | null;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          email: string;
          id?: string;
          name?: string | null;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_guests_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_notification_settings: {
        Row: {
          account_id: string;
          created_at: string;
          reminder_offsets_minutes: number[];
          reply_to_email: string | null;
          send_cancellation_emails: boolean;
          send_confirmation_to_host: boolean;
          send_confirmation_to_invitee: boolean;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          reminder_offsets_minutes?: number[];
          reply_to_email?: string | null;
          send_cancellation_emails?: boolean;
          send_confirmation_to_host?: boolean;
          send_confirmation_to_invitee?: boolean;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          reminder_offsets_minutes?: number[];
          reply_to_email?: string | null;
          send_cancellation_emails?: boolean;
          send_confirmation_to_host?: boolean;
          send_confirmation_to_invitee?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_notification_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_notification_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_notification_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_pages: {
        Row: {
          account_id: string;
          brand_colour: string | null;
          created_at: string;
          description: string | null;
          host_user_id: string;
          id: string;
          is_active: boolean;
          slug: string;
          timezone: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          brand_colour?: string | null;
          created_at?: string;
          description?: string | null;
          host_user_id: string;
          id?: string;
          is_active?: boolean;
          slug: string;
          timezone?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          brand_colour?: string | null;
          created_at?: string;
          description?: string | null;
          host_user_id?: string;
          id?: string;
          is_active?: boolean;
          slug?: string;
          timezone?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_reminders: {
        Row: {
          booking_id: string;
          created_at: string;
          id: string;
          recipient: string;
          send_at: string;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          id?: string;
          recipient: string;
          send_at: string;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          id?: string;
          recipient?: string;
          send_at?: string;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_reminders_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      bookings: {
        Row: {
          account_id: string;
          booking_page_id: string;
          cancellation_reason: string | null;
          client_id: string | null;
          conferencing_provider: string | null;
          conferencing_url: string | null;
          created_at: string;
          end_at: string;
          event_type_id: string;
          google_event_id: string | null;
          host_attention_reason: string | null;
          id: string;
          invitee_email: string;
          invitee_name: string;
          invitee_notes: string | null;
          invitee_timezone: string;
          management_token: string;
          needs_host_attention: boolean;
          provider_meeting_id: string | null;
          reschedule_of: string | null;
          start_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          booking_page_id: string;
          cancellation_reason?: string | null;
          client_id?: string | null;
          conferencing_provider?: string | null;
          conferencing_url?: string | null;
          created_at?: string;
          end_at: string;
          event_type_id: string;
          google_event_id?: string | null;
          host_attention_reason?: string | null;
          id?: string;
          invitee_email: string;
          invitee_name: string;
          invitee_notes?: string | null;
          invitee_timezone: string;
          management_token?: string;
          needs_host_attention?: boolean;
          provider_meeting_id?: string | null;
          reschedule_of?: string | null;
          start_at: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          booking_page_id?: string;
          cancellation_reason?: string | null;
          client_id?: string | null;
          conferencing_provider?: string | null;
          conferencing_url?: string | null;
          created_at?: string;
          end_at?: string;
          event_type_id?: string;
          google_event_id?: string | null;
          host_attention_reason?: string | null;
          id?: string;
          invitee_email?: string;
          invitee_name?: string;
          invitee_notes?: string | null;
          invitee_timezone?: string;
          management_token?: string;
          needs_host_attention?: boolean;
          provider_meeting_id?: string | null;
          reschedule_of?: string | null;
          start_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_booking_page_id_fkey';
            columns: ['booking_page_id'];
            isOneToOne: false;
            referencedRelation: 'booking_pages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_event_type_id_fkey';
            columns: ['event_type_id'];
            isOneToOne: false;
            referencedRelation: 'event_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_reschedule_of_fkey';
            columns: ['reschedule_of'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
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
          client_org_id: string | null;
          created_at: string;
          created_by: string;
          id: string;
          last_message_at: string;
          project_id: string | null;
          title: string | null;
          type: Database['public']['Enums']['chat_thread_type'];
          updated_at: string;
        };
        Insert: {
          account_id: string;
          client_org_id?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          last_message_at?: string;
          project_id?: string | null;
          title?: string | null;
          type: Database['public']['Enums']['chat_thread_type'];
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          client_org_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          last_message_at?: string;
          project_id?: string | null;
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
            foreignKeyName: 'chat_threads_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_threads_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      client_contacts: {
        Row: {
          client_id: string;
          contact_id: string;
          created_at: string | null;
          id: string;
          is_primary: boolean;
          role: string | null;
          updated_at: string | null;
        };
        Insert: {
          client_id: string;
          contact_id: string;
          created_at?: string | null;
          id?: string;
          is_primary?: boolean;
          role?: string | null;
          updated_at?: string | null;
        };
        Update: {
          client_id?: string;
          contact_id?: string;
          created_at?: string | null;
          id?: string;
          is_primary?: boolean;
          role?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_contacts_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_contacts_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
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
          support_public_token: string | null;
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
          support_public_token?: string | null;
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
          support_public_token?: string | null;
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
      client_portal_invites: {
        Row: {
          accepted_at: string | null;
          account_id: string;
          client_id: string;
          client_org_id: string;
          contact_id: string | null;
          created_at: string;
          id: string;
          invite_token: string;
          invited_by: string;
          invited_email: string;
          role: string;
          status: string;
          user_id: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          account_id: string;
          client_id: string;
          client_org_id: string;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          invite_token?: string;
          invited_by: string;
          invited_email: string;
          role?: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          account_id?: string;
          client_id?: string;
          client_org_id?: string;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          invite_token?: string;
          invited_by?: string;
          invited_email?: string;
          role?: string;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_portal_invites_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_portal_invites_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_portal_invites_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_portal_invites_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_portal_invites_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_portal_invites_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
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
          account_id: string | null;
          billing_day: number | null;
          business_id: string | null;
          cancelled_at: string | null;
          client_id: string | null;
          client_org_id: string | null;
          created_at: string;
          currency: string;
          current_period_end: string | null;
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
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_customer_id_connect: string | null;
          stripe_payment_link: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          subscription_kind: string | null;
          updated_at: string;
          website_id: string | null;
        };
        Insert: {
          account_id?: string | null;
          billing_day?: number | null;
          business_id?: string | null;
          cancelled_at?: string | null;
          client_id?: string | null;
          client_org_id?: string | null;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
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
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_customer_id_connect?: string | null;
          stripe_payment_link?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_kind?: string | null;
          updated_at?: string;
          website_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          billing_day?: number | null;
          business_id?: string | null;
          cancelled_at?: string | null;
          client_id?: string | null;
          client_org_id?: string | null;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
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
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_customer_id_connect?: string | null;
          stripe_payment_link?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_kind?: string | null;
          updated_at?: string;
          website_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_subscriptions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_subscriptions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_subscriptions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_subscriptions_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_subscriptions_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
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
      client_workspace_shares: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          can_contacts: boolean;
          can_docs: boolean;
          can_finance: boolean;
          can_portal: boolean;
          can_projects: boolean;
          can_support: boolean;
          client_id: string | null;
          client_org_id: string;
          created_at: string;
          expires_at: string | null;
          guest_account_id: string | null;
          id: string;
          invite_token: string;
          invited_by: string | null;
          invited_email: string | null;
          owner_account_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          can_contacts?: boolean;
          can_docs?: boolean;
          can_finance?: boolean;
          can_portal?: boolean;
          can_projects?: boolean;
          can_support?: boolean;
          client_id?: string | null;
          client_org_id: string;
          created_at?: string;
          expires_at?: string | null;
          guest_account_id?: string | null;
          id?: string;
          invite_token: string;
          invited_by?: string | null;
          invited_email?: string | null;
          owner_account_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          can_contacts?: boolean;
          can_docs?: boolean;
          can_finance?: boolean;
          can_portal?: boolean;
          can_projects?: boolean;
          can_support?: boolean;
          client_id?: string | null;
          client_org_id?: string;
          created_at?: string;
          expires_at?: string | null;
          guest_account_id?: string | null;
          id?: string;
          invite_token?: string;
          invited_by?: string | null;
          invited_email?: string | null;
          owner_account_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'client_workspace_shares_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_workspace_shares_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_workspace_shares_guest_account_id_fkey';
            columns: ['guest_account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_workspace_shares_guest_account_id_fkey';
            columns: ['guest_account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_workspace_shares_guest_account_id_fkey';
            columns: ['guest_account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_workspace_shares_owner_account_id_fkey';
            columns: ['owner_account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_workspace_shares_owner_account_id_fkey';
            columns: ['owner_account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_workspace_shares_owner_account_id_fkey';
            columns: ['owner_account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      clients: {
        Row: {
          account_id: string;
          address_line_1: string | null;
          address_line_2: string | null;
          archived_at: string | null;
          city: string | null;
          client_org_id: string | null;
          client_type: string | null;
          commercial_role: string | null;
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
          picture_url: string | null;
          postcode: string | null;
          project_id: string | null;
          stripe_customer_id_connect: string | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          account_id: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          archived_at?: string | null;
          city?: string | null;
          client_org_id?: string | null;
          client_type?: string | null;
          commercial_role?: string | null;
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
          picture_url?: string | null;
          postcode?: string | null;
          project_id?: string | null;
          stripe_customer_id_connect?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          account_id?: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          archived_at?: string | null;
          city?: string | null;
          client_org_id?: string | null;
          client_type?: string | null;
          commercial_role?: string | null;
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
          picture_url?: string | null;
          postcode?: string | null;
          project_id?: string | null;
          stripe_customer_id_connect?: string | null;
          updated_at?: string | null;
          website?: string | null;
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
          {
            foreignKeyName: 'clients_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_enquiries: {
        Row: {
          account_id: string;
          areas_text: string | null;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          external_ref: string | null;
          id: string;
          listing_id: string | null;
          match_id: string | null;
          message: string | null;
          property_types: string | null;
          received_at: string;
          requirement_id: string | null;
          source: string;
          status: string;
          target_size_max_sqft: number | null;
          target_size_min_sqft: number | null;
          tenure: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          areas_text?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          external_ref?: string | null;
          id?: string;
          listing_id?: string | null;
          match_id?: string | null;
          message?: string | null;
          property_types?: string | null;
          received_at?: string;
          requirement_id?: string | null;
          source?: string;
          status?: string;
          target_size_max_sqft?: number | null;
          target_size_min_sqft?: number | null;
          tenure?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          areas_text?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          external_ref?: string | null;
          id?: string;
          listing_id?: string | null;
          match_id?: string | null;
          message?: string | null;
          property_types?: string | null;
          received_at?: string;
          requirement_id?: string | null;
          source?: string;
          status?: string;
          target_size_max_sqft?: number | null;
          target_size_min_sqft?: number | null;
          tenure?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_enquiries_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_enquiries_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_enquiries_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_enquiries_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_listings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_enquiries_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_enquiries_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_leases: {
        Row: {
          account_id: string;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          headline_rent_psf: number | null;
          id: string;
          lease_end: string | null;
          lease_start: string | null;
          listing_id: string | null;
          notes: string | null;
          postcode: string | null;
          property_label: string;
          status: string;
          tenant_name: string | null;
          town: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          headline_rent_psf?: number | null;
          id?: string;
          lease_end?: string | null;
          lease_start?: string | null;
          listing_id?: string | null;
          notes?: string | null;
          postcode?: string | null;
          property_label: string;
          status?: string;
          tenant_name?: string | null;
          town?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          headline_rent_psf?: number | null;
          id?: string;
          lease_end?: string | null;
          lease_start?: string | null;
          listing_id?: string | null;
          notes?: string | null;
          postcode?: string | null;
          property_label?: string;
          status?: string;
          tenant_name?: string | null;
          town?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_leases_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_leases_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_leases_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_leases_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_leases_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_listings';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_listing_agents: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          listing_id: string;
          sort_order: number;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          listing_id: string;
          sort_order?: number;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          listing_id?: string;
          sort_order?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_listing_agents_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listing_agents_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listing_agents_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listing_agents_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_listings';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_listing_media: {
        Row: {
          account_id: string;
          created_at: string;
          external_url: string | null;
          file_name: string | null;
          id: string;
          is_cover: boolean;
          listing_id: string;
          media_type: string;
          mime_type: string | null;
          sort_order: number;
          storage_path: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          external_url?: string | null;
          file_name?: string | null;
          id?: string;
          is_cover?: boolean;
          listing_id: string;
          media_type?: string;
          mime_type?: string | null;
          sort_order?: number;
          storage_path?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          external_url?: string | null;
          file_name?: string | null;
          id?: string;
          is_cover?: boolean;
          listing_id?: string;
          media_type?: string;
          mime_type?: string | null;
          sort_order?: number;
          storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_listing_media_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listing_media_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listing_media_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listing_media_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_listings';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_listing_units: {
        Row: {
          account_id: string;
          created_at: string;
          external_id: string | null;
          floor_or_unit: string | null;
          id: string;
          label: string;
          listing_id: string;
          measurement_standard: string | null;
          size_sqft: number | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          external_id?: string | null;
          floor_or_unit?: string | null;
          id?: string;
          label: string;
          listing_id: string;
          measurement_standard?: string | null;
          size_sqft?: number | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          external_id?: string | null;
          floor_or_unit?: string | null;
          id?: string;
          label?: string;
          listing_id?: string;
          measurement_standard?: string | null;
          size_sqft?: number | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_listing_units_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listing_units_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listing_units_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listing_units_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_listings';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_listings: {
        Row: {
          account_id: string;
          address_line_1: string | null;
          address_line_2: string | null;
          asking_price_pence: number | null;
          asking_rent_pence: number | null;
          assigned_to: string | null;
          available_from: string | null;
          country: string | null;
          county: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          disposal_type: string;
          epc_band: string | null;
          epc_rating: number | null;
          external_id: string | null;
          hide_rent_from_marketing: boolean;
          id: string;
          instructing_client_id: string | null;
          instruction_nature: string | null;
          key_points: Json;
          landlord_share_enabled: boolean;
          landlord_share_token: string | null;
          latitude: number | null;
          location_copy: string | null;
          longitude: number | null;
          measurement_standard: string | null;
          name: string;
          notes: string | null;
          off_market_at: string | null;
          on_market_at: string | null;
          pa_user_id: string | null;
          postcode: string | null;
          record_owner_user_id: string | null;
          rent_frequency: string | null;
          sector: string | null;
          size_max_sqft: number | null;
          size_min_sqft: number | null;
          status: string;
          summary: string | null;
          team_id: string | null;
          tenure: string | null;
          town: string | null;
          updated_at: string;
          use_class: string | null;
        };
        Insert: {
          account_id: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          asking_price_pence?: number | null;
          asking_rent_pence?: number | null;
          assigned_to?: string | null;
          available_from?: string | null;
          country?: string | null;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          disposal_type?: string;
          epc_band?: string | null;
          epc_rating?: number | null;
          external_id?: string | null;
          hide_rent_from_marketing?: boolean;
          id?: string;
          instructing_client_id?: string | null;
          instruction_nature?: string | null;
          key_points?: Json;
          landlord_share_enabled?: boolean;
          landlord_share_token?: string | null;
          latitude?: number | null;
          location_copy?: string | null;
          longitude?: number | null;
          measurement_standard?: string | null;
          name: string;
          notes?: string | null;
          off_market_at?: string | null;
          on_market_at?: string | null;
          pa_user_id?: string | null;
          postcode?: string | null;
          record_owner_user_id?: string | null;
          rent_frequency?: string | null;
          sector?: string | null;
          size_max_sqft?: number | null;
          size_min_sqft?: number | null;
          status?: string;
          summary?: string | null;
          team_id?: string | null;
          tenure?: string | null;
          town?: string | null;
          updated_at?: string;
          use_class?: string | null;
        };
        Update: {
          account_id?: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          asking_price_pence?: number | null;
          asking_rent_pence?: number | null;
          assigned_to?: string | null;
          available_from?: string | null;
          country?: string | null;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          disposal_type?: string;
          epc_band?: string | null;
          epc_rating?: number | null;
          external_id?: string | null;
          hide_rent_from_marketing?: boolean;
          id?: string;
          instructing_client_id?: string | null;
          instruction_nature?: string | null;
          key_points?: Json;
          landlord_share_enabled?: boolean;
          landlord_share_token?: string | null;
          latitude?: number | null;
          location_copy?: string | null;
          longitude?: number | null;
          measurement_standard?: string | null;
          name?: string;
          notes?: string | null;
          off_market_at?: string | null;
          on_market_at?: string | null;
          pa_user_id?: string | null;
          postcode?: string | null;
          record_owner_user_id?: string | null;
          rent_frequency?: string | null;
          sector?: string | null;
          size_max_sqft?: number | null;
          size_min_sqft?: number | null;
          status?: string;
          summary?: string | null;
          team_id?: string | null;
          tenure?: string | null;
          town?: string | null;
          updated_at?: string;
          use_class?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_listings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listings_instructing_client_id_fkey';
            columns: ['instructing_client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_listings_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_workspace_teams';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_matches: {
        Row: {
          account_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          last_activity_at: string;
          listing_id: string;
          notes: string | null;
          requirement_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_activity_at?: string;
          listing_id: string;
          notes?: string | null;
          requirement_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_activity_at?: string;
          listing_id?: string;
          notes?: string | null;
          requirement_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_matches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_matches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_matches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_matches_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_listings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_matches_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_portal_credentials: {
        Row: {
          account_id: string;
          branch_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          network_id: string | null;
          office_id: string | null;
          portal: string;
          secret_ciphertext: string | null;
          site_url: string | null;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          account_id: string;
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          network_id?: string | null;
          office_id?: string | null;
          portal: string;
          secret_ciphertext?: string | null;
          site_url?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          account_id?: string;
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          network_id?: string | null;
          office_id?: string | null;
          portal?: string;
          secret_ciphertext?: string | null;
          site_url?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_portal_credentials_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_portal_credentials_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_portal_credentials_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_portal_publications: {
        Row: {
          account_id: string;
          branch_ref: string | null;
          created_at: string;
          external_id: string | null;
          external_url: string | null;
          id: string;
          last_error: string | null;
          last_sync_at: string | null;
          listing_id: string;
          metadata: Json;
          portal: string;
          published_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          branch_ref?: string | null;
          created_at?: string;
          external_id?: string | null;
          external_url?: string | null;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          listing_id: string;
          metadata?: Json;
          portal: string;
          published_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          branch_ref?: string | null;
          created_at?: string;
          external_id?: string | null;
          external_url?: string | null;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          listing_id?: string;
          metadata?: Json;
          portal?: string;
          published_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_portal_publications_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_portal_publications_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_portal_publications_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_portal_publications_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_listings';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_requirements: {
        Row: {
          account_id: string;
          assigned_to: string | null;
          budget_max_pence: number | null;
          budget_min_pence: number | null;
          client_id: string | null;
          company_name: string | null;
          contact_email: string | null;
          contact_id: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          location_text: string | null;
          notes: string | null;
          sector: string | null;
          size_max_sqft: number | null;
          size_min_sqft: number | null;
          source: string | null;
          stage: string;
          tenure: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          assigned_to?: string | null;
          budget_max_pence?: number | null;
          budget_min_pence?: number | null;
          client_id?: string | null;
          company_name?: string | null;
          contact_email?: string | null;
          contact_id?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_text?: string | null;
          notes?: string | null;
          sector?: string | null;
          size_max_sqft?: number | null;
          size_min_sqft?: number | null;
          source?: string | null;
          stage?: string;
          tenure?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          assigned_to?: string | null;
          budget_max_pence?: number | null;
          budget_min_pence?: number | null;
          client_id?: string | null;
          company_name?: string | null;
          contact_email?: string | null;
          contact_id?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_text?: string | null;
          notes?: string | null;
          sector?: string | null;
          size_max_sqft?: number | null;
          size_min_sqft?: number | null;
          source?: string | null;
          stage?: string;
          tenure?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_requirements_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_requirements_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_requirements_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_requirements_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_requirements_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_viewings: {
        Row: {
          account_id: string;
          client_id: string | null;
          conducted_by: string | null;
          contact_id: string | null;
          created_at: string;
          created_by: string | null;
          enquiry_id: string | null;
          feedback: string | null;
          id: string;
          listing_id: string;
          outcome: string | null;
          requirement_id: string | null;
          scheduled_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          client_id?: string | null;
          conducted_by?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          enquiry_id?: string | null;
          feedback?: string | null;
          id?: string;
          listing_id: string;
          outcome?: string | null;
          requirement_id?: string | null;
          scheduled_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          client_id?: string | null;
          conducted_by?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          enquiry_id?: string | null;
          feedback?: string | null;
          id?: string;
          listing_id?: string;
          outcome?: string | null;
          requirement_id?: string | null;
          scheduled_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_viewings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_viewings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_viewings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_viewings_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_viewings_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_viewings_enquiry_id_fkey';
            columns: ['enquiry_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_enquiries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_viewings_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_listings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_viewings_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      commercial_workspace_teams: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commercial_workspace_teams_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_workspace_teams_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commercial_workspace_teams_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
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
      conferencing_connections: {
        Row: {
          access_token: string;
          account_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          provider: string;
          provider_account_email: string | null;
          refresh_token: string | null;
          updated_at: string;
        };
        Insert: {
          access_token: string;
          account_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          provider: string;
          provider_account_email?: string | null;
          refresh_token?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          account_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          provider?: string;
          provider_account_email?: string | null;
          refresh_token?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conferencing_connections_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conferencing_connections_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conferencing_connections_account_id_fkey';
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
      connect_webhook_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          processed_at: string;
          stripe_account_id: string | null;
          stripe_event_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          processed_at?: string;
          stripe_account_id?: string | null;
          stripe_event_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          processed_at?: string;
          stripe_account_id?: string | null;
          stripe_event_id?: string;
        };
        Relationships: [];
      };
      contact_email_addresses: {
        Row: {
          account_id: string;
          contact_id: string;
          created_at: string;
          email: string;
          id: string;
          is_primary: boolean;
          label: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          contact_id: string;
          created_at?: string;
          email: string;
          id?: string;
          is_primary?: boolean;
          label?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          contact_id?: string;
          created_at?: string;
          email?: string;
          id?: string;
          is_primary?: boolean;
          label?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_email_addresses_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_email_addresses_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_email_addresses_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_email_addresses_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
        ];
      };
      contacts: {
        Row: {
          account_id: string | null;
          client_id: string | null;
          client_org_id: string | null;
          created_at: string | null;
          email: string | null;
          first_name: string | null;
          full_name: string;
          id: string;
          is_primary: boolean;
          last_name: string | null;
          notes: string | null;
          phone: string | null;
          picture_url: string | null;
          role: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          account_id?: string | null;
          client_id?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          first_name?: string | null;
          full_name: string;
          id?: string;
          is_primary?: boolean;
          last_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          picture_url?: string | null;
          role?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          client_id?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          first_name?: string | null;
          full_name?: string;
          id?: string;
          is_primary?: boolean;
          last_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          picture_url?: string | null;
          role?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contacts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contacts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
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
      content_templates: {
        Row: {
          body_html: string;
          body_text: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          kind: string;
          name: string;
          signature: string | null;
          slug: string;
          sort_order: number;
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          body_html?: string;
          body_text?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          kind: string;
          name: string;
          signature?: string | null;
          slug: string;
          sort_order?: number;
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          body_html?: string;
          body_text?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name?: string;
          signature?: string | null;
          slug?: string;
          sort_order?: number;
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [];
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
          financial_year: string | null;
          id: string;
          is_pinned: boolean;
          is_public: boolean;
          kind: string;
          mime_type: string | null;
          phase_id: string | null;
          project_id: string | null;
          property_id: string | null;
          public_enabled_at: string | null;
          public_token: string | null;
          source: string | null;
          storage_bucket: string;
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
          financial_year?: string | null;
          id?: string;
          is_pinned?: boolean;
          is_public?: boolean;
          kind?: string;
          mime_type?: string | null;
          phase_id?: string | null;
          project_id?: string | null;
          property_id?: string | null;
          public_enabled_at?: string | null;
          public_token?: string | null;
          source?: string | null;
          storage_bucket?: string;
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
          financial_year?: string | null;
          id?: string;
          is_pinned?: boolean;
          is_public?: boolean;
          kind?: string;
          mime_type?: string | null;
          phase_id?: string | null;
          project_id?: string | null;
          property_id?: string | null;
          public_enabled_at?: string | null;
          public_token?: string | null;
          source?: string | null;
          storage_bucket?: string;
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
          account_id: string | null;
          assignee_confidence: number | null;
          client_id: string | null;
          created_at: string;
          detail: string | null;
          id: string;
          message_id: string | null;
          project_id: string | null;
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
          account_id?: string | null;
          assignee_confidence?: number | null;
          client_id?: string | null;
          created_at?: string;
          detail?: string | null;
          id?: string;
          message_id?: string | null;
          project_id?: string | null;
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
          account_id?: string | null;
          assignee_confidence?: number | null;
          client_id?: string | null;
          created_at?: string;
          detail?: string | null;
          id?: string;
          message_id?: string | null;
          project_id?: string | null;
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
            foreignKeyName: 'email_action_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_action_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_action_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_action_items_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_action_items_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'email_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_action_items_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
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
          connection_id: string;
          created_at: string;
          ignored_domains: string[];
          ignored_senders: string[];
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
          connection_id: string;
          created_at?: string;
          ignored_domains?: string[];
          ignored_senders?: string[];
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
          connection_id?: string;
          created_at?: string;
          ignored_domains?: string[];
          ignored_senders?: string[];
          last_history_id?: string | null;
          last_synced_at?: string | null;
          signature?: string | null;
          signature_is_html?: boolean;
          style_notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_assistant_settings_connection_id_fkey';
            columns: ['connection_id'];
            isOneToOne: true;
            referencedRelation: 'google_connections';
            referencedColumns: ['id'];
          },
        ];
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
      email_events: {
        Row: {
          clicked_url: string | null;
          email: string;
          email_reference: string | null;
          event_type: string;
          id: string;
          occurred_at: string;
          raw_event: Json | null;
          subject: string | null;
          user_agent: string | null;
        };
        Insert: {
          clicked_url?: string | null;
          email: string;
          email_reference?: string | null;
          event_type: string;
          id?: string;
          occurred_at?: string;
          raw_event?: Json | null;
          subject?: string | null;
          user_agent?: string | null;
        };
        Update: {
          clicked_url?: string | null;
          email?: string;
          email_reference?: string | null;
          event_type?: string;
          id?: string;
          occurred_at?: string;
          raw_event?: Json | null;
          subject?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      email_messages: {
        Row: {
          body_html: string | null;
          body_text: string | null;
          cc_addresses: string[] | null;
          connection_id: string | null;
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
          connection_id?: string | null;
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
          connection_id?: string | null;
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
            foreignKeyName: 'email_messages_connection_id_fkey';
            columns: ['connection_id'];
            isOneToOne: false;
            referencedRelation: 'google_connections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'email_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      email_suppressions: {
        Row: {
          bounce_subtype: string | null;
          bounce_type: string | null;
          complaint_type: string | null;
          email: string;
          id: string;
          raw_notification: Json | null;
          reason: string;
          suppressed_at: string;
        };
        Insert: {
          bounce_subtype?: string | null;
          bounce_type?: string | null;
          complaint_type?: string | null;
          email: string;
          id?: string;
          raw_notification?: Json | null;
          reason: string;
          suppressed_at?: string;
        };
        Update: {
          bounce_subtype?: string | null;
          bounce_type?: string | null;
          complaint_type?: string | null;
          email?: string;
          id?: string;
          raw_notification?: Json | null;
          reason?: string;
          suppressed_at?: string;
        };
        Relationships: [];
      };
      email_threads: {
        Row: {
          account_id: string | null;
          assistant_category: string | null;
          assistant_category_reason: string | null;
          assistant_processed_message_id: string | null;
          client_id: string | null;
          connection_id: string | null;
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
          connection_id?: string | null;
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
          connection_id?: string | null;
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
            foreignKeyName: 'email_threads_connection_id_fkey';
            columns: ['connection_id'];
            isOneToOne: false;
            referencedRelation: 'google_connections';
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
      event_types: {
        Row: {
          allow_guest_invites: boolean;
          availability_schedule_id: string;
          booking_page_id: string;
          booking_window_days: number;
          buffer_after_minutes: number;
          buffer_before_minutes: number;
          created_at: string;
          default_duration: number;
          description: string | null;
          durations: number[];
          id: string;
          is_active: boolean;
          is_private: boolean;
          location_detail: string | null;
          location_type: string;
          max_bookings_per_day: number | null;
          minimum_notice_minutes: number;
          name: string;
          slot_increment_minutes: number;
          slug: string;
          updated_at: string;
        };
        Insert: {
          allow_guest_invites?: boolean;
          availability_schedule_id: string;
          booking_page_id: string;
          booking_window_days?: number;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          created_at?: string;
          default_duration?: number;
          description?: string | null;
          durations?: number[];
          id?: string;
          is_active?: boolean;
          is_private?: boolean;
          location_detail?: string | null;
          location_type?: string;
          max_bookings_per_day?: number | null;
          minimum_notice_minutes?: number;
          name: string;
          slot_increment_minutes?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          allow_guest_invites?: boolean;
          availability_schedule_id?: string;
          booking_page_id?: string;
          booking_window_days?: number;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          created_at?: string;
          default_duration?: number;
          description?: string | null;
          durations?: number[];
          id?: string;
          is_active?: boolean;
          is_private?: boolean;
          location_detail?: string | null;
          location_type?: string;
          max_bookings_per_day?: number | null;
          minimum_notice_minutes?: number;
          name?: string;
          slot_increment_minutes?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_types_availability_schedule_id_fkey';
            columns: ['availability_schedule_id'];
            isOneToOne: false;
            referencedRelation: 'availability_schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_types_booking_page_id_fkey';
            columns: ['booking_page_id'];
            isOneToOne: false;
            referencedRelation: 'booking_pages';
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
      family_recipe_ingredients: {
        Row: {
          amount: number | null;
          created_at: string;
          id: string;
          name: string;
          original_text: string;
          recipe_id: string;
          sort_order: number;
          unit: string | null;
          updated_at: string;
        }
        Insert: {
          amount?: number | null;
          created_at?: string;
          id?: string;
          name: string;
          original_text: string;
          recipe_id: string;
          sort_order?: number;
          unit?: string | null;
          updated_at?: string;
        }
        Update: {
          amount?: number | null;
          created_at?: string;
          id?: string;
          name?: string;
          original_text?: string;
          recipe_id?: string;
          sort_order?: number;
          unit?: string | null;
          updated_at?: string;
        }
        Relationships: [
          {
            foreignKeyName: "family_recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "family_recipes";
            referencedColumns: ["id"];
          },
        ];
      },
      family_recipe_logs: {
        Row: {
          cooked_at: string;
          created_at: string;
          id: string;
          logged_by: string;
          notes: string | null;
          rating: number | null;
          recipe_id: string;
        }
        Insert: {
          cooked_at?: string;
          created_at?: string;
          id?: string;
          logged_by?: string;
          notes?: string | null;
          rating?: number | null;
          recipe_id: string;
        }
        Update: {
          cooked_at?: string;
          created_at?: string;
          id?: string;
          logged_by?: string;
          notes?: string | null;
          rating?: number | null;
          recipe_id?: string;
        }
        Relationships: [
          {
            foreignKeyName: "family_recipe_logs_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "family_recipes";
            referencedColumns: ["id"];
          },
        ];
      },
      family_recipe_step_ingredients: {
        Row: {
          ingredient_id: string;
          quantity_multiplier: number;
          step_id: string;
        }
        Insert: {
          ingredient_id: string;
          quantity_multiplier?: number;
          step_id: string;
        }
        Update: {
          ingredient_id?: string;
          quantity_multiplier?: number;
          step_id?: string;
        }
        Relationships: [
          {
            foreignKeyName: "family_recipe_step_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "family_recipe_ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_recipe_step_ingredients_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "family_recipe_steps";
            referencedColumns: ["id"];
          },
        ];
      },
      family_recipe_steps: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          recipe_id: string;
          sort_order: number;
          timer_seconds: number | null;
          title: string;
          updated_at: string;
        }
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          recipe_id: string;
          sort_order: number;
          timer_seconds?: number | null;
          title: string;
          updated_at?: string;
        }
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          recipe_id?: string;
          sort_order?: number;
          timer_seconds?: number | null;
          title?: string;
          updated_at?: string;
        }
        Relationships: [
          {
            foreignKeyName: "family_recipe_steps_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "family_recipes";
            referencedColumns: ["id"];
          },
        ];
      },
      family_recipes: {
        Row: {
          account_id: string | null;
          calories_per_serving: number | null;
          carbs_g: number | null;
          cook_minutes: number | null;
          created_at: string;
          description: string | null;
          diet_tags: string[];
          fat_g: number | null;
          id: string;
          ingredients: string[];
          instructions: string | null;
          is_favorite: boolean;
          meal_type: string;
          name: string;
          nutrition_computed_at: string | null;
          nutrition_pending: boolean;
          prep_ingredients_hash: string | null;
          prep_minutes: number | null;
          protein_g: number | null;
          servings: number | null;
          source: string;
          tags: string[];
          updated_at: string;
          user_id: string;
        }
        Insert: {
          account_id?: string | null;
          calories_per_serving?: number | null;
          carbs_g?: number | null;
          cook_minutes?: number | null;
          created_at?: string;
          description?: string | null;
          diet_tags?: string[];
          fat_g?: number | null;
          id?: string;
          ingredients?: string[];
          instructions?: string | null;
          is_favorite?: boolean;
          meal_type?: string;
          name: string;
          nutrition_computed_at?: string | null;
          nutrition_pending?: boolean;
          prep_ingredients_hash?: string | null;
          prep_minutes?: number | null;
          protein_g?: number | null;
          servings?: number | null;
          source?: string;
          tags?: string[];
          updated_at?: string;
          user_id: string;
        }
        Update: {
          account_id?: string | null;
          calories_per_serving?: number | null;
          carbs_g?: number | null;
          cook_minutes?: number | null;
          created_at?: string;
          description?: string | null;
          diet_tags?: string[];
          fat_g?: number | null;
          id?: string;
          ingredients?: string[];
          instructions?: string | null;
          is_favorite?: boolean;
          meal_type?: string;
          name?: string;
          nutrition_computed_at?: string | null;
          nutrition_pending?: boolean;
          prep_ingredients_hash?: string | null;
          prep_minutes?: number | null;
          protein_g?: number | null;
          servings?: number | null;
          source?: string;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        }
        Relationships: [
          {
            foreignKeyName: "family_recipes_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_recipes_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "user_account_workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_recipes_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "user_accounts";
            referencedColumns: ["id"];
          },
        ];
      },
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
          starling_account_uid: string | null;
          starling_category_uid: string | null;
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
          starling_account_uid?: string | null;
          starling_category_uid?: string | null;
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
          starling_account_uid?: string | null;
          starling_category_uid?: string | null;
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
          access_token: string | null;
          access_token_encrypted: string | null;
          account_id: string;
          connected_by: string | null;
          created_at: string;
          freeagent_company_name: string | null;
          freeagent_company_url: string | null;
          id: string;
          last_sync_at: string | null;
          provider: string;
          refresh_token: string | null;
          refresh_token_encrypted: string | null;
          sync_state: Json;
          token_expires_at: string;
          updated_at: string;
        };
        Insert: {
          access_token?: string | null;
          access_token_encrypted?: string | null;
          account_id: string;
          connected_by?: string | null;
          created_at?: string;
          freeagent_company_name?: string | null;
          freeagent_company_url?: string | null;
          id?: string;
          last_sync_at?: string | null;
          provider?: string;
          refresh_token?: string | null;
          refresh_token_encrypted?: string | null;
          sync_state?: Json;
          token_expires_at: string;
          updated_at?: string;
        };
        Update: {
          access_token?: string | null;
          access_token_encrypted?: string | null;
          account_id?: string;
          connected_by?: string | null;
          created_at?: string;
          freeagent_company_name?: string | null;
          freeagent_company_url?: string | null;
          id?: string;
          last_sync_at?: string | null;
          provider?: string;
          refresh_token?: string | null;
          refresh_token_encrypted?: string | null;
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
          client_id: string | null;
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
          notes: string | null;
          project_id: string | null;
          property_id: string | null;
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
          client_id?: string | null;
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
          notes?: string | null;
          project_id?: string | null;
          property_id?: string | null;
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
          client_id?: string | null;
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
          notes?: string | null;
          project_id?: string | null;
          property_id?: string | null;
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
            foreignKeyName: 'finance_transactions_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_transactions_import_batch_id_fkey';
            columns: ['import_batch_id'];
            isOneToOne: false;
            referencedRelation: 'finance_import_batches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_transactions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'finance_transactions_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
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
          google_account_email: string | null;
          google_account_sub: string;
          id: string;
          is_primary: boolean;
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
          google_account_email?: string | null;
          google_account_sub: string;
          id?: string;
          is_primary?: boolean;
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
          google_account_email?: string | null;
          google_account_sub?: string;
          id?: string;
          is_primary?: boolean;
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
          id: string;
          mailbox_kind: string;
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
          id?: string;
          mailbox_kind?: string;
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
          id?: string;
          mailbox_kind?: string;
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
          project_id: string | null;
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
          project_id?: string | null;
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
          project_id?: string | null;
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
            foreignKeyName: 'invitations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
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
          line_type: string;
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
          line_type?: string;
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
          line_type?: string;
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
          due_days: number;
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
          due_days?: number;
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
          due_days?: number;
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
          project_id: string | null;
          public_token: string | null;
          read_at: string | null;
          recurring_series_id: string | null;
          reference_number: string | null;
          scheduled_send_at: string | null;
          scheduled_send_processing_at: string | null;
          scheduled_send_to_emails: string[] | null;
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
          project_id?: string | null;
          public_token?: string | null;
          read_at?: string | null;
          recurring_series_id?: string | null;
          reference_number?: string | null;
          scheduled_send_at?: string | null;
          scheduled_send_processing_at?: string | null;
          scheduled_send_to_emails?: string[] | null;
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
          project_id?: string | null;
          public_token?: string | null;
          read_at?: string | null;
          recurring_series_id?: string | null;
          reference_number?: string | null;
          scheduled_send_at?: string | null;
          scheduled_send_processing_at?: string | null;
          scheduled_send_to_emails?: string[] | null;
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
            foreignKeyName: 'invoices_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
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
      launch_interest: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          interests: string[];
          source: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          interests?: string[];
          source?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          interests?: string[];
          source?: string;
        };
        Relationships: [];
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
      media_credit_batches: {
        Row: {
          account_id: string;
          created_at: string;
          expires_at: string;
          granted_at: string;
          id: string;
          source_type: string;
          stripe_event_id: string | null;
          swept_at: string | null;
          units_granted: number;
          units_remaining: number;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          expires_at: string;
          granted_at?: string;
          id?: string;
          source_type: string;
          stripe_event_id?: string | null;
          swept_at?: string | null;
          units_granted: number;
          units_remaining: number;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          expires_at?: string;
          granted_at?: string;
          id?: string;
          source_type?: string;
          stripe_event_id?: string | null;
          swept_at?: string | null;
          units_granted?: number;
          units_remaining?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'media_credit_batches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_credit_batches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_credit_batches_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      media_credit_pools: {
        Row: {
          account_id: string;
          balance: number;
          created_at: string;
          cycle_end: string | null;
          cycle_start: string | null;
          monthly_allowance: number;
          plan_tier: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          balance?: number;
          created_at?: string;
          cycle_end?: string | null;
          cycle_start?: string | null;
          monthly_allowance?: number;
          plan_tier?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          balance?: number;
          created_at?: string;
          cycle_end?: string | null;
          cycle_start?: string | null;
          monthly_allowance?: number;
          plan_tier?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'media_credit_pools_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_credit_pools_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_credit_pools_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      media_credit_transactions: {
        Row: {
          account_id: string;
          amount: number;
          batch_id: string | null;
          created_at: string;
          id: string;
          reason: string | null;
          related_job_id: string | null;
          stripe_event_id: string | null;
          type: string;
        };
        Insert: {
          account_id: string;
          amount: number;
          batch_id?: string | null;
          created_at?: string;
          id?: string;
          reason?: string | null;
          related_job_id?: string | null;
          stripe_event_id?: string | null;
          type: string;
        };
        Update: {
          account_id?: string;
          amount?: number;
          batch_id?: string | null;
          created_at?: string;
          id?: string;
          reason?: string | null;
          related_job_id?: string | null;
          stripe_event_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_media_credit_transactions_related_job';
            columns: ['related_job_id'];
            isOneToOne: false;
            referencedRelation: 'media_generation_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_credit_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_credit_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_credit_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_credit_transactions_batch_id_fkey';
            columns: ['batch_id'];
            isOneToOne: false;
            referencedRelation: 'media_credit_batches';
            referencedColumns: ['id'];
          },
        ];
      };
      media_generation_jobs: {
        Row: {
          account_id: string;
          client_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          error_message: string | null;
          external_job_id: string | null;
          file_url: string | null;
          id: string;
          media_credits_charged: number | null;
          model_id: string;
          params: Json;
          project_id: string | null;
          promoted_from_job_id: string | null;
          prompt: string | null;
          provider: string;
          provider_cost_usd: number | null;
          refs: Json;
          status: string;
          thumbnail_url: string | null;
          type: string;
        };
        Insert: {
          account_id: string;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          error_message?: string | null;
          external_job_id?: string | null;
          file_url?: string | null;
          id?: string;
          media_credits_charged?: number | null;
          model_id: string;
          params?: Json;
          project_id?: string | null;
          promoted_from_job_id?: string | null;
          prompt?: string | null;
          provider: string;
          provider_cost_usd?: number | null;
          refs?: Json;
          status?: string;
          thumbnail_url?: string | null;
          type: string;
        };
        Update: {
          account_id?: string;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          error_message?: string | null;
          external_job_id?: string | null;
          file_url?: string | null;
          id?: string;
          media_credits_charged?: number | null;
          model_id?: string;
          params?: Json;
          project_id?: string | null;
          promoted_from_job_id?: string | null;
          prompt?: string | null;
          provider?: string;
          provider_cost_usd?: number | null;
          refs?: Json;
          status?: string;
          thumbnail_url?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'media_generation_jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_generation_jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_generation_jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_generation_jobs_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_generation_jobs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_generation_jobs_promoted_from_job_id_fkey';
            columns: ['promoted_from_job_id'];
            isOneToOne: false;
            referencedRelation: 'media_generation_jobs';
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
          meeting_transcript_id: string;
          planner_task_id: string | null;
          project_id: string | null;
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
          meeting_transcript_id: string;
          planner_task_id?: string | null;
          project_id?: string | null;
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
          meeting_transcript_id?: string;
          planner_task_id?: string | null;
          project_id?: string | null;
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
          {
            foreignKeyName: 'meeting_action_items_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
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
          project_id: string | null;
          public_share_enabled: boolean;
          public_share_show_tasks: boolean;
          public_share_token: string | null;
          recorded_at: string | null;
          source: string;
          speaker_mappings: Json;
          speaker_segments: Json | null;
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
          project_id?: string | null;
          public_share_enabled?: boolean;
          public_share_show_tasks?: boolean;
          public_share_token?: string | null;
          recorded_at?: string | null;
          source?: string;
          speaker_mappings?: Json;
          speaker_segments?: Json | null;
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
          project_id?: string | null;
          public_share_enabled?: boolean;
          public_share_show_tasks?: boolean;
          public_share_token?: string | null;
          recorded_at?: string | null;
          source?: string;
          speaker_mappings?: Json;
          speaker_segments?: Json | null;
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
          {
            foreignKeyName: 'meeting_transcripts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
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
      note_categories: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          label: string;
          slug: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          label: string;
          slug: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          label?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'note_categories_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'note_categories_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'note_categories_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      note_folders: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          name: string;
          parent_folder_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          name: string;
          parent_folder_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          parent_folder_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'note_folders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'note_folders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'note_folders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'note_folders_parent_folder_id_fkey';
            columns: ['parent_folder_id'];
            isOneToOne: false;
            referencedRelation: 'note_folders';
            referencedColumns: ['id'];
          },
        ];
      };
      notes: {
        Row: {
          account_id: string | null;
          area_id: string | null;
          assigned_to: string | null;
          category: string;
          client_id: string | null;
          client_org_id: string | null;
          commercial_requirement_id: string | null;
          content: string;
          created_at: string | null;
          created_by: string | null;
          folder_id: string | null;
          id: string;
          is_pinned: boolean;
          is_public: boolean;
          phase_id: string | null;
          pipeline_deal_id: string | null;
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
          assigned_to?: string | null;
          category?: string;
          client_id?: string | null;
          client_org_id?: string | null;
          commercial_requirement_id?: string | null;
          content: string;
          created_at?: string | null;
          created_by?: string | null;
          folder_id?: string | null;
          id?: string;
          is_pinned?: boolean;
          is_public?: boolean;
          phase_id?: string | null;
          pipeline_deal_id?: string | null;
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
          assigned_to?: string | null;
          category?: string;
          client_id?: string | null;
          client_org_id?: string | null;
          commercial_requirement_id?: string | null;
          content?: string;
          created_at?: string | null;
          created_by?: string | null;
          folder_id?: string | null;
          id?: string;
          is_pinned?: boolean;
          is_public?: boolean;
          phase_id?: string | null;
          pipeline_deal_id?: string | null;
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
            foreignKeyName: 'notes_commercial_requirement_id_fkey';
            columns: ['commercial_requirement_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_requirements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_folder_id_fkey';
            columns: ['folder_id'];
            isOneToOne: false;
            referencedRelation: 'note_folders';
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
            foreignKeyName: 'notes_pipeline_deal_id_fkey';
            columns: ['pipeline_deal_id'];
            isOneToOne: false;
            referencedRelation: 'pipeline_deals';
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
      notification_user_mutes: {
        Row: {
          created_at: string;
          notification_id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          notification_id: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          notification_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_user_mutes_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
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
          link: string | null;
          muted: boolean;
          type: Database['public']['Enums']['notification_type'];
        };
        Insert: {
          account_id: string;
          body: string;
          channel?: Database['public']['Enums']['notification_channel'];
          created_at?: string;
          dismissed?: boolean;
          expires_at?: string | null;
          id?: never;
          link?: string | null;
          muted?: boolean;
          type?: Database['public']['Enums']['notification_type'];
        };
        Update: {
          account_id?: string;
          body?: string;
          channel?: Database['public']['Enums']['notification_channel'];
          created_at?: string;
          dismissed?: boolean;
          expires_at?: string | null;
          id?: never;
          link?: string | null;
          muted?: boolean;
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
      pipeline_board_stage_settings: {
        Row: {
          account_id: string;
          board_name: string;
          stages: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          account_id: string;
          board_name?: string;
          stages?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          account_id?: string;
          board_name?: string;
          stages?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pipeline_board_stage_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pipeline_board_stage_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pipeline_board_stage_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      pipeline_deals: {
        Row: {
          account_id: string | null;
          business_id: string | null;
          client_id: string | null;
          client_org_id: string | null;
          commercial_listing_id: string | null;
          commercial_requirement_id: string | null;
          company_name: string | null;
          completed_at: string | null;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string | null;
          expected_close: string | null;
          hots_incentives: string | null;
          hots_lease_years: number | null;
          hots_notes: string | null;
          hots_rent_psf: number | null;
          hots_size_sqft: number | null;
          hots_solicitor_name: string | null;
          hots_target_exchange_date: string | null;
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
          work_type: string | null;
          updated_at: string | null;
          value: number | null;
          won_at: string | null;
        };
        Insert: {
          account_id?: string | null;
          business_id?: string | null;
          client_id?: string | null;
          client_org_id?: string | null;
          commercial_listing_id?: string | null;
          commercial_requirement_id?: string | null;
          company_name?: string | null;
          completed_at?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          expected_close?: string | null;
          hots_incentives?: string | null;
          hots_lease_years?: number | null;
          hots_notes?: string | null;
          hots_rent_psf?: number | null;
          hots_size_sqft?: number | null;
          hots_solicitor_name?: string | null;
          hots_target_exchange_date?: string | null;
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
          work_type?: string | null;
          updated_at?: string | null;
          value?: number | null;
          won_at?: string | null;
        };
        Update: {
          account_id?: string | null;
          business_id?: string | null;
          client_id?: string | null;
          client_org_id?: string | null;
          commercial_listing_id?: string | null;
          commercial_requirement_id?: string | null;
          company_name?: string | null;
          completed_at?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          expected_close?: string | null;
          hots_incentives?: string | null;
          hots_lease_years?: number | null;
          hots_notes?: string | null;
          hots_rent_psf?: number | null;
          hots_size_sqft?: number | null;
          hots_solicitor_name?: string | null;
          hots_target_exchange_date?: string | null;
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
          work_type?: string | null;
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
            foreignKeyName: 'pipeline_deals_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pipeline_deals_client_org_id_fkey';
            columns: ['client_org_id'];
            isOneToOne: false;
            referencedRelation: 'client_orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pipeline_deals_commercial_listing_id_fkey';
            columns: ['commercial_listing_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_listings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pipeline_deals_commercial_requirement_id_fkey';
            columns: ['commercial_requirement_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_templates: {
        Row: {
          account_id: string;
          active: boolean | null;
          amount: number | null;
          billing_interval: string | null;
          business_id: string;
          created_at: string;
          currency: string;
          description: string | null;
          features: Json | null;
          id: string;
          is_active: boolean;
          kind: string | null;
          monthly_amount: number;
          name: string;
          setup_fee: number;
          stripe_price_id: string | null;
          stripe_product_id: string | null;
          support_tickets_per_month: number | null;
          update_hours_per_month: number | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          active?: boolean | null;
          amount?: number | null;
          billing_interval?: string | null;
          business_id: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: Json | null;
          id?: string;
          is_active?: boolean;
          kind?: string | null;
          monthly_amount?: number;
          name: string;
          setup_fee?: number;
          stripe_price_id?: string | null;
          stripe_product_id?: string | null;
          support_tickets_per_month?: number | null;
          update_hours_per_month?: number | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          active?: boolean | null;
          amount?: number | null;
          billing_interval?: string | null;
          business_id?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: Json | null;
          id?: string;
          is_active?: boolean;
          kind?: string | null;
          monthly_amount?: number;
          name?: string;
          setup_fee?: number;
          stripe_price_id?: string | null;
          stripe_product_id?: string | null;
          support_tickets_per_month?: number | null;
          update_hours_per_month?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
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
      platform_operating_costs: {
        Row: {
          amount_minor: number;
          category: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          label: string;
          notes: string | null;
          period_month: string;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          category: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          label: string;
          notes?: string | null;
          period_month: string;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          label?: string;
          notes?: string | null;
          period_month?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_support_messages: {
        Row: {
          attachments: Json;
          author_user_id: string;
          body: string;
          created_at: string;
          id: string;
          is_internal_note: boolean;
          ticket_id: string;
        };
        Insert: {
          attachments?: Json;
          author_user_id: string;
          body: string;
          created_at?: string;
          id?: string;
          is_internal_note?: boolean;
          ticket_id: string;
        };
        Update: {
          attachments?: Json;
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
          attachments: Json;
          body: string;
          category: string;
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
          attachments?: Json;
          body: string;
          category?: string;
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
          attachments?: Json;
          body?: string;
          category?: string;
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
      portal_billing_invoice_cache: {
        Row: {
          account_id: string;
          created_at: string;
          fetched_at: string;
          id: string;
          invoices: Json;
          stripe_account_id: string;
          stripe_customer_id: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          fetched_at?: string;
          id?: string;
          invoices?: Json;
          stripe_account_id: string;
          stripe_customer_id: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          fetched_at?: string;
          id?: string;
          invoices?: Json;
          stripe_account_id?: string;
          stripe_customer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'portal_billing_invoice_cache_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portal_billing_invoice_cache_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portal_billing_invoice_cache_account_id_fkey';
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
      project_assignments: {
        Row: {
          account_id: string | null;
          project_id: string;
          role_on_project: string | null;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          project_id: string;
          role_on_project?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          project_id?: string;
          role_on_project?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_assignments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_assignments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_assignments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_assignments_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_client_field_values: {
        Row: {
          account_id: string;
          client_id: string;
          created_at: string;
          id: string;
          project_id: string;
          updated_at: string;
          values: Json;
        };
        Insert: {
          account_id: string;
          client_id: string;
          created_at?: string;
          id?: string;
          project_id: string;
          updated_at?: string;
          values?: Json;
        };
        Update: {
          account_id?: string;
          client_id?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
          updated_at?: string;
          values?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'project_client_field_values_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_client_field_values_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_client_field_values_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_client_field_values_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_client_field_values_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_delivery_notes: {
        Row: {
          account_id: string;
          author_user_id: string;
          created_at: string | null;
          id: string;
          note: string;
          project_id: string;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          author_user_id: string;
          created_at?: string | null;
          id?: string;
          note: string;
          project_id: string;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          author_user_id?: string;
          created_at?: string | null;
          id?: string;
          note?: string;
          project_id?: string;
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
            foreignKeyName: 'project_delivery_notes_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_field_definitions: {
        Row: {
          account_id: string;
          created_at: string;
          field_key: string;
          field_type: string;
          id: string;
          label: string;
          options: Json;
          project_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          field_key: string;
          field_type: string;
          id?: string;
          label: string;
          options?: Json;
          project_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          field_key?: string;
          field_type?: string;
          id?: string;
          label?: string;
          options?: Json;
          project_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_field_definitions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_field_definitions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_field_definitions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_field_definitions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_guests: {
        Row: {
          accepted_at: string | null;
          account_id: string;
          created_at: string;
          id: string;
          invite_token: string;
          invited_by: string;
          invited_email: string;
          permissions: Json;
          project_id: string;
          status: string;
          user_id: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          account_id: string;
          created_at?: string;
          id?: string;
          invite_token?: string;
          invited_by: string;
          invited_email: string;
          permissions?: Json;
          project_id: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          account_id?: string;
          created_at?: string;
          id?: string;
          invite_token?: string;
          invited_by?: string;
          invited_email?: string;
          permissions?: Json;
          project_id?: string;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'project_guests_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_guests_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_guests_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_guests_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
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
          name: string;
          project_id: string;
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
          name: string;
          project_id: string;
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
          name?: string;
          project_id?: string;
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
            foreignKeyName: 'project_phases_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          account_id: string | null;
          actual_minutes: number | null;
          area_id: string | null;
          business_id: string | null;
          client_id: string | null;
          client_org_id: string | null;
          colour: string | null;
          cost_pence: number | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          estimated_minutes: number | null;
          icon: string | null;
          id: string;
          name: string;
          portal_visible: boolean;
          priority: string | null;
          project_type: string;
          sort_order: number | null;
          start_date: string | null;
          status: string | null;
          target_date: string | null;
          title: string | null;
          updated_at: string | null;
          value_pence: number | null;
        };
        Insert: {
          account_id?: string | null;
          actual_minutes?: number | null;
          area_id?: string | null;
          business_id?: string | null;
          client_id?: string | null;
          client_org_id?: string | null;
          colour?: string | null;
          cost_pence?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          estimated_minutes?: number | null;
          icon?: string | null;
          id?: string;
          name: string;
          portal_visible?: boolean;
          priority?: string | null;
          project_type?: string;
          sort_order?: number | null;
          start_date?: string | null;
          status?: string | null;
          target_date?: string | null;
          title?: string | null;
          updated_at?: string | null;
          value_pence?: number | null;
        };
        Update: {
          account_id?: string | null;
          actual_minutes?: number | null;
          area_id?: string | null;
          business_id?: string | null;
          client_id?: string | null;
          client_org_id?: string | null;
          colour?: string | null;
          cost_pence?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          estimated_minutes?: number | null;
          icon?: string | null;
          id?: string;
          name?: string;
          portal_visible?: boolean;
          priority?: string | null;
          project_type?: string;
          sort_order?: number | null;
          start_date?: string | null;
          status?: string | null;
          target_date?: string | null;
          title?: string | null;
          updated_at?: string | null;
          value_pence?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
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
            foreignKeyName: 'projects_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
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
          ast_end_date: string | null;
          ast_start_date: string | null;
          bathrooms: number | null;
          bedrooms: number | null;
          building_type: string | null;
          created_at: string | null;
          current_value: number | null;
          id: string;
          is_family_let: boolean | null;
          is_hmo: boolean | null;
          is_limited_company: boolean | null;
          is_tenanted: boolean | null;
          monthly_rent: number | null;
          mortgage_balance: number | null;
          mortgage_end_date: string | null;
          mortgage_interest_rate: number | null;
          mortgage_lender: string | null;
          mortgage_monthly_payment: number | null;
          mortgage_notes: string | null;
          mortgage_reference: string | null;
          mortgage_start_date: string | null;
          name: string;
          notes: string | null;
          property_style: string | null;
          property_type: string | null;
          purchase_date: string | null;
          purchase_price: number | null;
          registered_owner: string | null;
          remortgage_date: string | null;
          square_footage: number | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          address?: string | null;
          ast_end_date?: string | null;
          ast_start_date?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          building_type?: string | null;
          created_at?: string | null;
          current_value?: number | null;
          id?: string;
          is_family_let?: boolean | null;
          is_hmo?: boolean | null;
          is_limited_company?: boolean | null;
          is_tenanted?: boolean | null;
          monthly_rent?: number | null;
          mortgage_balance?: number | null;
          mortgage_end_date?: string | null;
          mortgage_interest_rate?: number | null;
          mortgage_lender?: string | null;
          mortgage_monthly_payment?: number | null;
          mortgage_notes?: string | null;
          mortgage_reference?: string | null;
          mortgage_start_date?: string | null;
          name: string;
          notes?: string | null;
          property_style?: string | null;
          property_type?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          registered_owner?: string | null;
          remortgage_date?: string | null;
          square_footage?: number | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          address?: string | null;
          ast_end_date?: string | null;
          ast_start_date?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          building_type?: string | null;
          created_at?: string | null;
          current_value?: number | null;
          id?: string;
          is_family_let?: boolean | null;
          is_hmo?: boolean | null;
          is_limited_company?: boolean | null;
          is_tenanted?: boolean | null;
          monthly_rent?: number | null;
          mortgage_balance?: number | null;
          mortgage_end_date?: string | null;
          mortgage_interest_rate?: number | null;
          mortgage_lender?: string | null;
          mortgage_monthly_payment?: number | null;
          mortgage_notes?: string | null;
          mortgage_reference?: string | null;
          mortgage_start_date?: string | null;
          name?: string;
          notes?: string | null;
          property_style?: string | null;
          property_type?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          registered_owner?: string | null;
          remortgage_date?: string | null;
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
      property_valuations: {
        Row: {
          account_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          property_id: string;
          updated_at: string;
          value_amount: number;
          valued_month: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          property_id: string;
          updated_at?: string;
          value_amount: number;
          valued_month: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          property_id?: string;
          updated_at?: string;
          value_amount?: number;
          valued_month?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_valuations_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'property_valuations_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'property_valuations_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'property_valuations_property_id_fkey';
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
      site_domains: {
        Row: {
          account_id: string;
          created_at: string;
          hostname: string;
          id: string;
          is_primary: boolean;
          site_id: string;
          verified_at: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          hostname: string;
          id?: string;
          is_primary?: boolean;
          site_id: string;
          verified_at?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          hostname?: string;
          id?: string;
          is_primary?: boolean;
          site_id?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'site_domains_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_domains_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_domains_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_domains_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'site_sites';
            referencedColumns: ['id'];
          },
        ];
      };
      site_pages: {
        Row: {
          account_id: string;
          created_at: string;
          human_edited_at: string | null;
          id: string;
          published_at: string | null;
          published_data: Json | null;
          puck_data: Json;
          site_id: string;
          slug: string;
          source_hash: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          human_edited_at?: string | null;
          id?: string;
          published_at?: string | null;
          published_data?: Json | null;
          puck_data?: Json;
          site_id: string;
          slug: string;
          source_hash?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          human_edited_at?: string | null;
          id?: string;
          published_at?: string | null;
          published_data?: Json | null;
          puck_data?: Json;
          site_id?: string;
          slug?: string;
          source_hash?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'site_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_pages_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'site_sites';
            referencedColumns: ['id'];
          },
        ];
      };
      site_sites: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          name: string;
          primary_domain: string | null;
          settings: Json;
          status: string;
          subdomain: string;
          theme_tokens: Json;
          updated_at: string;
          website_id: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          name: string;
          primary_domain?: string | null;
          settings?: Json;
          status?: string;
          subdomain: string;
          theme_tokens?: Json;
          updated_at?: string;
          website_id?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          primary_domain?: string | null;
          settings?: Json;
          status?: string;
          subdomain?: string;
          theme_tokens?: Json;
          updated_at?: string;
          website_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'site_sites_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_sites_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_sites_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_sites_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
            referencedColumns: ['id'];
          },
        ];
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
          account_id: string | null;
          amount: number;
          billing_interval: string | null;
          client_subscription_id: string;
          created_at: string;
          currency: string;
          description: string;
          due_date: string | null;
          id: string;
          item_type: string;
          kind: string | null;
          notes: string | null;
          paid_at: string | null;
          plan_template_id: string | null;
          status: string;
          stripe_invoice_item_id: string | null;
          stripe_price_id: string | null;
        };
        Insert: {
          account_id?: string | null;
          amount: number;
          billing_interval?: string | null;
          client_subscription_id: string;
          created_at?: string;
          currency?: string;
          description: string;
          due_date?: string | null;
          id?: string;
          item_type?: string;
          kind?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          plan_template_id?: string | null;
          status?: string;
          stripe_invoice_item_id?: string | null;
          stripe_price_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          amount?: number;
          billing_interval?: string | null;
          client_subscription_id?: string;
          created_at?: string;
          currency?: string;
          description?: string;
          due_date?: string | null;
          id?: string;
          item_type?: string;
          kind?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          plan_template_id?: string | null;
          status?: string;
          stripe_invoice_item_id?: string | null;
          stripe_price_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'subscription_line_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscription_line_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscription_line_items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscription_line_items_client_subscription_id_fkey';
            columns: ['client_subscription_id'];
            isOneToOne: false;
            referencedRelation: 'client_subscriptions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscription_line_items_plan_template_id_fkey';
            columns: ['plan_template_id'];
            isOneToOne: false;
            referencedRelation: 'plan_templates';
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
          account_id: string | null;
          assigned_to: string | null;
          business_id: string | null;
          client_org_id: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          external_url: string | null;
          id: string;
          last_activity_at: string | null;
          priority: string | null;
          project_id: string | null;
          public_token: string | null;
          raised_by: string | null;
          recording_url: string | null;
          resolved_at: string | null;
          status: string | null;
          submitter_contact_id: string | null;
          submitter_email: string | null;
          submitter_name: string | null;
          ticket_number: number | null;
          title: string;
          type: string | null;
          updated_at: string | null;
          website_id: string | null;
        };
        Insert: {
          account_id?: string | null;
          assigned_to?: string | null;
          business_id?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          external_url?: string | null;
          id?: string;
          last_activity_at?: string | null;
          priority?: string | null;
          project_id?: string | null;
          public_token?: string | null;
          raised_by?: string | null;
          recording_url?: string | null;
          resolved_at?: string | null;
          status?: string | null;
          submitter_contact_id?: string | null;
          submitter_email?: string | null;
          submitter_name?: string | null;
          ticket_number?: number | null;
          title?: string;
          type?: string | null;
          updated_at?: string | null;
          website_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          assigned_to?: string | null;
          business_id?: string | null;
          client_org_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          external_url?: string | null;
          id?: string;
          last_activity_at?: string | null;
          priority?: string | null;
          project_id?: string | null;
          public_token?: string | null;
          raised_by?: string | null;
          recording_url?: string | null;
          resolved_at?: string | null;
          status?: string | null;
          submitter_contact_id?: string | null;
          submitter_email?: string | null;
          submitter_name?: string | null;
          ticket_number?: number | null;
          title?: string;
          type?: string | null;
          updated_at?: string | null;
          website_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'support_tickets_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
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
          {
            foreignKeyName: 'support_tickets_submitter_contact_id_fkey';
            columns: ['submitter_contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
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
      task_comments: {
        Row: {
          account_id: string;
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          project_id: string;
          task_id: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          project_id: string;
          task_id: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
          task_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_comments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_comments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_comments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_comments_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_comments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_recurring_series: {
        Row: {
          account_id: string | null;
          area_id: string | null;
          client_id: string | null;
          created_at: string;
          day_of_month: number | null;
          due_days: number;
          end_at: string | null;
          frequency: string;
          id: string;
          max_occurrences: number | null;
          next_create_at: string;
          notes: string | null;
          occurrences_created: number;
          priority: string;
          project_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          area_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          day_of_month?: number | null;
          due_days?: number;
          end_at?: string | null;
          frequency: string;
          id?: string;
          max_occurrences?: number | null;
          next_create_at: string;
          notes?: string | null;
          occurrences_created?: number;
          priority?: string;
          project_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          area_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          day_of_month?: number | null;
          due_days?: number;
          end_at?: string | null;
          frequency?: string;
          id?: string;
          max_occurrences?: number | null;
          next_create_at?: string;
          notes?: string | null;
          occurrences_created?: number;
          priority?: string;
          project_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_recurring_series_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_recurring_series_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_recurring_series_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_recurring_series_area_id_fkey';
            columns: ['area_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_recurring_series_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_recurring_series_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
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
          commercial_requirement_id: string | null;
          completed_at: string | null;
          created_at: string | null;
          due_date: string | null;
          google_calendar_event_id: string | null;
          group_id: string | null;
          id: string;
          links: Json;
          note_refs: Json;
          notes: string | null;
          parent_task_id: string | null;
          phase_id: string | null;
          pipeline_deal_id: string | null;
          priority: string | null;
          project_id: string | null;
          recurring_series_id: string | null;
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
          commercial_requirement_id?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          due_date?: string | null;
          google_calendar_event_id?: string | null;
          group_id?: string | null;
          id?: string;
          links?: Json;
          note_refs?: Json;
          notes?: string | null;
          parent_task_id?: string | null;
          phase_id?: string | null;
          pipeline_deal_id?: string | null;
          priority?: string | null;
          project_id?: string | null;
          recurring_series_id?: string | null;
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
          commercial_requirement_id?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          due_date?: string | null;
          google_calendar_event_id?: string | null;
          group_id?: string | null;
          id?: string;
          links?: Json;
          note_refs?: Json;
          notes?: string | null;
          parent_task_id?: string | null;
          phase_id?: string | null;
          pipeline_deal_id?: string | null;
          priority?: string | null;
          project_id?: string | null;
          recurring_series_id?: string | null;
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
            foreignKeyName: 'tasks_commercial_requirement_id_fkey';
            columns: ['commercial_requirement_id'];
            isOneToOne: false;
            referencedRelation: 'commercial_requirements';
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
            foreignKeyName: 'tasks_pipeline_deal_id_fkey';
            columns: ['pipeline_deal_id'];
            isOneToOne: false;
            referencedRelation: 'pipeline_deals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_recurring_series_id_fkey';
            columns: ['recurring_series_id'];
            isOneToOne: false;
            referencedRelation: 'task_recurring_series';
            referencedColumns: ['id'];
          },
        ];
      };
      ticket_messages: {
        Row: {
          attachments: Json;
          author_email: string | null;
          author_name: string | null;
          created_at: string | null;
          external_url: string | null;
          id: string;
          is_internal: boolean | null;
          message: string | null;
          ticket_id: string | null;
          user_id: string | null;
        };
        Insert: {
          attachments?: Json;
          author_email?: string | null;
          author_name?: string | null;
          created_at?: string | null;
          external_url?: string | null;
          id?: string;
          is_internal?: boolean | null;
          message?: string | null;
          ticket_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          attachments?: Json;
          author_email?: string | null;
          author_name?: string | null;
          created_at?: string | null;
          external_url?: string | null;
          id?: string;
          is_internal?: boolean | null;
          message?: string | null;
          ticket_id?: string | null;
          user_id?: string | null;
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
      user_content_templates: {
        Row: {
          body_text: string;
          created_at: string;
          id: string;
          is_default: boolean;
          kind: string;
          name: string;
          source_system_template_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body_text?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind?: string;
          name: string;
          source_system_template_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body_text?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind?: string;
          name?: string;
          source_system_template_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_content_templates_source_system_template_id_fkey';
            columns: ['source_system_template_id'];
            isOneToOne: false;
            referencedRelation: 'content_templates';
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
          workspace_setup_skipped_at: string | null;
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
          workspace_setup_skipped_at?: string | null;
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
          workspace_setup_skipped_at?: string | null;
        };
        Relationships: [];
      };
      video_edit_projects: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          revision: number;
          timeline: Json;
          updated_at: string;
          updated_by: string | null;
          video_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          revision?: number;
          timeline?: Json;
          updated_at?: string;
          updated_by?: string | null;
          video_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          revision?: number;
          timeline?: Json;
          updated_at?: string;
          updated_by?: string | null;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'video_edit_projects_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_edit_projects_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_edit_projects_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_edit_projects_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: true;
            referencedRelation: 'videos';
            referencedColumns: ['id'];
          },
        ];
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
      video_export_jobs: {
        Row: {
          account_id: string;
          created_at: string;
          edit_revision: number;
          error: string | null;
          id: string;
          output_bunny_video_id: string | null;
          progress: number;
          requested_by: string | null;
          status: string;
          updated_at: string;
          video_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          edit_revision?: number;
          error?: string | null;
          id?: string;
          output_bunny_video_id?: string | null;
          progress?: number;
          requested_by?: string | null;
          status?: string;
          updated_at?: string;
          video_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          edit_revision?: number;
          error?: string | null;
          id?: string;
          output_bunny_video_id?: string | null;
          progress?: number;
          requested_by?: string | null;
          status?: string;
          updated_at?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'video_export_jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_export_jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_export_jobs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_export_jobs_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: false;
            referencedRelation: 'videos';
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
      video_masters: {
        Row: {
          account_id: string;
          byte_size: number | null;
          content_type: string;
          created_at: string;
          duration_ms: number | null;
          height: number | null;
          id: string;
          mic_storage_path: string | null;
          sha256: string | null;
          storage_path: string;
          system_storage_path: string | null;
          updated_at: string;
          video_id: string;
          width: number | null;
        };
        Insert: {
          account_id: string;
          byte_size?: number | null;
          content_type?: string;
          created_at?: string;
          duration_ms?: number | null;
          height?: number | null;
          id?: string;
          mic_storage_path?: string | null;
          sha256?: string | null;
          storage_path: string;
          system_storage_path?: string | null;
          updated_at?: string;
          video_id: string;
          width?: number | null;
        };
        Update: {
          account_id?: string;
          byte_size?: number | null;
          content_type?: string;
          created_at?: string;
          duration_ms?: number | null;
          height?: number | null;
          id?: string;
          mic_storage_path?: string | null;
          sha256?: string | null;
          storage_path?: string;
          system_storage_path?: string | null;
          updated_at?: string;
          video_id?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'video_masters_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_masters_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_masters_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_masters_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: true;
            referencedRelation: 'videos';
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
      video_transcripts: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          plain_text: string;
          provider: string | null;
          status: string;
          updated_at: string;
          video_id: string;
          words: Json;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          plain_text?: string;
          provider?: string | null;
          status?: string;
          updated_at?: string;
          video_id: string;
          words?: Json;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          plain_text?: string;
          provider?: string | null;
          status?: string;
          updated_at?: string;
          video_id?: string;
          words?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'video_transcripts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_transcripts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_transcripts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_transcripts_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: true;
            referencedRelation: 'videos';
            referencedColumns: ['id'];
          },
        ];
      };
      videos: {
        Row: {
          account_id: string;
          baked_revision: number;
          bunny_library_id: string;
          chapters: Json;
          bunny_video_id: string;
          created_at: string;
          description: string | null;
          duration_seconds: number | null;
          edit_revision: number;
          file_size_bytes: number | null;
          folder_id: string | null;
          has_master: boolean;
          id: string;
          original_filename: string | null;
          public_share_enabled: boolean;
          public_share_token: string | null;
          published_revision: number;
          published_at: string | null;
          published_timeline: Json | null;
          recorded_at: string | null;
          source: string;
          status: string;
          summary: string | null;
          tags: string[];
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          baked_revision?: number;
          bunny_library_id: string;
          chapters?: Json;
          bunny_video_id: string;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          edit_revision?: number;
          file_size_bytes?: number | null;
          folder_id?: string | null;
          has_master?: boolean;
          id?: string;
          original_filename?: string | null;
          public_share_enabled?: boolean;
          public_share_token?: string | null;
          published_revision?: number;
          published_at?: string | null;
          published_timeline?: Json | null;
          recorded_at?: string | null;
          source?: string;
          status?: string;
          summary?: string | null;
          tags?: string[];
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          baked_revision?: number;
          bunny_library_id?: string;
          chapters?: Json;
          bunny_video_id?: string;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          edit_revision?: number;
          file_size_bytes?: number | null;
          folder_id?: string | null;
          has_master?: boolean;
          id?: string;
          original_filename?: string | null;
          public_share_enabled?: boolean;
          public_share_token?: string | null;
          published_revision?: number;
          published_at?: string | null;
          published_timeline?: Json | null;
          recorded_at?: string | null;
          source?: string;
          status?: string;
          summary?: string | null;
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
      voice_profiles: {
        Row: {
          account_id: string | null;
          created_at: string;
          distill_count: number;
          distill_count_day: string | null;
          guidance_text: string | null;
          id: string;
          kind: string;
          last_distilled_at: string | null;
          learn_from_sent_email: boolean;
          owner_user_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          distill_count?: number;
          distill_count_day?: string | null;
          guidance_text?: string | null;
          id?: string;
          kind: string;
          last_distilled_at?: string | null;
          learn_from_sent_email?: boolean;
          owner_user_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          distill_count?: number;
          distill_count_day?: string | null;
          guidance_text?: string | null;
          id?: string;
          kind?: string;
          last_distilled_at?: string | null;
          learn_from_sent_email?: boolean;
          owner_user_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'voice_profiles_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'voice_profiles_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'voice_profiles_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      voice_sources: {
        Row: {
          content_text: string;
          created_at: string;
          external_ref: string | null;
          id: string;
          included: boolean;
          profile_id: string;
          storage_path: string | null;
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          content_text?: string;
          created_at?: string;
          external_ref?: string | null;
          id?: string;
          included?: boolean;
          profile_id: string;
          storage_path?: string | null;
          title?: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          content_text?: string;
          created_at?: string;
          external_ref?: string | null;
          id?: string;
          included?: boolean;
          profile_id?: string;
          storage_path?: string | null;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'voice_sources_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'voice_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      voice_themes: {
        Row: {
          created_at: string;
          description: string;
          examples: string[];
          id: string;
          profile_id: string;
          source: string;
          title: string;
          updated_at: string;
          weight: number;
        };
        Insert: {
          created_at?: string;
          description?: string;
          examples?: string[];
          id?: string;
          profile_id: string;
          source?: string;
          title: string;
          updated_at?: string;
          weight?: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          examples?: string[];
          id?: string;
          profile_id?: string;
          source?: string;
          title?: string;
          updated_at?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'voice_themes_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'voice_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      website_approvals: {
        Row: {
          account_id: string;
          action: string;
          actor: string;
          created_at: string;
          id: string;
          note: string | null;
          target_id: string;
          target_type: string;
          website_id: string;
        };
        Insert: {
          account_id: string;
          action: string;
          actor: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          target_id: string;
          target_type: string;
          website_id: string;
        };
        Update: {
          account_id?: string;
          action?: string;
          actor?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          target_id?: string;
          target_type?: string;
          website_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'website_approvals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_approvals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_approvals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_approvals_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
            referencedColumns: ['id'];
          },
        ];
      };
      website_briefs: {
        Row: {
          account_id: string;
          ai_provenance: Json;
          brief: Json;
          created_at: string;
          created_by: string | null;
          id: string;
          llms_txt: string | null;
          updated_at: string;
          website_id: string;
        };
        Insert: {
          account_id: string;
          ai_provenance?: Json;
          brief?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          llms_txt?: string | null;
          updated_at?: string;
          website_id: string;
        };
        Update: {
          account_id?: string;
          ai_provenance?: Json;
          brief?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          llms_txt?: string | null;
          updated_at?: string;
          website_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'website_briefs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_briefs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_briefs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_briefs_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: true;
            referencedRelation: 'websites';
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
      website_seo_pages: {
        Row: {
          account_id: string;
          created_at: string;
          fields: Json;
          id: string;
          page_id: string;
          page_slug: string | null;
          seo: Json;
          status: string;
          updated_at: string;
          website_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          fields?: Json;
          id?: string;
          page_id: string;
          page_slug?: string | null;
          seo?: Json;
          status?: string;
          updated_at?: string;
          website_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          fields?: Json;
          id?: string;
          page_id?: string;
          page_slug?: string | null;
          seo?: Json;
          status?: string;
          updated_at?: string;
          website_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'website_seo_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_seo_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_seo_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_seo_pages_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
            referencedColumns: ['id'];
          },
        ];
      };
      website_shares: {
        Row: {
          account_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          revoked_at: string | null;
          scope: string;
          token: string;
          updated_at: string;
          website_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          revoked_at?: string | null;
          scope?: string;
          token: string;
          updated_at?: string;
          website_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          revoked_at?: string | null;
          scope?: string;
          token?: string;
          updated_at?: string;
          website_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'website_shares_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_shares_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_shares_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_shares_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
            referencedColumns: ['id'];
          },
        ];
      };
      website_style_systems: {
        Row: {
          account_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          locked: boolean;
          moodboard: Json;
          style: Json;
          tokens: Json;
          updated_at: string;
          website_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          locked?: boolean;
          moodboard?: Json;
          style?: Json;
          tokens?: Json;
          updated_at?: string;
          website_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          locked?: boolean;
          moodboard?: Json;
          style?: Json;
          tokens?: Json;
          updated_at?: string;
          website_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'website_style_systems_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_style_systems_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_style_systems_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_style_systems_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: true;
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
          portal_share_scope: string;
          project_id: string | null;
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
          portal_share_scope?: string;
          project_id?: string | null;
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
          portal_share_scope?: string;
          project_id?: string | null;
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
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'websites_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
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
      workspace_focus_settings: {
        Row: {
          account_id: string;
          created_at: string;
          holiday_mode_enabled: boolean;
          holiday_mode_label: string;
          holiday_mode_until: string | null;
          id: string;
          ooo_cc_email: string | null;
          ooo_enabled: boolean;
          ooo_holiday_message: string | null;
          ooo_include_return_date: boolean;
          ooo_message: string;
          ooo_sender_name: string | null;
          ooo_trigger: string;
          silence_outside_hours: boolean;
          timezone: string;
          updated_at: string;
          user_id: string;
          work_days: number[];
          work_end_time: string;
          work_start_time: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          holiday_mode_enabled?: boolean;
          holiday_mode_label?: string;
          holiday_mode_until?: string | null;
          id?: string;
          ooo_cc_email?: string | null;
          ooo_enabled?: boolean;
          ooo_holiday_message?: string | null;
          ooo_include_return_date?: boolean;
          ooo_message?: string;
          ooo_sender_name?: string | null;
          ooo_trigger?: string;
          silence_outside_hours?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id: string;
          work_days?: number[];
          work_end_time?: string;
          work_start_time?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          holiday_mode_enabled?: boolean;
          holiday_mode_label?: string;
          holiday_mode_until?: string | null;
          id?: string;
          ooo_cc_email?: string | null;
          ooo_enabled?: boolean;
          ooo_holiday_message?: string | null;
          ooo_include_return_date?: boolean;
          ooo_message?: string;
          ooo_sender_name?: string | null;
          ooo_trigger?: string;
          silence_outside_hours?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
          work_days?: number[];
          work_end_time?: string;
          work_start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_focus_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_focus_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_account_workspace';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_focus_settings_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'user_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      family_recipe_popularity: {
        Row: {
          avg_rating: number | null;
          popularity_score: number | null;
          recipe_id: string | null;
          times_cooked: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'family_recipe_logs_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'family_recipes';
            referencedColumns: ['id'];
          },
        ];
      },
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
      attach_invitation_projects: {
        Args: { account_slug: string; links: Json };
        Returns: undefined;
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
      claim_due_booking_reminders: {
        Args: { p_limit?: number };
        Returns: {
          booking_id: string;
          created_at: string;
          id: string;
          recipient: string;
          send_at: string;
          sent_at: string | null;
          status: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'booking_reminders';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_due_scheduled_invoice_sends: {
        Args: { p_limit?: number };
        Returns: {
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
          project_id: string | null;
          public_token: string | null;
          read_at: string | null;
          recurring_series_id: string | null;
          reference_number: string | null;
          scheduled_send_at: string | null;
          scheduled_send_processing_at: string | null;
          scheduled_send_to_emails: string[] | null;
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
        }[];
        SetofOptions: {
          from: '*';
          to: 'invoices';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_gmail_sync_batch: {
        Args: { p_batch_size?: number };
        Returns: {
          connection_id: string;
          mailbox_kind: string;
          user_id: string;
        }[];
      };
      contractor_assigned_to_job: {
        Args: { job_id: string };
        Returns: boolean;
      };
      contractor_assigned_to_project: {
        Args: { project_id: string };
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
          project_id: string | null;
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
              default_currency: string;
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
              default_currency: string;
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
              default_currency: string;
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
              default_currency: string;
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
      debit_media_credits: {
        Args: { p_account_id: string; p_amount: number; p_job_id: string };
        Returns: Json;
      };
      ensure_media_credit_pool: {
        Args: { p_account_id: string };
        Returns: {
          account_id: string;
          balance: number;
          created_at: string;
          cycle_end: string | null;
          cycle_start: string | null;
          monthly_allowance: number;
          plan_tier: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'media_credit_pools';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      expire_stale_media_credit_batches: { Args: never; Returns: number };
      forfeit_media_credits_on_closure: {
        Args: { p_account_id: string };
        Returns: number;
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
      get_or_create_client_portal_thread: {
        Args: { p_client_org_id: string };
        Returns: string;
      };
      get_upper_system_role: { Args: never; Returns: string };
      grant_ai_credit_purchase: {
        Args: {
          p_account_id: string;
          p_amount_total?: number;
          p_credits: number;
          p_currency?: string;
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
        SetofOptions: {
          from: '*';
          to: 'ai_credit_balances';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      grant_media_credits: {
        Args: {
          p_account_id: string;
          p_amount: number;
          p_expires_at: string;
          p_source_type: string;
          p_stripe_event_id?: string;
        };
        Returns: {
          account_id: string;
          created_at: string;
          expires_at: string;
          granted_at: string;
          id: string;
          source_type: string;
          stripe_event_id: string | null;
          swept_at: string | null;
          units_granted: number;
          units_remaining: number;
        };
        SetofOptions: {
          from: '*';
          to: 'media_credit_batches';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
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
      has_project_guest_capability: {
        Args: { capability_key: string; target_project_id: string };
        Returns: boolean;
      };
      family_recipe_is_accessible: {
        Args: { p_recipe_id: string };
        Returns: boolean;
      },
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
      is_accepted_project_guest: {
        Args: { target_project_id: string };
        Returns: boolean;
      };
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
      is_client_portal_thread_participant: {
        Args: { target_thread_id: string };
        Returns: boolean;
      };
      is_contractor_on_account: {
        Args: { account_id: string };
        Returns: boolean;
      };
      is_portal_visible_project: {
        Args: { target_project_id: string };
        Returns: boolean;
      };
      is_project_guest_on_account: {
        Args: { target_account_id: string };
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
      normalize_activity_url: { Args: { url: string }; Returns: string };
      personal_person_owned_by_user: {
        Args: { p_person_id: string };
        Returns: boolean;
      };
      refund_media_credits: {
        Args: { p_job_id: string; p_reason?: string };
        Returns: Json;
      };
      replace_contact_email_addresses: {
        Args: { p_account_id: string; p_addresses: Json; p_contact_id: string };
        Returns: undefined;
      };
      reset_ai_credits_if_expired: {
        Args: { p_account_id: string };
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
      account_billing_status:
        | 'trialing'
        | 'active'
        | 'past_due_grace'
        | 'past_due_restricted'
        | 'suspended'
        | 'trial_expired'
        | 'canceled';
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
        | 'clients.edit'
        | 'activity.view_team'
        | 'scheduling.view'
        | 'scheduling.edit'
        | 'listings.view'
        | 'listings.edit';
      billing_provider: 'stripe' | 'lemon-squeezy' | 'paddle';
      chat_participant_kind: 'member' | 'client';
      chat_thread_type: 'direct' | 'group' | 'job' | 'client_portal';
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
  public: {
    Enums: {
      account_billing_status: [
        'trialing',
        'active',
        'past_due_grace',
        'past_due_restricted',
        'suspended',
        'trial_expired',
        'canceled',
      ],
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
        'activity.view_team',
        'scheduling.view',
        'scheduling.edit',
        'listings.view',
        'listings.edit',
      ],
      billing_provider: ['stripe', 'lemon-squeezy', 'paddle'],
      chat_participant_kind: ['member', 'client'],
      chat_thread_type: ['direct', 'group', 'job', 'client_portal'],
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
} as const;
