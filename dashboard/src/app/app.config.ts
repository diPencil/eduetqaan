import { ApplicationConfig, provideBrowserGlobalErrorListeners, LOCALE_ID } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { routes } from './app.routes';
import { TabRouteReuseStrategy } from './core/strategies/tab-route-reuse.strategy';

registerLocaleData(localeAr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: TabRouteReuseStrategy },
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, loadingInterceptor])),
    provideCharts(withDefaultRegisterables()),
    { provide: LOCALE_ID, useValue: 'ar-EG' }
  ]
};
