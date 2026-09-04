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
  ofreceRetiroInicial: boolean;
  ofreceEnvioInicial: boolean;
  costoEnvioPropioInicial: number | null;
  coberturaEnvioInicial: string;
};

export default function FormularioPerfil({
  nombreInicial,
  slugInicial,
  bioInicial,
  telefonoInicial,
  latInicial,
  lngInicial,
  ofreceRetiroInicial,
  ofreceEnvioInicial,
  costoEnvioPropioInicial,
  coberturaEnvioInicial,
}: Props) {
  const [estado, formAction] = useActionState<EstadoPerfil, FormData>(
    actualizarPerfil,
    { status: "idle" },
  );
  const [ubicacion, setUbicacion] = useState({
    lat: latInicial,
    lng: lngInicial,
  });
  const [ofreceEnvio, setOfreceEnvio] = useState(ofreceEnvioInicial);

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
          maxLength={100}
          defaultValue={nombreInicial}
          className={campoClase}
        />
      </div>

      <fieldset className="mt-2 flex flex-col gap-4 rounded-2xl border border-ink/10 p-4">
        <legend className="px-1 font-display text-lg font-bold text-ink">Entregas</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink/80">
          <input
            name="ofrece_retiro"
            type="checkbox"
            defaultChecked={ofreceRetiroInicial}
            className="size-5 accent-coral"
          />
          Ofrezco retiro por mi cocina
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink/80">
          <input
            name="ofrece_envio"
            type="checkbox"
            checked={ofreceEnvio}
            onChange={(event) => setOfreceEnvio(event.target.checked)}
            className="size-5 accent-coral"
          />
          Ofrezco envío propio
        </label>
        {ofreceEnvio && (
          <div className="flex flex-col gap-4 border-l-2 border-coral/25 pl-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="costo_envio_propio" className="text-sm font-medium text-ink/80">
                Costo de envío
              </label>
              <input
                id="costo_envio_propio"
                name="costo_envio_propio"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue={costoEnvioPropioInicial ?? ""}
                className={campoClase}
              />
              <p className="text-xs text-ink/55">
                Si queda vacío, esta modalidad no aparecerá en el carrito.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cobertura_envio" className="text-sm font-medium text-ink/80">
                Zona de cobertura
              </label>
              <textarea
                id="cobertura_envio"
                name="cobertura_envio"
                rows={2}
                maxLength={500}
                defaultValue={coberturaEnvioInicial}
                className={`${campoClase} resize-none`}
                placeholder="Barrios o radio en los que entregás"
              />
            </div>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium text-ink/80">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={500}
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
          maxLength={30}
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
            maxLength={60}
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
