import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoadingService } from '../services/loading.service';
import { finalize } from 'rxjs/operators';

// Bypass URLs that shouldn't trigger the global loader (e.g., background polling)
const SILENT_URLS: string[] = [
  // '/api/notifications/poll'
];

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  const isSilent = SILENT_URLS.some(url => req.url.includes(url));
  
  if (!isSilent) {
    loadingService.show();
  }

  return next(req).pipe(
    finalize(() => {
      if (!isSilent) {
        loadingService.hide();
      }
    })
  );
};
