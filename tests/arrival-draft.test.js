const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../config.js");
const { createArrivalDraft } = require("../arrival-draft.js");

const baseConfig = globalThis.ONBOARDING_CONFIG;

function memoryStorage({ draft, recipients } = {}) {
  const store = { draft, recipients };
  return {
    store,
    loadDraft: async () => store.draft,
    saveDraft: async value => { store.draft = value; },
    removeDraft: async () => { delete store.draft; },
    loadRecipients: async fallback => store.recipients ?? fallback,
    saveRecipients: async value => { store.recipients = value; }
  };
}

function withConfig(overrides) {
  return {
    ...baseConfig,
    login: { ...baseConfig.login, ...overrides.login },
    password: { ...baseConfig.password, ...overrides.password },
    email: { ...baseConfig.email, ...overrides.email }
  };
}

async function newDraft({ config = baseConfig, storage = memoryStorage() } = {}) {
  const draft = createArrivalDraft({ config, storage });
  await draft.restore();
  return { draft, storage };
}

test("l'identifiant suit le prénom et le nom, sans accents", async () => {
  const { draft } = await newDraft();
  draft.setField("firstName", "Émilie");
  const snapshot = draft.setField("lastName", "Le Bœuf-Hé");
  assert.equal(snapshot.login, "elebufhe");
});

test("le séparateur configuré est placé entre l'initiale et le nom", async () => {
  const { draft } = await newDraft({ config: withConfig({ login: { separator: "." } }) });
  draft.setField("firstName", "Jean");
  assert.equal(draft.setField("lastName", "Dupont").login, "j.dupont");
});

test("sans minuscules forcées, les majuscules sont conservées", async () => {
  const { draft } = await newDraft({ config: withConfig({ login: { lowercase: false } }) });
  draft.setField("firstName", "Jean");
  assert.equal(draft.setField("lastName", "Dupont").login, "JDupont");
});

test("un identifiant modifié à la main n'est plus recalculé", async () => {
  const { draft } = await newDraft();
  draft.setField("firstName", "Jean");
  draft.setField("lastName", "Dupont");
  draft.editLogin("jdupont2");
  assert.equal(draft.setField("lastName", "Durand").login, "jdupont2");
});

test("les infos de la page réinitialisent l'identifiant modifié", async () => {
  const { draft } = await newDraft();
  draft.editLogin("autre");
  const snapshot = draft.applyPageInfo({ firstName: "Jean", lastName: "Dupont", modelAccount: "Paul Martin", recipientEmails: [] });
  assert.equal(snapshot.login, "jdupont");
  assert.equal(snapshot.loginEdited, false);
  assert.equal(snapshot.modelAccount, "Paul Martin");
});

test("une nouvelle personne reçoit de nouveaux mots de passe, pas la même", async () => {
  const { draft } = await newDraft();
  const page = { firstName: "Jean", lastName: "Dupont", modelAccount: "", recipientEmails: [] };
  const first = draft.applyPageInfo(page);
  const same = draft.applyPageInfo(page);
  assert.equal(same.windowsPassword, first.windowsPassword);
  assert.equal(same.googlePassword, first.googlePassword);
  const other = draft.applyPageInfo({ ...page, firstName: "Paul" });
  assert.notEqual(other.windowsPassword, first.windowsPassword);
  assert.notEqual(other.googlePassword, first.googlePassword);
});

test("les destinataires de la page remplacent ceux saisis, sauf s'il n'y en a pas", async () => {
  const { draft } = await newDraft();
  draft.setField("recipients", "manager@exemple.com");
  const page = { firstName: "Jean", lastName: "Dupont", modelAccount: "" };
  assert.equal(draft.applyPageInfo({ ...page, recipientEmails: [] }).recipients, "manager@exemple.com");
  assert.equal(draft.applyPageInfo({ ...page, recipientEmails: ["rh@exemple.com"] }).recipients, "rh@exemple.com");
});

test("les mots de passe respectent la longueur et chaque jeu requis", async () => {
  const { draft } = await newDraft({ config: withConfig({ password: { symbols: true } }) });
  for (let run = 0; run < 50; run += 1) {
    const password = draft.regenerate("windows").windowsPassword;
    assert.equal(password.length, baseConfig.password.length);
    for (const set of [...baseConfig.password.requiredSets, "!@#$%&*-_=+?"]) {
      assert.ok([...password].some(character => set.includes(character)), `${password} sans ${set}`);
    }
  }
});

