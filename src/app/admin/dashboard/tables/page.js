'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function GestionPlanSalle() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeZone, setActiveZone] = useState('salle'); // 'salle' ou 'terrasse'
  
  // États formulaire ajout
  const [numero, setNumero] = useState('');
  const [capacite, setCapacite] = useState(2);
  const [msg, setMsg] = useState('');

  // Réf pour calculer le drag & drop dans l'espace de la grille
  const gridRef = useRef(null);
  const [draggingTable, setDraggingTable] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 📥 1. CHARGER LES TABLES
  async function fetchTables() {
    setLoading(true);
    const { data, error } = await supabase.from('tables').select('*').order('numero', { ascending: true });
    if (!error && data) setTables(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchTables();
  }, []);

  // ➕ 2. CRÉER UNE NOUVELLE TABLE
  const handleAddTable = async (e) => {
    e.preventDefault();
    setMsg('');

    if (!numero) return;

    const { error } = await supabase.from('tables').insert([
      { numero, capacite: parseInt(capacite), zone: activeZone, pos_x: 120, pos_y: 120 }
    ]);

    if (error) {
      setMsg('❌ Erreur : Ce numéro de table existe déjà.');
    } else {
      setMsg('✅ Table ajoutée au plan !');
      setNumero('');
      fetchTables();
    }
  };

  // ❌ 3. SUPPRIMER UNE TABLE
  const handleDeleteTable = async (id) => {
    if (confirm('Supprimer cette table retirera ses liaisons de configuration. Continuer ?')) {
      await supabase.from('tables').delete().eq('id', id);
      fetchTables();
    }
  };

  // 🎛️ 4. LOGIQUE DRAG & DROP ANIMÉE
  const handleMouseDown = (e, table) => {
    if (e.button !== 0) return; // Clic gauche uniquement
    setDraggingTable(table);
    
    // Calculer l'écart entre le clic et le coin supérieur gauche de la table
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.preventDefault();
  };

  const handleMouseMove = async (e) => {
    if (!draggingTable || !gridRef.current) return;

    const gridRect = gridRef.current.getBoundingClientRect();
    
    // Position brute par rapport à la grille en pixel
    let newX = e.clientX - gridRect.left - dragOffset.x;
    let newY = e.clientY - gridRect.top - dragOffset.y;

    // Magnétisme / Alignement sur une grille virtuelle de 20px pour un rendu ultra propre
    newX = Math.round(newX / 20) * 20;
    newY = Math.round(newY / 20) * 20;

    // Limites de collision avec les bordures du plan
    const maxX = gridRect.width - 96; // 96px = largeur de la table
    const maxY = gridRect.height - 96;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    // Mise à jour visuelle instantanée (UI fluide)
    setTables((prev) =>
      prev.map((t) => (t.id === draggingTable.id ? { ...t, pos_x: newX, pos_y: newY } : t))
    );
  };

  const handleMouseUp = async () => {
    if (!draggingTable) return;

    // Sauvegarde de la position finale dans Supabase
    const finalTable = tables.find((t) => t.id === draggingTable.id);
    if (finalTable) {
      await supabase
        .from('tables')
        .update({ pos_x: finalTable.pos_x, pos_y: finalTable.pos_y })
        .eq('id', finalTable.id);
    }
    setDraggingTable(null);
  };

  return (
    <div className="space-y-10 pb-20 select-none">
      {/* EN-TÊTE */}
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-2xl font-serif tracking-widest text-white uppercase font-light">Gestion du Plan des Tables</h2>
        <p className="text-xs text-stone-400 font-mono mt-1">Dessinez votre salle, attribuez le nombre de couverts et déplacez vos tables en temps réel.</p>
      </div>

      {/* SÉLECTEUR DE SPACE & CONFIGURATION */}
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-between">
        <div className="flex gap-2">
          {['salle', 'terrasse'].map((zone) => (
            <button
              key={zone}
              onClick={() => setActiveZone(zone)}
              className={`px-6 py-3 text-xs uppercase font-mono tracking-widest border transition-all ${
                activeZone === zone
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold'
                  : 'bg-stone-950 border-white/5 text-stone-500 hover:text-stone-300'
              }`}
            >
              Plan : {zone === 'salle' ? 'Salle Intérieure 🎧' : 'Terrasse Extérieure ☀️'}
            </button>
          ))}
        </div>
        
        <p className="text-[11px] font-mono text-stone-500 max-w-sm lg:text-right leading-relaxed">
          💡 <span className="text-amber-400">Drag & Drop actif :</span> Cliquez longuement sur une table pour la déplacer sur le quadrillage. Les positions se sauvegardent toutes seules !
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-10 items-start">
        
        {/* CRÉATEUR DE TABLE (1 Colonne) */}
        <div className="bg-stone-900/40 border border-white/10 p-6 shadow-xl space-y-6">
          <h3 className="text-xs font-mono tracking-widest uppercase text-amber-400 font-bold">// Ajouter une table</h3>
          
          <form onSubmit={handleAddTable} className="space-y-4 text-sm">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-stone-400 uppercase">Numéro ou Nom</label>
              <input type="text" required placeholder="Ex: T1, Loge, Comptoir..." value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full bg-stone-950 border border-white/10 p-3 text-stone-200 focus:outline-none focus:border-amber-500/50 text-center font-mono font-bold" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-stone-400 uppercase">Capacité max (Couverts)</label>
              <select value={capacite} onChange={(e) => setCapacite(parseInt(e.target.value))} className="w-full bg-stone-950 border border-white/10 p-3 text-stone-200 focus:outline-none focus:border-amber-500/50 rounded-none font-mono">
                {[2, 3, 4, 5, 6, 8, 10].map(n => (
                  <option key={n} value={n}>{n} Personnes</option>
                ))}
              </select>
            </div>

            {msg && <p className={`text-[10px] font-mono p-2 text-center ${msg.includes('❌') ? 'text-rose-400 bg-rose-500/5' : 'text-emerald-400 bg-emerald-500/5'}`}>{msg}</p>}

            <button type="submit" className="w-full py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono uppercase tracking-widest font-bold hover:bg-amber-500 hover:text-black transition-all">
              Injecter sur le plan
            </button>
          </form>
        </div>

        {/* 🎬 CANVAS INTERACTIF / CADRAGE PLAN DE SALLE (3 Colonnes) */}
        <div className="xl:col-span-3 space-y-4">
          <div 
            ref={gridRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-[600px] bg-stone-950 border border-white/10 relative overflow-hidden shadow-inner cursor-crosshair"
            style={{
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          >
            {loading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-xs font-mono text-stone-400 tracking-widest uppercase">
                Analyse architecturale du plan...
              </div>
            )}

            {!loading && tables.filter(t => t.zone === activeZone).length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono text-stone-600 uppercase text-center p-6">
                Le plan de la {activeZone} est vide.<br/>Utilisez le formulaire de gauche pour poser vos premières tables.
              </div>
            )}

            {/* RENDU DES TABLES DÉPLAÇABLES */}
            {tables.filter(t => t.zone === activeZone).map((table) => {
              const isSelectedForDrag = draggingTable?.id === table.id;

              return (
                <div
                  key={table.id}
                  onMouseDown={(e) => handleMouseDown(e, table)}
                  className={`absolute w-24 h-24 flex flex-col items-center justify-between p-3 border cursor-grab transition-shadow select-none ${
                    isSelectedForDrag 
                      ? 'border-amber-400 bg-amber-500/10 z-40 shadow-[0_0_25px_rgba(245,158,11,0.2)] cursor-grabbing scale-95' 
                      : 'border-white/10 bg-stone-900/80 hover:border-white/30 z-20'
                  }`}
                  style={{
                    left: `${table.pos_x}px`,
                    top: `${table.pos_y}px`,
                    transition: isSelectedForDrag ? 'none' : 'top 0.1s ease, left 0.1s ease'
                  }}
                >
                  {/* Bouton supprimer rapide */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }} 
                    className="self-end text-[9px] text-stone-600 hover:text-rose-400 transition-colors"
                  >
                    ✕
                  </button>

                  {/* Infos Table */}
                  <div className="text-center">
                    <p className="font-serif text-lg text-white font-bold tracking-tight">{table.numero}</p>
                    <p className="text-[9px] font-mono text-stone-400 uppercase tracking-widest mt-0.5">{table.capacite} Pers</p>
                  </div>

                  {/* Décoration style plan de masse */}
                  <div className="w-full h-1 bg-white/5 border-t border-b border-white/10 rounded-full"></div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}