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
      addresses: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          label: string | null
          line1: string
          line2: string | null
          neighborhood: string | null
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          line1: string
          line2?: string | null
          neighborhood?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          line1?: string
          line2?: string | null
          neighborhood?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      availability_override_slots: {
        Row: {
          date: string
          id: string
          is_open: boolean
          time: string
        }
        Insert: {
          date: string
          id?: string
          is_open?: boolean
          time: string
        }
        Update: {
          date?: string
          id?: string
          is_open?: boolean
          time?: string
        }
        Relationships: []
      }
      availability_overrides: {
        Row: {
          date: string
          id: string
          is_closed: boolean
          note: string | null
          surcharge_amount: number | null
          surcharge_percent: number | null
          updated_at: string
        }
        Insert: {
          date: string
          id?: string
          is_closed?: boolean
          note?: string | null
          surcharge_amount?: number | null
          surcharge_percent?: number | null
          updated_at?: string
        }
        Update: {
          date?: string
          id?: string
          is_closed?: boolean
          note?: string | null
          surcharge_amount?: number | null
          surcharge_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      availability_rules: {
        Row: {
          end_time: string
          id: string
          is_open: boolean
          slot_interval_minutes: number
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          end_time?: string
          id?: string
          is_open?: boolean
          slot_interval_minutes?: number
          start_time?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          is_open?: boolean
          slot_interval_minutes?: number
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      bookings: {
        Row: {
          addons: Json | null
          addons_total_cents: number | null
          address: string | null
          base_price_ars: number | null
          booking_date: string
          booking_source: string | null
          booking_time: string
          booking_type: string | null
          car_type: string | null
          car_type_extra_cents: number | null
          confirmed_at: string | null
          created_at: string
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          extras_total_ars: number | null
          id: string
          is_subscription_booking: boolean | null
          mercadopago_payment_id: string | null
          mercadopago_preference_id: string | null
          notes: string | null
          notifications_queued: boolean | null
          payment_intent_id: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pricing_version_id: string | null
          requires_payment: boolean | null
          service_code: string | null
          service_name: string
          service_price_cents: number
          status: Database["public"]["Enums"]["booking_status"]
          subscription_id: string | null
          total_cents: number | null
          total_price_ars: number | null
          updated_at: string
          user_id: string | null
          vehicle_extra_ars: number | null
          vehicle_size: string | null
          webhook_processed_at: string | null
          whatsapp_last_error: string | null
          whatsapp_last_message_type: string | null
          whatsapp_message_status: string | null
          whatsapp_opt_in: boolean | null
        }
        Insert: {
          addons?: Json | null
          addons_total_cents?: number | null
          address?: string | null
          base_price_ars?: number | null
          booking_date: string
          booking_source?: string | null
          booking_time: string
          booking_type?: string | null
          car_type?: string | null
          car_type_extra_cents?: number | null
          confirmed_at?: string | null
          created_at?: string
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          extras_total_ars?: number | null
          id?: string
          is_subscription_booking?: boolean | null
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          notes?: string | null
          notifications_queued?: boolean | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pricing_version_id?: string | null
          requires_payment?: boolean | null
          service_code?: string | null
          service_name: string
          service_price_cents: number
          status?: Database["public"]["Enums"]["booking_status"]
          subscription_id?: string | null
          total_cents?: number | null
          total_price_ars?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_extra_ars?: number | null
          vehicle_size?: string | null
          webhook_processed_at?: string | null
          whatsapp_last_error?: string | null
          whatsapp_last_message_type?: string | null
          whatsapp_message_status?: string | null
          whatsapp_opt_in?: boolean | null
        }
        Update: {
          addons?: Json | null
          addons_total_cents?: number | null
          address?: string | null
          base_price_ars?: number | null
          booking_date?: string
          booking_source?: string | null
          booking_time?: string
          booking_type?: string | null
          car_type?: string | null
          car_type_extra_cents?: number | null
          confirmed_at?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          extras_total_ars?: number | null
          id?: string
          is_subscription_booking?: boolean | null
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          notes?: string | null
          notifications_queued?: boolean | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pricing_version_id?: string | null
          requires_payment?: boolean | null
          service_code?: string | null
          service_name?: string
          service_price_cents?: number
          status?: Database["public"]["Enums"]["booking_status"]
          subscription_id?: string | null
          total_cents?: number | null
          total_price_ars?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_extra_ars?: number | null
          vehicle_size?: string | null
          webhook_processed_at?: string | null
          whatsapp_last_error?: string | null
          whatsapp_last_message_type?: string | null
          whatsapp_message_status?: string | null
          whatsapp_opt_in?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "pricing_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      cars: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          model: string | null
          nickname: string | null
          plate: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          model?: string | null
          nickname?: string | null
          plate?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          model?: string | null
          nickname?: string | null
          plate?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          phone_e164: string
          whatsapp_last_message_at: string | null
          whatsapp_opt_in: boolean | null
          whatsapp_opt_in_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone_e164: string
          whatsapp_last_message_at?: string | null
          whatsapp_opt_in?: boolean | null
          whatsapp_opt_in_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone_e164?: string
          whatsapp_last_message_at?: string | null
          whatsapp_opt_in?: boolean | null
          whatsapp_opt_in_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_ars: number
          booking_id: string | null
          created_at: string
          id: string
          invoice_number: string
          issued_at: string
          metadata: Json
          paid_at: string | null
          pdf_url: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_ars: number
          booking_id?: string | null
          created_at?: string
          id?: string
          invoice_number: string
          issued_at?: string
          metadata?: Json
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_ars?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          metadata?: Json
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "calendar_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      kipper_leads: {
        Row: {
          benefit_type: string | null
          benefit_value: string | null
          booking_id: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          kipper_benefit_applied: boolean | null
          notes: string | null
          source: string
          status: string
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          benefit_type?: string | null
          benefit_value?: string | null
          booking_id?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id?: string
          kipper_benefit_applied?: boolean | null
          notes?: string | null
          source?: string
          status?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          benefit_type?: string | null
          benefit_value?: string | null
          booking_id?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          kipper_benefit_applied?: boolean | null
          notes?: string | null
          source?: string
          status?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kipper_leads_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kipper_leads_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "calendar_bookings_v"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          booking_id: string | null
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          message_content: string | null
          message_type: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          recipient: string
          status: Database["public"]["Enums"]["notification_status"]
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_content?: string | null
          message_type?: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          recipient: string
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_content?: string | null
          message_type?: string | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          recipient?: string
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "calendar_bookings_v"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          attempts: number
          booking_id: string
          created_at: string
          external_id: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          notification_type: string
          recipient: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          booking_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          notification_type: string
          recipient: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          booking_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          notification_type?: string
          recipient?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "calendar_bookings_v"
            referencedColumns: ["id"]
          },
        ]
      }
      outgoing_messages: {
        Row: {
          booking_id: string
          channel: string
          created_at: string
          customer_phone: string
          error: string | null
          id: string
          message: string
          provider_message_id: string | null
          status: string
          type: string
        }
        Insert: {
          booking_id: string
          channel?: string
          created_at?: string
          customer_phone: string
          error?: string | null
          id?: string
          message: string
          provider_message_id?: string | null
          status?: string
          type: string
        }
        Update: {
          booking_id?: string
          channel?: string
          created_at?: string
          customer_phone?: string
          error?: string | null
          id?: string
          message?: string
          provider_message_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "outgoing_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outgoing_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "calendar_bookings_v"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount_ars: number
          booking_id: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          proof_submitted: boolean
          status: Database["public"]["Enums"]["payment_intent_status"]
          subscription_id: string | null
          type: Database["public"]["Enums"]["payment_intent_type"]
          updated_at: string
        }
        Insert: {
          amount_ars: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          proof_submitted?: boolean
          status?: Database["public"]["Enums"]["payment_intent_status"]
          subscription_id?: string | null
          type?: Database["public"]["Enums"]["payment_intent_type"]
          updated_at?: string
        }
        Update: {
          amount_ars?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          proof_submitted?: boolean
          status?: Database["public"]["Enums"]["payment_intent_status"]
          subscription_id?: string | null
          type?: Database["public"]["Enums"]["payment_intent_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "calendar_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          payer_name: string | null
          payment_intent_id: string
          receipt_url: string | null
          reference: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          payer_name?: string | null
          payment_intent_id: string
          receipt_url?: string | null
          reference?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          payer_name?: string | null
          payment_intent_id?: string
          receipt_url?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          account_holder_name: string | null
          bank_name: string | null
          created_at: string | null
          id: string
          is_enabled: boolean
          mp_alias: string
          mp_cvu: string | null
          mp_holder_name: string | null
          mp_notes: string | null
          mp_payment_link: string
          updated_at: string | null
          whatsapp_admin_phone: string | null
        }
        Insert: {
          account_holder_name?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          mp_alias: string
          mp_cvu?: string | null
          mp_holder_name?: string | null
          mp_notes?: string | null
          mp_payment_link: string
          updated_at?: string | null
          whatsapp_admin_phone?: string | null
        }
        Update: {
          account_holder_name?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          mp_alias?: string
          mp_cvu?: string | null
          mp_holder_name?: string | null
          mp_notes?: string | null
          mp_payment_link?: string
          updated_at?: string | null
          whatsapp_admin_phone?: string | null
        }
        Relationships: []
      }
      pricing_items: {
        Row: {
          created_at: string
          display_name: string
          id: string
          item_code: string
          item_type: string
          metadata: Json | null
          price_ars: number
          pricing_version_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          item_code: string
          item_type: string
          metadata?: Json | null
          price_ars?: number
          pricing_version_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          item_code?: string
          item_type?: string
          metadata?: Json | null
          price_ars?: number
          pricing_version_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_items_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "pricing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_versions: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          version_number: number
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          version_number: number
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          version_number?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_addons: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_cents?: number
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          sort_order?: number | null
        }
        Relationships: []
      }
      subscription_credits: {
        Row: {
          created_at: string
          id: string
          month: string
          remaining_credits: number
          subscription_id: string
          total_credits: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          remaining_credits: number
          subscription_id: string
          total_credits: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          remaining_credits?: number
          subscription_id?: string
          total_credits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_credits_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          processed: boolean | null
          subscription_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          subscription_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          mercadopago_plan_id: string | null
          name: string
          price_cents: number
          washes_per_month: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          mercadopago_plan_id?: string | null
          name: string
          price_cents: number
          washes_per_month: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          mercadopago_plan_id?: string | null
          name?: string
          price_cents?: number
          washes_per_month?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          admin_decision_at: string | null
          admin_decision_by: string | null
          admin_decision_reason: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          included_service: string | null
          included_vehicle_size: string | null
          mercadopago_subscription_id: string | null
          plan_code: string | null
          plan_id: string
          pricing_version_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string | null
          washes_remaining: number
          washes_used_in_cycle: number
          whatsapp_last_error: string | null
          whatsapp_last_message_type: string | null
          whatsapp_message_status: string | null
        }
        Insert: {
          admin_decision_at?: string | null
          admin_decision_by?: string | null
          admin_decision_reason?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          included_service?: string | null
          included_vehicle_size?: string | null
          mercadopago_subscription_id?: string | null
          plan_code?: string | null
          plan_id: string
          pricing_version_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string | null
          washes_remaining?: number
          washes_used_in_cycle?: number
          whatsapp_last_error?: string | null
          whatsapp_last_message_type?: string | null
          whatsapp_message_status?: string | null
        }
        Update: {
          admin_decision_at?: string | null
          admin_decision_by?: string | null
          admin_decision_reason?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          included_service?: string | null
          included_vehicle_size?: string | null
          mercadopago_subscription_id?: string | null
          plan_code?: string | null
          plan_id?: string
          pricing_version_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string | null
          washes_remaining?: number
          washes_used_in_cycle?: number
          whatsapp_last_error?: string | null
          whatsapp_last_message_type?: string | null
          whatsapp_message_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "pricing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bookings: {
        Row: {
          address_text: string
          car_details: Json | null
          created_at: string
          id: string
          neighborhood: string | null
          price_ars: number | null
          scheduled_at: string
          service_code: string
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_text: string
          car_details?: Json | null
          created_at?: string
          id?: string
          neighborhood?: string | null
          price_ars?: number | null
          scheduled_at: string
          service_code: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_text?: string
          car_details?: Json | null
          created_at?: string
          id?: string
          neighborhood?: string | null
          price_ars?: number | null
          scheduled_at?: string
          service_code?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bookings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_managed_subscriptions: {
        Row: {
          created_at: string | null
          default_address_id: string | null
          default_car_id: string | null
          id: string
          next_wash_at: string | null
          pause_until: string | null
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string | null
          plan_id: string
          start_date: string | null
          status: string
          updated_at: string | null
          user_id: string
          washes_remaining: number | null
          washes_used_this_month: number | null
        }
        Insert: {
          created_at?: string | null
          default_address_id?: string | null
          default_car_id?: string | null
          id?: string
          next_wash_at?: string | null
          pause_until?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          plan_id: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          washes_remaining?: number | null
          washes_used_this_month?: number | null
        }
        Update: {
          created_at?: string | null
          default_address_id?: string | null
          default_car_id?: string | null
          id?: string
          next_wash_at?: string | null
          pause_until?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          plan_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          washes_remaining?: number | null
          washes_used_this_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_managed_subscriptions_default_address_id_fkey"
            columns: ["default_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_managed_subscriptions_default_car_id_fkey"
            columns: ["default_car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          id: string
          mp_preference_id: string | null
          next_billing_date: string | null
          payment_provider: string | null
          plan_code: string
          price_ars: number
          start_date: string
          status: string
          updated_at: string
          user_id: string
          washes_per_month: number
        }
        Insert: {
          created_at?: string
          id?: string
          mp_preference_id?: string | null
          next_billing_date?: string | null
          payment_provider?: string | null
          plan_code: string
          price_ars: number
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
          washes_per_month: number
        }
        Update: {
          created_at?: string
          id?: string
          mp_preference_id?: string | null
          next_billing_date?: string | null
          payment_provider?: string | null
          plan_code?: string
          price_ars?: number
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          washes_per_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          delivered: boolean
          delivered_at: string | null
          error: string | null
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          error?: string | null
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          signature_valid: boolean | null
          source: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          signature_valid?: boolean | null
          source: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          signature_valid?: boolean | null
          source?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone_e164: string
          id: string
          is_open: boolean
          last_admin_seen_at: string | null
          last_inbound_at: string | null
          last_message_at: string
          last_message_preview: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone_e164: string
          id?: string
          is_open?: boolean
          last_admin_seen_at?: string | null
          last_inbound_at?: string | null
          last_message_at?: string
          last_message_preview?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone_e164?: string
          id?: string
          is_open?: boolean
          last_admin_seen_at?: string | null
          last_inbound_at?: string | null
          last_message_at?: string
          last_message_preview?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          created_by: string | null
          direction: string
          error: string | null
          id: string
          status: string
          twilio_message_sid: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          direction: string
          error?: string | null
          id?: string
          status?: string
          twilio_message_sid?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          error?: string | null
          id?: string
          status?: string
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations_v"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_outbox: {
        Row: {
          attempts: number | null
          created_at: string | null
          customer_id: string | null
          entity_id: string | null
          entity_type: string
          id: string
          language_code: string | null
          last_error: string | null
          next_retry_at: string | null
          sent_at: string | null
          status: string | null
          template_name: string
          template_vars: Json
          to_phone_e164: string
          wa_message_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          customer_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          language_code?: string | null
          last_error?: string | null
          next_retry_at?: string | null
          sent_at?: string | null
          status?: string | null
          template_name: string
          template_vars?: Json
          to_phone_e164: string
          wa_message_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          customer_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          language_code?: string | null
          last_error?: string | null
          next_retry_at?: string | null
          sent_at?: string | null
          status?: string | null
          template_name?: string
          template_vars?: Json
          to_phone_e164?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_outbox_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parameter_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parameter_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parameter_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      calendar_bookings_v: {
        Row: {
          addons: Json | null
          addons_total_cents: number | null
          address: string | null
          booking_date: string | null
          booking_source: string | null
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          booking_time: string | null
          car_type: string | null
          car_type_extra_cents: number | null
          confirmed_at: string | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string | null
          is_subscription_booking: boolean | null
          notes: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          service_name: string | null
          service_price_cents: number | null
          subscription_id: string | null
          total_cents: number | null
          whatsapp_opt_in: boolean | null
        }
        Insert: {
          addons?: Json | null
          addons_total_cents?: number | null
          address?: string | null
          booking_date?: string | null
          booking_source?: string | null
          booking_status?: Database["public"]["Enums"]["booking_status"] | null
          booking_time?: string | null
          car_type?: string | null
          car_type_extra_cents?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string | null
          is_subscription_booking?: boolean | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          service_name?: string | null
          service_price_cents?: number | null
          subscription_id?: string | null
          total_cents?: number | null
          whatsapp_opt_in?: boolean | null
        }
        Update: {
          addons?: Json | null
          addons_total_cents?: number | null
          address?: string | null
          booking_date?: string | null
          booking_source?: string | null
          booking_status?: Database["public"]["Enums"]["booking_status"] | null
          booking_time?: string | null
          car_type?: string | null
          car_type_extra_cents?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string | null
          is_subscription_booking?: boolean | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          service_name?: string | null
          service_price_cents?: number | null
          subscription_id?: string | null
          total_cents?: number | null
          whatsapp_opt_in?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations_v: {
        Row: {
          created_at: string | null
          customer_name: string | null
          customer_phone_e164: string | null
          id: string | null
          is_open: boolean | null
          last_admin_seen_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          unread_count: number | null
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone_e164?: string | null
          id?: string | null
          is_open?: boolean | null
          last_admin_seen_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_count?: never
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone_e164?: string | null
          id?: string | null
          is_open?: boolean | null
          last_admin_seen_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_count?: never
        }
        Relationships: []
      }
    }
    Functions: {
      generate_invoice_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      notification_status: "sent" | "failed" | "pending"
      notification_type: "email" | "whatsapp"
      payment_intent_status: "pending" | "paid" | "expired" | "cancelled"
      payment_intent_type: "one_time" | "subscription_monthly"
      payment_status:
        | "pending"
        | "approved"
        | "rejected"
        | "refunded"
        | "in_process"
      subscription_status:
        | "active"
        | "paused"
        | "cancelled"
        | "payment_failed"
        | "pending"
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
      app_role: ["admin", "user"],
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      notification_status: ["sent", "failed", "pending"],
      notification_type: ["email", "whatsapp"],
      payment_intent_status: ["pending", "paid", "expired", "cancelled"],
      payment_intent_type: ["one_time", "subscription_monthly"],
      payment_status: [
        "pending",
        "approved",
        "rejected",
        "refunded",
        "in_process",
      ],
      subscription_status: [
        "active",
        "paused",
        "cancelled",
        "payment_failed",
        "pending",
      ],
    },
  },
} as const
