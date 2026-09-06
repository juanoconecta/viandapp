"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  agregarPlato,
  cantidadTotal,
  decrementarPlato,
  incrementarPlato,
  reemplazarCarrito,
  vaciarCarrito,
  type CarritoAlmacenado,
  type ResultadoAgregar,
} from "@/lib/carrito/estado";
import {
  crearStorageMemoria,
  leerCarritoSeguro,
  persistirCarritoSeguro,
  resolverStorageSeguro,
} from "@/lib/carrito/storage";

type ContextoCarrito = {
  carrito: CarritoAlmacenado | null;
  hidratado: boolean;
  cantidad: number;
  agregar: (vianderaId: string, platoId: string) => ResultadoAgregar;
  incrementar: (platoId: string) => void;
  decrementar: (platoId: string) => void;
  reemplazar: (vianderaId: string, platoId: string) => void;
  vaciar: () => void;
};

const CarritoContext = createContext<ContextoCarrito | null>(null);

export function CarritoProvider({ children }: { children?: ReactNode }) {
  const [carrito, setCarrito] = useState<CarritoAlmacenado | null>(null);
  const [hidratado, setHidratado] = useState(false);
  const respaldoStorage = useRef(crearStorageMemoria());

  const storageSeguro = () => resolverStorageSeguro(
    () => window.localStorage,
    respaldoStorage.current,
  );

  useEffect(() => {
    const tarea = window.setTimeout(() => {
      setCarrito(leerCarritoSeguro(storageSeguro()));
      setHidratado(true);
    }, 0);
    return () => window.clearTimeout(tarea);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    persistirCarritoSeguro(storageSeguro(), carrito);
  }, [carrito, hidratado]);

  const valor = useMemo<ContextoCarrito>(() => ({
    carrito,
    hidratado,
    cantidad: cantidadTotal(carrito),
    agregar(vianderaId, platoId) {
      const resultado = agregarPlato(carrito, vianderaId, platoId);
      if (resultado.tipo === "actualizado") setCarrito(resultado.carrito);
      return resultado;
    },
    incrementar(platoId) {
      setCarrito((actual) => actual ? incrementarPlato(actual, platoId) : actual);
    },
    decrementar(platoId) {
      setCarrito((actual) => actual ? decrementarPlato(actual, platoId) : actual);
    },
    reemplazar(vianderaId, platoId) {
      setCarrito(reemplazarCarrito(vianderaId, platoId));
    },
    vaciar() {
      setCarrito((actual) => vaciarCarrito(actual));
    },
  }), [carrito, hidratado]);

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito(): ContextoCarrito {
  const contexto = useContext(CarritoContext);
  if (!contexto) throw new Error("useCarrito debe usarse dentro de CarritoProvider.");
  return contexto;
}
