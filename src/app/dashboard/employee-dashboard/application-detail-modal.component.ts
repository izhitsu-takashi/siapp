import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';

@Component({
  selector: 'app-application-detail-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './application-detail-modal.component.html',
  styleUrl: './application-detail-modal.component.css'
})
export class ApplicationDetailModalComponent implements OnInit {
  @Input() application: any = null;
  @Input() isVisible: boolean = false;
  @Input() dependentsData: any[] = [];
  @Input() employeeNumber: string = '';
  @Output() close = new EventEmitter<void>();
  @Output() reapplicationSubmitted = new EventEmitter<void>();

  isEditModeForReapplication = false;
  isSubmittingReapplication = false;

  // フォーム
  dependentApplicationForm!: FormGroup;
  dependentRemovalForm!: FormGroup;
  addressChangeForm!: FormGroup;
  nameChangeForm!: FormGroup;
  myNumberChangeForm!: FormGroup;
  maternityLeaveForm!: FormGroup;
  resignationForm!: FormGroup;
  onboardingApplicationForm!: FormGroup;

  // ファイル
  dependentBasicPensionNumberDocFile: File | null = null;
  dependentMyNumberDocFile: File | null = null;
  dependentIdentityDocFile: File | null = null;
  dependentDisabilityCardFile: File | null = null;
  resumeFile: File | null = null;
  careerHistoryFile: File | null = null;
  basicPensionNumberDocFile: File | null = null;
  idDocumentFile: File | null = null;
  nameChangeIdDocumentFile: File | null = null;
  maternityLeaveDocumentFile: File | null = null;

  // その他の状態
  sameAsOldAddress = false;
  sameAsNewAddress = false;
  sameAsCurrentAddressForResignation = false;
  sameAsCurrentPhoneForResignation = false;
  sameAsCurrentEmailForResignation = false;
  currentAddressInfo: any = {};
  currentContactInfo: any = {};

  constructor(
    private fb: FormBuilder,
    private firestoreService: FirestoreService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.initializeForms();
  }

  initializeForms() {
    // フォームは必要に応じて初期化
  }

  closeModal() {
    if (this.isSubmittingReapplication) {
      return;
    }
    this.isEditModeForReapplication = false;
    this.close.emit();
  }

  enableEditMode() {
    if (this.application && this.application.status === '差し戻し') {
      this.isEditModeForReapplication = true;
      this.loadApplicationDataToForm(this.application);
    }
  }

  async submitReapplication() {
    if (!this.application) {
      return;
    }
    
    if (this.isSubmittingReapplication) {
      return;
    }
    
    this.isSubmittingReapplication = true;
    
    try {
      // 再申請処理は親コンポーネントに委譲
      this.reapplicationSubmitted.emit();
    } finally {
      this.isSubmittingReapplication = false;
    }
  }

  loadApplicationDataToForm(application: any) {
    // フォームにデータをロードする処理
    // 親コンポーネントから必要なメソッドを呼び出す
  }

  // ヘルパーメソッド
  formatBasicPensionNumberForDisplay(basicPensionNumber: string | null): string {
    if (!basicPensionNumber || basicPensionNumber.length !== 10) {
      return basicPensionNumber || '-';
    }
    return `${basicPensionNumber.substring(0, 4)}-${basicPensionNumber.substring(4)}`;
  }

  formatMyNumberForDisplay(myNumber: string | null): string {
    if (!myNumber || myNumber.length !== 12) {
      return myNumber || '-';
    }
    return `${myNumber.substring(0, 4)}-${myNumber.substring(4, 8)}-${myNumber.substring(8)}`;
  }

  getApplicationDate(application: any): Date | null {
    if (application?.createdAt) {
      return application.createdAt.toDate ? application.createdAt.toDate() : new Date(application.createdAt);
    }
    if (application?.applicationDate) {
      return application.applicationDate.toDate ? application.applicationDate.toDate() : new Date(application.applicationDate);
    }
    return null;
  }

  isOtherApplicationType(applicationType: string): boolean {
    const implementedTypes = [
      '扶養家族追加',
      '扶養削除申請',
      '住所変更申請',
      '氏名変更申請',
      '産前産後休業申請',
      '退職申請',
      '保険証再発行申請',
      '入社時申請',
      'マイナンバー変更申請'
    ];
    return !implementedTypes.includes(applicationType);
  }

  hasAttachmentFiles(application: any): boolean {
    return !!(application?.resumeFileUrl || application?.careerHistoryFileUrl || 
              application?.basicPensionNumberDocFileUrl || application?.idDocumentFileUrl);
  }
}

