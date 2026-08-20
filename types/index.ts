export type TipoVianda = "almuerzo" | "cena" | "ambos";

export type Viandera = {
  id: string;
  nombre: string;
  bio: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
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
  created_at: string;
};

export type InteresadoViandera = {
  id: string;
  nombre: string;
  contacto: string;
  zona: string | null;
  mensaje: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      vianderas: {
        Row: Viandera;
        Insert: Omit<Viandera, "id" | "created_at">;
        Update: Partial<Omit<Viandera, "id" | "created_at">>;
        Relationships: [];
      };
      viandas: {
        Row: Vianda;
        Insert: Omit<Vianda, "id" | "created_at">;
        Update: Partial<Omit<Vianda, "id" | "created_at">>;
        Relationships: [];
      };
      interesados_viandera: {
        Row: InteresadoViandera;
        Insert: Omit<InteresadoViandera, "id" | "created_at">;
        Update: Partial<Omit<InteresadoViandera, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
