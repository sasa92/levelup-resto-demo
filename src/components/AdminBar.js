'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminBar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  // On vérifie en tâche de fond si une session admin existe
  useEffect(() => {
    async function checkAdminSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    }
    checkAdminSession();

    // Optionnel : On écoute les changements d'état (connexion/déconnexion) en direct
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    router.push('/');
    router.refresh();
  };

  // Si c'est un client normal (pas connecté), on n'affiche absolument rien
  if (!isAdmin) return null;

  // Si c'est l'admin, on affiche le bandeau noir et or ultra-classe tout en haut
  return (
    <div className="w-full bg-stone-950 border-b border-amber-500/20 text-white py-2 px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-2 z-50 relative">
      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
        <p className="text-[11px] font-mono tracking-wider text-stone-300 uppercase">
          Mode Admin Actif — <span className="text-amber-400 font-medium">Session Connectée</span>
        </p>
      </div>
      
      <div className="flex space-x-3">
        <button 
          onClick={() => router.push('/admin/dashboard')}
          className="text-[10px] font-mono tracking-widest bg-stone-900 border border-white/10 px-3 py-1 hover:bg-white hover:text-black transition-all duration-300 uppercase"
        >
          Console Dashboard →
        </button>
        <button 
          onClick={handleLogout}
          className="text-[10px] font-mono tracking-widest text-rose-400 border border-rose-500/20 px-3 py-1 bg-rose-500/5 hover:bg-rose-500/20 transition-all duration-300 uppercase"
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}