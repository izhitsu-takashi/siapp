import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormArray, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FirestoreService } from '../../services/firestore.service';

interface Employee {
  employeeNumber: string;
  name: string;
  email: string;
  employmentType: string;
}

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './hr-dashboard.component.html',
  styleUrl: './hr-dashboard.component.css'
})
export class HrDashboardComponent {
  currentTab: string = 'メインページ';
  
  tabs = [
    { id: 'main', name: 'メインページ' },
    { id: 'employee-management', name: '社員情報管理' },
    { id: 'application-management', name: '申請管理' },
    { id: 'procedures', name: '各種手続き' },
    { id: 'document-management', name: '文書作成・管理' },
    { id: 'egov', name: 'e-Gov電子申請ページ' },
    { id: 'insurance-card', name: '保険証管理' },
    { id: 'social-insurance', name: '社会保険料' },
    { id: 'settings', name: '設定' }
  ];

  // サンプルデータ（実際の実装では認証サービスから取得）
  hrName = '人事 花子';

  // 社員一覧
  employees: Employee[] = [];
  
  // 社会保険料一覧データ
  insuranceList: any[] = [];
  
  // 申請一覧データ
  allApplications: any[] = [];
  
  // 申請詳細モーダル用
  showApplicationDetailModal = false;
  selectedApplication: any = null;
  statusChangeForm!: FormGroup;
  statusComment: string = '';
  
  // 等級テーブルデータ
  gradeTable: any = null;
  
  // 設定ページ用データ
  settingsForm!: FormGroup;
  companyInfo: any = {
    companyName: '',
    address: '',
    corporateNumber: '',
    officeCode: ''
  };
  healthInsuranceType: string = '協会けんぽ';
  selectedPrefecture: string = '';
  insuranceRates: any = {
    healthInsurance: 0,
    nursingInsurance: 0,
    pensionInsurance: 0
  };
  hrUsers: any[] = [];
  allUsers: any[] = [];
  
  // 健康保険料率データ
  kenpoRates: any[] = [];
  showAddModal = false;
  addEmployeeForm: FormGroup;
  employmentTypes = ['正社員', '契約社員', 'パート', 'アルバイト', '派遣社員'];

  // 社員情報編集モーダル
  showEmployeeEditModal = false;
  selectedEmployeeNumber = '';
  employeeEditForm: FormGroup;
  showMyNumber = false;
  hasPensionHistory = false;
  isSaving = false;
  sameAsCurrentAddress = false;
  sameAsCurrentAddressForEmergency = false;
  hasSpouse = false;
  age: number | null = null;
  
  // ファイル入力（フォームコントロールから分離）
  idDocumentFile: File | null = null;
  resumeFile: File | null = null;
  careerHistoryFile: File | null = null;
  basicPensionNumberDocFile: File | null = null;

  // 選択肢
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
  
  // 人事専用選択肢
  healthInsuranceTypes = ['健康保険被保険者', '健康保険被扶養者', '任意継続被保険者'];
  nursingInsuranceTypes = ['介護保険第1号被保険者', '介護保険第2号被保険者', '任意継続被保険者', '介護保険の被保険者でない者', '特定被保険者'];
  pensionInsuranceTypes = ['国民年金第1号被保険者', '国民年金第2号被保険者', '国民年金第3号被保険者'];
  
  // 扶養者一覧
  dependents: any[] = [];

