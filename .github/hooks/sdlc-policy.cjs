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
    "SDLC approval gate: after confirming a ticket, initialize feature/<JIRA_KEY> from clean, updated main before Stage 1. Run specialists only in stage order and wait for approvals at boundaries. SDLC agents must not modify .github/agents, .github/skills, .github/instructions, or .github/hooks. Commits, pushes, and PRs require separate authorization.";

  if (event === "PreToolUse") {
    const toolName = String(input.toolName ?? input.tool_name ?? "").toLowerCase();
    const toolInput = input.toolInput ?? input.tool_input ?? {};

    if (isProtectedCustomizationMutation(toolName, toolInput)) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            "Ticket SDLC agents may not modify .github/agents, .github/skills, .github/instructions, or .github/hooks. Request a separate workflow-customization change instead.",
        },
      });
      return;
    }

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

function isProtectedCustomizationMutation(toolName, toolInput) {
  const serializedInput = JSON.stringify(toolInput);
  const protectedPath =
    /(?:^|[\\/"'\s])\.github[\\/](?:agents|skills|instructions|hooks)(?:[\\/]|$)/i;

  if (!protectedPath.test(serializedInput)) {
    return false;
  }

  if (/\b(edit|write|patch|create|delete|remove|update|rename|move|copy)\b/.test(toolName)) {
    return true;
  }

  if (/\b(execute|run_terminal|terminal)\b/.test(toolName)) {
    return /\b(apply_patch|set-content|add-content|out-file|remove-item|new-item|move-item|copy-item|rename-item|sed\s+-i|perl\s+-i|writeFile(?:Sync)?|appendFile(?:Sync)?|unlink(?:Sync)?|rmdir(?:Sync)?)\b|\bgit\s+(?:add|rm|mv|restore|checkout)\b|\b(?:rm|rmdir|del|erase|echo|printf|tee)\b|(?:>>?|>\s*)/i.test(serializedInput);
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
