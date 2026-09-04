"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Image from "next/image";
import type { FotoCarrusel } from "./carruselDatos";
import {
  DURACION_CROSSFADE_MS,
  DURACION_ROTACION_MS,
  estadoInicial,
  reducirCarrusel,
  rotacionActiva,
  siguienteIndice,
} from "@/lib/carrusel/reproduccion";
import {
  IconFlechaDerecha,
  IconFlechaIzquierda,
  IconPausa,
  IconPlato,
  IconReproducir,
} from "./icons";

const UMBRAL_SWIPE_PX = 40;

export default function HeroCarousel({ fotos }: { fotos: FotoCarrusel[] }) {
  const [estado, dispatch] = useReducer(
    (s: ReturnType<typeof estadoInicial>, a: Parameters<typeof reducirCarrusel>[1]) =>
      reducirCarrusel(s, a, fotos.length),
    undefined,
    () => estadoInicial(fotos.length, false),
  );

  // `montadas`: qué imágenes tienen un <Image> en el DOM (participan
  // de la precarga). `cargadas`/`fallidas`: qué imágenes ya
  // terminaron de resolver, con éxito o con error. El crossfade
  // visual espera a que el destino esté en uno de esos dos últimos
  // sets antes de mostrarlo — ver `indiceVisible` más abajo.
  const [montadas, setMontadas] = useState<Set<number>>(() => new Set([0]));
  const [cargadas, setCargadas] = useState<Set<number>>(() => new Set());
  const [fallidas, setFallidas] = useState<Set<number>>(() => new Set());
  // Índice que realmente se muestra (opacidad 1) — deliberadamente
  // distinto de `estado.indice`. `estado.indice` es "a dónde el
  // temporizador o el usuario quiere ir"; `indiceVisible` es "qué
  // imagen ya está lista para mostrarse". La transición visual ocurre
  // recién cuando ambos coinciden, así que la imagen anterior nunca
  // se oculta antes de que la siguiente termine de cargar (o falle).
  const [indiceVisible, setIndiceVisible] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Detección de prefers-reduced-motion solo al montar, en el
  // cliente — nunca durante el render de servidor (evita
  // desajustes de hidratación). El estado arranca siempre en
  // `reproduciendo: false`; si el usuario NO prefiere movimiento
  // reducido, esto lo activa una única vez. Si el usuario ya lo
  // pausó explícitamente antes de que este efecto corra, no puede
  // pasar — este efecto corre una sola vez, antes de cualquier
  // interacción posible.
  useEffect(() => {
    const prefiereReducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!prefiereReducido) {
      dispatch({ tipo: "ALTERNAR_REPRODUCCION" });
    }
  }, []);

  // Precarga como máximo una imagen por delante del ciclo — nunca las
  // cuatro. Acá se calcula durante el render (no en un efecto — evita
  // el "cascading render" que marca `react-hooks/set-state-in-effect`,
  // siguiendo el patrón oficial de React para derivar estado a partir
  // de otro estado). Dos cosas deben estar en `montadas`, no solo una:
  // (1) el índice actual — ANTERIOR/IR_A pueden saltar directo a una
  // posición que el ciclo de precarga hacia adelante todavía no había
  // tocado (ej. tocar "Anterior" desde el índice 0 salta al último sin
  // pasar por los intermedios); sin este chequeo esa imagen nunca se
  // monta y el crossfade queda trabado indefinidamente en la anterior.
  // (2) la siguiente del ciclo, para mantener la precarga de una por
  // delante durante la rotación automática — pero solo una vez que la
  // imagen actual ya resolvió (cargada o fallida). Medido con
  // Lighthouse: montar la siguiente desde el primer render hacía que
  // compitiera por ancho de banda con la imagen LCP durante su propia
  // descarga (ambas peticiones arrancaban casi juntas, "High" prioridad
  // las dos) — con 6s de rotación automática sobra tiempo para
  // precargarla después de que la visible termine. Ambas altas se
  // aplican en un único `setMontadas`, y la condición que las guarda se
  // vuelve falsa apenas se cumple, así que no reintenta en cada render.
  const proximaAPrecargar = siguienteIndice(estado.indice, fotos.length);
  const indiceActualResuelto =
    cargadas.has(estado.indice) || fallidas.has(estado.indice);
  const faltaIndiceActual = !montadas.has(estado.indice);
  const faltaProxima =
    indiceActualResuelto && !montadas.has(proximaAPrecargar);
  if (faltaIndiceActual || faltaProxima) {
    const nuevasMontadas = new Set(montadas);
    if (faltaIndiceActual) nuevasMontadas.add(estado.indice);
    if (faltaProxima) nuevasMontadas.add(proximaAPrecargar);
    setMontadas(nuevasMontadas);
  }

  // El crossfade visual espera a que la imagen destino esté lista —
  // cargada con éxito o marcada como fallida. El fallback de marca
  // cuenta como "lista": no tiene sentido esperar algo que nunca va a
  // terminar de cargar, así que una imagen rota pasa al fallback
  // inmediatamente en su turno, sin intervalo vacío. Mientras el
  // destino no esté listo, `indiceVisible` no se mueve — la imagen
  // anterior sigue mostrándose. Mismo patrón que arriba: se calcula
  // durante el render, guardado por una condición que deja de ser
  // verdadera apenas se aplica.
  if (
    (cargadas.has(estado.indice) || fallidas.has(estado.indice)) &&
    indiceVisible !== estado.indice
  ) {
    setIndiceVisible(estado.indice);
  }

  useEffect(() => {
    if (!rotacionActiva(estado)) return;
    const id = setTimeout(() => dispatch({ tipo: "TICK" }), DURACION_ROTACION_MS);
    return () => clearTimeout(id);
  }, [estado]);

  // `touchstart` inicia la pausa temporal (igual que hover/foco).
  // `touchend` decide primero si hubo swipe y despacha la navegación
  // ANTES de terminar la pausa — si se despachara al revés, un swipe
  // justo en el límite de los 6s podría perderse contra un TICK que
  // ya estaba re-armándose. `touchcancel` (el dedo se arrastra fuera
  // del carrusel o el gesto se interrumpe) solo termina la pausa, sin
  // navegar. Ninguno de los tres toca `reproduciendo` — la pausa
  // persistente del botón nunca se altera por touch (ver Task 2,
  // "reducirCarrusel — secuencia de interacción táctil", que ya
  // prueba esta composición exacta a nivel de reducer).
  function manejarTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    dispatch({ tipo: "INTERACCION_INICIO" });
  }

  function manejarTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current !== null) {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      if (deltaX > UMBRAL_SWIPE_PX) dispatch({ tipo: "ANTERIOR" });
      else if (deltaX < -UMBRAL_SWIPE_PX) dispatch({ tipo: "SIGUIENTE" });
    }
    touchStartX.current = null;
    dispatch({ tipo: "INTERACCION_FIN" });
  }

  function manejarTouchCancel() {
    touchStartX.current = null;
    dispatch({ tipo: "INTERACCION_FIN" });
  }

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Fotos destacadas de ViandApp"
      className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-soft-teal md:aspect-[4/3] lg:aspect-auto lg:h-full lg:rounded-none lg:[clip-path:polygon(6%_0,100%_0,100%_100%,0%_100%)]"
      onMouseEnter={() => dispatch({ tipo: "INTERACCION_INICIO" })}
      onMouseLeave={() => dispatch({ tipo: "INTERACCION_FIN" })}
      onFocus={() => dispatch({ tipo: "INTERACCION_INICIO" })}
      onBlur={() => dispatch({ tipo: "INTERACCION_FIN" })}
      onTouchStart={manejarTouchStart}
      onTouchEnd={manejarTouchEnd}
      onTouchCancel={manejarTouchCancel}
    >
      {fotos.map((foto, i) => {
        if (!montadas.has(i)) return null;
        const visible = i === indiceVisible;
        return (
          <div
            key={foto.src}
            className="absolute inset-0 transition-opacity ease-in-out"
            style={{
              opacity: visible ? 1 : 0,
              transitionDuration: `${DURACION_CROSSFADE_MS}ms`,
            }}
            aria-hidden={!visible}
          >
            {fallidas.has(i) ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-soft-teal text-teal">
                <IconPlato className="h-8 w-8" />
                <span className="text-sm font-medium">ViandApp</span>
              </div>
            ) : (
              <Image
                src={foto.src}
                alt={foto.alt}
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                priority={i === 0}
                // `priority` por sí solo ya genera el <link rel="preload">
                // en el <head> (confirmado — la imagen se descubre antes
                // de que React hidrate), pero en esta versión de Next NO
                // agrega `fetchpriority="high"` ni al link ni al <img>
                // (confirmado con Lighthouse: "LCP request discovery"
                // fallaba en `priorityHinted`). `fetchPriority` es una
                // prop separada y reconocida por `next/image` — se pasa
                // explícitamente solo en la primera foto, la única que
                // debe competir de verdad por ancho de banda apenas carga
                // la página.
                fetchPriority={i === 0 ? "high" : undefined}
                className="object-cover"
                onLoad={() => setCargadas((prev) => new Set(prev).add(i))}
                onError={() => setFallidas((prev) => new Set(prev).add(i))}
              />
            )}
            {foto.esIlustrativa && !fallidas.has(i) && (
              // Apilado arriba de los indicadores, nunca compartiendo fila
              // con otro control — ese fue el error de las dos posiciones
              // anteriores: abajo-derecha choca con los indicadores
              // (abajo-izquierda) a 320 px, y arriba-izquierda choca con
              // el botón "Pausar/Reanudar presentación" (arriba-derecha)
              // al mismo ancho. `bottom-14` (56 px) deja a los
              // indicadores (44 px + 4 px de margen) su fila completa,
              // sin superponerse a nada — mismo lugar en todos los
              // anchos, sin necesitar overrides por breakpoint.
              <span className="absolute bottom-14 left-3 rounded-full bg-ink/60 px-3 py-1 text-xs font-medium text-white">
                Imagen ilustrativa
              </span>
            )}
          </div>
        );
      })}

      <button
        type="button"
        aria-label="Imagen anterior"
        onClick={() => dispatch({ tipo: "ANTERIOR" })}
        className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        <IconFlechaIzquierda className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Imagen siguiente"
        onClick={() => dispatch({ tipo: "SIGUIENTE" })}
        className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        <IconFlechaDerecha className="h-5 w-5" />
      </button>

      <div className="absolute bottom-1 left-1 flex items-center">
        {fotos.map((foto, i) => (
          <button
            key={foto.src}
            type="button"
            aria-label={`Ir a imagen ${i + 1}`}
            aria-current={i === indiceVisible ? "true" : undefined}
            onClick={() => dispatch({ tipo: "IR_A", indice: i })}
            className="flex h-11 w-11 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {/* El botón mide 44×44 (objetivo táctil); el punto visible
                adentro es chico a propósito (~9 px) para no pintar todo
                el botón como un círculo blanco sólido. El anillo oscuro
                sutil (`shadow`) mantiene el punto legible incluso sobre
                zonas claras de la foto, donde blanco puro se perdería. */}
            <span
              className={`h-[9px] w-[9px] rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.35)] ${
                i === indiceVisible ? "bg-white" : "bg-white/70"
              }`}
            />
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-pressed={estado.reproduciendo}
        onClick={() => dispatch({ tipo: "ALTERNAR_REPRODUCCION" })}
        className="absolute right-2 top-2 flex h-11 min-w-[44px] items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-medium text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        {estado.reproduciendo ? (
          <>
            <IconPausa className="h-4 w-4" /> Pausar presentación
          </>
        ) : (
          <>
            <IconReproducir className="h-4 w-4" /> Reanudar presentación
          </>
        )}
      </button>
    </div>
  );
}
