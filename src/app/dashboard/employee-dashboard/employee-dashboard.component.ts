import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './employee-dashboard.component.html',
  styleUrl: './employee-dashboard.component.css'
})
export class EmployeeDashboardComponent {
  currentTab: string = 'メインページ';
  
  tabs = [
    { id: 'main', name: 'メインページ' },
    { id: 'settings', name: '情報照会' },
    { id: 'insurance', name: '保険・扶養' },
    { id: 'application', name: '各種申請' },
    { id: 'password-change', name: 'パスワード変更' },
    { id: 'knowledge', name: 'ナレッジ' }
  ];

  // 社員情報（セッションストレージから取得）
  employeeNumber = '';
  employeeName = '';

  // メインページ用データ
  employeeData: any = null;
  hrRequests: any[] = [];
  applications: any[] = [];
  hasOnboardingApplication: boolean = false; // 入社時申請が提出されているか
  
  // 申請モーダル用
  showApplicationModal = false;
  currentApplicationType = '';
  onboardingApplicationForm!: FormGroup; // 入社時申請用フォーム
  dependentApplicationForm!: FormGroup;
  dependentRemovalForm!: FormGroup;
  addressChangeForm!: FormGroup;
  nameChangeForm!: FormGroup;
  maternityLeaveForm!: FormGroup;
  resignationForm!: FormGroup;
  insuranceCardReissueForm!: FormGroup;
  sameAsOldAddress = false; // 変更前住所と同じ
  sameAsNewAddress = false; // 変更後の住所と同じ
  // 現在の住所情報（変更前住所）
  currentAddressInfo: any = {
    postalCode: '',
    address: '',
    addressKana: '',
    householdHead: '',
    householdHeadName: ''
  };
  // 退職申請用：変更なしフラグ
  sameAsCurrentAddressForResignation = false;
  sameAsCurrentPhoneForResignation = false;
  sameAsCurrentEmailForResignation = false;
  // 現在の連絡先情報（退職申請で使用）
  currentContactInfo: any = {
    address: '',
    phone: '',
    email: ''
  };
  // 退職日の最小日付（今日）
  minResignationDate: string = '';
  
  // 氏名変更申請用ファイル
  nameChangeIdDocumentFile: File | null = null;
  
  // 産前産後休業申請用ファイル
  maternityLeaveDocumentFile: File | null = null;
  
  // 申請詳細モーダル用
  showApplicationDetailModal = false;
  selectedApplication: any = null;
  isEditModeForReapplication = false;
  isSubmittingReapplication = false; // 再申請送信中フラグ
  
  // 保険・扶養ページ用データ
  insuranceData: any = {
    healthInsuranceType: '未設定',
    nursingInsuranceType: '未設定',
    pensionInsuranceType: '未設定'
  };
  dependentsData: any[] = [];
  // 扶養者情報の展開状態
  dependentExpandedStates: boolean[] = [];

  // フォーム
  settingsForm: FormGroup;
  passwordChangeForm!: FormGroup;
  showMyNumber = false;
  hasPensionHistory = false;
  isSaving = false;
  isEditMode = false;
  sameAsCurrentAddress = false;
  sameAsCurrentAddressForEmergency = false;
  hasSpouse = false;
  age: number | null = null;
  
  // ファイル入力（フォームコントロールから分離）
  idDocumentFile: File | null = null;
  resumeFile: File | null = null;
  careerHistoryFile: File | null = null;
  basicPensionNumberDocFile: File | null = null;
  
  // 扶養家族追加申請用ファイル
  dependentBasicPensionNumberDocFile: File | null = null;
  dependentMyNumberDocFile: File | null = null;
  dependentIdentityDocFile: File | null = null;
  dependentDisabilityCardFile: File | null = null;

  // 選択肢
  employmentTypes = ['正社員', '契約社員', 'パート', 'アルバイト', '派遣社員'];
  departments = ['営業部', '開発部', '人事部', '経理部', '総務部'];
  genders = ['男性', '女性'];
  householdHeadTypes = ['本人', '親族'];
  pensionHistoryOptions = ['有', '無'];
  employmentStatuses = ['在籍', '退職'];
  paymentTypes = ['月給', '日給', '時給', '年俸'];
  positions = ['一般', '主任', '係長', '課長', '部長', 'その他'];
  offices = ['本社', '支社A', '支社B', '支社C'];
  workContents = ['営業', '開発', '事務', '管理', 'その他'];
  spouseOptions = ['有', '無'];

  constructor(
    private router: Router, 
    private fb: FormBuilder,
    private firestoreService: FirestoreService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // settingsFormを初期化（必須）
    this.settingsForm = this.createForm();
    this.passwordChangeForm = this.createPasswordChangeForm();
    // 扶養家族追加申請フォームを初期化
    this.dependentApplicationForm = this.createDependentApplicationForm();
    // 扶養削除申請フォームを初期化
    this.dependentRemovalForm = this.createDependentRemovalForm();
    // 住所変更申請フォームを初期化
    this.addressChangeForm = this.createAddressChangeForm();
    // 氏名変更申請フォームを初期化
    this.nameChangeForm = this.createNameChangeForm();
    // 産前産後休業申請フォームを初期化
    this.maternityLeaveForm = this.createMaternityLeaveForm();
    // 退職申請フォームを初期化
    this.resignationForm = this.createResignationForm();
    // 保険証再発行申請フォームを初期化
    this.insuranceCardReissueForm = this.createInsuranceCardReissueForm();
    
    // ブラウザ環境でのみセッションストレージにアクセス
    if (isPlatformBrowser(this.platformId)) {
      const storedEmployeeNumber = sessionStorage.getItem('employeeNumber');
      const storedEmployeeName = sessionStorage.getItem('employeeName');
      
      if (!storedEmployeeNumber) {
        // 社員番号がない場合はログインページにリダイレクト
        this.router.navigate(['/login']);
        return;
      }
      
      this.employeeNumber = storedEmployeeNumber;
      this.employeeName = storedEmployeeName || '';
      
      // 退職日の最小日付を設定（今日）
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      this.minResignationDate = `${year}-${month}-${day}`;
      
      // 非同期処理を並列実行（エラーハンドリングを追加）
      Promise.all([
        this.loadEmployeeData().catch(err => {
          console.error('Error in loadEmployeeData:', err);
        }),
        this.loadMainPageData().catch(err => {
          console.error('Error in loadMainPageData:', err);
        })
      ]).catch(err => {
        console.error('Error loading initial data:', err);
      });
    }
  }

  async loadEmployeeData() {
    try {
      const data = await this.firestoreService.getEmployeeData(this.employeeNumber);
      if (data) {
        this.populateForm(data);
        // 保険・扶養ページ用データを設定
        this.loadInsuranceAndDependentsData(data);
        
        // 現在の住所情報を保存（住所変更申請で使用）
        this.currentAddressInfo = {
          postalCode: data.postalCode || '',
          address: data.currentAddress || '',
          addressKana: data.currentAddressKana || '',
          householdHead: data.currentHouseholdHead || '',
          householdHeadName: data.currentHouseholdHeadName || ''
        };
        
        // 現在の連絡先情報を保存（退職申請で使用）
        this.currentContactInfo = {
          address: data.currentAddress || '',
          phone: data.phoneNumber || '',
          email: data.email || ''
        };
      }
      // データ読み込み後、編集モードでない場合はフォームを無効化
      if (!this.isEditMode) {
        this.disableFormControls();
      }
    } catch (error) {
      console.error('Error loading employee data:', error);
    }
  }

  // 保険・扶養ページ用データを読み込む
  loadInsuranceAndDependentsData(data: any) {
    try {
      // 保険者種別情報
      if (data) {
        this.insuranceData = {
          healthInsuranceType: data.healthInsuranceType || '未設定',
          nursingInsuranceType: data.nursingInsuranceType || '未設定',
          pensionInsuranceType: data.pensionInsuranceType || '未設定'
        };
        
        // 扶養者情報
        if (data.dependents && Array.isArray(data.dependents) && data.dependents.length > 0) {
          this.dependentsData = data.dependents.map((dep: any) => ({
            name: dep.name || '',
            nameKana: dep.nameKana || '',
            relationship: dep.relationship || '',
            birthDate: dep.birthDate || '',
            gender: dep.gender || '',
            myNumber: dep.myNumber || '',
            phoneNumber: dep.phoneNumber || '',
            occupation: dep.occupation || '',
            annualIncome: dep.annualIncome || '',
            monthlyIncome: dep.monthlyIncome || '',
            dependentStartDate: dep.dependentStartDate || '',
            dependentReason: dep.dependentReason || '',
            livingTogether: dep.livingTogether || '',
            postalCode: dep.postalCode || '',
            address: dep.address || '',
            addressKana: dep.addressKana || '',
            addressChangeDate: dep.addressChangeDate || '',
            basicPensionNumber: dep.basicPensionNumber || '',
            disabilityCategory: dep.disabilityCategory || '',
            disabilityCardType: dep.disabilityCardType || '',
            disabilityCardIssueDate: dep.disabilityCardIssueDate || '',
            notes: dep.notes || ''
          }));
          // 展開状態を初期化（すべて折りたたみ）
          this.dependentExpandedStates = new Array(this.dependentsData.length).fill(false);
        } else {
          this.dependentsData = [];
          this.dependentExpandedStates = [];
        }
      }
    } catch (error) {
      console.error('Error loading insurance and dependents data:', error);
      // エラーが発生してもデフォルト値を保持
      this.insuranceData = {
        healthInsuranceType: '未設定',
        nursingInsuranceType: '未設定',
        pensionInsuranceType: '未設定'
      };
      this.dependentsData = [];
      this.dependentExpandedStates = [];
    }
  }

  // 扶養者情報の展開状態をトグル
  toggleDependentExpanded(index: number) {
    if (this.dependentExpandedStates[index] === undefined) {
      this.dependentExpandedStates[index] = false;
    }
    this.dependentExpandedStates[index] = !this.dependentExpandedStates[index];
  }

  // 扶養者情報が展開されているかどうか
  isDependentExpanded(index: number): boolean {
    return this.dependentExpandedStates[index] === true;
  }
  
  // 氏名を姓に分割するヘルパーメソッド
  getLastName(name: string | undefined, lastName: string | undefined): string {
    if (lastName) return lastName;
    if (!name) return '-';
    const nameParts = name.split(/[\s　]+/);
    return nameParts.length >= 2 ? nameParts[0] : (name.substring(0, 1) || '-');
  }
  
  // 氏名を名に分割するヘルパーメソッド
  getFirstName(name: string | undefined, firstName: string | undefined): string {
    if (firstName) return firstName;
    if (!name) return '-';
    const nameParts = name.split(/[\s　]+/);
    return nameParts.length >= 2 ? nameParts.slice(1).join('') : (name.substring(1) || '-');
  }
  
  // 氏名（ヨミガナ）を姓に分割するヘルパーメソッド
  getLastNameKana(nameKana: string | undefined, lastNameKana: string | undefined): string {
    if (lastNameKana) return lastNameKana;
    if (!nameKana) return '-';
    const nameKanaParts = nameKana.split(/[\s　]+/);
    return nameKanaParts.length >= 2 ? nameKanaParts[0] : (nameKana.substring(0, 1) || '-');
  }
  
  // 氏名（ヨミガナ）を名に分割するヘルパーメソッド
  getFirstNameKana(nameKana: string | undefined, firstNameKana: string | undefined): string {
    if (firstNameKana) return firstNameKana;
    if (!nameKana) return '-';
    const nameKanaParts = nameKana.split(/[\s　]+/);
    return nameKanaParts.length >= 2 ? nameKanaParts.slice(1).join('') : (nameKana.substring(1) || '-');
  }

  populateForm(data: any) {
    // 氏名を姓・名に分割（既存データとの互換性を考慮）
    let lastName = '';
    let firstName = '';
    let lastNameKana = '';
    let firstNameKana = '';
    
    if (data.lastName && data.firstName) {
      // 新しい形式（既に分割されている）
      lastName = data.lastName;
      firstName = data.firstName;
      lastNameKana = data.lastNameKana || '';
      firstNameKana = data.firstNameKana || '';
    } else if (data.name) {
      // 古い形式（結合されている）- スペースまたは全角スペースで分割を試みる
      const nameParts = data.name.split(/[\s　]+/);
      if (nameParts.length >= 2) {
        lastName = nameParts[0];
        firstName = nameParts.slice(1).join('');
      } else {
        // 分割できない場合は最初の1文字を姓、残りを名とする
        lastName = data.name.substring(0, 1);
        firstName = data.name.substring(1);
      }
    }
    
    if (data.nameKana && !data.lastNameKana) {
      // 古い形式（結合されている）- スペースまたは全角スペースで分割を試みる
      const nameKanaParts = data.nameKana.split(/[\s　]+/);
      if (nameKanaParts.length >= 2) {
        lastNameKana = nameKanaParts[0];
        firstNameKana = nameKanaParts.slice(1).join('');
      } else {
        // 分割できない場合は最初の1文字を姓、残りを名とする
        lastNameKana = data.nameKana.substring(0, 1);
        firstNameKana = data.nameKana.substring(1);
      }
    } else if (data.lastNameKana && data.firstNameKana) {
      lastNameKana = data.lastNameKana;
      firstNameKana = data.firstNameKana;
    }
    
    // マイナンバーを分割
    if (data.myNumber && data.myNumber.length === 12) {
      this.settingsForm.patchValue({
        myNumberPart1: data.myNumber.substring(0, 4),
        myNumberPart2: data.myNumber.substring(4, 8),
        myNumberPart3: data.myNumber.substring(8, 12)
      });
    }
    
    // 氏名を設定
    this.settingsForm.patchValue({
      lastName: lastName,
      firstName: firstName,
      lastNameKana: lastNameKana,
      firstNameKana: firstNameKana
    });

    // 基礎年金番号を分割
    if (data.basicPensionNumber) {
      const basicPensionNumber = data.basicPensionNumber.toString();
      if (basicPensionNumber.length >= 4) {
        this.settingsForm.patchValue({
          basicPensionNumberPart1: basicPensionNumber.substring(0, 4),
          basicPensionNumberPart2: basicPensionNumber.substring(4, 10) || ''
        });
      }
    }

    // 厚生年金加入履歴の状態を設定
    if (data.pensionHistoryStatus) {
      this.hasPensionHistory = data.pensionHistoryStatus === '有';
    }

    // 住民票住所が現住所と同じかチェック
    if (data.sameAsCurrentAddress !== undefined) {
      this.sameAsCurrentAddress = data.sameAsCurrentAddress;
      if (this.sameAsCurrentAddress && data.currentAddress) {
        // データから直接値を取得（保存された値を使用）
        this.settingsForm.patchValue({
          residentAddress: data.residentAddress || data.currentAddress,
          residentAddressKana: data.residentAddressKana || data.currentAddressKana || '',
          residentHouseholdHead: data.residentHouseholdHead || data.currentHouseholdHead || ''
        });
      } else if (data.residentAddress) {
        // sameAsCurrentAddressがfalseの場合、保存された住民票住所を使用
        this.settingsForm.patchValue({
          residentAddress: data.residentAddress,
          residentAddressKana: data.residentAddressKana || '',
          residentHouseholdHead: data.residentHouseholdHead || ''
        });
      }
    }

    // 緊急連絡先住所が現住所と同じかチェック
    if (data.sameAsCurrentAddressForEmergency !== undefined) {
      this.sameAsCurrentAddressForEmergency = data.sameAsCurrentAddressForEmergency;
    }

    // 配偶者の有無
    if (data.spouseStatus) {
      this.hasSpouse = data.spouseStatus === '有';
    }

    // 年齢を計算
    if (data.birthDate) {
      this.calculateAge(data.birthDate);
    }

    // その他のフィールドを設定（一時的なフィールドを除く）
    const formData: any = { ...data };
    delete formData.myNumber;
    delete formData.basicPensionNumber;
    delete formData.updatedAt;
    delete formData.name; // 古い形式のnameは削除（既に分割済み）
    delete formData.nameKana; // 古い形式のnameKanaは削除（既に分割済み）

    // ネストされたフォームグループを個別に設定
    if (formData.emergencyContact) {
      // sameAsCurrentAddressForEmergencyがtrueの場合、現住所の値を緊急連絡先住所にコピー
      if (this.sameAsCurrentAddressForEmergency && data.currentAddress) {
        formData.emergencyContact.address = formData.emergencyContact.address || data.currentAddress;
        formData.emergencyContact.addressKana = formData.emergencyContact.addressKana || data.currentAddressKana || '';
      }
      this.settingsForm.get('emergencyContact')?.patchValue(formData.emergencyContact);
      delete formData.emergencyContact;
    }

    if (formData.bankAccount) {
      this.settingsForm.get('bankAccount')?.patchValue(formData.bankAccount);
      delete formData.bankAccount;
    }

    // 残りのフィールドを設定
    this.settingsForm.patchValue(formData);
    
    // sameAsCurrentAddressがtrueの場合、住民票住所フィールドを無効化
    if (this.sameAsCurrentAddress) {
      this.settingsForm.get('residentAddress')?.disable();
      this.settingsForm.get('residentAddressKana')?.disable();
      this.settingsForm.get('residentHouseholdHead')?.disable();
    }
    
    // sameAsCurrentAddressForEmergencyがtrueの場合、緊急連絡先住所フィールドを無効化
    if (this.sameAsCurrentAddressForEmergency) {
      this.settingsForm.get('emergencyContact.address')?.disable();
      this.settingsForm.get('emergencyContact.addressKana')?.disable();
    }
  }

