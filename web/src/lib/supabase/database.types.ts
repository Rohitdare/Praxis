export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ItemType =
  | "unclassified"
  | "resource"
  | "note"
  | "task"
  | "event"
  | "idea"

export type ItemStatus = "inbox" | "active" | "done" | "archived"

export type ResourceStatus = "unread" | "reading" | "completed"

export type TaskPriority = "low" | "normal" | "high"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          timezone: string
          ai_enabled: boolean
          ai_public_resources: boolean
          ai_personal_types: boolean
          feature_preferences: Record<string, boolean>
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          timezone?: string
          ai_enabled?: boolean
          ai_public_resources?: boolean
          ai_personal_types?: boolean
          feature_preferences?: Record<string, boolean>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          timezone?: string
          ai_enabled?: boolean
          ai_public_resources?: boolean
          ai_personal_types?: boolean
          feature_preferences?: Record<string, boolean>
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          id: string
          user_id: string
          type: ItemType
          status: ItemStatus
          raw_input: string
          title: string | null
          content: string | null
          captured_at: string
          created_at: string
          updated_at: string
          deleted_at: string | null
          ai_type: string | null
          ai_tags: string[] | null
          ai_confidence: number | null
          ai_model: string | null
          fts: unknown | null
        }
        Insert: {
          id: string
          user_id?: string
          type?: ItemType
          status?: ItemStatus
          raw_input: string
          title?: string | null
          content?: string | null
          captured_at: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          ai_type?: string | null
          ai_tags?: string[] | null
          ai_confidence?: number | null
          ai_model?: string | null
          fts?: unknown | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: ItemType
          status?: ItemStatus
          raw_input?: string
          title?: string | null
          content?: string | null
          captured_at?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          ai_type?: string | null
          ai_tags?: string[] | null
          ai_confidence?: number | null
          ai_model?: string | null
          fts?: unknown | null
        }
        Relationships: [
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          item_id: string
          user_id: string
          url: string
          domain: string | null
          fetched_title: string | null
          description: string | null
          image_url: string | null
          resource_status: ResourceStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          item_id: string
          user_id: string
          url: string
          domain?: string | null
          fetched_title?: string | null
          description?: string | null
          image_url?: string | null
          resource_status?: ResourceStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          item_id?: string
          user_id?: string
          url?: string
          domain?: string | null
          fetched_title?: string | null
          description?: string | null
          image_url?: string | null
          resource_status?: ResourceStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          item_id: string
          user_id: string
          due_at: string | null
          priority: TaskPriority
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          item_id: string
          user_id: string
          due_at?: string | null
          priority?: TaskPriority
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          item_id?: string
          user_id?: string
          due_at?: string | null
          priority?: TaskPriority
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          item_id: string
          user_id: string
          start_at: string
          end_at: string | null
          all_day: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          item_id: string
          user_id: string
          start_at: string
          end_at?: string | null
          all_day?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          item_id?: string
          user_id?: string
          start_at?: string
          end_at?: string | null
          all_day?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
        }
        Insert: {
          id: string
          user_id: string
          name: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
        }
        Relationships: []
      }
      item_tags: {
        Row: {
          item_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          item_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          item_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      item_relationships: {
        Row: {
          id: string
          user_id: string
          source_id: string
          target_id: string
          relationship_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          source_id: string
          target_id: string
          relationship_type: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_id?: string
          target_id?: string
          relationship_type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_relationships_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_relationships_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      classify_and_update_item: {
        Args: {
          p_item_id: string
          p_type: string
          p_title?: string | null
          p_content?: string | null
          p_status?: string | null
          p_due_at?: string | null
          p_priority?: string | null
          p_completed_at?: string | null
          p_url?: string | null
          p_domain?: string | null
          p_resource_status?: string | null
          p_start_at?: string | null
          p_end_at?: string | null
          p_all_day?: boolean | null
        }
        Returns: Json
      }
    }
    Enums: {
      item_type: ItemType
      item_status: ItemStatus
      resource_status: ResourceStatus
      task_priority: TaskPriority
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
