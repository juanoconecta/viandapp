"use client";

import { useActionState } from "react";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { crearContactoLibre, type ResultadoAccion } from "@/app/admin/crm/actions";

const ESTADO_INICIAL: ResultadoAccion = { status: "idle" };

export default function FormularioContacto() {
  const [estado, formAction] = useActionState(crearContactoLibre, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="crm-nuevo-tipo" className="text-sm font-medium text-ink/80">
            Tipo
          </label>
          <select
            id="crm-nuevo-tipo"
            name="tipo"
            required
            defaultValue="otro"
            className={campoClase}
          >
            <option value="aliado_estrategico">Aliado estratégico</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="crm-nuevo-nombre" className="text-sm font-medium text-ink/80">
            Nombre
          </label>
          <input
            id="crm-nuevo-nombre"
            name="nombreLibre"
            type="text"
            required
            maxLength={200}
            className={campoClase}
            placeholder="Nombre del contacto"
          />
        </div>
      </div>

      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">
          Contacto creado.
        </p>
      )}

      <div>
        <BotonEnviar label="Crear contacto" labelEnviando="Creando..." />
      </div>
    </form>
  );
}
