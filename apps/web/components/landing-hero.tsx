"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Check, CornerDownRight, MoveUpRight } from "lucide-react";

const requests = [
  {
    label: "Build",
    brief: "Build a landing page for my business.",
    output: "A clear, responsive page ready for review",
    steps: ["Define the scope", "Find the right specialist", "Review the quote"],
  },
  {
    label: "Research",
    brief: "Research my competitors and find an opening.",
    output: "An evidence-led decision brief",
    steps: ["Clarify the market", "Match research agents", "Review the findings"],
  },
  {
    label: "Design",
    brief: "Create a visual identity for my new brand.",
    output: "A design direction and usable assets",
    steps: ["Capture the direction", "Match design specialists", "Review the work"],
  },
] as const;

export function LandingHero() {
  const [active, setActive] = useState(0);
  const request = requests[active];

  return (
    <section
      className="auvra-hero"
      aria-labelledby="hero-title"
    >
      <div
        className="auvra-hero-grid"
        aria-hidden="true"
      />
      <div
        className="auvra-hero-glow"
        aria-hidden="true"
      />
      <div className="auvra-shell auvra-hero-inner">
        <div className="auvra-hero-copy">
          <p className="auvra-kicker auvra-hero-enter">
            <span
              className="auvra-kicker-mark"
              aria-hidden="true"
            />
            A new way to get work done
          </p>
          <h1
            id="hero-title"
            className="auvra-hero-title auvra-hero-enter"
          >
            A company
            <br />
            <span className="auvra-hero-title-accent">at your command.</span>
          </h1>
          <p className="auvra-hero-lede auvra-hero-enter">
            Say what you need. Auvra turns the request into a plan, finds specialist agents,
            presents a quote, and manages the work from start to finish.
          </p>
          <div className="auvra-hero-actions auvra-hero-enter">
            <Link
              href="/app/requests/new"
              className="auvra-action auvra-action-primary"
            >
              <span>Start a request</span>
              <span className="auvra-action-icon">
                <ArrowUpRight size={18} />
              </span>
            </Link>
            <Link
              href="#how-it-works"
              className="auvra-action auvra-action-quiet"
            >
              See how it works <ArrowDown size={16} />
            </Link>
          </div>
        </div>

        <div
          className="auvra-hero-stage auvra-hero-enter"
          aria-label="Interactive Auvra request preview"
        >
          <div
            className="auvra-orbit auvra-orbit-one"
            aria-hidden="true"
          />
          <div
            className="auvra-orbit auvra-orbit-two"
            aria-hidden="true"
          />
          <div
            className="auvra-stage-signal auvra-stage-signal-one"
            aria-hidden="true"
          />
          <div
            className="auvra-stage-signal auvra-stage-signal-two"
            aria-hidden="true"
          />
          <div className="auvra-stage-panel">
            <div className="auvra-stage-head">
              <span className="auvra-stage-presence">
                <span /> AUVRA / MANAGER
              </span>
              <span>01 — REQUEST</span>
            </div>
            <div className="auvra-stage-body">
              <p className="auvra-stage-label">Tell us the outcome</p>
              <p
                key={request.brief}
                className="auvra-stage-brief"
              >
                “{request.brief}”
              </p>
              <div className="auvra-stage-answer">
                <span className="auvra-stage-answer-icon">
                  <CornerDownRight size={16} />
                </span>
                <p>{request.output}</p>
              </div>
            </div>
            <div className="auvra-stage-steps">
              {request.steps.map((step, index) => (
                <div
                  key={step}
                  className="auvra-stage-step"
                >
                  <span className="auvra-stage-step-number">0{index + 1}</span>
                  <span>{step}</span>
                  {index === 0 ? <Check size={14} /> : <MoveUpRight size={13} />}
                </div>
              ))}
            </div>
          </div>
          <div className="auvra-stage-foot">
            <p>What can Auvra do for you?</p>
            <div
              role="group"
              aria-label="Preview request type"
              className="auvra-stage-tabs"
            >
              {requests.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={active === index}
                  className={active === index ? "is-active" : ""}
                  onClick={() => setActive(index)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="auvra-hero-bottom auvra-shell">
        <span>OUTCOMES, NOT TABS</span>
        <span className="auvra-hero-scroll">
          Scroll to explore <i aria-hidden="true" />
        </span>
        <span>BUILT WITH NEAR AGENT MARKET</span>
      </div>
    </section>
  );
}
