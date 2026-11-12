export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: NonNullable<Json>
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          comment: string | null
          id: string
          participant_id: string
          recorded_at: string
          recorded_by: string | null
          session_id: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          comment?: string | null
          id?: string
          participant_id: string
          recorded_at?: string
          recorded_by?: string | null
          session_id: string
          status: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          id?: string
          participant_id?: string
          recorded_at?: string
          recorded_by?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_countersignatures: {
        Row: {
          attested: Json
          content_sha256: string
          ip_hmac: string | null
          session_id: string
          signature_svg: string
          signatures_sha256: string
          signed_at: string
          trainer_id: string | null
          trainer_name: string
          user_agent: string | null
        }
        ComputedFields: never
        Insert: {
          attested?: Json
          content_sha256?: string
          ip_hmac?: string | null
          session_id: string
          signature_svg: string
          signatures_sha256?: string
          signed_at?: string
          trainer_id?: string | null
          trainer_name?: string
          user_agent?: string | null
        }
        Update: {
          attested?: Json
          content_sha256?: string
          ip_hmac?: string | null
          session_id?: string
          signature_svg?: string
          signatures_sha256?: string
          signed_at?: string
          trainer_id?: string | null
          trainer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_countersignatures_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_countersignatures_trainer_id_fkey"
            columns: ["trainer_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_history: {
        Row: {
          attendance_id: string | null
          changed_at: string
          changed_by: string | null
          id: number
          new_comment: string | null
          new_status: string | null
          old_comment: string | null
          old_status: string | null
          participant_id: string
          session_id: string
        }
        ComputedFields: never
        Insert: {
          attendance_id?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_comment?: string | null
          new_status?: string | null
          old_comment?: string | null
          old_status?: string | null
          participant_id: string
          session_id: string
        }
        Update: {
          attendance_id?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_comment?: string | null
          new_status?: string | null
          old_comment?: string | null
          old_status?: string | null
          participant_id?: string
          session_id?: string
        }
        Relationships: []
      }
      attendance_signatures: {
        Row: {
          attendance_status: string
          collected_by: string | null
          content_sha256: string
          id: string
          ip_hmac: string | null
          kind: string
          method: string
          participant_id: string
          session_id: string
          signature_svg: string | null
          signed_at: string
          unable_reason: string | null
          user_agent: string | null
        }
        ComputedFields: never
        Insert: {
          attendance_status?: string
          collected_by?: string | null
          content_sha256?: string
          id?: string
          ip_hmac?: string | null
          kind: string
          method?: string
          participant_id: string
          session_id: string
          signature_svg?: string | null
          signed_at?: string
          unable_reason?: string | null
          user_agent?: string | null
        }
        Update: {
          attendance_status?: string
          collected_by?: string | null
          content_sha256?: string
          id?: string
          ip_hmac?: string | null
          kind?: string
          method?: string
          participant_id?: string
          session_id?: string
          signature_svg?: string | null
          signed_at?: string
          unable_reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_signatures_collected_by_fkey"
            columns: ["collected_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_signatures_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_signatures_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          entity_id: string | null
          entity_type: string | null
          id: number
          metadata: NonNullable<Json>
          occurred_at: string
          organization_id: string | null
          participant_id: string | null
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: NonNullable<Json>
          occurred_at?: string
          organization_id?: string | null
          participant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: NonNullable<Json>
          occurred_at?: string
          organization_id?: string | null
          participant_id?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          audience: string | null
          consent_at: string
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          name: string
          organization: string | null
          origin_hash: string | null
          status: string
        }
        ComputedFields: never
        Insert: {
          audience?: string | null
          consent_at?: string
          created_at?: string
          email: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message: string
          name: string
          organization?: string | null
          origin_hash?: string | null
          status?: string
        }
        Update: {
          audience?: string | null
          consent_at?: string
          created_at?: string
          email?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          name?: string
          organization?: string | null
          origin_hash?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          created_at: string
          details: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          resolution_note: string | null
          status: string
          type: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          resolution_note?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          resolution_note?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_requests_processed_by_fkey"
            columns: ["processed_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_processed_by_fkey"
            columns: ["processed_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          created_by: string | null
          data: Json
          id: string
          idempotency_key: string
          is_demo: boolean
          last_error: string | null
          locked_until: string | null
          next_attempt_at: string
          participant_id: string | null
          provider: string | null
          provider_message_id: string | null
          recipient_email: string | null
          recipient_user_id: string | null
          report_id: string | null
          sent_at: string | null
          session_id: string | null
          status: string
          subject: string
          template: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          idempotency_key: string
          is_demo?: boolean
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          participant_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_user_id?: string | null
          report_id?: string | null
          sent_at?: string | null
          session_id?: string | null
          status?: string
          subject: string
          template: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          idempotency_key?: string
          is_demo?: boolean
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          participant_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_user_id?: string | null
          report_id?: string | null
          sent_at?: string | null
          session_id?: string | null
          status?: string
          subject?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_report_id_fkey"
            columns: ["report_id"]
            referencedRelation: "participant_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          reminders: boolean
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_preferences_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          evaluation_id: string
          id: string
          kind: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          evaluation_id: string
          id?: string
          kind: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_comments_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_comments_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_comments_evaluation_id_fkey"
            columns: ["evaluation_id"]
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_criterion_scores: {
        Row: {
          criterion_id: string
          evaluation_id: string
          id: string
          observed: boolean | null
          score: number | null
        }
        ComputedFields: never
        Insert: {
          criterion_id: string
          evaluation_id: string
          id?: string
          observed?: boolean | null
          score?: number | null
        }
        Update: {
          criterion_id?: string
          evaluation_id?: string
          id?: string
          observed?: boolean | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_criterion_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            referencedRelation: "skill_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_criterion_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_frameworks: {
        Row: {
          evaluation_id: string
          framework_version_id: string
        }
        ComputedFields: never
        Insert: {
          evaluation_id: string
          framework_version_id: string
        }
        Update: {
          evaluation_id?: string
          framework_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_frameworks_evaluation_id_fkey"
            columns: ["evaluation_id"]
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_frameworks_framework_version_id_fkey"
            columns: ["framework_version_id"]
            referencedRelation: "framework_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_history: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          comment_kind: string | null
          criterion_id: string | null
          evaluation_id: string
          id: number
          new_value: string | null
          old_value: string | null
          reason: string | null
          skill_id: string | null
        }
        ComputedFields: never
        Insert: {
          change_type: string
          changed_at?: string
          changed_by?: string | null
          comment_kind?: string | null
          criterion_id?: string | null
          evaluation_id: string
          id?: never
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          skill_id?: string | null
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          comment_kind?: string | null
          criterion_id?: string | null
          evaluation_id?: string
          id?: never
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          skill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_history_evaluation_id_fkey"
            columns: ["evaluation_id"]
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_scores: {
        Row: {
          comment: string | null
          evaluation_id: string
          id: string
          score: number | null
          score_source: string
          skill_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          comment?: string | null
          evaluation_id: string
          id?: string
          score?: number | null
          score_source?: string
          skill_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          evaluation_id?: string
          id?: string
          score?: number | null
          score_source?: string
          skill_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_scores_skill_id_fkey"
            columns: ["skill_id"]
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          evaluator_id: string | null
          framework_snapshot: Json | null
          id: string
          participant_id: string
          revision: number
          session_id: string
          status: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          evaluator_id?: string | null
          framework_snapshot?: Json | null
          id?: string
          participant_id: string
          revision?: number
          session_id: string
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          evaluator_id?: string | null
          framework_snapshot?: Json | null
          id?: string
          participant_id?: string
          revision?: number
          session_id?: string
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_validated_by_fkey"
            columns: ["validated_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_validated_by_fkey"
            columns: ["validated_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_versions: {
        Row: {
          aggregation: string
          based_on_version_id: string | null
          created_at: string
          created_by: string | null
          framework_id: string
          id: string
          is_provisional: boolean
          label: string
          notes: string | null
          published_at: string | null
          published_by: string | null
          rounding: string
          scale_max: number
          scale_min: number
          scale_step: number
          scoring_mode: string
          settings: NonNullable<Json>
          status: string
          updated_at: string
          version_number: number
        }
        ComputedFields: never
        Insert: {
          aggregation?: string
          based_on_version_id?: string | null
          created_at?: string
          created_by?: string | null
          framework_id: string
          id?: string
          is_provisional?: boolean
          label: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          rounding?: string
          scale_max: number
          scale_min: number
          scale_step?: number
          scoring_mode?: string
          settings?: NonNullable<Json>
          status?: string
          updated_at?: string
          version_number: number
        }
        Update: {
          aggregation?: string
          based_on_version_id?: string | null
          created_at?: string
          created_by?: string | null
          framework_id?: string
          id?: string
          is_provisional?: boolean
          label?: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          rounding?: string
          scale_max?: number
          scale_min?: number
          scale_step?: number
          scoring_mode?: string
          settings?: NonNullable<Json>
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "framework_versions_based_on_version_id_fkey"
            columns: ["based_on_version_id"]
            referencedRelation: "framework_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_versions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_versions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_versions_framework_id_fkey"
            columns: ["framework_id"]
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_versions_published_by_fkey"
            columns: ["published_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_versions_published_by_fkey"
            columns: ["published_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      frameworks: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          short_name: string
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          short_name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          short_name?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          added_by: string | null
          group_id: string
          id: string
          joined_at: string
          left_at: string | null
          participant_id: string
          status: string
        }
        ComputedFields: never
        Insert: {
          added_by?: string | null
          group_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          participant_id: string
          status?: string
        }
        Update: {
          added_by?: string | null
          group_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          participant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_added_by_fkey"
            columns: ["added_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_added_by_fkey"
            columns: ["added_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_trainers: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          group_id: string
          is_lead: boolean
          trainer_id: string
        }
        ComputedFields: never
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          group_id: string
          is_lead?: boolean
          trainer_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          group_id?: string
          is_lead?: boolean
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_trainers_assigned_by_fkey"
            columns: ["assigned_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_trainers_assigned_by_fkey"
            columns: ["assigned_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_trainers_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_trainers_trainer_id_fkey"
            columns: ["trainer_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_trainers_trainer_id_fkey"
            columns: ["trainer_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          is_demo: boolean
          name: string
          organization_id: string | null
          program_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_demo?: boolean
          name: string
          organization_id?: string | null
          program_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          organization_id?: string | null
          program_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_codes: {
        Row: {
          code_hash: string
          code_hint: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          organization_id: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: string
          used_at: string | null
          used_by: string | null
        }
        ComputedFields: never
        Insert: {
          code_hash: string
          code_hint: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          organization_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code_hash?: string
          code_hint?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          organization_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_codes_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_revoked_by_fkey"
            columns: ["revoked_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_revoked_by_fkey"
            columns: ["revoked_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_role_fkey"
            columns: ["role"]
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "invitation_codes_used_by_fkey"
            columns: ["used_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_used_by_fkey"
            columns: ["used_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          member_role: string
          organization_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          member_role?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          member_role?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          name: string
          siret: string | null
          status: string
          status_reason: string | null
          type: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        ComputedFields: never
        Insert: {
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name: string
          siret?: string | null
          status?: string
          status_reason?: string | null
          type?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          siret?: string | null
          status?: string
          status_reason?: string | null
          type?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_validated_by_fkey"
            columns: ["validated_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_validated_by_fkey"
            columns: ["validated_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_organization_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          organization_id: string | null
          participant_id: string
          previous_organization_id: string | null
        }
        ComputedFields: never
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          organization_id?: string | null
          participant_id: string
          previous_organization_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          organization_id?: string | null
          participant_id?: string
          previous_organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_organization_history_changed_by_fkey"
            columns: ["changed_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_organization_history_changed_by_fkey"
            columns: ["changed_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_organization_history_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_organization_history_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_organization_history_previous_organization_id_fkey"
            columns: ["previous_organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_reports: {
        Row: {
          content: Json | null
          content_generated_at: string | null
          content_model: string | null
          content_source: string | null
          created_at: string
          created_by: string | null
          data: Json
          engine_version: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          options: Json
          participant_id: string
          status: string
          updated_at: string
          version: number
        }
        ComputedFields: never
        Insert: {
          content?: Json | null
          content_generated_at?: string | null
          content_model?: string | null
          content_source?: string | null
          created_at?: string
          created_by?: string | null
          data: Json
          engine_version: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          options?: Json
          participant_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: Json | null
          content_generated_at?: string | null
          content_model?: string | null
          content_source?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          engine_version?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          options?: Json
          participant_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "participant_reports_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_session_notes: {
        Row: {
          learned: string
          participant_id: string
          session_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          learned?: string
          participant_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          learned?: string
          participant_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_session_notes_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_session_notes_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          invited_by: string | null
          is_demo: boolean
          last_name: string
          organization_id: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          invited_by?: string | null
          is_demo?: boolean
          last_name: string
          organization_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          invited_by?: string | null
          is_demo?: boolean
          last_name?: string
          organization_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_invited_by_fkey"
            columns: ["invited_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_invited_by_fkey"
            columns: ["invited_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_share_views: {
        Row: {
          id: number
          ip_hash: string | null
          share_id: string
          viewed_at: string
        }
        ComputedFields: never
        Insert: {
          id?: never
          ip_hash?: string | null
          share_id: string
          viewed_at?: string
        }
        Update: {
          id?: never
          ip_hash?: string | null
          share_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_share_views_share_id_fkey"
            columns: ["share_id"]
            referencedRelation: "passport_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_shares: {
        Row: {
          created_at: string
          created_by: string | null
          duration_days: number
          expires_at: string
          id: string
          include_report: boolean
          include_sociocognitive: boolean
          label: string
          last_viewed_at: string | null
          participant_id: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          token_ciphertext: string
          token_hash: string
          view_count: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_days: number
          expires_at: string
          id?: string
          include_report?: boolean
          include_sociocognitive?: boolean
          label: string
          last_viewed_at?: string | null
          participant_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          token_ciphertext: string
          token_hash: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_days?: number
          expires_at?: string
          id?: string
          include_report?: boolean
          include_sociocognitive?: boolean
          label?: string
          last_viewed_at?: string | null
          participant_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          token_ciphertext?: string
          token_hash?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "passport_shares_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      pedagogical_content_versions: {
        Row: {
          change_note: string | null
          content_id: string
          created_at: string
          created_by: string | null
          id: string
          is_provisional: boolean
          markdown: string
          published_at: string | null
          source_filename: string | null
          version_number: number
        }
        ComputedFields: never
        Insert: {
          change_note?: string | null
          content_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_provisional?: boolean
          markdown: string
          published_at?: string | null
          source_filename?: string | null
          version_number: number
        }
        Update: {
          change_note?: string | null
          content_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_provisional?: boolean
          markdown?: string
          published_at?: string | null
          source_filename?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedagogical_content_versions_content_id_fkey"
            columns: ["content_id"]
            referencedRelation: "pedagogical_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedagogical_content_versions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedagogical_content_versions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      pedagogical_contents: {
        Row: {
          created_at: string
          current_version_id: string | null
          id: string
          program_session_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          current_version_id?: string | null
          id?: string
          program_session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          id?: string
          program_session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedagogical_contents_current_version_fkey"
            columns: ["current_version_id"]
            referencedRelation: "pedagogical_content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedagogical_contents_program_session_id_fkey"
            columns: ["program_session_id"]
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          applicable_roles: string[]
          code: string
          description: string | null
          label: string
          position: number
        }
        ComputedFields: never
        Insert: {
          applicable_roles: string[]
          code: string
          description?: string | null
          label: string
          position?: number
        }
        Update: {
          applicable_roles?: string[]
          code?: string
          description?: string | null
          label?: string
          position?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          consent_version: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_demo: boolean
          last_name: string
          phone: string | null
          privacy_consent_at: string | null
          role: string
          status: string
          terms_accepted_at: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          consent_version?: string | null
          created_at?: string
          email: string
          first_name?: string
          id: string
          is_demo?: boolean
          last_name?: string
          phone?: string | null
          privacy_consent_at?: string | null
          role?: string
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          consent_version?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_demo?: boolean
          last_name?: string
          phone?: string | null
          privacy_consent_at?: string | null
          role?: string
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_fkey"
            columns: ["role"]
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
      program_frameworks: {
        Row: {
          activated_at: string
          activated_by: string | null
          framework_id: string
          framework_version_id: string
          program_id: string
        }
        ComputedFields: never
        Insert: {
          activated_at?: string
          activated_by?: string | null
          framework_id: string
          framework_version_id: string
          program_id: string
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          framework_id?: string
          framework_version_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_frameworks_activated_by_fkey"
            columns: ["activated_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_frameworks_activated_by_fkey"
            columns: ["activated_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_frameworks_framework_id_fkey"
            columns: ["framework_id"]
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_frameworks_framework_version_id_fkey"
            columns: ["framework_version_id"]
            referencedRelation: "framework_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_frameworks_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_sessions: {
        Row: {
          activities: string[]
          created_at: string
          id: string
          is_provisional: boolean
          key_notions: string[]
          number: number
          objectives: string[]
          program_id: string
          summary: string | null
          takeaways: string[]
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          activities?: string[]
          created_at?: string
          id?: string
          is_provisional?: boolean
          key_notions?: string[]
          number: number
          objectives?: string[]
          program_id: string
          summary?: string | null
          takeaways?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          activities?: string[]
          created_at?: string
          id?: string
          is_provisional?: boolean
          key_notions?: string[]
          number?: number
          objectives?: string[]
          program_id?: string
          summary?: string | null
          takeaways?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_demo: boolean
          is_public: boolean
          max_group_size: number
          min_group_size: number
          name: string
          session_duration_minutes: number
          sessions_count: number
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          is_public?: boolean
          max_group_size?: number
          min_group_size?: number
          name: string
          session_duration_minutes?: number
          sessions_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          is_public?: boolean
          max_group_size?: number
          min_group_size?: number
          name?: string
          session_duration_minutes?: number
          sessions_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_questions: {
        Row: {
          framework_code: string | null
          help: string | null
          id: string
          is_active: boolean
          position: number
          skill_code: string | null
          text: string
          version_id: string
        }
        ComputedFields: never
        Insert: {
          framework_code?: string | null
          help?: string | null
          id?: string
          is_active?: boolean
          position?: number
          skill_code?: string | null
          text: string
          version_id: string
        }
        Update: {
          framework_code?: string | null
          help?: string | null
          id?: string
          is_active?: boolean
          position?: number
          skill_code?: string | null
          text?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_questions_version_id_fkey"
            columns: ["version_id"]
            referencedRelation: "questionnaire_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_scale_labels: {
        Row: {
          label: string
          value: number
          version_id: string
        }
        ComputedFields: never
        Insert: {
          label: string
          value: number
          version_id: string
        }
        Update: {
          label?: string
          value?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_scale_labels_version_id_fkey"
            columns: ["version_id"]
            referencedRelation: "questionnaire_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          intro: string | null
          is_provisional: boolean
          label: string
          published_at: string | null
          questionnaire_id: string
          scale_max: number
          scale_min: number
          status: string
          updated_at: string
          version_number: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          intro?: string | null
          is_provisional?: boolean
          label: string
          published_at?: string | null
          questionnaire_id: string
          scale_max?: number
          scale_min?: number
          status?: string
          updated_at?: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          intro?: string | null
          is_provisional?: boolean
          label?: string
          published_at?: string | null
          questionnaire_id?: string
          scale_max?: number
          scale_min?: number
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_versions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_versions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_versions_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaires: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission_code: string
          role_code: string
        }
        ComputedFields: never
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission_code: string
          role_code: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission_code?: string
          role_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_permissions_role_code_fkey"
            columns: ["role_code"]
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          description: string | null
          label: string
          position: number
        }
        ComputedFields: never
        Insert: {
          code: string
          description?: string | null
          label: string
          position?: number
        }
        Update: {
          code?: string
          description?: string | null
          label?: string
          position?: number
        }
        Relationships: []
      }
      scale_levels: {
        Row: {
          description: string | null
          id: string
          label: string
          value: number
          version_id: string
        }
        ComputedFields: never
        Insert: {
          description?: string | null
          id?: string
          label: string
          value: number
          version_id: string
        }
        Update: {
          description?: string | null
          id?: string
          label?: string
          value?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scale_levels_version_id_fkey"
            columns: ["version_id"]
            referencedRelation: "framework_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      self_assessment_answers: {
        Row: {
          answered_at: string
          comment: string | null
          id: string
          question_id: string
          self_assessment_id: string
          value: number
        }
        ComputedFields: never
        Insert: {
          answered_at?: string
          comment?: string | null
          id?: string
          question_id: string
          self_assessment_id: string
          value: number
        }
        Update: {
          answered_at?: string
          comment?: string | null
          id?: string
          question_id?: string
          self_assessment_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "self_assessment_answers_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questionnaire_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "self_assessment_answers_self_assessment_id_fkey"
            columns: ["self_assessment_id"]
            referencedRelation: "self_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      self_assessments: {
        Row: {
          comment: string | null
          completed_at: string | null
          id: string
          kind: string
          participant_id: string
          questionnaire_version_id: string
          started_at: string
          status: string
        }
        ComputedFields: never
        Insert: {
          comment?: string | null
          completed_at?: string | null
          id?: string
          kind?: string
          participant_id: string
          questionnaire_version_id: string
          started_at?: string
          status?: string
        }
        Update: {
          comment?: string | null
          completed_at?: string | null
          id?: string
          kind?: string
          participant_id?: string
          questionnaire_version_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_assessments_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "self_assessments_questionnaire_version_id_fkey"
            columns: ["questionnaire_version_id"]
            referencedRelation: "questionnaire_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_player_states: {
        Row: {
          block_timers: NonNullable<Json>
          completed_blocks: number[]
          content_version_id: string | null
          current_block: number
          session_id: string
          session_timer: NonNullable<Json>
          trainer_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          block_timers?: NonNullable<Json>
          completed_blocks?: number[]
          content_version_id?: string | null
          current_block?: number
          session_id: string
          session_timer?: NonNullable<Json>
          trainer_id: string
          updated_at?: string
        }
        Update: {
          block_timers?: NonNullable<Json>
          completed_blocks?: number[]
          content_version_id?: string | null
          current_block?: number
          session_id?: string
          session_timer?: NonNullable<Json>
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_player_states_content_version_id_fkey"
            columns: ["content_version_id"]
            referencedRelation: "pedagogical_content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_player_states_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_player_states_trainer_id_fkey"
            columns: ["trainer_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_player_states_trainer_id_fkey"
            columns: ["trainer_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      session_skill_map: {
        Row: {
          id: string
          session_number: number
          skill_id: string
          version_id: string
          weight: number
        }
        ComputedFields: never
        Insert: {
          id?: string
          session_number: number
          skill_id: string
          version_id: string
          weight?: number
        }
        Update: {
          id?: string
          session_number?: number
          skill_id?: string
          version_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_skill_map_skill_id_fkey"
            columns: ["skill_id"]
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_skill_map_version_id_fkey"
            columns: ["version_id"]
            referencedRelation: "framework_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          end_time: string | null
          group_id: string
          id: string
          location: string | null
          number: number
          program_session_id: string
          scheduled_date: string | null
          start_time: string | null
          started_at: string | null
          status: string
          trainer_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          group_id: string
          id?: string
          location?: string | null
          number: number
          program_session_id: string
          scheduled_date?: string | null
          start_time?: string | null
          started_at?: string | null
          status?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          group_id?: string
          id?: string
          location?: string | null
          number?: number
          program_session_id?: string
          scheduled_date?: string | null
          start_time?: string | null
          started_at?: string | null
          status?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_program_session_id_fkey"
            columns: ["program_session_id"]
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_trainer_id_fkey"
            columns: ["trainer_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_trainer_id_fkey"
            columns: ["trainer_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_categories: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
          position: number
          version_id: string
        }
        ComputedFields: never
        Insert: {
          code: string
          description?: string | null
          id?: string
          name: string
          position?: number
          version_id: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_categories_version_id_fkey"
            columns: ["version_id"]
            referencedRelation: "framework_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_criteria: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          label: string
          position: number
          skill_id: string
          weight: number
        }
        ComputedFields: never
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          position?: number
          skill_id: string
          weight?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          skill_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_criteria_skill_id_fkey"
            columns: ["skill_id"]
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_level_descriptors: {
        Row: {
          description: string
          id: string
          level_value: number
          skill_id: string
        }
        ComputedFields: never
        Insert: {
          description: string
          id?: string
          level_value: number
          skill_id: string
        }
        Update: {
          description?: string
          id?: string
          level_value?: number
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_level_descriptors_skill_id_fkey"
            columns: ["skill_id"]
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category_id: string | null
          code: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          version_id: string
          weight: number
        }
        ComputedFields: never
        Insert: {
          category_id?: string | null
          code: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          version_id: string
          weight?: number
        }
        Update: {
          category_id?: string | null
          code?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          version_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skills_version_id_fkey"
            columns: ["version_id"]
            referencedRelation: "framework_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_notes: {
        Row: {
          block_key: string
          body: string
          id: string
          session_id: string
          trainer_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          block_key?: string
          body?: string
          id?: string
          session_id: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          block_key?: string
          body?: string
          id?: string
          session_id?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_notes_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_notes_trainer_id_fkey"
            columns: ["trainer_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_notes_trainer_id_fkey"
            columns: ["trainer_id"]
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      staff_directory: {
        Row: {
          first_name: string | null
          id: string | null
          last_name: string | null
          role: string | null
        }
        ComputedFields: never
        Insert: {
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          role?: string | null
        }
        Update: {
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_fkey"
            columns: ["role"]
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      add_participant_to_group: {
        Args: {
          p_email?: string
          p_first_name?: string
          p_group_id: string
          p_last_name?: string
          p_participant_id?: string
        }
        Returns: Json
      }
      amend_evaluation: {
        Args: {
          p_comments?: Json
          p_criteria?: Json
          p_evaluation_id: string
          p_reason: string
          p_scores?: Json
        }
        Returns: number
      }
      check_invitation_code: { Args: { p_code: string }; Returns: Json }
      claim_email_outbox: {
        Args: { p_limit?: number; p_max_attempts?: number }
        Returns: Database["public"]["Tables"]["email_outbox"]["Row"][]
      }
      clone_framework_version: {
        Args: { p_label?: string; p_source_version_id: string }
        Returns: string
      }
      clone_questionnaire_version: {
        Args: { p_label?: string; p_source_version_id: string }
        Returns: string
      }
      consume_passport_share: {
        Args: { p_ip_hash?: string; p_token_hash: string }
        Returns: Json
      }
      create_passport_share: {
        Args: {
          p_duration_days: number
          p_include_report?: boolean
          p_include_sociocognitive?: boolean
          p_label: string
          p_token_ciphertext: string
          p_token_hash: string
        }
        Returns: string
      }
      create_invitation_code: {
        Args: {
          p_expires_at?: string
          p_label?: string
          p_organization_id?: string
          p_role: string
        }
        Returns: {
          code: string
          id: string
        }[]
      }
      correct_attendance: {
        Args: { p_participant_id: string; p_reason: string; p_session_id: string; p_status: string }
        Returns: undefined
      }
      get_public_catalog: { Args: Record<PropertyKey, never>; Returns: Json }
      import_pedagogical_version: {
        Args: {
          p_change_note?: string
          p_is_provisional?: boolean
          p_markdown: string
          p_program_session_id: string
          p_publish?: boolean
          p_source_filename?: string
        }
        Returns: string
      }
      log_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      my_mfa_status: { Args: Record<PropertyKey, never>; Returns: Json }
      my_passport_share_secret: { Args: { p_share_id: string }; Returns: string }
      my_attendance_signing: {
        Args: Record<PropertyKey, never>
        Returns: {
          attendance_status: string | null
          can_sign: boolean
          end_time: string | null
          frozen: boolean
          group_name: string
          scheduled_date: string | null
          session_id: string
          session_number: number
          session_status: string
          signed_at: string | null
          start_time: string | null
          title: string
        }[]
      }
      process_deletion_request: {
        Args: { p_note?: string; p_request_id: string }
        Returns: string
      }
      publish_pedagogical_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      rate_limit_hit: {
        Args: {
          p_action: string
          p_key_hash: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: Json
      }
      redeem_invitation_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: Json
      }
      revoke_invitation_code: { Args: { p_id: string }; Returns: undefined }
      revoke_passport_share: { Args: { p_share_id: string }; Returns: undefined }
      save_evaluation_draft: {
        Args: {
          p_comments?: Json
          p_criteria?: Json
          p_participant_id: string
          p_scores?: Json
          p_session_id: string
        }
        Returns: string
      }
      submit_contact_message: {
        Args: {
          p_audience: string
          p_email: string
          p_message: string
          p_name: string
          p_organization: string
          p_origin_hash: string
        }
        Returns: string
      }
      validate_evaluation: {
        Args: { p_evaluation_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
