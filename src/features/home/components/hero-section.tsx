import Link from "next/link";

import { Container } from "@/components/ui/container";

export function HeroSection() {
  return (
    <section className="hero-section">
      <Container className="hero-section__inner">
        <div className="hero-section__content">
          <span className="hero-section__badge">Next.js Foundation</span>
          <h1 className="hero-section__title">
            Start GymPlus with a clean, scalable architecture.
          </h1>
          <p className="hero-section__description">
            This starter gives us a production-minded base: strong conventions,
            modular folders, reusable UI building blocks, and a visual system
            ready for real product work.
          </p>
          <div className="hero-section__actions">
            <Link className="button button--primary" href="#start">
              View structure
            </Link>
            <Link className="button button--secondary" href="#architecture">
              Architecture
            </Link>
          </div>
        </div>

        <div className="hero-section__panel">
          <div className="hero-card">
            <p className="hero-card__label">Core layers</p>
            <ul className="hero-card__list">
              <li>`app` for routing and composition</li>
              <li>`features` for domain slices</li>
              <li>`components` for shared UI</li>
              <li>`lib` for reusable utilities</li>
            </ul>
          </div>
          <div className="hero-card hero-card--accent">
            <p className="hero-card__label">Ready for growth</p>
            <p className="hero-card__text">
              Navigation, metadata, providers, aliases, linting, and clean
              defaults are already in place.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
