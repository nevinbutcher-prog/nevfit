import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { createRobProgramIntake, updateRobProgramIntake } from "../src/services/rob/robProgramIntake.js";
import { createRobProgramGenerationHandler } from "../functions/src/index.js";
import { createRobProgramCandidateDetails } from "../src/services/rob/robProgramCandidateDetails.js";
import { createRobProgramResolutionSession, materializeRobProgramProposal } from "../src/services/rob/robProgramResolution.js";

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

test("catalogue-grounded generation renders one readable preview without legacy matching UI", async () => {
  const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true }, appType: "custom" });
  try {
    const { default: RobProgramIntake } = await server.ssrLoadModule("/src/components/rob/RobProgramIntake.jsx");
    const intake = { ...createRobProgramIntake(), confirmedRequirements: { version: 1, goal: "hypertrophy", daysPerWeek: 1, sessionMinutes: 60, priorities: [], environment: "home_gym", equipment: ["dumbbells"], constraints: "" } };
    const generation = { status: "success", catalogue: { entries: [{ id: "wger-567", name: "Shoulder Press, Dumbbells", equipment: ["Dumbbell"] }] }, candidate: { explanation: "A focused plan.", candidate: { proposalType: "create_program", program: { name: "Strength Day", summary: "One readable preview.", days: [{ name: "Upper", focus: "Shoulders", exercises: [{ exerciseId: "wger-567", sets: 3, repRange: "8-12", restSeconds: 90, note: null, proposalGroupKey: null }] }] } } } };
    const markup = renderToStaticMarkup(React.createElement(RobProgramIntake, { intake, step: "summary", setStep: () => {}, onChange: () => {}, onConfirm: () => {}, onStartOver: () => {}, onGenerate: () => {}, generation, resolution: { catalogueGrounded: true } }));
    assert.match(markup, /Shoulder Press, Dumbbells/);
    assert.doesNotMatch(markup, />wger-567</);
    assert.doesNotMatch(markup, /Match every exercise|Search exercises|Choose an exercise/);
    assert.equal((markup.match(/Generated[^<]*/g) ?? []).length, 1);

    const missing = structuredClone(generation); missing.catalogue.entries = [];
    const recoverable = renderToStaticMarkup(React.createElement(RobProgramIntake, { intake, step: "summary", setStep: () => {}, onChange: () => {}, onConfirm: () => {}, onStartOver: () => {}, onGenerate: () => {}, generation: missing, resolution: { catalogueGrounded: true } }));
    assert.match(recoverable, /Verified exercise details unavailable/);
    assert.doesNotMatch(recoverable, />wger-567</);
  } finally { await server.close(); }
});

test("actual callable generation response carries trusted catalogue names through preview and materialisation", async () => {
  const requirements = { version: 1, goal: "hypertrophy", daysPerWeek: 4, sessionMinutes: 60, priorities: ["back"], environment: "commercial_gym", equipment: ["machines", "dumbbells", "barbell", "cables", "bench", "pull_up_equipment"], constraints: "" };
  const ids = ["wger-73", "wger-76", "wger-145", "wger-538", "wger-458", "wger-475", "wger-567", "wger-723", "wger-1370"];
  const candidate = { version: 1, proposalType: "create_program", explanation: "A verified four-day plan.", program: { name: "Verified Four", summary: "Four complete routines.", days: Array.from({ length: 4 }, (_, routineIndex) => ({ name: `Day ${routineIndex + 1}`, focus: "Balanced", exercises: Array.from({ length: 4 }, (_, exerciseIndex) => ({ exerciseId: ids[(routineIndex * 4 + exerciseIndex) % ids.length], sets: 3, repRange: "8-12", restSeconds: 90, note: null, proposalGroupKey: null })) })) } };
  const handler = createRobProgramGenerationHandler({ providerFactory: () => ({ generate: async () => ({ text: JSON.stringify(candidate), model: "test", usage: {}, finishReason: "stop" }) }) });
  const result = await handler({ auth: { uid: "verified" }, data: { requirements, catalogue: { version: 2, ids } } });
  const generation = { status: "success", candidate: result };
  const details = createRobProgramCandidateDetails(generation);
  const names = details.routines.flatMap((routine) => routine.exercises.map((exercise) => exercise.name));
  assert.equal(names.length, 16);
  assert.equal(names.every((name) => name && name !== "Verified exercise details unavailable"), true);

  const session = createRobProgramResolutionSession({ candidate: result, requirements, catalogue: result.catalogue });
  assert.equal(session.catalogueGrounded, true);
  assert.equal(Object.values(session.entries).every((entry) => entry.selectedExercise?.name), true);
  const materialized = materializeRobProgramProposal(session, { programs: [], createId: (() => { let number = 0; return (prefix) => `${prefix}-${++number}`; })() });
  assert.equal(materialized.validation.valid, true);
  assert.equal(materialized.proposal.program.days.flatMap((day) => day.exercises).length, 16);

  const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true }, appType: "custom" });
  try {
    const { default: RobProgramIntake } = await server.ssrLoadModule("/src/components/rob/RobProgramIntake.jsx");
    const intake = { ...createRobProgramIntake(), confirmedRequirements: requirements };
    const markup = renderToStaticMarkup(React.createElement(RobProgramIntake, { intake, step: "summary", setStep: () => {}, onChange: () => {}, onConfirm: () => {}, onStartOver: () => {}, onGenerate: () => {}, generation, resolution: materialized.session }));
    assert.equal((markup.match(/Generated[^<]*/g) ?? []).length, 1);
    assert.doesNotMatch(markup, /Match every exercise|Search exercises|Choose an exercise/);
    for (const name of names) assert.match(markup, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const missingMetadata = structuredClone(result);
    missingMetadata.catalogue.entries = [];
    const integrityFailure = createRobProgramResolutionSession({ candidate: missingMetadata, requirements, catalogue: missingMetadata.catalogue });
    assert.equal(integrityFailure.catalogueIntegrityFailure, true);
    const integrityMarkup = renderToStaticMarkup(React.createElement(RobProgramIntake, { intake, step: "summary", setStep: () => {}, onChange: () => {}, onConfirm: () => {}, onStartOver: () => {}, onGenerate: () => {}, generation: { status: "success", candidate: missingMetadata }, resolution: integrityFailure }));
    assert.match(integrityMarkup, /could not verify the generated exercise metadata/);
    assert.doesNotMatch(integrityMarkup, /Match every exercise|Search exercises|Choose an exercise/);
  } finally { await server.close(); }
});
