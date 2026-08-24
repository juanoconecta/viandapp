export const ETIQUETAS_DIETARIAS = [
  { valor: "vegetariano", etiqueta: "Vegetariano" },
  { valor: "vegano", etiqueta: "Vegano" },
  { valor: "sin-tacc", etiqueta: "Sin TACC (celíaco)" },
  { valor: "apto-diabetico", etiqueta: "Apto diabético" },
  { valor: "sin-lactosa", etiqueta: "Sin lactosa" },
  { valor: "picante", etiqueta: "Picante" },
  { valor: "sin-azucar", etiqueta: "Sin azúcar" },
] as const;

export type EtiquetaDietaria = (typeof ETIQUETAS_DIETARIAS)[number]["valor"];
