import { ETIQUETAS_DIETARIAS } from "../viandera/etiquetas";

const TIPOS_VALIDOS = ["todos", "almuerzo", "cena"] as const;
const MODALIDADES_VALIDAS = ["todas", "retiro", "envio"] as const;
const LARGO_MAXIMO_Q = 80;

export type FiltrosExplorador = {
  q: string;
  tipo: "todos" | "almuerzo" | "cena";
  etiqueta: string | null;
  modalidad: "todas" | "retiro" | "envio";
};

function primerValor(
  valor: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export function parsearFiltros(
  params: Record<string, string | string[] | undefined>,
): FiltrosExplorador {
  const q = (primerValor(params.q) ?? "").trim().slice(0, LARGO_MAXIMO_Q);

  const tipoCandidato = primerValor(params.tipo);
  const tipo = (
    TIPOS_VALIDOS as readonly string[]
  ).includes(tipoCandidato ?? "")
    ? (tipoCandidato as FiltrosExplorador["tipo"])
    : "todos";

  const etiquetaCandidato = primerValor(params.etiqueta);
  const etiqueta = ETIQUETAS_DIETARIAS.some(
    (e) => e.valor === etiquetaCandidato,
  )
    ? (etiquetaCandidato as string)
    : null;

  const modalidadCandidato = primerValor(params.modalidad);
  const modalidad = (
    MODALIDADES_VALIDAS as readonly string[]
  ).includes(modalidadCandidato ?? "")
    ? (modalidadCandidato as FiltrosExplorador["modalidad"])
    : "todas";

  return { q, tipo, etiqueta, modalidad };
}
