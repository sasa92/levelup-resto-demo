'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function GestionReservations() {

  // État pour la barre de recherche en temps réel
  const [searchTerm, setSearchTerm] = useState('');
  
  // Écurie d'états pour l'ajout manuel (Téléphone / Walk-in)
  const [showAjoutManuel, setShowAjoutManuel] = useState(false);
  const [manuelForm, setManuelForm] = useState({ nom: '', telephone: '', heure: '12:00', couverts: '2', zone: 'salle' });
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [liaisons, setLiaisons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtres temporels
const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('fr-CA'));
  const [filterService, setFilterService] = useState('soir'); // 'midi' ou 'soir'
  
  // Réservation sélectionnée pour placement manuel ou automatique
  const [selectedRes, setSelectedRes] = useState(null);
  const [msgGlobal, setMsgGlobal] = useState('');

  // ⏰ CONFIGURATION DU RESTAURANT : Variable d'occupation lue depuis la BDD (Défaut 105m)
  const [dureeRepasMinutes, setDureeRepasMinutes] = useState(105);

  async function loadDonnees() {
    setLoading(true);
    
    const { data: dataTables } = await supabase.from('tables').select('*').order('numero', { ascending: true });
    if (dataTables) setTables(dataTables);

    const { data: dataRes } = await supabase
      .from('reservations')
      .select('*')
      .eq('date_reservation', filterDate)
      .order('heure_reservation', { ascending: true });
    if (dataRes) setReservations(dataRes);

    const { data: dataLiaisons } = await supabase.from('reservations_tables').select('*');
    if (dataLiaisons) setLiaisons(dataLiaisons);

    // Charger la durée personnalisée depuis les paramètres généraux
    const { data: dataParams } = await supabase.from('parametres').select('duree_repas').eq('id', 1).single();
    if (dataParams?.duree_repas) setDureeRepasMinutes(dataParams.duree_repas);

    setLoading(false);
  }

  useEffect(() => {
    loadDonnees();
  }, [filterDate]);

  // 🕒 Outil de conversion : "19:30" -> 1170 minutes depuis minuit
  const toMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
  };

 const estDansLeService = (heureStr) => {
    if (!heureStr) return false;
    const heure = parseInt(heureStr.split(':')[0]);
    if (filterService === 'midi') return heure >= 0 && heure <= 16; // 👈 Modifié pour inclure tout le début de journée
    if (filterService === 'soir') return heure >= 16 && heure <= 24; // 👈 Modifié pour capter la bascule de fin d'aprèm
    return false;
  };

  // 🧠 1. APPLICATION DU FILTRE DE SERVICE + FILTRE DE RECHERCHE PAR TEXTE / TEL
  const filteredReservations = reservations
    .filter(res => estDansLeService(res.heure_reservation))
    .filter(res => {
      const nomMatch = res.nom?.toLowerCase().includes(searchTerm.toLowerCase());
      const telMatch = res.telephone?.includes(searchTerm);
      return nomMatch || telMatch;
    });

  // 🧠 ALGORITHME CLÉ : Détecter si une table spécifique est occupée à une heure précise
  const verifierOccupationTableALHeure = (tableId, heureCibleStr, reservationIdIgnore = null) => {
    const cibleMinutes = toMinutes(heureCibleStr);

    // On parcourt toutes les liaisons existantes pour ce jour-là
    const liaisonsDuJour = liaisons.filter(l => l.table_id === tableId);
    
    for (let liaison of liaisonsDuJour) {
      // Trouver la résa correspondante à cette liaison
      const res = reservations.find(r => r.id === liaison.reservation_id);
      
      // Si la résa existe, qu'elle est confirmée, et qu'on ne doit pas l'ignorer
      if (res && res.statut === 'confirme' && res.id !== reservationIdIgnore) {
        const resMinutes = toMinutes(res.heure_reservation);
        
        // CONFLIT TEMPOREL : Si l'écart entre les deux réservations est inférieur à la durée configurée
        if (Math.abs(cibleMinutes - resMinutes) < dureeRepasMinutes) {
          return res; // La table est occupée par cette résa !
        }
      }
    }
    return null; // La table est totalement libre à cette heure-là
  };

  // 🚪 MANIPULATION FLUX EN DIRECT : Libérer une table manuellement
  const handleLibererTable = async (tableId) => {
    const liaisonsActuelles = liaisons.filter(l => l.table_id === tableId && filteredReservations.some(r => r.id === l.reservation_id));
    if (liaisonsActuelles.length > 0) {
      const ids = liaisonsActuelles.map(l => l.id);
      await supabase.from('reservations_tables').delete().in('id', ids);
      setMsgGlobal('🪑 Table libérée pour la rotation !');
      loadDonnees();
      setTimeout(() => setMsgGlobal(''), 2000);
    }
  };

  // 🧹 NETTOYAGE TOTAL : Tout libérer d'un coup
  const handleToutLiberer = async () => {
    if (confirm('Voulez-vous réinitialiser toutes les tables de ce service ?')) {
      const liaisonsService = liaisons.filter(l => filteredReservations.some(r => r.id === l.reservation_id));
      if (liaisonsService.length > 0) {
        await supabase.from('reservations_tables').delete().in('id', liaisonsService.map(l => l.id));
        setMsgGlobal('🧹 Salle réinitialisée.');
        loadDonnees();
        setTimeout(() => setMsgGlobal(''), 2000);
      }
    }
  };

  // 🗑️ NOUVEAU : SUPPRESSION DÉFINITIVE D'UN CLIENT DE LA BDD
  const handleSupprimerDefinitif = async (reservationId) => {
    if (!window.confirm("Supprimer définitivement ce client ? Ses liaisons de tables seront détruites et ses places libérées d'office.")) return;

    try {
      // 1. Supprimer d'abord ses liaisons de table pour contourner les contraintes de clés étrangères
      await supabase.from('reservations_tables').delete().eq('reservation_id', reservationId);

      // 2. Supprimer la ligne de réservation
      const { error } = await supabase.from('reservations').delete().eq('id', reservationId);

      if (error) throw error;

      setMsgGlobal("🗑️ Client supprimé définitivement de la base de données.");
      if (selectedRes?.id === reservationId) setSelectedRes(null);
      loadDonnees();
      setTimeout(() => setMsgGlobal(''), 3000);
    } catch (err) {
      alert("Erreur lors de l'effacement définitif.");
    }
  };

  const handleSaveReservationManuelle = async (e) => {
    e.preventDefault();
    if (!manuelForm.nom || !manuelForm.telephone) return alert('Veuillez remplir le nom et le numéro.');

    try {
      // 1. Insérer la demande validée d'office
      const { data: newRes, error: errRes } = await supabase.from('reservations').insert([{
        nom: manuelForm.nom,
        telephone: manuelForm.telephone,
        date_reservation: filterDate,
        heure_reservation: manuelForm.heure,
        couverts: parseInt(manuelForm.couverts),
        zone: manuelForm.zone,
        notes: "[AFFECTATION MANUELLE DASHBOARD]",
        statut: 'confirme'
      }]).select().single();

      if (errRes) throw errRes;

      // 2. Chercher la première table libre pour la lier d'office
      const tablesAdequates = tables
        .filter(t => t.capacite >= parseInt(manuelForm.couverts) && t.zone === manuelForm.zone);
      
      let tableAttribuee = null;
      for (let t of tablesAdequates) {
        if (!verifierOccupationTableALHeure(t.id, manuelForm.heure)) {
          tableAttribuee = t;
          break;
        }
      }

      // Si une table est vacante à cette heure, on crée la liaison automatique
      if (tableAttribuee) {
        await supabase.from('reservations_tables').insert([{ reservation_id: newRes.id, table_id: tableAttribuee.id }]);
        setMsgGlobal(`✅ Client placé à la table ${tableAttribuee.numero}`);
      } else {
        setMsgGlobal('⚠️ Client enregistré, mais aucune table libre trouvée. À placer manuellement.');
      }

      setShowAjoutManuel(false);
      setManuelForm({ nom: '', telephone: '', heure: '12:00', couverts: '2', zone: 'salle' });
      loadDonnees();
      setTimeout(() => setMsgGlobal(''), 4000);

    } catch (err) {
      alert("Erreur lors de l'enregistrement manuel.");
    }
  };

  // 🤖 ALGORITHME DE PLACEMENT AUTOMATIQUE SMART
  const handlePlacementAutomatique = async (res) => {
    setMsgGlobal('Calcul de la meilleure table disponible...');
    
    const tablesCandidates = tables
      .filter(t => t.capacite >= res.couverts && t.zone === res.zone)
      .sort((a, b) => a.capacite - b.capacite);

    let tableTrouvee = null;
    for (let table of tablesCandidates) {
      const occupant = verifierOccupationTableALHeure(table.id, res.heure_reservation);
      if (!occupant) {
        tableTrouvee = table;
        break;
      }
    }

    if (tableTrouvee) {
      await supabase.from('reservations_tables').insert([{ reservation_id: res.id, table_id: tableTrouvee.id }]);
      setMsgGlobal(`✅ Table ${tableTrouvee.numero} assignée automatiquement à ${res.nom} !`);
      
      const { data } = await supabase.from('reservations_tables').select('*');
      if (data) setLiaisons(data);
    } else {
      setMsgGlobal('❌ Aucune table individuelle libre pour cette taille de groupe à cette heure.');
    }

    setTimeout(() => setMsgGlobal(''), 4000);
  };

  // 🔗 AFFECTATION MANUELLE AU CLIC SUR LE PLAN
  const handleTableClick = async (tableId) => {
    if (!selectedRes) {
      handleLibererTable(tableId);
      return;
    }

    const liaisonExistante = liaisons.find(l => l.reservation_id === selectedRes.id && l.table_id === tableId);

    if (liaisonExistante) {
      await supabase.from('reservations_tables').delete().eq('id', liaisonExistante.id);
    } else {
      const dejamise = verifierOccupationTableALHeure(tableId, selectedRes.heure_reservation, selectedRes.id);
      if (dejamise) {
        alert(`Impossible : La table est déjà réservée par ${dejamise.nom} à ${dejamise.heure_reservation} (Tranche d'occupation de 1h45)`);
        return;
      }

      await supabase.from('reservations_tables').insert([{ reservation_id: selectedRes.id, table_id: tableId }]);
    }
    
    const { data } = await supabase.from('reservations_tables').select('*');
    if (data) setLiaisons(data);
  };

  const handleUpdateStatut = async (resId, nouveauStatut) => {
    await supabase.from('reservations').update({ statut: nouveauStatut }).eq('id', resId);
    loadDonnees();
    if (selectedRes?.id === resId) setSelectedRes(null);
  };

  return (
    <div className="space-y-8 pb-20 select-none">
      {/* HEADER */}
      <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-serif tracking-widest text-white uppercase font-light">Suivi des Réservations</h2>
          <p className="text-xs text-stone-400 font-mono mt-1">Gestion intelligente temporelle : Libération automatique des tables après {dureeRepasMinutes} minutes.</p>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handleToutLiberer} className="px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[10px] uppercase tracking-wider hover:bg-rose-500 hover:text-black transition-all">
            🧹 Tout Libérer
          </button>
          <button onClick={() => setShowAjoutManuel(!showAjoutManuel)} className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[10px] uppercase tracking-wider hover:bg-amber-500 hover:text-black transition-all">
            ➕ Prendre une Résa (Tél / Direct)
          </button>
          <div className="flex flex-wrap items-center gap-3 bg-stone-900/40 p-3 border border-white/5 shadow-xl">
            <input type="date" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setSelectedRes(null); }} className="bg-stone-950 border border-white/10 p-2 text-xs font-mono text-stone-200 scheme-dark outline-none" />
            <div className="flex bg-stone-950 p-1 border border-white/10">
              <button onClick={() => { setFilterService('midi'); setSelectedRes(null); }} className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider ${filterService === 'midi' ? 'bg-amber-500/20 text-amber-400' : 'text-stone-500'}`}>☀️ Midi</button>
              <button onClick={() => { setFilterService('soir'); setSelectedRes(null); }} className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider ${filterService === 'soir' ? 'bg-amber-500/20 text-amber-400' : 'text-stone-500'}`}>🌙 Soir</button>
            </div>
          </div>
        </div>
      </div>

      {msgGlobal && (
        <div className="p-3 bg-stone-900 border border-amber-500/30 text-amber-400 font-mono text-xs max-w-xl animate-pulse uppercase tracking-wider">
          {msgGlobal}
        </div>
      )}

      {/* 🧾 TIROIR MODAL D'AJOUT RAPIDE */}
      {showAjoutManuel && (
        <form onSubmit={handleSaveReservationManuelle} className="p-6 bg-stone-900 border border-white/10 max-w-4xl grid grid-cols-1 sm:grid-cols-5 gap-4 items-end animate-fadeIn">
          <div className="flex flex-col space-y-1">
            <label className="text-[9px] font-mono text-stone-400 uppercase">Nom Client</label>
            <input type="text" required placeholder="Ex: Jean" value={manuelForm.nom} onChange={(e) => setManuelForm({...manuelForm, nom: e.target.value})} className="bg-stone-950 border border-white/10 p-2.5 text-xs font-mono text-white outline-none focus:border-amber-500/50" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[9px] font-mono text-stone-400 uppercase">Téléphone</label>
            <input type="text" required placeholder="Ex: 06..." value={manuelForm.telephone} onChange={(e) => setManuelForm({...manuelForm, telephone: e.target.value})} className="bg-stone-950 border border-white/10 p-2.5 text-xs font-mono text-white outline-none focus:border-amber-500/50" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[9px] font-mono text-stone-400 uppercase">Heure d'arrivée</label>
            <input type="time" required value={manuelForm.heure} onChange={(e) => setManuelForm({...manuelForm, heure: e.target.value})} className="bg-stone-950 border border-white/10 p-2.5 text-xs font-mono text-white outline-none focus:border-amber-500/50" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[9px] font-mono text-stone-400 uppercase">Convives</label>
            <select value={manuelForm.couverts} onChange={(e) => setManuelForm({...manuelForm, couverts: e.target.value})} className="bg-stone-950 border border-white/10 p-2.5 text-xs font-mono text-stone-300 outline-none">
              {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} Pers</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <select value={manuelForm.zone} onChange={(e) => setManuelForm({...manuelForm, zone: e.target.value})} className="flex-1 bg-stone-950 border border-white/10 p-2.5 text-xs font-mono text-stone-300 outline-none">
              <option value="salle">Salle</option>
              <option value="terrasse">Terrasse</option>
            </select>
            <button type="submit" className="px-4 py-2.5 bg-amber-500 text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-white transition-all">
              Placer
            </button>
          </div>
        </form>
      )}

      {/* SPLIT SCREEN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8 items-start">
        
        {/* LISTE DES DEMANDES (FLUX CLIENT) */}
        <div className="space-y-4 lg:col-span-1">
          <h3 className="text-xs font-mono tracking-widest uppercase text-stone-400 font-bold">// Flux Client ({filteredReservations.length})</h3>

          {/* 🔎 BARRE DE RECHERCHE EN TEMPS RÉEL (PLUGGED) */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Trouver un nom, prénom ou téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-stone-950 border border-white/10 p-3 text-xs font-mono text-stone-200 outline-none focus:border-amber-500/50 placeholder:text-stone-700 rounded-none shadow-inner"
            />
          </div>

          {loading ? (
            <p className="text-xs font-mono text-stone-600 animate-pulse">Calcul des plannings...</p>
          ) : filteredReservations.length === 0 ? (
            <p className="text-xs font-mono text-stone-600 border border-white/5 p-6 bg-stone-900/10 uppercase tracking-wider text-center">// Aucun résultat trouvé</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredReservations.map((res) => {
                const isSelected = selectedRes?.id === res.id;
                const tablesLiees = liaisons.filter(l => l.reservation_id === res.id);
                
             return (
  <div 
    key={res.id}
    onClick={() => {
      if (res.statut === 'confirme') {
        setSelectedRes(selectedRes?.id === res.id ? null : res);
      }
    }}
    className={`border p-4 transition-all ${res.statut === 'confirme' ? 'cursor-pointer' : 'cursor-default'} ${selectedRes?.id === res.id ? 'bg-amber-500/20 border-amber-400 shadow-xl scale-[1.01]' : 'bg-stone-900/30 border-white/5 hover:border-white/10'}`}
  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-serif text-base text-stone-100">{res.nom}</h4>
                        <p className="text-[10px] font-mono text-stone-500">{res.telephone}</p>
                      </div>
                      <span className="bg-stone-950 px-2 py-1 border border-white/10 font-mono text-xs text-amber-500 font-bold">{res.heure_reservation}</span>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-[11px] font-mono text-stone-400">
                      <span>👤 {res.couverts} Couverts</span>
                      <span className="capitalize">📍 {res.zone}</span>
                    </div>

                    {/* INTERFACE ACTIONS */}
                    <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-white/5">
                      {res.statut === 'en_attente' ? (
                        <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleUpdateStatut(res.id, 'confirme'); }} className="flex-1 py-1.5 text-[9px] font-mono uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500 hover:text-black transition-all">✓ Accepter</button>
                          <button onClick={(e) => { e.stopPropagation(); handleUpdateStatut(res.id, 'annule'); }} className="py-1.5 px-3 text-[9px] font-mono uppercase bg-rose-500/10 border border-rose-500/20 text-rose-400">Refuser</button>
                        </div>
                      ) : res.statut === 'confirme' ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border ${tablesLiees.length > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'}`}>
                              {tablesLiees.length > 0 ? `🪑 Placé (Table ${tablesLiees.map(l => tables.find(t => t.id === l.table_id)?.numero).join(', ')})` : '⚠️ À Placer'}
                            </span>
                            
                            {/* BOUTON D'ANNULATION UNIQUE RESTÉ CLASSIQUE */}
                            <button onClick={(e) => { e.stopPropagation(); handleUpdateStatut(res.id, 'annule'); }} className="text-[9px] font-mono text-stone-500 hover:text-rose-400 underline">Annuler</button>
                          </div>
                          
                          {/* BOUTON PLACEMENT AUTOMATIQUE */}
                          {tablesLiees.length === 0 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handlePlacementAutomatique(res); }}
                              className="w-full py-1 text-[9px] font-mono uppercase tracking-widest bg-stone-950 border border-white/10 text-stone-300 hover:bg-white hover:text-black transition-all"
                            >
                              ⚡ Placement Automatique Intelligent
                            </button>
                          )}

                          {/* 🚨 LE BOUTON DE SUPPRESSION AGRESSIF INTÉGRÉ POUR CHAQUE CLIENT CONFIRMÉ */}
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSupprimerDefinitif(res.id); }}
                            className="w-full py-1 text-[9px] font-mono uppercase tracking-widest bg-rose-950/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white transition-all font-bold"
                          >
                            Supprimer Définitivement 🗑️
                          </button>
                        </div>
                      ) : (
                        // RENDU SI STATUT IMMÉDIATEMENT ANNULÉ : BOUTON DE NETTOYAGE ABSOLU
                        <div className="flex justify-between items-center bg-stone-950/40 p-2 border border-dashed border-white/5">
                          <span className="text-[9px] font-mono text-stone-600 uppercase tracking-widest">// Demande annulée</span>
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); handleSupprimerDefinitif(res.id); }}
                            className="text-[9px] font-mono text-rose-500 hover:text-rose-400 font-bold uppercase tracking-wider"
                          >
                            Purger ❌
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PLAN INTERACTIF */}
        <div className="lg:col-span-2 xl:col-span-3 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-mono tracking-widest uppercase text-stone-400 font-bold">
              // Plan de salle à l'instant T {selectedRes && `(Focalisé sur ${selectedRes.heure_reservation})`}
            </h3>
            {selectedRes && (
              <div className="text-[10px] font-mono text-amber-400 bg-amber-500/5 border border-amber-500/20 px-3 py-1">
                Sélectionné : <span className="text-white font-bold">{selectedRes.nom} ({selectedRes.heure_reservation})</span>. Cliquez sur les tables pour les réserver.
              </div>
            )}
          </div>

          <div className="w-full h-[600px] bg-stone-950 border border-white/10 relative overflow-hidden" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {tables.map((table) => {
              const heurePourCalcul = selectedRes ? selectedRes.heure_reservation : (filteredReservations[0]?.heure_reservation || "12:00");
              const reservationOccupante = verifierOccupationTableALHeure(table.id, heurePourCalcul, selectedRes?.id);
              const lieeASelectedRes = selectedRes && liaisons.some(l => l.reservation_id === selectedRes.id && l.table_id === table.id);

              return (
                <div
                  key={table.id}
                  onClick={() => handleTableClick(table.id)}
                  className={`absolute w-24 h-24 flex flex-col items-center justify-center p-2 border select-none transition-all ${
                    !selectedRes && !reservationOccupante ? 'border-white/5 bg-stone-900/40 opacity-50 cursor-not-allowed' : ''
                  } ${
                    selectedRes && !reservationOccupante && !lieeASelectedRes ? 'border-white/10 bg-stone-900/80 hover:border-amber-500/50 cursor-pointer' : ''
                  } ${
                    lieeASelectedRes ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] cursor-pointer z-30' : ''
                  } ${
                    reservationOccupante ? 'border-rose-500/40 bg-rose-500/[0.04] opacity-40 cursor-not-allowed' : ''
                  }`}
                  style={{ left: `${table.pos_x}px`, top: `${table.pos_y}px` }}
                >
                  <p className="font-serif text-lg text-white font-bold">{table.numero}</p>
                  <p className="text-[8px] font-mono text-stone-500 uppercase tracking-widest">{table.capacite} places</p>

                  {lieeASelectedRes ? (
                    <p className="text-[8px] font-mono text-emerald-400 font-bold uppercase mt-2">Cible 📍</p>
                  ) : reservationOccupante ? (
                    <div className="w-full mt-2 text-center border-t border-rose-500/10 pt-1">
                      <p className="text-[8px] font-mono text-rose-400 font-bold uppercase truncate">{reservationOccupante.nom.split(' ')[0]}</p>
                      <p className="text-[7px] font-mono text-stone-500">{reservationOccupante.heure_reservation}</p>
                    </div>
                  ) : (
                    <div className="w-6 h-[1px] bg-white/10 mt-3"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}