import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const starterSteps = [
  "Add real product routes under src/app",
  "Create domain modules inside src/features",
  "Extend shared UI components in src/components",
  "Move API clients and helpers into src/lib",
];

export function StartSection() {
  return (
    <section className="info-section info-section--soft" id="start">
      <Container>
        <SectionHeading
          eyebrow="Start Here"
          title="A practical base for the next implementation phase"
          description="We can now build authentication, dashboard, plans, bookings, or any other GymPlus flow on top of a consistent foundation."
        />

        <div className="start-list">
          {starterSteps.map((step, index) => (
            <div className="start-list__item" key={step}>
              <span className="start-list__index">{String(index + 1).padStart(2, "0")}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
