"use client";

import { useFormStatus } from "react-dom";

export default function BotonEnviar({
  label,
  labelEnviando,
}: {
  label: string;
  labelEnviando: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white shadow-md shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-lg disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? labelEnviando : label}
    </button>
  );
}