  calculateAge(birthDate: string) {
    if (!birthDate) {
      this.age = null;
      return;
    }
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    this.age = age;
  }

  onBirthDateChange() {
    const birthDate = this.settingsForm.get('birthDate')?.value;
    if (birthDate) {
      this.calculateAge(birthDate);
    }
  }

  onSameAddressChange(event: any) {
    this.sameAsCurrentAddress = event.target.checked;
    if (this.sameAsCurrentAddress) {
      const currentAddress = this.settingsForm.get('currentAddress')?.value || '';
      const currentAddressKana = this.settingsForm.get('currentAddressKana')?.value || '';
      const currentHouseholdHead = this.settingsForm.get('currentHouseholdHead')?.value || '';
      this.settingsForm.patchValue({
        residentAddress: currentAddress,
        residentAddressKana: currentAddressKana,
        residentHouseholdHead: currentHouseholdHead
      });
      // 住民票住所フィールドを無効化
      this.settingsForm.get('residentAddress')?.disable();
      this.settingsForm.get('residentAddressKana')?.disable();
      this.settingsForm.get('residentHouseholdHead')?.disable();
    } else {
      // 住民票住所フィールドを有効化（編集モードの場合のみ）
      if (this.isEditMode) {
        this.settingsForm.get('residentAddress')?.enable();
        this.settingsForm.get('residentAddressKana')?.enable();
        this.settingsForm.get('residentHouseholdHead')?.enable();
      }
    }
  }

  onSameAddressForEmergencyChange(event: any) {
    this.sameAsCurrentAddressForEmergency = event.target.checked;
    if (this.sameAsCurrentAddressForEmergency) {
      const currentAddress = this.settingsForm.get('currentAddress')?.value || '';
      const currentAddressKana = this.settingsForm.get('currentAddressKana')?.value || '';
      this.settingsForm.get('emergencyContact')?.patchValue({
        address: currentAddress,
        addressKana: currentAddressKana
      });
      // 緊急連絡先住所フィールドを無効化
      this.settingsForm.get('emergencyContact.address')?.disable();
      this.settingsForm.get('emergencyContact.addressKana')?.disable();
    } else {
      // 緊急連絡先住所フィールドを有効化（編集モードの場合のみ）
      if (this.isEditMode) {
        this.settingsForm.get('emergencyContact.address')?.enable();
        this.settingsForm.get('emergencyContact.addressKana')?.enable();
      }
    }
  }

  onSpouseStatusChange(event: any) {
    this.hasSpouse = event.target.value === '有';
    if (!this.hasSpouse) {
      this.settingsForm.get('spouseAnnualIncome')?.setValue('');
    }
  }

  // 入社時申請の住民票住所チェックボックス変更
  onOnboardingSameAddressChange(event: any) {
    const isSame = event.target.checked;
    if (isSame) {
      // 現住所の値を住民票住所にコピー
      const postalCode = this.onboardingApplicationForm.get('postalCode')?.value || '';
      const currentAddress = this.onboardingApplicationForm.get('currentAddress')?.value || '';
      const currentAddressKana = this.onboardingApplicationForm.get('currentAddressKana')?.value || '';
      this.onboardingApplicationForm.patchValue({
        residentPostalCode: postalCode,
        residentAddress: currentAddress,
        residentAddressKana: currentAddressKana
      });
    }
  }

  // 海外在住チェックボックスの変更処理
  onOverseasResidentChange(event: any) {
    const isOverseas = event.target.checked;
    const postalCodeControl = this.onboardingApplicationForm.get('postalCode');
    const currentAddressControl = this.onboardingApplicationForm.get('currentAddress');
    const currentAddressKanaControl = this.onboardingApplicationForm.get('currentAddressKana');
    const overseasAddressControl = this.onboardingApplicationForm.get('overseasAddress');

    if (isOverseas) {
      // 海外在住の場合：郵便番号、現住所、現住所（ヨミガナ）のバリデーションを削除
      postalCodeControl?.clearValidators();
      currentAddressControl?.clearValidators();
      currentAddressKanaControl?.clearValidators();
      // 海外住所のバリデーションを追加
      overseasAddressControl?.setValidators([Validators.required]);
      // 値をクリア
      postalCodeControl?.setValue('');
      currentAddressControl?.setValue('');
      currentAddressKanaControl?.setValue('');
    } else {
      // 国内在住の場合：郵便番号、現住所、現住所（ヨミガナ）のバリデーションを追加
      postalCodeControl?.setValidators([Validators.pattern(/^\d{7}$/)]);
      currentAddressControl?.setValidators([Validators.required]);
      currentAddressKanaControl?.setValidators([Validators.required, this.katakanaValidator]);
      // 海外住所のバリデーションを削除
      overseasAddressControl?.clearValidators();
      // 値をクリア
      overseasAddressControl?.setValue('');
    }
    postalCodeControl?.updateValueAndValidity();
    currentAddressControl?.updateValueAndValidity();
    currentAddressKanaControl?.updateValueAndValidity();
    overseasAddressControl?.updateValueAndValidity();
  }

  // 住民票住所を記載しないチェックボックスの変更処理
  onSkipResidentAddressChange(event: any) {
    const skipResident = event.target.checked;
    const residentPostalCodeControl = this.onboardingApplicationForm.get('residentPostalCode');
    const residentAddressControl = this.onboardingApplicationForm.get('residentAddress');
    const residentAddressKanaControl = this.onboardingApplicationForm.get('residentAddressKana');
    const residentAddressSkipReasonControl = this.onboardingApplicationForm.get('residentAddressSkipReason');
    const residentAddressSkipReasonOtherControl = this.onboardingApplicationForm.get('residentAddressSkipReasonOther');

    if (skipResident) {
      // 住民票住所を記載しない場合：バリデーションを削除
      residentPostalCodeControl?.clearValidators();
      residentAddressControl?.clearValidators();
      residentAddressKanaControl?.clearValidators();
      // 理由のバリデーションを追加
      residentAddressSkipReasonControl?.setValidators([Validators.required]);
      // 値をクリア
      residentPostalCodeControl?.setValue('');
      residentAddressControl?.setValue('');
      residentAddressKanaControl?.setValue('');
    } else {
      // 住民票住所を記載する場合：バリデーションを追加
      residentPostalCodeControl?.setValidators([Validators.required, Validators.pattern(/^\d{7}$/)]);
      residentAddressControl?.setValidators([Validators.required]);
      residentAddressKanaControl?.setValidators([Validators.required, this.katakanaValidator]);
      // 理由のバリデーションを削除
      residentAddressSkipReasonControl?.clearValidators();
      residentAddressSkipReasonOtherControl?.clearValidators();
      // 値をクリア
      residentAddressSkipReasonControl?.setValue('');
      residentAddressSkipReasonOtherControl?.setValue('');
    }
    residentPostalCodeControl?.updateValueAndValidity();
    residentAddressControl?.updateValueAndValidity();
    residentAddressKanaControl?.updateValueAndValidity();
    residentAddressSkipReasonControl?.updateValueAndValidity();
    residentAddressSkipReasonOtherControl?.updateValueAndValidity();
  }

  // 住民票住所を記載しない理由の変更処理
  onResidentAddressSkipReasonChange(event: any) {
    const reason = event.target.value;
    const residentAddressSkipReasonOtherControl = this.onboardingApplicationForm.get('residentAddressSkipReasonOther');
    
    if (reason === 'その他') {
      // その他の場合：理由入力欄のバリデーションを追加
      residentAddressSkipReasonOtherControl?.setValidators([Validators.required]);
    } else {
      // その他以外の場合：理由入力欄のバリデーションを削除
      residentAddressSkipReasonOtherControl?.clearValidators();
      residentAddressSkipReasonOtherControl?.setValue('');
    }
    residentAddressSkipReasonOtherControl?.updateValueAndValidity();
  }


  onFileSelected(event: any, fileType: string) {
    const file = event.target.files?.[0];
    if (file) {
      switch (fileType) {
        case 'idDocument':
          this.idDocumentFile = file;
          break;
        case 'resume':
          this.resumeFile = file;
          break;
        case 'careerHistory':
          this.careerHistoryFile = file;
          break;
        case 'basicPensionNumberDoc':
          this.basicPensionNumberDocFile = file;
          break;
        case 'nameChangeIdDocument':
          this.nameChangeIdDocumentFile = file;
          break;
        case 'maternityLeaveDocument':
          this.maternityLeaveDocumentFile = file;
          break;
        case 'onboardingResume':
          this.resumeFile = file;
          break;
        case 'onboardingCareerHistory':
          this.careerHistoryFile = file;
          break;
      }
    }
  }

  startEdit() {
    this.isEditMode = true;
    this.enableFormControls();
  }

  cancelEdit() {
    this.isEditMode = false;
    this.disableFormControls();
    this.loadEmployeeData();
  }

  private enableFormControls() {
    // すべてのフォームコントロールを有効化
    Object.keys(this.settingsForm.controls).forEach(key => {
      const control = this.settingsForm.get(key);
      if (control) {
        control.enable();
      }
    });
    
    // ネストされたフォームグループも有効化
    const emergencyContact = this.settingsForm.get('emergencyContact') as FormGroup;
    if (emergencyContact) {
      Object.keys(emergencyContact.controls).forEach(key => {
        emergencyContact.get(key)?.enable();
      });
    }
    
    const bankAccount = this.settingsForm.get('bankAccount') as FormGroup;
    if (bankAccount) {
      Object.keys(bankAccount.controls).forEach(key => {
        bankAccount.get(key)?.enable();
      });
    }
    
    // sameAsCurrentAddressがtrueの場合、住民票住所フィールドは無効化のまま
    if (this.sameAsCurrentAddress) {
      this.settingsForm.get('residentAddress')?.disable();
      this.settingsForm.get('residentAddressKana')?.disable();
      this.settingsForm.get('residentHouseholdHead')?.disable();
    }
    
    // sameAsCurrentAddressForEmergencyがtrueの場合、緊急連絡先住所フィールドは無効化のまま
    if (this.sameAsCurrentAddressForEmergency) {
      this.settingsForm.get('emergencyContact.address')?.disable();
      this.settingsForm.get('emergencyContact.addressKana')?.disable();
    }
  }

  private disableFormControls() {
    // すべてのフォームコントロールを無効化
    Object.keys(this.settingsForm.controls).forEach(key => {
      const control = this.settingsForm.get(key);
      if (control) {
        control.disable();
      }
    });
    
    // ネストされたフォームグループも無効化
    const emergencyContact = this.settingsForm.get('emergencyContact') as FormGroup;
    if (emergencyContact) {
      Object.keys(emergencyContact.controls).forEach(key => {
        emergencyContact.get(key)?.disable();
      });
    }
    
    const bankAccount = this.settingsForm.get('bankAccount') as FormGroup;
    if (bankAccount) {
      Object.keys(bankAccount.controls).forEach(key => {
        bankAccount.get(key)?.disable();
      });
    }
  }

