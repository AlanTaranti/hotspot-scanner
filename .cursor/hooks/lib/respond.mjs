/**
 * @param {Record<string, unknown>} [extra]
 */
export function allow(extra = {}) {
  process.stdout.write(JSON.stringify({ permission: "allow", ...extra }));
}

/**
 * @param {string} userMessage
 * @param {string} [agentMessage]
 */
export function deny(userMessage, agentMessage = userMessage) {
  process.stdout.write(
    JSON.stringify({
      permission: "deny",
      user_message: userMessage,
      agent_message: agentMessage,
    }),
  );
}

/**
 * @param {string} userMessage
 * @param {string} [agentMessage]
 */
export function ask(userMessage, agentMessage = userMessage) {
  process.stdout.write(
    JSON.stringify({
      permission: "ask",
      user_message: userMessage,
      agent_message: agentMessage,
    }),
  );
}

/**
 * @param {string} message
 */
export function followup(message) {
  process.stdout.write(JSON.stringify({ followup_message: message }));
}

/**
 * @param {string} text
 */
export function additionalContext(text) {
  process.stdout.write(JSON.stringify({ additional_context: text }));
}

export function emptyOk() {
  process.stdout.write("{}");
}
