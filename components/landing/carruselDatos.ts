export type FotoCarrusel = {
  src: string;
  alt: string;
  esIlustrativa: boolean;
  vianderaSlug?: string;
};

// Las 4 fotos son ilustrativas: no corresponden a un plato publicado
// hoy por una viandera activa (ver public/portada/CREDITOS.md para
// origen y licencia). Cuando exista un plato real con foto de calidad
// suficiente, la entrada correspondiente puede pasar a
// `esIlustrativa: false` y sumar `vianderaSlug` — decisión posterior,
// fuera de este plan (ver "Fuera de alcance" de la spec).
export const FOTOS_CARRUSEL: FotoCarrusel[] = [
  {
    src: "/portada/carrusel-01.webp",
    alt: "Milanesa napolitana con puré de papas servida sobre una mesa de cocina.",
    esIlustrativa: true,
  },
  {
    src: "/portada/carrusel-02.webp",
    alt: "Porción de tarta casera de vegetales acompañada con ensalada fresca.",
    esIlustrativa: true,
  },
  {
    src: "/portada/carrusel-03.webp",
    alt: "Vianda de pollo asado con arroz y vegetales servida en un recipiente de vidrio.",
    esIlustrativa: true,
  },
  {
    src: "/portada/carrusel-04.webp",
    alt: "Ravioles caseros de espinaca y ricota con salsa de tomate y queso rallado.",
    esIlustrativa: true,
  },
];
