import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormArray, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FirestoreService } from '../../services/firestore.service';
import { PdfEditService } from '../../services/pdf-edit.service';
import { doc, setDoc } from 'firebase/firestore';

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
    { id: 'procedures', name: '入社手続き' },
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
  
  // 新入社員一覧
  onboardingEmployees: any[] = [];
  
  // 社会保険料一覧データ
  insuranceList: any[] = [];
  
  // 申請一覧データ
  allApplications: any[] = [];
  
  // 保険証管理用データ
  insuranceCards: any[] = [];
  insuranceCardStatuses = ['配布済み', '再発行中', '回収済み'];
  
  // 申請詳細モーダル用
  showApplicationDetailModal = false;
  selectedApplication: any = null;
  statusChangeForm!: FormGroup;
  statusComment: string = '';
  
  // 文書自動作成用
  documentCheckboxes: { [key: string]: boolean } = {};
  availableDocuments: string[] = [];
  
  // 等級テーブルデータ
  gradeTable: any = null;
  
  // 設定ページ用データ
  settingsForm!: FormGroup;
  companyInfo: any = {
    officeName: '', // 事業所名称（旧: companyName）
    officeAddress: '', // 事業所住所（旧: address）
    officeNumber: '', // 事業所番号（新規追加）
    employerName: '', // 事業主氏名（新規追加）
    officePhoneNumber: '', // 事業所電話番号（新規追加）
    corporateNumber: '', // 法人番号（保持）
    officeCode: '' // 事業所整理記号（保持）
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

  // 新入社員詳細モーダル
  showOnboardingEmployeeModal = false;
  selectedOnboardingEmployee: any = null;
  onboardingStatusComment: string = '';
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
  isCreatingDocument: boolean = false;
  documentRequiredInfo: any = {}; // 各文書に必要な情報を格納
  showDocumentInfoModal = false; // 文書情報表示モーダル

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private firestoreService: FirestoreService,
    private http: HttpClient,
    private pdfEditService: PdfEditService
  ) {
    this.addEmployeeForm = this.fb.group({
      employees: this.fb.array([this.createEmployeeFormGroup()])
    });
    this.employeeEditForm = this.createEmployeeEditForm();
    this.settingsForm = this.createSettingsForm();
    
    // ブラウザ環境でのみデータを読み込む（プリレンダリング時はスキップ）
    if (typeof window !== 'undefined') {
      this.loadEmployees();
      this.loadGradeTable();
      this.loadKenpoRates();
      this.loadSettings();
    }
  }
  
  // 健康保険料率データを読み込む
  async loadKenpoRates() {
    // プリレンダリング時はスキップ
    if (typeof window === 'undefined') {
      this.kenpoRates = [];
      return;
    }

    try {
      const data = await this.http.get<any[]>('/assets/kenpo-rates.json').toPromise();
      if (data) {
        this.kenpoRates = data;
      }
    } catch (error) {
      // エラーをログに出力しない（プリレンダリング時のエラーは無視）
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
      officeName: [''], // 事業所名称（旧: companyName）
      officeAddress: [''], // 事業所住所（旧: address）
      officeNumber: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]], // 事業所番号（新規追加、5桁固定）
      employerName: [''], // 事業主氏名（新規追加）
      officePhoneNumber: [''], // 事業所電話番号（新規追加）
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
            officeName: settings.companyInfo.officeName || settings.companyInfo.companyName || '', // 旧フィールド名にも対応
            officeAddress: settings.companyInfo.officeAddress || settings.companyInfo.address || '', // 旧フィールド名にも対応
            officeNumber: settings.companyInfo.officeNumber || '',
            employerName: settings.companyInfo.employerName || '',
            officePhoneNumber: settings.companyInfo.officePhoneNumber || '',
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
          officeName: this.companyInfo.officeName,
          officeAddress: this.companyInfo.officeAddress,
          officeNumber: this.companyInfo.officeNumber,
          employerName: this.companyInfo.employerName,
          officePhoneNumber: this.companyInfo.officePhoneNumber,
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
        officeName: formValue.officeName || '',
        officeAddress: formValue.officeAddress || '',
        officeNumber: formValue.officeNumber || '',
        employerName: formValue.employerName || '',
        officePhoneNumber: formValue.officePhoneNumber || '',
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
    // プリレンダリング時はスキップ
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const data = await this.http.get<any>('/assets/grade-table.json').toPromise();
      if (data) {
        this.gradeTable = data;
      }
    } catch (error) {
      // エラーをログに出力しない（プリレンダリング時のエラーは無視）
      // フォールバック: 直接インポートを試みる
      this.loadGradeTableFallback();
    }
  }
  
  // フォールバック: JSONファイルを直接読み込む
  async loadGradeTableFallback() {
    // プリレンダリング時はスキップ
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const response = await fetch('/assets/grade-table.json');
      if (response.ok) {
        const data = await response.json();
        this.gradeTable = data;
      }
    } catch (error) {
      // エラーをログに出力しない（プリレンダリング時のエラーは無視）
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
      employmentType: ['', Validators.required],
      initialPassword: ['', [Validators.required, Validators.minLength(6)]]
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
    // 入社手続きタブが選択された場合、新入社員一覧を読み込む
    if (tabName === '入社手続き') {
      this.loadOnboardingEmployees().catch(err => {
        console.error('Error in loadOnboardingEmployees:', err);
      });
    }
    // 保険証管理タブが選択された場合、保険証一覧を読み込む
    if (tabName === '保険証管理') {
      this.loadInsuranceCards().catch(err => {
        console.error('Error in loadInsuranceCards:', err);
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
  
  // 新入社員一覧を読み込む
  async loadOnboardingEmployees() {
    try {
      const employees = await this.firestoreService.getAllOnboardingEmployees();
      // FirestoreのTimestampをDateに変換
      this.onboardingEmployees = employees.map((emp: any) => {
        if (emp.createdAt && typeof emp.createdAt.toDate === 'function') {
          emp.createdAt = emp.createdAt.toDate();
        }
        if (emp.updatedAt && typeof emp.updatedAt.toDate === 'function') {
          emp.updatedAt = emp.updatedAt.toDate();
        }
        return emp;
      });

      // 入社時申請が届いているかチェックしてステータスを更新
      try {
        const onboardingApplications = await this.firestoreService.getEmployeeApplicationsByType('入社時申請');
        for (const app of onboardingApplications) {
          const employee = this.onboardingEmployees.find((emp: any) => emp.employeeNumber === app.employeeNumber);
          if (employee && employee.status === '申請待ち') {
            await this.firestoreService.updateOnboardingEmployeeStatus(employee.employeeNumber, '申請済み');
            employee.status = '申請済み';
          }
        }
      } catch (error) {
        console.error('Error checking onboarding applications:', error);
      }
    } catch (error) {
      console.error('Error loading onboarding employees:', error);
      this.onboardingEmployees = [];
    }
  }

  // 申請一覧を読み込む
  async loadAllApplications() {
    try {
      const applications = await this.firestoreService.getAllApplications();
      // FirestoreのTimestampをDateに変換
      let allApps = applications.map((app: any) => {
        if (app.createdAt && typeof app.createdAt.toDate === 'function') {
          app.createdAt = app.createdAt.toDate();
        }
        if (app.updatedAt && typeof app.updatedAt.toDate === 'function') {
          app.updatedAt = app.updatedAt.toDate();
        }
        return app;
      });
      
      // 入社時申請を除外
      this.allApplications = allApps.filter((app: any) => app.applicationType !== '入社時申請');
      
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
    
    // 文書自動作成欄を初期化
    this.availableDocuments = [];
    this.documentCheckboxes = {};
    
    // 現在のステータスが承認済みの場合、対応する文書を取得
    if (application.status === '承認済み') {
      this.updateAvailableDocuments();
    }
  }
  
  // 申請詳細モーダルを閉じる
  closeApplicationDetailModal() {
    this.showApplicationDetailModal = false;
    this.selectedApplication = null;
    this.statusComment = '';
  }
  
  // ステータス変更時の処理（コメント表示の制御、文書自動作成欄の表示）
  onStatusChange() {
    const selectedStatus = this.statusChangeForm.get('status')?.value;
    if (selectedStatus === '差し戻し') {
      this.statusChangeForm.get('comment')?.setValidators([]);
    } else {
      this.statusChangeForm.get('comment')?.clearValidators();
    }
    this.statusChangeForm.get('comment')?.updateValueAndValidity();
    
    // 承認済みの場合、対応する文書を取得
    if (selectedStatus === '承認済み') {
      this.updateAvailableDocuments();
    } else {
      this.availableDocuments = [];
      this.documentCheckboxes = {};
    }
  }

  // 申請種類に対応した文書を取得
  updateAvailableDocuments() {
    if (!this.selectedApplication) {
      this.availableDocuments = [];
      return;
    }

    const applicationType = this.selectedApplication.applicationType;
    const documents: string[] = [];

    // 申請種類に対応した文書をマッピング
    switch (applicationType) {
      case '扶養家族追加':
        documents.push('健康保険被扶養者（異動）届');
        break;
      case '扶養削除申請':
        documents.push('健康保険被扶養者（異動）届');
        break;
      case '住所変更申請':
        documents.push('健康保険・厚生年金保険 被保険者住所変更届');
        break;
      case '氏名変更申請':
        documents.push('被保険者氏名変更届');
        break;
      case '産前産後休業申請':
        documents.push('健康保険・厚生年金保険 産前産後休業取得者申出書／変更（終了）届');
        break;
      case '退職申請':
        documents.push('健康保険・厚生年金保険被保険者資格喪失届');
        // 任意継続保険に加入する場合のみ追加
        if (this.selectedApplication.postResignationSocialInsurance === '任意継続保険に加入する' || 
            this.selectedApplication.postResignationInsurance === '任意継続保険に加入する') {
          documents.push('健康保険 任意継続被保険者資格取得申請書');
        }
        break;
      case '保険証再発行申請':
        documents.push('健康保険被保険者証再交付申請書');
        break;
    }

    this.availableDocuments = documents;
    // チェックボックスを初期化（すべてチェック済み）
    this.documentCheckboxes = {};
    documents.forEach(doc => {
      this.documentCheckboxes[doc] = true;
    });
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
      
      // 承認済みの場合、チェックが入った文書をダウンロード
      if (status === '承認済み' && this.availableDocuments.length > 0) {
        await this.downloadSelectedDocuments();
      }
      
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

  // 選択された文書をダウンロード（文書作成ページと同じ処理）
  async downloadSelectedDocuments() {
    if (!this.selectedApplication) {
      return;
    }

    const employeeNumber = this.selectedApplication.employeeNumber || '';
    const employeeName = this.selectedApplication.employeeName || this.selectedApplication.name || '';

    // 社会保険料一覧が読み込まれていない場合は読み込む（標準報酬月額を取得するため）
    if (this.insuranceList.length === 0) {
      await this.loadInsuranceList();
    }

    // 従業員の詳細データを取得
    const employeeData = await this.firestoreService.getEmployeeData(employeeNumber);
    if (!employeeData) {
      console.error('従業員データの取得に失敗しました:', employeeNumber);
      return;
    }

    // チェックが入った文書をダウンロード
    for (const documentName of this.availableDocuments) {
      if (this.documentCheckboxes[documentName]) {
        try {
          // 文書に必要な情報を収集
          const documentInfo = await this.collectDocumentInfo(documentName, employeeData);

          // 1. テンプレートPDFをそのままダウンロード（情報を記入しない）
          const pdfBytes = await this.pdfEditService.loadPdfTemplate(documentName);
          const pdfFileName = `${documentName}_${employeeNumber}_${employeeName}.pdf`;
          this.pdfEditService.downloadPdf(pdfBytes, pdfFileName);

          // 2. 必要な情報をテキストファイルとしてダウンロード
          const hasMissingInfo = Object.values(documentInfo).some(value => value === '情報なし' || (typeof value === 'string' && value.includes('情報なし')));
          
          let fileContent = `${documentName} 作成に必要な情報\n`;
          fileContent += `========================================\n\n`;
          fileContent += `社員番号: ${employeeNumber}\n`;
          fileContent += `従業員氏名: ${employeeName}\n\n`;
          fileContent += `必要な情報一覧:\n`;
          fileContent += `----------------------------------------\n\n`;
          
          for (const [key, value] of Object.entries(documentInfo)) {
            fileContent += `${key}: ${value}\n`;
          }
          
          if (hasMissingInfo) {
            fileContent += `\n\n========================================\n`;
            fileContent += `注意: 情報が不足しているため、「情報なし」と記載しています。\n`;
            fileContent += `不足している情報を確認し、必要に応じて設定ページや社員情報を更新してください。\n`;
          }
          
          // テキストファイルをダウンロード
          const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const textFileName = `${documentName}作成に必要な情報_${employeeNumber}_${employeeName}.txt`;
          link.download = textFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error(`Error downloading document ${documentName}:`, error);
          alert(`文書「${documentName}」のダウンロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
      }
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
      
      // 各社員を新入社員一覧に保存
      for (const employee of newEmployees) {
        try {
          // 新入社員データを保存（ステータス: 申請待ち）
          await this.firestoreService.saveOnboardingEmployee(employee.employeeNumber, {
            employeeNumber: employee.employeeNumber,
            name: employee.name,
            email: employee.email,
            employmentType: employee.employmentType,
            password: employee.initialPassword, // パスワードを保存（後でハッシュ化推奨）
            isInitialPassword: true // 初期パスワードフラグ
          });
          
          // メール送信
          try {
            await this.firestoreService.sendOnboardingEmail(
              employee.email,
              employee.name,
              employee.initialPassword
            );
          } catch (emailError) {
            console.error('Error sending email:', emailError);
            // メール送信エラーは警告のみ（社員追加は成功）
            alert(`${employee.name}さんのメール送信に失敗しましたが、社員データは保存されました。`);
          }
        } catch (error) {
          console.error('Error adding employee:', error);
          alert(`${employee.name}さんの追加に失敗しました`);
        }
      }
      
      // モーダルを閉じる
      this.closeAddModal();
      
      // 新入社員一覧を再読み込み
      await this.loadOnboardingEmployees();
      
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
      fixedSalary: [''],
      
      // 保険証情報（人事専用）
      insuranceSymbol: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      insuranceNumber: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      insuranceCardIssueDate: [''],
      insuranceCardReturnDate: [''],
      insuranceCardStatus: [''], // 固定的賃金
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

    // 保険証情報を設定
    if (data.insuranceSymbol) {
      this.employeeEditForm.patchValue({
        insuranceSymbol: data.insuranceSymbol.toString()
      });
    }
    if (data.insuranceNumber) {
      this.employeeEditForm.patchValue({
        insuranceNumber: data.insuranceNumber.toString()
      });
    }
    if (data.insuranceCardIssueDate) {
      this.employeeEditForm.patchValue({
        insuranceCardIssueDate: data.insuranceCardIssueDate
      });
    }
    if (data.insuranceCardReturnDate) {
      this.employeeEditForm.patchValue({
        insuranceCardReturnDate: data.insuranceCardReturnDate
      });
    }
    if (data.insuranceCardStatus) {
      this.employeeEditForm.patchValue({
        insuranceCardStatus: data.insuranceCardStatus
      });
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

  // 被保険者記号の入力フォーマット（数字8桁のみ）
  formatInsuranceSymbolInput(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 8) {
      value = value.substring(0, 8);
    }
    event.target.value = value;
    this.employeeEditForm.get('insuranceSymbol')?.setValue(value, { emitEvent: false });
  }

  // 被保険者番号の入力フォーマット（数字3桁のみ）
  formatInsuranceNumberInput(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 3) {
      value = value.substring(0, 3);
    }
    event.target.value = value;
    this.employeeEditForm.get('insuranceNumber')?.setValue(value, { emitEvent: false });
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
        
        // 保険証管理テーブルを更新（保険証情報が変更された場合に備えて）
        if (this.currentTab === '保険証管理') {
          await this.loadInsuranceCards();
        }
        
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

  /**
   * 文書に必要な情報を収集する
   */
  async collectDocumentInfo(documentType: string, employeeData: any): Promise<any> {
    const info: any = {};
    const getValue = (key: string, defaultValue: string = '情報なし') => {
      const value = employeeData[key];
      // null, undefined, 空文字列の場合はデフォルト値を返す
      if (value === null || value === undefined || value === '') {
        return defaultValue;
      }
      return String(value);
    };

    // 企業情報を取得
    const settings = await this.firestoreService.getSettings();
    const companyInfo = settings?.companyInfo || this.companyInfo;

    // マイナンバーを組み立て（my-number-inputsクラスから取得）
    // FirestoreにはmyNumberとして12桁の文字列で保存されているが、
    // フォームではmyNumberPart1, myNumberPart2, myNumberPart3として分割されている
    // 両方の形式に対応
    let myNumber = '';
    if (employeeData?.myNumber && employeeData.myNumber.length === 12) {
      // myNumberが12桁の文字列として保存されている場合
      myNumber = `${employeeData.myNumber.substring(0, 4)}-${employeeData.myNumber.substring(4, 8)}-${employeeData.myNumber.substring(8, 12)}`;
    } else if (employeeData?.myNumberPart1 && employeeData?.myNumberPart2 && employeeData?.myNumberPart3) {
      // myNumberPart1, myNumberPart2, myNumberPart3として保存されている場合
      myNumber = `${employeeData.myNumberPart1}-${employeeData.myNumberPart2}-${employeeData.myNumberPart3}`;
    }

    // 基礎年金番号を組み立て（basic-pension-number-containerクラスから取得）
    // FirestoreにはbasicPensionNumberとして保存されているが、
    // フォームではbasicPensionNumberPart1, basicPensionNumberPart2として分割されている
    // 両方の形式に対応
    let basicPensionNumber = '';
    if (employeeData?.basicPensionNumber) {
      // basicPensionNumberが文字列として保存されている場合
      const basicPensionStr = employeeData.basicPensionNumber.toString();
      if (basicPensionStr.length >= 4) {
        basicPensionNumber = `${basicPensionStr.substring(0, 4)}${basicPensionStr.substring(4, 10) || ''}`;
      }
    } else if (employeeData?.basicPensionNumberPart1 && employeeData?.basicPensionNumberPart2) {
      // basicPensionNumberPart1, basicPensionNumberPart2として保存されている場合
      basicPensionNumber = `${employeeData.basicPensionNumberPart1}${employeeData.basicPensionNumberPart2}`;
    }

    // 社会保険料一覧から標準報酬月額を取得
    const employeeNumber = employeeData.employeeNumber || '';
    const insuranceItem = this.insuranceList.find((item: any) => item.employeeNumber === employeeNumber);
    const standardMonthlySalary = insuranceItem?.standardMonthlySalary || 0;

    switch (documentType) {
      case '健康保険・厚生年金保険被保険者資格取得届':
        info['事業所整理記号'] = companyInfo.officeCode || '情報なし';
        info['事業所番号'] = companyInfo.officeNumber || '情報なし';
        info['事業所住所'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['事業所電話番号'] = companyInfo.officePhoneNumber || '情報なし';
        info['被保険者氏名'] = getValue('name');
        info['生年月日'] = getValue('birthDate');
        info['性別'] = getValue('gender');
        info['マイナンバー'] = myNumber || '情報なし';
        info['基礎年金番号'] = basicPensionNumber || '情報なし';
        info['資格取得年月日'] = getValue('socialInsuranceAcquisitionDate');
        info['被扶養者（有/無）'] = getValue('hasDependents') === 'true' ? '有' : '無';
        info['報酬月額'] = standardMonthlySalary > 0 ? `${standardMonthlySalary.toLocaleString()}円` : '情報なし';
        const age1 = parseInt(getValue('age', '0')) || 0;
        const isPartTime1 = getValue('isPartTime') === 'true';
        info['備考欄（70歳以上か、短時間労働者かなど）'] = 
          (age1 >= 70 ? '70歳以上' : '') + 
          (isPartTime1 ? '短時間労働者' : '') || '情報なし';
        info['被保険者住所'] = getValue('currentAddress');
        break;

      case '健康保険・厚生年金保険被保険者資格喪失届':
        info['事業所整理記号'] = companyInfo.officeCode || '情報なし';
        info['事業所番号'] = companyInfo.officeNumber || '情報なし';
        info['事業所住所'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['事業所電話番号'] = companyInfo.officePhoneNumber || '情報なし';
        info['被保険者整理番号'] = getValue('healthInsuranceNumber');
        info['氏名'] = getValue('name');
        info['生年月日'] = getValue('birthDate');
        info['マイナンバー'] = myNumber || '情報なし';
        info['基礎年金番号'] = basicPensionNumber || '情報なし';
        info['資格喪失年月日'] = getValue('socialInsuranceLossDate');
        info['喪失原因'] = getValue('resignationReason');
        const age2 = parseInt(getValue('age', '0')) || 0;
        info['70歳以上か'] = age2 >= 70 ? 'はい' : 'いいえ';
        if (info['70歳以上か'] === 'はい') {
          info['喪失年月日'] = getValue('socialInsuranceLossDate');
        }
        break;

      case '健康保険 任意継続被保険者資格取得申請書':
        info['勤務先の都道府県支部'] = settings?.prefecture || '情報なし';
        info['提出日'] = new Date().toLocaleDateString('ja-JP');
        info['被保険者証記号/番号'] = getValue('healthInsuranceNumber');
        info['生年月日'] = getValue('birthDate');
        info['氏名（カタカナ）'] = getValue('nameKana');
        info['氏名（漢字）'] = getValue('name');
        info['性別'] = getValue('gender');
        const postalCode = getValue('currentAddress').match(/\d{3}-?\d{4}/)?.[0] || '情報なし';
        info['郵便番号（ハイフンなし）'] = postalCode.replace(/-/g, '');
        info['電話番号（ハイフンなし）'] = getValue('phoneNumber').replace(/-/g, '');
        info['住所'] = getValue('currentAddress');
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業所所在地'] = companyInfo.officeAddress || '情報なし';
        info['資格喪失年月日（退職日の翌日）'] = getValue('socialInsuranceLossDate');
        info['保険料の納付方法'] = '情報なし';
        // 被扶養者の情報（簡易版）
        info['被扶養者氏名'] = '情報なし';
        info['被扶養者氏名（カタカナ）'] = '情報なし';
        info['被扶養者生年月日'] = '情報なし';
        info['被扶養者性別'] = '情報なし';
        info['被扶養者族柄'] = '情報なし';
        info['被扶養者職業'] = '情報なし';
        info['被扶養者収入（年間）'] = '情報なし';
        info['被扶養者マイナンバー'] = '情報なし';
        info['被扶養者同居/別居'] = '情報なし';
        break;

      case '健康保険被扶養者（異動）届':
        info['事業所整理番号'] = companyInfo.officeCode || '情報なし';
        info['事業所所在地'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['電話番号'] = companyInfo.officePhoneNumber || '情報なし';
        info['被保険者整理番号'] = getValue('healthInsuranceNumber');
        info['被保険者氏名'] = getValue('name');
        info['被保険者生年月日'] = getValue('birthDate');
        info['被保険者性別'] = getValue('gender');
        info['マイナンバー'] = myNumber !== '--' ? myNumber : '情報なし';
        info['資格取得年月日'] = getValue('socialInsuranceAcquisitionDate');
        info['年収'] = getValue('annualSalary');
        // 扶養者情報（簡易版）
        info['扶養者氏名'] = '情報なし';
        info['扶養者生年月日'] = '情報なし';
        info['扶養者性別'] = '情報なし';
        info['扶養者マイナンバー'] = '情報なし';
        info['扶養者住所'] = '情報なし';
        info['扶養者電話番号'] = '情報なし';
        info['扶養者になった日/はずれる日'] = '情報なし';
        info['扶養された理由/扶養から外れる理由'] = '情報なし';
        info['扶養者職業'] = '情報なし';
        info['扶養者収入'] = '情報なし';
        break;

      case '健康保険資格確認書交付申請書':
      case '健康保険資格確認書再交付申請書':
      case '健康保険被保険者証再交付申請書': // 保険証再発行申請に対応
        info['被保険者記号'] = getValue('insuranceSymbol');
        info['被保険者番号'] = getValue('healthInsuranceNumber');
        info['マイナンバー'] = myNumber || '情報なし';
        info['被保険者氏名'] = getValue('name');
        info['被保険者氏名（カタカナ）'] = getValue('nameKana');
        const postalCode2 = getValue('currentAddress').match(/\d{3}-?\d{4}/)?.[0] || '情報なし';
        info['郵便番号'] = postalCode2;
        info['電話番号'] = getValue('phoneNumber');
        info['住所'] = getValue('currentAddress');
        info['事業所所在地'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['事業所電話番号'] = companyInfo.officePhoneNumber || '情報なし';
        break;

      case '被保険者住所変更届':
      case '健康保険・厚生年金保険 被保険者住所変更届': // 住所変更申請に対応
        info['事業所整理番号'] = companyInfo.officeCode || '情報なし';
        info['被保険者整理番号'] = getValue('healthInsuranceNumber');
        const postalCode3 = getValue('currentAddress').match(/\d{3}-?\d{4}/)?.[0] || '情報なし';
        info['事業所郵便番号'] = postalCode3;
        info['事業所所在地'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['マイナンバー'] = myNumber || '情報なし';
        info['基本年金番号'] = basicPensionNumber || '情報なし';
        info['氏名'] = getValue('name');
        info['氏名（カタカナ）'] = getValue('nameKana');
        info['生年月日'] = getValue('birthDate');
        const newPostalCode = getValue('currentAddress').match(/\d{3}-?\d{4}/)?.[0] || '情報なし';
        info['変更後の郵便番号'] = newPostalCode;
        info['変更後の住所'] = getValue('currentAddress');
        info['変更前の住所'] = getValue('residentAddress');
        info['被保険者と配偶者は同居しているか'] = getValue('sameAsCurrentAddress') === 'true' ? 'はい' : 'いいえ';
        info['配偶者のマイナンバー'] = '情報なし';
        info['配偶者の生年月日'] = '情報なし';
        info['配偶者の氏名'] = '情報なし';
        if (info['被保険者と配偶者は同居しているか'] === 'いいえ') {
          info['配偶者の郵便番号'] = '情報なし';
          info['配偶者の住所'] = '情報なし';
        }
        break;

      case '被保険者氏名変更届':
        info['事業所所在地'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['事業所電話番号'] = companyInfo.officePhoneNumber || '情報なし';
        info['事業所整理番号'] = companyInfo.officeCode || '情報なし';
        info['被保険者整理番号'] = getValue('healthInsuranceNumber');
        info['マイナンバー'] = myNumber || '情報なし';
        info['基礎年金番号'] = basicPensionNumber || '情報なし';
        info['生年月日'] = getValue('birthDate');
        info['変更前の被保険者氏名'] = '情報なし';
        info['変更前の氏名（フリガナ）'] = '情報なし';
        info['変更後の被保険者氏名'] = getValue('name');
        info['変更後の氏名（フリガナ）'] = getValue('nameKana');
        break;

      case '産前産後休業取得者申出書／変更（終了）届':
        info['事業所整理記号'] = companyInfo.officeCode || '情報なし';
        info['事業所所在地'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['電話番号'] = companyInfo.officePhoneNumber || '情報なし';
        info['被保険者整理番号'] = getValue('healthInsuranceNumber');
        info['マイナンバー'] = myNumber || '情報なし';
        info['基礎年金番号'] = basicPensionNumber || '情報なし';
        info['被保険者氏名'] = getValue('name');
        info['被保険者生年月日'] = getValue('birthDate');
        info['出産予定年月日'] = '情報なし';
        info['産前産後休業開始年月日'] = '情報なし';
        info['産前産後休業終了年月日'] = '情報なし';
        info['出産年月日'] = '情報なし';
        info['社会保険労務士'] = '情報なし';
        break;

      case '算定基礎届':
        info['事業所整理記号'] = companyInfo.officeCode || '情報なし';
        info['事業所所在地'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['事業所電話番号'] = companyInfo.officePhoneNumber || '情報なし';
        info['被保険者整理番号'] = getValue('healthInsuranceNumber');
        info['被保険者氏名'] = getValue('name');
        info['被保険者生年月日'] = getValue('birthDate');
        info['標準報酬月額'] = standardMonthlySalary > 0 ? `${standardMonthlySalary.toLocaleString()}円` : '情報なし';
        info['給与計算の基礎日数'] = '情報なし';
        info['通貨による給与'] = '情報なし';
        info['現物による給与'] = '情報なし';
        info['月の合計'] = '情報なし';
        info['支払い基礎日数が4分の3以上の月の総計'] = '情報なし';
        info['総計の平均額'] = '情報なし';
        info['マイナンバー'] = myNumber || '情報なし';
        info['基礎年金番号'] = basicPensionNumber || '情報なし';
        const age3 = parseInt(getValue('age', '0')) || 0;
        info['70歳以上か'] = age3 >= 70 ? 'はい' : 'いいえ';
        info['短時間労働者か'] = getValue('isPartTime') === 'true' ? 'はい' : 'いいえ';
        break;

      case '被保険者報酬月額変更届':
        info['事業所整理記号'] = companyInfo.officeCode || '情報なし';
        info['事業所所在地'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['事業所電話番号'] = companyInfo.officePhoneNumber || '情報なし';
        info['被保険者整理番号'] = getValue('healthInsuranceNumber');
        info['被保険者氏名'] = getValue('name');
        info['被保険者生年月日'] = getValue('birthDate');
        info['被保険者改定年月'] = '情報なし';
        info['標準報酬月額'] = standardMonthlySalary > 0 ? `${standardMonthlySalary.toLocaleString()}円` : '情報なし';
        info['給与改定月'] = '情報なし';
        info['昇給（降給）額'] = '情報なし';
        info['直近3か月支給額'] = '情報なし';
        info['給与支給月（直近3か月分）'] = '情報なし';
        info['通貨による給与（直近3か月分）'] = '情報なし';
        info['現物による給与（直近3か月分）'] = '情報なし';
        info['通貨と現物の合計（直近3か月分）'] = '情報なし';
        info['３か月の総計'] = '情報なし';
        info['総計の平均額'] = '情報なし';
        const age4 = parseInt(getValue('age', '0')) || 0;
        if (age4 >= 70) {
          info['マイナンバー（70歳以上被保険者の場合のみ）'] = myNumber || '情報なし';
          info['基礎年金番号（70歳以上被保険者の場合のみ）'] = basicPensionNumber || '情報なし';
        } else {
          info['マイナンバー（70歳以上被保険者の場合のみ）'] = '情報なし';
          info['基礎年金番号（70歳以上被保険者の場合のみ）'] = '情報なし';
        }
        info['70歳以上か'] = age4 >= 70 ? 'はい' : 'いいえ';
        info['短時間労働者か'] = getValue('isPartTime') === 'true' ? 'はい' : 'いいえ';
        info['給与変動の理由'] = '情報なし';
        break;

      case '健康保険・厚生年金保険被保険者賞与支払届':
        info['事業所整理記号'] = companyInfo.officeCode || '情報なし';
        info['事業所所在地'] = companyInfo.officeAddress || '情報なし';
        info['事業所名称'] = companyInfo.officeName || '情報なし';
        info['事業主氏名'] = companyInfo.employerName || '情報なし';
        info['事業所電話番号'] = companyInfo.officePhoneNumber || '情報なし';
        info['被保険者整理番号'] = getValue('healthInsuranceNumber');
        info['被保険者氏名'] = getValue('name');
        info['被保険者生年月日'] = getValue('birthDate');
        const age5 = parseInt(getValue('age', '0')) || 0;
        if (age5 >= 70) {
          info['マイナンバー（70歳以上被保険者のみ）'] = myNumber || '情報なし';
          info['基礎年金番号（70歳以上被保険者のみ）'] = basicPensionNumber || '情報なし';
        } else {
          info['マイナンバー（70歳以上被保険者のみ）'] = '情報なし';
          info['基礎年金番号（70歳以上被保険者のみ）'] = '情報なし';
        }
        info['賞与支払い年月日'] = '情報なし';
        info['賞与支払額（通貨）'] = '情報なし';
        info['賞与支給額（現物）'] = '情報なし';
        info['標準賞与額'] = '情報なし';
        const age6 = parseInt(getValue('age', '0')) || 0;
        info['70歳以上か'] = age6 >= 70 ? 'はい' : 'いいえ';
        info['同一月内の賞与か'] = '情報なし';
        break;

      default:
        info['情報'] = 'この文書タイプの情報収集は未実装です';
    }

    return info;
  }

  /**
   * 文書に必要な情報を表示する（ファイルダウンロード）
   */
  async showDocumentInfo() {
    if (!this.selectedDocumentType || !this.selectedEmployee) {
      alert('文書種類と従業員を選択してください');
      return;
    }

    try {
      // 社会保険料一覧が読み込まれていない場合は読み込む（標準報酬月額を取得するため）
      if (this.insuranceList.length === 0) {
        await this.loadInsuranceList();
      }

      // 従業員の詳細データを取得
      const employeeData = await this.firestoreService.getEmployeeData(
        this.selectedEmployee.employeeNumber
      );

      if (!employeeData) {
        alert('従業員データの取得に失敗しました');
        return;
      }

      // 文書に必要な情報を収集
      const documentInfo = await this.collectDocumentInfo(this.selectedDocumentType, employeeData);
      
      // 「情報なし」が含まれているかチェック
      const hasMissingInfo = Object.values(documentInfo).some(value => value === '情報なし' || (typeof value === 'string' && value.includes('情報なし')));
      
      // ファイル内容を生成
      let fileContent = `${this.selectedDocumentType} 作成に必要な情報\n`;
      fileContent += `========================================\n\n`;
      fileContent += `社員番号: ${this.selectedEmployee.employeeNumber}\n`;
      fileContent += `従業員氏名: ${this.selectedEmployee.name}\n\n`;
      fileContent += `必要な情報一覧:\n`;
      fileContent += `----------------------------------------\n\n`;
      
      for (const [key, value] of Object.entries(documentInfo)) {
        fileContent += `${key}: ${value}\n`;
      }
      
      if (hasMissingInfo) {
        fileContent += `\n\n========================================\n`;
        fileContent += `注意: 情報が不足しているため、「情報なし」と記載しています。\n`;
        fileContent += `不足している情報を確認し、必要に応じて設定ページや社員情報を更新してください。\n`;
      }
      
      // ファイルをダウンロード
      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `${this.selectedDocumentType}作成に必要な情報_${this.selectedEmployee.employeeNumber}_${this.selectedEmployee.name}.txt`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // メッセージを表示
      if (hasMissingInfo) {
        alert('情報が不足しているため、「情報なし」と記載しています。\nダウンロードしたファイルを確認し、不足している情報を設定ページや社員情報から更新してください。');
      } else {
        alert('必要な情報をファイルとしてダウンロードしました。');
      }
    } catch (error) {
      console.error('Error collecting document info:', error);
      alert('情報の収集に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    }
  }

  /**
   * 文書を作成する（テンプレートPDFと情報テキストファイルをダウンロード）
   */
  async createDocument() {
    if (!this.selectedDocumentType || !this.selectedEmployee) {
      alert('文書種類と従業員を選択してください');
      return;
    }

    this.isCreatingDocument = true;

    try {
      // 社会保険料一覧が読み込まれていない場合は読み込む（標準報酬月額を取得するため）
      if (this.insuranceList.length === 0) {
        await this.loadInsuranceList();
      }

      // 従業員の詳細データを取得
      const employeeData = await this.firestoreService.getEmployeeData(
        this.selectedEmployee.employeeNumber
      );

      if (!employeeData) {
        alert('従業員データの取得に失敗しました');
        return;
      }

      // 文書に必要な情報を収集
      const documentInfo = await this.collectDocumentInfo(this.selectedDocumentType, employeeData);

      // 1. テンプレートPDFをそのままダウンロード（情報を記入しない）
      const pdfBytes = await this.pdfEditService.loadPdfTemplate(this.selectedDocumentType);
      const pdfFileName = `${this.selectedDocumentType}_${this.selectedEmployee.employeeNumber}_${this.selectedEmployee.name}.pdf`;
      this.pdfEditService.downloadPdf(pdfBytes, pdfFileName);

      // 2. 必要な情報をテキストファイルとしてダウンロード
      const hasMissingInfo = Object.values(documentInfo).some(value => value === '情報なし' || (typeof value === 'string' && value.includes('情報なし')));
      
      let fileContent = `${this.selectedDocumentType} 作成に必要な情報\n`;
      fileContent += `========================================\n\n`;
      fileContent += `社員番号: ${this.selectedEmployee.employeeNumber}\n`;
      fileContent += `従業員氏名: ${this.selectedEmployee.name}\n\n`;
      fileContent += `必要な情報一覧:\n`;
      fileContent += `----------------------------------------\n\n`;
      
      for (const [key, value] of Object.entries(documentInfo)) {
        fileContent += `${key}: ${value}\n`;
      }
      
      if (hasMissingInfo) {
        fileContent += `\n\n========================================\n`;
        fileContent += `注意: 情報が不足しているため、「情報なし」と記載しています。\n`;
        fileContent += `不足している情報を確認し、必要に応じて設定ページや社員情報を更新してください。\n`;
      }
      
      // テキストファイルをダウンロード
      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const textFileName = `${this.selectedDocumentType}作成に必要な情報_${this.selectedEmployee.employeeNumber}_${this.selectedEmployee.name}.txt`;
      link.download = textFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // メッセージを表示
      if (hasMissingInfo) {
        alert('文書テンプレートと必要な情報ファイルをダウンロードしました。\n\n注意: 情報が不足しているため、「情報なし」と記載しています。\n不足している情報を確認し、必要に応じて設定ページや社員情報を更新してください。');
      } else {
        alert('文書テンプレートと必要な情報ファイルをダウンロードしました。');
      }
    } catch (error) {
      console.error('Error creating document:', error);
      alert('文書の作成に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      this.isCreatingDocument = false;
    }
  }

  /**
   * PDFの座標を確認するためのデバッグPDFを生成
   */
  async debugPdfCoordinates() {
    if (!this.selectedDocumentType) {
      alert('文書種類を選択してください');
      return;
    }

    try {
      const pdfBytes = await this.pdfEditService.debugPdfCoordinates(this.selectedDocumentType);
      const fileName = `debug_coordinates_${this.selectedDocumentType}_${new Date().getTime()}.pdf`;
      this.pdfEditService.downloadPdf(pdfBytes, fileName);
      alert('座標確認用PDFをダウンロードしました。PDF上に座標グリッドが表示されます。');
    } catch (error) {
      console.error('Error generating debug PDF:', error);
      alert('座標確認用PDFの生成に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    }
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

  // 保険証一覧を読み込む
  async loadInsuranceCards() {
    try {
      const allEmployees = await this.firestoreService.getAllEmployees();
      
      this.insuranceCards = allEmployees
        .filter(emp => emp.employeeNumber && emp.name && (emp.insuranceSymbol || emp.insuranceNumber))
        .map(emp => {
          // insuranceCardStatusが存在する場合はそれを使用、存在しない場合はデフォルト値
          // nullや空文字列の場合はデフォルト値を使用
          let status = '配布済み';
          if (emp.insuranceCardStatus && emp.insuranceCardStatus !== null && emp.insuranceCardStatus !== '') {
            status = emp.insuranceCardStatus;
          }
          
          return {
            employeeNumber: emp.employeeNumber,
            name: emp.name || '',
            insuranceSymbol: emp.insuranceSymbol || '',
            insuranceNumber: emp.insuranceNumber || '',
            issueDate: emp.insuranceCardIssueDate || emp.insuranceIssueDate || '',
            returnDate: emp.insuranceCardReturnDate || '',
            status: status
          };
        });
    } catch (error) {
      console.error('Error loading insurance cards:', error);
      this.insuranceCards = [];
    }
  }


  // 新入社員詳細モーダルを開く
  async openOnboardingEmployeeModal(employee: any) {
    this.selectedOnboardingEmployee = employee;
    this.onboardingStatusComment = employee.statusComment || '';
    this.showOnboardingEmployeeModal = true;
    
    // 入社時申請データを取得
    const applications = await this.firestoreService.getEmployeeApplicationsByType('入社時申請');
    const onboardingApp = applications.find((app: any) => app.employeeNumber === employee.employeeNumber);
    if (onboardingApp) {
      this.selectedOnboardingEmployee.applicationData = onboardingApp;
    }
  }

  // 新入社員詳細モーダルを閉じる
  closeOnboardingEmployeeModal() {
    this.showOnboardingEmployeeModal = false;
    this.selectedOnboardingEmployee = null;
    this.onboardingStatusComment = '';
  }

  // 新入社員のステータスを変更
  async updateOnboardingEmployeeStatus(newStatus: string) {
    if (!this.selectedOnboardingEmployee) return;

    try {
      await this.firestoreService.updateOnboardingEmployeeStatus(
        this.selectedOnboardingEmployee.employeeNumber,
        newStatus
      );

      // ステータスコメントを更新
      if (this.onboardingStatusComment) {
        await this.firestoreService.updateOnboardingEmployee(
          this.selectedOnboardingEmployee.employeeNumber,
          { statusComment: this.onboardingStatusComment }
        );
      }

      // 準備完了の場合、通常の社員データに移行
      if (newStatus === '準備完了') {
        const employeeData = await this.firestoreService.getOnboardingEmployee(
          this.selectedOnboardingEmployee.employeeNumber
        );
        if (employeeData) {
          // ステータスとコメントを除いて通常の社員データとして保存
          const { status, statusComment, createdAt, updatedAt, ...employeeDataWithoutStatus } = employeeData;
          await this.firestoreService.saveEmployeeData(
            this.selectedOnboardingEmployee.employeeNumber,
            employeeDataWithoutStatus
          );
        }
      }

      // 新入社員一覧を再読み込み
      await this.loadOnboardingEmployees();
      
      // モーダルを閉じる
      this.closeOnboardingEmployeeModal();
      
      alert(`ステータスを「${newStatus}」に変更しました`);
    } catch (error) {
      console.error('Error updating onboarding employee status:', error);
      alert('ステータスの変更に失敗しました');
    }
  }

  // 日付をフォーマット（YYYY-MM-DD → YYYY/MM/DD）
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    } catch (error) {
      return dateString;
    }
  }
}


