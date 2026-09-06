import { cn } from "@/lib/utils/cn";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description: string;
  align?: "left" | "center";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <div className={cn("section-heading", align === "center" && "is-centered")}>
      {eyebrow ? <span className="section-heading__eyebrow">{eyebrow}</span> : null}
      <h2 className="section-heading__title">{title}</h2>
      <p className="section-heading__description">{description}</p>
    </div>
  );
}
