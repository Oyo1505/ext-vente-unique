const config = globalThis.ONBOARDING_CONFIG;
const form = document.querySelector("#onboarding-form");
const status = document.querySelector("#status");
const retrievePageInfoButton = document.querySelector("#retrieve-page-info");
const fillGoogleFormButton = document.querySelector("#fill-google-form");
const clearFormButton = document.querySelector("#clear-form");
const firstNameInput = document.querySelector("#first-name");
const lastNameInput = document.querySelector("#last-name");
const loginInput = document.querySelector("#login");
const modelAccountInput = document.querySelector("#model-account");
const recipientsInput = document.querySelector("#recipients");

// Brouillon en mémoire (storage.session, jamais écrit sur disque) pour survivre à la fermeture du popup ;
// seuls les destinataires sont mémorisés sur disque (storage.local)
const draft = createArrivalDraft({
  config,
  storage: {
    loadDraft: async () => (await chrome.storage.session.get("draft")).draft,
    saveDraft: value => chrome.storage.session.set({ draft: value }),
    removeDraft: () => chrome.storage.session.remove("draft"),
    loadRecipients: async fallback => (await chrome.storage.local.get({ recipients: fallback })).recipients,
    saveRecipients: recipients => chrome.storage.local.set({ recipients })
  }
});

const fieldInputs = {
  firstName: firstNameInput,
  lastName: lastNameInput,
  login: loginInput,
  modelAccount: modelAccountInput,
  recipients: recipientsInput,
  windowsPassword: document.querySelector("#windows-password"),
  googlePassword: document.querySelector("#google-password")
};

function render(snapshot) {
  // Ne réécrire que les champs modifiés pour ne pas déplacer le curseur pendant la saisie
  Object.entries(fieldInputs).forEach(([field, input]) => {
    if (input.value !== snapshot[field]) input.value = snapshot[field];
  });
}

async function fillAdminForm({ firstName, lastName, login, password }) {
  const clean = text => (text ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = element => element.offsetParent !== null;

  const labelOf = input => {
    const labelledBy = input.getAttribute("aria-labelledby");
    const candidates = [
      input.getAttribute("aria-label"),
      labelledBy && labelledBy.split(" ").map(id => document.getElementById(id)?.innerText).join(" "),
      [...(input.labels ?? [])].map(label => label.innerText).join(" "),
      input.placeholder
    ];
    const direct = candidates.map(clean).find(Boolean);
    if (direct) return direct;
    // Repli : remonter jusqu'au conteneur qui n'englobe que ce champ et lire son premier texte
    let node = input.parentElement;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      if (node.querySelectorAll("input").length > 1) break;
      const text = clean(node.innerText.split("\n").find(line => line.trim()));
      if (text) return text;
    }
    return "";
  };

  const findInput = (pattern, selector = 'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])') =>
    [...document.querySelectorAll(selector)].filter(visible).find(input => pattern.test(labelOf(input)));

  const setValue = (input, value) => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  };

  const filled = [];
  const missing = [];
  const fill = (name, pattern, value, selector) => {
    const input = findInput(pattern, selector);
    if (input) {
      setValue(input, value);
      filled.push(name);
    } else {
      missing.push(name);
    }
  };

  fill("Prénom", /^pr[ée]nom$/i, firstName);
  fill("Nom", /^nom$/i, lastName);
  fill("E-mail principal", /adresse e-?mail principale/i, login);

  if (password) {
    const clickByText = pattern => {
      const element = [...document.querySelectorAll('a, button, [role="button"], [role="radio"], label, span, div')]
        .filter(visible)
        .findLast(candidate => pattern.test(clean(candidate.innerText)));
      element?.click();
      return Boolean(element);
    };
    if (!document.querySelector('input[type="password"]')) {
      clickByText(/^gérer le mot de passe/i);
      await wait(600);
    }
    if (clickByText(/^créer un mot de passe$/i)) await wait(400);
    fill("Mot de passe", /.*/, password, 'input[type="password"]');
  }

  return { filled, missing };
}

