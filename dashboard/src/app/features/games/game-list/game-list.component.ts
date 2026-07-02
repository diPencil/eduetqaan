import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { GameService, TrueFalseQuestion, McqQuestion, FlipCardCountry, FlipCardQuestion } from '../../../core/services/game.service';
import { WORLD_COUNTRIES } from '../../../core/constants/countries';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-game-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './game-list.component.html',

  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  `]
})
export class GameListComponent implements OnInit {
  private gameService = inject(GameService);

  tabs = [
    { id: 'tf', label: 'صح / خطأ', icon: 'check-circle' },
    { id: 'mcq', label: 'MCQ Rush', icon: 'zap' },
    { id: 'fast', label: 'Fast Answer', icon: 'clock' },
    { id: 'flip', label: 'Flip Card', icon: 'globe' },
    { id: 'battle', label: 'Battle Friend', icon: 'swords' },
    { id: 'team', label: 'Team Battle', icon: 'users' }
  ];

  activeTab = signal<string>('tf');
  tfQuestions = signal<TrueFalseQuestion[]>([]);
  mcqQuestions = signal<McqQuestion[]>([]); // Used for all MCQ-style types except Flip
  flipQuestions = signal<FlipCardQuestion[]>([]);
  countries = signal<FlipCardCountry[]>([]);

  isLoading = signal(false);
  isModalOpen = signal(false);
  isCountryModalOpen = signal(false);
  isEditing = signal(false);
  isSaving = signal(false);
  selectedLevel = '';

  form: any = {
    text: '',
    level: 'اولى ثانوى',
    isTrue: true,
    options: ['', '', '', ''],
    correctIndex: 0,
    countryId: null
  };

  countryForm = { name: '', code: '', flagEmoji: '' };
  predefinedCountries = WORLD_COUNTRIES;

  searchCountryQuery = signal('');
  isCountryDropdownOpen = signal(false);

  filteredCountries() {
    const q = this.searchCountryQuery().trim().toLowerCase();
    if (!q) return this.predefinedCountries;
    return this.predefinedCountries.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }

  selectCountry(c: any) {
    this.countryForm = {
      name: c.name,
      code: c.code,
      flagEmoji: c.flag
    };
    this.searchCountryQuery.set('');
    this.isCountryDropdownOpen.set(false);
  }

  ngOnInit() {
    this.loadData();
    this.loadCountries();
  }

  loadData() {
    this.isLoading.set(true);
    const params: any = {};
    if (this.selectedLevel) params.level = this.selectedLevel;
    const currentTab = this.activeTab();

    if (currentTab === 'tf') {
      this.gameService.getTrueFalseQuestions(params).subscribe({
        next: res => { this.tfQuestions.set(res.data); this.isLoading.set(false); },
        error: () => this.isLoading.set(false)
      });
    } else if (currentTab === 'flip') {
      this.gameService.getFlipQuestions(params).subscribe({
        next: res => { this.flipQuestions.set(res.data); this.isLoading.set(false); },
        error: () => this.isLoading.set(false)
      });
    } else {
      let obs;
      if (currentTab === 'mcq') obs = this.gameService.getMcqQuestions(params);
      else if (currentTab === 'fast') obs = this.gameService.getFastAnswerQuestions(params);
      else if (currentTab === 'battle') obs = this.gameService.getBattleFriendQuestions(params);
      else if (currentTab === 'team') obs = this.gameService.getTeamBattleQuestions(params);

      obs?.subscribe({
        next: res => { this.mcqQuestions.set(res.data); this.isLoading.set(false); },
        error: () => this.isLoading.set(false)
      });
    }
  }

  loadCountries() {
    this.gameService.getFlipCountries().subscribe(res => this.countries.set(res.data));
  }

  currentMcqList() {
    if (this.activeTab() === 'flip') return this.flipQuestions();
    return this.mcqQuestions();
  }

  isCurrentListEmpty() {
    if (this.activeTab() === 'tf') return this.tfQuestions().length === 0;
    if (this.activeTab() === 'flip') return this.flipQuestions().length === 0;
    return this.mcqQuestions().length === 0;
  }

  totalQuestions() {
    if (this.activeTab() === 'tf') return this.tfQuestions().length;
    if (this.activeTab() === 'flip') return this.flipQuestions().length;
    return this.mcqQuestions().length;
  }

  getCountryName(id: number) {
    const c = this.countries().find(x => x.id === id);
    return c ? `${c.flagEmoji} ${c.name}` : 'غير محدد';
  }

  openAddModal() {
    this.isEditing.set(false);
    this.form = {
      text: '',
      level: 'اولى ثانوى',
      isTrue: true,
      options: ['', '', '', ''],
      correctIndex: 0,
      countryId: null
    };
    this.isModalOpen.set(true);
  }

  openEditModal(q: any) {
    this.isEditing.set(true);
    this.form = { ...q };
    if (this.activeTab() !== 'tf' && !this.form.options) {
      this.form.options = ['', '', '', ''];
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  openCountryModal() {
    this.loadCountries();
    this.isCountryModalOpen.set(true);
  }

  closeCountryModal() {
    this.isCountryModalOpen.set(false);
  }

  onSave() {
    this.isSaving.set(true);
    const type = this.activeTab();
    const id = this.form.id;
    const editing = this.isEditing();
    let obs;

    if (type === 'tf') {
      obs = editing ? this.gameService.updateTrueFalseQuestion(id, this.form) : this.gameService.createTrueFalseQuestion(this.form);
    } else if (type === 'mcq') {
      obs = editing ? this.gameService.updateMcqQuestion(id, this.form) : this.gameService.createMcqQuestion(this.form);
    } else if (type === 'fast') {
      obs = editing ? this.gameService.updateFastAnswerQuestion(id, this.form) : this.gameService.createFastAnswerQuestion(this.form);
    } else if (type === 'flip') {
      obs = editing ? this.gameService.updateFlipQuestion(id, this.form) : this.gameService.createFlipQuestion(this.form);
    } else if (type === 'battle') {
      obs = editing ? this.gameService.updateBattleFriendQuestion(id, this.form) : this.gameService.createBattleFriendQuestion(this.form);
    } else if (type === 'team') {
      obs = editing ? this.gameService.updateTeamBattleQuestion(id, this.form) : this.gameService.createTeamBattleQuestion(this.form);
    }

    obs?.subscribe({
      next: () => {
        this.loadData();
        this.closeModal();
        this.isSaving.set(false);
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'خطأ!',
          text: err.error?.message || 'حدث خطأ في الحفظ',
          confirmButtonText: 'حسناً',
          confirmButtonColor: '#3b82f6'
        });
        this.isSaving.set(false);
      }
    });
  }

  onDelete(id: number) {
    Swal.fire({
      title: 'تأكيد الحذف',
      text: 'هل أنت متأكد من حذف هذا السؤال؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'نعم، احذف!',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        const type = this.activeTab();
        let obs;

        if (type === 'tf') obs = this.gameService.deleteTrueFalseQuestion(id);
        else if (type === 'mcq') obs = this.gameService.deleteMcqQuestion(id);
        else if (type === 'fast') obs = this.gameService.deleteFastAnswerQuestion(id);
        else if (type === 'flip') obs = this.gameService.deleteFlipQuestion(id);
        else if (type === 'battle') obs = this.gameService.deleteBattleFriendQuestion(id);
        else if (type === 'team') obs = this.gameService.deleteTeamBattleQuestion(id);

        obs?.subscribe({
          next: () => {
            this.loadData();
            Swal.fire({ icon: 'success', title: 'تم الحذف بنجاح', showConfirmButton: false, timer: 1500 });
          },
          error: (err) => Swal.fire('خطأ!', 'لم يتم الحذف', 'error')
        });
      }
    });
  }

  onSaveCountry() {
    this.gameService.createFlipCountry(this.countryForm).subscribe({
      next: () => {
        this.loadCountries();
        this.countryForm = { name: '', code: '', flagEmoji: '' };
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'خطأ!',
          text: err.error?.message || 'خطأ في إضافة الدولة',
          confirmButtonText: 'حسناً',
          confirmButtonColor: '#3b82f6'
        });
      }
    });
  }

  onDeleteCountry(id: number) {
    Swal.fire({
      title: 'حذف الدولة؟',
      text: 'قد يؤثر ذلك على الأسئلة المرتبطة بها.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'نعم، احذف!',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        this.gameService.deleteFlipCountry(id).subscribe({
          next: () => {
            this.loadCountries();
            Swal.fire({ icon: 'success', title: 'تم الحذف', showConfirmButton: false, timer: 1500 });
          },
          error: () => Swal.fire('خطأ!', 'حدثت مشكلة أثناء الحذف', 'error')
        });
      }
    });
  }
}
