import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { createRobProgramIntake, updateRobProgramIntake } from "../src/services/rob/robProgramIntake.js";

test("program intake presents a confirmation indicator and expandable read-only candidate details", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/components/rob/RobProgramIntake.jsx", import.meta.url), "utf8"));
  assert.match(source, /Generated/);
  assert.match(source, /<details/);
  assert.match(source, /Brief confirmed/);
  assert.doesNotMatch(source, /disabled=\{!canNext \|\| Boolean\(intake\.confirmedRequirements\)\}/);
  assert.match(source, /read-only candidate/);
  assert.doesNotMatch(source, /saveProgram|setDoc|requestRobProgram|exerciseResolution/i);
});
test("constraints step renders checkbox labels without literal entities or checkbox values in the textarea", async () => {
  const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true }, appType: "custom" });
  try {
    const { default: RobProgramIntake } = await server.ssrLoadModule("/src/components/rob/RobProgramIntake.jsx");
    const intake = updateRobProgramIntake(createRobProgramIntake(), { constraints: "Avoid overhead pressing" });
    const markup = renderToStaticMarkup(React.createElement(RobProgramIntake, {
      intake,
      step: "constraints",
      setStep: () => {},
      onChange: () => {},
      onConfirm: () => {},
      onStartOver: () => {},
      onGenerate: () => {},
    }));
    assert.match(markup, /I&#x27;ve confirmed these preferences\./);
    assert.match(markup, /<textarea[^>]*>Avoid overhead pressing<\/textarea>/);
    assert.doesNotMatch(markup, /I&amp;apos;ve|>true<\/textarea>/);

    const noConstraints = renderToStaticMarkup(React.createElement(RobProgramIntake, {
      intake: createRobProgramIntake(),
      step: "constraints",
      setStep: () => {},
      onChange: () => {},
      onConfirm: () => {},
      onStartOver: () => {},
      onGenerate: () => {},
    }));
    assert.match(noConstraints, /No additional constraints\./);
  } finally {
    await server.close();
  }
});
test("constraints controls preserve text, require reconfirmation after edits, and advance on both paths", async () => {
  const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true }, appType: "custom" });
  try {
    const { default: RobProgramIntake } = await server.ssrLoadModule("/src/components/rob/RobProgramIntake.jsx");
    const find = (node, matches) => {
      if (!React.isValidElement(node)) return null;
      if (matches(node)) return node;
      return React.Children.toArray(node.props.children).map((child) => find(child, matches)).find(Boolean) ?? null;
    };
    let intake = createRobProgramIntake();
    let step = "constraints";
    const render = () => RobProgramIntake({
      intake,
      step,
      setStep: (next) => { step = next; },
      onChange: (next) => { intake = next; },
      onConfirm: () => {},
      onStartOver: () => {},
      onGenerate: () => {},
    });
    const textarea = () => find(render(), (node) => node.type === "textarea");
    const checkbox = () => find(render(), (node) => node.type === "input" && node.props.type === "checkbox");
    const next = () => find(render(), (node) => node.type === "button" && node.props.children === "Next");

    textarea().props.onChange({ target: { value: "Avoid overhead pressing" } });
    checkbox().props.onChange({ target: { checked: true } });
    assert.equal(intake.constraints, "Avoid overhead pressing");
    assert.equal(intake.constraintsConfirmed, true);

    textarea().props.onChange({ target: { value: "Avoid overhead pressing and deep knee flexion" } });
    assert.equal(intake.constraints, "Avoid overhead pressing and deep knee flexion");
    assert.equal(intake.constraintsConfirmed, false);
    checkbox().props.onChange({ target: { checked: true } });
    next().props.onClick();
    assert.equal(step, "summary");

    intake = createRobProgramIntake();
    step = "constraints";
    checkbox().props.onChange({ target: { checked: true } });
    assert.equal(intake.constraints, "");
    assert.equal(intake.constraintsConfirmed, true);
    next().props.onClick();
    assert.equal(step, "summary");
  } finally {
    await server.close();
  }
});