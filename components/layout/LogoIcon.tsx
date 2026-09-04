import Image from "next/image";

export default function LogoIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/pin-isotipo.webp"
      alt="ViandApp"
      width={360}
      height={450}
      priority
      className={className}
    />
  );
}
