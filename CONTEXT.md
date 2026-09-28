# Contexte métier

Extension Chrome utilisée par le Support IT de Vente-unique pour préparer l'**arrivée** d'un employé : créer ses comptes et envoyer ses accès par mail.

## Glossaire

**Arrivée**
L'embauche d'une personne, traitée de bout en bout par le Support IT : lecture de la demande, création des comptes Google et BO, envoi des accès par mail. Une arrivée se termine quand la rédaction Gmail est ouverte.

**Brouillon d'arrivée**
L'arrivée en cours de préparation dans le popup : identité, identifiant, compte modèle, destinataires et mots de passe. Il est conservé en mémoire (`storage.session`) pour survivre à la fermeture du popup et oublié quand l'arrivée est terminée. Module : `arrival-draft.js`.

**Demande d'arrivée**
La page (formulaire Google) qui annonce l'arrivée. Le bouton « Récupérer les infos de la page » y lit le nom, le prénom, le compte modèle et l'adresse email à prévenir.

**Identifiant**
La partie commune des adresses de la personne : initiale du prénom + séparateur + nom, sans accents ni caractères spéciaux (ex. `jdupont`). Il est recalculé à chaque changement du nom, sauf s'il a été **modifié à la main**. Récupérer les infos de la page annule la modification manuelle.

**Compte Windows / Compte Google**
Les deux comptes créés pour chaque arrivée : `identifiant@cafom.com` (Windows) et `identifiant@vente-unique.com` (Google). Chacun a son propre mot de passe.

**Mots de passe**
Générés dans le popup, un pour Windows et un pour Google. Ils ne sont jamais écrits sur disque. Une **nouvelle personne** (nom ou prénom différent) en reçoit toujours de nouveaux, pour ne jamais réutiliser ceux d'une autre arrivée.

**Compte modèle**
Le compte existant dont on reproduit les groupes emails et les droits BO (« reproduire les mêmes que … » dans la demande).

**Destinataires**
Les adresses qui reçoivent le mail d'arrivée (manager, RH…). Ils sont **mémorisés** sur disque (`storage.local`) d'une arrivée à l'autre, et effacés par le bouton « Effacer ».

**BO (Back Office)**
L'outil interne `bo.vente-unique.com`. Ses comptes sont créés avec un mot de passe initial fixe (`config.bo.password`), pas celui généré.

**Google Admin**
La console `admin.google.com` où l'on crée le compte Google.

**Rédaction Gmail**
Le brouillon de mail ouvert dans Gmail avec l'objet, les destinataires, le Support IT en copie et le corps contenant les accès. Il n'est jamais envoyé automatiquement.
