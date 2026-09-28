# Support IT - Onboarding Chrome Extension

Extension Chrome Manifest V3 pour préparer une rédaction Gmail lors de l'arrivée d'un employé.

## Installation locale

1. Ouvrir `chrome://extensions`.
2. Activer le mode développeur.
3. Cliquer sur **Charger l'extension non empaquetée**.
4. Sélectionner ce dossier.

Les mots de passe sont générés dans le popup avec `crypto.getRandomValues`. Ils sont transmis une seule fois au service worker en mémoire, puis au content script Gmail. Seuls les destinataires sont enregistrés dans `chrome.storage.local`.

## Configuration

Modifier `config.js` pour les domaines, le format de l'identifiant, l'objet, le corps du mail et l'alphabet des mots de passe.

Le bouton ouvre une rédaction Gmail mais ne l'envoie jamais automatiquement.

Depuis le popup, le bouton « Récupérer les infos de la page » lit l'onglet actif et récupère le nom, le prénom, le compte modèle indiqué après « Reproduire depuis compte » et les adresses email visibles. Ces informations préremplissent le popup et le compte modèle est ajouté au brouillon Gmail avec l'identifiant préparé.

## Tests

Le brouillon d'arrivée (`arrival-draft.js`) contient les règles du popup : calcul de l'identifiant, génération des mots de passe, enregistrement du brouillon et des destinataires. Il se teste sans navigateur, avec Node 20 ou plus :

```
node --test tests/
```

Le vocabulaire métier est décrit dans `CONTEXT.md`.
