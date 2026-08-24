"use client";

import { useActionState, useState } from "react";
import SelectorUbicacionLoader from "@/components/map/SelectorUbicacionLoader";
import { actualizarPerfil, type EstadoPerfil } from "@/app/viandera/actions";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";

type Props = {
  nombreInicial: string;
  slugInicial: string;
  bioInicial: string;
  telefonoInicial: string;
  latInicial: number | null;
  lngInicial: number | null;
};

export default function FormularioPerfil({
  nombreInicial,
  slugInicial,
  bioInicial,
  telefonoInicial,
  latInicial,
  lngInicial,
}: Props) {
  const [estado, formAction] = useActionState<EstadoPerfil, FormData>(
    actualizarPerfil,
    { status: "idle" },
  );
  const [ubicacion, setUbicacion] = useState({
    lat: latInicial,
    lng: lngInicial,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lat" value={ubicacion.lat ?? ""} />
      <input type="hidden" name="lng" value={ubicacion.lng ?? ""} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nombre" className="text-sm font-medium text-ink/80">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          defaultValue={nombreInicial}
          className={campoClase}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium text-ink/80">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={bioInicial}
          className={`${campoClase} resize-none`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="telefono" className="text-sm font-medium text-ink/80">
          Teléfono / WhatsApp
        </label>
        <input
          id="telefono"
          name="telefono"
          type="text"
          inputMode="tel"
          defaultValue={telefonoInicial}
          className={campoClase}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm font-medium text-ink/80">
          Dirección de tu página
        </label>
        <div className="flex items-center gap-1 rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink/40 transition-colors focus-within:border-coral focus-within:ring-2 focus-within:ring-coral/25">
          <span>viandapp.ar/</span>
          <input
            id="slug"
            name="slug"
            type="text"
            defaultValue={slugInicial}
            placeholder="se genera solo si lo dejás vacío"
            className="flex-1 bg-transparent text-ink outline-none placeholder:text-ink/35"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink/80">
          Ubicación (arrastrá el pin)
        </span>
        <SelectorUbicacionLoader
          lat={ubicacion.lat}
          lng={ubicacion.lng}
          onChange={(lat, lng) => setUbicacion({ lat, lng })}
        />
      </div>

      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">
          Perfil actualizado.
        </p>
      )}

      <div>
        <BotonEnviar label="Guardar cambios" labelEnviando="Guardando..." />
      </div>
    </form>
  );
}
