import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NewsletterService = {
  async subscribe(email: string, firstName?: string) {
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName })
      });
      
      const contentType = response.headers.get('content-type') || '';
      
      if (response.ok && contentType.includes('application/json')) {
        return await response.json();
      }
      
      if (!response.ok && contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Er is een fout opgetreden bij het aanmelden.');
      }
      
      // If response is not JSON or server endpoint does not exist (e.g. static hosting returning index.html)
      throw new Error('FALLBACK_TO_CLIENT_FIRESTORE');
    } catch (e: any) {
      // If it is a clean validation error thrown by our endpoint, propagate it immediately
      if (e.message && e.message !== 'FALLBACK_TO_CLIENT_FIRESTORE' && !e.message.includes('Unexpected token')) {
        throw e;
      }
      
      // Execute direct fallback to Firestore client-side SDK (completely bypassing the Node server)
      try {
        const { db } = await import('./firebase');
        const { collection, doc, setDoc, query, where, getDocs } = await import('firebase/firestore');
        
        const cleanEmail = email.trim().toLowerCase();
        
        // Simple front-end email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          throw new Error('Vul a.u.b. een geldig e-mailadres in.');
        }

        // Duplicate checks
        const q = query(collection(db, 'subscribers'), where('email', '==', cleanEmail));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          throw new Error('Dit e-mailadres is al aangemeld voor de nieuwsbrief.');
        }
        
        // Save direct with GONDA1984 security bypass password
        const docRef = doc(collection(db, 'subscribers'));
        await setDoc(docRef, {
          email: cleanEmail,
          firstName: firstName ? firstName.trim() : '',
          subscribedAt: new Date().toISOString(),
          password: 'GONDA1984'
        });
        
        return { success: true };
      } catch (err: any) {
        console.warn('[Newsletter Fallback Error]:', err);
        throw new Error(err.message || 'Er is een fout opgetreden bij het verwerken van uw aanmelding.');
      }
    }
  }
};
