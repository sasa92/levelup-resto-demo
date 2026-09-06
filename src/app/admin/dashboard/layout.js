'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function DashboardLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/admin/login');
      } else {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] text-stone-400 flex items-center justify-center font-mono text-xs tracking-widest">
        VÉRIFICATION DE LA SESSION SÉCURISÉE...
      </div>
    );
  }

  const menuItems = [
    { name: '📈 Vue Globale', path: '/admin/dashboard' },
    { name: '📥 Réservations', path: '/admin/dashboard/reservations' },
    { name: '🍽️ Gestion des Tables', path: '/admin/dashboard/tables' },
    { name: '⏰ Pôle Horaires', path: '/admin/dashboard/horaires' },
    { name: '📜 Carte & Plats', path: '/admin/dashboard/carte' },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-white flex">
      
      {/* SIDEBAR FIXE À GAUCHE */}
      <aside className="w-64 bg-stone-950 border-r border-white/5 flex flex-col justify-between p-6 h-screen sticky top-0">
        <div className="space-y-8">
          {/* LOGO */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-amber-500/60 tracking-[0.3em] uppercase">LEVELUP CONSOLE</span>
            <h1 className="text-lg font-serif tracking-widest text-stone-200">BRAMBINO</h1>
          </div>

          {/* NAVIGATION */}
          <nav className="flex flex-col space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`w-full text-left px-4 py-3 text-xs font-mono tracking-wider uppercase transition-all ${
                    isActive 
                      ? 'bg-stone-900 border-l-2 border-amber-500 text-amber-400 font-bold' 
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/50'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* PIED DE LA SIDEBAR : BOUTONS DE SORTIE */}
        <div className="space-y-2">
          {/* LE BOUTON VOIR LE SITE USER */}
          <a 
            href="/" 
            target="_blank"
            className="w-full block text-center py-2.5 bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono tracking-widest text-amber-400 hover:bg-amber-500 hover:text-black transition-all uppercase font-medium"
          >
            👁️ Voir le site public
          </a>

          <button 
            onClick={handleLogout}
            className="w-full py-2.5 bg-stone-900 border border-white/5 text-[10px] font-mono tracking-widest text-stone-500 hover:text-rose-400 hover:border-rose-500/20 transition-all uppercase"
          >
            Déconnexion ✕
          </button>
        </div>
      </aside>

      {/* ZONE CENTRALE */}
      <main className="flex-1 p-10 overflow-y-auto h-screen">
        {children}
      </main>

    </div>
  );
}