function fillBoForm({ firstName, lastName, login, email, password }) {
  const filled = [];
  const missing = [];
  const fill = (name, id, value) => {
    const input = document.getElementById(id);
    if (!input) {
      missing.push(name);
      return;
    }
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    filled.push(name);
  };

  fill("Nom d'utilisateur", "bo_user_username", login);
  fill("Email", "bo_user_email", email);
  fill("Prénom", "bo_user_firstname", firstName);
  fill("Nom", "bo_user_lastname", lastName);
  fill("Mot de passe", "bo_user_plainPassword", password);

  // Case iCheck : la cocher via son calque cliquable pour garder l'affichage synchronisé
  const valid = document.getElementById("bo_user_valid");
  if (!valid) {
    missing.push("Valide");
  } else {
    if (!valid.checked) {
      const helper = valid.parentElement.querySelector(".iCheck-helper");
      if (helper) helper.click();
      if (!valid.checked) valid.click();
    }
    (valid.checked ? filled : missing).push("Valide");
  }

  return { filled, missing };
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function extractPageInfo() {
  const lines = document.body.innerText.split("\n").map(line => line.trim()).filter(Boolean);
  const cleanLabel = text => text.replace(/\*/g, "").replace(/\s+/g, " ").trim();
  const answerFor = pattern => {
    const item = [...document.querySelectorAll('[role="listitem"]')]
      .find(element => pattern.test(cleanLabel(element.querySelector('[role="heading"]')?.innerText ?? "")));
    if (item) {
      const input = item.querySelector('input[type="text"], textarea');
      if (input?.value.trim()) return input.value.trim();
      const headingLines = new Set(item.querySelector('[role="heading"]').innerText.split("\n").map(line => line.trim()));
      return item.innerText.split("\n").map(line => line.trim())
        .filter(line => line && line !== "*" && !headingLines.has(line))
        .join(" ").replace(/\s+/g, " ").trim();
    }
    const index = lines.findIndex(line => pattern.test(cleanLabel(line)));
    const next = index === -1 ? "" : lines[index + 1] ?? "";
    return /^(nom|prénom|prenom|nom prénom)\s*\*?$/i.test(next) ? "" : next.replace(/\s+/g, " ").trim();
  };
  const emailPattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
  const modelAccount = lines
    .map(line => line.match(/reproduire\s+les?\s+mêmes?\s+que\s+(.+)/i)?.[1]?.trim())
    .find(Boolean) ?? "";
  const recipientLabelIndex = lines.findIndex(line => /^adresse e-?mail$/i.test(line));
  const recipientEmails = recipientLabelIndex === -1
    ? []
    : lines.slice(recipientLabelIndex + 1, recipientLabelIndex + 3).join(" ").match(emailPattern)?.[0]
      ? [lines.slice(recipientLabelIndex + 1, recipientLabelIndex + 3).join(" ").match(emailPattern)[0].toLowerCase()]
      : [];
  let lastName = answerFor(/^nom$/i);
  let firstName = answerFor(/^pr[ée]nom$/i);

  if (lastName && !firstName && lastName.includes(" ")) {
    // Nom et prénom saisis ensemble dans le champ « Nom » : « Prénom Nom »
    const nameParts = lastName.split(" ");
    firstName = nameParts.shift();
    lastName = nameParts.join(" ");
  } else if (!lastName && !firstName) {
    // Ancien formulaire : champ unique « Nom prénom »
    const nameParts = answerFor(/^nom prénom$/i).split(" ").filter(Boolean);
    if (nameParts.length >= 2) {
      lastName = nameParts.shift();
      firstName = nameParts.join(" ");
    }
  }

  if (!lastName || !firstName) return null;

  return { lastName, firstName, modelAccount, recipientEmails };
}

retrievePageInfoButton.addEventListener("click", async () => {
  retrievePageInfoButton.disabled = true;
  showStatus("Lecture de la page...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Onglet actif introuvable");

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageInfo
    });

    if (!result) {
      showStatus("Nom et prénom introuvables sur cette page.", true);
      return;
    }

    render(draft.applyPageInfo(result));
    showStatus("Informations récupérées.");
  } catch (error) {
    showStatus("Impossible de lire cette page.", true);
  } finally {
    retrievePageInfoButton.disabled = false;
  }
});

["firstName", "lastName", "modelAccount", "recipients"].forEach(field => {
  fieldInputs[field].addEventListener("input", event => render(draft.setField(field, event.target.value)));
});
loginInput.addEventListener("input", () => render(draft.editLogin(loginInput.value)));

fillGoogleFormButton.addEventListener("click", async () => {
  const identity = draft.identity();
  if (!identity) {
    showStatus("Complétez l'identité avant de remplir le formulaire.", true);
    return;
  }

  fillGoogleFormButton.disabled = true;
  showStatus("Remplissage du formulaire...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let injection;
    if (tab?.url?.startsWith("https://admin.google.com/")) {
      injection = { func: fillAdminForm, args: [{ ...identity, password: draft.snapshot().googlePassword }] };
    } else if (tab?.url?.startsWith("https://bo.vente-unique.com/")) {
      injection = {
        func: fillBoForm,
        args: [{ ...identity, email: `${identity.login}@${config.domains.google}`, password: config.bo.password }]
      };
    } else {
      showStatus("Ouvrez le formulaire de création Google Admin ou BO.", true);
      return;
    }

    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", ...injection });

    if (!result.filled.length) showStatus("Aucun champ trouvé sur cette page.", true);
    else if (result.missing.length) showStatus(`Rempli : ${result.filled.join(", ")}. Introuvable : ${result.missing.join(", ")}.`, true);
    else showStatus("Formulaire rempli. Vérifiez puis validez.");
  } catch (error) {
    showStatus("Impossible de remplir cette page.", true);
  } finally {
    fillGoogleFormButton.disabled = false;
  }
});

clearFormButton.addEventListener("click", () => {
  render(draft.clear());
  showStatus("Formulaire effacé.");
  firstNameInput.focus();
});

document.querySelectorAll("[data-regenerate]").forEach(button => {
  button.addEventListener("click", () => render(draft.regenerate(button.dataset.regenerate.replace("-password", ""))));
});

document.querySelectorAll("[data-copy]").forEach(button => {
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.querySelector(`#${button.dataset.copy}`).value);
    showStatus("Mot de passe copié.");
  });
});

draft.restore().then(render);

form.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = await draft.complete();

  if (!payload) {
    showStatus("Complétez l'identité et au moins un destinataire.", true);
    return;
  }

  chrome.runtime.sendMessage({ type: "OPEN_GMAIL_COMPOSE", payload });
  showStatus("Rédaction Gmail ouverte.");
});
