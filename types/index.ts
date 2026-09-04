export type TipoVianda = "almuerzo" | "cena" | "ambos";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type JsonObject = { [key: string]: Json | undefined };

export type Viandera = {
  id: string;
  nombre: string;
  bio: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  activo: boolean;
  user_id: string | null;
  slug: string | null;
  barrio: string | null;
  ofrece_retiro: boolean;
  ofrece_envio: boolean;
  costo_envio_propio: number | null;
  cobertura_envio: string | null;
  created_at: string;
  updated_at: string;
};

export type EstadoAdhesionPuni =
  | "pendiente"
  | "aprobada"
  | "rechazada"
  | "suspendida"
  | "revocada";

export type PuniAdhesion = {
  id: string;
  viandera_id: string;
  estado: EstadoAdhesionPuni;
  costo_envio_puni: number | null;
  solicitado_en: string;
  resuelto_en: string | null;
  resuelto_por: string | null;
  nota_admin: string | null;
  created_at: string;
  updated_at: string;
};

export type Vianda = {
  id: string;
  vianderas_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  tipo: TipoVianda;
  foto_url: string | null;
  disponible: boolean;
  etiquetas: string[];
  created_at: string;
  updated_at: string;
};

export type InteresadoViandera = {
  id: string;
  nombre: string;
  contacto: string;
  zona: string | null;
  instagram: string | null;
  mensaje: string | null;
  created_at: string;
};

export type NombreEventoAnalitica =
  | "explore_viewed"
  | "search_submitted"
  | "filter_applied"
  | "profile_viewed"
  | "dish_selected"
  | "whatsapp_intent"
  | "whatsapp_clicked";

export type EventoAnalitica = {
  id: string;
  nombre: NombreEventoAnalitica;
  viandera_id: string | null;
  vianda_id: string | null;
  metadata: JsonObject;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      vianderas: {
        Row: Viandera;
        Insert: Omit<
          Viandera,
          | "id"
          | "created_at"
          | "updated_at"
          | "barrio"
          | "ofrece_retiro"
          | "ofrece_envio"
          | "costo_envio_propio"
          | "cobertura_envio"
        > &
          Partial<
            Pick<
              Viandera,
              | "barrio"
              | "ofrece_retiro"
              | "ofrece_envio"
              | "costo_envio_propio"
              | "cobertura_envio"
            >
          >;
        Update: Partial<Omit<Viandera, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      puni_adhesiones: {
        Row: PuniAdhesion;
        Insert: Omit<
          PuniAdhesion,
          | "id"
          | "created_at"
          | "updated_at"
          | "solicitado_en"
          | "estado"
          | "costo_envio_puni"
          | "resuelto_en"
          | "resuelto_por"
          | "nota_admin"
        > &
          Partial<
            Pick<
              PuniAdhesion,
              | "estado"
              | "costo_envio_puni"
              | "resuelto_en"
              | "resuelto_por"
              | "nota_admin"
            >
          >;
        Update: Partial<Omit<PuniAdhesion, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      viandas: {
        Row: Vianda;
        Insert: Omit<Vianda, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Vianda, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      interesados_viandera: {
        Row: InteresadoViandera;
        Insert: Omit<InteresadoViandera, "id" | "created_at">;
        Update: Partial<Omit<InteresadoViandera, "id" | "created_at">>;
        Relationships: [];
      };
      eventos_analitica: {
        Row: EventoAnalitica;
        Insert: Omit<
          EventoAnalitica,
          "id" | "created_at" | "viandera_id" | "vianda_id" | "metadata"
        > &
          Partial<Pick<EventoAnalitica, "viandera_id" | "vianda_id" | "metadata">>;
        Update: Partial<Omit<EventoAnalitica, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
