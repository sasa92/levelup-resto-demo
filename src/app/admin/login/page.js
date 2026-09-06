'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [etape, setEtape] = useState(1); // 1 = Email/MDP, 2 = Code à 8 chiffres
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // ÉTAPE 1 : On vérifie le MDP, si c'est bon Supabase envoie le code
  const verifierMdpEtEnvoyerCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErreur('');

    try {
      // On teste d'abord le mot de passe
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (passwordError) throw passwordError;

      // Si le MDP est bon, on déclenche l'envoi du code à 8 chiffres
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });

      if (otpError) throw otpError;

      // On passe à l'étape du code
      setEtape(2);
    } catch (err) {
      setErreur("Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  // ÉTAPE 2 : On prend le code tapé et on valide
  const verifierCodeOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErreur('');

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email', // Force Supabase à chercher le code à 8
        // chiffres
      });

      if (error) throw error;

      // Direction le tableau de bord !
      router.push('/admin/dashboard');
    } catch (err) {
      setErreur("Code incorrect ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-stone-900/20 border border-white/5 p-10 backdrop-blur-md">
        
        <div className="text-center mb-10">
          <h1 className="text-xl font-mono tracking-widest text-stone-200">CONNEXION ADMIN</h1>
        </div>

        {etape === 1 ? (
          <form onSubmit={verifierMdpEtEnvoyerCode} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-stone-400 uppercase">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-stone-950 border border-white/10 p-4 text-sm" placeholder="sami.ouail92@gmail.com" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-stone-400 uppercase">Mot de passe</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-stone-950 border border-white/10 p-4 text-sm" placeholder="••••••••" />
            </div>
            {erreur && <p className="text-xs text-rose-500 font-mono text-center">{erreur}</p>}
            <button disabled={loading} className="w-full py-4 bg-stone-100 text-black text-xs font-mono uppercase font-bold">
              {loading ? 'VÉRIFICATION...' : 'RECEVOIR LE CODE'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifierCodeOtp} className="space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-xs text-stone-400 mb-4">Code envoyé à : {email}</p>
              <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Entrez le code (8 chiffres)</label>
              <input type="text" required maxLength={8} value={token} onChange={(e) => setToken(e.target.value)} className="w-full bg-stone-950 border border-white/10 p-4 text-center text-xl font-mono tracking-widest" placeholder="12345678" />
            </div>
            {erreur && <p className="text-xs text-rose-500 font-mono text-center">{erreur}</p>}
            <button disabled={loading} className="w-full py-4 bg-emerald-500 text-black text-xs font-mono uppercase font-bold">
              {loading ? 'VÉRIFICATION...' : 'ENTRER DANS LE TABLEAU DE BORD'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}