  createPasswordChangeForm(): FormGroup {
    return this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  createForm(): FormGroup {
    return this.fb.group({
      // 基本情報
      lastName: ['', Validators.required],
      firstName: ['', Validators.required],
      lastNameKana: [''],
      firstNameKana: [''],
      birthDate: ['', Validators.required],
      gender: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      
      // マイナンバー
      myNumberPart1: [''],
      myNumberPart2: [''],
      myNumberPart3: [''],
      
      // 入退社情報
      employmentStatus: [''],
      joinDate: [''],
      resignationDate: [''],
      resignationReason: [''],
      
      // 業務情報
      employeeNumber: ['', Validators.required],
      office: [''],
      workContent: [''],
      employmentType: [''],
      paymentType: [''],
      
      // 部署・役職情報
      department: [''],
      position: [''],
      
      // 現住所と連絡先
      currentAddress: [''],
      currentAddressKana: [''],
      phoneNumber: [''],
      currentHouseholdHead: [''],
      
      // 住民票住所
      sameAsCurrentAddress: [false],
      residentAddress: [''],
      residentAddressKana: [''],
      residentHouseholdHead: [''],
      
      // 履歴書・職務経歴書（ファイル入力はフォームから分離）
      
      // 緊急連絡先
      emergencyContact: this.fb.group({
        name: [''],
        nameKana: [''],
        relationship: [''],
        phone: [''],
        address: [''],
        addressKana: ['']
      }),
      
      // 口座情報
      bankAccount: this.fb.group({
        bankName: [''],
        accountType: [''],
        accountHolder: [''],
        branchName: [''],
        accountNumber: ['']
      }),
      
      // 社会保険
      healthInsuranceNumber: [''],
      pensionInsuranceNumber: [''],
      basicPensionNumberPart1: [''],
      basicPensionNumberPart2: [''],
      pensionHistoryStatus: [''],
      pensionHistory: [''],
      socialInsuranceAcquisitionDate: [''],
      socialInsuranceLossDate: [''],
      // 基礎年金番号確認書類（ファイル入力はフォームから分離）
      
      // 配偶者情報
      spouseStatus: [''],
      spouseAnnualIncome: ['']
    });
  }

  switchTab(tabName: string) {
    this.currentTab = tabName;
    
    // 各種申請ページに切り替えた場合、申請一覧を読み込む
    if (tabName === '各種申請') {
      this.loadApplications().then(() => {
        // 申請一覧を読み込んだ後、入社時申請の状態を更新
        this.hasOnboardingApplication = this.applications.some(
          (app: any) => app.applicationType === '入社時申請'
        );
      }).catch(err => {
        console.error('Error loading applications:', err);
      });
    }
  }

  logout() {
    // ブラウザ環境でのみセッションストレージをクリア
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem('employeeNumber');
      sessionStorage.removeItem('employeeName');
    }
    this.router.navigate(['/login']);
  }

  toggleMyNumber() {
    this.showMyNumber = !this.showMyNumber;
  }

  getMyNumberDisplayValue(part: number): string {
    const controlName = `myNumberPart${part}` as 'myNumberPart1' | 'myNumberPart2' | 'myNumberPart3';
    const value = this.settingsForm.get(controlName)?.value || '';
    if (!value) return '';
    return this.showMyNumber ? value : '****';
  }

  onPensionHistoryChange(event: any) {
    this.hasPensionHistory = event.target.value === '有';
    if (!this.hasPensionHistory) {
      this.settingsForm.get('pensionHistory')?.setValue('');
    }
  }

  formatMyNumberInput(event: any, part: number) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    const controlName = `myNumberPart${part}` as 'myNumberPart1' | 'myNumberPart2' | 'myNumberPart3';
    this.settingsForm.get(controlName)?.setValue(value, { emitEvent: false });
    
    // 非表示モードの場合は、入力後にマスク表示を維持
    if (!this.showMyNumber && value) {
      // 値を保存した後、表示をマスクに変更
      setTimeout(() => {
        const input = event.target;
        if (input && input.value !== '****') {
          input.value = '****';
        }
      }, 0);
    }
    
