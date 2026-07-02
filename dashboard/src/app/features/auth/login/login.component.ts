import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);
  error = signal<string | null>(null);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.error.set(null);

    const { email, password } = this.loginForm.value;
    
    this.authService.login({ email: email!, password: password! }).subscribe({
      next: (res) => {
        if (res.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.error.set(res.message || 'فشل تسجيل الدخول، تأكد من البيانات');
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        const backendMessage = err.error?.message || err.error?.errors?.[0];
        this.error.set(backendMessage || 'تأكد من صحة البريد الإلكتروني وكلمة المرور');
        this.isLoading.set(false);
      }
    });
  }
}
