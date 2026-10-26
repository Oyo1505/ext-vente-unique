globalThis.ONBOARDING_CONFIG = {
  domains: {
    windows: "cafom.com",
    google: "vente-unique.com"
  },
  login: {
    // Placé entre l'initiale du prénom et le nom (ex. "." donne j.dupont)
    separator: "",
    stripAccents: true,
    lowercase: true
  },
  email: {
    subject: "Arrivée {firstName} {lastName}",
    recipients: [],
    cc: ["support.it@vente-unique.com"]
  },
  body: [
    "Bonjour",
    "",
    "- Windows : {windowsLogin} // {windowsPassword}",
    "- Google : {googleLogin} // {googlePassword}"
  ].join("\n"),
  bo: {
    // Back Offices dont le formulaire de création de compte est rempli par l'extension
    urls: ["https://bo.vente-unique.com/", "https://bo.habitat.fr/"],
    // Mot de passe initial des comptes Back Office
    password: "azerty"
  },
  password: {
    // Format : une majuscule, des minuscules puis des chiffres, ex. Kmprtxzq4827
    letters: 8,
    digits: 4,
    // Ajoute un symbole à la fin si un service l'exige
    symbols: false
  }
};