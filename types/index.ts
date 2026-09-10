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

export type ModalidadPedido = "retiro" | "envio_propio" | "envio_puni";
export type EstadoPedido = "generado" | "confirmado" | "rechazado" | "cancelado";

export type Pedido = {
  id: string;
  idempotency_key: string;
  request_hash: string;
  vianderas_id: string;
  modalidad: ModalidadPedido;
  costo_envio_capturado: number;
  total: number;
  estado: EstadoPedido;
  nombre_comprador: string | null;
  telefono_comprador: string | null;
  direccion_envio: string | null;
  acepta_marketing: boolean;
  consentimiento_marketing_en: string | null;
  purgar_datos_en: string;
  datos_purgados: boolean;
  created_at: string;
  updated_at: string;
};

export type PedidoItem = {
  id: string;
  pedido_id: string;
  vianda_id: string | null;
  nombre_capturado: string;
  precio_capturado: number;
  cantidad: number;
  subtotal: number;
};

export type PedidoCambio =
  | { tipo: "plato_no_disponible"; vianda_id: string }
  | {
      tipo: "precio_cambio";
      vianda_id: string;
      precio_esperado: number;
      precio_actual: number;
    }
  | { tipo: "modalidad_no_disponible"; modalidad: string | null }
  | {
      tipo: "costo_envio_cambio";
      modalidad: ModalidadPedido;
      costo_esperado: number;
      costo_actual: number;
    };

export type PedidoResultado =
  | { ok: true; pedido: Pedido; cambios: [] }
  | { ok: false; pedido: null; cambios: PedidoCambio[] };

export type LimiteSolicitud = {
  clave: string;
  ventana_inicio: string;
  intentos: number;
  created_at: string;
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

export type TipoCrmContacto =
  | "cocina_potencial"
  | "cocina_activa"
  | "consumidor"
  | "aliado_estrategico"
  | "otro";

export type FuenteCrmContacto =
  | "landing_interes"
  | "explorador"
  | "pedido"
  | "referido"
  | "contacto_directo"
  | "otro";

export type EstadoCrmContacto =
  | "nuevo"
  | "en_conversacion"
  | "calificado"
  | "activo"
  | "inactivo"
  | "descartado";

export type TipoCrmInteraccion =
  | "llamada"
  | "whatsapp"
  | "email"
  | "reunion"
  | "cambio_estado"
  | "otro";

export type CrmContacto = {
  id: string;
  tipo: TipoCrmContacto;
  viandera_id: string | null;
  interesado_id: string | null;
  nombre_libre: string | null;
  contacto_libre: string | null;
  contacto_normalizado: string | null;
  fuente: FuenteCrmContacto;
  estado: EstadoCrmContacto;
  etiquetas: string[];
  consentimiento_retirado_en: string | null;
  pii_eliminada: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmContactoResumen = {
  id: string;
  tipo: TipoCrmContacto;
  fuente: FuenteCrmContacto;
  estado: EstadoCrmContacto;
  etiquetas: string[];
  consentimiento_retirado_en: string | null;
  pii_eliminada: boolean;
  nombre: string | null;
  contacto: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmNota = {
  id: string;
  contacto_id: string;
  texto: string;
  created_at: string;
};

export type CrmTarea = {
  id: string;
  contacto_id: string;
  titulo: string;
  vence_en: string | null;
  completada: boolean;
  completada_en: string | null;
  created_at: string;
};

export type CrmInteraccion = {
  id: string;
  contacto_id: string;
  tipo: TipoCrmInteraccion;
  resumen: string;
  metadata: JsonObject;
  created_at: string;
};

export type CrmContactoPedido = {
  contacto_id: string;
  pedido_id: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      pedidos: {
        Row: Pedido;
        Insert: Pick<
          Pedido,
          "idempotency_key" | "request_hash" | "vianderas_id" | "modalidad" | "total"
        > &
          Partial<
            Omit<
              Pedido,
              "idempotency_key" | "request_hash" | "vianderas_id" | "modalidad" | "total"
            >
          >;
        Update: Partial<Omit<Pedido, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      pedido_items: {
        Row: PedidoItem;
        Insert: Omit<PedidoItem, "id" | "subtotal" | "vianda_id"> &
          Partial<Pick<PedidoItem, "id" | "vianda_id">>;
        Update: Partial<Omit<PedidoItem, "id" | "subtotal">>;
        Relationships: [];
      };
      limite_solicitudes: {
        Row: LimiteSolicitud;
        Insert: Pick<LimiteSolicitud, "clave" | "ventana_inicio"> &
          Partial<Pick<LimiteSolicitud, "intentos" | "created_at">>;
        Update: Partial<LimiteSolicitud>;
        Relationships: [];
      };
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
      crm_contactos: {
        Row: CrmContacto;
        Insert: Pick<CrmContacto, "tipo" | "fuente"> &
          Partial<
            Omit<
              CrmContacto,
              "id" | "created_at" | "updated_at" | "tipo" | "fuente" | "contacto_normalizado"
            >
          >;
        Update: Partial<
          Omit<CrmContacto, "id" | "created_at" | "updated_at" | "contacto_normalizado">
        >;
        Relationships: [];
      };
      crm_contacto_pedidos: {
        Row: CrmContactoPedido;
        Insert: Omit<CrmContactoPedido, "created_at"> &
          Partial<Pick<CrmContactoPedido, "created_at">>;
        Update: Partial<CrmContactoPedido>;
        Relationships: [];
      };
      crm_notas: {
        Row: CrmNota;
        Insert: Omit<CrmNota, "id" | "created_at">;
        Update: Partial<Omit<CrmNota, "id" | "created_at">>;
        Relationships: [];
      };
      crm_tareas: {
        Row: CrmTarea;
        Insert: Omit<
          CrmTarea,
          "id" | "created_at" | "completada" | "completada_en" | "vence_en"
        > &
          Partial<Pick<CrmTarea, "completada" | "completada_en" | "vence_en">>;
        Update: Partial<Omit<CrmTarea, "id" | "created_at">>;
        Relationships: [];
      };
      crm_interacciones: {
        Row: CrmInteraccion;
        Insert: Omit<CrmInteraccion, "id" | "created_at" | "metadata"> &
          Partial<Pick<CrmInteraccion, "metadata">>;
        Update: Partial<Omit<CrmInteraccion, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: {
      crm_contactos_resumen: {
        Row: CrmContactoResumen;
        Relationships: [];
      };
    };
    Functions: {
      crear_pedido_atomico: {
        Args: {
          p_idempotency_key: string;
          p_vianderas_id: string;
          p_modalidad: ModalidadPedido;
          p_costo_envio_esperado: number;
          p_items: Json;
          p_nombre_comprador: string | null;
          p_telefono_comprador: string | null;
          p_direccion_envio: string | null;
          p_acepta_marketing: boolean;
        };
        Returns: PedidoResultado;
      };
      registrar_intento_limite: {
        Args: { p_clave: string; p_ventana_inicio: string };
        Returns: number;
      };
    };
    CompositeTypes: {
      pedido_resultado: PedidoResultado;
    };
  };
};
