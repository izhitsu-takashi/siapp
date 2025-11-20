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

  // フォーム
  settingsForm: FormGroup;
  showMyNumber = false;
  hasPensionHistory = false;
  isSaving = false;
  isEditMode = false;
  sameAsCurrentAddress = false;
  hasSpouse = false;
  age: number | null = null;

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
      
      this.loadEmployeeData();
    }
  }

  async loadEmployeeData() {
    try {
      const data = await this.firestoreService.getEmployeeData(this.employeeNumber);
      if (data) {
        this.populateForm(data);
      }
      // データ読み込み後、編集モードでない場合はフォームを無効化
      if (!this.isEditMode) {
        this.disableFormControls();
      }
    } catch (error) {
      console.error('Error loading employee data:', error);
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
        this.settingsForm.patchValue({
          residentAddress: data.currentAddress,
          residentAddressKana: data.currentAddressKana || '',
          residentHouseholdHead: data.currentHouseholdHead || ''
        });
      }
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

  onSpouseStatusChange(event: any) {
    this.hasSpouse = event.target.value === '有';
    if (!this.hasSpouse) {
      this.settingsForm.get('spouseAnnualIncome')?.setValue('');
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
      idDocument: [''], // 本人確認書類
      
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
      
      // 履歴書・職務経歴書
      resume: [''], // 履歴書
      careerHistory: [''], // 職務経歴書
      
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
      basicPensionNumberDoc: [''], // 基礎年金番号確認書類
      
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
          sameAsCurrentAddress: this.sameAsCurrentAddress
        };

        // 一時的な入力フィールドを削除
        delete formData.myNumberPart1;
        delete formData.myNumberPart2;
        delete formData.myNumberPart3;
        delete formData.basicPensionNumberPart1;
        delete formData.basicPensionNumberPart2;

        // undefinedの値を削除
        const cleanedData = this.removeUndefinedValues(formData);

        // Firestoreに保存
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
}