  // 文書作成・管理ページ用
  documentTypes = [
    '健康保険・厚生年金保険被保険者資格取得届',
    '健康保険・厚生年金保険被保険者資格喪失届',
    '健康保険 任意継続被保険者資格取得申請書',
    '健康保険被扶養者（異動）届',
    '健康保険資格確認書交付申請書',
    '健康保険資格確認書再交付申請書',
    '被保険者住所変更届',
    '被保険者氏名変更届',
    '産前産後休業取得者申出書／変更（終了）届',
    '算定基礎届',
    '被保険者報酬月額変更届',
    '健康保険・厚生年金保険被保険者賞与支払届'
  ];
  selectedDocumentType: string = '';
  employeeSearchQuery: string = '';
  filteredEmployees: Employee[] = [];
  selectedEmployee: Employee | null = null;
  allEmployeesForDocument: any[] = [];

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private firestoreService: FirestoreService,
    private http: HttpClient
  ) {
    this.addEmployeeForm = this.fb.group({
      employees: this.fb.array([this.createEmployeeFormGroup()])
    });
    this.employeeEditForm = this.createEmployeeEditForm();
    this.settingsForm = this.createSettingsForm();
    this.loadEmployees();
    this.loadGradeTable();
    this.loadKenpoRates();
    this.loadSettings();
  }
  
  // 健康保険料率データを読み込む
  async loadKenpoRates() {
    try {
      const data = await this.http.get<any[]>('/assets/kenpo-rates.json').toPromise();
      if (data) {
        this.kenpoRates = data;
      }
    } catch (error) {
      console.error('Error loading kenpo rates:', error);
      this.kenpoRates = [];
    }
  }
  
  // 健康保険種別が変更されたときの処理
  onHealthInsuranceTypeChange() {
    const type = this.settingsForm.get('healthInsuranceType')?.value;
    if (type !== '協会けんぽ') {
      // 組合保険を選択した場合、都道府県をリセット
      this.settingsForm.patchValue({ prefecture: '' });
      this.selectedPrefecture = '';
    }
  }
  
  // 都道府県が選択されたときの処理
  onPrefectureChange() {
    const prefecture = this.settingsForm.get('prefecture')?.value;
    if (prefecture && this.kenpoRates.length > 0) {
      // 選択された都道府県に対応する保険料率を取得
      const rateData = this.kenpoRates.find((rate: any) => rate.prefecture === prefecture);
      if (rateData) {
        // 健康保険料率と介護保険料率を自動設定
        this.settingsForm.patchValue({
          healthInsuranceRate: rateData.healthRate,
          nursingInsuranceRate: rateData.careRate
        });
        this.selectedPrefecture = prefecture;
      }
    }
  }
  
  // 設定フォームを作成
  createSettingsForm(): FormGroup {
    return this.fb.group({
      // 企業情報
      companyName: [''],
      address: [''],
      corporateNumber: [''],
      officeCode: [''],
      // 健康保険設定
      healthInsuranceType: ['協会けんぽ'],
      prefecture: [''], // 都道府県（協会けんぽ選択時のみ）
      // 保険料率設定
      healthInsuranceRate: [0],
      nursingInsuranceRate: [0],
      pensionInsuranceRate: [0]
    });
  }
  
  // 設定を読み込む
  async loadSettings() {
    try {
      // Firestoreから設定を読み込む
      const settings = await this.firestoreService.getSettings();
      
      if (settings) {
        // 企業情報を読み込む
        if (settings.companyInfo) {
          this.companyInfo = {
            companyName: settings.companyInfo.companyName || '',
            address: settings.companyInfo.address || '',
            corporateNumber: settings.companyInfo.corporateNumber || '',
            officeCode: settings.companyInfo.officeCode || ''
          };
        }
        
        // 健康保険設定を読み込む
        if (settings.healthInsuranceType) {
          this.healthInsuranceType = settings.healthInsuranceType;
        }
        if (settings.prefecture) {
          this.selectedPrefecture = settings.prefecture;
        }
        
        // 保険料率設定を読み込む
        if (settings.insuranceRates) {
          this.insuranceRates = {
            healthInsurance: settings.insuranceRates.healthInsurance || 0,
            nursingInsurance: settings.insuranceRates.nursingInsurance || 0,
            pensionInsurance: settings.insuranceRates.pensionInsurance || 0
          };
        }
      }
      
      // フォームに値を設定
      this.settingsForm.patchValue({
        companyName: this.companyInfo.companyName,
        address: this.companyInfo.address,
        corporateNumber: this.companyInfo.corporateNumber,
        officeCode: this.companyInfo.officeCode,
        healthInsuranceType: this.healthInsuranceType,
        prefecture: this.selectedPrefecture,
        healthInsuranceRate: this.insuranceRates.healthInsurance,
        nursingInsuranceRate: this.insuranceRates.nursingInsurance,
        pensionInsuranceRate: this.insuranceRates.pensionInsurance
      });
      
      // 全ユーザーを読み込む（人事権限設定用）
      await this.loadAllUsers();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
  
  // 全ユーザーを読み込む
  async loadAllUsers() {
    try {
      const allEmployees = await this.firestoreService.getAllEmployees();
      this.allUsers = allEmployees.map((emp: any) => ({
        employeeNumber: emp.employeeNumber || '',
        name: emp.name || '',
        email: emp.email || '',
        hasHrPermission: emp.hasHrPermission || false
      }));
      this.hrUsers = this.allUsers.filter((user: any) => user.hasHrPermission);
    } catch (error) {
      console.error('Error loading all users:', error);
      this.allUsers = [];
      this.hrUsers = [];
    }
  }
  
  // 企業情報を保存
  async saveCompanyInfo() {
    try {
      const formValue = this.settingsForm.value;
      
      // 企業情報を更新
      this.companyInfo = {
        companyName: formValue.companyName || '',
        address: formValue.address || '',
        corporateNumber: formValue.corporateNumber || '',
        officeCode: formValue.officeCode || ''
      };
      
      // Firestoreから現在の設定を取得してマージ
      const currentSettings = await this.firestoreService.getSettings() || {};
      
      // Firestoreに保存
      await this.firestoreService.saveSettings({
        ...currentSettings,
        companyInfo: this.companyInfo
      });
      
      alert('企業情報を保存しました');
    } catch (error) {
      console.error('Error saving company info:', error);
      alert('企業情報の保存中にエラーが発生しました');
    }
  }
  
  // 健康保険設定を保存
  async saveHealthInsuranceSetting() {
    try {
      const formValue = this.settingsForm.value;
      
      // 健康保険設定を更新
      this.healthInsuranceType = formValue.healthInsuranceType || '協会けんぽ';
      this.selectedPrefecture = formValue.prefecture || '';
      
      // 協会けんぽで都道府県が選択されている場合、保険料率も自動更新
      if (this.healthInsuranceType === '協会けんぽ' && this.selectedPrefecture) {
        const rateData = this.kenpoRates.find((rate: any) => rate.prefecture === this.selectedPrefecture);
        if (rateData) {
          this.insuranceRates.healthInsurance = rateData.healthRate;
          this.insuranceRates.nursingInsurance = rateData.careRate;
          // フォームにも反映
          this.settingsForm.patchValue({
            healthInsuranceRate: rateData.healthRate,
            nursingInsuranceRate: rateData.careRate
          });
        }
      }
      
      // Firestoreから現在の設定を取得してマージ
      const currentSettings = await this.firestoreService.getSettings() || {};
      
      // Firestoreに保存
      await this.firestoreService.saveSettings({
        ...currentSettings,
        healthInsuranceType: this.healthInsuranceType,
        prefecture: this.selectedPrefecture,
        insuranceRates: this.insuranceRates
      });
      
      alert('健康保険設定を保存しました');
    } catch (error) {
      console.error('Error saving health insurance setting:', error);
      alert('健康保険設定の保存中にエラーが発生しました');
    }
  }
  
  // 保険料率設定を保存
  async saveInsuranceRates() {
    try {
      const formValue = this.settingsForm.value;
      
      // 保険料率設定を更新
      this.insuranceRates = {
        healthInsurance: Number(formValue.healthInsuranceRate) || 0,
        nursingInsurance: Number(formValue.nursingInsuranceRate) || 0,
        pensionInsurance: Number(formValue.pensionInsuranceRate) || 0
      };
      
      // Firestoreから現在の設定を取得してマージ
      const currentSettings = await this.firestoreService.getSettings() || {};
      
      // Firestoreに保存
      await this.firestoreService.saveSettings({
        ...currentSettings,
        insuranceRates: this.insuranceRates
      });
      
      alert('保険料率設定を保存しました');
    } catch (error) {
      console.error('Error saving insurance rates:', error);
      alert('保険料率設定の保存中にエラーが発生しました');
    }
  }
  
  // 人事権限を付与
  async grantHrPermission(employeeNumber: string) {
    try {
      // Firestoreでユーザーの人事権限を更新
      const employee = await this.firestoreService.getEmployeeData(employeeNumber);
      if (employee) {
        await this.firestoreService.saveEmployeeData(employeeNumber, {
          ...employee,
          hasHrPermission: true
        });
        
        // リストを更新
        await this.loadAllUsers();
        alert('人事権限を付与しました');
      }
    } catch (error) {
      console.error('Error granting HR permission:', error);
      alert('人事権限の付与中にエラーが発生しました');
    }
  }
  
  // 人事権限を削除
  async revokeHrPermission(employeeNumber: string) {
    try {
      // Firestoreでユーザーの人事権限を削除
      const employee = await this.firestoreService.getEmployeeData(employeeNumber);
      if (employee) {
        await this.firestoreService.saveEmployeeData(employeeNumber, {
          ...employee,
          hasHrPermission: false
        });
        
        // リストを更新
        await this.loadAllUsers();
        alert('人事権限を削除しました');
      }
    } catch (error) {
      console.error('Error revoking HR permission:', error);
      alert('人事権限の削除中にエラーが発生しました');
    }
  }
  
  // 等級テーブルを読み込む
  async loadGradeTable() {
    try {
      const data = await this.http.get<any>('/assets/grade-table.json').toPromise();
      this.gradeTable = data;
    } catch (error) {
      console.error('Error loading grade table:', error);
      // フォールバック: 直接インポートを試みる
      this.loadGradeTableFallback();
    }
  }
  
  // フォールバック: JSONファイルを直接読み込む
  async loadGradeTableFallback() {
    try {
      const response = await fetch('/assets/grade-table.json');
      if (response.ok) {
        const data = await response.json();
        this.gradeTable = data;
      }
    } catch (error) {
      console.error('Error loading grade table fallback:', error);
    }
  }
  
  // 固定的賃金から標準報酬月額を計算
  calculateStandardMonthlySalary(fixedSalary: number): { grade: number; monthlyStandard: number } | null {
    if (!this.gradeTable || !this.gradeTable.hyouzyungetugakuReiwa7) {
      return null;
    }
    
    const salary = Number(fixedSalary) || 0;
    const gradeList = this.gradeTable.hyouzyungetugakuReiwa7;
    
    // from ~ to の範囲内に当てはまる等級を検索
    for (const gradeItem of gradeList) {
      if (salary >= gradeItem.from && salary <= gradeItem.to) {
        return {
          grade: gradeItem.grade,
          monthlyStandard: gradeItem.monthlyStandard
        };
      }
    }
    
    return null;
  }

  createEmployeeFormGroup(): FormGroup {
    return this.fb.group({
      employeeNumber: ['', Validators.required],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      employmentType: ['', Validators.required]
    });
  }

  get employeesFormArray(): FormArray {
    return this.addEmployeeForm.get('employees') as FormArray;
  }

  addEmployeeRow() {
    this.employeesFormArray.push(this.createEmployeeFormGroup());
  }

  removeEmployeeRow(index: number) {
    if (this.employeesFormArray.length > 1) {
      this.employeesFormArray.removeAt(index);
    }
  }

  switchTab(tabName: string) {
    this.currentTab = tabName;
    // 文書作成・管理ページに切り替えた時、従業員データを再読み込み
    if (tabName === '文書作成・管理') {
      this.loadEmployees();
    }
    // 社会保険料タブが選択された場合、データを読み込む
    if (tabName === '社会保険料') {
      this.loadInsuranceList().catch(err => {
        console.error('Error in loadInsuranceList:', err);
      });
    }
    // 申請管理タブが選択された場合、申請一覧を読み込む
    if (tabName === '申請管理') {
      this.loadAllApplications().catch(err => {
        console.error('Error in loadAllApplications:', err);
      });
    }
    // 設定タブが選択された場合、設定を読み込む
    if (tabName === '設定') {
      this.loadSettings().catch(err => {
        console.error('Error in loadSettings:', err);
      });
    }
  }
  
  // 50円単位で切り上げ/切り捨てする関数
  roundToFifty(amount: number): number {
    const remainder = amount % 100;
    if (remainder <= 50) {
      return Math.floor(amount / 100) * 100;
    } else {
      return Math.ceil(amount / 100) * 100;
    }
  }
  
  // 社会保険料一覧を読み込む
  async loadInsuranceList() {
    try {
      // 全社員データを取得
      const allEmployees = await this.firestoreService.getAllEmployees();
      
      // 設定から保険料率を取得
      const settings = await this.firestoreService.getSettings();
      const healthInsuranceRate = settings?.insuranceRates?.healthInsurance || this.insuranceRates.healthInsurance || 0;
      const nursingInsuranceRate = settings?.insuranceRates?.nursingInsurance || this.insuranceRates.nursingInsurance || 0;
      const pensionInsuranceRate = settings?.insuranceRates?.pensionInsurance || this.insuranceRates.pensionInsurance || 0;
      
      // 保険料一覧データを構築（社員番号と氏名があるもののみ）
      if (Array.isArray(allEmployees)) {
        this.insuranceList = allEmployees
          .filter((emp: any) => emp && emp.employeeNumber && emp.name)
          .map((emp: any) => {
            const fixedSalary = Number(emp.fixedSalary) || 0;
            // 標準報酬月額を計算
            const standardSalaryInfo = this.calculateStandardMonthlySalary(fixedSalary);
            const standardMonthlySalary = standardSalaryInfo ? standardSalaryInfo.monthlyStandard : 0;
            const grade = standardSalaryInfo ? standardSalaryInfo.grade : 0;
            
            // 各保険料を計算（標準報酬月額 × 保険料率 / 100）
            // 小数第2位まで保持（表示用）
            const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100);
            const nursingInsuranceRaw = standardMonthlySalary * (nursingInsuranceRate / 100);
            const pensionInsuranceRaw = standardMonthlySalary * (pensionInsuranceRate / 100);
            
            // 社員負担額を計算
            // (健康保険料 + 介護保険料) ÷ 2 を50円単位で切り上げ/切り捨て
            const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2;
            const healthNursingBurden = this.roundToFifty(healthNursingHalf);
            
            // 厚生年金保険料 ÷ 2 を50円単位で切り上げ/切り捨て
            const pensionHalf = pensionInsuranceRaw / 2;
            const pensionBurden = this.roundToFifty(pensionHalf);
            
            // 社員負担額（合計）
            const employeeBurden = healthNursingBurden + pensionBurden;
            
            return {
              employeeNumber: emp.employeeNumber || '',
              name: emp.name || '',
              fixedSalary: fixedSalary,
              grade: grade,
              standardMonthlySalary: standardMonthlySalary,
              healthInsurance: healthInsuranceRaw, // 小数第2位まで
              nursingInsurance: nursingInsuranceRaw, // 小数第2位まで
              pensionInsurance: pensionInsuranceRaw, // 小数第2位まで
              employeeBurden: employeeBurden // 社員負担額
            };
          });
      } else {
        this.insuranceList = [];
      }
    } catch (error) {
      console.error('Error loading insurance list:', error);
      this.insuranceList = [];
    }
  }
  
  // 事業主負担額合計を計算
  getTotalEmployerBurden(): number {
    let totalInsurance = 0;
    let totalEmployeeBurden = 0;
    
    this.insuranceList.forEach((item: any) => {
      // 保険料の合計（小数点以下切り捨て）
      const healthInsurance = Math.floor(item.healthInsurance);
      const nursingInsurance = Math.floor(item.nursingInsurance);
      const pensionInsurance = Math.floor(item.pensionInsurance);
      totalInsurance += healthInsurance + nursingInsurance + pensionInsurance;
      
      // 社員負担額の合計
      totalEmployeeBurden += item.employeeBurden || 0;
    });
    
    // 事業主負担額 = 保険料合計 - 社員負担額合計
    return totalInsurance - totalEmployeeBurden;
  }

  // トラッキング関数（パフォーマンス向上）
  trackByEmployeeNumber(index: number, item: any): string {
    return item.employeeNumber || index.toString();
  }
  
  // 申請一覧を読み込む
  async loadAllApplications() {
    try {
      const applications = await this.firestoreService.getAllApplications();
      // FirestoreのTimestampをDateに変換
      this.allApplications = applications.map((app: any) => {
        if (app.createdAt && typeof app.createdAt.toDate === 'function') {
          app.createdAt = app.createdAt.toDate();
        }
        if (app.updatedAt && typeof app.updatedAt.toDate === 'function') {
          app.updatedAt = app.updatedAt.toDate();
        }
        return app;
      });
      
      // 申請者情報を取得
      for (const app of this.allApplications) {
        if (app.employeeNumber) {
          try {
            const employee = await this.firestoreService.getEmployeeData(app.employeeNumber);
            if (employee) {
              app.employeeName = employee.name || '';
            }
          } catch (error) {
            console.error(`Error loading employee data for ${app.employeeNumber}:`, error);
            app.employeeName = '';
          }
        }
      }
    } catch (error) {
      console.error('Error loading all applications:', error);
      this.allApplications = [];
    }
  }
  
  // 申請日を取得（Date型に変換）
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
  
  
  // 申請詳細モーダルを開く
  openApplicationDetail(application: any) {
    this.selectedApplication = application;
    this.showApplicationDetailModal = true;
    // ステータス変更フォームを初期化
    this.statusChangeForm = this.fb.group({
      status: [application.status || '承認待ち'],
      comment: [application.statusComment || '']
    });
    this.statusComment = application.statusComment || '';
  }
  
  // 申請詳細モーダルを閉じる
  closeApplicationDetailModal() {
    this.showApplicationDetailModal = false;
    this.selectedApplication = null;
    this.statusComment = '';
  }
  
  // ステータス変更時の処理（コメント表示の制御）
  onStatusChange() {
    const selectedStatus = this.statusChangeForm.get('status')?.value;
    if (selectedStatus === '差し戻し') {
      this.statusChangeForm.get('comment')?.setValidators([]);
    } else {
      this.statusChangeForm.get('comment')?.clearValidators();
    }
    this.statusChangeForm.get('comment')?.updateValueAndValidity();
  }
  
  // 申請のステータスを変更
  async updateApplicationStatus() {
    if (!this.selectedApplication || !this.selectedApplication.id) {
      alert('申請情報が見つかりません');
      return;
    }
    
    if (this.statusChangeForm.invalid) {
      this.statusChangeForm.markAllAsTouched();
      alert('必須項目を入力してください');
      return;
    }
    
    const status = this.statusChangeForm.get('status')?.value;
    const comment = this.statusChangeForm.get('comment')?.value || '';
    
    // 差し戻しの場合はコメント必須
    if (status === '差し戻し' && !comment.trim()) {
      alert('差し戻しの場合はコメントを入力してください');
      return;
    }
    
    try {
      await this.firestoreService.updateApplicationStatus(
        this.selectedApplication.id, 
        status,
        status === '差し戻し' ? comment : ''
      );
      
      // ローカルのステータスを更新
      this.selectedApplication.status = status;
      if (status === '差し戻し') {
        this.selectedApplication.statusComment = comment;
      } else {
        this.selectedApplication.statusComment = '';
      }
      
      // 申請一覧を再読み込み
      await this.loadAllApplications();
      
      // 選択中の申請を更新（再読み込み後のデータで更新）
      const updatedApplication = this.allApplications.find((app: any) => 
        app.id === this.selectedApplication.id || 
        app.applicationId === this.selectedApplication.applicationId
      );
      if (updatedApplication) {
        this.selectedApplication = updatedApplication;
        this.statusChangeForm.patchValue({
          status: updatedApplication.status || '承認待ち',
          comment: updatedApplication.statusComment || ''
        });
        this.statusComment = updatedApplication.statusComment || '';
      }
      
      alert(`ステータスを「${status}」に変更しました`);
    } catch (error) {
      console.error('Error updating application status:', error);
      alert('ステータスの変更に失敗しました');
    }
  }
  
  // マイナンバーをマスク表示用にフォーマット
  formatMyNumberForDisplay(myNumber: string | null): string {
    if (!myNumber || myNumber.length !== 12) {
      return '-';
    }
    return `${myNumber.substring(0, 4)}-${myNumber.substring(4, 8)}-${myNumber.substring(8, 12)}`;
  }
  
  // 基礎年金番号をフォーマット表示
  formatBasicPensionNumberForDisplay(basicPensionNumber: string | null): string {
    if (!basicPensionNumber || basicPensionNumber.length < 4) {
      return '-';
    }
    if (basicPensionNumber.length >= 10) {
      return `${basicPensionNumber.substring(0, 4)}-${basicPensionNumber.substring(4, 10)}`;
    }
    return basicPensionNumber;
  }
  
  // 保険料を小数第2位まで表示（一番下の桁が0の場合は表示しない）
  formatInsuranceAmount(amount: number): string {
    if (!amount || amount === 0) {
      return '0';
    }
    
    // 小数第2位まで表示
    const formatted = amount.toFixed(2);
    
    // 一番下の桁が0の場合は表示しない
    if (formatted.endsWith('.00')) {
      return formatted.replace('.00', '');
    } else if (formatted.endsWith('0')) {
      return formatted.slice(0, -1);
    }
    
    return formatted;
  }

  logout() {
    this.router.navigate(['/login']);
  }

  openAddModal() {
    this.showAddModal = true;
    // フォームをリセットして1行目を追加
    this.addEmployeeForm = this.fb.group({
      employees: this.fb.array([this.createEmployeeFormGroup()])
    });
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  async loadEmployees() {
    try {
      const allEmployees = await this.firestoreService.getAllEmployees();
      this.employees = allEmployees
        .filter(emp => emp.employeeNumber && emp.name && emp.email && emp.employmentType)
        .map(emp => ({
          employeeNumber: emp.employeeNumber,
          name: emp.name,
          email: emp.email,
          employmentType: emp.employmentType
        }));
      
      // 文書作成用の全従業員データも読み込む
      this.allEmployeesForDocument = allEmployees;
      this.filteredEmployees = this.employees;
    } catch (error) {
      console.error('Error loading employees:', error);
      this.employees = [];
      this.allEmployeesForDocument = [];
      this.filteredEmployees = [];
    }
  }

  async addEmployees() {
    if (this.addEmployeeForm.valid) {
      const newEmployees = this.employeesFormArray.value;
      
      // 各社員をFirestoreに保存
      for (const employee of newEmployees) {
        try {
          await this.firestoreService.saveEmployeeData(employee.employeeNumber, {
            employeeNumber: employee.employeeNumber,
            name: employee.name,
            email: employee.email,
            employmentType: employee.employmentType
          });
          
          // 社員一覧に追加
          this.employees.push({
            employeeNumber: employee.employeeNumber,
            name: employee.name,
            email: employee.email,
            employmentType: employee.employmentType
          });
        } catch (error) {
          console.error('Error adding employee:', error);
        }
      }
      
      // モーダルを閉じる
      this.closeAddModal();
      
      // 社員一覧を再読み込み
      await this.loadEmployees();
      
      alert(`${newEmployees.length}名の社員を追加しました`);
    } else {
      alert('必須項目を入力してください');
    }
  }

  // 社員情報編集モーダルを開く
  async openEmployeeEditModal(employeeNumber: string) {
    this.selectedEmployeeNumber = employeeNumber;
    this.resetEmployeeEditForm(); // フォームをリセット
    this.showEmployeeEditModal = true;
    await this.loadEmployeeData(employeeNumber);
  }

  // 社員情報編集モーダルを閉じる
  closeEmployeeEditModal() {
    this.showEmployeeEditModal = false;
    this.selectedEmployeeNumber = '';
    this.employeeEditForm = this.createEmployeeEditForm();
    this.resetEmployeeEditForm();
  }

  // 社員情報編集フォームをリセット
  resetEmployeeEditForm() {
    this.showMyNumber = false;
    this.hasPensionHistory = false;
    this.sameAsCurrentAddress = false;
    this.sameAsCurrentAddressForEmergency = false;
    this.hasSpouse = false;
    this.age = null;
    this.idDocumentFile = null;
    this.resumeFile = null;
    this.careerHistoryFile = null;
    this.basicPensionNumberDocFile = null;
    this.dependents = [];
  }

  // 社員情報編集フォームを作成
  createEmployeeEditForm(): FormGroup {
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
      
      // 配偶者情報
      spouseStatus: [''],
      spouseAnnualIncome: [''],
      
      // 人事専用情報（給与）
      fixedSalary: [''], // 固定的賃金
      bonusAmount: [''], // 賞与額
      bonusYear: [''], // 賞与年月（年）
      bonusMonth: [''], // 賞与年月（月）
      
      // 人事専用情報（保険者種別）
      healthInsuranceType: [''], // 健康保険者種別
      nursingInsuranceType: [''], // 介護保険者種別
      pensionInsuranceType: [''] // 厚生年金保険者種別
    });
  }

  // 社員データを読み込む
  async loadEmployeeData(employeeNumber: string) {
    try {
      const data = await this.firestoreService.getEmployeeData(employeeNumber);
      if (data) {
        this.populateEmployeeEditForm(data);
      }
    } catch (error) {
      console.error('Error loading employee data:', error);
    }
  }

  // フォームにデータを設定
  populateEmployeeEditForm(data: any) {
    // マイナンバーを分割
    if (data.myNumber && data.myNumber.length === 12) {
      this.employeeEditForm.patchValue({
        myNumberPart1: data.myNumber.substring(0, 4),
        myNumberPart2: data.myNumber.substring(4, 8),
        myNumberPart3: data.myNumber.substring(8, 12)
      });
    }

    // 基礎年金番号を分割
    if (data.basicPensionNumber) {
      const basicPensionNumber = data.basicPensionNumber.toString();
      if (basicPensionNumber.length >= 4) {
        this.employeeEditForm.patchValue({
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
        this.employeeEditForm.patchValue({
          residentAddress: data.residentAddress || data.currentAddress,
          residentAddressKana: data.residentAddressKana || data.currentAddressKana || '',
          residentHouseholdHead: data.residentHouseholdHead || data.currentHouseholdHead || ''
        });
      } else if (data.residentAddress) {
        this.employeeEditForm.patchValue({
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

    // 扶養者一覧を最初に読み込む（formDataを操作する前に）
    if (data.dependents && Array.isArray(data.dependents) && data.dependents.length > 0) {
      // 深いコピーを作成して、元のデータを変更しないようにする
      this.dependents = data.dependents.map((dep: any) => ({
        name: dep.name || '',
        nameKana: dep.nameKana || '',
        relationship: dep.relationship || '',
        birthDate: dep.birthDate || '',
        myNumber: dep.myNumber || '',
        address: dep.address || '',
        notes: dep.notes || ''
      }));
      console.log('Loaded dependents:', this.dependents);
    } else {
      this.dependents = [];
      console.log('No dependents found, initializing empty array');
    }

    // その他のフィールドを設定
    const formData: any = { ...data };
    delete formData.myNumber;
    delete formData.basicPensionNumber;
    delete formData.updatedAt;
    delete formData.dependents; // 既に読み込んだので削除

    // ネストされたフォームグループを個別に設定
    if (formData.emergencyContact) {
      if (this.sameAsCurrentAddressForEmergency && data.currentAddress) {
        formData.emergencyContact.address = formData.emergencyContact.address || data.currentAddress;
        formData.emergencyContact.addressKana = formData.emergencyContact.addressKana || data.currentAddressKana || '';
      }
      this.employeeEditForm.get('emergencyContact')?.patchValue(formData.emergencyContact);
      delete formData.emergencyContact;
    }

    if (formData.bankAccount) {
      this.employeeEditForm.get('bankAccount')?.patchValue(formData.bankAccount);
      delete formData.bankAccount;
    }

    // 残りのフィールドを設定
    this.employeeEditForm.patchValue(formData);
    
    // sameAsCurrentAddressがtrueの場合、住民票住所フィールドを無効化
    if (this.sameAsCurrentAddress) {
      this.employeeEditForm.get('residentAddress')?.disable();
      this.employeeEditForm.get('residentAddressKana')?.disable();
      this.employeeEditForm.get('residentHouseholdHead')?.disable();
    }
    
    // sameAsCurrentAddressForEmergencyがtrueの場合、緊急連絡先住所フィールドを無効化
    if (this.sameAsCurrentAddressForEmergency) {
      this.employeeEditForm.get('emergencyContact.address')?.disable();
      this.employeeEditForm.get('emergencyContact.addressKana')?.disable();
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
    const birthDate = this.employeeEditForm.get('birthDate')?.value;
    if (birthDate) {
      this.calculateAge(birthDate);
    }
  }

  onSameAddressChange(event: any) {
    this.sameAsCurrentAddress = event.target.checked;
    if (this.sameAsCurrentAddress) {
      const currentAddress = this.employeeEditForm.get('currentAddress')?.value || '';
      const currentAddressKana = this.employeeEditForm.get('currentAddressKana')?.value || '';
      const currentHouseholdHead = this.employeeEditForm.get('currentHouseholdHead')?.value || '';
      this.employeeEditForm.patchValue({
        residentAddress: currentAddress,
        residentAddressKana: currentAddressKana,
        residentHouseholdHead: currentHouseholdHead
      });
      this.employeeEditForm.get('residentAddress')?.disable();
      this.employeeEditForm.get('residentAddressKana')?.disable();
      this.employeeEditForm.get('residentHouseholdHead')?.disable();
    } else {
      this.employeeEditForm.get('residentAddress')?.enable();
      this.employeeEditForm.get('residentAddressKana')?.enable();
      this.employeeEditForm.get('residentHouseholdHead')?.enable();
    }
  }

  onSameAddressForEmergencyChange(event: any) {
    this.sameAsCurrentAddressForEmergency = event.target.checked;
    if (this.sameAsCurrentAddressForEmergency) {
      const currentAddress = this.employeeEditForm.get('currentAddress')?.value || '';
      const currentAddressKana = this.employeeEditForm.get('currentAddressKana')?.value || '';
      this.employeeEditForm.get('emergencyContact')?.patchValue({
        address: currentAddress,
        addressKana: currentAddressKana
      });
      this.employeeEditForm.get('emergencyContact.address')?.disable();
      this.employeeEditForm.get('emergencyContact.addressKana')?.disable();
    } else {
      this.employeeEditForm.get('emergencyContact.address')?.enable();
      this.employeeEditForm.get('emergencyContact.addressKana')?.enable();
    }
  }

  onSpouseStatusChange(event: any) {
    this.hasSpouse = event.target.value === '有';
    if (!this.hasSpouse) {
      this.employeeEditForm.get('spouseAnnualIncome')?.setValue('');
    }
  }

  onPensionHistoryChange(event: any) {
    this.hasPensionHistory = event.target.value === '有';
    if (!this.hasPensionHistory) {
      this.employeeEditForm.get('pensionHistory')?.setValue('');
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

  toggleMyNumber() {
    this.showMyNumber = !this.showMyNumber;
  }

  formatMyNumberInput(event: any, part: number) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    event.target.value = value;
    this.employeeEditForm.get(`myNumberPart${part}`)?.setValue(value);
    
    if (value.length === 4 && part < 3) {
      const nextInput = document.getElementById(`hr-myNumberPart${part + 1}`);
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
    this.employeeEditForm.get(`basicPensionNumberPart${part}`)?.setValue(value);
    
    if (value.length === maxLength && part === 1) {
      const nextInput = document.getElementById('hr-basicPensionNumberPart2');
      if (nextInput) {
        nextInput.focus();
      }
    }
  }

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

  async saveEmployeeData() {
    if (this.employeeEditForm.valid) {
      this.isSaving = true;
      try {
        // マイナンバーを結合
        const myNumberParts = [
          this.employeeEditForm.get('myNumberPart1')?.value || '',
          this.employeeEditForm.get('myNumberPart2')?.value || '',
          this.employeeEditForm.get('myNumberPart3')?.value || ''
        ];
        const myNumber = myNumberParts.join('');

        // 基礎年金番号を結合
        const basicPensionNumberParts = [
          this.employeeEditForm.get('basicPensionNumberPart1')?.value || '',
          this.employeeEditForm.get('basicPensionNumberPart2')?.value || ''
        ];
        const basicPensionNumber = basicPensionNumberParts.join('');

        // フォームデータを準備
        const formValue = this.employeeEditForm.value;
        const formData: any = {
          ...formValue,
          myNumber: myNumber || null,
          basicPensionNumber: basicPensionNumber || null,
          sameAsCurrentAddress: this.sameAsCurrentAddress,
          sameAsCurrentAddressForEmergency: this.sameAsCurrentAddressForEmergency
        };

        // sameAsCurrentAddressがtrueの場合、現住所の値を住民票住所にコピー
        if (this.sameAsCurrentAddress) {
          const currentAddress = this.employeeEditForm.get('currentAddress')?.value || '';
          const currentAddressKana = this.employeeEditForm.get('currentAddressKana')?.value || '';
          const currentHouseholdHead = this.employeeEditForm.get('currentHouseholdHead')?.value || '';
          formData.residentAddress = currentAddress;
          formData.residentAddressKana = currentAddressKana;
          formData.residentHouseholdHead = currentHouseholdHead;
        }

        // sameAsCurrentAddressForEmergencyがtrueの場合、現住所の値を緊急連絡先住所にコピー
        if (this.sameAsCurrentAddressForEmergency) {
          const currentAddress = this.employeeEditForm.get('currentAddress')?.value || '';
          const currentAddressKana = this.employeeEditForm.get('currentAddressKana')?.value || '';
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

        // 扶養者一覧を追加（深いコピーを作成）
        formData.dependents = this.dependents.map(dep => ({
          name: dep.name || '',
          nameKana: dep.nameKana || '',
          relationship: dep.relationship || '',
          birthDate: dep.birthDate || '',
          myNumber: dep.myNumber || '',
          address: dep.address || '',
          notes: dep.notes || ''
        }));

        // デバッグ用ログ
        console.log('Saving dependents:', formData.dependents);

        // undefinedの値を削除（サービス側でも処理されるが、事前に削除）
        const cleanedData = this.removeUndefinedValues(formData);
        
        // デバッグ用ログ
        console.log('Cleaned data with dependents:', cleanedData.dependents);

        // Firestoreに保存（サービス側で最終的な正規化が行われる）
        await this.firestoreService.saveEmployeeData(this.selectedEmployeeNumber, cleanedData);
        
        // 社員一覧を再読み込み
        await this.loadEmployees();
        
        // 保存したデータを再読み込みしてフォームを更新（モーダルは開いたまま）
        await this.loadEmployeeData(this.selectedEmployeeNumber);
        
        alert('社員情報を保存しました');
      } catch (error) {
        console.error('Error saving employee data:', error);
        alert('保存中にエラーが発生しました');
      } finally {
        this.isSaving = false;
      }
    } else {
      alert('必須項目を入力してください');
    }
  }

  getMaskedMyNumber(): string {
    const part1 = this.employeeEditForm.get('myNumberPart1')?.value || '';
    const part2 = this.employeeEditForm.get('myNumberPart2')?.value || '';
    const part3 = this.employeeEditForm.get('myNumberPart3')?.value || '';
    const totalLength = part1.length + part2.length + part3.length;
    if (totalLength === 0) return '';
    return '●'.repeat(Math.min(totalLength, 12));
  }

  // 文書作成・管理ページ用のメソッド
  onDocumentTypeChange() {
    // 文書タイプが変更された時の処理（今後実装）
    console.log('Selected document type:', this.selectedDocumentType);
  }

  onEmployeeSearch() {
    if (!this.employeeSearchQuery || this.employeeSearchQuery.trim() === '') {
      this.filteredEmployees = this.employees;
      return;
    }

    const query = this.employeeSearchQuery.toLowerCase().trim();
    this.filteredEmployees = this.employees.filter(emp => 
      emp.employeeNumber.toLowerCase().includes(query) ||
      emp.name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query)
    );
  }

  selectEmployee(employee: Employee) {
    this.selectedEmployee = employee;
    this.employeeSearchQuery = `${employee.employeeNumber} - ${employee.name}`;
    this.filteredEmployees = [];
  }

  clearEmployeeSelection() {
    this.selectedEmployee = null;
    this.employeeSearchQuery = '';
    this.filteredEmployees = this.employees;
  }

  // 扶養者を追加
  addDependent() {
    this.dependents.push({
      name: '',
      nameKana: '',
      relationship: '',
      birthDate: '',
      myNumber: '',
      address: '',
      notes: ''
    });
  }

  // 扶養者を削除
  removeDependent(index: number) {
    this.dependents.splice(index, 1);
  }

  // 年月の選択肢を生成
  getYears(): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let i = currentYear; i >= currentYear - 10; i--) {
      years.push(i);
    }
    return years;
  }

  getMonths(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
}


