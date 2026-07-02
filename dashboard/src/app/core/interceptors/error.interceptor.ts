import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import Swal from 'sweetalert2';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMsg = 'حدث خطأ غير متوقع يرجى المحاولة لاحقاً';
      let title = 'خطأ';
      let htmlContent = '';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMsg = error.error.message;
        title = 'خطأ في المتصفح';
      } else {
        // Server-side error
        
        // Handle specific server-side errors
        if (error.error?.message) {
          errorMsg = error.error.message;
        }
        
        // Handle array of validation errors if present
        if (error.error?.errors && Array.isArray(error.error.errors) && error.error.errors.length > 0) {
          if (error.error.errors.length > 1) {
            htmlContent = `<ul class="text-right mt-3 text-red-600 font-bold space-y-1 bg-red-50 p-4 rounded-xl">
              ${error.error.errors.map((e: string) => `<li class="flex items-start gap-2"><span class="text-red-400 font-bold">✕</span> <span>${e}</span></li>`).join('')}
            </ul>`;
          } else {
            errorMsg = error.error.errors[0];
          }
        }

        switch (error.status) {
          case 400:
            title = 'طلب غير صالح';
            break;
          case 401:
            title = 'غير مصرح';
            if (!error.error?.message) errorMsg = 'يرجى تسجيل الدخول مجدداً.';
            break;
          case 403:
            title = 'مرفوض';
            if (!error.error?.message) errorMsg = 'لا تملك الصلاحيات الكافية للقيام بهذا الإجراء.';
            break;
          case 404:
            title = 'غير موجود';
            if (!error.error?.message) errorMsg = 'المورد المطلوب غير موجود.';
            break;
          case 422:
            title = 'بيانات غير صالحة';
            break;
          case 500:
            title = 'عذراً، حدث خطأ';
            if (!error.error?.message) errorMsg = 'يبدو أن هناك مشكلة فنية. فريقنا يعمل على حلها، يرجى المحاولة لاحقاً.';
            break;
          case 0:
            title = 'انقطاع الاتصال';
            errorMsg = 'لم نتمكن من الوصول للشبكة. يرجى التأكد من اتصالك بالإنترنت والمحاولة مجدداً.';
            break;
        }
      }

      // عرض الرسالة في بوب اب باستخدام SweetAlert2 ليكون واضحاً وجميلاً
      Swal.fire({
        icon: 'error',
        title: title,
        html: htmlContent ? `<div class="text-slate-600">${errorMsg}</div>${htmlContent}` : `<div class="text-slate-600 font-medium">${errorMsg}</div>`,
        confirmButtonText: 'حسناً فهمت',
        confirmButtonColor: '#f59e0b',
        customClass: {
          popup: 'rounded-3xl',
          confirmButton: 'rounded-xl font-bold px-8 py-3'
        }
      });
      
      return throwError(() => error);
    })
  );
};
