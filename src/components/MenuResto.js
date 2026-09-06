'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function MenuResto() {
  const [platsPhares, setPlatsPhares] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlatsPhares() {
      try {
        // On demande à Supabase UNIQUEMENT les plats cochés comme "phare"
        const { data, error } = await supabase
          .from('menu')
          .select('*')
          .eq('phare', true);
        
        if (error) throw error;
        setPlatsPhares(data || []);
      } catch (error) {
        console.error("Erreur chargement plats phares :", error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPlatsPhares();
  }, []);

  if (loading) {
    return (
      <div className="w-full text-center py-10 text-stone-500 font-mono text-xs tracking-widest">
        // CHARGEMENT DE LA SÉLECTION...
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 flex flex-col items-center">
      
      {/* Grille forcée en mode Galerie pour l'accueil */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-16">
        {platsPhares.map((plat) => (
          <div key={plat.id} className="group border border-white/5 bg-[#0c0c0c] overflow-hidden">
            <div className="w-full aspect-[16/10] overflow-hidden relative">
              <img 
                src={plat.image} 
                alt={plat.nom}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-90"
              />
            </div>
            <div className="p-6 space-y-2">
              <div className="flex justify-between items-baseline">
                <h3 className="font-serif text-lg tracking-wide text-stone-200">{plat.nom}</h3>
                <span className="font-mono text-sm text-stone-400">{Number(plat.prix).toFixed(2)}€</span>
              </div>
              <p className="text-xs text-stone-500 font-light leading-relaxed">{plat.ingredients}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Le bouton chic pour aller sur la page menu globale */}
      <Link 
        href="/menu"
        className="px-8 py-4 border border-white/20 text-xs tracking-[0.25em] font-medium uppercase text-stone-300 hover:bg-white hover:text-black transition-all duration-300"
      >
        Découvrir toute la carte
      </Link>

    </div>
  );
}