'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function GestionCarte() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // États pour le formulaire (Ajout & Modification)
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [nom, setNom] = useState('');
  const [base, setBase] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [prix, setPrix] = useState('');
  const [categorie, setCategorie] = useState('plats');
  const [image, setImage] = useState('');
  const [phare, setPhare] = useState(false);
  
  const [msg, setMsg] = useState({ text: '', type: '' });

  // 🖼️ ÉTATS POUR LE SYSTÈME D'IMAGES AVANCÉ
  const [imageMode, setImageMode] = useState('url'); // 'url', 'upload', 'galerie'
  const [uploading, setUploading] = useState(false);
  const [galerie, setGalerie] = useState([]);

  // 🔍 ÉTATS POUR LA RECHERCHE ET LES FILTRES
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('tous');

  // 📥 1. CHARGEMENT DE LA CARTE
  async function fetchMenu() {
    setLoading(true);
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .order('categorie', { ascending: true })
      .order('nom', { ascending: true });

    if (!error && data) {
      setMenu(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchMenu();
  }, []);

  // 🧹 RÉINITIALISER LE FORMULAIRE
  const resetForm = () => {
    setIsEditing(false);
    setEditId(null);
    setNom('');
    setBase('');
    setIngredients('');
    setPrix('');
    setCategorie('plats');
    setImage('');
    setPhare(false);
    setMsg({ text: '', type: '' });
    setImageMode('url');
  };

  // 💾 2. SAUVEGARDER (AJOUTER OU MODIFIER)
  const handleSavePlat = async (e) => {
    e.preventDefault();
    setMsg({ text: 'Sauvegarde en cours...', type: 'loading' });

    const platData = { nom, base, ingredients, prix: parseFloat(prix), categorie, image, phare };

    if (isEditing) {
      const { error } = await supabase.from('menu').update(platData).eq('id', editId);
      if (error) {
        setMsg({ text: '❌ Erreur modification : ' + error.message, type: 'error' });
      } else {
        setMsg({ text: '✅ Plat mis à jour !', type: 'success' });
        resetForm();
        fetchMenu();
      }
    } else {
      const { error } = await supabase.from('menu').insert([platData]);
      if (error) {
        setMsg({ text: '❌ Erreur ajout : ' + error.message, type: 'error' });
      } else {
        setMsg({ text: '✅ Plat ajouté à la carte !', type: 'success' });
        resetForm();
        fetchMenu();
      }
    }
  };

  // ✏️ 3. PRÉPARER LA MODIFICATION (Remplir le formulaire)
  const handleEditClick = (plat) => {
    setIsEditing(true);
    setEditId(plat.id);
    setNom(plat.nom || '');
    setBase(plat.base || '');
    setIngredients(plat.ingredients || '');
    setPrix(plat.prix || '');
    setCategorie(plat.categorie || 'plats');
    setImage(plat.image || '');
    setPhare(plat.phare || false);
    setMsg({ text: 'Mode édition activé. Modifiez les champs ci-dessus.', type: 'info' });
    setImageMode('url');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ⭐ 4. BASCULER LE STATUT PHARE EN UN CLIC
  const togglePhare = async (id, currentStatus) => {
    const { error } = await supabase.from('menu').update({ phare: !currentStatus }).eq('id', id);
    if (!error) fetchMenu();
  };

  // ❌ 5. SUPPRIMER UN PLAT
  const deletePlat = async (id) => {
    if (confirm('Voulez-vous vraiment supprimer ce plat de la carte ?')) {
      const { error } = await supabase.from('menu').delete().eq('id', id);
      if (!error) fetchMenu();
    }
  };

  // 📤 6. UPLOAD D'IMAGE VERS SUPABASE
  const uploadImage = async (event) => {
    try {
      setUploading(true);
      setMsg({ text: 'Upload en cours...', type: 'info' });
      
      const file = event.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      let { error: uploadError } = await supabase.storage.from('menu_images').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('menu_images').getPublicUrl(filePath);
      setImage(data.publicUrl);
      setMsg({ text: '✅ Image uploadée avec succès !', type: 'success' });
    } catch (error) {
      setMsg({ text: '❌ Erreur d\'upload : ' + error.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  // 🖼️ 7. CHARGER LA GALERIE EXISTANTE
  const loadGalerie = async () => {
    setImageMode('galerie');
    const { data, error } = await supabase.storage.from('menu_images').list();
    if (data) {
      const urls = data
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => supabase.storage.from('menu_images').getPublicUrl(file.name).data.publicUrl);
      setGalerie(urls);
    }
  };

  // ⚙️ LOGIQUE DE FILTRAGE
  const filteredMenu = menu.filter((plat) => {
    const matchSearch = plat.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (plat.ingredients && plat.ingredients.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCategory = activeFilter === 'tous' || plat.categorie === activeFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-10 pb-20">
      {/* EN-TÊTE */}
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-2xl font-serif tracking-widest text-white uppercase font-light">Gestion du Menu</h2>
        <p className="text-xs text-stone-400 font-mono mt-1">Gérez vos plats, vos images et utilisez les filtres pour modifier votre carte rapidement.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
        
        {/* COLONNE GAUCHE : FORMULAIRE */}
        <div className="bg-stone-900/40 border border-white/10 p-6 shadow-xl space-y-6 sticky top-6">
          <div className="flex justify-between items-center">
            <h3 className={`text-xs font-mono tracking-widest uppercase font-bold ${isEditing ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isEditing ? '// Modifier le plat' : '// Ajouter un plat'}
            </h3>
            {isEditing && (
              <button onClick={resetForm} className="text-[10px] text-stone-400 hover:text-white uppercase font-mono tracking-widest">
                Annuler ✕
              </button>
            )}
          </div>
          
          <form onSubmit={handleSavePlat} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-mono text-stone-400 uppercase">Nom du plat</label>
                <input type="text" required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Margherita" className="w-full bg-stone-950 border border-white/10 p-3 text-stone-200 focus:outline-none focus:border-amber-500/50" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-stone-400 uppercase">Prix (€)</label>
                <input type="number" step="0.01" required value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Ex: 14.50" className="w-full bg-stone-950 border border-white/10 p-3 text-stone-200 focus:outline-none focus:border-amber-500/50" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-stone-400 uppercase">Catégorie</label>
                <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full bg-stone-950 border border-white/10 p-3 text-stone-200 rounded-none focus:border-amber-500/50 outline-none">
                  <option value="entrees">Entrées</option>
                  <option value="plats">Plats</option>
                  <option value="desserts">Desserts</option>
                  <option value="boissons">Boissons</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-stone-400 uppercase">Base (Optionnel)</label>
              <input type="text" value={base} onChange={(e) => setBase(e.target.value)} placeholder="Ex: Sauce Tomate, Crème fraîche..." className="w-full bg-stone-950 border border-white/10 p-3 text-stone-200 focus:outline-none focus:border-amber-500/50" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-stone-400 uppercase">Ingrédients / Description</label>
              <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="Mozzarella fior di latte, basilic frais..." rows={2} className="w-full bg-stone-950 border border-white/10 p-3 text-stone-200 focus:outline-none focus:border-amber-500/50 resize-none" />
            </div>

            {/* SYSTÈME D'IMAGE AVANCÉ */}
            <div className="p-3 border border-white/10 bg-stone-950/50 space-y-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <label className="text-[10px] font-mono text-stone-400 uppercase">Image</label>
                <div className="flex space-x-2 text-[9px] font-mono uppercase tracking-widest">
                  <button type="button" onClick={() => setImageMode('url')} className={imageMode === 'url' ? 'text-amber-400 font-bold' : 'text-stone-500 hover:text-stone-300'}>Lien</button>
                  <button type="button" onClick={() => setImageMode('upload')} className={imageMode === 'upload' ? 'text-amber-400 font-bold' : 'text-stone-500 hover:text-stone-300'}>Upload</button>
                  <button type="button" onClick={loadGalerie} className={imageMode === 'galerie' ? 'text-amber-400 font-bold' : 'text-stone-500 hover:text-stone-300'}>Galerie</button>
                </div>
              </div>

              {/* MODE 1 : LIEN URL */}
              {imageMode === 'url' && (
                <input type="text" value={image} onChange={(e) => setImage(e.target.value)} placeholder="Coller l'URL d'une image" className="w-full bg-stone-950 border border-white/10 p-2 text-stone-200 text-xs" />
              )}

              {/* MODE 2 : UPLOAD */}
              {imageMode === 'upload' && (
                <div className="relative border border-dashed border-white/20 p-4 text-center hover:bg-white/5 transition-colors cursor-pointer">
                  <input type="file" accept="image/*" onChange={uploadImage} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <span className="text-[10px] font-mono text-stone-400 uppercase">
                    {uploading ? 'Upload en cours...' : 'Cliquez pour choisir un fichier'}
                  </span>
                </div>
              )}

              {/* MODE 3 : GALERIE */}
              {imageMode === 'galerie' && (
                <div className="max-h-40 overflow-y-auto grid grid-cols-3 gap-2 p-1">
                  {galerie.length === 0 ? (
                    <p className="col-span-3 text-[10px] text-stone-500 font-mono text-center py-4">Aucune image trouvée.</p>
                  ) : (
                    galerie.map((url, i) => (
                      <div key={i} onClick={() => {setImage(url); setMsg({text: 'Image sélectionnée !', type: 'success'})}} className={`aspect-square cursor-pointer border-2 transition-all ${image === url ? 'border-amber-500 opacity-100 scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                        <img src={url} alt={`galerie-${i}`} className="w-full h-full object-cover" />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* PREVIEW MINIATURE */}
              {image && (
                <div className="flex items-center space-x-3 pt-2">
                  <img src={image} alt="Preview" className="w-10 h-10 object-cover border border-white/20" />
                  <span className="text-[9px] font-mono text-stone-500 truncate">{image}</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3 pt-2 p-3 bg-stone-950 border border-white/5">
              <input type="checkbox" id="phare" checked={phare} onChange={(e) => setPhare(e.target.checked)} className="accent-amber-500 h-4 w-4" />
              <label htmlFor="phare" className="text-xs font-mono text-stone-300 uppercase tracking-wider cursor-pointer">Plat Phare (Coup de ❤️)</label>
            </div>

            {msg.text && (
              <p className={`text-[11px] font-mono p-3 border ${msg.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-stone-800 text-stone-300'}`}>
                {msg.text}
              </p>
            )}

            <button type="submit" disabled={uploading} className={`w-full py-3 text-xs font-mono uppercase tracking-widest font-bold transition-all ${isEditing ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-black' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black'}`}>
              {isEditing ? '✓ Mettre à jour' : '➕ Ajouter au menu'}
            </button>
          </form>
        </div>

        {/* COLONNE DROITE : BARRE DE RECHERCHE + LISTE DES PLATS */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* 🔍 OUTILS DE FILTRAGE */}
          <div className="bg-stone-900/40 border border-white/10 p-4 flex flex-col space-y-4">
            
            {/* Barre de recherche */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">🔍</span>
              <input 
                type="text" 
                placeholder="Rechercher un plat, un ingrédient..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-stone-950 border border-white/5 pl-10 p-3 text-sm text-stone-200 focus:outline-none focus:border-amber-500/30"
              />
            </div>

            {/* Boutons de catégories */}
            <div className="flex flex-wrap gap-2">
              {['tous', 'entrees', 'plats', 'desserts', 'boissons'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`px-4 py-2 text-[10px] uppercase font-mono tracking-widest border transition-all ${
                    activeFilter === cat 
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 font-bold' 
                      : 'bg-stone-950 border-white/5 text-stone-500 hover:text-stone-300 hover:border-white/20'
                  }`}
                >
                  {cat === 'tous' ? 'Tout voir' : cat}
                </button>
              ))}
            </div>

          </div>

          <h3 className="text-xs font-mono tracking-widest uppercase text-stone-500 font-bold pt-2">
            // Résultat(s) : {filteredMenu.length} plat(s)
          </h3>

          {loading ? (
            <p className="text-xs font-mono text-stone-600 animate-pulse">Chargement de la carte...</p>
          ) : filteredMenu.length === 0 ? (
            <p className="text-xs font-mono text-stone-600 border border-white/5 p-6 bg-stone-900/20">Aucun plat ne correspond à cette recherche.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMenu.map((plat) => (
                <div key={plat.id} className={`flex flex-col bg-stone-900/40 border transition-all ${plat.phare ? 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]' : 'border-white/5 hover:border-white/10'}`}>
                  
                  {/* HEADER CARD : Image + Titre */}
                  <div className="flex gap-4 p-4 border-b border-white/5">
                    {plat.image ? (
                      <div className="w-16 h-16 bg-stone-950 flex-shrink-0 border border-white/10 overflow-hidden">
                        <img src={plat.image} alt={plat.nom} className="w-full h-full object-cover opacity-80" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-stone-950 flex-shrink-0 border border-white/10 flex items-center justify-center text-stone-700 text-xs font-mono">
                        IMG
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-serif text-lg text-stone-100 truncate pr-2">{plat.nom}</h4>
                        <span className="font-mono text-amber-500 font-bold text-sm">{plat.prix}€</span>
                      </div>
                      <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">{plat.categorie} {plat.base && `| Base: ${plat.base}`}</p>
                    </div>
                  </div>

                  {/* BODY CARD : Ingrédients */}
                  <div className="p-4 flex-1 text-xs text-stone-400 line-clamp-2">
                    {plat.ingredients || <span className="italic opacity-50">Aucune description...</span>}
                  </div>

                  {/* FOOTER CARD : Boutons d'action */}
                  <div className="flex justify-between items-center p-3 bg-stone-950/50 border-t border-white/5">
                    <button onClick={() => togglePhare(plat.id, plat.phare)} className={`text-[10px] uppercase font-mono tracking-widest px-2 py-1 border transition-all ${plat.phare ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-stone-500 border-white/5 hover:text-white'}`}>
                      {plat.phare ? '★ STAR' : '☆ Mettre Star'}
                    </button>
                    
                    <div className="flex gap-2">
                      <button onClick={() => handleEditClick(plat)} className="text-[10px] uppercase font-mono tracking-widest px-3 py-1 bg-white/5 text-stone-300 hover:bg-white hover:text-black transition-all">
                        Modifier
                      </button>
                      <button onClick={() => deletePlat(plat.id)} className="text-[10px] uppercase font-mono tracking-widest px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-black transition-all">
                        Supprimer
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}