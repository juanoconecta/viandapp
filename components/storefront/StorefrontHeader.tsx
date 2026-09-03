function modalidadTexto(ofreceRetiro: boolean, ofreceEnvio: boolean): string {
  if (ofreceRetiro && ofreceEnvio) return "Retiro y envío";
  if (ofreceRetiro) return "Retiro";
  if (ofreceEnvio) return "Envío";
  return "";
}

function fechaActualizacion(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "long",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/**
 * Solo nombre, bio, barrio, modalidad y fecha de actualización — sin
 * ratings ni sellos de confianza que no estén respaldados por un proceso
 * real. El badge "Activa" que tenía la versión anterior se sacó: todo
 * perfil visible acá ya es activo por definición (los inactivos van a
 * `notFound()`), así que era información redundante, no una señal nueva.
 */
export default function StorefrontHeader({
  nombre,
  bio,
  barrio,
  ofreceRetiro,
  ofreceEnvio,
  actualizadoEn,
}: {
  nombre: string;
  bio: string | null;
  barrio: string | null;
  ofreceRetiro: boolean;
  ofreceEnvio: boolean;
  actualizadoEn: string;
}) {
  const iniciales = nombre
    .split(" ")
    .map((palabra) => palabra[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const modalidad = modalidadTexto(ofreceRetiro, ofreceEnvio);
  const fecha = fechaActualizacion(actualizadoEn);

  return (
    <header className="flex items-start gap-3 border-b border-ink/10 bg-teal px-5 py-4 text-white">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 font-display text-lg font-bold">
        {iniciales}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="break-words font-display font-semibold leading-tight">
          {nombre}
        </h1>
        {bio && (
          <p className="mt-0.5 line-clamp-3 text-xs text-white/75">{bio}</p>
        )}
        {(barrio || modalidad || fecha) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/70">
            {barrio && <span>{barrio}</span>}
            {modalidad && <span>{modalidad}</span>}
            {fecha && <span>Actualizado el {fecha}</span>}
          </p>
        )}
      </div>
    </header>
  );
}
