// Tipos do schema `public` (docs/pfitness_schema.sql), no mesmo formato do
// `supabase gen types typescript`. Para regenerar a partir do banco:
//   SUPABASE_PROJECT_REF=<ref> npm run db:types

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
      achievements: {
        Row: {
          badge_code: string
          badge_unit: string
          description: string
          id: string
          name: string
          target: number
        }
        Insert: {
          badge_code: string
          badge_unit: string
          description: string
          id: string
          name: string
          target: number
        }
        Update: {
          badge_code?: string
          badge_unit?: string
          description?: string
          id?: string
          name?: string
          target?: number
        }
        Relationships: []
      }
      daily_goals: {
        Row: {
          carbs_g: number
          fat_g: number
          id: number
          kcal: number
          protein_g: number
          user_id: string
          valid_from: string
        }
        Insert: {
          carbs_g: number
          fat_g: number
          id?: never
          kcal: number
          protein_g: number
          user_id: string
          valid_from?: string
        }
        Update: {
          carbs_g?: number
          fat_g?: number
          id?: never
          kcal?: number
          protein_g?: number
          user_id?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          equipment: string | null
          id: number
          muscle_group: string
          name: string
          user_id: string | null
          weight_increment: number
        }
        Insert: {
          created_at?: string
          equipment?: string | null
          id?: never
          muscle_group: string
          name: string
          user_id?: string | null
          weight_increment?: number
        }
        Update: {
          created_at?: string
          equipment?: string | null
          id?: never
          muscle_group?: string
          name?: string
          user_id?: string | null
          weight_increment?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_logs: {
        Row: {
          eaten_on: string
          food_id: number
          grams: number
          id: number
          logged_at: string
          meal: Database["public"]["Enums"]["meal_type"]
          user_id: string
        }
        Insert: {
          eaten_on?: string
          food_id: number
          grams: number
          id?: never
          logged_at?: string
          meal: Database["public"]["Enums"]["meal_type"]
          user_id: string
        }
        Update: {
          eaten_on?: string
          food_id?: number
          grams?: number
          id?: never
          logged_at?: string
          meal?: Database["public"]["Enums"]["meal_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_logs_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          carbs_100g: number
          default_grams: number
          fat_100g: number
          id: number
          kcal_100g: number
          name: string
          protein_100g: number
          source: string | null
          user_id: string | null
        }
        Insert: {
          carbs_100g: number
          default_grams?: number
          fat_100g: number
          id?: never
          kcal_100g: number
          name: string
          protein_100g: number
          source?: string | null
          user_id?: string | null
        }
        Update: {
          carbs_100g?: number
          default_grams?: number
          fat_100g?: number
          id?: never
          kcal_100g?: number
          name?: string
          protein_100g?: number
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_exercises: {
        Row: {
          exercise_id: number
          id: number
          plan_id: number
          position: number
          rest_seconds: number
          target_reps: number
          target_sets: number
        }
        Insert: {
          exercise_id: number
          id?: never
          plan_id: number
          position: number
          rest_seconds?: number
          target_reps: number
          target_sets: number
        }
        Update: {
          exercise_id?: number
          id?: never
          plan_id?: number
          position?: number
          rest_seconds?: number
          target_reps?: number
          target_sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_exercises_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      point_events: {
        Row: {
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["point_kind"]
          points: number
          ref_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["point_kind"]
          points: number
          ref_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["point_kind"]
          points?: number
          ref_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          goal: Database["public"]["Enums"]["goal_type"]
          height_cm: number | null
          id: string
          name: string
          sex: Database["public"]["Enums"]["sex_type"] | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          goal?: Database["public"]["Enums"]["goal_type"]
          height_cm?: number | null
          id: string
          name: string
          sex?: Database["public"]["Enums"]["sex_type"] | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          goal?: Database["public"]["Enums"]["goal_type"]
          height_cm?: number | null
          id?: string
          name?: string
          sex?: Database["public"]["Enums"]["sex_type"] | null
        }
        Relationships: []
      }
      session_sets: {
        Row: {
          completed_at: string
          exercise_id: number
          id: number
          is_pr: boolean
          reps: number
          session_id: number
          set_number: number
          status: Database["public"]["Enums"]["set_status"]
          weight_kg: number
        }
        Insert: {
          completed_at?: string
          exercise_id: number
          id?: never
          is_pr?: boolean
          reps?: number
          session_id: number
          set_number: number
          status: Database["public"]["Enums"]["set_status"]
          weight_kg?: number
        }
        Update: {
          completed_at?: string
          exercise_id?: number
          id?: never
          is_pr?: boolean
          reps?: number
          session_id?: number
          set_number?: number
          status?: Database["public"]["Enums"]["set_status"]
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          id: number
          logged_on: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          id?: never
          logged_on?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          id?: never
          logged_on?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          archived: boolean
          code: string
          created_at: string
          id: number
          position: number
          title: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          code: string
          created_at?: string
          id?: never
          position?: number
          title: string
          user_id: string
        }
        Update: {
          archived?: boolean
          code?: string
          created_at?: string
          id?: never
          position?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          finished_at: string | null
          id: number
          plan_id: number | null
          plan_title: string | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          user_id: string
        }
        Insert: {
          finished_at?: string | null
          id?: never
          plan_id?: number | null
          plan_title?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          user_id: string
        }
        Update: {
          finished_at?: string | null
          id?: never
          plan_id?: number | null
          plan_title?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_daily_nutrition: {
        Row: {
          carbs_g: number | null
          eaten_on: string | null
          fat_g: number | null
          kcal: number | null
          protein_g: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_exercise_best: {
        Row: {
          best_kg: number | null
          exercise_id: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_exercise_last: {
        Row: {
          exercise_id: number | null
          reps: number | null
          set_number: number | null
          user_id: string | null
          weight_kg: number | null
        }
        Relationships: []
      }
      v_food_log_detail: {
        Row: {
          carbs_g: number | null
          eaten_on: string | null
          fat_g: number | null
          grams: number | null
          id: number | null
          kcal: number | null
          logged_at: string | null
          meal: Database["public"]["Enums"]["meal_type"] | null
          name: string | null
          protein_g: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_user_xp: {
        Row: {
          level: number | null
          user_id: string | null
          xp: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_streak: { Args: { p_user: string }; Returns: number }
      save_workout_plan: {
        Args: { p_exercises: Json; p_plan_id?: number; p_title: string }
        Returns: number
      }
    }
    Enums: {
      goal_type: "ganhar_massa" | "perder_gordura" | "manter"
      meal_type: "cafe" | "almoco" | "lanche" | "jantar" | "ceia"
      point_kind:
        | "serie"
        | "pr"
        | "treino_concluido"
        | "alimento"
        | "conquista"
        | "bonus"
      session_status: "em_andamento" | "concluido" | "cancelado"
      set_status: "concluida" | "pulada"
      sex_type: "masculino" | "feminino" | "outro"
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
      goal_type: ["ganhar_massa", "perder_gordura", "manter"],
      meal_type: ["cafe", "almoco", "lanche", "jantar", "ceia"],
      point_kind: [
        "serie",
        "pr",
        "treino_concluido",
        "alimento",
        "conquista",
        "bonus",
      ],
      session_status: ["em_andamento", "concluido", "cancelado"],
      set_status: ["concluida", "pulada"],
      sex_type: ["masculino", "feminino", "outro"],
    },
  },
} as const
