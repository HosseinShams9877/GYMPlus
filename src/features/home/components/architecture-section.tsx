import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const architectureItems = [
  {
    title: "App Router first",
    description:
      "Pages stay thin while business-focused sections live in feature modules.",
  },
  {
    title: "Shared primitives",
    description:
      "Reusable UI components help us maintain visual consistency and reduce duplication.",
  },
  {
    title: "Clear boundaries",
    description:
      "Config, providers, features, and utilities each have a dedicated place in the codebase.",
  },
];

export function ArchitectureSection() {
  return (
    <section className="info-section" id="architecture">
      <Container>
        <SectionHeading
          eyebrow="Architecture"
          title="Built to stay clean as the product grows"
          description="The initial structure is intentionally modular so future features can be added without turning the app into a tangle."
        />

        <div className="info-grid">
          {architectureItems.map((item) => (
            <article className="info-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
