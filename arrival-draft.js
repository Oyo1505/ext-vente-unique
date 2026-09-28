// Brouillon d'arrivée : état du popup et règles associées, indépendants du DOM.
// storage : { loadDraft, saveDraft, removeDraft, loadRecipients, saveRecipients }
function createArrivalDraft({ config, storage, randomIndex = cryptoRandomIndex }) {
  const SYMBOLS = "!@#$%&*-_=+?";
  let state = emptyState();

  function emptyState() {
    return {
      firstName: "",
      lastName: "",
      login: "",
      loginEdited: false,
      modelAccount: "",
      recipients: "",
      windowsPassword: generatePassword(),
      googlePassword: generatePassword()
    };
  }

  function normalize(value) {
    const stripped = config.login.stripAccents
      ? value.normalize("NFD").replace(/[̀-ͯ]/g, "")
      : value;
    return config.login.lowercase ? stripped.toLowerCase() : stripped;
  }

  function suggestedLogin() {
    const keep = config.login.stripAccents ? /[^A-Za-z0-9]/g : /[^\p{L}\p{N}]/gu;
    const firstName = normalize(state.firstName.trim()).replace(keep, "");
    const lastName = normalize(state.lastName.trim()).replace(keep, "");
    return firstName && lastName ? `${firstName[0]}${config.login.separator}${lastName}` : "";
  }

  function generatePassword() {
    const { length, requiredSets, symbols } = config.password;
    const sets = symbols ? [...requiredSets, SYMBOLS] : requiredSets;
    const characters = sets.map(randomCharacter);
    const alphabet = sets.join("");

    while (characters.length < length) characters.push(randomCharacter(alphabet));

    for (let index = characters.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
    }

    return characters.join("");
  }

  function randomCharacter(alphabet) {
    return alphabet[randomIndex(alphabet.length)];
  }

  function parseRecipients() {
    return state.recipients
      .split(/[,;\s]+/)
      .map(value => value.trim().toLowerCase())
      .filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  }

  function update(changes) {
    state = { ...state, ...changes };
    if (!state.loginEdited) state.login = suggestedLogin();
    storage.saveDraft({ ...state });
    return snapshot();
  }

  function snapshot() {
    return { ...state };
  }

  return {
    snapshot,

    async restore() {
      const draft = await storage.loadDraft();
      const remembered = await storage.loadRecipients(config.email.recipients);
      state = { ...emptyState(), recipients: remembered.join(", "), ...draft };
      // Un brouillon partiel ne doit jamais laisser un mot de passe vide
      if (!state.windowsPassword) state.windowsPassword = generatePassword();
      if (!state.googlePassword) state.googlePassword = generatePassword();
      storage.saveDraft({ ...state });
      return snapshot();
    },

    // field : firstName | lastName | modelAccount | recipients
    setField(field, value) {
      return update({ [field]: value });
    },

    editLogin(login) {
      return update({ login, loginEdited: true });
    },

    applyPageInfo({ firstName, lastName, modelAccount, recipientEmails }) {
      const isNewPerson = firstName !== state.firstName || lastName !== state.lastName;
      return update({
        firstName,
        lastName,
        modelAccount,
        loginEdited: false,
        ...(recipientEmails.length && { recipients: recipientEmails.join(", ") }),
        ...(isNewPerson && { windowsPassword: generatePassword(), googlePassword: generatePassword() })
      });
    },

    // key : windows | google
    regenerate(key) {
      return update({ [`${key}Password`]: generatePassword() });
    },

    clear() {
      storage.saveRecipients([]);
      state = emptyState();
      storage.saveDraft({ ...state });
      return snapshot();
    },

    // Identité prête pour remplir un formulaire, ou null si incomplète
    identity() {
      const firstName = state.firstName.trim();
      const lastName = state.lastName.trim();
      const login = state.login.trim();
      return firstName && lastName && login ? { firstName, lastName, login } : null;
    },

    // Termine l'arrivée : mémorise les destinataires, oublie le brouillon et renvoie le contenu du mail.
    // Renvoie null si l'identité ou les destinataires manquent.
    async complete() {
      const identity = this.identity();
      const recipients = parseRecipients();
      if (!identity || !recipients.length) return null;
      await storage.saveRecipients(recipients);
      // Arrivée terminée : on oublie le brouillon pour ne pas réutiliser les mots de passe
      await storage.removeDraft();
      return {
        ...identity,
        modelAccount: state.modelAccount.trim(),
        recipients,
        windowsPassword: state.windowsPassword,
        googlePassword: state.googlePassword
      };
    }
  };
}

function cryptoRandomIndex(maximum) {
  const range = 0x100000000 - (0x100000000 % maximum);
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= range);
  return values[0] % maximum;
}

globalThis.createArrivalDraft = createArrivalDraft;
if (typeof module !== "undefined") module.exports = { createArrivalDraft };
