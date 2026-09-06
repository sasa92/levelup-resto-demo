"use client";
import './globals.css';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MenuResto from '@/components/MenuResto';
import Footer from '@/components/Footer';
import AdminBar from '@/components/AdminBar'; // Ajuste le chemin selon ton dossier

export default function Home() {
  const [infosBandeau, setInfosBandeau] = useState("CHARGEMENT DES HORAIRES...");
  const [parametres, setParametres] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [horairesSemaine, setHorairesSemaine] = useState([]);
// États pour le formulaire de contact général (Messages, CV, Demandes)
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    sujet: 'message', // 'message', 'privatisation', 'recrutement'
    message: ''
  });
  const [reservationStatut, setReservationStatut] = useState('');

  useEffect(() => {

    async function chargerParametresGlobaux() {
      const { data } = await supabase.from('parametres').select('*').eq('id', 1).single();
      if (data) {
        setParametres(data);
        // Si le gérant a coché l'alerte ET qu'il y a un texte, on ouvre la pop-up automatiquement
        if (data.alerte_active && data.message_alerte) {
          setShowPopup(true);
        }
      }
    }
    chargerParametresGlobaux();
    async function chargerHoraires() {
      const { data } = await supabase.from('horaires').select('*');
      if (data) setHorairesSemaine(data);
    }
    chargerHoraires();
    async function calculerBandeauDynamique() {
      try {
        // 1. Obtenir le jour actuel en français
        const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        const maintenant = new Date();
        const nomJourActuel = joursSemaine[maintenant.getDay()];
        
        // Conversion de l'heure actuelle en minutes écoulées depuis minuit
        const minutesActuelles = (maintenant.getHours() * 60) + maintenant.getMinutes();

        // 2. Récupérer les horaires de ce jour sur Supabase
        const { data: horaire, error } = await supabase
          .from('horaires')
          .select('*')
          .eq('jour', nomJourActuel)
          .single();

        if (error || !horaire) {
          setInfosBandeau("OUVERT CE SOIR • REJOIGNEZ-NOUS");
          return;
        }

        // Fonction pour convertir "18:30" en minutes (1110)
        const toMinutes = (timeStr) => {
          if (!timeStr) return 0;
          const [h, m] = timeStr.split(':').map(Number);
          return (h * 60) + m;
        };

        const midiDebut = toMinutes(horaire.midi_debut);
        const midiFin = toMinutes(horaire.midi_fin);
        const soirDebut = toMinutes(horaire.soir_debut);
        const soirFin = toMinutes(horaire.soir_fin);

        // Formatage propre pour l'affichage textuel (ex: 18:30 -> 18H30)
        const hMidiDeb = horaire.midi_debut?.replace(':', 'H');
        const hMidiFin = horaire.midi_fin?.replace(':', 'H');
        const hSoirDeb = horaire.soir_debut?.replace(':', 'H');
        const hSoirFin = horaire.soir_fin?.replace(':', 'H');

        // 3. LOGIQUE D'AFFICHAGE INTELLIGENTE ET ULTRA-FLEXIBLE

        // CAS A : Détection du SERVICE CONTINU (ex: ouvert non-stop de 12h à 23h)
        const estServiceContinu = horaire.midi_ouvert && horaire.soir_ouvert && (midiFin >= soirDebut);

        if (estServiceContinu) {
          if (minutesActuelles >= midiDebut && minutesActuelles < soirFin) {
            setInfosBandeau(`OUVERT EN SERVICE CONTINU JUSQU'À ${hSoirFin}`);
          } else if (minutesActuelles < midiDebut) {
            setInfosBandeau(`FERMÉ • OUVERTURE AUJOURD'HUI À ${hMidiDeb}`);
          } else {
            setInfosBandeau("FERMÉ ACTUELLEMENT • À DEMAIN");
          }
          return;
        }

        // CAS B : Gestion avec COUPURE classique (Midi / Après-midi fermé / Soir)
        
        // 1. Avant le service du midi
        if (minutesActuelles < midiDebut) {
          if (horaire.midi_ouvert) {
            setInfosBandeau(`FERMÉ • OUVERTURE CE MIDI À ${hMidiDeb}`);
          } else if (horaire.soir_ouvert) {
            setInfosBandeau(`FERMÉ CE MIDI • OUVERTURE CE SOIR À ${hSoirDeb}`);
          } else {
            setInfosBandeau("FERMÉ AUJOURD'HUI");
          }
        }
        // 2. Pendant le service du midi
        else if (minutesActuelles >= midiDebut && minutesActuelles < midiFin) {
          if (horaire.midi_ouvert) {
            setInfosBandeau(`OUVERT CE MIDI : ${hMidiDeb} - ${hMidiFin}`);
          } else {
            setInfosBandeau(`FERMÉ • OUVERTURE CE SOIR À ${hSoirDeb}`);
          }
        }
        // 3. Pendant la coupure de l'après-midi
        else if (minutesActuelles >= midiFin && minutesActuelles < soirDebut) {
          if (horaire.soir_ouvert) {
            setInfosBandeau(`FERMÉ • OUVERTURE CE SOIR À ${hSoirDeb}`);
          } else {
            setInfosBandeau("FERMÉ POUR LA JOURNÉE");
          }
        }
        // 4. Pendant le service du soir
        else if (minutesActuelles >= soirDebut && minutesActuelles < soirFin) {
          if (horaire.soir_ouvert) {
            setInfosBandeau(`OUVERT CE SOIR : ${hSoirDeb} - ${hSoirFin}`);
          } else {
            setInfosBandeau("FERMÉ ACTUELLEMENT");
          }
        }
        // 5. Après la fermeture du soir (fin de nuit)
        else {
          setInfosBandeau("FERMÉ • À DEMAIN");
        }

      } catch (err) {
        console.error("Erreur calcul horaires :", err);
        setInfosBandeau("OUVERT CE SOIR • REJOIGNEZ-NOUS");
      }
    }

    calculerBandeauDynamique();
  }, []);

