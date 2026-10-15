/**
 * Scénario de la vidéo de présentation : scènes (début et durée en secondes) et texte de la voix off.
 * Partagé par l'animation (presentation.html) et le téléprompteur (teleprompteur.html),
 * pour que la voix enregistrée tombe exactement sur les images.
 */
window.SCENARIO = {
  duree: 58,
  scenes: [
    { id: 'intro', debut: 0, duree: 5.2, voix: { a: 0.6, texte: 'Comptapilot, par Vision Technologie.' } },
    { id: 'accroche', debut: 5, duree: 6.4, voix: { a: 5.6, texte: 'Avec Comptapilot, le comptable ne calcule plus : il vérifie, et il valide.' } },
    { id: 'tableau', debut: 11.2, duree: 9.2, voix: { a: 11.8, texte: 'Cent soixante-trois formules comptables, fiscales et sociales, réparties en treize moteurs, réunies dans un tableau de bord clair.' } },
    { id: 'calcul', debut: 20.2, duree: 10.2, voix: { a: 20.8, texte: 'Vous saisissez un chiffre : tout se calcule instantanément, avec la formule, les étapes, les contrôles et la référence légale.' } },
    { id: 'monnaie', debut: 30.2, duree: 7.2, voix: { a: 30.8, texte: 'En français ou en anglais, en franc CFA, en euro ou en dollar.' } },
    { id: 'securite', debut: 37.2, duree: 8.2, voix: { a: 37.8, texte: 'Chaque compte est protégé : confirmation par e-mail, par SMS ou par WhatsApp.' } },
    { id: 'mobile', debut: 45.2, duree: 7.2, voix: { a: 45.8, texte: 'Sur ordinateur, sur Android et sur iPhone.' } },
    { id: 'fin', debut: 52.2, duree: 5.8, voix: { a: 52.6, texte: 'Comptapilot : la comptabilité qui calcule pour vous.' } },
  ],
};
