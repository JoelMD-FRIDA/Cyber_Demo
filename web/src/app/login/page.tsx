"use client";
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AuthCardBrand } from '@/components/layout/auth-card-brand';
import { buttonVariants } from '@/components/ui/button';
export default function LoginPage() {
  const params = useSearchParams();const { locale,t } = useI18n();
  const redirect = params.get('redirect') ?? '/dashboard/domain-check';
  return <div className="frida-auth-shell"><Card className="frida-auth-card"><AuthCardBrand title={t('auth.login')} /><CardHeader><CardTitle>{t('auth.signIn')}</CardTitle></CardHeader><CardContent>{params.get('error')==='signin_failed'&&<p role="alert" className="mb-4 text-sm">{locale==='de'?'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.':'Sign-in could not be completed. Please try again.'}</p>}<a className={buttonVariants()} href={'/api/auth/login?redirect='+encodeURIComponent(redirect)}>{locale==='de'?'Mit FRIDA anmelden':'Sign in with FRIDA'}</a></CardContent></Card></div>;
}
