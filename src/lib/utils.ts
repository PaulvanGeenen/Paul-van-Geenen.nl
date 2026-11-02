import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { transipPost } from './transip';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NewsletterService = {
  async subscribe(email: string, firstName?: string) {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Vul a.u.b. een geldig e-mailadres in.');
    }

    // 1. Probeer de lokale Express backend als die draait
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, firstName })
      });
      
      const contentType = response.headers.get('content-type') || '';
      
      if (response.ok && contentType.includes('application/json')) {
        return await response.json();
      }
      
      if (!response.ok && contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Er is een fout opgetreden bij het aanmelden.');
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('Unexpected token') && !e.message.includes('Failed to fetch')) {
        throw e;
      }
    }

    // 2. Directe opslag in de TransIP MySQL Database
    try {
      const transipRes = await transipPost<{ success: boolean; error?: string }>('subscribe', {
        email: cleanEmail,
        name: firstName ? firstName.trim() : '',
        source: 'website'
      });

      if (transipRes && transipRes.success) {
        return { success: true };
      }
      if (transipRes && transipRes.error) {
        throw new Error(transipRes.error);
      }
      return { success: true };
    } catch (err: any) {
      console.warn('[Newsletter TransIP Save Error]:', err);
      throw new Error(err.message || 'Er is een fout opgetreden bij het verwerken van uw aanmelding.');
    }
  }
};
