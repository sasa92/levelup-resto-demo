'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Footer from '@/components/Footer';
import AdminBar from '@/components/AdminBar';
import Link from 'next/link';

export default function PageReservationCalendrier() {
  const [step, setStep] = useState(1); // 1: Choix Couverts/Date, 2: Sélection Heure, 3: Formulaire, 4: Réussite
  const [horairesSemaine, setHorairesSemaine] = useState([]);
  const [tablesPhysiques, setTablesPhysiques] = useState([]);
  const [toutesLesReservations, setToutesLesReservations] = useState([]);
  const [toutesLesLiaisons, setToutesLesLiaisons] = useState([]);
  const [dureeRepasMinutes, setDureeRepasMinutes] = useState(105);
  const [loadingSystem, setLoadingSystem] = useState(true);

  // Données du formulaire
  const [formData, setFormData] = useState({
    nom: '', telephone: '', email: '', date: '', heure: '', couverts: '2', zone: 'salle', notes: ''
  });

  // États de l'interface
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [creneauxDisponibles, setCreneauxDisponibles] = useState([]);
  const [tableTrouveePourResa, setTableTrouveePourResa] = useState([]);
  const [statutMessage, setStatutMessage] = useState('');

  // 📥 Chargement des données depuis Supabase
  useEffect(() => {
    async function chargerMoteurDonnees() {
      setLoadingSystem(true);
      try {
        const { data: h } = await supabase.from('horaires').select('*');
        if (h) setHorairesSemaine(h);
        
        const { data: t } = await supabase.from('tables').select('*');
        if (t) setTablesPhysiques(t);
        
        const { data: r } = await supabase.from('reservations').select('*');
        if (r) setToutesLesReservations(r);
        
        const { data: l } = await supabase.from('reservations_tables').select('*');
        if (l) setToutesLesLiaisons(l);

        const { data: p } = await supabase.from('parametres').select('duree_repas').eq('id', 1).single();
        if (p?.duree_repas) setDureeRepasMinutes(p.duree_repas);
      } catch (err) {
        console.error("Erreur de chargement des paramètres:", err);
      } finally {
        setLoadingSystem(false);
      }
    }
    chargerMoteurDonnees();
  }, []);

  const toMinutes = (tStr) => { 
    if (!tStr) return 0; 
    const [h, m] = tStr.split(':').map(Number); 
    return h * 60 + m; 
  };

  // 🧠 Algorithme de calcul de disponibilité et couplage de tables
  const analyserDisponibiliteTablesALHeure = (dateTarget, heureTarget, couvertsTarget, zoneTarget) => {
    if (tablesPhysiques.length === 0) return { possible: false, arrangement: false, tables: [] };

    const cibleMinutes = toMinutes(heureTarget);
    const couvertsBesoin = parseInt(couvertsTarget);

    // Filtrer les tables libres dans la zone sélectionnée pour ce créneau horaire
    const tablesLibresA_LHeure = tablesPhysiques.filter(table => {
      if (table.zone !== zoneTarget) return false;
      
      const liaisonsTable = toutesLesLiaisons.filter(l => l.table_id === table.id);
      for (let l of liaisonsTable) {
        const res = toutesLesReservations.find(r => r.id === l.reservation_id && r.date_reservation === dateTarget && r.statut === 'confirme');
        if (res) {
          const resMinutes = toMinutes(res.heure_reservation);
          if (Math.abs(cibleMinutes - resMinutes) < dureeRepasMinutes) {
            return false; 
          }
        }
      }
      return true;
    });

    // 1. Recherche d'une table unique adaptée
    const tableUniqueParfaite = tablesLibresA_LHeure
      .filter(t => t.capacite >= couvertsBesoin)
      .sort((a, b) => a.capacite - b.capacite)[0];

    if (tableUniqueParfaite) {
      return { possible: true, arrangement: false, tables: [tableUniqueParfaite] };
    }

    // 2. Recherche par arrangement (couplage de plusieurs tables)
    const tablesTrieesDecroissant = [...tablesLibresA_LHeure].sort((a, b) => b.capacite - a.capacite);
    let cumulCapacite = 0;
    let tablesAAssembler = [];

    for (let t of tablesTrieesDecroissant) {
      cumulCapacite += t.capacite;
      tablesAAssembler.push(t);
      if (cumulCapacite >= couvertsBesoin) {
        return { possible: true, arrangement: true, tables: tablesAAssembler };
      }
    }

    return { possible: false, arrangement: false, tables: [] };
  };

// 🕒 Générateur de tranches horaires avec gestion dynamique de l'emporter paramétré
  const genererRegistreHeures = (dateChoisie) => {
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const configJour = horairesSemaine.find(h => h.jour === jours[new Date(dateChoisie).getDay()]);
    if (!configJour || (!configJour.midi_ouvert && !configJour.soir_ouvert)) {
      setCreneauxDisponibles([]);
      return;
    }

    const listeBruteHeures = [];
    const injecterTranche = (debut, fin, serviceNom) => {
      let current = toMinutes(debut);
      const extinctionMinutes = toMinutes(fin);
      const finLimite = extinctionMinutes - 30;

      while (current <= finLimite) {
        const heureStr = `${Math.floor(current / 60).toString().padStart(2, '0')}:${(current % 60).toString().padStart(2, '0')}`;
        
        // Calculer s'il reste moins de 75 min avant l'extinction des feux du service
        const tempsRestantAvantFermeture = extinctionMinutes - current;
        const estZoneCritique = tempsRestantAvantFermeture < 75;

        // On regarde si le restaurateur autorise l'emporter pour CE service de CE jour-là
        const emporterAutoriseCeService = serviceNom === 'midi' 
          ? (configJour.midi_emporter ?? true) 
          : (configJour.soir_emporter ?? true);

        listeBruteHeures.push({
          heure: heureStr,
          emporterSeul: estZoneCritique && emporterAutoriseCeService,
          bloqueStrict: estZoneCritique && !emporterAutoriseCeService // Zone critique mais emporter décoché par l'admin !
        });
        current += 30;
      }
    };

    if (configJour.midi_ouvert) injecterTranche(configJour.midi_debut, configJour.midi_fin, 'midi');
    if (configJour.soir_ouvert) injecterTranche(configJour.soir_debut, configJour.soir_fin, 'soir');

    const resultatsAnalyse = listeBruteHeures.map(item => {
      const analyse = analyserDisponibiliteTablesALHeure(dateChoisie, item.heure, formData.couverts, formData.zone);
      
      // Si c'est bloqué strict par l'admin, le créneau n'est pas possible. Sinon, on suit la logique normale.
      const slotValide = item.bloqueStrict ? false : (item.emporterSeul ? true : analyse.possible);

      return {
        heure: item.heure,
        emporterSeul: item.emporterSeul,
        possible: slotValide, 
        arrangement: item.emporterSeul ? false : analyse.arrangement,
        tablesAllouees: item.emporterSeul ? [] : analyse.tables
      };
    });

    setCreneauxDisponibles(resultatsAnalyse);
  };

  // 📅 Logique calendrier
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const adjustedStart = startDay === 0 ? 6 : startDay - 1;
    const days = Array(adjustedStart).fill(null);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));
    return days;
  };

  const daysArr = getDaysInMonth(currentMonth);
  const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  const handleDateSelect = (dateObj) => {
    const localDateStr = dateObj.toLocaleDateString('fr-CA'); 
    setFormData({ ...formData, date: localDateStr, heure: '' });
    genererRegistreHeures(localDateStr);
    setStep(2);
  };

  // 💾 Soumission finale
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setStatutMessage("⌛ Enregistrement de votre réservation...");

    try {
      const { data: resOk, error: errRes } = await supabase.from('reservations').insert([{
        nom: formData.nom, telephone: formData.telephone, date_reservation: formData.date,
        heure_reservation: formData.heure, couverts: parseInt(formData.couverts), zone: formData.zone,
        notes: `[E-mail: ${formData.email}] ${formData.notes}`, statut: 'confirme'
      }]).select().single();

      if (errRes) throw errRes;

      if (tableTrouveePourResa && tableTrouveePourResa.length > 0) {
        const tableLiaisons = tableTrouveePourResa.map(table => {
          return supabase.from('reservations_tables').insert([{ reservation_id: resOk.id, table_id: table.id }]);
        });
        await Promise.all(tableLiaisons);
      }

      setStatutMessage("");
      setStep(4);

      const { data: r } = await supabase.from('reservations').select('*');
      const { data: l } = await supabase.from('reservations_tables').select('*');
      if (r) setToutesLesReservations(r);
      if (l) setToutesLesLiaisons(l);

    } catch (err) {
      setStatutMessage("❌ Erreur lors du traitement. Veuillez réessayer.");
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <AdminBar />
      <section className="max-w-6xl mx-auto px-4 py-20">
        
        <div className="text-center mb-12 space-y-2 select-none">
          <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">// CONFIGURATION DU COUVERT</span>
          <h2 className="text-3xl font-serif font-light tracking-widest text-stone-200 uppercase">Réservation en ligne</h2>
          <div className="w-12 h-[1px] bg-stone-800 mx-auto mt-3"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* PANNEAU GAUCHE : SÉLECTION DES CRITÈRES ET CALENDRIER */}
          <div className="lg:col-span-7 bg-stone-900/30 border border-white/5 p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">👤 Nombre de personnes</label>
                <select disabled={step > 1} value={formData.couverts} onChange={(e) => setFormData({...formData, couverts: e.target.value})} className="w-full bg-stone-950 border border-white/10 p-3.5 text-xs text-stone-300 outline-none font-mono">
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} {n > 1 ? 'Couverts' : 'Couvert'}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">📍 Zone de placement</label>
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={step > 1} type="button" onClick={() => setFormData({...formData, zone: 'salle'})} className={`p-3 text-[10px] tracking-wider uppercase border ${formData.zone === 'salle' ? 'border-amber-500/40 bg-amber-500/5 text-amber-400 font-bold' : 'border-white/5 text-stone-500 bg-stone-950/40'}`}>Salle 🎧</button>
                  <button disabled={step > 1} type="button" onClick={() => setFormData({...formData, zone: 'terrasse'})} className={`p-3 text-[10px] tracking-wider uppercase border ${formData.zone === 'terrasse' ? 'border-amber-500/40 bg-amber-500/5 text-amber-400 font-bold' : 'border-white/5 text-stone-500 bg-stone-950/40'}`}>Terrasse ☀️</button>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center font-mono text-xs border-b border-white/5 pb-3">
                <button type="button" disabled={step > 1} onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="text-stone-500 hover:text-white px-2 disabled:opacity-10">◀</button>
                <span className="uppercase text-stone-200 font-bold tracking-widest font-mono">{moisNoms[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                <button type="button" disabled={step > 1} onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="text-stone-500 hover:text-white px-2 disabled:opacity-10">▶</button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] text-stone-500 uppercase tracking-wider font-bold mb-2">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <span key={d}>{d}</span>)}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {daysArr.map((day, index) => {
                  if (!day) return <div key={index} className="aspect-square"></div>;
                  
                  const localStr = day.toLocaleDateString('fr-CA');

// On compare les jours purs sans l'heure courante de l'ordinateur
const aujourdhuiPur = new Date();
aujourdhuiPur.setHours(0,0,0,0);
const jourBoutonPur = new Date(day);
jourBoutonPur.setHours(0,0,0,0);

const isPassed = jourBoutonPur < aujourdhuiPur;
const isSelected = formData.date === localStr;

                  const joursStr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
                  const conf = horairesSemaine.find(h => h.jour === joursStr[day.getDay()]);
                  const isFerme = !conf || (!conf.midi_ouvert && !conf.soir_ouvert);

                  const isDisabled = isPassed || isFerme || step > 1;

                  return (
                    <button
                      key={index} type="button" disabled={isDisabled} onClick={() => handleDateSelect(day)}
                      className={`aspect-square text-xs font-mono border flex flex-col items-center justify-center relative transition-all ${
                        isSelected ? 'border-amber-400 bg-amber-500/10 text-amber-400 font-bold z-10 scale-105' :
                        isDisabled 
                          ? 'border-transparent text-stone-700 opacity-20 cursor-not-allowed bg-stone-950/20' 
                          : 'border-white/[0.03] bg-stone-950 text-stone-300 hover:border-stone-500 hover:text-white'
                      }`}
                    >
                      <span>{day.getDate()}</span>
                      {isFerme && !isPassed && <span className="absolute bottom-1 text-[7px] text-rose-500/60 font-sans uppercase tracking-tighter">Fermé</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PANNEAU DROIT : ÉTAPES & BOUTONS DE RETOUR */}
          <div className="lg:col-span-5 bg-stone-900/10 border border-white/5 p-6 md:p-8 min-h-[510px] flex flex-col justify-between">
            
            {/* ÉTAPE 1 : Accueil / En attente de choix de date */}
            {step === 1 && (
              <div className="space-y-6 flex-1 flex flex-col justify-between h-full py-4">
                <div className="text-center space-y-2 my-auto">
                  <div className="text-xl font-serif text-stone-600 tracking-widest uppercase">// ÉTAPE 2</div>
                  <p className="text-xs font-mono text-stone-400 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                    Sélectionnez une date sur le calendrier pour afficher les horaires disponibles.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="text-[10px] font-mono p-4 bg-stone-950 border border-white/5 text-stone-400 leading-relaxed uppercase">
                    📌 Les réservations ferment automatiquement en dehors de nos plages de service.
                  </div>
                  
                  {/* BOUTON REQUIS POUR RETOURNER SUR LE SITE PRINCIPAL */}
                  <Link href="/" className="block w-full py-3 bg-stone-950 hover:bg-stone-900 border border-white/10 text-center text-stone-300 hover:text-white font-mono text-xs uppercase tracking-widest transition-all">
                    ← Retourner sur le site
                  </Link>
                </div>
              </div>
            )}

            {/* ÉTAPE 2 : Sélection de l'horaire */}
            {step === 2 && (
              <div className="space-y-6 flex-1 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2 font-mono text-[10px]">
                    <span className="text-amber-400 uppercase tracking-widest">Horaires disponibles</span>
                    <span className="text-stone-300 font-bold">{formData.date}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
      {creneauxDisponibles.map((slot, i) => {
                      let btnStyle = "bg-stone-950 border-white/10 text-stone-200 hover:border-amber-400 hover:text-amber-400 font-bold";
                      let subLabel = "";

                      if (slot.emporterSeul) {
                        btnStyle = "bg-amber-500/5 border-amber-500/20 text-amber-400 hover:border-amber-400";
                        subLabel = "🥡 EMPORTER";
                      } else if (!slot.possible) {
                        btnStyle = "bg-stone-950/10 border-white/5 text-stone-800 cursor-not-allowed opacity-20";
                        subLabel = "COMPLET";
                      } else if (slot.arrangement) {
                        btnStyle = "bg-amber-500/[0.02] border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:border-amber-400";
                        subLabel = "ARRANGEMENT";
                      }

                      return (
                        <button
                          key={i} type="button" disabled={!slot.possible && !slot.emporterSeul}
                          onClick={() => {
                            setFormData({ ...formData, heure: slot.heure, notes: slot.emporterSeul ? `[COMMANDE A EMPORTER] ${formData.notes}` : formData.notes });
                            setTableTrouveePourResa(slot.tablesAllouees || []); 
                            setStep(3);
                          }}
                          className={`p-2 border text-center flex flex-col items-center justify-center transition-all font-mono text-xs ${btnStyle}`}
                        >
                          <span>{slot.heure.replace(':', 'H')}</span>
                          {subLabel && <span className="text-[7px] font-sans tracking-normal font-bold mt-0.5 uppercase">{subLabel}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] font-mono p-4 bg-stone-950 border border-white/5 text-stone-400 leading-relaxed uppercase space-y-1">
                    <p>⚙️ Durée du repas retenue : {dureeRepasMinutes} minutes.</p>
                    <p className="text-amber-400 font-medium pt-1">
                      ⚠️ "ARRANGEMENT" : Pas de table unique de {formData.couverts}P libre, mais nous pouvons combiner des tables plus petites si vous validez.
                    </p>
                  </div>

                  <button type="button" onClick={() => { setStep(1); setFormData({...formData, date: ''}); }} className="w-full py-3 border border-white/10 text-stone-400 hover:text-white font-mono text-xs uppercase tracking-widest transition-all">
                    ← Choisir une autre date
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : Formulaire client */}
            {step === 3 && (
              <form onSubmit={handleFinalSubmit} className="space-y-4 flex-1 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 text-center font-mono text-[10px] text-emerald-400 uppercase tracking-wider">
                    ✨ Créneau disponible sélectionné pour {formData.heure.replace(':', 'H')}
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex flex-col space-y-1">
                      <label className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">Nom</label>
                      <input type="text" required placeholder="Votre nom" value={formData.nom} onChange={(e) => setFormData({...formData, nom: e.target.value})} className="w-full bg-stone-950 border border-white/10 p-3 text-sm text-stone-200 outline-none font-mono" />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <label className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">Téléphone</label>
                      <input type="tel" required placeholder="06 00 00 00 00" value={formData.telephone} onChange={(e) => setFormData({...formData, telephone: e.target.value})} className="w-full bg-stone-950 border border-white/10 p-3 text-sm text-stone-200 font-mono outline-none" />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <label className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">E-mail</label>
                      <input type="email" required placeholder="exemple@mail.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-stone-950 border border-white/10 p-3 text-sm text-stone-200 font-mono outline-none" />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <label className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">Demande particulière</label>
                      <textarea rows="2" placeholder="Allergies, poussette..." value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="w-full bg-stone-950 border border-white/10 p-3 text-xs text-stone-200 resize-none outline-none" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={() => setStep(2)} className="py-3 px-4 border border-white/10 text-stone-500 hover:text-white font-mono text-xs">←</button>
                  <button type="submit" className="flex-1 py-3 bg-white text-black text-xs font-mono font-bold uppercase tracking-widest hover:bg-stone-200 transition-all">
                    Confirmer la réservation
                  </button>
                </div>
              </form>
            )}

            {/* ÉTAPE 4 : Confirmation */}
            {step === 4 && (
              <div className="space-y-6 text-center py-6 my-auto">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-emerald-400 tracking-widest uppercase block">// VALIDATION SUR LE SYSTÈME</span>
                  <h3 className="font-serif text-xl text-stone-200 tracking-wider uppercase">Réservation validée</h3>
                </div>

                <div className="w-full border-t border-b border-white/5 py-4 text-left font-mono text-xs text-stone-400 space-y-2 bg-stone-950/50 p-4">
                  <p className="flex justify-between"><span className="text-stone-600">Nom :</span> <span className="text-stone-100 font-bold uppercase">{formData.nom}</span></p>
                  <p className="flex justify-between"><span className="text-stone-600">Date :</span> <span className="text-stone-200">{formData.date}</span></p>
                  <p className="flex justify-between"><span className="text-stone-600">Heure :</span> <span className="text-amber-400 font-bold">{formData.heure.replace(':', 'H')}</span></p>
                  <p className="flex justify-between"><span className="text-stone-600">Couverts :</span> <span className="text-stone-200">{formData.couverts} Personnes</span></p>
                  <p className="flex justify-between"><span className="text-stone-600">Zone :</span> <span className="text-stone-200 capitalize font-bold">{formData.zone}</span></p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFormData({ nom: '', telephone: '', email: '', date: '', heure: '', couverts: '2', zone: 'salle', notes: '' });
                    setTableTrouveePourResa([]);
                    setStep(1);
                  }}
                  className="w-full py-3 bg-stone-100 text-black font-mono font-bold text-xs uppercase tracking-widest hover:bg-white transition-all"
                >
                  Faire une autre réservation
                </button>
              </div>
            )}

            {statutMessage && (
              <div className="w-full p-3 bg-stone-950 border border-white/5 text-center text-xs text-stone-400 font-serif italic mt-4">
                {statutMessage}
              </div>
            )}

          </div>

        </div>
      </section>
      <Footer />
    </main>
  );
}