    // 自動的に次のフィールドにフォーカス
    if (value.length === 4 && part < 3) {
      const nextInput = document.getElementById(`myNumberPart${part + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  }

  formatBasicPensionNumberInput(event: any, part: number) {
    let value = event.target.value.replace(/\D/g, '');
    const maxLength = part === 1 ? 4 : 6;
    if (value.length > maxLength) {
      value = value.substring(0, maxLength);
    }
    event.target.value = value;
    this.settingsForm.get(`basicPensionNumberPart${part}`)?.setValue(value);
    
    // 自動的に次のフィールドにフォーカス
    if (value.length === maxLength && part === 1) {
      const nextInput = document.getElementById('basicPensionNumberPart2');
      if (nextInput) {
        nextInput.focus();
      }
    }
  }

  // undefinedの値を削除するヘルパー関数
  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
          cleaned[key] = this.removeUndefinedValues(obj[key]);
        }
      }
      return cleaned;
    }
    return obj;
  }

  async onSubmit() {
    if (this.settingsForm.valid) {
      this.isSaving = true;
      try {
        // マイナンバーを結合
        const myNumberParts = [
          this.settingsForm.get('myNumberPart1')?.value || '',
          this.settingsForm.get('myNumberPart2')?.value || '',
          this.settingsForm.get('myNumberPart3')?.value || ''
        ];
        const myNumber = myNumberParts.join('');

        // 基礎年金番号を結合
        const basicPensionNumberParts = [
          this.settingsForm.get('basicPensionNumberPart1')?.value || '',
          this.settingsForm.get('basicPensionNumberPart2')?.value || ''
        ];
        const basicPensionNumber = basicPensionNumberParts.join('');

        // フォームデータを準備
        const formValue = this.settingsForm.value;
        const formData: any = {
          ...formValue,
          myNumber: myNumber || null,
          basicPensionNumber: basicPensionNumber || null,
          sameAsCurrentAddress: this.sameAsCurrentAddress,
          sameAsCurrentAddressForEmergency: this.sameAsCurrentAddressForEmergency
        };

        // sameAsCurrentAddressがtrueの場合、現住所の値を住民票住所にコピー
        if (this.sameAsCurrentAddress) {
          const currentAddress = this.settingsForm.get('currentAddress')?.value || '';
          const currentAddressKana = this.settingsForm.get('currentAddressKana')?.value || '';
          const currentHouseholdHead = this.settingsForm.get('currentHouseholdHead')?.value || '';
          formData.residentAddress = currentAddress;
          formData.residentAddressKana = currentAddressKana;
          formData.residentHouseholdHead = currentHouseholdHead;
        }

        // sameAsCurrentAddressForEmergencyがtrueの場合、現住所の値を緊急連絡先住所にコピー
        if (this.sameAsCurrentAddressForEmergency) {
          const currentAddress = this.settingsForm.get('currentAddress')?.value || '';
          const currentAddressKana = this.settingsForm.get('currentAddressKana')?.value || '';
          if (formData.emergencyContact) {
            formData.emergencyContact.address = currentAddress;
            formData.emergencyContact.addressKana = currentAddressKana;
          }
        }

        // 一時的な入力フィールドを削除（サービス側で正規化されるが、明示的に削除）
        delete formData.myNumberPart1;
        delete formData.myNumberPart2;
        delete formData.myNumberPart3;
        delete formData.basicPensionNumberPart1;
        delete formData.basicPensionNumberPart2;

        // undefinedの値を削除（サービス側でも処理されるが、事前に削除）
        const cleanedData = this.removeUndefinedValues(formData);

        // Firestoreに保存（サービス側で最終的な正規化が行われる）
        const employeeNumber = this.settingsForm.get('employeeNumber')?.value;
        await this.firestoreService.saveEmployeeData(employeeNumber, cleanedData);
        
        // 保存後にデータを再読み込み
        await this.loadEmployeeData();
        
        // 編集モードを終了
        this.isEditMode = false;
        this.disableFormControls();
        
        alert('情報を保存しました');
      } catch (error) {
        console.error('Error saving data:', error);
        alert('保存中にエラーが発生しました');
      } finally {
        this.isSaving = false;
      }
    } else {
      console.log('Form is invalid');
      alert('必須項目を入力してください');
    }
  }

  getMaskedMyNumber(): string {
    const part1 = this.settingsForm.get('myNumberPart1')?.value || '';
    const part2 = this.settingsForm.get('myNumberPart2')?.value || '';
    const part3 = this.settingsForm.get('myNumberPart3')?.value || '';
    const totalLength = part1.length + part2.length + part3.length;
    if (totalLength === 0) return '';
    return '●'.repeat(Math.min(totalLength, 12));
  }

  openApplicationModal(applicationType: string) {
    this.currentApplicationType = applicationType;
    if (applicationType === '入社時申請') {
      // 申請詳細モーダルから開いた場合は、フォームを初期化しない
      if (!this.onboardingApplicationForm) {
        this.onboardingApplicationForm = this.createOnboardingApplicationForm();
        // 既存の新入社員データから氏名とメールアドレスを取得して設定
        this.loadOnboardingEmployeeDataForApplication();
      }
      this.showApplicationModal = true;
    } else if (applicationType === '扶養家族追加') {
      this.dependentApplicationForm = this.createDependentApplicationForm();
      this.showApplicationModal = true;
    } else if (applicationType === '扶養削除申請') {
      this.dependentRemovalForm = this.createDependentRemovalForm();
      this.showApplicationModal = true;
    } else if (applicationType === '住所変更申請') {
      this.addressChangeForm = this.createAddressChangeForm();
      this.sameAsOldAddress = false;
      this.sameAsNewAddress = false;
      this.showApplicationModal = true;
    } else if (applicationType === '氏名変更申請') {
      this.nameChangeForm = this.createNameChangeForm();
      this.showApplicationModal = true;
    } else if (applicationType === '産前産後休業申請') {
      this.maternityLeaveForm = this.createMaternityLeaveForm();
      this.showApplicationModal = true;
    } else if (applicationType === '退職申請') {
      this.resignationForm = this.createResignationForm();
      this.showApplicationModal = true;
    } else if (applicationType === '保険証再発行申請') {
      this.insuranceCardReissueForm = this.createInsuranceCardReissueForm();
      this.showApplicationModal = true;
    } else {
      // 他の申請タイプは今後実装
      alert(`${applicationType}の申請フォームを開きます（実装予定）`);
    }
  }
  
  closeApplicationModal() {
    this.showApplicationModal = false;
    this.currentApplicationType = '';
    // 入社時申請フォームのdisabled状態を解除
    if (this.onboardingApplicationForm) {
      this.onboardingApplicationForm.get('lastName')?.enable();
      this.onboardingApplicationForm.get('firstName')?.enable();
      this.onboardingApplicationForm.get('lastNameKana')?.enable();
      this.onboardingApplicationForm.get('firstNameKana')?.enable();
      this.onboardingApplicationForm.get('email')?.enable();
    }
    this.dependentApplicationForm = this.createDependentApplicationForm();
    this.dependentRemovalForm = this.createDependentRemovalForm();
    this.addressChangeForm = this.createAddressChangeForm();
    this.nameChangeForm = this.createNameChangeForm();
    this.maternityLeaveForm = this.createMaternityLeaveForm();
    this.resignationForm = this.createResignationForm();
    this.insuranceCardReissueForm = this.createInsuranceCardReissueForm();
    this.sameAsOldAddress = false;
    this.sameAsNewAddress = false;
    this.sameAsCurrentAddressForResignation = false;
    this.sameAsCurrentPhoneForResignation = false;
    this.sameAsCurrentEmailForResignation = false;
    // ファイルをリセット
    this.dependentBasicPensionNumberDocFile = null;
    this.dependentMyNumberDocFile = null;
    this.dependentIdentityDocFile = null;
    this.dependentDisabilityCardFile = null;
    this.nameChangeIdDocumentFile = null;
    this.maternityLeaveDocumentFile = null;
  }
  
  // 入社時申請フォームを作成
  createOnboardingApplicationForm(): FormGroup {
    return this.fb.group({
      // 基本情報
      lastName: ['', Validators.required],
      firstName: ['', Validators.required],
      lastNameKana: ['', [Validators.required, this.katakanaValidator]],
      firstNameKana: ['', [Validators.required, this.katakanaValidator]],
      birthDate: ['', Validators.required],
      gender: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      
      // マイナンバー
      myNumberPart1: [''],
      myNumberPart2: [''],
      myNumberPart3: [''],
      
      // 現住所と連絡先
      isOverseasResident: [false], // 海外に在住チェックボックス
      postalCode: [''], // バリデーションは動的に変更
      currentAddress: ['', Validators.required],
      currentAddressKana: ['', [Validators.required, this.katakanaValidator]],
      overseasAddress: [''], // 海外住所（バリデーションは動的に変更）
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\d{1,11}$/)]],
      
      // 住民票住所
      sameAsCurrentAddress: [false],
      skipResidentAddress: [false], // 住民票住所を記載しないチェックボックス
      residentAddressSkipReason: [''], // 住民票住所を記載しない理由（バリデーションは動的に変更）
      residentAddressSkipReasonOther: [''], // その他の理由（バリデーションは動的に変更）
      residentPostalCode: [''], // 住民票住所の郵便番号（バリデーションは動的に変更）
      residentAddress: ['', Validators.required],
      residentAddressKana: ['', [Validators.required, this.katakanaValidator]],
      
      // 履歴書・職務経歴書（ファイル入力はフォームから分離）
      
      // 緊急連絡先
      emergencyContact: this.fb.group({
        name: [''],
        nameKana: ['', this.katakanaValidator],
        relationship: [''],
        phone: ['', Validators.pattern(/^\d+$/)],
        address: [''],
        addressKana: ['', this.katakanaValidator]
      }),
      
      // 口座情報
      bankAccount: this.fb.group({
        bankName: [''],
        accountType: [''],
        accountHolder: ['', this.katakanaValidator],
        branchName: [''],
        accountNumber: ['']
      }),
      
      // 社会保険（基礎年金番号、厚生年金加入履歴のみ）
      basicPensionNumberPart1: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      basicPensionNumberPart2: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      pensionHistoryStatus: ['', Validators.required],
      pensionHistory: [''],
      
      // 扶養者有無
      dependentStatus: ['', Validators.required],
      
      // 資格確認書発行要否
      qualificationCertificateRequired: ['', Validators.required],
      
      // 年金基金加入
      pensionFundMembership: ['', Validators.required] // はい/いいえ
    });
  }

  createDependentApplicationForm(): FormGroup {
    return this.fb.group({
      // 続柄欄
      relationshipType: ['', Validators.required], // 配偶者/配偶者以外
      spouseType: [''], // 妻/夫（配偶者選択時のみ必須）
      relationship: [''], // 続柄（配偶者以外選択時のみ必須）
      
      // 基礎年金番号
      basicPensionNumberPart1: [''],
      basicPensionNumberPart2: [''],
      
      // 基本情報
      lastName: ['', Validators.required],
      firstName: ['', Validators.required],
      lastNameKana: [''],
      firstNameKana: [''],
      birthDate: ['', Validators.required],
      gender: ['', Validators.required],
      phoneNumber: [''],
      occupation: [''],
      
      // 収入情報
      annualIncome: [''],
      monthlyIncome: [''],
      dependentStartDate: ['', Validators.required],
      dependentReason: [''],
      
      // マイナンバー
      provideMyNumber: ['', Validators.required],
      myNumberPart1: [''],
      myNumberPart2: [''],
      myNumberPart3: [''],
      myNumberNotProvidedReason: [''],
      
      // 障がい者情報
      disabilityCategory: [''],
      disabilityCardType: [''],
      disabilityCardIssueDate: [''],
      
      // 住所情報
      livingTogether: ['', Validators.required],
      postalCode: [''],
      address: [''],
      addressKana: [''],
      addressChangeDate: ['']
    });
  }
  
  createDependentRemovalForm(): FormGroup {
    return this.fb.group({
      removalDate: ['', Validators.required],
      dependentId: ['', Validators.required],
      removalReason: ['', Validators.required]
    });
  }
  
  createAddressChangeForm(): FormGroup {
    return this.fb.group({
      moveDate: ['', Validators.required],
      // 新しい住所
      newPostalCode: ['', Validators.required],
      newAddress: ['', Validators.required],
      newAddressKana: [''],
      newHouseholdHead: ['', Validators.required],
      newHouseholdHeadName: [''],
      // 新しい住民票住所
      residentPostalCode: [''],
      residentAddress: [''],
      residentAddressKana: [''],
      residentHouseholdHead: [''],
      residentHouseholdHeadName: ['']
    });
  }
  
  createNameChangeForm(): FormGroup {
    return this.fb.group({
      changeDate: ['', Validators.required],
      newLastName: ['', Validators.required],
      newFirstName: ['', Validators.required],
      newLastNameKana: ['', Validators.required],
      newFirstNameKana: ['', Validators.required]
    });
  }
  
  createMaternityLeaveForm(): FormGroup {
    return this.fb.group({
      expectedDeliveryDate: ['', Validators.required],
      isMultipleBirth: ['', Validators.required],
      preMaternityLeaveStartDate: [''],
      preMaternityLeaveEndDate: [''],
      postMaternityLeaveStartDate: [''],
      postMaternityLeaveEndDate: [''],
      stayAddress: ['']
    });
  }
  
  createResignationForm(): FormGroup {
    return this.fb.group({
      resignationDate: ['', [Validators.required, this.futureDateValidator]],
      lastWorkDate: ['', Validators.required],
      resignationReason: ['', Validators.required], // 退職理由（必須）
      separationNotice: ['', Validators.required],
      postResignationAddress: [''],
      postResignationPhone: [''],
      postResignationEmail: [''],
      postResignationInsurance: ['', Validators.required]
    });
  }
  
  createInsuranceCardReissueForm(): FormGroup {
    return this.fb.group({
      lostDate: ['', Validators.required],
      lostLocation: ['', Validators.required],
      theftPossibility: ['', Validators.required],
      hasMedicalAppointment: ['', Validators.required]
    });
  }
  
  // 変更前住所と同じチェックボックスの変更処理
  onSameAsOldAddressChange(event: any) {
    if (event.target.checked) {
      this.sameAsOldAddress = true;
      this.sameAsNewAddress = false; // 排他的
      
      // 現在の住所情報を使用
      this.addressChangeForm.patchValue({
        residentPostalCode: this.currentAddressInfo.postalCode || '',
        residentAddress: this.currentAddressInfo.address || '',
        residentAddressKana: this.currentAddressInfo.addressKana || '',
        residentHouseholdHead: this.currentAddressInfo.householdHead || '',
        residentHouseholdHeadName: this.currentAddressInfo.householdHeadName || ''
      });
      
      this.updateResidentAddressControls(true);
    } else {
      this.sameAsOldAddress = false;
      this.updateResidentAddressControls(false);
    }
  }
  
  // 変更後の住所と同じチェックボックスの変更処理
  onSameAsNewAddressChange(event: any) {
    if (event.target.checked) {
      this.sameAsNewAddress = true;
      this.sameAsOldAddress = false; // 排他的
      
      const newPostalCode = this.addressChangeForm.get('newPostalCode')?.value || '';
      const newAddress = this.addressChangeForm.get('newAddress')?.value || '';
      const newAddressKana = this.addressChangeForm.get('newAddressKana')?.value || '';
      const newHouseholdHead = this.addressChangeForm.get('newHouseholdHead')?.value || '';
      const newHouseholdHeadName = this.addressChangeForm.get('newHouseholdHeadName')?.value || '';
      
      this.addressChangeForm.patchValue({
        residentPostalCode: newPostalCode,
        residentAddress: newAddress,
        residentAddressKana: newAddressKana,
        residentHouseholdHead: newHouseholdHead,
        residentHouseholdHeadName: newHouseholdHeadName
      });
      
      this.updateResidentAddressControls(true);
    } else {
      this.sameAsNewAddress = false;
      this.updateResidentAddressControls(false);
    }
  }
  
  // 住民票住所欄のコントロールを更新
  updateResidentAddressControls(disabled: boolean) {
    const residentPostalCodeControl = this.addressChangeForm.get('residentPostalCode');
    const residentAddressControl = this.addressChangeForm.get('residentAddress');
    const residentAddressKanaControl = this.addressChangeForm.get('residentAddressKana');
    const residentHouseholdHeadControl = this.addressChangeForm.get('residentHouseholdHead');
    const residentHouseholdHeadNameControl = this.addressChangeForm.get('residentHouseholdHeadName');
    
    if (disabled) {
      residentPostalCodeControl?.clearValidators();
      residentAddressControl?.clearValidators();
      residentAddressKanaControl?.clearValidators();
      residentHouseholdHeadControl?.clearValidators();
      residentHouseholdHeadNameControl?.clearValidators();
      
      residentPostalCodeControl?.disable();
      residentAddressControl?.disable();
      residentAddressKanaControl?.disable();
      residentHouseholdHeadControl?.disable();
      residentHouseholdHeadNameControl?.disable();
    } else {
      residentPostalCodeControl?.enable();
      residentAddressControl?.enable();
      residentAddressKanaControl?.enable();
      residentHouseholdHeadControl?.enable();
      residentHouseholdHeadNameControl?.enable();
    }
    
    residentPostalCodeControl?.updateValueAndValidity();
    residentAddressControl?.updateValueAndValidity();
    residentAddressKanaControl?.updateValueAndValidity();
    residentHouseholdHeadControl?.updateValueAndValidity();
    residentHouseholdHeadNameControl?.updateValueAndValidity();
  }
  
  // フォームの条件付きバリデーションを更新
  onRelationshipTypeChange() {
    const relationshipType = this.dependentApplicationForm.get('relationshipType')?.value;
    const spouseTypeControl = this.dependentApplicationForm.get('spouseType');
    const relationshipControl = this.dependentApplicationForm.get('relationship');
    
    if (relationshipType === '配偶者') {
      spouseTypeControl?.setValidators([Validators.required]);
      relationshipControl?.clearValidators();
      relationshipControl?.setValue('');
    } else if (relationshipType === '配偶者以外') {
      spouseTypeControl?.clearValidators();
      spouseTypeControl?.setValue('');
      relationshipControl?.setValidators([Validators.required]);
    } else {
      spouseTypeControl?.clearValidators();
      relationshipControl?.clearValidators();
    }
    
    spouseTypeControl?.updateValueAndValidity();
    relationshipControl?.updateValueAndValidity();
  }
  
  // 配偶者種別の変更時にバリデーションを更新
  onSpouseTypeChange() {
    const spouseTypeControl = this.dependentApplicationForm.get('spouseType');
    spouseTypeControl?.updateValueAndValidity();
  }
  
  onProvideMyNumberChange() {
    const provideMyNumber = this.dependentApplicationForm.get('provideMyNumber')?.value;
    const myNumberPart1Control = this.dependentApplicationForm.get('myNumberPart1');
    const myNumberPart2Control = this.dependentApplicationForm.get('myNumberPart2');
    const myNumberPart3Control = this.dependentApplicationForm.get('myNumberPart3');
    const myNumberNotProvidedReasonControl = this.dependentApplicationForm.get('myNumberNotProvidedReason');
    
    if (provideMyNumber === '提供する') {
      myNumberPart1Control?.setValidators([Validators.required]);
      myNumberPart2Control?.setValidators([Validators.required]);
      myNumberPart3Control?.setValidators([Validators.required]);
      myNumberNotProvidedReasonControl?.clearValidators();
      myNumberNotProvidedReasonControl?.setValue('');
    } else if (provideMyNumber === '提供しない') {
      myNumberPart1Control?.clearValidators();
      myNumberPart2Control?.clearValidators();
      myNumberPart3Control?.clearValidators();
      myNumberPart1Control?.setValue('');
      myNumberPart2Control?.setValue('');
      myNumberPart3Control?.setValue('');
      myNumberNotProvidedReasonControl?.setValidators([Validators.required]);
    } else {
      myNumberPart1Control?.clearValidators();
      myNumberPart2Control?.clearValidators();
      myNumberPart3Control?.clearValidators();
      myNumberNotProvidedReasonControl?.clearValidators();
    }
    
    myNumberPart1Control?.updateValueAndValidity();
    myNumberPart2Control?.updateValueAndValidity();
    myNumberPart3Control?.updateValueAndValidity();
    myNumberNotProvidedReasonControl?.updateValueAndValidity();
  }
  
  onLivingTogetherChange() {
    const livingTogether = this.dependentApplicationForm.get('livingTogether')?.value;
    const postalCodeControl = this.dependentApplicationForm.get('postalCode');
    const addressControl = this.dependentApplicationForm.get('address');
    
    if (livingTogether === '別居') {
      postalCodeControl?.setValidators([Validators.required]);
      addressControl?.setValidators([Validators.required]);
    } else {
      postalCodeControl?.clearValidators();
      addressControl?.clearValidators();
      postalCodeControl?.setValue('');
      addressControl?.setValue('');
      this.dependentApplicationForm.get('addressKana')?.setValue('');
      this.dependentApplicationForm.get('addressChangeDate')?.setValue('');
    }
    
    postalCodeControl?.updateValueAndValidity();
    addressControl?.updateValueAndValidity();
  }
  
  onDependentFileSelected(event: any, fileType: string) {
    const file = event.target.files?.[0];
    if (file) {
      switch (fileType) {
        case 'basicPensionNumberDoc':
          this.dependentBasicPensionNumberDocFile = file;
          break;
        case 'myNumberDoc':
          this.dependentMyNumberDocFile = file;
          break;
        case 'identityDoc':
          this.dependentIdentityDocFile = file;
          break;
        case 'disabilityCard':
          this.dependentDisabilityCardFile = file;
          break;
      }
    }
  }
  
  formatDependentMyNumberInput(event: any, part: number) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    event.target.value = value;
    this.dependentApplicationForm.get(`myNumberPart${part}`)?.setValue(value);
    
    // 自動的に次のフィールドにフォーカス
    if (value.length === 4 && part < 3) {
      const nextInput = document.getElementById(`dependentMyNumberPart${part + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  }
  
  formatDependentBasicPensionNumberInput(event: any, part: number) {
    let value = event.target.value.replace(/\D/g, '');
    const maxLength = part === 1 ? 4 : 6;
    if (value.length > maxLength) {
      value = value.substring(0, maxLength);
    }
    event.target.value = value;
    this.dependentApplicationForm.get(`basicPensionNumberPart${part}`)?.setValue(value);
    
    // 自動的に次のフィールドにフォーカス
    if (value.length === maxLength && part === 1) {
      const nextInput = document.getElementById('dependentBasicPensionNumberPart2');
      if (nextInput) {
        nextInput.focus();
      }
    }
  }
  
  async submitDependentApplication() {
    if (this.dependentApplicationForm.valid) {
      try {
        // 基礎年金番号を結合
        const basicPensionNumberParts = [
          this.dependentApplicationForm.get('basicPensionNumberPart1')?.value || '',
          this.dependentApplicationForm.get('basicPensionNumberPart2')?.value || ''
        ];
        const basicPensionNumber = basicPensionNumberParts.join('');
        
        // マイナンバーを結合
        const myNumberParts = [
          this.dependentApplicationForm.get('myNumberPart1')?.value || '',
          this.dependentApplicationForm.get('myNumberPart2')?.value || '',
          this.dependentApplicationForm.get('myNumberPart3')?.value || ''
        ];
        const myNumber = myNumberParts.join('');
        
        // フォームデータを準備
        const formValue = this.dependentApplicationForm.value;
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '扶養家族追加',
          relationshipType: formValue.relationshipType,
          spouseType: formValue.spouseType || '',
          relationship: formValue.relationship || '',
          basicPensionNumber: basicPensionNumber || null,
          lastName: formValue.lastName,
          firstName: formValue.firstName,
          lastNameKana: formValue.lastNameKana || '',
          firstNameKana: formValue.firstNameKana || '',
          birthDate: formValue.birthDate,
          gender: formValue.gender,
          phoneNumber: formValue.phoneNumber || '',
          occupation: formValue.occupation || '',
          annualIncome: formValue.annualIncome || '',
          monthlyIncome: formValue.monthlyIncome || '',
          dependentStartDate: formValue.dependentStartDate,
          dependentReason: formValue.dependentReason || '',
          provideMyNumber: formValue.provideMyNumber,
          myNumber: formValue.provideMyNumber === '提供する' ? myNumber : null,
          myNumberNotProvidedReason: formValue.provideMyNumber === '提供しない' ? formValue.myNumberNotProvidedReason : '',
          disabilityCategory: formValue.disabilityCategory || '',
          disabilityCardType: formValue.disabilityCardType || '',
          disabilityCardIssueDate: formValue.disabilityCardIssueDate || '',
          livingTogether: formValue.livingTogether,
          postalCode: formValue.livingTogether === '別居' ? formValue.postalCode : '',
          address: formValue.livingTogether === '別居' ? formValue.address : '',
          addressKana: formValue.livingTogether === '別居' ? formValue.addressKana : '',
          addressChangeDate: formValue.livingTogether === '別居' ? formValue.addressChangeDate : ''
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      }
    } else {
      // フォームのエラーを表示
      this.dependentApplicationForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async submitDependentRemovalApplication() {
    if (this.dependentRemovalForm.valid) {
      try {
        const formValue = this.dependentRemovalForm.value;
        
        // 選択された扶養者情報を取得
        const selectedDependent = this.dependentsData.find((dep: any, index: number) => {
          return index.toString() === formValue.dependentId;
        });
        
        if (!selectedDependent) {
          alert('扶養者情報が見つかりません');
          return;
        }
        
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '扶養削除申請',
          removalDate: formValue.removalDate,
          removalReason: formValue.removalReason,
          dependent: {
            name: selectedDependent.name || '',
            nameKana: selectedDependent.nameKana || '',
            relationship: selectedDependent.relationship || '',
            birthDate: selectedDependent.birthDate || '',
            myNumber: selectedDependent.myNumber || '',
            address: selectedDependent.address || '',
            notes: selectedDependent.notes || ''
          }
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      }
    } else {
      // フォームのエラーを表示
      this.dependentRemovalForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async submitAddressChangeApplication() {
    if (this.addressChangeForm.valid) {
      try {
        const formValue = this.addressChangeForm.value;
        
        // 住民票住所の値を決定
        let residentPostalCode = '';
        let residentAddress = '';
        let residentAddressKana = '';
        let residentHouseholdHead = '';
        let residentHouseholdHeadName = '';
        
        if (this.sameAsOldAddress) {
          // 変更前住所と同じ
          residentPostalCode = this.currentAddressInfo.postalCode || '';
          residentAddress = this.currentAddressInfo.address || '';
          residentAddressKana = this.currentAddressInfo.addressKana || '';
          residentHouseholdHead = this.currentAddressInfo.householdHead || '';
          residentHouseholdHeadName = this.currentAddressInfo.householdHeadName || '';
        } else if (this.sameAsNewAddress) {
          // 変更後の住所と同じ
          residentPostalCode = formValue.newPostalCode || '';
          residentAddress = formValue.newAddress || '';
          residentAddressKana = formValue.newAddressKana || '';
          residentHouseholdHead = formValue.newHouseholdHead || '';
          residentHouseholdHeadName = formValue.newHouseholdHeadName || '';
        } else {
          // 手動入力
          residentPostalCode = formValue.residentPostalCode || '';
          residentAddress = formValue.residentAddress || '';
          residentAddressKana = formValue.residentAddressKana || '';
          residentHouseholdHead = formValue.residentHouseholdHead || '';
          residentHouseholdHeadName = formValue.residentHouseholdHeadName || '';
        }
        
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '住所変更申請',
          moveDate: formValue.moveDate,
          newAddress: {
            postalCode: formValue.newPostalCode,
            address: formValue.newAddress,
            addressKana: formValue.newAddressKana || '',
            householdHead: formValue.newHouseholdHead,
            householdHeadName: formValue.newHouseholdHeadName || ''
          },
          residentAddress: {
            sameAsOldAddress: this.sameAsOldAddress,
            sameAsNewAddress: this.sameAsNewAddress,
            postalCode: residentPostalCode,
            address: residentAddress,
            addressKana: residentAddressKana,
            householdHead: residentHouseholdHead,
            householdHeadName: residentHouseholdHeadName
          }
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      }
    } else {
      // フォームのエラーを表示
      this.addressChangeForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async submitNameChangeApplication() {
    if (this.nameChangeForm.valid) {
      try {
        const formValue = this.nameChangeForm.value;
        
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '氏名変更申請',
          changeDate: formValue.changeDate,
          newName: {
            lastName: formValue.newLastName,
            firstName: formValue.newFirstName,
            lastNameKana: formValue.newLastNameKana,
            firstNameKana: formValue.newFirstNameKana
          },
          hasIdDocument: !!this.nameChangeIdDocumentFile
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      }
    } else {
      // フォームのエラーを表示
      this.nameChangeForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async submitMaternityLeaveApplication() {
    if (this.maternityLeaveForm.valid && this.maternityLeaveDocumentFile) {
      try {
        const formValue = this.maternityLeaveForm.value;
        
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '産前産後休業申請',
          expectedDeliveryDate: formValue.expectedDeliveryDate,
          isMultipleBirth: formValue.isMultipleBirth,
          preMaternityLeaveStartDate: formValue.preMaternityLeaveStartDate || '',
          preMaternityLeaveEndDate: formValue.preMaternityLeaveEndDate || '',
          postMaternityLeaveStartDate: formValue.postMaternityLeaveStartDate || '',
          postMaternityLeaveEndDate: formValue.postMaternityLeaveEndDate || '',
          stayAddress: formValue.stayAddress || '',
          hasDocument: !!this.maternityLeaveDocumentFile
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      }
    } else {
      // フォームのエラーを表示
      this.maternityLeaveForm.markAllAsTouched();
      if (!this.maternityLeaveDocumentFile) {
        alert('出産予定日を確認できる書類を添付してください');
      } else {
        alert('必須項目を入力してください');
      }
    }
  }
  
  // 退職申請用：変更なしチェックボックスの変更処理
  onSameAsCurrentAddressForResignationChange(event: any) {
    this.sameAsCurrentAddressForResignation = event.target.checked;
    const addressControl = this.resignationForm.get('postResignationAddress');
    
    if (this.sameAsCurrentAddressForResignation) {
      this.resignationForm.patchValue({
        postResignationAddress: this.currentContactInfo.address || ''
      });
      addressControl?.clearValidators();
      addressControl?.disable();
    } else {
      addressControl?.setValidators([Validators.required]);
      addressControl?.enable();
    }
    addressControl?.updateValueAndValidity();
  }
  
  onSameAsCurrentPhoneForResignationChange(event: any) {
    this.sameAsCurrentPhoneForResignation = event.target.checked;
    const phoneControl = this.resignationForm.get('postResignationPhone');
    
    if (this.sameAsCurrentPhoneForResignation) {
      this.resignationForm.patchValue({
        postResignationPhone: this.currentContactInfo.phone || ''
      });
      phoneControl?.clearValidators();
      phoneControl?.disable();
    } else {
      phoneControl?.setValidators([Validators.required]);
      phoneControl?.enable();
    }
    phoneControl?.updateValueAndValidity();
  }
  
  onSameAsCurrentEmailForResignationChange(event: any) {
    this.sameAsCurrentEmailForResignation = event.target.checked;
    const emailControl = this.resignationForm.get('postResignationEmail');
    
    if (this.sameAsCurrentEmailForResignation) {
      this.resignationForm.patchValue({
        postResignationEmail: this.currentContactInfo.email || ''
      });
      emailControl?.clearValidators();
      emailControl?.disable();
    } else {
      emailControl?.setValidators([Validators.required, Validators.email]);
      emailControl?.enable();
    }
    emailControl?.updateValueAndValidity();
  }

  async submitResignationApplication() {
    if (this.resignationForm.valid) {
      try {
        const formValue = this.resignationForm.getRawValue(); // disabledフィールドも取得
        
        // 退職後の連絡先情報を決定
        const postResignationAddress = this.sameAsCurrentAddressForResignation 
          ? this.currentContactInfo.address 
          : (formValue.postResignationAddress || '');
        const postResignationPhone = this.sameAsCurrentPhoneForResignation 
          ? this.currentContactInfo.phone 
          : (formValue.postResignationPhone || '');
        const postResignationEmail = this.sameAsCurrentEmailForResignation 
          ? this.currentContactInfo.email 
          : (formValue.postResignationEmail || '');
        
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '退職申請',
          resignationDate: formValue.resignationDate,
          lastWorkDate: formValue.lastWorkDate,
          resignationReason: formValue.resignationReason,
          separationNotice: formValue.separationNotice,
          postResignationAddress: postResignationAddress,
          postResignationPhone: postResignationPhone,
          postResignationEmail: postResignationEmail,
          postResignationInsurance: formValue.postResignationInsurance,
          sameAsCurrentAddress: this.sameAsCurrentAddressForResignation,
          sameAsCurrentPhone: this.sameAsCurrentPhoneForResignation,
          sameAsCurrentEmail: this.sameAsCurrentEmailForResignation
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      }
    } else {
      // フォームのエラーを表示
      this.resignationForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  // 入社時申請を送信
  async submitOnboardingApplication() {
    if (this.onboardingApplicationForm.valid) {
      try {
        // マイナンバーを結合
        const myNumberParts = [
          this.onboardingApplicationForm.get('myNumberPart1')?.value || '',
          this.onboardingApplicationForm.get('myNumberPart2')?.value || '',
          this.onboardingApplicationForm.get('myNumberPart3')?.value || ''
        ];
        const myNumber = myNumberParts.join('');

        // 基礎年金番号を結合
        const basicPensionNumberParts = [
          this.onboardingApplicationForm.get('basicPensionNumberPart1')?.value || '',
          this.onboardingApplicationForm.get('basicPensionNumberPart2')?.value || ''
        ];
        const basicPensionNumber = basicPensionNumberParts.join('');

        // フォームデータを準備（disabled状態のフィールドも含めるため、getRawValue()を使用）
        const formValue = this.onboardingApplicationForm.getRawValue();
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '入社時申請',
          // 基本情報（姓・名を結合して保存）
          lastName: formValue.lastName || '',
          firstName: formValue.firstName || '',
          lastNameKana: formValue.lastNameKana || '',
          firstNameKana: formValue.firstNameKana || '',
          name: (formValue.lastName || '') + (formValue.firstName || ''), // 後方互換性のため
          nameKana: (formValue.lastNameKana || '') + (formValue.firstNameKana || ''), // 後方互換性のため
          birthDate: formValue.birthDate,
          gender: formValue.gender,
          email: formValue.email,
          // マイナンバー
          myNumber: myNumber || null,
          // 現住所と連絡先
          isOverseasResident: formValue.isOverseasResident || false,
          postalCode: formValue.postalCode || '',
          currentAddress: formValue.currentAddress || '',
          currentAddressKana: formValue.currentAddressKana || '',
          overseasAddress: formValue.overseasAddress || '',
          phoneNumber: formValue.phoneNumber || '',
          // 住民票住所
          sameAsCurrentAddress: formValue.sameAsCurrentAddress || false,
          skipResidentAddress: formValue.skipResidentAddress || false,
          residentAddressSkipReason: formValue.residentAddressSkipReason || '',
          residentAddressSkipReasonOther: formValue.residentAddressSkipReasonOther || '',
          residentPostalCode: formValue.sameAsCurrentAddress 
            ? (formValue.postalCode || '') 
            : (formValue.residentPostalCode || ''),
          residentAddress: formValue.sameAsCurrentAddress 
            ? (formValue.currentAddress || '') 
            : (formValue.residentAddress || ''),
          residentAddressKana: formValue.sameAsCurrentAddress 
            ? (formValue.currentAddressKana || '') 
            : (formValue.residentAddressKana || ''),
          // 緊急連絡先
          emergencyContact: formValue.emergencyContact || {},
          // 口座情報
          bankAccount: formValue.bankAccount || {},
          // 社会保険
          basicPensionNumber: basicPensionNumber || null,
          pensionHistoryStatus: formValue.pensionHistoryStatus || '',
          pensionHistory: formValue.pensionHistory || '',
          // 扶養者有無
          dependentStatus: formValue.dependentStatus || '',
          // 資格確認書発行要否
          qualificationCertificateRequired: formValue.qualificationCertificateRequired || '',
          // 年金基金加入
          pensionFundMembership: formValue.pensionFundMembership || ''
        };

        // ファイルをアップロード（履歴書、職務経歴書）
        if (this.resumeFile) {
          // ファイルアップロード処理（必要に応じて実装）
          applicationData.resumeFile = this.resumeFile.name;
        }
        if (this.careerHistoryFile) {
          // ファイルアップロード処理（必要に応じて実装）
          applicationData.careerHistoryFile = this.careerHistoryFile.name;
        }

        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 入社時申請の情報を新入社員詳細情報に反映
        await this.updateOnboardingEmployeeDataFromApplication(applicationData);
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // 入社時申請の状態を更新
        this.hasOnboardingApplication = this.applications.some(
          (app: any) => app.applicationType === '入社時申請'
        );
        
        // 人事からの依頼を再読み込み（入社時申請メッセージを更新）
        await this.loadHrRequests();
        
        alert('入社時申請を送信しました');
      } catch (error) {
        console.error('Error submitting onboarding application:', error);
        alert('申請の送信に失敗しました');
      }
    } else {
      this.onboardingApplicationForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }

  // 入社時申請用に既存の新入社員データを読み込む
  async loadOnboardingEmployeeDataForApplication() {
    try {
      const onboardingData = await this.firestoreService.getOnboardingEmployee(this.employeeNumber);
      if (onboardingData) {
        // 氏名を姓・名に分割（既存データとの互換性を考慮）
        let lastName = '';
        let firstName = '';
        let lastNameKana = '';
        let firstNameKana = '';
        
        if (onboardingData.lastName && onboardingData.firstName) {
          // 新しい形式（既に分割されている）
          lastName = onboardingData.lastName;
          firstName = onboardingData.firstName;
          lastNameKana = onboardingData.lastNameKana || '';
          firstNameKana = onboardingData.firstNameKana || '';
        } else if (onboardingData.name) {
          // 古い形式（結合されている）- スペースまたは全角スペースで分割を試みる
          const nameParts = onboardingData.name.split(/[\s　]+/);
          if (nameParts.length >= 2) {
            lastName = nameParts[0];
            firstName = nameParts.slice(1).join('');
          } else {
            // 分割できない場合は最初の1文字を姓、残りを名とする
            lastName = onboardingData.name.substring(0, 1);
            firstName = onboardingData.name.substring(1);
          }
          
          // カタカナも分割を試みる
          if (onboardingData.nameKana) {
            const nameKanaParts = onboardingData.nameKana.split(/[\s　]+/);
            if (nameKanaParts.length >= 2) {
              lastNameKana = nameKanaParts[0];
              firstNameKana = nameKanaParts.slice(1).join('');
            } else {
              // 分割できない場合は最初の1文字を姓、残りを名とする
              lastNameKana = onboardingData.nameKana.substring(0, 1);
              firstNameKana = onboardingData.nameKana.substring(1);
            }
          }
        }
        
        // 氏名、カタカナ氏名、メールアドレスをフォームに設定（編集不可にするため、値のみ設定）
        this.onboardingApplicationForm.patchValue({
          lastName: lastName,
          firstName: firstName,
          lastNameKana: lastNameKana,
          firstNameKana: firstNameKana,
          email: onboardingData.email || ''
        });
        // 氏名、カタカナ氏名、メールアドレスを編集不可にする
        this.onboardingApplicationForm.get('lastName')?.disable();
        this.onboardingApplicationForm.get('firstName')?.disable();
        this.onboardingApplicationForm.get('lastNameKana')?.disable();
        this.onboardingApplicationForm.get('firstNameKana')?.disable();
        this.onboardingApplicationForm.get('email')?.disable();
      }
    } catch (error) {
      console.error('Error loading onboarding employee data for application:', error);
    }
  }

  // 入社時申請の情報を新入社員詳細情報に反映
  async updateOnboardingEmployeeDataFromApplication(applicationData: any) {
    try {
      // 申請データから新入社員データに反映する情報を準備
      const updateData: any = {
        // 基本情報
        name: applicationData.name,
        nameKana: applicationData.nameKana || '',
        birthDate: applicationData.birthDate,
        gender: applicationData.gender,
        email: applicationData.email,
        // マイナンバー
        myNumber: applicationData.myNumber || null,
        // 現住所と連絡先
        currentAddress: applicationData.currentAddress || '',
        currentAddressKana: applicationData.currentAddressKana || '',
        phoneNumber: applicationData.phoneNumber || '',
        currentHouseholdHead: applicationData.currentHouseholdHead || '',
        // 住民票住所
        sameAsCurrentAddress: applicationData.sameAsCurrentAddress || false,
        residentAddress: applicationData.residentAddress || '',
        residentAddressKana: applicationData.residentAddressKana || '',
        residentHouseholdHead: applicationData.residentHouseholdHead || '',
        // 緊急連絡先
        emergencyContact: applicationData.emergencyContact || {},
        // 口座情報
        bankAccount: applicationData.bankAccount || {},
        // 社会保険
        basicPensionNumber: applicationData.basicPensionNumber || null,
        pensionHistoryStatus: applicationData.pensionHistoryStatus || '',
        pensionHistory: applicationData.pensionHistory || '',
        // 扶養者有無
        dependentStatus: applicationData.dependentStatus || '',
        qualificationCertificateRequired: applicationData.qualificationCertificateRequired || ''
      };

      // 新入社員データを更新
      await this.firestoreService.updateOnboardingEmployee(this.employeeNumber, updateData);
    } catch (error) {
      console.error('Error updating onboarding employee data from application:', error);
      // エラーが発生しても申請は成功しているので、警告のみ
      console.warn('入社時申請は送信されましたが、新入社員データの更新に失敗しました');
    }
  }

  async submitInsuranceCardReissueApplication() {
    if (this.insuranceCardReissueForm.valid) {
      try {
        const formValue = this.insuranceCardReissueForm.value;
        
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '保険証再発行申請',
          lostDate: formValue.lostDate,
          lostLocation: formValue.lostLocation,
          theftPossibility: formValue.theftPossibility,
          hasMedicalAppointment: formValue.hasMedicalAppointment
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      }
    } else {
      // フォームのエラーを表示
      this.insuranceCardReissueForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async loadMainPageData() {
    try {
      // 自分の情報を読み込む
      const data = await this.firestoreService.getEmployeeData(this.employeeNumber);
      if (data) {
        this.employeeData = data;
      }

      // 申請一覧を読み込む
      await this.loadApplications();

      // 人事からの依頼を読み込む
      await this.loadHrRequests();
    } catch (error) {
      console.error('Error loading main page data:', error);
    }
  }

  async loadHrRequests() {
    try {
      this.hrRequests = [];

      // 入社時申請が出されているかチェック
      this.hasOnboardingApplication = this.applications.some(
        (app: any) => app.applicationType === '入社時申請'
      );

      // 入社時申請が出されていない場合、メッセージを追加
      if (!this.hasOnboardingApplication) {
        this.hrRequests.push({
          title: '入社時申請',
          date: new Date(),
          message: '各種申請ページから入社時申請を行ってください'
        });
      }

      // パスワードが初期パスワードのままの場合、メッセージを追加
      if (this.employeeData && this.employeeData.isInitialPassword === true) {
        this.hrRequests.push({
          title: 'パスワード変更',
          date: new Date(),
          message: 'パスワードを変更してください'
        });
      }

      // その他の人事からの依頼を読み込む（今後実装予定）
      // TODO: Firestoreから人事からの依頼を読み込む
    } catch (error) {
      console.error('Error loading HR requests:', error);
    }
  }

  async loadApplications() {
    try {
      const applications = await this.firestoreService.getEmployeeApplications(this.employeeNumber);
      // FirestoreのTimestampをDateに変換
      this.applications = applications.map((app: any) => {
        if (app.createdAt && typeof app.createdAt.toDate === 'function') {
          app.createdAt = app.createdAt.toDate();
        }
        return app;
      });
    } catch (error) {
      console.error('Error loading applications:', error);
      this.applications = [];
    }
  }
  
  // パスワード変更
  async changePassword() {
    if (this.passwordChangeForm.valid) {
      try {
        const formValue = this.passwordChangeForm.value;
        const currentPassword = formValue.currentPassword;
        const newPassword = formValue.newPassword;

        // 現在のパスワードを確認
        const employeeData = await this.firestoreService.getEmployeeData(this.employeeNumber);
        if (!employeeData) {
          alert('社員情報の取得に失敗しました');
          return;
        }

        if (employeeData.password !== currentPassword) {
          alert('現在のパスワードが正しくありません');
          return;
        }

        // パスワードを更新
        await this.firestoreService.saveEmployeeData(this.employeeNumber, {
          ...employeeData,
          password: newPassword,
          isInitialPassword: false // 初期パスワードフラグを解除
        });

        // フォームをリセット
        this.passwordChangeForm.reset();
        
        // メインページのデータを再読み込み（パスワード変更メッセージを更新）
        await this.loadMainPageData();
        
        alert('パスワードを変更しました');
      } catch (error) {
        console.error('Error changing password:', error);
        alert('パスワードの変更に失敗しました');
      }
    } else {
      this.passwordChangeForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }

  getApplicationDate(application: any): Date | null {
    if (!application.createdAt) {
      return null;
    }
    if (application.createdAt instanceof Date) {
      return application.createdAt;
    }
    if (typeof application.createdAt.toDate === 'function') {
      return application.createdAt.toDate();
    }
    return null;
  }
  
  openApplicationDetail(application: any) {
    this.selectedApplication = application;
    this.showApplicationDetailModal = true;
    // 最初は表示モード（編集ボタンをクリックしてから編集モードになる）
    this.isEditModeForReapplication = false;
  }
  
  closeApplicationDetailModal() {
    // 再申請送信中はモーダルを閉じられないようにする
    if (this.isSubmittingReapplication) {
      return;
    }
    this.showApplicationDetailModal = false;
    this.selectedApplication = null;
    this.isEditModeForReapplication = false;
  }
  
  // 編集モードを有効にする
  enableEditMode() {
    console.log('=== enableEditMode 開始 ===');
    console.log('selectedApplication:', this.selectedApplication);
    console.log('selectedApplication.status:', this.selectedApplication?.status);
    console.log('selectedApplication.applicationType:', this.selectedApplication?.applicationType);
    
    if (this.selectedApplication && this.selectedApplication.status === '差し戻し') {
      console.log('条件を満たしています。フォームを初期化します。');
      
      // フォームを初期化してからデータをロード
      if (this.selectedApplication.applicationType === '扶養家族追加') {
        console.log('扶養家族追加申請のフォームを初期化します。');
        this.dependentApplicationForm = this.createDependentApplicationForm();
        console.log('dependentApplicationForm 作成完了:', this.dependentApplicationForm);
        console.log('dependentApplicationForm.valid:', this.dependentApplicationForm.valid);
        console.log('dependentApplicationForm.value:', this.dependentApplicationForm.value);
        
        // データをフォームにロード
        console.log('データをフォームにロードします。');
        this.loadApplicationDataToForm(this.selectedApplication);
        console.log('データロード後の dependentApplicationForm.value:', this.dependentApplicationForm.value);
        console.log('データロード後の dependentApplicationForm.valid:', this.dependentApplicationForm.valid);
      } else if (this.selectedApplication.applicationType === '入社時申請') {
        console.log('入社時申請のフォームを初期化します。');
        this.onboardingApplicationForm = this.createOnboardingApplicationForm();
        this.loadApplicationDataToForm(this.selectedApplication);
      } else if (this.selectedApplication.applicationType === '扶養削除申請') {
        console.log('扶養削除申請のフォームを初期化します。');
        this.dependentRemovalForm = this.createDependentRemovalForm();
        this.loadApplicationDataToForm(this.selectedApplication);
      } else if (this.selectedApplication.applicationType === '住所変更申請') {
        console.log('住所変更申請のフォームを初期化します。');
        this.addressChangeForm = this.createAddressChangeForm();
        this.loadApplicationDataToForm(this.selectedApplication);
      } else if (this.selectedApplication.applicationType === '氏名変更申請') {
        console.log('氏名変更申請のフォームを初期化します。');
        this.nameChangeForm = this.createNameChangeForm();
        this.loadApplicationDataToForm(this.selectedApplication);
      } else if (this.selectedApplication.applicationType === '産前産後休業申請') {
        console.log('産前産後休業申請のフォームを初期化します。');
        this.maternityLeaveForm = this.createMaternityLeaveForm();
        this.loadApplicationDataToForm(this.selectedApplication);
      } else if (this.selectedApplication.applicationType === '退職申請') {
        console.log('退職申請のフォームを初期化します。');
        this.resignationForm = this.createResignationForm();
        this.loadApplicationDataToForm(this.selectedApplication);
      } else if (this.selectedApplication.applicationType === '保険証再発行申請') {
        console.log('保険証再発行申請のフォームを初期化します。');
        this.insuranceCardReissueForm = this.createInsuranceCardReissueForm();
        console.log('insuranceCardReissueForm 作成完了:', this.insuranceCardReissueForm);
        console.log('insuranceCardReissueForm.valid:', this.insuranceCardReissueForm.valid);
        console.log('insuranceCardReissueForm.value:', this.insuranceCardReissueForm.value);
        
        // データをフォームにロード
        console.log('データをフォームにロードします。');
        this.loadApplicationDataToForm(this.selectedApplication);
        console.log('データロード後の insuranceCardReissueForm.value:', this.insuranceCardReissueForm.value);
        console.log('データロード後の insuranceCardReissueForm.valid:', this.insuranceCardReissueForm.valid);
      } else {
        console.log('未対応の申請タイプ:', this.selectedApplication.applicationType);
      }
      
      // 編集モードを有効化（フォーム初期化後に設定）
      console.log('isEditModeForReapplication を true に設定します。');
      this.isEditModeForReapplication = true;
      console.log('isEditModeForReapplication:', this.isEditModeForReapplication);
      console.log('=== enableEditMode 終了 ===');
    } else {
      console.log('条件を満たしていません。');
      console.log('selectedApplication:', this.selectedApplication);
      console.log('status === 差し戻し:', this.selectedApplication?.status === '差し戻し');
    }
  }
  
  // 申請データをフォームに読み込む
  loadApplicationDataToForm(application: any) {
    console.log('=== loadApplicationDataToForm 開始 ===');
    console.log('application:', application);
    console.log('application.applicationType:', application.applicationType);
    
    if (application.applicationType === '扶養家族追加') {
      // フォームは既に初期化されている前提（enableEditModeで初期化済み）
      if (!this.dependentApplicationForm) {
        console.log('dependentApplicationForm が存在しないため、作成します。');
        this.dependentApplicationForm = this.createDependentApplicationForm();
      } else {
        console.log('dependentApplicationForm は既に存在します。');
      }
      
      console.log('application のデータ:', {
        relationshipType: application.relationshipType,
        lastName: application.lastName,
        firstName: application.firstName,
        birthDate: application.birthDate,
        gender: application.gender,
        dependentStartDate: application.dependentStartDate,
        provideMyNumber: application.provideMyNumber,
        livingTogether: application.livingTogether
      });
      
      // データをフォームに設定
      console.log('patchValue を実行します。');
      this.dependentApplicationForm.patchValue({
        relationshipType: application.relationshipType || '',
        spouseType: application.spouseType || '',
        relationship: application.relationship || '',
        lastName: application.lastName || '',
        firstName: application.firstName || '',
        lastNameKana: application.lastNameKana || '',
        firstNameKana: application.firstNameKana || '',
        birthDate: application.birthDate || '',
        gender: application.gender || '',
        phoneNumber: application.phoneNumber || '',
        occupation: application.occupation || '',
        annualIncome: application.annualIncome || '',
        monthlyIncome: application.monthlyIncome || '',
        dependentStartDate: application.dependentStartDate || '',
        dependentReason: application.dependentReason || '',
        provideMyNumber: application.provideMyNumber || '',
        myNumberNotProvidedReason: application.myNumberNotProvidedReason || '',
        disabilityCategory: application.disabilityCategory || '',
        disabilityCardType: application.disabilityCardType || '',
        disabilityCardIssueDate: application.disabilityCardIssueDate || '',
        livingTogether: application.livingTogether || '',
        postalCode: application.postalCode || '',
        address: application.address || '',
        addressKana: application.addressKana || '',
        addressChangeDate: application.addressChangeDate || ''
      });
      
      // 基礎年金番号を分割
      if (application.basicPensionNumber) {
        const basicPensionNumber = application.basicPensionNumber.toString();
        if (basicPensionNumber.length >= 4) {
          this.dependentApplicationForm.patchValue({
            basicPensionNumberPart1: basicPensionNumber.substring(0, 4),
            basicPensionNumberPart2: basicPensionNumber.substring(4, 10) || ''
          });
        }
      }
      
      // マイナンバーを分割
      if (application.myNumber && application.myNumber.length === 12) {
        this.dependentApplicationForm.patchValue({
          myNumberPart1: application.myNumber.substring(0, 4),
          myNumberPart2: application.myNumber.substring(4, 8),
          myNumberPart3: application.myNumber.substring(8, 12)
        });
      }
      
      // バリデーションを再設定
      console.log('バリデーションを再設定します。');
      this.onRelationshipTypeChange();
      this.onProvideMyNumberChange();
      this.onLivingTogetherChange();
      
      console.log('patchValue 後の dependentApplicationForm.value:', this.dependentApplicationForm.value);
      console.log('patchValue 後の dependentApplicationForm.valid:', this.dependentApplicationForm.valid);
      console.log('patchValue 後の dependentApplicationForm.errors:', this.dependentApplicationForm.errors);
      
      // 各フィールドのエラーを確認
      Object.keys(this.dependentApplicationForm.controls).forEach(key => {
        const control = this.dependentApplicationForm.get(key);
        if (control && control.invalid) {
          console.log(`フィールド ${key} が無効:`, {
            value: control.value,
            errors: control.errors,
            touched: control.touched
          });
        }
      });
      
      console.log('=== loadApplicationDataToForm 終了 ===');
    } else if (application.applicationType === '保険証再発行申請') {
      console.log('保険証再発行申請のデータをロードします。');
      // フォームは既に初期化されている前提（enableEditModeで初期化済み）
      if (!this.insuranceCardReissueForm) {
        console.log('insuranceCardReissueForm が存在しないため、作成します。');
        this.insuranceCardReissueForm = this.createInsuranceCardReissueForm();
      } else {
        console.log('insuranceCardReissueForm は既に存在します。');
      }
      
      console.log('application のデータ:', {
        lostDate: application.lostDate,
        lostLocation: application.lostLocation,
        theftPossibility: application.theftPossibility,
        hasMedicalAppointment: application.hasMedicalAppointment
      });
      
      // データをフォームに設定
      console.log('patchValue を実行します。');
      // hasMedicalAppointmentの値を文字列に変換（'有'/'無'またはtrue/falseの両方に対応）
      let hasMedicalAppointmentValue = '';
      if (application.hasMedicalAppointment === true || application.hasMedicalAppointment === '有' || application.hasMedicalAppointment === 'true') {
        hasMedicalAppointmentValue = '有';
      } else if (application.hasMedicalAppointment === false || application.hasMedicalAppointment === '無' || application.hasMedicalAppointment === 'false') {
        hasMedicalAppointmentValue = '無';
      }
      
      this.insuranceCardReissueForm.patchValue({
        lostDate: application.lostDate || '',
        lostLocation: application.lostLocation || '',
        theftPossibility: application.theftPossibility || '',
        hasMedicalAppointment: hasMedicalAppointmentValue || ''
      });
      
      console.log('patchValue 後の insuranceCardReissueForm.value:', this.insuranceCardReissueForm.value);
      console.log('patchValue 後の insuranceCardReissueForm.valid:', this.insuranceCardReissueForm.valid);
      console.log('patchValue 後の insuranceCardReissueForm.errors:', this.insuranceCardReissueForm.errors);
      
      // 各フィールドのエラーを確認
      Object.keys(this.insuranceCardReissueForm.controls).forEach(key => {
        const control = this.insuranceCardReissueForm.get(key);
        if (control && control.invalid) {
          console.log(`フィールド ${key} が無効:`, {
            value: control.value,
            errors: control.errors,
            touched: control.touched
          });
        }
      });
      
      console.log('=== loadApplicationDataToForm 終了（保険証再発行申請） ===');
    } else if (application.applicationType === '入社時申請') {
      // 入社時申請フォームを初期化
      if (!this.onboardingApplicationForm) {
        this.onboardingApplicationForm = this.createOnboardingApplicationForm();
      }
      
      // マイナンバーを分割
      let myNumberPart1 = '';
      let myNumberPart2 = '';
      let myNumberPart3 = '';
      if (application.myNumber && application.myNumber.length === 12) {
        myNumberPart1 = application.myNumber.substring(0, 4);
        myNumberPart2 = application.myNumber.substring(4, 8);
        myNumberPart3 = application.myNumber.substring(8, 12);
      }
      
      // 基礎年金番号を分割
      let basicPensionNumberPart1 = '';
      let basicPensionNumberPart2 = '';
      if (application.basicPensionNumber) {
        const basicPensionNumber = application.basicPensionNumber.toString();
        if (basicPensionNumber.length >= 4) {
          basicPensionNumberPart1 = basicPensionNumber.substring(0, 4);
          basicPensionNumberPart2 = basicPensionNumber.substring(4, 10) || '';
        }
      }
      
      // 氏名を姓・名に分割（既存データとの互換性を考慮）
      let lastName = '';
      let firstName = '';
      let lastNameKana = '';
      let firstNameKana = '';
      
      if (application.lastName && application.firstName) {
        // 新しい形式（既に分割されている）
        lastName = application.lastName;
        firstName = application.firstName;
        lastNameKana = application.lastNameKana || '';
        firstNameKana = application.firstNameKana || '';
      } else if (application.name) {
        // 古い形式（結合されている）- スペースまたは全角スペースで分割を試みる
        const nameParts = application.name.split(/[\s　]+/);
        if (nameParts.length >= 2) {
          lastName = nameParts[0];
          firstName = nameParts.slice(1).join('');
        } else {
          // 分割できない場合は最初の1文字を姓、残りを名とする
          lastName = application.name.substring(0, 1);
          firstName = application.name.substring(1);
        }
      }
      
      if (application.nameKana && !application.lastNameKana) {
        // 古い形式（結合されている）- スペースまたは全角スペースで分割を試みる
        const nameKanaParts = application.nameKana.split(/[\s　]+/);
        if (nameKanaParts.length >= 2) {
          lastNameKana = nameKanaParts[0];
          firstNameKana = nameKanaParts.slice(1).join('');
        } else {
          // 分割できない場合は最初の1文字を姓、残りを名とする
          lastNameKana = application.nameKana.substring(0, 1);
          firstNameKana = application.nameKana.substring(1);
        }
      } else if (application.lastNameKana && application.firstNameKana) {
        lastNameKana = application.lastNameKana;
        firstNameKana = application.firstNameKana;
      }
      
      // データをフォームに設定（ネストされたフォームグループを除く）
      this.onboardingApplicationForm.patchValue({
        lastName: lastName,
        firstName: firstName,
        lastNameKana: lastNameKana,
        firstNameKana: firstNameKana,
        birthDate: application.birthDate || '',
        gender: application.gender || '',
        email: application.email || '',
        myNumberPart1: myNumberPart1,
        myNumberPart2: myNumberPart2,
        myNumberPart3: myNumberPart3,
        postalCode: application.postalCode || '',
        currentAddress: application.currentAddress || '',
        currentAddressKana: application.currentAddressKana || '',
        phoneNumber: application.phoneNumber || '',
        currentHouseholdHead: application.currentHouseholdHead || '',
        sameAsCurrentAddress: application.sameAsCurrentAddress || false,
        residentAddress: application.residentAddress || '',
        residentAddressKana: application.residentAddressKana || '',
        residentHouseholdHead: application.residentHouseholdHead || '',
        basicPensionNumberPart1: basicPensionNumberPart1,
        basicPensionNumberPart2: basicPensionNumberPart2,
        pensionHistoryStatus: application.pensionHistoryStatus || '',
        pensionHistory: application.pensionHistory || '',
        dependentStatus: application.dependentStatus || '',
        qualificationCertificateRequired: application.qualificationCertificateRequired || ''
      });
      
      // ネストされたフォームグループを個別に設定
      const emergencyContactGroup = this.onboardingApplicationForm.get('emergencyContact') as FormGroup;
      if (emergencyContactGroup && application.emergencyContact) {
        emergencyContactGroup.patchValue({
          name: application.emergencyContact.name || '',
          nameKana: application.emergencyContact.nameKana || '',
          relationship: application.emergencyContact.relationship || '',
          phone: application.emergencyContact.phone || '',
          address: application.emergencyContact.address || '',
          addressKana: application.emergencyContact.addressKana || ''
        });
      }
      
      const bankAccountGroup = this.onboardingApplicationForm.get('bankAccount') as FormGroup;
      if (bankAccountGroup && application.bankAccount) {
        bankAccountGroup.patchValue({
          bankName: application.bankAccount.bankName || '',
          accountType: application.bankAccount.accountType || '',
          accountHolder: application.bankAccount.accountHolder || '',
          branchName: application.bankAccount.branchName || '',
          accountNumber: application.bankAccount.accountNumber || ''
        });
      }
      
      // 厚生年金加入履歴の状態を設定
      this.hasPensionHistory = application.pensionHistoryStatus === '有';
      
      // 氏名とメールアドレスを編集不可にする
      this.onboardingApplicationForm.get('lastName')?.disable();
      this.onboardingApplicationForm.get('firstName')?.disable();
      this.onboardingApplicationForm.get('email')?.disable();
      
      console.log('=== loadApplicationDataToForm 終了（入社時申請） ===');
    } else if (application.applicationType === '扶養削除申請') {
      this.dependentRemovalForm = this.createDependentRemovalForm();
      // 扶養者IDを取得（dependentsDataから一致するものを探す）
      let dependentId = '';
      if (application.dependent?.name) {
        const foundIndex = this.dependentsData.findIndex((dep: any) => 
          dep.name === application.dependent.name && 
          dep.relationship === application.dependent.relationship
        );
        if (foundIndex !== -1) {
          dependentId = foundIndex.toString();
        }
      }
      this.dependentRemovalForm.patchValue({
        removalDate: application.removalDate || '',
        dependentId: dependentId,
        removalReason: application.removalReason || ''
      });
    } else if (application.applicationType === '住所変更申請') {
      this.addressChangeForm = this.createAddressChangeForm();
      this.sameAsNewAddress = application.residentAddress?.sameAsNewAddress || false;
      this.sameAsOldAddress = application.residentAddress?.sameAsOldAddress || false;
      this.sameAsNewAddress = application.residentAddress?.sameAsNewAddress || false;
      
      this.addressChangeForm.patchValue({
        moveDate: application.moveDate || '',
        newPostalCode: application.newAddress?.postalCode || '',
        newAddress: application.newAddress?.address || '',
        newAddressKana: application.newAddress?.addressKana || '',
        newHouseholdHead: application.newAddress?.householdHead || '',
        newHouseholdHeadName: application.newAddress?.householdHeadName || '',
        residentPostalCode: application.residentAddress?.postalCode || '',
        residentAddress: application.residentAddress?.address || '',
        residentAddressKana: application.residentAddress?.addressKana || '',
        residentHouseholdHead: application.residentAddress?.householdHead || '',
        residentHouseholdHeadName: application.residentAddress?.householdHeadName || ''
      });
      
      // チェックボックスの状態に応じてコントロールを更新
      if (this.sameAsOldAddress) {
        this.updateResidentAddressControls(true);
      } else if (this.sameAsNewAddress) {
        this.updateResidentAddressControls(true);
      } else {
        this.updateResidentAddressControls(false);
      }
    } else if (application.applicationType === '氏名変更申請') {
      this.nameChangeForm = this.createNameChangeForm();
      this.nameChangeForm.patchValue({
        changeDate: application.changeDate || '',
        newLastName: application.newName?.lastName || '',
        newFirstName: application.newName?.firstName || '',
        newLastNameKana: application.newName?.lastNameKana || '',
        newFirstNameKana: application.newName?.firstNameKana || ''
      });
    } else if (application.applicationType === '産前産後休業申請') {
      this.maternityLeaveForm = this.createMaternityLeaveForm();
      this.maternityLeaveForm.patchValue({
        expectedDeliveryDate: application.expectedDeliveryDate || '',
        isMultipleBirth: application.isMultipleBirth || '',
        preMaternityLeaveStartDate: application.preMaternityLeaveStartDate || '',
        preMaternityLeaveEndDate: application.preMaternityLeaveEndDate || '',
        postMaternityLeaveStartDate: application.postMaternityLeaveStartDate || '',
        postMaternityLeaveEndDate: application.postMaternityLeaveEndDate || '',
        stayAddress: application.stayAddress || ''
      });
    } else if (application.applicationType === '退職申請') {
      this.resignationForm = this.createResignationForm();
      this.resignationForm.patchValue({
        resignationDate: application.resignationDate || '',
        lastWorkDate: application.lastWorkDate || '',
        resignationReason: application.resignationReason || '',
        separationNotice: application.separationNotice || '',
        postResignationAddress: application.postResignationAddress || '',
        postResignationPhone: application.postResignationPhone || '',
        postResignationEmail: application.postResignationEmail || '',
        postResignationInsurance: application.postResignationInsurance || ''
      });
      
      // 変更なしフラグを設定
      this.sameAsCurrentAddressForResignation = application.sameAsCurrentAddress || false;
      this.sameAsCurrentPhoneForResignation = application.sameAsCurrentPhone || false;
      this.sameAsCurrentEmailForResignation = application.sameAsCurrentEmail || false;
      
      // チェックボックスの状態に応じてフォームを更新
      if (this.sameAsCurrentAddressForResignation) {
        this.onSameAsCurrentAddressForResignationChange({ target: { checked: true } });
      }
      if (this.sameAsCurrentPhoneForResignation) {
        this.onSameAsCurrentPhoneForResignationChange({ target: { checked: true } });
      }
      if (this.sameAsCurrentEmailForResignation) {
        this.onSameAsCurrentEmailForResignationChange({ target: { checked: true } });
      }
    }
  }
  
  // 再申請を送信
  async submitReapplication() {
    console.log('=== submitReapplication 開始 ===');
    console.log('selectedApplication:', this.selectedApplication);
    
    if (!this.selectedApplication) {
      console.log('selectedApplication が存在しません。');
      return;
    }
    
    // 既に送信中の場合は処理をスキップ
    if (this.isSubmittingReapplication) {
      return;
    }
    
    this.isSubmittingReapplication = true;
    
    try {
      let formValid = false;
      let applicationData: any = {};
      
      if (this.selectedApplication.applicationType === '扶養家族追加') {
        console.log('扶養家族追加申請の再申請を処理します。');
        console.log('dependentApplicationForm:', this.dependentApplicationForm);
        console.log('dependentApplicationForm.valid:', this.dependentApplicationForm?.valid);
        console.log('dependentApplicationForm.value:', this.dependentApplicationForm?.value);
        
        if (this.dependentApplicationForm) {
          // 各フィールドのエラーを確認
          Object.keys(this.dependentApplicationForm.controls).forEach(key => {
            const control = this.dependentApplicationForm.get(key);
            if (control && control.invalid) {
              console.log(`フィールド ${key} が無効:`, {
                value: control.value,
                errors: control.errors,
                touched: control.touched
              });
            }
          });
        } else {
          console.log('dependentApplicationForm が存在しません！');
        }
        
        formValid = this.dependentApplicationForm?.valid || false;
        console.log('formValid:', formValid);
        
        if (formValid) {
          console.log('フォームが有効です。データを取得します。');
          const basicPensionNumberParts = [
            this.dependentApplicationForm.get('basicPensionNumberPart1')?.value || '',
            this.dependentApplicationForm.get('basicPensionNumberPart2')?.value || ''
          ];
          const basicPensionNumber = basicPensionNumberParts.join('');
          
          const myNumberParts = [
            this.dependentApplicationForm.get('myNumberPart1')?.value || '',
            this.dependentApplicationForm.get('myNumberPart2')?.value || '',
            this.dependentApplicationForm.get('myNumberPart3')?.value || ''
          ];
          const myNumber = myNumberParts.join('');
          
          const formValue = this.dependentApplicationForm.value;
          console.log('formValue:', formValue);
          
          applicationData = {
            ...formValue,
            basicPensionNumber: basicPensionNumber || null,
            myNumber: formValue.provideMyNumber === '提供する' ? myNumber : null,
            employeeNumber: this.employeeNumber,
            applicationType: '扶養家族追加'
          };
          console.log('applicationData:', applicationData);
        } else {
          console.log('フォームが無効です。');
        }
      } else if (this.selectedApplication.applicationType === '扶養削除申請') {
        formValid = this.dependentRemovalForm.valid;
        if (formValid) {
          const formValue = this.dependentRemovalForm.value;
          
          // 選択された扶養者情報を取得
          const selectedDependent = this.dependentsData.find((dep: any, index: number) => {
            return index.toString() === formValue.dependentId;
          });
          
          if (!selectedDependent) {
            alert('扶養者情報が見つかりません');
            this.isSubmittingReapplication = false;
            return;
          }
          
          applicationData = {
            employeeNumber: this.employeeNumber,
            applicationType: '扶養削除申請',
            removalDate: formValue.removalDate,
            removalReason: formValue.removalReason,
            dependent: {
              name: selectedDependent.name || '',
              nameKana: selectedDependent.nameKana || '',
              relationship: selectedDependent.relationship || '',
              birthDate: selectedDependent.birthDate || '',
              myNumber: selectedDependent.myNumber || '',
              address: selectedDependent.address || '',
              notes: selectedDependent.notes || ''
            }
          };
        }
      } else if (this.selectedApplication.applicationType === '住所変更申請') {
        formValid = this.addressChangeForm.valid;
        if (formValid) {
          const formValue = this.addressChangeForm.value;
          
          // 住民票住所の値を決定
          let residentPostalCode = '';
          let residentAddress = '';
          let residentAddressKana = '';
          let residentHouseholdHead = '';
          let residentHouseholdHeadName = '';
          
          if (this.sameAsOldAddress) {
            // 変更前住所と同じ
            residentPostalCode = this.currentAddressInfo.postalCode || '';
            residentAddress = this.currentAddressInfo.address || '';
            residentAddressKana = this.currentAddressInfo.addressKana || '';
            residentHouseholdHead = this.currentAddressInfo.householdHead || '';
            residentHouseholdHeadName = this.currentAddressInfo.householdHeadName || '';
          } else if (this.sameAsNewAddress) {
            // 変更後の住所と同じ
            residentPostalCode = formValue.newPostalCode || '';
            residentAddress = formValue.newAddress || '';
            residentAddressKana = formValue.newAddressKana || '';
            residentHouseholdHead = formValue.newHouseholdHead || '';
            residentHouseholdHeadName = formValue.newHouseholdHeadName || '';
          } else {
            // 手動入力
            residentPostalCode = formValue.residentPostalCode || '';
            residentAddress = formValue.residentAddress || '';
            residentAddressKana = formValue.residentAddressKana || '';
            residentHouseholdHead = formValue.residentHouseholdHead || '';
            residentHouseholdHeadName = formValue.residentHouseholdHeadName || '';
          }
          
          applicationData = {
            moveDate: formValue.moveDate,
            newAddress: {
              postalCode: formValue.newPostalCode,
              address: formValue.newAddress,
              addressKana: formValue.newAddressKana || '',
              householdHead: formValue.newHouseholdHead,
              householdHeadName: formValue.newHouseholdHeadName || ''
            },
            residentAddress: {
              sameAsOldAddress: this.sameAsOldAddress,
              sameAsNewAddress: this.sameAsNewAddress,
              postalCode: residentPostalCode,
              address: residentAddress,
              addressKana: residentAddressKana,
              householdHead: residentHouseholdHead,
              householdHeadName: residentHouseholdHeadName
            },
            employeeNumber: this.employeeNumber,
            applicationType: '住所変更申請'
          };
        }
      } else if (this.selectedApplication.applicationType === '氏名変更申請') {
        formValid = this.nameChangeForm.valid;
        if (formValid) {
          const formValue = this.nameChangeForm.value;
          applicationData = {
            changeDate: formValue.changeDate,
            newName: {
              lastName: formValue.newLastName,
              firstName: formValue.newFirstName,
              lastNameKana: formValue.newLastNameKana,
              firstNameKana: formValue.newFirstNameKana
            },
            hasIdDocument: !!this.nameChangeIdDocumentFile,
            employeeNumber: this.employeeNumber,
            applicationType: '氏名変更申請'
          };
        }
      } else if (this.selectedApplication.applicationType === '入社時申請') {
        formValid = this.onboardingApplicationForm?.valid || false;
        if (formValid) {
          const formValue = this.onboardingApplicationForm.getRawValue(); // disabledフィールドも取得
          
          // マイナンバーを結合
          const myNumberParts = [
            formValue.myNumberPart1 || '',
            formValue.myNumberPart2 || '',
            formValue.myNumberPart3 || ''
          ];
          const myNumber = myNumberParts.join('');
          
          // 基礎年金番号を結合
          const basicPensionNumberParts = [
            formValue.basicPensionNumberPart1 || '',
            formValue.basicPensionNumberPart2 || ''
          ];
          const basicPensionNumber = basicPensionNumberParts.join('');
          
          applicationData = {
            name: formValue.name,
            nameKana: formValue.nameKana || '',
            birthDate: formValue.birthDate,
            gender: formValue.gender,
            email: formValue.email,
            myNumber: myNumber || null,
            postalCode: formValue.postalCode || '',
            currentAddress: formValue.currentAddress || '',
            currentAddressKana: formValue.currentAddressKana || '',
            phoneNumber: formValue.phoneNumber || '',
            currentHouseholdHead: formValue.currentHouseholdHead || '',
            sameAsCurrentAddress: formValue.sameAsCurrentAddress || false,
            residentAddress: formValue.residentAddress || '',
            residentAddressKana: formValue.residentAddressKana || '',
            residentHouseholdHead: formValue.residentHouseholdHead || '',
            emergencyContact: formValue.emergencyContact || {},
            bankAccount: formValue.bankAccount || {},
            basicPensionNumber: basicPensionNumber || null,
            pensionHistoryStatus: formValue.pensionHistoryStatus || '',
            pensionHistory: formValue.pensionHistory || '',
            dependentStatus: formValue.dependentStatus || '',
            qualificationCertificateRequired: formValue.qualificationCertificateRequired || '',
            employeeNumber: this.employeeNumber,
            applicationType: '入社時申請'
          };
        }
      } else if (this.selectedApplication.applicationType === '産前産後休業申請') {
        formValid = this.maternityLeaveForm.valid && !!this.maternityLeaveDocumentFile;
        if (formValid) {
          const formValue = this.maternityLeaveForm.value;
          applicationData = {
            expectedDeliveryDate: formValue.expectedDeliveryDate,
            isMultipleBirth: formValue.isMultipleBirth,
            hasDocument: !!this.maternityLeaveDocumentFile,
            preMaternityLeaveStartDate: formValue.preMaternityLeaveStartDate || '',
            preMaternityLeaveEndDate: formValue.preMaternityLeaveEndDate || '',
            postMaternityLeaveStartDate: formValue.postMaternityLeaveStartDate || '',
            postMaternityLeaveEndDate: formValue.postMaternityLeaveEndDate || '',
            stayAddress: formValue.stayAddress || '',
            employeeNumber: this.employeeNumber,
            applicationType: '産前産後休業申請'
          };
        }
      } else if (this.selectedApplication.applicationType === '退職申請') {
        console.log('退職申請の再申請を処理します。');
        formValid = this.resignationForm?.valid || false;
        if (formValid) {
          const formValue = this.resignationForm.getRawValue(); // disabledフィールドも取得
          
          // 退職後の連絡先情報を決定
          const postResignationAddress = this.sameAsCurrentAddressForResignation 
            ? this.currentContactInfo.address 
            : (formValue.postResignationAddress || '');
          const postResignationPhone = this.sameAsCurrentPhoneForResignation 
            ? this.currentContactInfo.phone 
            : (formValue.postResignationPhone || '');
          const postResignationEmail = this.sameAsCurrentEmailForResignation 
            ? this.currentContactInfo.email 
            : (formValue.postResignationEmail || '');
          
          applicationData = {
            resignationDate: formValue.resignationDate,
            lastWorkDate: formValue.lastWorkDate,
            resignationReason: formValue.resignationReason,
            separationNotice: formValue.separationNotice,
            postResignationAddress: postResignationAddress,
            postResignationPhone: postResignationPhone,
            postResignationEmail: postResignationEmail,
            postResignationInsurance: formValue.postResignationInsurance,
            sameAsCurrentAddress: this.sameAsCurrentAddressForResignation,
            sameAsCurrentPhone: this.sameAsCurrentPhoneForResignation,
            sameAsCurrentEmail: this.sameAsCurrentEmailForResignation,
            employeeNumber: this.employeeNumber,
            applicationType: '退職申請'
          };
        }
      } else if (this.selectedApplication.applicationType === '保険証再発行申請') {
        console.log('保険証再発行申請の再申請を処理します。');
        console.log('insuranceCardReissueForm:', this.insuranceCardReissueForm);
        console.log('insuranceCardReissueForm.valid:', this.insuranceCardReissueForm?.valid);
        console.log('insuranceCardReissueForm.value:', this.insuranceCardReissueForm?.value);
        
        if (this.insuranceCardReissueForm) {
          // 各フィールドのエラーを確認
          Object.keys(this.insuranceCardReissueForm.controls).forEach(key => {
            const control = this.insuranceCardReissueForm.get(key);
            if (control && control.invalid) {
              console.log(`フィールド ${key} が無効:`, {
                value: control.value,
                errors: control.errors,
                touched: control.touched
              });
            }
          });
        } else {
          console.log('insuranceCardReissueForm が存在しません！');
        }
        
        formValid = this.insuranceCardReissueForm?.valid || false;
        console.log('formValid:', formValid);
        
        if (formValid) {
          console.log('フォームが有効です。データを取得します。');
          const formValue = this.insuranceCardReissueForm.value;
          console.log('formValue:', formValue);
          
          // hasMedicalAppointmentの値を適切な形式に変換
          const hasMedicalAppointment = formValue.hasMedicalAppointment === '有' || formValue.hasMedicalAppointment === true || formValue.hasMedicalAppointment === 'true';
          
          applicationData = {
            lostDate: formValue.lostDate,
            lostLocation: formValue.lostLocation,
            theftPossibility: formValue.theftPossibility,
            hasMedicalAppointment: hasMedicalAppointment,
            employeeNumber: this.employeeNumber,
            applicationType: '保険証再発行申請'
          };
          console.log('applicationData:', applicationData);
        } else {
          console.log('フォームが無効です。');
        }
      }
      
      console.log('formValid:', formValid);
      
      if (!formValid) {
        console.log('フォームが無効です。必須項目を入力してください。');
        if (this.selectedApplication.applicationType === '扶養家族追加' && this.dependentApplicationForm) {
          this.dependentApplicationForm.markAllAsTouched();
          console.log('すべてのフィールドを touched に設定しました。');
        } else if (this.selectedApplication.applicationType === '入社時申請' && this.onboardingApplicationForm) {
          this.onboardingApplicationForm.markAllAsTouched();
          console.log('すべてのフィールドを touched に設定しました。');
        } else if (this.selectedApplication.applicationType === '保険証再発行申請' && this.insuranceCardReissueForm) {
          this.insuranceCardReissueForm.markAllAsTouched();
          console.log('すべてのフィールドを touched に設定しました。');
        }
        alert('必須項目を入力してください');
        return;
      }
      
      console.log('フォームは有効です。再申請を実行します。');
      console.log('applicationData:', applicationData);
      
      // 再申請として保存（ステータスを「申請済み」に設定）
      await this.firestoreService.resubmitApplication(this.selectedApplication.id, applicationData);
      
      // 入社時申請の場合、新入社員データも更新
      if (this.selectedApplication.applicationType === '入社時申請' && applicationData.employeeNumber) {
        // 申請データから新入社員データに反映する情報を準備
        await this.updateOnboardingEmployeeDataFromApplication(applicationData);
        
        // 新入社員のステータスを「申請済み」に更新
        await this.firestoreService.updateOnboardingEmployeeStatus(
          applicationData.employeeNumber,
          '申請済み'
        );
      }
      
      // 申請一覧を再読み込み
      await this.loadApplications();
      
      // 選択中の申請を更新（再読み込み後のデータで更新）
      const updatedApplication = this.applications.find((app: any) =>
        app.id === this.selectedApplication.id ||
        app.applicationId === this.selectedApplication.applicationId
      );
      if (updatedApplication) {
        this.selectedApplication = updatedApplication;
      }
      
      // 編集モードを無効化
      this.isEditModeForReapplication = false;
      
      alert('再申請しました');
    } catch (error) {
      console.error('Error resubmitting application:', error);
      alert('再申請中にエラーが発生しました');
    } finally {
      this.isSubmittingReapplication = false;
    }
  }
  
  formatMyNumberForDisplay(myNumber: string | null): string {
    if (!myNumber || myNumber.length !== 12) {
      return '-';
    }
    return `${myNumber.substring(0, 4)}-${myNumber.substring(4, 8)}-${myNumber.substring(8, 12)}`;
  }
  
  isInViewMode(): boolean {
    return !this.isEditModeForReapplication || this.selectedApplication?.status !== '差し戻し';
  }

  isInEditMode(): boolean {
    return this.isEditModeForReapplication && this.selectedApplication?.status === '差し戻し';
  }

  formatBasicPensionNumberForDisplay(basicPensionNumber: string | null): string {
    if (!basicPensionNumber || basicPensionNumber.length < 4) {
      return '-';
    }
    if (basicPensionNumber.length >= 10) {
      return `${basicPensionNumber.substring(0, 4)}-${basicPensionNumber.substring(4, 10)}`;
    }
    return basicPensionNumber;
  }

  // カタカナバリデーター
  katakanaValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null; // 空の場合は他のバリデーターで処理
    }
    const katakanaPattern = /^[ァ-ヶー\s]+$/;
    if (!katakanaPattern.test(control.value)) {
      return { katakana: true };
    }
    return null;
  }

  // 未来の日付のみを許可するバリデーター
  futureDateValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null; // 空の場合は他のバリデーターで処理
    }
    const selectedDate = new Date(control.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 時刻を0時にリセット
    
    if (selectedDate < today) {
      return { pastDate: true };
    }
    return null;
  }

  // 郵便番号フォーマット（7桁の数字のみ）
  formatPostalCode(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 7) {
      value = value.substring(0, 7);
    }
    event.target.value = value;
    const control = this.onboardingApplicationForm.get('postalCode');
    if (control) {
      control.setValue(value, { emitEvent: false });
    }
  }

  // 住民票住所の郵便番号フォーマット（数字7桁のみ）
  formatResidentPostalCode(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 7) {
      value = value.substring(0, 7);
    }
    event.target.value = value;
    const control = this.onboardingApplicationForm.get('residentPostalCode');
    if (control) {
      control.setValue(value, { emitEvent: false });
    }
  }

  // 電話番号フォーマット（数字のみ）
  formatPhoneNumber(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    // 最大11桁に制限
    if (value.length > 11) {
      value = value.substring(0, 11);
    }
    event.target.value = value;
    const control = this.onboardingApplicationForm.get('phoneNumber');
    if (control) {
      control.setValue(value, { emitEvent: false });
    }
  }

  // 入社時申請用基礎年金番号フォーマット（半角数字のみ）
  formatOnboardingBasicPensionNumberInput(event: any, part: number) {
    let value = event.target.value.replace(/[^\d]/g, ''); // 半角数字のみ
    const maxLength = part === 1 ? 4 : 6;
    if (value.length > maxLength) {
      value = value.substring(0, maxLength);
    }
    event.target.value = value;
    const control = this.onboardingApplicationForm.get(`basicPensionNumberPart${part}`);
    if (control) {
      control.setValue(value, { emitEvent: false });
    }
    
    if (value.length === maxLength && part === 1) {
      const nextInput = document.getElementById(`onboarding-basicPensionNumberPart2`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  }

  // 緊急連絡先電話番号フォーマット（数字のみ）
  formatEmergencyPhoneNumber(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    event.target.value = value;
    const control = this.onboardingApplicationForm.get('emergencyContact.phone');
    if (control) {
      control.setValue(value, { emitEvent: false });
    }
  }

  // 配偶者電話番号フォーマット（数字のみ）
  formatSpousePhoneNumber(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    event.target.value = value;
    const control = this.onboardingApplicationForm.get('spousePhoneNumber');
    if (control) {
      control.setValue(value, { emitEvent: false });
    }
  }
}

