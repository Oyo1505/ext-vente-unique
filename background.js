importScripts("config.js");

let pendingDraft = null;

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "OPEN_GMAIL_COMPOSE") {
    pendingDraft = { ...message.payload, tabId: null };
    const subject = encodeURIComponent(renderSubject(message.payload));
    const recipients = encodeURIComponent(message.payload.recipients.join(","));
    const cc = encodeURIComponent(ONBOARDING_CONFIG.email.cc.join(","));
    chrome.tabs.create({
      url: `https://mail.google.com/mail/?view=cm&fs=1&to=${recipients}&cc=${cc}&su=${subject}`,
      active: true
    }, tab => {
      if (pendingDraft) pendingDraft.tabId = tab.id;
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GMAIL_COMPOSE_READY" && pendingDraft && sender.tab?.id) {
    if (pendingDraft.tabId === null) pendingDraft.tabId = sender.tab.id;
    if (sender.tab.id !== pendingDraft.tabId) return false;
    const draft = pendingDraft;
    pendingDraft = null;
    sendResponse({
      body: renderBody(draft),
      subject: renderSubject(draft)
    });
  }
  return true;
});

function renderSubject({ firstName, lastName }) {
  return configTemplate(ONBOARDING_CONFIG.email.subject, { firstName, lastName });
}

function renderBody({ login, modelAccount, windowsPassword, googlePassword }) {
  return configTemplate(ONBOARDING_CONFIG.body, {
    windowsLogin: `${login}@${ONBOARDING_CONFIG.domains.windows}`,
    windowsPassword,
    googleLogin: `${login}@${ONBOARDING_CONFIG.domains.google}`,
    googlePassword,
    modelAccount
  });
}

function configTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}