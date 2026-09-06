'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PoleHoraires() {
  const [horaires, setHoraires] = useState([]);
  const [parametres, setParametres] = useState({ fermeture_globale: false, alerte_active: false, message_alerte: '' });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [msg, setMsg] = useState({ id: null, text: '', type: '' });

  // 📥 1. CHARGER LES HORAIRES ET LES PARAMÈTRES GLOBAUX
  async function fetchData() {
    setLoading(true);
    
    const { data: dataHoraires } = await supabase.from('horaires').select('*').order('id', { ascending: true });
    if (dataHoraires) setHoraires(dataHoraires);

    const { data: dataParams } = await supabase.from('parametres').select('*').eq('id', 1).single();
    if (dataParams) setParametres(dataParams);

    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  // 🔄 2. MODIFIER LES HORAIRES (LOCAL)
  const handleInputChange = (id, field, value) => {
    setHoraires((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  };

  // 🔄 3. MODIFIER LES PARAMÈTRES (LOCAL UNIQUEMENT)
  const handleLocalParamChange = (field, value) => {
    setParametres((prev) => ({ ...prev, [field]: value }));
  };

  // 💾 4. SAUVEGARDER LE BLOC PARAMÈTRES GLOBALS D'UN COUP
  const handleSaveParams = async () => {
    setSavingId('params');
    setMsg({ id: 'params', text: 'Mise à jour globale...', type: 'loading' });

    const { error } = await supabase.from('parametres').update({
      fermeture_globale: static_param_fix(parametres.fermeture_globale),
      alerte_active: static_param_fix(parametres.alerte_active),
      message_alerte: parametres.message_alerte,
      duree_repas: parseInt(parametres.duree_repas || 105) // 👈 ON AJOUTE CETTE LIGNE ICI
    }).eq('id', 1);

    if (error) {
      setMsg({ id: 'params', text: '❌ Erreur de sauvegarde', type: 'error' });
    } else {
      setMsg({ id: 'params', text: '✅ Configuration appliquée !', type: 'success' });
      setTimeout(() => setMsg({ id: null, text: '', type: '' }), 3000);
    }
    setSavingId(null);
  };

  // Petit fix de sécurité pour les booleans
  const static_param_fix = (val) => val === true || val === 'true';

  // 💾 5. SAUVEGARDER UN JOUR PRÉCIS
  const handleSaveJour = async (jourConfig) => {
    setSavingId(jourConfig.id);
    setMsg({ id: jourConfig.id, text: 'Enregistrement...', type: 'loading' });

 const { error } = await supabase.from('horaires').update({
      midi_ouvert: static_param_fix(jourConfig.midi_ouvert), 
      midi_debut: jourConfig.midi_debut, 
      midi_fin: jourConfig.midi_fin,
      midi_emporter: static_param_fix(jourConfig.midi_emporter ?? true), // 👈 AJOUTE CETTE LIGNE
      soir_ouvert: static_param_fix(jourConfig.soir_ouvert), 
      soir_debut: jourConfig.soir_debut, 
      soir_fin: jourConfig.soir_fin,
      soir_emporter: static_param_fix(jourConfig.soir_emporter ?? true), // 👈 AJOUTE CETTE LIGNE
    }).eq('id', jourConfig.id);

    if (error) {
      setMsg({ id: jourConfig.id, text: '❌ Erreur', type: 'error' });
    } else {
      setMsg({ id: jourConfig.id, text: '✅ Enregistré !', type: 'success' });
      setTimeout(() => setMsg({ id: null, text: '', type: '' }), 2000);
    }
    setSavingId(null);
  };

  // 🔒 6. FERMER UN JOUR COMPLET
const handleCloseJour = (id) => {
    setHoraires((prev) => prev.map((h) => h.id === id ? { ...h, midi_ouvert: false, soir_ouvert: false, midi_emporter: false, soir_emporter: false } : h));
    setMsg({ id, text: 'Journée marquée FERMÉE. Pensez à sauvegarder.', type: 'info' });
  };

  // 📊 EXPORT DES DONNÉES COMPATIBLE EXCEL
  const handleExportDonneesCSV = async () => {
    setMsg({ id: 'params', text: '📥 Génération du fichier statistique...', type: 'loading' });
    try {
      const { data: resData, error } = await supabase.from('reservations').select('*').order('date_reservation', { ascending: false });
      if (error) throw error;
      if (!resData || resData.length === 0) {
        alert("Aucune réservation enregistrée pour le moment.");
        return;
      }
      const headers = ['ID', 'Nom Client', 'Téléphone', 'Date Réservation', 'Heure', 'Couverts', 'Zone', 'Statut', 'Notes', 'Créé le'];
      const csvRows = resData.map(r => [
        r.id, `"${(r.nom || '').replace(/"/g, '""')}"`, `"${r.telephone || ''}"`, r.date_reservation, r.heure_reservation, r.couverts, r.zone, r.statut, `"${(r.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`, r.cree_le
      ].join(';'));
      const csvContent = "\uFEFF" + [headers.join(';'), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `stats_reservations_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMsg({ id: 'params', text: '📊 Statistiques téléchargées !', type: 'success' });
      setTimeout(() => setMsg({ id: null, text: '', type: '' }), 3000);
    } catch (err) {
      alert("Erreur lors de l'export.");
    }
  };

  // 🧹 PURGE MODULABLE ET SÉCURISÉE DES ANCIENNES DONNÉES
  const handlePurgeManuelleFiltree = async () => {
    const choix = window.confirm("⚠️ ATTENTION : Voulez-vous purger et nettoyer la base de données ?\n\nCela va supprimer TOUTES les réservations annulées ou passées. Pensez à exporter vos statistiques avant !");
    if (!choix) return;

    setMsg({ id: 'params', text: '🧹 Nettoyage de la base de données...', type: 'loading' });
    try {
      const dateAujourdhui = new Date().toISOString().split('T')[0];

      // 1. Trouver les IDs des réservations obsolètes (passées ou annulées)
      const { data: resAObsoletes, error: errFetch } = await supabase
        .from('reservations')
        .select('id')
        .or(`statut.eq.annule,date_reservation.lt.${dateAujourdhui}`);

      if (errFetch) throw errFetch;

      if (!resAObsoletes || resAObsoletes.length === 0) {
        setMsg({ id: 'params', text: '✨ Rien à purger, la base est déjà propre !', type: 'success' });
        setTimeout(() => setMsg({ id: null, text: '', type: '' }), 3000);
        return;
      }

      const listIds = resAObsoletes.map(r => r.id);

      // 2. Nettoyer les clés étrangères dans reservations_tables
      await supabase.from('reservations_tables').delete().in('reservation_id', listIds);

      // 3. Purger les réservations de la table maîtresse
      const { error: errDelete } = await supabase.from('reservations').delete().in('id', listIds);
      if (errDelete) throw errDelete;

      setMsg({ id: 'params', text: `✅ Purge réussie ! ${listIds.length} dossiers archivés ont été nettoyés.`, type: 'success' });
      setTimeout(() => setMsg({ id: null, text: '', type: '' }), 4000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'exécution de la purge.");
    }
  };

  if (loading) return <div className="text-xs font-mono text-stone-600 animate-pulse pb-20">Synchronisation système...</div>;

  return (
    <div className="space-y-10 pb-20">
      {/* EN-TÊTE */}
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-2xl font-serif tracking-widest text-white uppercase font-light">Pôle Horaires & Événements</h2>
        <p className="text-xs text-stone-400 font-mono mt-1">Gérez les ouvertures, les alertes clients et les urgences.</p>
      </div>

      {/* 🔴 ZONE URGENCE ET ÉVÉNEMENTS */}
      <div className="bg-stone-900/60 border border-white/10 p-6 shadow-2xl max-w-6xl space-y-6">
        <h3 className="text-xs font-mono tracking-widest uppercase text-amber-500 font-bold flex items-center gap-2">
          <span>⚠️</span> PANNEAU DE CONTRÔLE GLOBAL
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* MASTER SWITCH : FERMETURE TOTALE */}
          <div className="space-y-3 p-4 bg-stone-950/50 border border-rose-500/10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-serif text-rose-400">Fermeture Exceptionnelle (Master Switch)</p>
                <p className="text-[10px] font-mono text-stone-500 mt-1">Bloque instantanément toutes les réservations sur le site client.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input type="checkbox" checked={parametres.fermeture_globale} onChange={(e) => handleLocalParamChange('fermeture_globale', e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-stone-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
              </label>
            </div>
            {parametres.fermeture_globale && <p className="text-[10px] text-rose-500 font-mono font-bold animate-pulse uppercase">// LE RESTAURANT EST MARQUÉ FERMÉ</p>}
          </div>

          {/* MESSAGE BANDEAU (ÉVÉNEMENTS) */}
          <div className="space-y-3 p-4 bg-stone-950/50 border border-amber-500/10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-serif text-amber-400">Bandeau d'Alerte / Événement</p>
                <p className="text-[10px] font-mono text-stone-500 mt-1">Afficher un message flottant sur l'accueil du site client.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input type="checkbox" checked={parametres.alerte_active} onChange={(e) => handleLocalParamChange('alerte_active', e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-stone-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
            <textarea 
              value={parametres.message_alerte} 
              onChange={(e) => handleLocalParamChange('message_alerte', e.target.value)} 
              disabled={!parametres.alerte_active}
              placeholder="Ex: Fermeture exceptionnelle du 12 au 15 août..." 
              className="w-full bg-stone-900 border border-white/10 p-3 text-xs font-mono text-stone-200 resize-none focus:outline-none focus:border-amber-500/50 disabled:opacity-30"
              rows={2}
            />
          </div>

        </div>

        {/* LE BOUTON COMMUN DE SAUVEGARDE EN BAS DU BLOC */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/5">
          {msg.id === 'params' && <span className={`text-[11px] font-mono ${msg.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>{msg.text}</span>}
          <button 
            onClick={handleSaveParams} 
            disabled={savingId === 'params'} 
            className="px-6 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px] font-mono uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
          >
            Enregistrer le panneau global
          </button>
        </div>
      </div>

      {/* LA GRILLE DES 7 JOURS */}
      <div className="space-y-4 max-w-6xl">
        <h3 className="text-xs font-mono tracking-widest uppercase text-stone-500 font-bold">// Configuration de la semaine type</h3>
        {horaires.map((jour) => {
          const isClosed = !jour.midi_ouvert && !jour.soir_ouvert;

          return (
            <div key={jour.id} className={`bg-stone-900/30 border p-5 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 transition-all ${isClosed ? 'border-rose-500/10 bg-rose-500/[0.01]' : 'border-white/5 hover:border-white/10'}`}>
              
              <div className="w-32 flex-shrink-0 space-y-1">
                <h3 className="font-serif text-lg tracking-wide text-stone-200 font-medium capitalize">{jour.jour}</h3>
                {isClosed ? <span className="inline-block text-[9px] font-mono font-bold tracking-widest bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 uppercase">🔒 Fermé</span> : <span className="inline-block text-[9px] font-mono font-bold tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 uppercase">🔓 Ouvert</span>}
              </div>

{/* SERVICE 1 (MIDI) */}
              <div className={`p-3 bg-stone-950/40 border border-white/5 flex-1 w-full xl:w-auto space-y-3 ${!jour.midi_ouvert && 'opacity-30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" checked={jour.midi_ouvert} onChange={(e) => handleInputChange(jour.id, 'midi_ouvert', e.target.checked)} className="accent-amber-500 h-4 w-4" />
                    <span className="text-[10px] font-mono text-amber-500 uppercase tracking-wider font-bold">Service Midi</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-mono">
                    <input type="text" maxLength={5} value={jour.midi_debut} onChange={(e) => handleInputChange(jour.id, 'midi_debut', e.target.value)} disabled={!jour.midi_ouvert} className="w-14 bg-stone-950 border border-white/10 p-1 text-center text-stone-300 outline-none" />
                    <span className="text-stone-600">à</span>
                    <input type="text" maxLength={5} value={jour.midi_fin} onChange={(e) => handleInputChange(jour.id, 'midi_fin', e.target.value)} disabled={!jour.midi_ouvert} className="w-14 bg-stone-950 border border-white/10 p-1 text-center text-stone-300 outline-none" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                  <span className="text-[9px] font-mono text-stone-500 uppercase">Autoriser l'Emporter (Fin de service)</span>
                  <input type="checkbox" checked={jour.midi_emporter ?? true} disabled={!jour.midi_ouvert} onChange={(e) => handleInputChange(jour.id, 'midi_emporter', e.target.checked)} className="accent-amber-500 h-3.5 w-3.5" />
                </div>
              </div>

             {/* SERVICE 2 (SOIR) */}
              <div className={`p-3 bg-stone-950/40 border border-white/5 flex-1 w-full xl:w-auto space-y-3 ${!jour.soir_ouvert && 'opacity-30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" checked={jour.soir_ouvert} onChange={(e) => handleInputChange(jour.id, 'soir_ouvert', e.target.checked)} className="accent-amber-500 h-4 w-4" />
                    <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider font-bold">Service Soir</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-mono">
                    <input type="text" maxLength={5} value={jour.soir_debut} onChange={(e) => handleInputChange(jour.id, 'soir_debut', e.target.value)} disabled={!jour.soir_ouvert} className="w-14 bg-stone-950 border border-white/10 p-1 text-center text-stone-300 outline-none" />
                    <span className="text-stone-600">à</span>
                    <input type="text" maxLength={5} value={jour.soir_fin} onChange={(e) => handleInputChange(jour.id, 'soir_fin', e.target.value)} disabled={!jour.soir_ouvert} className="w-14 bg-stone-950 border border-white/10 p-1 text-center text-stone-300 outline-none" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                  <span className="text-[9px] font-mono text-stone-500 uppercase">Autoriser l'Emporter (Fin de service)</span>
                  <input type="checkbox" checked={jour.soir_emporter ?? true} disabled={!jour.soir_ouvert} onChange={(e) => handleInputChange(jour.id, 'soir_emporter', e.target.checked)} className="accent-amber-500 h-3.5 w-3.5" />
                </div>
              </div>

              {/* BOUTONS D'ACTION */}
              <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
                {!isClosed && (
                  <button onClick={() => handleCloseJour(jour.id)} className="px-3 py-2 bg-rose-500/5 border border-rose-500/10 text-rose-400 text-[10px] font-mono uppercase tracking-widest hover:bg-rose-500/20 transition-all">
                    Fermer
                  </button>
                )}
                <button onClick={() => handleSaveJour(jour)} disabled={savingId === jour.id} className="px-4 py-2 bg-stone-100 text-black font-bold text-[10px] font-mono uppercase tracking-widest hover:bg-white transition-all w-full xl:w-32 text-center">
                  Mettre à jour
                </button>
              </div>

              {msg.id === jour.id && <div className="absolute xl:relative w-full xl:w-auto text-center text-[10px] font-mono px-2 py-1 bg-stone-800 text-stone-300">{msg.text}</div>}
            </div>
          );
        })}
      </div>
      {/* CHAMP DE ROTATION / TEMPS DE REPAS PERSO (INPUT NUMÉRIQUE) */}
          <div className="space-y-3 p-4 bg-stone-950/50 border border-amber-500/10 lg:col-span-2">
            <div>
              <p className="text-sm font-serif text-amber-400">Rotation & Durée d'occupation d'une table</p>
              <p className="text-[10px] font-mono text-stone-500 mt-1">
                Indiquez en minutes la durée moyenne d'un repas. Une table sera automatiquement bloquée pendant cette durée avant de se libérer.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="15"
                max="360"
                value={parametres.duree_repas || 105}
                onChange={(e) => handleLocalParamChange('duree_repas', parseInt(e.target.value) || 0)}
                className="w-32 bg-stone-900 border border-white/10 p-3 text-xs font-mono text-stone-200 outline-none focus:border-amber-500/50 rounded-none text-center font-bold"
                placeholder="Ex: 105"
              />
              <span className="text-xs font-mono text-stone-400 uppercase tracking-widest">Minutes</span>
            </div>
          </div>

          {/* ⚙️ ZONE SAAS DU MODÈLE : EXPORT STATISTIQUE & PURGE VOLONTAIRE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-white/5 lg:col-span-2">
          
          {/* ZONE EXPORT EXCEL */}
          <div className="space-y-3 p-4 bg-stone-950/50 border border-emerald-500/10 flex flex-col justify-between">
            <div>
              <p className="text-sm font-serif text-emerald-400">Sauvegarde & Archivage (Fichier Excel / CSV)</p>
              <p className="text-[10px] font-mono text-stone-500 mt-1">
                Générez et téléchargez le registre complet de vos fiches clients (Noms, Téléphones, Volume) au format tableur sur votre PC avant réinitialisation.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportDonneesCSV}
              className="w-full py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] font-mono uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all text-center rounded-none"
            >
              📊 Télécharger l'export statistique (.csv)
            </button>
          </div>

          {/* ZONE PURGE MODULABLE */}
          <div className="space-y-3 p-4 bg-stone-950/50 border border-rose-500/10 flex flex-col justify-between">
            <div>
              <p className="text-sm font-serif text-rose-400">Purge Manuelle Volontaire du Système</p>
              <p className="text-[10px] font-mono text-stone-500 mt-1">
                Nettoyez instantanément l'historique en supprimant définitivement toutes les réservations passées ou annulées pour conserver une fluidité maximale.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePurgeManuelleFiltree}
              className="w-full py-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[10px] font-mono uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all text-center rounded-none"
            >
              🧹 Purger les dossiers obsolètes maintenant
            </button>
          </div>

        </div>
    </div>
  );
}