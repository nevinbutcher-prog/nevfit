export async function persistProgramDrafts(
  programDefinitions,
  currentUser,
  actionName,
  { persistLocal, saveCloud, logSync },
) {
  persistLocal(programDefinitions);
  logSync(actionName, currentUser?.uid, programDefinitions, "local");

  if (!currentUser) {
    return true;
  }

  try {
    await saveCloud(currentUser.uid, programDefinitions);
    logSync(actionName, currentUser.uid, programDefinitions, "success");
    return true;
  } catch (error) {
    logSync(
      actionName,
      currentUser.uid,
      programDefinitions,
      "failure",
      error,
    );
    return false;
  }
}
