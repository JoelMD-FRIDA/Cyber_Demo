import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../../src/lib/i18n';
import DomainCheckPage from '../../src/app/dashboard/domain-check/page';
import {SessionContinuity} from '../../src/components/session-continuity';
import RenewalComplete from '../../src/app/auth/renew/complete/page';
import {apiFetch} from '../../src/lib/api-client';
(window as Window&{fixtureFetch?:typeof apiFetch}).fixtureFetch=apiFetch;
createRoot(document.getElementById('root')!).render(window.location.pathname==='/auth/renew/complete'
  ? <RenewalComplete/> : <I18nProvider initialLocale="en"><SessionContinuity/><DomainCheckPage/></I18nProvider>);
