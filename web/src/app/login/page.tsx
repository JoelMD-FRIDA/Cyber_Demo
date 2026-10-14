"use client";
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AuthCardBrand } from '@/components/layout/auth-card-brand';
import { buttonVariants } from '@/components/ui/button';
export default function LoginPage() {
  const params = useSearchParams();const { locale,t } = useI18n();
  const redirect = params.get('redirect') ?? '/';
  return <div className="frida-auth-shell"><Card className="frida-auth-card"><AuthCardBrand title={t('auth.login')} /><CardHeader><CardTitle>{t('auth.signIn')}</CardTitle></CardHeader><CardContent><a className={buttonVariants()} href={'/api/auth/login?redirect='+encodeURIComponent(redirect)}>{locale==='de'?'Mit FRIDA anmelden':'Sign in with FRIDA'}</a></CardContent></Card></div>;
}
