'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function MenuPage() {
  const [allPlats, setAllPlats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vueGalerie, setVueGalerie] = useState(true); // Changé à true pour afficher les images direct !
  const [currentCategorie, setCurrentCategorie] = useState('toutes');

  useEffect(() => {
    async function fetchFullMenu() {
      try {
        const { data, error } = await supabase.from('menu').select('*');
        if (error) throw error;
        setAllPlats(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchFullMenu();
  }, []);

  // Nettoyage du nom de la variable (sans accent pour éviter les bugs)
  const platsFiltreres = allPlats.filter(plat => {
    if (currentCategorie === 'toutes') return true;
    return plat.categorie === currentCategorie;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-stone-500 font-mono text-xs tracking-widest">
        // CHARGEMENT DE LA CARTE INTÉGRALE...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white py-16 px-6">
      
      {/* Bouton Retour Accueil */}
      <div className="max-w-5xl mx-auto mb-12">
        <Link href="/" className="text-xs tracking-widest text-stone-500 hover:text-white transition-colors uppercase">
          ← Retour à l'accueil
        </Link>
      </div>

      <div className="text-center mb-16 space-y-3">
        <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">// IL MENU</span>
        <h1 className="text-4xl md:text-5xl font-serif font-light tracking-widest text-stone-200 uppercase">La Carte Complète</h1>
      </div>

      <div className="w-full max-w-5xl mx-auto">
        {/* Filtres par catégories réelles */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-16 pb-6 border-b border-white/5">
          <div className="flex flex-wrap gap-6 text-xs tracking-[0.2em] font-light uppercase text-stone-400">
            {['toutes', 'entrees', 'pizzas', 'desserts', 'boissons'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCurrentCategorie(cat)}
                className={`transition-colors ${currentCategorie === cat ? 'text-white font-medium underline underline-offset-4' : 'hover:text-stone-200'}`}
              >
                {cat === 'entrees' ? 'Entrées' : cat === 'toutes' ? 'Tout' : cat}
              </button>
            ))}
          </div>

          {/* Bouton Switch de style */}
          <button
            onClick={() => setVueGalerie(!vueGalerie)}
            className="flex items-center space-x-2 px-4 py-2 border border-white/10 text-[11px] tracking-widest uppercase text-stone-300 hover:bg-white hover:text-black transition-all duration-300"
          >
            {vueGalerie ? <><span>☰</span> <span>Vue Liste Chic</span></> : <><span>🖼️</span> <span>Vue Galerie</span></>}
          </button>
        </div>

        {/* Affichage des plats filtrés */}
        {platsFiltreres.length === 0 ? (
          <p className="text-center text-stone-500 text-sm py-12">Aucun élément dans cette catégorie pour le moment.</p>
        ) : vueGalerie ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {platsFiltreres.map((plat) => (
              <div key={plat.id} className="border border-white/5 bg-[#0c0c0c] p-4 flex flex-col space-y-4">
                <div className="w-full aspect-[16/10] overflow-hidden relative">
                  <img src={plat.image} alt={plat.nom} className="w-full h-full object-cover brightness-90" />
                </div>
                <div className="flex justify-between items-baseline">
                  <h3 className="font-serif text-lg text-stone-200">{plat.nom}</h3>
                  <span className="font-mono text-stone-400 text-sm">{Number(plat.prix).toFixed(2)}€</span>
                </div>
                <p className="text-xs text-stone-500 font-light leading-relaxed">{plat.ingredients}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8 max-w-3xl mx-auto">
            {platsFiltreres.map((plat) => (
              <div key={plat.id} className="flex flex-col space-y-1">
                <div className="flex justify-between items-baseline space-x-4">
                  <h3 className="font-serif text-xl text-stone-200">{plat.nom}</h3>
                  <div className="flex-1 border-b border-dotted border-stone-800 mx-2"></div>
                  <span className="font-mono text-sm text-stone-300">{Number(plat.prix).toFixed(2)}€</span>
                </div>
                <p className="text-xs text-stone-500 font-light">{plat.ingredients}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}