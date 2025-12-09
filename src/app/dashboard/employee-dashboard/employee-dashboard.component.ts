import { Component, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
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
    { id: 'knowledge', name: 'ナレッジ' },
    { id: 'password-change', name: 'パスワード変更' }
  ];

  // 社員情報（セッションストレージから取得）
  employeeNumber = '';
  employeeName = '';

  // メインページ用データ
  employeeData: any = null;
  hrRequests: any[] = [];
  applications: any[] = [];
  hasOnboardingApplication: boolean = false; // 入社時申請が提出されているか
  isOnboardingCompleted: boolean = false; // 入社処理が完了しているか（新入社員コレクションに存在しない）
  
  // 申請モーダル用
  showApplicationModal = false;
  currentApplicationType = '';
  onboardingApplicationForm!: FormGroup; // 入社時申請用フォーム
  dependentApplicationForm!: FormGroup;
  dependentRemovalForm!: FormGroup;
  addressChangeForm!: FormGroup;
  nameChangeForm!: FormGroup;
  myNumberChangeForm!: FormGroup;
  maternityLeaveForm!: FormGroup;
  resignationForm!: FormGroup;
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
  // 最終出社日の最大日付（退職日より前）
  maxLastWorkDate: string = '';
  
  // 氏名変更申請用ファイル
  nameChangeIdDocumentFile: File | null = null;
  
  // 産前産後休業申請用ファイル
  maternityLeaveDocumentFile: File | null = null;
  
  // マイナンバーカード添付用ファイル
  myNumberCardFile: File | null = null; // 入社時申請用
  dependentMyNumberCardFile: File | null = null; // 扶養家族追加申請用
  myNumberChangeCardFile: File | null = null; // マイナンバー変更申請用
  
  // 申請詳細モーダル用
  showApplicationDetailModal = false;
  selectedApplication: any = null;
  isEditModeForReapplication = false;
  isSubmittingReapplication = false; // 再申請送信中フラグ
  isSubmittingOnboardingApplication = false; // 入社時申請送信中フラグ
  isSubmittingDependentApplication = false; // 扶養家族追加申請送信中フラグ
  isSubmittingDependentRemovalApplication = false; // 扶養削除申請送信中フラグ
  isSubmittingAddressChangeApplication = false; // 住所変更申請送信中フラグ
  isSubmittingNameChangeApplication = false; // 氏名変更申請送信中フラグ
  isSubmittingMyNumberChangeApplication = false; // マイナンバー変更申請送信中フラグ
  isSubmittingMaternityLeaveApplication = false; // 産前産後休業申請送信中フラグ
  isSubmittingResignationApplication = false; // 退職申請送信中フラグ
  
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
  spouseOptions = ['有', '無'];

  // チャット機能用
  chatMessages: ChatMessage[] = [];
  chatInputMessage: string = '';
  isChatLoading: boolean = false;
  
  // テンプレート質問
  templateQuestions = [
    { 
      icon: '💍', 
      text: '結婚した', 
      question: '結婚したので、配偶者を扶養家族として追加したいです。手続きを教えてください。' 
    },
    { 
      icon: '🏠', 
      text: '引越した', 
      question: '引越しをしたので、住所変更の手続きをしたいです。どのように申請すればよいですか？' 
    },
    { 
      icon: '✏️', 
      text: '改名した', 
      question: '氏名を変更したので、氏名変更の手続きをしたいです。申請方法を教えてください。' 
    },
    { 
      icon: '👶', 
      text: '子供が生まれた', 
      question: '子供が生まれたので、扶養家族として追加したいです。手続きを教えてください。' 
    },
    { 
      icon: '🤰', 
      text: '産休・育休を取得する', 
      question: '産前産後休業を取得したいです。申請手続きについて教えてください。' 
    },
    { 
      icon: '🚪', 
      text: '退職する', 
      question: '退職することになりました。退職申請の手続きについて教えてください。' 
    },
    { 
      icon: '👨‍👩‍👧', 
      text: '扶養家族を追加したい', 
      question: '扶養家族を追加したいです。申請手続きについて教えてください。' 
    },
    { 
      icon: '❌', 
      text: '扶養家族を削除したい', 
      question: '扶養家族を削除したいです。申請手続きについて教えてください。' 
    }
  ];

  constructor(
    private router: Router, 
    private fb: FormBuilder,
    private firestoreService: FirestoreService,
    private chatService: ChatService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
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
        // 入社時申請からマイナンバーカードの情報を取得（社員データにない場合）
        let myNumberCardFileUrl = data.myNumberCardFileUrl || null;
        let myNumberCardFile = data.myNumberCardFile || null;
        
        if (!myNumberCardFileUrl) {
          try {
            const applications = await this.firestoreService.getEmployeeApplications(this.employeeNumber);
            const onboardingApplication = applications.find((app: any) => app.applicationType === '入社時申請');
            if (onboardingApplication && onboardingApplication.myNumberCardFileUrl) {
              myNumberCardFileUrl = onboardingApplication.myNumberCardFileUrl;
              myNumberCardFile = onboardingApplication.myNumberCardFile || null;
            }
          } catch (error) {
            console.error('Error loading onboarding application for my number card:', error);
          }
        }
        
        // employeeDataを更新（添付ファイル情報を含む）
        // マイナンバーカードの情報が含まれていることを確認
        this.employeeData = {
          ...data,
          myNumberCardFileUrl: myNumberCardFileUrl,
          myNumberCardFile: myNumberCardFile
        };
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
            basicPensionNumberDocFileUrl: dep.basicPensionNumberDocFileUrl || '',
            myNumberDocFileUrl: dep.myNumberDocFileUrl || '',
            identityDocFileUrl: dep.identityDocFileUrl || '',
            disabilityCategory: dep.disabilityCategory || '',
            disabilityCardType: dep.disabilityCardType || '',
            disabilityCardIssueDate: dep.disabilityCardIssueDate || '',
            disabilityCardFileUrl: dep.disabilityCardFileUrl || '',
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

    // 海外在住情報を設定
    // isOverseasResidentがundefinedでも、overseasAddressに値がある場合はtrueと推論
    const isOverseasResidentValue = data.isOverseasResident !== undefined 
      ? data.isOverseasResident 
      : (data.overseasAddress && data.overseasAddress.trim() !== '' ? true : false);
    
    this.settingsForm.patchValue({
      isOverseasResident: isOverseasResidentValue,
      overseasAddress: data.overseasAddress || '',
      postalCode: data.postalCode || ''
    });

    // 住民票住所が現住所と同じかチェック
    if (data.sameAsCurrentAddress !== undefined) {
      this.sameAsCurrentAddress = data.sameAsCurrentAddress;
      if (this.sameAsCurrentAddress && data.currentAddress) {
        // データから直接値を取得（保存された値を使用）
        this.settingsForm.patchValue({
          residentPostalCode: data.residentPostalCode || data.postalCode || '',
          residentAddress: data.residentAddress || data.currentAddress,
          residentAddressKana: data.residentAddressKana || data.currentAddressKana || ''
        });
      } else if (data.residentAddress) {
        // sameAsCurrentAddressがfalseの場合、保存された住民票住所を使用
        this.settingsForm.patchValue({
          residentPostalCode: data.residentPostalCode || '',
          residentAddress: data.residentAddress,
          residentAddressKana: data.residentAddressKana || ''
        });
      }
    }
    
    // 住民票住所を記載しない情報を設定
    // skipResidentAddressがundefinedでも、residentAddressSkipReasonが「海外在住」の場合はtrueと推論
    const skipResidentAddressValue = data.skipResidentAddress !== undefined
      ? data.skipResidentAddress
      : (data.residentAddressSkipReason === '海外在住' ? true : false);
    
    this.settingsForm.patchValue({
      skipResidentAddress: skipResidentAddressValue,
      residentAddressSkipReason: data.residentAddressSkipReason || '',
      residentAddressSkipReasonOther: data.residentAddressSkipReasonOther || ''
    });

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
      if (this.sameAsCurrentAddressForEmergency) {
        const isOverseasResident = data.isOverseasResident || false;
        if (isOverseasResident) {
          // 海外在住の場合はoverseasAddressを使用
          formData.emergencyContact.address = formData.emergencyContact.address || data.overseasAddress || '';
          formData.emergencyContact.addressKana = ''; // 海外住所にはヨミガナがない
        } else {
          // 国内在住の場合はcurrentAddressとcurrentAddressKanaを使用
          formData.emergencyContact.address = formData.emergencyContact.address || data.currentAddress || '';
          formData.emergencyContact.addressKana = formData.emergencyContact.addressKana || data.currentAddressKana || '';
        }
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
      this.settingsForm.get('residentPostalCode')?.disable();
      this.settingsForm.get('residentAddress')?.disable();
      this.settingsForm.get('residentAddressKana')?.disable();
    }
    
    // 海外在住の場合、住民票住所を記載しないチェックを自動的に入れて固定
    if (data.isOverseasResident) {
      this.settingsForm.patchValue({
        skipResidentAddress: true,
        residentAddressSkipReason: '海外在住'
      });
      this.settingsForm.get('skipResidentAddress')?.disable();
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
      const postalCode = this.settingsForm.get('postalCode')?.value || '';
      const currentAddress = this.settingsForm.get('currentAddress')?.value || '';
      const currentAddressKana = this.settingsForm.get('currentAddressKana')?.value || '';
      this.settingsForm.patchValue({
        residentPostalCode: postalCode,
        residentAddress: currentAddress,
        residentAddressKana: currentAddressKana
      });
      // 住民票住所フィールドを無効化
      this.settingsForm.get('residentPostalCode')?.disable();
      this.settingsForm.get('residentAddress')?.disable();
      this.settingsForm.get('residentAddressKana')?.disable();
    } else {
      // 住民票住所フィールドを有効化（編集モードの場合のみ）
      if (this.isEditMode) {
        this.settingsForm.get('residentPostalCode')?.enable();
        this.settingsForm.get('residentAddress')?.enable();
        this.settingsForm.get('residentAddressKana')?.enable();
      }
    }
  }

  onSameAddressForEmergencyChange(event: any) {
    this.sameAsCurrentAddressForEmergency = event.target.checked;
    if (this.sameAsCurrentAddressForEmergency) {
      const isOverseasResident = this.settingsForm.get('isOverseasResident')?.value || false;
      if (isOverseasResident) {
        // 海外在住の場合はoverseasAddressを使用
        const overseasAddress = this.settingsForm.get('overseasAddress')?.value || '';
        this.settingsForm.get('emergencyContact')?.patchValue({
          address: overseasAddress,
          addressKana: '' // 海外住所にはヨミガナがない
        });
      } else {
        // 国内在住の場合はcurrentAddressとcurrentAddressKanaを使用
        const currentAddress = this.settingsForm.get('currentAddress')?.value || '';
        const currentAddressKana = this.settingsForm.get('currentAddressKana')?.value || '';
        this.settingsForm.get('emergencyContact')?.patchValue({
          address: currentAddress,
          addressKana: currentAddressKana
        });
      }
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
    const residentPostalCodeControl = this.onboardingApplicationForm.get('residentPostalCode');
    const residentAddressControl = this.onboardingApplicationForm.get('residentAddress');
    const residentAddressKanaControl = this.onboardingApplicationForm.get('residentAddressKana');
    
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
      // フォームコントロールを無効化
      if (residentPostalCodeControl) {
        residentPostalCodeControl.disable();
      }
      if (residentAddressControl) {
        residentAddressControl.disable();
      }
      if (residentAddressKanaControl) {
        residentAddressKanaControl.disable();
      }
    } else {
      // フォームコントロールを有効化
      if (residentPostalCodeControl) {
        residentPostalCodeControl.enable();
      }
      if (residentAddressControl) {
        residentAddressControl.enable();
      }
      if (residentAddressKanaControl) {
        residentAddressKanaControl.enable();
      }
    }
  }

  // 海外在住チェックボックスの変更処理
  onOverseasResidentChange(event: any) {
    const isOverseas = event.target.checked;
    const postalCodeControl = this.onboardingApplicationForm.get('postalCode');
    const currentAddressControl = this.onboardingApplicationForm.get('currentAddress');
    const currentAddressKanaControl = this.onboardingApplicationForm.get('currentAddressKana');
    const overseasAddressControl = this.onboardingApplicationForm.get('overseasAddress');
    const skipResidentAddressControl = this.onboardingApplicationForm.get('skipResidentAddress');
    const residentAddressSkipReasonControl = this.onboardingApplicationForm.get('residentAddressSkipReason');
    const residentAddressSkipReasonOtherControl = this.onboardingApplicationForm.get('residentAddressSkipReasonOther');
    const residentPostalCodeControl = this.onboardingApplicationForm.get('residentPostalCode');
    const residentAddressControl = this.onboardingApplicationForm.get('residentAddress');
    const residentAddressKanaControl = this.onboardingApplicationForm.get('residentAddressKana');

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
      
      // 住民票住所を記載しないチェックを自動的に入れて固定
      skipResidentAddressControl?.setValue(true);
      skipResidentAddressControl?.disable(); // チェックボックスを無効化して固定
      
      // 住民票住所のバリデーションを削除
      residentPostalCodeControl?.clearValidators();
      residentAddressControl?.clearValidators();
      residentAddressKanaControl?.clearValidators();
      
      // 理由を「海外在住」に設定
      residentAddressSkipReasonControl?.setValue('海外在住');
      residentAddressSkipReasonControl?.setValidators([Validators.required]);
      // その他の理由のバリデーションを削除
      residentAddressSkipReasonOtherControl?.clearValidators();
      residentAddressSkipReasonOtherControl?.setValue('');
      
      // バリデーションを更新
      residentPostalCodeControl?.updateValueAndValidity();
      residentAddressControl?.updateValueAndValidity();
      residentAddressKanaControl?.updateValueAndValidity();
      residentAddressSkipReasonControl?.updateValueAndValidity();
      residentAddressSkipReasonOtherControl?.updateValueAndValidity();
    } else {
      // 国内在住の場合：郵便番号、現住所、現住所（ヨミガナ）のバリデーションを追加
      postalCodeControl?.setValidators([Validators.pattern(/^\d{7}$/)]);
      currentAddressControl?.setValidators([Validators.required]);
      currentAddressKanaControl?.setValidators([Validators.required, this.katakanaValidator]);
      // 海外住所のバリデーションを削除
      overseasAddressControl?.clearValidators();
      // 値をクリア
      overseasAddressControl?.setValue('');
      
      // 住民票住所を記載しないチェックを解除して有効化
      skipResidentAddressControl?.enable();
      skipResidentAddressControl?.setValue(false);
      // 理由をクリア
      residentAddressSkipReasonControl?.setValue('');
      residentAddressSkipReasonControl?.clearValidators();
      residentAddressSkipReasonOtherControl?.clearValidators();
      residentAddressSkipReasonOtherControl?.setValue('');
      residentAddressSkipReasonControl?.updateValueAndValidity();
      residentAddressSkipReasonOtherControl?.updateValueAndValidity();
    }
    postalCodeControl?.updateValueAndValidity();
    currentAddressControl?.updateValueAndValidity();
    currentAddressKanaControl?.updateValueAndValidity();
    overseasAddressControl?.updateValueAndValidity();
  }

  // 住民票住所を記載しないチェックボックスの変更処理
  // マイナンバー入力時の処理（半角数字のみ許可）
  onMyNumberInput(event: any, part: string) {
    const input = event.target;
    const value = input.value;
    // 半角数字以外を削除
    const filteredValue = value.replace(/[^0-9]/g, '');
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.onboardingApplicationForm.get(part)?.setValue(filteredValue, { emitEvent: false });
    }
  }

  onSkipResidentAddressChange(event: any) {
    // 海外在住の場合は変更を許可しない
    const isOverseas = this.onboardingApplicationForm.get('isOverseasResident')?.value;
    if (isOverseas) {
      event.target.checked = true; // 強制的にチェック状態を維持
      return;
    }
    
    const skipResident = event.target.checked;
    const residentPostalCodeControl = this.onboardingApplicationForm.get('residentPostalCode');
    const residentAddressControl = this.onboardingApplicationForm.get('residentAddress');
    const residentAddressKanaControl = this.onboardingApplicationForm.get('residentAddressKana');
    const residentAddressSkipReasonControl = this.onboardingApplicationForm.get('residentAddressSkipReason');
    const residentAddressSkipReasonOtherControl = this.onboardingApplicationForm.get('residentAddressSkipReasonOther');
    const sameAsCurrentAddressControl = this.onboardingApplicationForm.get('sameAsCurrentAddress');

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
      // 現住所と同じチェックも解除
      sameAsCurrentAddressControl?.setValue(false);
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
        case 'myNumberCard':
          this.myNumberCardFile = file;
          break;
        case 'dependentMyNumberCard':
          this.dependentMyNumberCardFile = file;
          break;
        case 'myNumberChangeCard':
          this.myNumberChangeCardFile = file;
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
      employmentType: [''],
      paymentType: [''],
      
      // 部署・役職情報
      department: [''],
      position: [''],
      
      // 現住所と連絡先
      isOverseasResident: [false],
      postalCode: [''],
      currentAddress: [''],
      currentAddressKana: [''],
      overseasAddress: [''],
      phoneNumber: [''],
      currentHouseholdHead: [''],
      
      // 住民票住所
      skipResidentAddress: [false],
      residentAddressSkipReason: [''],
      residentAddressSkipReasonOther: [''],
      sameAsCurrentAddress: [false],
      residentPostalCode: [''],
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
    // 申請中はタブ切り替えを無効化
    if (this.isSubmittingOnboardingApplication) {
      return;
    }
    this.currentTab = tabName;
    
    // 各種申請ページに切り替えた場合、申請一覧を読み込む
    if (tabName === '各種申請') {
      // 入社処理が完了しているかチェック
      this.checkOnboardingCompletion();
      
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
    // 申請中はログアウトを無効化
    if (this.isSubmittingOnboardingApplication) {
      return;
    }
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
          sameAsCurrentAddressForEmergency: this.sameAsCurrentAddressForEmergency,
          // 海外在住情報を明示的に保存（getRawValue()を使用してdisabled状態のフィールドも含める）
          isOverseasResident: this.settingsForm.get('isOverseasResident')?.value || false,
          overseasAddress: this.settingsForm.get('overseasAddress')?.value || '',
          postalCode: this.settingsForm.get('postalCode')?.value || '',
          skipResidentAddress: this.settingsForm.get('skipResidentAddress')?.value || false,
          residentAddressSkipReason: this.settingsForm.get('residentAddressSkipReason')?.value || '',
          residentAddressSkipReasonOther: this.settingsForm.get('residentAddressSkipReasonOther')?.value || '',
          residentPostalCode: this.settingsForm.get('residentPostalCode')?.value || ''
        };

        // sameAsCurrentAddressがtrueの場合、現住所の値を住民票住所にコピー
        if (this.sameAsCurrentAddress) {
          const postalCode = this.settingsForm.get('postalCode')?.value || '';
          const currentAddress = this.settingsForm.get('currentAddress')?.value || '';
          const currentAddressKana = this.settingsForm.get('currentAddressKana')?.value || '';
          formData.residentPostalCode = postalCode;
          formData.residentAddress = currentAddress;
          formData.residentAddressKana = currentAddressKana;
        }

        // sameAsCurrentAddressForEmergencyがtrueの場合、現住所の値を緊急連絡先住所にコピー
        if (this.sameAsCurrentAddressForEmergency) {
          const isOverseasResident = this.settingsForm.get('isOverseasResident')?.value || false;
          if (isOverseasResident) {
            // 海外在住の場合はoverseasAddressを使用
            const overseasAddress = this.settingsForm.get('overseasAddress')?.value || '';
            if (formData.emergencyContact) {
              formData.emergencyContact.address = overseasAddress;
              formData.emergencyContact.addressKana = ''; // 海外住所にはヨミガナがない
            }
          } else {
            // 国内在住の場合はcurrentAddressとcurrentAddressKanaを使用
            const currentAddress = this.settingsForm.get('currentAddress')?.value || '';
            const currentAddressKana = this.settingsForm.get('currentAddressKana')?.value || '';
            if (formData.emergencyContact) {
              formData.emergencyContact.address = currentAddress;
              formData.emergencyContact.addressKana = currentAddressKana;
            }
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
      // デバッグ用：フォームを有効化（何回でも申請できるようにする）
      this.onboardingApplicationForm.enable();
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
    } else if (applicationType === 'マイナンバー変更申請') {
      this.myNumberChangeForm = this.createMyNumberChangeForm();
      this.showApplicationModal = true;
    } else if (applicationType === '産前産後休業申請') {
      this.maternityLeaveForm = this.createMaternityLeaveForm();
      this.showApplicationModal = true;
    } else if (applicationType === '退職申請') {
      this.resignationForm = this.createResignationForm();
      this.showApplicationModal = true;
    } else {
      // 他の申請タイプは今後実装
      alert(`${applicationType}の申請フォームを開きます（実装予定）`);
    }
  }
  
  closeApplicationModal() {
    // 申請中はモーダルを閉じられないようにする
    if (this.isSubmittingOnboardingApplication) {
      return;
    }
    this.showApplicationModal = false;
    this.currentApplicationType = '';
    // デバッグ用：入社時申請フォームのdisabled状態を解除（何回でも申請できるようにする）
    if (this.onboardingApplicationForm) {
      this.onboardingApplicationForm.enable();
    }
    this.dependentApplicationForm = this.createDependentApplicationForm();
    this.dependentRemovalForm = this.createDependentRemovalForm();
    this.addressChangeForm = this.createAddressChangeForm();
    this.nameChangeForm = this.createNameChangeForm();
    this.myNumberChangeForm = this.createMyNumberChangeForm();
    this.maternityLeaveForm = this.createMaternityLeaveForm();
    this.resignationForm = this.createResignationForm();
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
    this.myNumberCardFile = null;
    this.dependentMyNumberCardFile = null;
    this.myNumberChangeCardFile = null;
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
        sameAsCurrentAddressForEmergency: [false],
        name: [''],
        nameKana: ['', this.katakanaValidator],
        relationship: [''],
        phone: ['', [Validators.pattern(/^\d{1,11}$/)]],
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
      basicPensionNumberPart1: ['', Validators.required], // 必須
      basicPensionNumberPart2: ['', Validators.required], // 必須
      
      // 基本情報
      lastName: ['', Validators.required],
      firstName: ['', Validators.required],
      lastNameKana: [''],
      firstNameKana: [''],
      birthDate: ['', Validators.required],
      gender: ['', Validators.required],
      phoneNumber: ['', [Validators.pattern(/^[a-zA-Z0-9]{0,11}$/)]],
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
      postalCode: ['', [Validators.pattern(/^[a-zA-Z0-9]{7}$/)]],
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
      // 海外在住
      isOverseasResident: [false],
      overseasAddress: [''],
      // 新しい住所
      newPostalCode: ['', [Validators.required, Validators.pattern(/^[0-9]{7}$/)]],
      newAddress: ['', Validators.required],
      newAddressKana: [''],
      // 新しい住民票住所
      residentPostalCode: ['', Validators.pattern(/^[0-9]{7}$/)],
      residentAddress: [''],
      residentAddressKana: ['']
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
  
  createMyNumberChangeForm(): FormGroup {
    return this.fb.group({
      changeDate: ['', Validators.required],
      newMyNumberPart1: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      newMyNumberPart2: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      newMyNumberPart3: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
    });
  }
  
  createMaternityLeaveForm(): FormGroup {
    const form = this.fb.group({
      expectedDeliveryDate: ['', Validators.required],
      isMultipleBirth: ['', Validators.required],
      maternityLeaveStartDate: [''],
      maternityLeaveEndDate: [''],
      stayAddress: ['']
    });
    
    // 出産予定日が変更されたときに産前産後休業期間を自動設定
    form.get('expectedDeliveryDate')?.valueChanges.subscribe(date => {
      if (date) {
        const isMultipleBirth = form.get('isMultipleBirth')?.value || '';
        this.setMaternityLeavePeriod(form, date, isMultipleBirth);
      } else {
        form.get('maternityLeaveStartDate')?.setValue('');
        form.get('maternityLeaveEndDate')?.setValue('');
        form.get('maternityLeaveStartDate')?.disable();
        form.get('maternityLeaveEndDate')?.disable();
      }
    });
    
    // 双子以上かが変更されたときに産前産後休業期間を再計算
    form.get('isMultipleBirth')?.valueChanges.subscribe(isMultipleBirth => {
      const expectedDeliveryDate = form.get('expectedDeliveryDate')?.value;
      if (expectedDeliveryDate) {
        this.setMaternityLeavePeriod(form, expectedDeliveryDate, isMultipleBirth || '');
      }
    });
    
    return form;
  }

  setMaternityLeavePeriod(form: FormGroup, expectedDeliveryDate: string, isMultipleBirth: string): void {
    if (!expectedDeliveryDate) {
      form.get('maternityLeaveStartDate')?.disable();
      form.get('maternityLeaveEndDate')?.disable();
      return;
    }
    
    const deliveryDate = new Date(expectedDeliveryDate);
    if (isNaN(deliveryDate.getTime())) {
      return;
    }
    
    // 産前休業開始日：双子以上が「はい」の場合は98日前、それ以外は42日前
    const daysBefore = isMultipleBirth === 'はい' ? 98 : 42;
    const preStartDate = new Date(deliveryDate);
    preStartDate.setDate(preStartDate.getDate() - daysBefore);
    
    // 産後休業終了日：出産予定日の55日後
    const postEndDate = new Date(deliveryDate);
    postEndDate.setDate(postEndDate.getDate() + 55);
    
    // 日付をYYYY-MM-DD形式に変換
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    form.get('maternityLeaveStartDate')?.enable();
    form.get('maternityLeaveEndDate')?.enable();
    form.get('maternityLeaveStartDate')?.setValue(formatDate(preStartDate));
    form.get('maternityLeaveEndDate')?.setValue(formatDate(postEndDate));
  }
  
  createResignationForm(): FormGroup {
    const form = this.fb.group({
      resignationDate: ['', [Validators.required, this.futureDateValidator]],
      lastWorkDate: ['', [Validators.required, this.lastWorkDateValidator.bind(this)]],
      resignationReason: ['', Validators.required], // 退職理由（必須）
      separationNotice: ['', Validators.required],
      postResignationAddress: [''],
      postResignationPhone: [''],
      postResignationEmail: [''],
      postResignationInsurance: ['', Validators.required]
    });
    
    // 退職日が変更されたときに、最終出社日の最大日付を更新
    form.get('resignationDate')?.valueChanges.subscribe(resignationDate => {
      if (resignationDate) {
        // 退職日の前日を計算
        const date = new Date(resignationDate);
        date.setDate(date.getDate() - 1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        this.maxLastWorkDate = `${year}-${month}-${day}`;
      } else {
        this.maxLastWorkDate = '';
      }
      // 最終出社日のバリデーションを再実行
      form.get('lastWorkDate')?.updateValueAndValidity();
    });
    
    return form;
  }
  
  // 最終出社日のバリデーター（退職日より前であることを確認）
  lastWorkDateValidator(control: any): { [key: string]: any } | null {
    if (!control.value) {
      return null; // requiredバリデーターで処理
    }
    
    const resignationDateControl = control.parent?.get('resignationDate');
    if (!resignationDateControl || !resignationDateControl.value) {
      return null; // 退職日が設定されていない場合はスキップ
    }
    
    const lastWorkDate = new Date(control.value);
    const resignationDate = new Date(resignationDateControl.value);
    
    if (lastWorkDate >= resignationDate) {
      return { 'lastWorkDateAfterResignation': true };
    }
    
    return null;
  }
  
  
  // 住所変更申請の海外在住チェックボックスの変更処理
  onAddressChangeOverseasResidentChange(event: any) {
    const isOverseas = event.target.checked;
    const form = this.addressChangeForm;
    
    const postalCodeControl = form.get('newPostalCode');
    const addressControl = form.get('newAddress');
    const addressKanaControl = form.get('newAddressKana');
    const overseasAddressControl = form.get('overseasAddress');
    
    if (isOverseas) {
      // 海外在住の場合：郵便番号、住所、住所（ヨミガナ）のバリデーションを削除
      postalCodeControl?.clearValidators();
      addressControl?.clearValidators();
      addressKanaControl?.clearValidators();
      // 海外住所のバリデーションを追加
      overseasAddressControl?.setValidators([Validators.required]);
      // 値をクリア
      postalCodeControl?.setValue('');
      addressControl?.setValue('');
      addressKanaControl?.setValue('');
    } else {
      // 国内在住の場合：郵便番号、住所のバリデーションを追加
      postalCodeControl?.setValidators([Validators.required, Validators.pattern(/^[0-9]{7}$/)]);
      addressControl?.setValidators([Validators.required]);
      // 海外住所のバリデーションを削除
      overseasAddressControl?.clearValidators();
      overseasAddressControl?.setValue('');
    }
    
    // バリデーションを更新
    postalCodeControl?.updateValueAndValidity();
    addressControl?.updateValueAndValidity();
    addressKanaControl?.updateValueAndValidity();
    overseasAddressControl?.updateValueAndValidity();
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
      
      this.addressChangeForm.patchValue({
        residentPostalCode: newPostalCode,
        residentAddress: newAddress,
        residentAddressKana: newAddressKana
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
    
    if (disabled) {
      residentPostalCodeControl?.clearValidators();
      residentAddressControl?.clearValidators();
      residentAddressKanaControl?.clearValidators();
      
      residentPostalCodeControl?.disable();
      residentAddressControl?.disable();
      residentAddressKanaControl?.disable();
    } else {
      residentPostalCodeControl?.enable();
      residentAddressControl?.enable();
      residentAddressKanaControl?.enable();
    }
    
    residentPostalCodeControl?.updateValueAndValidity();
    residentAddressControl?.updateValueAndValidity();
    residentAddressKanaControl?.updateValueAndValidity();
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
      postalCodeControl?.setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9]{7}$/)]);
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
  
  formatDependentPhoneNumber(event: any) {
    let value = event.target.value.replace(/[^a-zA-Z0-9]/g, ''); // 英数字以外を削除
    if (value.length > 11) {
      value = value.substring(0, 11); // 11桁に制限
    }
    event.target.value = value;
    this.dependentApplicationForm.get('phoneNumber')?.setValue(value, { emitEvent: false });
  }

  formatDependentPostalCode(event: any) {
    let value = event.target.value.replace(/[^a-zA-Z0-9]/g, ''); // 英数字以外を削除
    if (value.length > 7) {
      value = value.substring(0, 7); // 7桁に制限
    }
    event.target.value = value;
    this.dependentApplicationForm.get('postalCode')?.setValue(value, { emitEvent: false });
  }

  // ファイル名を取得するヘルパーメソッド（保存されたファイル名があればそれを使用、なければURLから抽出）
  getFileNameFromUrl(url: string, fileName?: string): string {
    if (fileName) {
      return fileName;
    }
    if (!url) return 'ファイル';
    try {
      // URLをデコードして、パスからファイル名を抽出
      const decodedUrl = decodeURIComponent(url);
      // クエリパラメータを除去
      const urlWithoutQuery = decodedUrl.split('?')[0];
      // パスの最後の部分を取得
      const pathParts = urlWithoutQuery.split('/');
      let extractedFileName = pathParts[pathParts.length - 1];
      // URLエンコードされた文字をデコード
      extractedFileName = decodeURIComponent(extractedFileName);
      // ファイル名が長すぎる場合は切り詰める
      if (extractedFileName.length > 50) {
        const extension = extractedFileName.substring(extractedFileName.lastIndexOf('.'));
        const nameWithoutExt = extractedFileName.substring(0, extractedFileName.lastIndexOf('.'));
        extractedFileName = nameWithoutExt.substring(0, 47) + '...' + extension;
      }
      return extractedFileName || 'ファイル';
    } catch (error) {
      return 'ファイル';
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
      this.isSubmittingDependentApplication = true;
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
        
        // 添付ファイルをアップロード
        let basicPensionNumberDocFileUrl = '';
        let basicPensionNumberDocFileName = '';
        let myNumberDocFileUrl = '';
        let myNumberDocFileName = '';
        let identityDocFileUrl = '';
        let identityDocFileName = '';
        let disabilityCardFileUrl = '';
        let disabilityCardFileName = '';
        
        if (this.dependentBasicPensionNumberDocFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentBasicPensionNumberDocFile.name);
          const basicPensionNumberDocPath = `applications/${this.employeeNumber}/dependentBasicPensionNumberDoc_${Date.now()}_${sanitizedFileName}`;
          basicPensionNumberDocFileUrl = await this.firestoreService.uploadFile(this.dependentBasicPensionNumberDocFile, basicPensionNumberDocPath);
          basicPensionNumberDocFileName = this.dependentBasicPensionNumberDocFile.name;
        }
        
        // マイナンバーカードをアップロード
        let myNumberCardFileUrl = '';
        let myNumberCardFileName = '';
        if (this.dependentMyNumberCardFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentMyNumberCardFile.name);
          const myNumberCardPath = `applications/${this.employeeNumber}/dependentMyNumberCard_${Date.now()}_${sanitizedFileName}`;
          myNumberCardFileUrl = await this.firestoreService.uploadFile(this.dependentMyNumberCardFile, myNumberCardPath);
          myNumberCardFileName = this.dependentMyNumberCardFile.name;
        }
        
        if (this.dependentMyNumberDocFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentMyNumberDocFile.name);
          const myNumberDocPath = `applications/${this.employeeNumber}/dependentMyNumberDoc_${Date.now()}_${sanitizedFileName}`;
          myNumberDocFileUrl = await this.firestoreService.uploadFile(this.dependentMyNumberDocFile, myNumberDocPath);
          myNumberDocFileName = this.dependentMyNumberDocFile.name;
        }
        
        if (this.dependentIdentityDocFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentIdentityDocFile.name);
          const identityDocPath = `applications/${this.employeeNumber}/dependentIdentityDoc_${Date.now()}_${sanitizedFileName}`;
          identityDocFileUrl = await this.firestoreService.uploadFile(this.dependentIdentityDocFile, identityDocPath);
          identityDocFileName = this.dependentIdentityDocFile.name;
        }
        
        if (this.dependentDisabilityCardFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentDisabilityCardFile.name);
          const disabilityCardPath = `applications/${this.employeeNumber}/dependentDisabilityCard_${Date.now()}_${sanitizedFileName}`;
          disabilityCardFileUrl = await this.firestoreService.uploadFile(this.dependentDisabilityCardFile, disabilityCardPath);
          disabilityCardFileName = this.dependentDisabilityCardFile.name;
        }
        
        // フォームデータを準備
        const formValue = this.dependentApplicationForm.value;
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '扶養家族追加',
          relationshipType: formValue.relationshipType,
          spouseType: formValue.spouseType || '',
          relationship: formValue.relationship || '',
          basicPensionNumber: basicPensionNumber || null,
          basicPensionNumberDocFileUrl: basicPensionNumberDocFileUrl,
          basicPensionNumberDocFileName: basicPensionNumberDocFileName,
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
          myNumberCardFileUrl: myNumberCardFileUrl,
          myNumberCardFile: myNumberCardFileName,
          myNumberDocFileUrl: myNumberDocFileUrl,
          myNumberDocFileName: myNumberDocFileName,
          myNumberNotProvidedReason: formValue.provideMyNumber === '提供しない' ? formValue.myNumberNotProvidedReason : '',
          identityDocFileUrl: identityDocFileUrl,
          identityDocFileName: identityDocFileName,
          disabilityCategory: formValue.disabilityCategory || '',
          disabilityCardType: formValue.disabilityCardType || '',
          disabilityCardIssueDate: formValue.disabilityCardIssueDate || '',
          disabilityCardFileUrl: disabilityCardFileUrl,
          disabilityCardFileName: disabilityCardFileName,
          livingTogether: formValue.livingTogether,
          postalCode: formValue.livingTogether === '別居' ? formValue.postalCode : '',
          address: formValue.livingTogether === '別居' ? formValue.address : '',
          addressKana: formValue.livingTogether === '別居' ? formValue.addressKana : '',
          addressChangeDate: formValue.livingTogether === '別居' ? formValue.addressChangeDate : ''
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 該当する申請要求を削除
        await this.deleteApplicationRequest('扶養家族追加');
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // 人事からの依頼を再読み込み
        await this.loadHrRequests();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      } finally {
        this.isSubmittingDependentApplication = false;
      }
    } else {
      // フォームのエラーを表示
      this.dependentApplicationForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async submitDependentRemovalApplication() {
    if (this.dependentRemovalForm.valid) {
      this.isSubmittingDependentRemovalApplication = true;
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
        
        // 該当する申請要求を削除
        await this.deleteApplicationRequest('扶養削除申請');
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // 人事からの依頼を再読み込み
        await this.loadHrRequests();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      } finally {
        this.isSubmittingDependentRemovalApplication = false;
      }
    } else {
      // フォームのエラーを表示
      this.dependentRemovalForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async submitAddressChangeApplication() {
    if (this.addressChangeForm.valid) {
      this.isSubmittingAddressChangeApplication = true;
      try {
        const formValue = this.addressChangeForm.value;
        
        // 住民票住所の値を決定
        let residentPostalCode = '';
        let residentAddress = '';
        let residentAddressKana = '';
        
        if (this.sameAsOldAddress) {
          // 変更前住所と同じ
          residentPostalCode = this.currentAddressInfo.postalCode || '';
          residentAddress = this.currentAddressInfo.address || '';
          residentAddressKana = this.currentAddressInfo.addressKana || '';
        } else if (this.sameAsNewAddress) {
          // 変更後の住所と同じ
          residentPostalCode = formValue.newPostalCode || '';
          residentAddress = formValue.newAddress || '';
          residentAddressKana = formValue.newAddressKana || '';
        } else {
          // 手動入力
          residentPostalCode = formValue.residentPostalCode || '';
          residentAddress = formValue.residentAddress || '';
          residentAddressKana = formValue.residentAddressKana || '';
        }
        
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '住所変更申請',
          moveDate: formValue.moveDate,
          isOverseasResident: formValue.isOverseasResident || false,
          newAddress: {
            postalCode: formValue.isOverseasResident ? '' : (formValue.newPostalCode || ''),
            address: formValue.isOverseasResident ? '' : (formValue.newAddress || ''),
            addressKana: formValue.isOverseasResident ? '' : (formValue.newAddressKana || ''),
            overseasAddress: formValue.isOverseasResident ? (formValue.overseasAddress || '') : ''
          },
          residentAddress: {
            sameAsOldAddress: this.sameAsOldAddress,
            sameAsNewAddress: this.sameAsNewAddress,
            postalCode: residentPostalCode,
            address: residentAddress,
            addressKana: residentAddressKana
          }
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 該当する申請要求を削除
        await this.deleteApplicationRequest('住所変更申請');
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // 人事からの依頼を再読み込み
        await this.loadHrRequests();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      } finally {
        this.isSubmittingAddressChangeApplication = false;
      }
    } else {
      // フォームのエラーを表示
      this.addressChangeForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async submitNameChangeApplication() {
    if (this.nameChangeForm.valid) {
      this.isSubmittingNameChangeApplication = true;
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
        
        // 本人確認書類をアップロード
        if (this.nameChangeIdDocumentFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.nameChangeIdDocumentFile.name);
          const idDocumentPath = `applications/${this.employeeNumber}/nameChangeIdDocument_${Date.now()}_${sanitizedFileName}`;
          const idDocumentUrl = await this.firestoreService.uploadFile(this.nameChangeIdDocumentFile, idDocumentPath);
          applicationData.idDocumentFile = this.nameChangeIdDocumentFile.name;
          applicationData.idDocumentFileUrl = idDocumentUrl;
        }
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 該当する申請要求を削除
        await this.deleteApplicationRequest('氏名変更申請');
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // 人事からの依頼を再読み込み
        await this.loadHrRequests();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      } finally {
        this.isSubmittingNameChangeApplication = false;
      }
    } else {
      // フォームのエラーを表示
      this.nameChangeForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async submitMyNumberChangeApplication() {
    if (this.myNumberChangeForm.valid) {
      this.isSubmittingMyNumberChangeApplication = true;
      try {
        const formValue = this.myNumberChangeForm.value;
        
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: 'マイナンバー変更申請',
          changeDate: formValue.changeDate,
          newMyNumber: {
            part1: formValue.newMyNumberPart1,
            part2: formValue.newMyNumberPart2,
            part3: formValue.newMyNumberPart3
          }
        };
        
        // マイナンバーカードをアップロード
        if (this.myNumberChangeCardFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.myNumberChangeCardFile.name);
          const myNumberCardPath = `applications/${this.employeeNumber}/myNumberChangeCard_${Date.now()}_${sanitizedFileName}`;
          const myNumberCardUrl = await this.firestoreService.uploadFile(this.myNumberChangeCardFile, myNumberCardPath);
          applicationData.myNumberCardFile = this.myNumberChangeCardFile.name;
          applicationData.myNumberCardFileUrl = myNumberCardUrl;
        }
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 該当する申請要求を削除
        await this.deleteApplicationRequest('マイナンバー変更申請');
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // 人事からの依頼を再読み込み
        await this.loadHrRequests();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      } finally {
        this.isSubmittingMyNumberChangeApplication = false;
      }
    } else {
      // フォームのエラーを表示
      this.myNumberChangeForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  async submitMaternityLeaveApplication() {
    if (this.maternityLeaveForm.valid) {
      this.isSubmittingMaternityLeaveApplication = true;
      try {
        const formValue = this.maternityLeaveForm.value;
        
        const applicationData: any = {
          employeeNumber: this.employeeNumber,
          applicationType: '産前産後休業申請',
          expectedDeliveryDate: formValue.expectedDeliveryDate,
          isMultipleBirth: formValue.isMultipleBirth,
          maternityLeaveStartDate: formValue.maternityLeaveStartDate || '',
          maternityLeaveEndDate: formValue.maternityLeaveEndDate || '',
          stayAddress: formValue.stayAddress || ''
        };
        
        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 該当する申請要求を削除
        await this.deleteApplicationRequest('産前産後休業申請');
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // 人事からの依頼を再読み込み
        await this.loadHrRequests();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      } finally {
        this.isSubmittingMaternityLeaveApplication = false;
      }
    } else {
      // フォームのエラーを表示
      this.maternityLeaveForm.markAllAsTouched();
      alert('必須項目を入力してください');
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
      this.isSubmittingResignationApplication = true;
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
        
        // 該当する申請要求を削除
        await this.deleteApplicationRequest('退職申請');
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // 人事からの依頼を再読み込み
        await this.loadHrRequests();
        
        // モーダルを閉じる
        this.closeApplicationModal();
        
        alert('申請しました');
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('申請中にエラーが発生しました');
      } finally {
        this.isSubmittingResignationApplication = false;
      }
    } else {
      // フォームのエラーを表示
      this.resignationForm.markAllAsTouched();
      alert('必須項目を入力してください');
    }
  }
  
  // 入社時申請を送信
  async submitOnboardingApplication() {
    // 既に申請中の場合は処理を中断
    if (this.isSubmittingOnboardingApplication) {
      return;
    }
    
    if (this.onboardingApplicationForm.valid) {
      this.isSubmittingOnboardingApplication = true;
      // フォームを無効化
      this.onboardingApplicationForm.disable();
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
          emergencyContact: (() => {
            const emergencyContact = formValue.emergencyContact || {};
            const sameAsCurrentAddressForEmergency = emergencyContact.sameAsCurrentAddressForEmergency || false;
            // 現住所と同じにチェックされている場合、現住所をコピー
            if (sameAsCurrentAddressForEmergency) {
              const isOverseasResident = formValue.isOverseasResident || false;
              if (isOverseasResident) {
                // 海外在住の場合はoverseasAddressを使用
                return {
                  ...emergencyContact,
                  address: formValue.overseasAddress || '',
                  addressKana: '' // 海外住所にはヨミガナがない
                };
              } else {
                // 国内在住の場合はcurrentAddressとcurrentAddressKanaを使用
                return {
                  ...emergencyContact,
                  address: formValue.currentAddress || '',
                  addressKana: formValue.currentAddressKana || ''
                };
              }
            }
            return emergencyContact;
          })(),
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

        // ファイルをアップロード（履歴書、職務経歴書、基礎年金番号書類、本人確認書類）
        if (this.resumeFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.resumeFile.name);
          const resumePath = `applications/${this.employeeNumber}/resume_${Date.now()}_${sanitizedFileName}`;
          const resumeUrl = await this.firestoreService.uploadFile(this.resumeFile, resumePath);
          applicationData.resumeFile = this.resumeFile.name;
          applicationData.resumeFileUrl = resumeUrl;
        }
        if (this.careerHistoryFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.careerHistoryFile.name);
          const careerHistoryPath = `applications/${this.employeeNumber}/careerHistory_${Date.now()}_${sanitizedFileName}`;
          const careerHistoryUrl = await this.firestoreService.uploadFile(this.careerHistoryFile, careerHistoryPath);
          applicationData.careerHistoryFile = this.careerHistoryFile.name;
          applicationData.careerHistoryFileUrl = careerHistoryUrl;
        }
        if (this.basicPensionNumberDocFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.basicPensionNumberDocFile.name);
          const basicPensionNumberDocPath = `applications/${this.employeeNumber}/basicPensionNumberDoc_${Date.now()}_${sanitizedFileName}`;
          const basicPensionNumberDocUrl = await this.firestoreService.uploadFile(this.basicPensionNumberDocFile, basicPensionNumberDocPath);
          applicationData.basicPensionNumberDocFile = this.basicPensionNumberDocFile.name;
          applicationData.basicPensionNumberDocFileUrl = basicPensionNumberDocUrl;
        }
        if (this.idDocumentFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.idDocumentFile.name);
          const idDocumentPath = `applications/${this.employeeNumber}/idDocument_${Date.now()}_${sanitizedFileName}`;
          const idDocumentUrl = await this.firestoreService.uploadFile(this.idDocumentFile, idDocumentPath);
          applicationData.idDocumentFile = this.idDocumentFile.name;
          applicationData.idDocumentFileUrl = idDocumentUrl;
        }
        if (this.myNumberCardFile) {
          const sanitizedFileName = this.firestoreService.sanitizeFileName(this.myNumberCardFile.name);
          const myNumberCardPath = `applications/${this.employeeNumber}/myNumberCard_${Date.now()}_${sanitizedFileName}`;
          const myNumberCardUrl = await this.firestoreService.uploadFile(this.myNumberCardFile, myNumberCardPath);
          applicationData.myNumberCardFile = this.myNumberCardFile.name;
          applicationData.myNumberCardFileUrl = myNumberCardUrl;
        }
        
        // 既存の申請データからファイルURLを保持（新しいファイルが選択されていない場合）
        // これは初回申請時には不要だが、再申請時に既存のファイルを保持するために必要
        const existingApplication = await this.firestoreService.getEmployeeApplicationsByType('入社時申請').then(apps => 
          apps.find((app: any) => app.employeeNumber === this.employeeNumber)
        );
        if (existingApplication) {
          if (!this.basicPensionNumberDocFile && existingApplication.basicPensionNumberDocFileUrl) {
            applicationData.basicPensionNumberDocFileUrl = existingApplication.basicPensionNumberDocFileUrl;
            applicationData.basicPensionNumberDocFile = existingApplication.basicPensionNumberDocFile || '';
          }
          if (!this.idDocumentFile && existingApplication.idDocumentFileUrl) {
            applicationData.idDocumentFileUrl = existingApplication.idDocumentFileUrl;
            applicationData.idDocumentFile = existingApplication.idDocumentFile || '';
          }
          if (!this.myNumberCardFile && existingApplication.myNumberCardFileUrl) {
            applicationData.myNumberCardFileUrl = existingApplication.myNumberCardFileUrl;
            applicationData.myNumberCardFile = existingApplication.myNumberCardFile || '';
          }
        }

        // 申請を保存
        await this.firestoreService.saveApplication(applicationData);
        
        // 該当する申請要求を削除
        await this.deleteApplicationRequest('入社時申請');
        
        // 入社時申請の情報を新入社員詳細情報に反映
        await this.updateOnboardingEmployeeDataFromApplication(applicationData);
        
        // 申請一覧を再読み込み
        await this.loadApplications();
        
        // 入社時申請の状態を更新
        this.hasOnboardingApplication = this.applications.some(
          (app: any) => app.applicationType === '入社時申請'
        );
        
        // 人事からの依頼を再読み込み（入社時申請メッセージを更新）
        await this.loadHrRequests();
        
        // 申請完了メッセージを表示
        alert('入社時申請を送信しました');
        
        // 申請フラグをリセットしてからモーダルを閉じる
        this.isSubmittingOnboardingApplication = false;
        // モーダルを強制的に閉じる
        this.showApplicationModal = false;
        this.currentApplicationType = '';
        // フォームを有効化（デバッグ用）
        this.onboardingApplicationForm.enable();
      } catch (error) {
        console.error('Error submitting onboarding application:', error);
        alert('申請の送信に失敗しました');
        // エラー時もフラグをリセット
        this.isSubmittingOnboardingApplication = false;
        this.onboardingApplicationForm.enable();
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

  
  async loadMainPageData() {
    try {
      // 自分の情報を読み込む
      const data = await this.firestoreService.getEmployeeData(this.employeeNumber);
      if (data) {
        this.employeeData = data;
      }

      // 入社処理が完了しているかチェック（新入社員コレクションに存在しないか）
      await this.checkOnboardingCompletion();

      // 申請一覧を読み込む
      await this.loadApplications();

      // 人事からの依頼を読み込む
      await this.loadHrRequests();
    } catch (error) {
      console.error('Error loading main page data:', error);
    }
  }

  // 入社処理が完了しているかチェック
  async checkOnboardingCompletion() {
    try {
      // 新入社員コレクションから自分のデータを取得
      const onboardingEmployee = await this.firestoreService.getOnboardingEmployee(this.employeeNumber);
      // 新入社員コレクションに存在しない場合、入社処理が完了している
      this.isOnboardingCompleted = !onboardingEmployee;
    } catch (error) {
      // エラーの場合も入社処理が完了しているとみなす（既に通常の社員データとして存在する可能性がある）
      console.error('Error checking onboarding completion:', error);
      this.isOnboardingCompleted = true;
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

      // Firestoreから申請要求を読み込む
      try {
        const applicationRequests = await this.firestoreService.getApplicationRequestsByEmployee(this.employeeNumber);
        for (const request of applicationRequests) {
          this.hrRequests.push({
            id: request.id,
            title: request.applicationType,
            date: request.requestedAt?.toDate ? request.requestedAt.toDate() : new Date(request.requestedAt || new Date()),
            message: request.message || `${request.applicationType}を行ってください`,
            applicationType: request.applicationType
          });
        }
      } catch (error) {
        console.error('Error loading application requests:', error);
      }
    } catch (error) {
      console.error('Error loading HR requests:', error);
    }
  }
  
  // 申請要求のステータスを更新するヘルパーメソッド（後方互換性のため残す）
  async updateApplicationRequestStatus(applicationType: string) {
    try {
      const pendingRequests = this.hrRequests.filter(req => 
        req.applicationType === applicationType && req.id
      );
      for (const request of pendingRequests) {
        if (request.id) {
          try {
            await this.firestoreService.updateApplicationRequestStatus(request.id, '対応済み');
          } catch (error) {
            console.error('Error updating application request status:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error updating application request status:', error);
    }
  }

  // 申請要求を削除するヘルパーメソッド
  async deleteApplicationRequest(applicationType: string) {
    try {
      const pendingRequests = this.hrRequests.filter(req => 
        req.applicationType === applicationType && req.id
      );
      for (const request of pendingRequests) {
        if (request.id) {
          try {
            await this.firestoreService.deleteApplicationRequest(request.id);
          } catch (error) {
            console.error('Error deleting application request:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting application request:', error);
    }
  }

  async loadApplications() {
    try {
      const applications = await this.firestoreService.getEmployeeApplications(this.employeeNumber);
      // FirestoreのTimestampをDateに変換
      const mappedApplications = applications.map((app: any) => {
        if (app.createdAt && typeof app.createdAt.toDate === 'function') {
          app.createdAt = app.createdAt.toDate();
        }
        return app;
      });
      
      // 承認済みと取り消しステータスの申請を下に表示するようにソート
      this.applications = mappedApplications.sort((a: any, b: any) => {
        const aIsApproved = a.status === '承認済み' || a.status === '承認';
        const bIsApproved = b.status === '承認済み' || b.status === '承認';
        const aIsCancelled = a.status === '取り消し';
        const bIsCancelled = b.status === '取り消し';
        
        // 取り消しステータスの申請は一番下に表示
        if (aIsCancelled && !bIsCancelled) {
          return 1; // aを後ろに
        }
        if (!aIsCancelled && bIsCancelled) {
          return -1; // bを後ろに
        }
        
        // 承認済みの申請は下に表示（取り消しよりは上）
        if (aIsApproved && !bIsApproved && !bIsCancelled) {
          return 1; // aを後ろに
        }
        if (!aIsApproved && bIsApproved && !aIsCancelled) {
          return -1; // bを後ろに
        }
        
        // どちらも承認済み、またはどちらも承認済みでない場合は、申請IDでソート（古い順）
        const idA = a.applicationId || 0;
        const idB = b.applicationId || 0;
        return idA - idB;
      });
      
      // 取り消しステータスの申請を一番下に移動
      const cancelledApplications = this.applications.filter((app: any) => app.status === '取り消し');
      const otherApplications = this.applications.filter((app: any) => app.status !== '取り消し');
      this.applications = [...otherApplications, ...cancelledApplications];
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

        // パスワードが設定されていない場合、社員番号を初期パスワードとして使用
        const expectedPassword = employeeData.password || employeeData.employeeNumber || '';
        
        if (currentPassword !== expectedPassword) {
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
    // ファイルをリセット
    this.resumeFile = null;
    this.careerHistoryFile = null;
    this.basicPensionNumberDocFile = null;
  }
  
  // 編集モードを有効にする
  enableEditMode() {
    if (this.selectedApplication && this.selectedApplication.status === '差し戻し') {
      // フォームを初期化してからデータをロード
      if (this.selectedApplication.applicationType === '扶養家族追加') {
        this.dependentApplicationForm = this.createDependentApplicationForm();
        this.loadApplicationDataToForm(this.selectedApplication);
        // フォームを有効化
        this.dependentApplicationForm.enable();
      } else if (this.selectedApplication.applicationType === '入社時申請') {
        // ファイルをリセット
        this.resumeFile = null;
        this.careerHistoryFile = null;
        this.basicPensionNumberDocFile = null;
        this.myNumberCardFile = null;
        this.onboardingApplicationForm = this.createOnboardingApplicationForm();
        this.loadApplicationDataToForm(this.selectedApplication);
        // フォームを有効化（姓・名・メールアドレスは編集不可のまま）
        this.onboardingApplicationForm.enable();
        this.onboardingApplicationForm.get('lastName')?.disable();
        this.onboardingApplicationForm.get('firstName')?.disable();
        this.onboardingApplicationForm.get('lastNameKana')?.disable();
        this.onboardingApplicationForm.get('firstNameKana')?.disable();
        this.onboardingApplicationForm.get('email')?.disable();
      } else if (this.selectedApplication.applicationType === '扶養削除申請') {
        this.dependentRemovalForm = this.createDependentRemovalForm();
        this.loadApplicationDataToForm(this.selectedApplication);
        // フォームを有効化
        this.dependentRemovalForm.enable();
      } else if (this.selectedApplication.applicationType === '住所変更申請') {
        this.addressChangeForm = this.createAddressChangeForm();
        this.loadApplicationDataToForm(this.selectedApplication);
        // フォームを有効化
        this.addressChangeForm.enable();
      } else if (this.selectedApplication.applicationType === '氏名変更申請') {
        this.nameChangeForm = this.createNameChangeForm();
        this.nameChangeIdDocumentFile = null; // Reset file input
        this.loadApplicationDataToForm(this.selectedApplication);
        // フォームを有効化
        this.nameChangeForm.enable();
      } else if (this.selectedApplication.applicationType === '産前産後休業申請') {
        this.maternityLeaveForm = this.createMaternityLeaveForm();
        this.loadApplicationDataToForm(this.selectedApplication);
        // フォームを有効化
        this.maternityLeaveForm.enable();
      } else if (this.selectedApplication.applicationType === '退職申請') {
        this.resignationForm = this.createResignationForm();
        this.loadApplicationDataToForm(this.selectedApplication);
        // フォームを有効化
        this.resignationForm.enable();
      } else if (this.selectedApplication.applicationType === 'マイナンバー変更申請') {
        this.myNumberChangeForm = this.createMyNumberChangeForm();
        this.myNumberChangeCardFile = null; // Reset file input
        this.loadApplicationDataToForm(this.selectedApplication);
        // フォームを有効化
        this.myNumberChangeForm.enable();
      }
      
      // 編集モードを有効化（フォーム初期化後に設定）
      this.isEditModeForReapplication = true;
      
      // 変更検知をトリガー
      this.cdr.detectChanges();
    }
  }
  
  // 申請データをフォームに読み込む
  loadApplicationDataToForm(application: any) {
    
    if (application.applicationType === '扶養家族追加') {
      // フォームは既に初期化されている前提（enableEditModeで初期化済み）
      if (!this.dependentApplicationForm) {
        this.dependentApplicationForm = this.createDependentApplicationForm();
      }
      
      // データをフォームに設定
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
      this.onRelationshipTypeChange();
      this.onProvideMyNumberChange();
      this.onLivingTogetherChange();
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
        isOverseasResident: application.isOverseasResident || false,
        postalCode: application.postalCode || '',
        currentAddress: application.currentAddress || '',
        currentAddressKana: application.currentAddressKana || '',
        overseasAddress: application.overseasAddress || '',
        phoneNumber: application.phoneNumber || '',
        sameAsCurrentAddress: application.sameAsCurrentAddress || false,
        skipResidentAddress: application.skipResidentAddress || false,
        residentAddressSkipReason: application.residentAddressSkipReason || '',
        residentAddressSkipReasonOther: application.residentAddressSkipReasonOther || '',
        residentPostalCode: application.residentPostalCode || '',
        residentAddress: application.residentAddress || '',
        residentAddressKana: application.residentAddressKana || '',
        basicPensionNumberPart1: basicPensionNumberPart1,
        basicPensionNumberPart2: basicPensionNumberPart2,
        pensionHistoryStatus: application.pensionHistoryStatus || '',
        pensionHistory: application.pensionHistory || '',
        dependentStatus: application.dependentStatus || '',
        qualificationCertificateRequired: application.qualificationCertificateRequired || '',
        pensionFundMembership: application.pensionFundMembership || '',
      });
      
      // ネストされたフォームグループを個別に設定
      const emergencyContactGroup = this.onboardingApplicationForm.get('emergencyContact') as FormGroup;
      if (emergencyContactGroup && application.emergencyContact) {
        emergencyContactGroup.patchValue({
          sameAsCurrentAddressForEmergency: application.sameAsCurrentAddressForEmergency || false,
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
      
      // 海外在住の場合の処理
      if (application.isOverseasResident) {
        this.onOverseasResidentChange({ target: { checked: true } });
      }
      
      // 住民票住所を記載しない場合の処理
      if (application.skipResidentAddress) {
        this.onSkipResidentAddressChange({ target: { checked: true } });
      }
      
      // 緊急連絡先が現住所と同じ場合の処理
      if (application.sameAsCurrentAddressForEmergency) {
        const emergencyContactGroup = this.onboardingApplicationForm.get('emergencyContact') as FormGroup;
        if (emergencyContactGroup) {
          emergencyContactGroup.patchValue({
            sameAsCurrentAddressForEmergency: true
          });
        }
        this.onSameAsCurrentAddressForEmergencyChange({ target: { checked: true } });
      }
      
      // 住民票住所が現住所と同じ場合の処理
      if (application.sameAsCurrentAddress) {
        this.onOnboardingSameAddressChange({ target: { checked: true } });
      }
      
      // 氏名とメールアドレスを編集不可にする
      this.onboardingApplicationForm.get('lastName')?.disable();
      this.onboardingApplicationForm.get('firstName')?.disable();
      this.onboardingApplicationForm.get('email')?.disable();
      
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
      this.sameAsOldAddress = application.residentAddress?.sameAsOldAddress || false;
      this.sameAsNewAddress = application.residentAddress?.sameAsNewAddress || false;
      
      this.addressChangeForm.patchValue({
        moveDate: application.moveDate || '',
        isOverseasResident: application.isOverseasResident || false,
        newPostalCode: application.newAddress?.postalCode || '',
        newAddress: application.newAddress?.address || '',
        newAddressKana: application.newAddress?.addressKana || '',
        overseasAddress: application.newAddress?.overseasAddress || '',
        residentPostalCode: application.residentAddress?.postalCode || '',
        residentAddress: application.residentAddress?.address || '',
        residentAddressKana: application.residentAddress?.addressKana || ''
      });
      
      // 海外在住の場合、バリデーションを更新
      if (application.isOverseasResident) {
        this.onAddressChangeOverseasResidentChange({ target: { checked: true } });
      }
      
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
      this.nameChangeIdDocumentFile = null; // ファイルをリセット
      this.nameChangeForm.patchValue({
        changeDate: application.changeDate || '',
        newLastName: application.newName?.lastName || '',
        newFirstName: application.newName?.firstName || '',
        newLastNameKana: application.newName?.lastNameKana || '',
        newFirstNameKana: application.newName?.firstNameKana || ''
      });
    } else if (application.applicationType === '産前産後休業申請') {
      // フォームは既に初期化されている前提（enableEditModeで初期化済み）
      if (!this.maternityLeaveForm) {
        this.maternityLeaveForm = this.createMaternityLeaveForm();
      }
      
      this.maternityLeaveForm.patchValue({
        expectedDeliveryDate: application.expectedDeliveryDate || '',
        isMultipleBirth: application.isMultipleBirth || '',
        maternityLeaveStartDate: application.maternityLeaveStartDate || application.preMaternityLeaveStartDate || '',
        maternityLeaveEndDate: application.maternityLeaveEndDate || application.postMaternityLeaveEndDate || '',
        stayAddress: application.stayAddress || ''
      });
      
      // バリデーションを再実行
      this.maternityLeaveForm.updateValueAndValidity();
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
      
      // バリデーションを再実行
      this.resignationForm.updateValueAndValidity();
    } else if (application.applicationType === 'マイナンバー変更申請') {
      // フォームは既に初期化されている前提（enableEditModeで初期化済み）
      if (!this.myNumberChangeForm) {
        this.myNumberChangeForm = this.createMyNumberChangeForm();
      }
      
      // データをフォームに設定
      this.myNumberChangeForm.patchValue({
        changeDate: application.changeDate || '',
        newMyNumberPart1: application.newMyNumber?.part1 || '',
        newMyNumberPart2: application.newMyNumber?.part2 || '',
        newMyNumberPart3: application.newMyNumber?.part3 || ''
      });
      
      // バリデーションを更新
      this.myNumberChangeForm.updateValueAndValidity();
    }
  }
  
  // 再申請を送信
  async submitReapplication() {
    if (!this.selectedApplication) {
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
        formValid = this.dependentApplicationForm?.valid || false;
        
        if (formValid) {
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
          
          // 添付ファイルをアップロード（新しいファイルが選択された場合のみ）
          let basicPensionNumberDocFileUrl = this.selectedApplication.basicPensionNumberDocFileUrl || '';
          let basicPensionNumberDocFileName = this.selectedApplication.basicPensionNumberDocFileName || '';
          let myNumberCardFileUrl = this.selectedApplication.myNumberCardFileUrl || '';
          let myNumberCardFileName = this.selectedApplication.myNumberCardFile || '';
          let myNumberDocFileUrl = this.selectedApplication.myNumberDocFileUrl || '';
          let myNumberDocFileName = this.selectedApplication.myNumberDocFileName || '';
          let identityDocFileUrl = this.selectedApplication.identityDocFileUrl || '';
          let identityDocFileName = this.selectedApplication.identityDocFileName || '';
          let disabilityCardFileUrl = this.selectedApplication.disabilityCardFileUrl || '';
          let disabilityCardFileName = this.selectedApplication.disabilityCardFileName || '';
          
          if (this.dependentMyNumberCardFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentMyNumberCardFile.name);
            const myNumberCardPath = `applications/${this.employeeNumber}/dependentMyNumberCard_${Date.now()}_${sanitizedFileName}`;
            myNumberCardFileUrl = await this.firestoreService.uploadFile(this.dependentMyNumberCardFile, myNumberCardPath);
            myNumberCardFileName = this.dependentMyNumberCardFile.name;
          }
          
          if (this.dependentBasicPensionNumberDocFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentBasicPensionNumberDocFile.name);
            const basicPensionNumberDocPath = `applications/${this.employeeNumber}/dependentBasicPensionNumberDoc_${Date.now()}_${sanitizedFileName}`;
            basicPensionNumberDocFileUrl = await this.firestoreService.uploadFile(this.dependentBasicPensionNumberDocFile, basicPensionNumberDocPath);
            basicPensionNumberDocFileName = this.dependentBasicPensionNumberDocFile.name;
          }
          
          if (this.dependentMyNumberDocFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentMyNumberDocFile.name);
            const myNumberDocPath = `applications/${this.employeeNumber}/dependentMyNumberDoc_${Date.now()}_${sanitizedFileName}`;
            myNumberDocFileUrl = await this.firestoreService.uploadFile(this.dependentMyNumberDocFile, myNumberDocPath);
            myNumberDocFileName = this.dependentMyNumberDocFile.name;
          }
          
          if (this.dependentIdentityDocFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentIdentityDocFile.name);
            const identityDocPath = `applications/${this.employeeNumber}/dependentIdentityDoc_${Date.now()}_${sanitizedFileName}`;
            identityDocFileUrl = await this.firestoreService.uploadFile(this.dependentIdentityDocFile, identityDocPath);
            identityDocFileName = this.dependentIdentityDocFile.name;
          }
          
          if (this.dependentDisabilityCardFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.dependentDisabilityCardFile.name);
            const disabilityCardPath = `applications/${this.employeeNumber}/dependentDisabilityCard_${Date.now()}_${sanitizedFileName}`;
            disabilityCardFileUrl = await this.firestoreService.uploadFile(this.dependentDisabilityCardFile, disabilityCardPath);
            disabilityCardFileName = this.dependentDisabilityCardFile.name;
          }
          
          const formValue = this.dependentApplicationForm.value;
          applicationData = {
            ...formValue,
            basicPensionNumber: basicPensionNumber || null,
            basicPensionNumberDocFileUrl: basicPensionNumberDocFileUrl,
            basicPensionNumberDocFileName: basicPensionNumberDocFileName,
            myNumber: formValue.provideMyNumber === '提供する' ? myNumber : null,
            myNumberCardFileUrl: myNumberCardFileUrl,
            myNumberCardFile: myNumberCardFileName,
            myNumberDocFileUrl: myNumberDocFileUrl,
            myNumberDocFileName: myNumberDocFileName,
            identityDocFileUrl: identityDocFileUrl,
            identityDocFileName: identityDocFileName,
            disabilityCardFileUrl: disabilityCardFileUrl,
            disabilityCardFileName: disabilityCardFileName,
            employeeNumber: this.employeeNumber,
            applicationType: '扶養家族追加'
          };
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
          
          if (this.sameAsOldAddress) {
            // 変更前住所と同じ
            residentPostalCode = this.currentAddressInfo.postalCode || '';
            residentAddress = this.currentAddressInfo.address || '';
            residentAddressKana = this.currentAddressInfo.addressKana || '';
          } else if (this.sameAsNewAddress) {
            // 変更後の住所と同じ
            residentPostalCode = formValue.isOverseasResident ? '' : (formValue.newPostalCode || '');
            residentAddress = formValue.isOverseasResident ? '' : (formValue.newAddress || '');
            residentAddressKana = formValue.isOverseasResident ? '' : (formValue.newAddressKana || '');
          } else {
            // 手動入力
            residentPostalCode = formValue.residentPostalCode || '';
            residentAddress = formValue.residentAddress || '';
            residentAddressKana = formValue.residentAddressKana || '';
          }
          
          applicationData = {
            employeeNumber: this.employeeNumber,
            applicationType: '住所変更申請',
            moveDate: formValue.moveDate,
            isOverseasResident: formValue.isOverseasResident || false,
            newAddress: {
              postalCode: formValue.isOverseasResident ? '' : (formValue.newPostalCode || ''),
              address: formValue.isOverseasResident ? '' : (formValue.newAddress || ''),
              addressKana: formValue.isOverseasResident ? '' : (formValue.newAddressKana || ''),
              overseasAddress: formValue.isOverseasResident ? (formValue.overseasAddress || '') : ''
            },
            residentAddress: {
              sameAsOldAddress: this.sameAsOldAddress,
              sameAsNewAddress: this.sameAsNewAddress,
              postalCode: residentPostalCode,
              address: residentAddress,
              addressKana: residentAddressKana
            }
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
            hasIdDocument: !!this.nameChangeIdDocumentFile || !!this.selectedApplication.idDocumentFileUrl,
            employeeNumber: this.employeeNumber,
            applicationType: '氏名変更申請'
          };
          
          // 本人確認書類をアップロード（新しいファイルが選択された場合のみ）
          if (this.nameChangeIdDocumentFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.nameChangeIdDocumentFile.name);
            const idDocumentPath = `applications/${this.employeeNumber}/nameChangeIdDocument_${Date.now()}_${sanitizedFileName}`;
            const idDocumentUrl = await this.firestoreService.uploadFile(this.nameChangeIdDocumentFile, idDocumentPath);
            applicationData.idDocumentFile = this.nameChangeIdDocumentFile.name;
            applicationData.idDocumentFileUrl = idDocumentUrl;
          } else if (this.selectedApplication.idDocumentFileUrl) {
            // 既存のファイルURLを保持
            applicationData.idDocumentFileUrl = this.selectedApplication.idDocumentFileUrl;
            applicationData.idDocumentFile = this.selectedApplication.idDocumentFile || '';
          }
          
          // マイナンバーカードをアップロード
          if (this.myNumberChangeCardFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.myNumberChangeCardFile.name);
            const myNumberCardPath = `applications/${this.employeeNumber}/myNumberChangeCard_${Date.now()}_${sanitizedFileName}`;
            const myNumberCardUrl = await this.firestoreService.uploadFile(this.myNumberChangeCardFile, myNumberCardPath);
            applicationData.myNumberCardFile = this.myNumberChangeCardFile.name;
            applicationData.myNumberCardFileUrl = myNumberCardUrl;
          } else if (this.selectedApplication.myNumberCardFileUrl) {
            // 既存のファイルURLを保持
            applicationData.myNumberCardFileUrl = this.selectedApplication.myNumberCardFileUrl;
            applicationData.myNumberCardFile = this.selectedApplication.myNumberCardFile || '';
          }
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
            lastName: formValue.lastName,
            firstName: formValue.firstName,
            lastNameKana: formValue.lastNameKana,
            firstNameKana: formValue.firstNameKana,
            name: (formValue.lastName || '') + (formValue.firstName || ''),
            nameKana: (formValue.lastNameKana || '') + (formValue.firstNameKana || ''),
            birthDate: formValue.birthDate,
            gender: formValue.gender,
            email: formValue.email,
            myNumber: myNumber || null,
            isOverseasResident: formValue.isOverseasResident || false,
            postalCode: formValue.postalCode || '',
            currentAddress: formValue.currentAddress || '',
            currentAddressKana: formValue.currentAddressKana || '',
            overseasAddress: formValue.overseasAddress || '',
            phoneNumber: formValue.phoneNumber || '',
            currentHouseholdHead: formValue.currentHouseholdHead || '',
            sameAsCurrentAddress: formValue.sameAsCurrentAddress || false,
            skipResidentAddress: formValue.skipResidentAddress || false,
            residentAddressSkipReason: formValue.residentAddressSkipReason || '',
            residentAddressSkipReasonOther: formValue.residentAddressSkipReasonOther || '',
            residentPostalCode: formValue.residentPostalCode || '',
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
            sameAsCurrentAddressForEmergency: formValue.sameAsCurrentAddressForEmergency || false,
            pensionFundMembership: formValue.pensionFundMembership || '',
            employeeNumber: this.employeeNumber,
            applicationType: '入社時申請'
          };
          
          // ファイルアップロード処理
          if (this.resumeFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.resumeFile.name);
            const resumePath = `applications/${this.employeeNumber}/resume_${Date.now()}_${sanitizedFileName}`;
            const resumeUrl = await this.firestoreService.uploadFile(this.resumeFile, resumePath);
            applicationData.resumeFile = this.resumeFile.name;
            applicationData.resumeFileUrl = resumeUrl;
          } else if (this.selectedApplication.resumeFileUrl) {
            // 既存のファイルURLを保持
            applicationData.resumeFileUrl = this.selectedApplication.resumeFileUrl;
          }
          
          if (this.careerHistoryFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.careerHistoryFile.name);
            const careerHistoryPath = `applications/${this.employeeNumber}/careerHistory_${Date.now()}_${sanitizedFileName}`;
            const careerHistoryUrl = await this.firestoreService.uploadFile(this.careerHistoryFile, careerHistoryPath);
            applicationData.careerHistoryFile = this.careerHistoryFile.name;
            applicationData.careerHistoryFileUrl = careerHistoryUrl;
          } else if (this.selectedApplication.careerHistoryFileUrl) {
            // 既存のファイルURLを保持
            applicationData.careerHistoryFileUrl = this.selectedApplication.careerHistoryFileUrl;
          }
          
          if (this.basicPensionNumberDocFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.basicPensionNumberDocFile.name);
            const basicPensionNumberDocPath = `applications/${this.employeeNumber}/basicPensionNumberDoc_${Date.now()}_${sanitizedFileName}`;
            const basicPensionNumberDocUrl = await this.firestoreService.uploadFile(this.basicPensionNumberDocFile, basicPensionNumberDocPath);
            applicationData.basicPensionNumberDocFile = this.basicPensionNumberDocFile.name;
            applicationData.basicPensionNumberDocFileUrl = basicPensionNumberDocUrl;
          } else if (this.selectedApplication.basicPensionNumberDocFileUrl) {
            // 既存のファイルURLを保持
            applicationData.basicPensionNumberDocFileUrl = this.selectedApplication.basicPensionNumberDocFileUrl;
          }
          
          if (this.idDocumentFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.idDocumentFile.name);
            const idDocumentPath = `applications/${this.employeeNumber}/idDocument_${Date.now()}_${sanitizedFileName}`;
            const idDocumentUrl = await this.firestoreService.uploadFile(this.idDocumentFile, idDocumentPath);
            applicationData.idDocumentFile = this.idDocumentFile.name;
            applicationData.idDocumentFileUrl = idDocumentUrl;
          } else if (this.selectedApplication.idDocumentFileUrl) {
            // 既存のファイルURLを保持
            applicationData.idDocumentFileUrl = this.selectedApplication.idDocumentFileUrl;
          }
          
          // マイナンバーカードをアップロード
          if (this.myNumberCardFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.myNumberCardFile.name);
            const myNumberCardPath = `applications/${this.employeeNumber}/myNumberCard_${Date.now()}_${sanitizedFileName}`;
            const myNumberCardUrl = await this.firestoreService.uploadFile(this.myNumberCardFile, myNumberCardPath);
            applicationData.myNumberCardFile = this.myNumberCardFile.name;
            applicationData.myNumberCardFileUrl = myNumberCardUrl;
          } else if (this.selectedApplication.myNumberCardFileUrl) {
            // 既存のファイルURLを保持
            applicationData.myNumberCardFileUrl = this.selectedApplication.myNumberCardFileUrl;
            applicationData.myNumberCardFile = this.selectedApplication.myNumberCardFile || '';
          }
        }
      } else if (this.selectedApplication.applicationType === '産前産後休業申請') {
        formValid = this.maternityLeaveForm.valid;
        if (formValid) {
          const formValue = this.maternityLeaveForm.value;
          applicationData = {
            expectedDeliveryDate: formValue.expectedDeliveryDate,
            isMultipleBirth: formValue.isMultipleBirth,
            maternityLeaveStartDate: formValue.maternityLeaveStartDate || '',
            maternityLeaveEndDate: formValue.maternityLeaveEndDate || '',
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
      } else if (this.selectedApplication.applicationType === 'マイナンバー変更申請') {
        formValid = this.myNumberChangeForm?.valid || false;
        if (formValid) {
          const formValue = this.myNumberChangeForm.value;
          applicationData = {
            changeDate: formValue.changeDate,
            newMyNumber: {
              part1: formValue.newMyNumberPart1,
              part2: formValue.newMyNumberPart2,
              part3: formValue.newMyNumberPart3
            },
            employeeNumber: this.employeeNumber,
            applicationType: 'マイナンバー変更申請'
          };
          
          // マイナンバーカードをアップロード
          if (this.myNumberChangeCardFile) {
            const sanitizedFileName = this.firestoreService.sanitizeFileName(this.myNumberChangeCardFile.name);
            const myNumberCardPath = `applications/${this.employeeNumber}/myNumberChangeCard_${Date.now()}_${sanitizedFileName}`;
            const myNumberCardUrl = await this.firestoreService.uploadFile(this.myNumberChangeCardFile, myNumberCardPath);
            applicationData.myNumberCardFile = this.myNumberChangeCardFile.name;
            applicationData.myNumberCardFileUrl = myNumberCardUrl;
          } else if (this.selectedApplication.myNumberCardFileUrl) {
            // 既存のファイルURLを保持
            applicationData.myNumberCardFileUrl = this.selectedApplication.myNumberCardFileUrl;
            applicationData.myNumberCardFile = this.selectedApplication.myNumberCardFile || '';
          }
        }
      }
      
      if (!formValid) {
        if (this.selectedApplication.applicationType === '扶養家族追加' && this.dependentApplicationForm) {
          this.dependentApplicationForm.markAllAsTouched();
        } else if (this.selectedApplication.applicationType === '入社時申請' && this.onboardingApplicationForm) {
          this.onboardingApplicationForm.markAllAsTouched();
        } else if (this.selectedApplication.applicationType === '氏名変更申請' && this.nameChangeForm) {
          this.nameChangeForm.markAllAsTouched();
        } else if (this.selectedApplication.applicationType === '住所変更申請' && this.addressChangeForm) {
          this.addressChangeForm.markAllAsTouched();
        } else if (this.selectedApplication.applicationType === 'マイナンバー変更申請' && this.myNumberChangeForm) {
          this.myNumberChangeForm.markAllAsTouched();
        } else if (this.selectedApplication.applicationType === '産前産後休業申請' && this.maternityLeaveForm) {
          this.maternityLeaveForm.markAllAsTouched();
        } else if (this.selectedApplication.applicationType === '退職申請' && this.resignationForm) {
          this.resignationForm.markAllAsTouched();
        }
        alert('必須項目を入力してください');
        this.isSubmittingReapplication = false;
        return;
      }
      
      // 再申請として保存（入社時申請は「申請済み」、それ以外は「承認待ち」に設定）
      const newStatus = this.selectedApplication.applicationType === '入社時申請' ? '申請済み' : '承認待ち';
      await this.firestoreService.resubmitApplication(this.selectedApplication.id, applicationData, newStatus);
      
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

  // 住所変更申請の郵便番号フォーマット（数字7桁のみ）
  formatAddressPostalCode(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 7) {
      value = value.substring(0, 7);
    }
    event.target.value = value;
    const control = this.addressChangeForm.get('newPostalCode');
    if (control) {
      control.setValue(value, { emitEvent: false });
    }
  }

  // 住所変更申請の住民票住所の郵便番号フォーマット（数字7桁のみ）
  formatResidentPostalCodeForAddressChange(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 7) {
      value = value.substring(0, 7);
    }
    event.target.value = value;
    const control = this.addressChangeForm.get('residentPostalCode');
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

  // 緊急連絡先電話番号フォーマット（数字のみ、最大11桁）
  formatEmergencyPhoneNumber(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    // 最大11桁に制限
    if (value.length > 11) {
      value = value.substring(0, 11);
    }
    event.target.value = value;
    const control = this.onboardingApplicationForm.get('emergencyContact.phone');
    if (control) {
      control.setValue(value, { emitEvent: false });
    }
  }

  // 口座番号入力時の処理（半角数字のみ許可）
  formatAccountNumber(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    event.target.value = value;
    const control = this.onboardingApplicationForm.get('bankAccount.accountNumber');
    if (control) {
      control.setValue(value, { emitEvent: false });
    }
  }

  // 緊急連絡先の現住所と同じチェック変更時の処理
  onSameAsCurrentAddressForEmergencyChange(event: any) {
    const isSame = event.target.checked;
    const isOverseas = this.onboardingApplicationForm.get('isOverseasResident')?.value;
    const emergencyAddressControl = this.onboardingApplicationForm.get('emergencyContact.address');
    const emergencyAddressKanaControl = this.onboardingApplicationForm.get('emergencyContact.addressKana');

    if (isSame) {
      if (isOverseas) {
        // 海外に在住の場合、海外住所をコピー
        const overseasAddress = this.onboardingApplicationForm.get('overseasAddress')?.value || '';
        emergencyAddressControl?.setValue(overseasAddress);
        // 住所（ヨミガナ）は設定しない（表示しないため）
        emergencyAddressKanaControl?.setValue('');
      } else {
        // 国内在住の場合、現住所をコピー
        const currentAddress = this.onboardingApplicationForm.get('currentAddress')?.value || '';
        const currentAddressKana = this.onboardingApplicationForm.get('currentAddressKana')?.value || '';
        emergencyAddressControl?.setValue(currentAddress);
        emergencyAddressKanaControl?.setValue(currentAddressKana);
      }
      // 緊急連絡先住所フィールドを無効化
      emergencyAddressControl?.disable();
      emergencyAddressKanaControl?.disable();
    } else {
      // 緊急連絡先住所フィールドを有効化
      emergencyAddressControl?.enable();
      emergencyAddressKanaControl?.enable();
      // チェックを外した場合、値をクリア
      emergencyAddressControl?.setValue('');
      emergencyAddressKanaControl?.setValue('');
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

  // チャット機能のメソッド
  async sendChatMessage() {
    if (!this.chatInputMessage.trim() || this.isChatLoading) {
      return;
    }

    const userMessage = this.chatInputMessage.trim();
    this.chatInputMessage = '';
    
    // ユーザーメッセージを表示
    this.chatMessages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    this.isChatLoading = true;

    try {
      const response = await this.chatService.sendMessage(userMessage);
      
      // 応答から申請タイプを抽出
      const applicationType = this.extractApplicationType(userMessage, response);
      
      // アシスタントの応答を表示
      this.chatMessages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        applicationType: applicationType
      });
    } catch (error: any) {
      console.error('Error sending chat message:', error);
      this.chatMessages.push({
        role: 'assistant',
        content: '申し訳ございません。エラーが発生しました。もう一度お試しください。',
        timestamp: new Date()
      });
    } finally {
      this.isChatLoading = false;
    }
  }

  clearChat() {
    this.chatMessages = [];
    this.chatService.clearConversationHistory();
  }

  onChatInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }

  // テンプレート質問を送信
  sendTemplateQuestion(question: string) {
    this.chatInputMessage = question;
    this.sendChatMessage();
  }

  // メッセージから申請タイプを抽出
  extractApplicationType(userMessage: string, assistantResponse: string): string | undefined {
    const message = (userMessage + ' ' + assistantResponse).toLowerCase();
    
    // 申請タイプのマッピング
    if (message.includes('結婚') || message.includes('配偶者') || 
        (message.includes('扶養') && message.includes('追加')) ||
        message.includes('子供が生まれた') || message.includes('子どもが生まれた')) {
      return '扶養家族追加';
    }
    if (message.includes('引越') || message.includes('引っ越し') || 
        message.includes('住所変更') || message.includes('転居')) {
      return '住所変更申請';
    }
    if (message.includes('改名') || message.includes('氏名変更') || 
        message.includes('名前を変更')) {
      return '氏名変更申請';
    }
    if (message.includes('産休') || message.includes('育休') || 
        message.includes('産前産後') || message.includes('産前産後休業')) {
      return '産前産後休業申請';
    }
    if (message.includes('退職')) {
      return '退職申請';
    }
    if (message.includes('扶養') && message.includes('削除')) {
      return '扶養削除申請';
    }
    
    return undefined;
  }

  // 申請モーダルを開く（チャットから）
  openApplicationFromChat(applicationType: string) {
    this.openApplicationModal(applicationType);
  }
}

