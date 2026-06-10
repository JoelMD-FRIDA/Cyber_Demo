import Image from "next/image";

type AuthCardBrandProps = {
  eyebrow?: string;
  title?: string;
};

export function AuthCardBrand({
  eyebrow = "FRIDA e.V.",
  title = "DomainCheck",
}: AuthCardBrandProps) {
  return (
    <div className="frida-auth-brand">
      <Image
        src="/frida-icon.png"
        alt="FRIDA"
        width={40}
        height={40}
        className="size-10"
        unoptimized
        priority
      />
      <div>
        <p className="text-sm font-bold text-[var(--frida-primary)]">{eyebrow}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
    </div>
  );
}
