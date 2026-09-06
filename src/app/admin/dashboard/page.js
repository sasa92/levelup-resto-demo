'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardHome() {
  const [stats, setStats] = useState({ enAttente: 0, totalAujourdhui: 0, couvertsPrevus: 0 });

  useEffect(() => {
    async function fetchTodayStats() {
      const today = new Date().toISOString().split('T')[0];

      // 1. Demandes en attente
      const { count: enAttenteCount } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'en_attente');

      // 2. Réservations du jour confirmées
      const { data: todayResas } = await supabase
        .from('reservations')
        .select('couverts')
        .eq('date_reservation', today)
        .eq('statut', 'confirme');

      const totalCouverts = todayResas?.reduce((sum, res) => sum + res.couverts, 0) || 0;

      setStats({
        enAttente: enAttenteCount || 0,
        totalAujourdhui: todayResas?.length || 0,
        couvertsPrevus: totalCouverts
      });
    }

    fetchTodayStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* EN-TÊTE CHIC */}
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-2xl font-serif tracking-widest text-white uppercase font-light">Vue Globale</h2>
        <p className="text-xs text-stone-400 font-mono mt-1">Activité de la console admin en temps réel.</p>
      </div>

      {/* BLOCS DE STATISTIQUES BLINDÉS EN VISIBILITÉ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CASE 1 */}
        <div className="bg-stone-900/60 border border-white/10 p-6 shadow-xl">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-widest font-medium">Demandes en attente</p>
          <p className="text-5xl font-serif text-amber-400 mt-3 font-light tracking-wide">{stats.enAttente}</p>
          <p className="text-[10px] font-mono text-stone-500 mt-3 uppercase tracking-wider">// À valider rapidement</p>
        </div>

        {/* CASE 2 */}
        <div className="bg-stone-900/60 border border-white/10 p-6 shadow-xl">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-widest font-medium">Réservations aujourd'hui</p>
          <p className="text-5xl font-serif text-stone-100 mt-3 font-light tracking-wide">{stats.totalAujourdhui}</p>
          <p className="text-[10px] font-mono text-stone-500 mt-3 uppercase tracking-wider">// Dossiers acceptés</p>
        </div>

        {/* CASE 3 */}
        <div className="bg-stone-900/60 border border-white/10 p-6 shadow-xl">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-widest font-medium">Couverts à servir</p>
          <p className="text-5xl font-serif text-emerald-400 mt-3 font-light tracking-wide">{stats.couvertsPrevus}</p>
          <p className="text-[10px] font-mono text-stone-500 mt-3 uppercase tracking-wider">// Total couverts prévus</p>
        </div>

      </div>

      <div className="p-6 border border-white/5 bg-stone-950/60 text-[11px] font-mono text-stone-500 rounded-sm">
        <span className="text-amber-500">// Statut système :</span> Prêt. Sélectionnez un onglet opérationnel dans le volet de gauche pour configurer la salle ou la carte.
      </div>
    </div>
  );
}