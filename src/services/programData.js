function serializeTimestamp(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return value;
}

export function maybeNormalizeCloudProgram(program) {
  if (!program || typeof program !== "object") {
    return null;
  }

  const routines = Array.isArray(program.routines) ? program.routines : null;
  const days = Array.isArray(program.days) ? program.days : routines;

  if (!days) {
    return null;
  }

  return {
    ...program,
    days,
    ...(typeof program.createdAt !== "undefined"
      ? { createdAt: serializeTimestamp(program.createdAt) }
      : {}),
    ...(typeof program.updatedAt !== "undefined"
      ? { updatedAt: serializeTimestamp(program.updatedAt) }
      : {}),
  };
}

export function toProgramDocument(program, createServerTimestamp) {
  const { days, routines, ...programFields } = program;
  const nextRoutines = Array.isArray(routines) ? routines : days;

  return {
    ...programFields,
    ...(Array.isArray(days) ? { days } : {}),
    ...(Array.isArray(nextRoutines) ? { routines: nextRoutines } : {}),
    updatedAt: createServerTimestamp(),
    createdAt: program.createdAt ?? createServerTimestamp(),
  };
}
