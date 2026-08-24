"use client";

import { useActionState } from "react";
import { crearPlato, actualizarPlato, type EstadoPlato } from "@/app/viandera/actions";
import type { TipoVianda } from "@/types";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";

type Props = {
  modo: "nuevo" | "editar";
  platoId?: string;
  valoresIniciales?: {
    nombre: string;
    descripcion: string;
    precio: string;
    tipo: TipoVianda;
    fotoUrl: string | null;
    disponible: boolean;
    etiquetas: string[];
  };
};

export default function FormularioPlato({
  modo,
  platoId,
  valoresIniciales,
}: Props) {
  const accion = modo === "nuevo" ? crearPlato : actualizarPlato;
  const [estado, formAction] = useActionState<EstadoPlato, FormData>(accion, {
    status: "idle",
  });

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="flex flex-col gap-4"
    >
      {modo === "editar" && platoId && (
        <input type="hidden" name="platoId" value={platoId} />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nombre" className="text-sm font-medium text-ink/80">
          Nombre del plato
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          maxLength={100}
          defaultValue={valoresIniciales?.nombre}
          className={campoClase}
          placeholder="Ej: Milanesa con puré"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="descripcion"
          className="text-sm font-medium text-ink/80"
        >
          Descripción <span className="text-ink/40">(opcional)</span>
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          maxLength={500}
          defaultValue={valoresIniciales?.descripcion}
          className={`${campoClase} resize-none`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="precio" className="text-sm font-medium text-ink/80">
            Precio <span className="text-ink/40">(opcional)</span>
          </label>
          <input
            id="precio"
            name="precio"
            type="number"
            min="0"
            max="999999"
            step="1"
            defaultValue={valoresIniciales?.precio}
            className={campoClase}
            placeholder="4200"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="tipo" className="text-sm font-medium text-ink/80">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            required
            defaultValue={valoresIniciales?.tipo ?? ""}
            className={campoClase}
          >
            <option value="" disabled>
              Elegí una opción
            </option>
            <option value="almuerzo">Almuerzo</option>
            <option value="cena">Cena</option>
            <option value="ambos">Ambos</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="foto" className="text-sm font-medium text-ink/80">
          Foto{" "}
          {valoresIniciales?.fotoUrl && (
            <span className="text-ink/40">
              (dejá vacío para mantener la actual)
            </span>
          )}
        </label>
        <input
          id="foto"
          name="foto"
          type="file"
          accept="image/*"
          className={campoClase}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink/80">
          Apto para <span className="text-ink/40">(opcional)</span>
        </span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ETIQUETAS_DIETARIAS.map((et) => (
            <label
              key={et.valor}
              className="flex items-center gap-2 text-sm text-ink/80"
            >
              <input
                type="checkbox"
                name="etiquetas"
                value={et.valor}
                defaultChecked={valoresIniciales?.etiquetas?.includes(et.valor)}
                className="h-4 w-4 rounded border-ink/25 text-coral focus:ring-coral/25"
              />
              {et.etiqueta}
            </label>
          ))}
        </div>
      </div>

      {modo === "editar" && (
        <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
          <input
            type="checkbox"
            name="disponible"
            defaultChecked={valoresIniciales?.disponible}
            className="h-4 w-4 rounded border-ink/25 text-coral focus:ring-coral/25"
          />
          Disponible
        </label>
      )}

      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}

      <div>
        <BotonEnviar
          label={modo === "nuevo" ? "Agregar plato" : "Guardar cambios"}
          labelEnviando="Guardando..."
        />
      </div>
    </form>
  );
}
