export type TipoVianda = "almuerzo" | "cena" | "ambos";

export interface Viandera {
  id: string;
  nombre: string;
  bio: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
}

export interface Vianda {
  id: string;
  vianderas_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  tipo: TipoVianda;
  foto_url: string | null;
  disponible: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      vianderas: {
        Row: Viandera;
        Insert: Omit<Viandera, "id" | "created_at">;
        Update: Partial<Omit<Viandera, "id" | "created_at">>;
      };
      viandas: {
        Row: Vianda;
        Insert: Omit<Vianda, "id" | "created_at">;
        Update: Partial<Omit<Vianda, "id" | "created_at">>;
      };
    };
  };
}
