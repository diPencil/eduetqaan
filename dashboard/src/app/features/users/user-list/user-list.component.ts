import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService, AdminUser } from '../../../core/services/user.service';
import { CenterService, Center } from '../../../core/services/center.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IconComponent],
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);
  private centerService = inject(CenterService);
  private fb = inject(FormBuilder);

  users = signal<AdminUser[]>([]);
  centers = signal<Center[]>([]);
  isLoading = signal(true);
  isModalOpen = signal(false);
  isEditing = signal(false);
  isSaving = signal(false);
  selectedId = signal<number | null>(null);

  userForm: FormGroup;

  constructor() {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', []],
      role: ['user', Validators.required],
      centerId: [null],
      isActive: [true]
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    // Load centers first to show names
    this.centerService.getCenters().subscribe(res => this.centers.set(res.data));
    
    this.userService.getUsers()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe(res => {
        if (res.success) this.users.set(res.data);
      });
  }

  getCenterName(id?: number | null) {
    if (!id) return null;
    return this.centers().find(c => c.id === Number(id))?.name;
  }

  openModal(user?: AdminUser) {
    this.isEditing.set(!!user);
    this.selectedId.set(user?.id || null);
    
    if (user) {
      this.userForm.patchValue({
        email: user.email,
        role: user.role,
        centerId: user.centerId,
        password: '',
        isActive: user.isActive
      });
      this.userForm.get('password')?.clearValidators();
    } else {
      this.userForm.reset({ role: 'user', isActive: true, centerId: null });
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    }
    this.userForm.get('password')?.updateValueAndValidity();
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  saveUser() {
    if (this.userForm.invalid) return;
    this.isSaving.set(true);
    const data = { ...this.userForm.value };
    if (!data.password) delete data.password;

    const request = this.isEditing() 
      ? this.userService.updateUser(this.selectedId()!, data)
      : this.userService.createUser(data);

    request.pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.loadData();
          this.closeModal();
        },
        error: (err) => alert(err.error?.message || 'حدث خطأ ما')
      });
  }

  toggleUserStatus(user: AdminUser) {
    const newStatus = !user.isActive;
    this.userService.updateUser(user.id, { isActive: newStatus }).subscribe(() => {
      this.loadData();
    });
  }

  deleteUser(user: AdminUser) {
    if (confirm(`هل أنت متأكد من حذف الحساب "${user.email}"؟`)) {
      this.userService.deleteUser(user.id).subscribe(() => this.loadData());
    }
  }

  getRoleName(role: string) {
    switch (role) {
      case 'admin': return 'مدير نظام';
      case 'supervisor': return 'مشرف عام';
      case 'center_manager': return 'مشرف سنتر';
      case 'support': return 'دعم فني';
      default: return role;
    }
  }
}
