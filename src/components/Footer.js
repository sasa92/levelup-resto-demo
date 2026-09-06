'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Footer() {
  const [horairesSemaine, setHorairesSemaine] = useState([]);
  const [parametres, setParametres] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Charger les Horaires
        const { data: dataHoraires, error: errHoraires } = await supabase.from('horaires').select('*');
        if (errHoraires) throw errHoraires;

        // Ordre logique d'affichage
        const ordreJours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        const trie = dataHoraires.sort((a, b) => ordreJours.indexOf(a.jour) - ordreJours.indexOf(b.jour));
        setHorairesSemaine(trie);

        // 2. Charger les Paramètres Globaux (Urgence / Alertes)
        const { data: dataParams } = await supabase.from('parametres').select('*').eq('id', 1).single();
        if (dataParams) setParametres(dataParams);

      } catch (err) {
        console.error("Erreur footer données :", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Fonction pour afficher proprement 12:30 -> 12H30
  const formaterHeure = (heure) => {
    if (!heure) return '';
    return heure.substring(0, 5).replace(':', 'H');
  };

  const isFermetureGlobale = parametres?.fermeture_globale;

  return (
    <footer className="w-full bg-[#080808] text-white pt-24 pb-12 px-6 relative">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 border-b border-white/5 pb-16">
        
        {/* Colonne 1 : Contacts */}
        <div className="space-y-6">
          <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">// CONTATTO</span>
          <h3 className="font-serif text-xl tracking-wider text-stone-200 uppercase">Brambino</h3>
          <div className="space-y-3 text-xs text-stone-400 font-light tracking-wide leading-relaxed">
            <p className="hover:text-white transition-colors cursor-pointer">📍 12 Rue de la Pizzeria, 75011 Paris</p>
            <p className="hover:text-white transition-colors">📞 <a href="tel:+33100000000">01 00 00 00 00</a></p>
            <p className="hover:text-white transition-colors">✉️ <a href="mailto:ciao@brambino.fr">ciao@brambino.fr</a></p>
            <p className="pt-2">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="inline-block border border-white/10 px-4 py-2 text-[10px] tracking-widest uppercase hover:bg-white hover:text-black transition-colors">
                📸 Instagram
              </a>
            </p>
          </div>
        </div>

        {/* Colonne 2 & 3 : Planning */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">// ORARI DELLA SETTIMANA</span>
              <h3 className="font-serif text-xl tracking-wider text-stone-200 uppercase mt-1">Les Horaires de la Semaine</h3>
            </div>

            {/* BANDEAU D'ALERTE DYNAMIQUE */}
            {parametres?.alerte_active && parametres?.message_alerte && (
              <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-[10px] font-mono text-amber-400 max-w-sm uppercase tracking-wider">
                📢 {parametres.message_alerte}
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="text-xs text-stone-600 font-mono tracking-widest py-4">// SYNC...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3 pt-2">
              {horairesSemaine.map((item) => {
                // LOGIQUE D'AFFICHAGE INTELLIGENTE
                const isClosed = isFermetureGlobale || (!item.midi_ouvert && !item.soir_ouvert);
                const isNonStop = item.midi_ouvert && !item.soir_ouvert; // Uniquement service 1
                const isSoirOnly = !item.midi_ouvert && item.soir_ouvert; // Uniquement service 2

                return (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-white/[0.03] text-xs font-light">
                    {/* Nom du jour */}
                    <span className={`capitalize font-medium w-24 ${isClosed ? 'text-stone-500' : 'text-stone-300'}`}>
                      {item.jour}
                    </span>
                    
                    {/* Heures adaptatives */}
                    <span className="text-stone-400 font-mono text-right flex-1">
                      {isClosed ? (
                        <span className="text-rose-500/80 uppercase text-[10px] tracking-widest font-bold">Fermé</span>
                      ) : isNonStop ? (
                        <span className="text-[11px] tracking-wider text-stone-200">En continu : {formaterHeure(item.midi_debut)} - {formaterHeure(item.midi_fin)}</span>
                      ) : isSoirOnly ? (
                        <span className="text-[11px] tracking-wider text-stone-200">Soir : {formaterHeure(item.soir_debut)} - {formaterHeure(item.soir_fin)}</span>
                      ) : (
                        <span className="space-y-0.5 block text-[11px]">
                          <span>Midi : <span className="text-stone-200">{formaterHeure(item.midi_debut)} - {formaterHeure(item.midi_fin)}</span></span>
                          <span className="block text-stone-500">Soir : <span className="text-stone-200">{formaterHeure(item.soir_debut)} - {formaterHeure(item.soir_fin)}</span></span>
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <div className="max-w-6xl mx-auto pt-8 flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-stone-600 tracking-wider gap-4">
        <p>© {new Date().getFullYear()} BRAMBINO PARIS. ALL RIGHTS RESERVED.</p>
        <div className="flex space-x-6">
          <a href="#privacy" className="hover:text-stone-400 transition-colors">PRIVACY POLICY</a>
          <a href="#terms" className="hover:text-stone-400 transition-colors">MENTIONS LÉGALES</a>
        </div>
      </div>
    </footer>
  );
}