test("chaque modification est enregistrée dans le brouillon, destinataires compris", async () => {
  const { draft, storage } = await newDraft();
  draft.setField("recipients", "manager@exemple.com");
  assert.equal(storage.store.draft.recipients, "manager@exemple.com");
});

test("le brouillon restauré survit à la fermeture du popup", async () => {
  const storage = memoryStorage();
  const { draft } = await newDraft({ storage });
  draft.setField("firstName", "Jean");
  draft.setField("lastName", "Dupont");
  const before = draft.snapshot();
  const { draft: reopened } = await newDraft({ storage });
  assert.deepEqual(reopened.snapshot(), before);
});

test("sans brouillon, les destinataires mémorisés sont repris et les mots de passe générés", async () => {
  const { draft } = await newDraft({ storage: memoryStorage({ recipients: ["a@exemple.com", "b@exemple.com"] }) });
  const snapshot = draft.snapshot();
  assert.equal(snapshot.recipients, "a@exemple.com, b@exemple.com");
  assert.equal(snapshot.windowsPassword.length, baseConfig.password.length);
  assert.equal(snapshot.googlePassword.length, baseConfig.password.length);
});

test("un ancien brouillon sans mot de passe en reçoit un", async () => {
  const { draft } = await newDraft({ storage: memoryStorage({ draft: { firstName: "Jean", windowsPassword: "" } }) });
  assert.equal(draft.snapshot().windowsPassword.length, baseConfig.password.length);
  assert.equal(draft.snapshot().firstName, "Jean");
});

test("effacer vide l'identité, les destinataires mémorisés et change les mots de passe", async () => {
  const { draft, storage } = await newDraft({ storage: memoryStorage({ recipients: ["a@exemple.com"] }) });
  draft.setField("firstName", "Jean");
  const before = draft.snapshot();
  const snapshot = draft.clear();
  assert.equal(snapshot.firstName, "");
  assert.equal(snapshot.recipients, "");
  assert.notEqual(snapshot.windowsPassword, before.windowsPassword);
  assert.deepEqual(storage.store.recipients, []);
});

test("l'identité n'est prête qu'avec prénom, nom et identifiant", async () => {
  const { draft } = await newDraft();
  draft.setField("firstName", " Jean ");
  assert.equal(draft.identity(), null);
  draft.setField("lastName", "Dupont");
  assert.deepEqual(draft.identity(), { firstName: "Jean", lastName: "Dupont", login: "jdupont" });
});

test("terminer refuse une arrivée sans destinataire valide", async () => {
  const { draft, storage } = await newDraft();
  draft.setField("firstName", "Jean");
  draft.setField("lastName", "Dupont");
  draft.setField("recipients", "pas-une-adresse");
  assert.equal(await draft.complete(), null);
  assert.ok(storage.store.draft);
});

test("terminer mémorise les destinataires, oublie le brouillon et renvoie le mail", async () => {
  const { draft, storage } = await newDraft();
  draft.applyPageInfo({ firstName: "Jean", lastName: "Dupont", modelAccount: " Paul Martin ", recipientEmails: [] });
  draft.setField("recipients", "RH@exemple.com; manager@exemple.com");
  const { windowsPassword, googlePassword } = draft.snapshot();
  const payload = await draft.complete();
  assert.deepEqual(payload, {
    firstName: "Jean",
    lastName: "Dupont",
    login: "jdupont",
    modelAccount: "Paul Martin",
    recipients: ["rh@exemple.com", "manager@exemple.com"],
    windowsPassword,
    googlePassword
  });
  assert.deepEqual(storage.store.recipients, ["rh@exemple.com", "manager@exemple.com"]);
  assert.equal(storage.store.draft, undefined);
});

test("la date d'arrivée de la page est reprise, et oubliée pour une nouvelle personne sans date", async () => {
  const { draft } = await newDraft();
  const page = { firstName: "Jean", lastName: "Dupont", modelAccount: "", recipientEmails: [] };
  assert.equal(draft.applyPageInfo({ ...page, arrivalDate: "2026-09-14" }).arrivalDate, "2026-09-14");
  assert.equal(draft.applyPageInfo(page).arrivalDate, "2026-09-14");
  assert.equal(draft.applyPageInfo({ ...page, firstName: "Paul" }).arrivalDate, "");
});
