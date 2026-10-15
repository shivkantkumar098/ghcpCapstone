const chunks = [];

process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("error", failClosed);
process.stdin.on("end", () => {
  let input;

  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    failClosed();
    return;
  }

  const event = input.hookEventName ?? input.hook_event_name ?? input.eventName;
  const message =
    "SDLC approval gate: complete only the current approved stage. At its boundary, present the verified artifact, status, evidence, and blockers; ask approval for the named next stage; then stop and wait. Never infer approval from silence, prior approval, or an artifact. Get separate authorization for branch, commit, push, and PR actions.";

  if (event === "PreToolUse") {
    const toolName = String(input.toolName ?? input.tool_name ?? "").toLowerCase();
    const toolInput = input.toolInput ?? input.tool_input ?? {};

    if (requiresApproval(toolName, toolInput)) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason:
            "Confirm this delegation or mutation is within the user's explicitly approved SDLC stage and scope.",
        },
      });
    } else {
      writeOutput({});
    }
    return;
  }

  if (event === "SessionStart" || event === "UserPromptSubmit" || event === "SubagentStart") {
    writeOutput({ systemMessage: message });
    return;
  }

  writeOutput({});
});

function requiresApproval(toolName, toolInput) {
  if (/\b(agent|subagent|delegate)\b/.test(toolName)) {
    return true;
  }

  if (/\b(edit|write|patch|create|delete|remove|update|transition|assign|comment|move|link|commit|push|merge|pull_request)\b/.test(toolName)) {
    return true;
  }

  if (/\b(execute|run_terminal|terminal)\b/.test(toolName)) {
    const command = JSON.stringify(toolInput).toLowerCase();
    return /\bgit\b[^;&|\r\n]*\b(commit|push|switch|checkout|branch|merge|rebase|tag|reset|clean|worktree)\b|\b(rm|rmdir|del|erase|remove-item|set-content|out-file)\b|\b(npm|pnpm|yarn|pip)\s+install\b/.test(command);
  }

  return false;
}

function writeOutput(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function failClosed() {
  process.stderr.write("SDLC hook could not parse its input; blocking the tool operation.\n");
  process.exitCode = 2;
}
