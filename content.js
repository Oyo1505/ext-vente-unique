let injected = false;

chrome.runtime.sendMessage({ type: "GMAIL_COMPOSE_READY" }, response => {
  if (chrome.runtime.lastError || !response) return;
  waitForCompose(response);
});

function waitForCompose(draft) {
  const composeBody = document.querySelector('[contenteditable="true"][aria-label*="Body"], [contenteditable="true"][aria-label*="Corps"], div[role="textbox"][contenteditable="true"]');
  if (!composeBody) {
    window.setTimeout(() => waitForCompose(draft), 250);
    return;
  }
  if (injected) return;
  injected = true;
  composeBody.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composeBody);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("insertText", false, `${draft.body}\n\n`);
  composeBody.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: draft.body }));
}