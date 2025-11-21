import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
    { id: 'settings', name: '情報設定' },
    { id: 'insurance', name: '保険・扶養' },
    { id: 'application', name: '各種申請' },
    { id: 'knowledge', name: 'ナレッジ' }
  ];

  // 社員情報（セッションストレージから取得）
  employeeNumber = '';
  employeeName = '';

  // メインページ用データ
  employeeData: any = null;
  hrRequests: any[] = [];
  applications: any[] = [];
  
  // 申請モーダル用
  showApplicationModal = false;
  currentApplicationType = '';
  dependentApplicationForm!: FormGroup;
  
  // 申請詳細モーダル用
  showApplicationDetailModal = false;
  selectedApplication: any = null;
  
  // 保険・扶養ページ用データ
  insuranceData: any = {
    healthInsuranceType: '未設定',
    nursingInsuranceType: '未設定',
    pensionInsuranceType: '未設定'
  };
  dependentsData: any[] = [];

  // フォーム
  settingsForm: FormGroup;
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
  genders = ['男性', '女性', 'その他'];
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
    // 扶養家族追加申請フォームを初期化
    this.dependentApplicationForm = this.createDependentApplicationForm();
    
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
            myNumber: dep.myNumber || '',
            address: dep.address || '',
            notes: dep.notes || ''
          }));
        } else {
          this.dependentsData = [];
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
    }
  }

  populateForm(data: any) {
    // マイナンバーを分割
    if (data.myNumber && data.myNumber.length === 12) {
      this.settingsForm.patchValue({
        myNumberPart1: data.myNumber.substring(0, 4),
        myNumberPart2: data.myNumber.substring(4, 8),
        myNumberPart3: data.myNumber.substring(8, 12)
      });
    }

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

  createForm(): FormGroup {
    return this.fb.group({
      // 基本情報
      name: ['', Validators.required],
      nameKana: [''],
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
    event.target.value = value;
    this.settingsForm.get(`myNumberPart${part}`)?.setValue(value);
    
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
    if (applicationType === '扶養家族追加') {
      this.dependentApplicationForm = this.createDependentApplicationForm();
      this.showApplicationModal = true;
    } else {
      // 他の申請タイプは今後実装
      alert(`${applicationType}の申請フォームを開きます（実装予定）`);
    }
  }
  
  closeApplicationModal() {
    this.showApplicationModal = false;
    this.currentApplicationType = '';
    this.dependentApplicationForm = this.createDependentApplicationForm();
    // ファイルをリセット
    this.dependentBasicPensionNumberDocFile = null;
    this.dependentMyNumberDocFile = null;
    this.dependentIdentityDocFile = null;
    this.dependentDisabilityCardFile = null;
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

  async loadMainPageData() {
    try {
      // 自分の情報を読み込む
      const data = await this.firestoreService.getEmployeeData(this.employeeNumber);
      if (data) {
        this.employeeData = data;
      }

      // 人事からの依頼を読み込む（TODO: 実装予定）
      this.hrRequests = [];

      // 申請一覧を読み込む
      await this.loadApplications();
    } catch (error) {
      console.error('Error loading main page data:', error);
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
  }
  
  closeApplicationDetailModal() {
    this.showApplicationDetailModal = false;
    this.selectedApplication = null;
  }
  
  formatMyNumberForDisplay(myNumber: string | null): string {
    if (!myNumber || myNumber.length !== 12) {
      return '-';
    }
    return `${myNumber.substring(0, 4)}-${myNumber.substring(4, 8)}-${myNumber.substring(8, 12)}`;
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
}