const handleContactSubmit = async (e) => {
    e.preventDefault();
    setReservationStatut("⌛ Envoi de votre message aux équipes de Brambino...");

    try {
      // Stockage dans une table de contact ou simple simulation réussie pour l'instant
      // Si tu veux créer une table 'contacts' plus tard, tu as la structure prête.
      const { error } = await supabase
        .from('reservations') // On peut utiliser des notes préfixées ou créer une table dédiée
        .insert([{
          nom: formData.nom,
          telephone: formData.telephone,
          date_reservation: new Date().toISOString().split('T')[0],
          heure_reservation: "00:00",
          couverts: 0,
          zone: "contact",
          notes: `[CONTACT - SUJET: ${formData.sujet} - EMAIL: ${formData.email}] ${formData.message}`
        }]);

      if (error) throw error;

      setReservationStatut("✨ Grazie ! Votre message a bien été transmis. Nos équipes reviennent vers vous rapidement.");
      setFormData({ nom: '', email: '', telephone: '', sujet: 'message', message: '' });
    } catch (err) {
      setReservationStatut("❌ Une erreur est survenue. Veuillez nous écrire à ciao@brambino.fr");
    }
  };

  return (
 <main className="min-h-screen bg-[#0a0a0a] text-white">
      <AdminBar /> {/* Barre d'administration discrète */}
     
      {/* 1. Barre supérieure minimaliste avec texte calculé dynamiquement */}
      <div className="w-full text-center py-3 border-b border-white/5 text-[10px] sm:text-xs tracking-[0.25em] font-light uppercase text-stone-400 bg-[#0a0a0a]/90 backdrop-blur-md z-20 relative">
        12 RUE DE LA PIZZERIA, 75011 PARIS • {infosBandeau}
      </div>

      {/* 2. Section HERO immersive avec vidéo de fond */}
      <section className="relative w-full h-[90vh] flex flex-col items-center justify-between p-6 md:p-12 overflow-hidden">
        
        {/* Container de la Vidéo en arrière-plan */}
        <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
          <div className="absolute inset-0 bg-black/50 z-10" />
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover brightness-[0.6] scale-105"
          >
            <source 
              src="/video/accueil.mp4" 
              type="video/mp4" 
            />
          </video>
          
          {/* ✨ LA TRANSITION DOUCE : Effet de fondu noir transparent en bas de la vidéo */}
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent z-15" />
        </div>

        {/* Logo Blason IA + Nom en haut (Design Épuré) */}
        <div className="z-10 flex flex-col items-center space-y-3 mt-2 select-none group cursor-pointer">
          <div className="w-14 h-14 md:w-16 md:h-16 relative overflow-hidden transition-transform duration-500 group-hover:scale-105">
            <img 
              src="/images/logo.png" 
              alt="Brambino Blason" 
              className="w-full h-full object-cover mix-blend-screen brightness-95"
            />
          </div>
          <div className="text-[10px] tracking-[0.5em] font-light uppercase text-stone-400 group-hover:text-stone-100 transition-colors duration-500">
            BRAMBINO
          </div>
        </div>

        {/* Titre géant style "Bramble" au centre */}
        <div className="z-10 text-center select-none my-auto">
          <h1 className="text-5xl sm:text-7xl md:text-9xl lg:text-[13rem] font-serif font-black tracking-tighter text-stone-100 uppercase drop-shadow-2xl">
            BRAMBINO
          </h1>
        </div>

        {/* Section Basse : CTA et Navigation */}
        <div className="z-10 flex flex-col items-center space-y-6 w-full max-w-xs text-center mb-4">
        <a 
            href="/reservation" 
            className="w-full py-4 bg-white text-black font-medium tracking-[0.2em] text-xs uppercase rounded-none hover:bg-stone-200 transition-all duration-300 shadow-xl hover:scale-[1.02] text-center"
          >
            Réserver une table
          </a>
          
          <div className="flex space-x-8 text-[11px] tracking-[0.2em] font-light text-stone-400 uppercase">
            <a href="#menu" className="hover:text-white transition-colors">La Carte</a>
            <a href="#concept" className="hover:text-white transition-colors">Le Lieu</a>
          </div>
        </div>
      </section>

{/* 3. Section Storytelling & Manifeste */}
      <section id="concept" className="max-w-5xl mx-auto text-center px-6 py-24 md:py-36 space-y-16">
        
        {/* L'accroche principale */}
        <div className="space-y-6 max-w-4xl mx-auto">
          <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">// L'ANIMA DI BRAMBINO</span>
          <h2 className="text-xl sm:text-2xl md:text-4xl font-serif font-light tracking-wide leading-relaxed text-stone-200 uppercase">
            Une cuisine d'obsession, une atmosphère suspendue. La rencontre entre le savoir-faire napolitain et le jeu d'un vinyle qui craque.
          </h2>
          <div className="w-12 h-[1px] bg-stone-800 mx-auto my-6"></div>
        </div>

        {/* GRANDE IMAGE D'AMBIANCE CINÉMATIQUE (Générée par ton IA) */}
        <div className="w-full aspect-[16/8] md:aspect-[21/9] relative overflow-hidden bg-stone-900 border border-white/5 my-12">
          <img 
            src="/images/ambiance.png" 
            alt="L'ambiance feutrée de Brambino" 
            className="w-full h-full object-cover brightness-[0.65] contrast-[1.05]"
          />
          {/* Petit tag discret superposé sur l'image style magazine */}
          <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 text-[9px] font-mono tracking-widest uppercase text-stone-400 bg-black/40 backdrop-blur-sm px-3 py-1.5 border border-white/5">
            Analog Sound & Natural Wines
          </div>
        </div>

        {/* Les 3 piliers d'excellence réajustés avec le pilier Ambiance/Vinyle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-left max-w-4xl mx-auto pt-4">
          
          {/* Pilier 1 : Le Temps */}
          <div className="space-y-3 border-l border-white/5 pl-6 md:border-l-0 md:pl-0 md:text-center">
            <div className="font-serif text-2xl text-stone-300 font-light">48 Heures</div>
            <h3 className="text-xs font-mono tracking-widest uppercase text-stone-500">De Maturation</h3>
            <p className="text-xs text-stone-400 font-light leading-relaxed">
              Une fermentation lente à basse température. Le secret d'une pâte soufflée, aérienne et parfaitement digeste, travaillée à partir de farines biologiques.
            </p>
          </div>

          {/* Pilier 2 : La Terre */}
          <div className="space-y-3 border-l border-white/5 pl-6 md:border-l-0 md:pl-0 md:text-center">
            <div className="font-serif text-2xl text-stone-300 font-light">Sourcing Brut</div>
            <h3 className="text-xs font-mono tracking-widest uppercase text-stone-500">Direct Italie</h3>
            <p className="text-xs text-stone-400 font-light leading-relaxed">
              Tomates San Marzano au pied du Vésuve, burrata crémeuse reçue de Campanie et sélection pointue de vins propres et vivants de petits vignerons indépendants.
            </p>
          </div>

          {/* Pilier 3 : Le Son / L'Ambiance */}
          <div className="space-y-3 border-l border-white/5 pl-6 md:border-l-0 md:pl-0 md:text-center">
            <div className="font-serif text-2xl text-stone-300 font-light">Hi-Fi Analogique</div>
            <h3 className="text-xs font-mono tracking-widest uppercase text-stone-500">Atmosphère Chic</h3>
            <p className="text-xs text-stone-400 font-light leading-relaxed">
              Une lumière tamisée, le crépitement d'un système de son à lampes et une sélection de disques vinyles Jazz, Soul et Deep Groove pour accompagner vos fins de soirées.
            </p>
          </div>

        </div>
      </section>

    
{/* 4. Section Menu Carte avec fondu */}
      <section id="menu" className="w-full relative bg-[#0a0a0a] py-24">
        {/* Masque de transition doux avec le formulaire */}
        <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-[#0a0a0a] to-[#080808] pointer-events-none" />
        
        <div className="text-center mb-16 space-y-3">
          <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">// LA CARTA</span>
          <h2 className="text-3xl font-serif font-light tracking-widest text-stone-200 uppercase">Nos Créations</h2>
        </div>
        <MenuResto />
      </section>


{/* 5. Section Formulaire de Contact Épuré & Sourcing */}
      <section id="contact" className="w-full relative bg-[#0a0a0a] py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          
          <div className="text-center mb-12 space-y-3">
            <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">// CONTATTO & RECRUTEMENT</span>
            <h2 className="text-3xl font-serif font-light tracking-widest text-stone-200 uppercase">Nous Contacter</h2>
            <p className="text-xs text-stone-500 max-w-sm mx-auto font-light leading-relaxed">
              Une question, une demande de privatisation ou l'envie de rejoindre la brigade ? Écrivez-nous.
            </p>
          </div>

          <div className="bg-stone-900/30 border border-white/5 p-8 md:p-12 shadow-2xl backdrop-blur-sm">
            <form onSubmit={handleContactSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Nom Complet</label>
                  <input 
                    type="text" required placeholder="Ex: Alexander Romano" value={formData.nom}
                    onChange={(e) => setFormData({...formData, nom: e.target.value})}
                    className="w-full bg-stone-950 border border-white/10 p-4 text-sm text-stone-200 focus:outline-none focus:border-white/30 transition-all rounded-none placeholder:text-stone-800"
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Numéro de Téléphone</label>
                  <input 
                    type="tel" required placeholder="Ex: 06 12 34 56 78" value={formData.telephone}
                    onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                    className="w-full bg-stone-950 border border-white/10 p-4 text-sm text-stone-200 focus:outline-none focus:border-white/30 transition-all rounded-none placeholder:text-stone-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Adresse E-mail</label>
                  <input 
                    type="email" required placeholder="Ex: alex@brambino.com" value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-stone-950 border border-white/10 p-4 text-sm text-stone-200 focus:outline-none focus:border-white/30 transition-all rounded-none placeholder:text-stone-800 font-mono"
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Objet de votre demande</label>
                  <select 
                    value={formData.sujet}
                    onChange={(e) => setFormData({...formData, sujet: e.target.value})}
                    className="w-full bg-stone-950 border border-white/10 p-4 text-sm text-stone-300 focus:outline-none focus:border-white/30 transition-all rounded-none cursor-pointer"
                  >
                    <option value="message">Message général / Question</option>
                    <option value="privatisation">Privatisation d'espace (Événement)</option>
                    <option value="recrutement">Postuler / Rejoindre l'équipe (Candidature)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Votre Message / Précisions</label>
                <textarea 
                  rows="4" required
                  placeholder="Rédigez votre message ici. Pour les candidatures, indiquez votre poste souhaité et vos expériences principales..."
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full bg-stone-950 border border-white/10 p-4 text-sm text-stone-200 focus:outline-none focus:border-white/30 transition-all rounded-none placeholder:text-stone-800 resize-none"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-stone-100 text-black text-xs font-semibold tracking-[0.25em] uppercase hover:bg-white transition-all duration-300 rounded-none shadow-xl"
              >
                Envoyer ma demande
              </button>

              {reservationStatut && (
                <div className="w-full p-4 bg-stone-950 border border-white/5 text-center text-xs text-stone-400 font-serif italic">
                  {reservationStatut}
                </div>
              )}

            </form>
          </div>
        </div>
      </section>
<Footer />
{/* 🚨 POP-UP D'ACCUEIL ADAPTATIVE ET CHIC */}
      {showPopup && parametres?.message_alerte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-500 animate-fadeIn">
          <div className="bg-stone-950 border border-white/10 p-8 md:p-12 max-w-lg w-full text-center relative space-y-6 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            
            {/* Bouton de fermeture d'angle */}
            <button 
              onClick={() => setShowPopup(false)} 
              className="absolute top-4 right-4 text-stone-500 hover:text-white font-mono text-sm uppercase tracking-widest transition-colors p-2"
            >
              Fermer ✕
            </button>

            {/* Icône et Titre */}
            <div className="space-y-2 select-none">
              <span className="text-amber-500 text-xl font-mono">// AVVISO</span>
              <h4 className="font-serif text-2xl tracking-widest text-stone-200 uppercase">Annonce Spéciale</h4>
              <div className="w-12 h-[1px] bg-stone-800 mx-auto mt-4"></div>
            </div>

            {/* Le Message rédigé dans l'admin */}
            <p className="text-sm text-stone-300 font-light tracking-wide leading-relaxed font-mono whitespace-pre-line bg-stone-900/40 p-4 border border-white/5 uppercase">
              {parametres.message_alerte}
            </p>

            {/* Bouton CTA de validation */}
            <button 
              onClick={() => setShowPopup(false)}
              className="w-full py-3 bg-white text-black font-semibold tracking-[0.2em] text-xs uppercase hover:bg-stone-200 transition-all duration-300 rounded-none"
            >
              Prendre connaissance
            </button>

          </div>
        </div>
      )}
    </main>
  );
}