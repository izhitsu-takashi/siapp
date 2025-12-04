import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-kyuyo-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './kyuyo-dashboard.component.html',
  styleUrl: './kyuyo-dashboard.component.css'
})
export class KyuyoDashboardComponent {
  currentTab: string = '社会保険料';
  
  tabs = [
    { id: 'social-insurance', name: '社会保険料' },
    { id: 'salary', name: '給与' },
    { id: 'bonus', name: '賞与' },
    { id: 'settings', name: '設定' }
  ];

  userName = '給与担当者';

  // 社会保険料一覧データ
  insuranceList: any[] = [];
  filteredInsuranceList: any[] = []; // フィルタリング後の保険料一覧
  insuranceListYear: number = new Date().getFullYear(); // 保険料一覧の年（現在の年）
  insuranceListMonth: number = new Date().getMonth() + 1; // 保険料一覧の月（現在の月）
  insuranceListType: 'salary' | 'bonus' = 'salary'; // 給与または賞与の切り替え
  isLoadingInsuranceList: boolean = false; // 保険料一覧の読み込み中フラグ
  
  // 年月フィルター用の選択肢
  availableYears: number[] = [];
  availableMonths: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  
  // 社員一覧（社員情報管理票の社員のみ）
  employees: any[] = [];
  
  // 保険料率
  insuranceRates: any = {
    healthInsurance: 0,
    nursingInsurance: 0,
    pensionInsurance: 0
  };
  
  // 標準報酬月額等級表
  gradeTable: any = null;
  
  // 設定ページ用データ
  settingsForm!: FormGroup;
  healthInsuranceType: string = '協会けんぽ';
  selectedPrefecture: string = '';
  treatBonusAsReward: boolean = true; // 年4回以上の賞与を報酬と扱うか（デフォルト: はい）
  
  // 健康保険料率データ
  kenpoRates: any[] = [];
  
  // 協会けんぽ保険料率ファイル管理
  selectedKenpoRatesFile: File | null = null;
  selectedKenpoRatesFileName: string = '';
  
  // 等級表ファイル管理
  selectedGradeTableFile: File | null = null;
  selectedGradeTableFileName: string = '';
  
  // 給与ページ用データ
  salaryEmployees: any[] = []; // 給与設定対象の社員一覧
  selectedSalaryEmployee: string = ''; // 選択された社員番号
  salaryYear: number = new Date().getFullYear(); // 給与設定の年
  salaryMonth: number = new Date().getMonth() + 1; // 給与設定の月
  salaryAmount: number = 0; // 給与額（固定的賃金）
  salaryHistory: any[] = []; // 給与設定履歴
  filteredSalaryHistory: any[] = []; // フィルタリング後の給与設定履歴
  selectedSalaryHistoryFilter: string = ''; // 給与設定履歴のフィルター用社員番号
  
  // 賞与ページ用データ
  bonusEmployees: any[] = []; // 賞与設定対象の社員一覧
  selectedBonusEmployee: string = ''; // 選択された社員番号
  bonusYear: number = new Date().getFullYear(); // 賞与設定の年
  bonusMonth: number = new Date().getMonth() + 1; // 賞与設定の月
  bonusAmount: number = 0; // 賞与額
  bonusHistory: any[] = []; // 賞与設定履歴
  filteredBonusHistory: any[] = []; // フィルタリング後の賞与設定履歴
  selectedBonusHistoryFilter: string = ''; // 賞与設定履歴のフィルター用社員番号
  bonusList: any[] = []; // 賞与一覧（保険料計算用）

  // ローディング状態
  isSavingSalary = false;
  isSavingBonus = false;

  // 社員情報モーダル
  showEmployeeInfoModal = false;
  selectedEmployeeInfo: any = null;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private firestoreService: FirestoreService,
    private http: HttpClient,
    private fb: FormBuilder
  ) {
    this.settingsForm = this.createSettingsForm();
    
    // 年月フィルター用の選択肢を初期化（2025年から2030年まで）
    const currentYear = new Date().getFullYear();
    for (let year = 2025; year <= 2030; year++) {
      this.availableYears.push(year);
    }
    
    if (isPlatformBrowser(this.platformId)) {
      const storedName = sessionStorage.getItem('userName');
      if (storedName) {
        this.userName = storedName;
      }
      
      // 初期化処理
      this.initializeData();
    }
  }

  async initializeData() {
    // 等級表を読み込む
    await this.loadGradeTable();
    
    // 健康保険料率データを読み込む
    await this.loadKenpoRates();
    
    // 設定を読み込む
    await this.loadSettings();
    
    // 社員情報を読み込む
    await this.loadEmployees();
    
    // 給与設定履歴を読み込む
    const history = await this.firestoreService.getSalaryHistory();
    this.salaryHistory = history.sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // 社員名を追加
    for (const salary of this.salaryHistory) {
      const employee = this.employees.find((e: any) => e.employeeNumber === salary['employeeNumber']);
      if (employee) {
        salary.name = employee.name;
      }
    }
    
    // フィルターを適用
    this.filterSalaryHistory();
    
    // 社会保険料一覧を読み込む
    await this.loadInsuranceList();
  }
  
  // 設定フォームを作成
  createSettingsForm(): FormGroup {
    return this.fb.group({
      // 健康保険設定
      healthInsuranceType: ['協会けんぽ'],
      prefecture: [''], // 都道府県（協会けんぽ選択時のみ）
      // 保険料率設定
      healthInsuranceRate: [0],
      nursingInsuranceRate: [0],
      pensionInsuranceRate: [0],
      // 詳細設定
      treatBonusAsReward: [true] // 年4回以上の賞与を報酬と扱うか
    });
  }
  
  // 健康保険料率データを読み込む
  async loadKenpoRates() {
    if (typeof window === 'undefined') {
      this.kenpoRates = [];
      return;
    }

    try {
      // まずFirestoreから設定を読み込んで、kenpoRatesが保存されているか確認
      const settings = await this.firestoreService.getSettings();
      if (settings && settings.kenpoRates && Array.isArray(settings.kenpoRates) && settings.kenpoRates.length > 0) {
        this.kenpoRates = settings.kenpoRates;
        return;
      }
      
      // Firestoreに保存されていない場合は、assetsから読み込む
      const data = await this.http.get<any[]>('/assets/kenpo-rates.json').toPromise();
      if (data) {
        this.kenpoRates = data;
      }
    } catch (error) {
      // エラーをログに出力しない（プリレンダリング時のエラーは無視）
      this.kenpoRates = [];
    }
  }
  
  // 設定を読み込む
  async loadSettings() {
    try {
      // Firestoreから設定を読み込む
      const settings = await this.firestoreService.getSettings();
      
      if (settings) {
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
        
        // kenpoRatesを読み込む（Firestoreに保存されている場合）
        if (settings.kenpoRates && Array.isArray(settings.kenpoRates)) {
          this.kenpoRates = settings.kenpoRates;
        }
        
        // gradeTableを読み込む（Firestoreに保存されている場合）
        if (settings.gradeTable && settings.gradeTable.hyouzyungetugakuReiwa7) {
          this.gradeTable = settings.gradeTable;
        }
        
        // 詳細設定を読み込む
        if (settings.treatBonusAsReward !== undefined) {
          this.treatBonusAsReward = settings.treatBonusAsReward;
        }
        
        // フォームに値を設定
        this.settingsForm.patchValue({
          healthInsuranceType: this.healthInsuranceType,
          prefecture: this.selectedPrefecture,
          healthInsuranceRate: this.insuranceRates.healthInsurance,
          nursingInsuranceRate: this.insuranceRates.nursingInsurance,
          pensionInsuranceRate: this.insuranceRates.pensionInsurance,
          treatBonusAsReward: this.treatBonusAsReward
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
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
      
      // 詳細設定も更新
      this.treatBonusAsReward = this.settingsForm.get('treatBonusAsReward')?.value !== false;
      
      // Firestoreに保存
      await this.firestoreService.saveSettings({
        ...currentSettings,
        healthInsuranceType: this.healthInsuranceType,
        prefecture: this.selectedPrefecture,
        insuranceRates: this.insuranceRates,
        treatBonusAsReward: this.treatBonusAsReward
      });
      
      alert('健康保険設定を保存しました');
    } catch (error) {
      console.error('Error saving health insurance setting:', error);
      alert('健康保険設定の保存中にエラーが発生しました');
    }
  }
  
  // 詳細設定を保存
  async saveDetailSettings() {
    try {
      const formValue = this.settingsForm.value;
      
      // 詳細設定を更新
      this.treatBonusAsReward = formValue.treatBonusAsReward !== false; // デフォルトはtrue
      
      // Firestoreから現在の設定を取得してマージ
      const currentSettings = await this.firestoreService.getSettings() || {};
      
      // Firestoreに保存
      await this.firestoreService.saveSettings({
        ...currentSettings,
        treatBonusAsReward: this.treatBonusAsReward
      });
      
      alert('詳細設定を保存しました');
      
      // 社会保険料一覧を再読み込み
      await this.loadInsuranceList();
    } catch (error) {
      console.error('Error saving detail settings:', error);
      alert('詳細設定の保存中にエラーが発生しました');
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
      
      // 詳細設定も更新
      this.treatBonusAsReward = this.settingsForm.get('treatBonusAsReward')?.value !== false;
      
      // Firestoreから現在の設定を取得してマージ
      const currentSettings = await this.firestoreService.getSettings() || {};
      
      // Firestoreに保存
      await this.firestoreService.saveSettings({
        ...currentSettings,
        insuranceRates: this.insuranceRates,
        treatBonusAsReward: this.treatBonusAsReward
      });
      
      alert('保険料率設定を保存しました');
      
      // 社会保険料一覧を再読み込み
      await this.loadInsuranceList();
    } catch (error) {
      console.error('Error saving insurance rates:', error);
      alert('保険料率設定の保存中にエラーが発生しました');
    }
  }
  
  // kenpo-rates.jsonをダウンロード
  downloadKenpoRates() {
    try {
      const jsonData = JSON.stringify(this.kenpoRates, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'kenpo-rates.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading kenpo rates:', error);
      alert('ダウンロード中にエラーが発生しました');
    }
  }
  
  // kenpo-rates.jsonファイルを選択
  onKenpoRatesFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert('JSONファイルを選択してください');
        return;
      }
      this.selectedKenpoRatesFile = file;
      this.selectedKenpoRatesFileName = file.name;
    }
  }
  
  // アップロードしたkenpo-rates.jsonを適用
  async applyKenpoRates() {
    if (!this.selectedKenpoRatesFile) {
      alert('ファイルを選択してください');
      return;
    }
    
    try {
      const fileContent = await this.readFileAsText(this.selectedKenpoRatesFile);
      const parsedData = JSON.parse(fileContent);
      
      // データの形式を検証
      if (!Array.isArray(parsedData)) {
        alert('JSONファイルの形式が正しくありません。配列形式である必要があります。');
        return;
      }
      
      // 各要素の形式を検証
      for (const item of parsedData) {
        if (!item.prefecture || typeof item.healthRate !== 'number' || typeof item.careRate !== 'number') {
          alert('JSONファイルの形式が正しくありません。各要素にprefecture、healthRate、careRateが必要です。');
          return;
        }
      }
      
      // kenpoRatesを更新
      this.kenpoRates = parsedData;
      
      // Firestoreに保存（kenpoRatesをsettingsに保存）
      const currentSettings = await this.firestoreService.getSettings() || {};
      await this.firestoreService.saveSettings({
        ...currentSettings,
        kenpoRates: this.kenpoRates
      });
      
      // 現在選択されている都道府県の保険料率を再適用
      const selectedPrefecture = this.settingsForm.get('prefecture')?.value;
      if (selectedPrefecture && this.kenpoRates.length > 0) {
        const rateData = this.kenpoRates.find((rate: any) => rate.prefecture === selectedPrefecture);
        if (rateData) {
          this.settingsForm.patchValue({
            healthInsuranceRate: rateData.healthRate,
            nursingInsuranceRate: rateData.careRate
          });
          this.insuranceRates.healthInsurance = rateData.healthRate;
          this.insuranceRates.nursingInsurance = rateData.careRate;
        }
      }
      
      alert('保険料率を適用しました');
      
      // ファイル選択をリセット
      this.selectedKenpoRatesFile = null;
      this.selectedKenpoRatesFileName = '';
      
      // ファイル入力もリセット
      const fileInput = document.getElementById('kenpoRatesFile') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      // 社会保険料一覧を再読み込み
      await this.loadInsuranceList();
    } catch (error) {
      console.error('Error applying kenpo rates:', error);
      alert('ファイルの適用中にエラーが発生しました。JSONファイルの形式を確認してください。');
    }
  }
  
  // ファイルをテキストとして読み込む
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = (e) => {
        reject(e);
      };
      reader.readAsText(file);
    });
  }
  
  // 等級.jsonをダウンロード
  downloadGradeTable() {
    try {
      const jsonData = JSON.stringify(this.gradeTable, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '等級.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading grade table:', error);
      alert('ダウンロード中にエラーが発生しました');
    }
  }
  
  // 等級.jsonファイルを選択
  onGradeTableFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert('JSONファイルを選択してください');
        return;
      }
      this.selectedGradeTableFile = file;
      this.selectedGradeTableFileName = file.name;
    }
  }
  
  // アップロードした等級.jsonを適用
  async applyGradeTable() {
    if (!this.selectedGradeTableFile) {
      alert('ファイルを選択してください');
      return;
    }
    
    try {
      const fileContent = await this.readFileAsText(this.selectedGradeTableFile);
      const parsedData = JSON.parse(fileContent);
      
      // データの形式を検証
      if (!parsedData || typeof parsedData !== 'object') {
        alert('JSONファイルの形式が正しくありません。オブジェクト形式である必要があります。');
        return;
      }
      
      // hyouzyungetugakuReiwa7が存在するか確認
      if (!parsedData.hyouzyungetugakuReiwa7 || !Array.isArray(parsedData.hyouzyungetugakuReiwa7)) {
        alert('JSONファイルの形式が正しくありません。hyouzyungetugakuReiwa7プロパティが必要です。');
        return;
      }
      
      // 各要素の形式を検証（hyouzyungetugakuReiwa7）
      for (const item of parsedData.hyouzyungetugakuReiwa7) {
        if (typeof item.grade !== 'number' || 
            typeof item.monthlyStandard !== 'number' || 
            typeof item.from !== 'number' || 
            typeof item.to !== 'number') {
          alert('JSONファイルの形式が正しくありません。各要素にgrade、monthlyStandard、from、toが必要です。');
          return;
        }
      }
      
      // kouseinenkinReiwa7が存在するか確認（オプション、存在しない場合は警告のみ）
      if (parsedData.kouseinenkinReiwa7) {
        if (!Array.isArray(parsedData.kouseinenkinReiwa7)) {
          alert('JSONファイルの形式が正しくありません。kouseinenkinReiwa7は配列である必要があります。');
          return;
        }
        
        // 各要素の形式を検証（kouseinenkinReiwa7）
        for (const item of parsedData.kouseinenkinReiwa7) {
          if (typeof item.grade !== 'number' || 
              typeof item.monthlyStandard !== 'number' || 
              typeof item.from !== 'number' || 
              typeof item.to !== 'number') {
            alert('JSONファイルの形式が正しくありません。kouseinenkinReiwa7の各要素にgrade、monthlyStandard、from、toが必要です。');
            return;
          }
        }
      }
      
      // gradeTableを更新
      this.gradeTable = parsedData;
      
      // Firestoreに保存（gradeTableをsettingsに保存）
      const currentSettings = await this.firestoreService.getSettings() || {};
      await this.firestoreService.saveSettings({
        ...currentSettings,
        gradeTable: this.gradeTable,
        treatBonusAsReward: this.treatBonusAsReward
      });
      
      alert('等級表を適用しました');
      
      // ファイル選択をリセット
      this.selectedGradeTableFile = null;
      this.selectedGradeTableFileName = '';
      
      // ファイル入力もリセット
      const fileInput = document.getElementById('gradeTableFile') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      // 社会保険料一覧を再読み込み
      await this.loadInsuranceList();
    } catch (error) {
      console.error('Error applying grade table:', error);
      alert('ファイルの適用中にエラーが発生しました。JSONファイルの形式を確認してください。');
    }
  }

  // 等級表を読み込む
  async loadGradeTable() {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      
      // まずFirestoreから設定を読み込んで、gradeTableが保存されているか確認
      const settings = await this.firestoreService.getSettings();
      if (settings && settings.gradeTable && settings.gradeTable.hyouzyungetugakuReiwa7) {
        this.gradeTable = settings.gradeTable;
        return;
      }
      
      // Firestoreに保存されていない場合は、assetsから読み込む
      const response = await this.http.get<any>('/assets/grade-table.json').toPromise();
      if (response) {
        this.gradeTable = response;
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
    
    if (gradeList.length === 0) {
      return null;
    }
    
    // from ~ to の範囲内に当てはまる等級を検索
    for (const gradeItem of gradeList) {
      if (salary >= gradeItem.from && salary <= gradeItem.to) {
        return {
          grade: gradeItem.grade,
          monthlyStandard: gradeItem.monthlyStandard
        };
      }
    }
    
    // 範囲外の場合：リストの最大値（最後の要素）または最小値（最初の要素）を使用
    if (salary < gradeList[0].from) {
      // 最小値未満の場合は最初の等級を使用
      return {
        grade: gradeList[0].grade,
        monthlyStandard: gradeList[0].monthlyStandard
      };
    } else {
      // 最大値を超える場合は最後の等級を使用
      const lastGrade = gradeList[gradeList.length - 1];
      return {
        grade: lastGrade.grade,
        monthlyStandard: lastGrade.monthlyStandard
      };
    }
  }
  
  // 固定的賃金から厚生年金保険料計算用の標準報酬月額を計算
  calculatePensionStandardMonthlySalary(fixedSalary: number): number {
    if (!this.gradeTable || !this.gradeTable.kouseinenkinReiwa7) {
      // kouseinenkinReiwa7が存在しない場合は、従来のロジック（88000円未満の場合は88000円）を使用
      const standardSalaryInfo = this.calculateStandardMonthlySalary(fixedSalary);
      const standardMonthlySalary = standardSalaryInfo ? standardSalaryInfo.monthlyStandard : 0;
      return standardMonthlySalary < 88000 ? 88000 : standardMonthlySalary;
    }
    
    const salary = Number(fixedSalary) || 0;
    const pensionGradeList = this.gradeTable.kouseinenkinReiwa7;
    
    // from ~ to の範囲内に当てはまる等級を検索
    for (const gradeItem of pensionGradeList) {
      if (salary >= gradeItem.from && salary <= gradeItem.to) {
        return gradeItem.monthlyStandard;
      }
    }
    
    // 範囲外の場合は、最小値（最初の要素のmonthlyStandard）または最大値（最後の要素のmonthlyStandard）を返す
    if (pensionGradeList.length > 0) {
      if (salary < pensionGradeList[0].from) {
        return pensionGradeList[0].monthlyStandard;
      }
      if (salary > pensionGradeList[pensionGradeList.length - 1].to) {
        return pensionGradeList[pensionGradeList.length - 1].monthlyStandard;
      }
    }
    
    // フォールバック: 従来のロジック
    const standardSalaryInfo = this.calculateStandardMonthlySalary(fixedSalary);
    const standardMonthlySalary = standardSalaryInfo ? standardSalaryInfo.monthlyStandard : 0;
    return standardMonthlySalary < 88000 ? 88000 : standardMonthlySalary;
  }

  // 50円単位で切り上げ/切り捨て（旧方式、賞与計算で使用）
  roundToFifty(amount: number): number {
    const remainder = amount % 100;
    if (remainder <= 50) {
      return Math.floor(amount / 100) * 100;
    } else {
      return Math.ceil(amount / 100) * 100;
    }
  }
  
  // 端数が0.50以下なら切り捨て、0.51以上なら切り上げ（1円単位）
  roundHalf(amount: number): number {
    const decimal = amount % 1;
    if (decimal <= 0.50) {
      return Math.floor(amount);
    } else {
      return Math.ceil(amount);
    }
  }
  
  // 年齢を計算（生年月日から）
  calculateAge(birthDate: string | Date | null | undefined): number | null {
    if (!birthDate) return null;
    
    try {
      const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
      if (isNaN(birth.getTime())) return null;
      
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      
      return age;
    } catch (error) {
      return null;
    }
  }
  
  // 社員情報管理票の社員を読み込む（入社手続きが完了した社員のみ）
  async loadEmployees() {
    try {
      const allEmployees = await this.firestoreService.getAllEmployees();
      // 新入社員コレクションに存在する社員を取得（入社手続きが完了していない社員を除外するため）
      const onboardingEmployees = await this.firestoreService.getAllOnboardingEmployees();
      const onboardingEmployeeNumbers = new Set(
        onboardingEmployees.map((emp: any) => emp.employeeNumber).filter((num: any) => num)
      );
      
      // 新入社員コレクションに存在しない社員のみを表示（入社手続きが完了した社員のみ）
      const completedEmployees = allEmployees.filter(
        (emp: any) => emp.employeeNumber && !onboardingEmployeeNumbers.has(emp.employeeNumber)
      );
      
      this.employees = completedEmployees
        .filter((emp: any) => emp.employeeNumber && emp.name && emp.email && emp.employmentType)
        .map((emp: any) => ({
          employeeNumber: emp.employeeNumber,
          name: emp.name,
          email: emp.email,
          employmentType: emp.employmentType
        }));
    } catch (error) {
      console.error('Error loading employees:', error);
      this.employees = [];
    }
  }
  
  // 社会保険料一覧を読み込む
  async loadInsuranceList() {
    this.isLoadingInsuranceList = true;
    try {
      // 社員情報管理票に表示されている社員のみを取得（入社手続きが完了した社員のみ）
      await this.loadEmployees();
      
      // 設定から保険料率を取得
      const settings = await this.firestoreService.getSettings();
      const healthInsuranceRate = settings?.insuranceRates?.healthInsurance || this.insuranceRates.healthInsurance || 0;
      const nursingInsuranceRate = settings?.insuranceRates?.nursingInsurance || this.insuranceRates.nursingInsurance || 0;
      const pensionInsuranceRate = settings?.insuranceRates?.pensionInsurance || this.insuranceRates.pensionInsurance || 0;
      
      // 給与設定履歴と賞与設定履歴を読み込む
      this.salaryHistory = await this.firestoreService.getSalaryHistory();
      const bonuses = await this.firestoreService.getBonusHistory();
      this.bonusHistory = bonuses;
      
      // 社員名を追加
      for (const salary of this.salaryHistory) {
        const employee = this.employees.find((e: any) => e.employeeNumber === salary['employeeNumber']);
        if (employee) {
          salary.name = employee.name;
        }
      }
      
      for (const bonus of this.bonusHistory) {
        const employee = this.employees.find((e: any) => e.employeeNumber === bonus['employeeNumber']);
        if (employee) {
          bonus.name = employee.name;
        }
      }
      
      // フィルターを適用
      this.filterSalaryHistory();
      this.filterBonusHistory();
      this.bonusList = bonuses.map((bonus: any) => {
        const employee = this.employees.find((e: any) => e.employeeNumber === bonus['employeeNumber']);
        return {
          ...bonus,
          year: Number(bonus['year']), // 数値型に変換
          month: Number(bonus['month']), // 数値型に変換
          name: employee?.name || ''
        };
      });
      
      // 保険料一覧データを構築（社員情報管理票の社員のみ）
      if (this.employees.length > 0) {
        // 社員情報管理票の社員番号を取得
        const employeeNumbers = new Set(this.employees.map((emp: any) => emp.employeeNumber));
        
        // 全社員データを取得して、社員情報管理票の社員のみをフィルタリング
        const allEmployees = await this.firestoreService.getAllEmployees();
        const filteredEmployees = allEmployees.filter((emp: any) => 
          emp && emp.employeeNumber && employeeNumbers.has(emp.employeeNumber)
        );
        
        // 各社員の詳細データを取得
        const employeeDetails = await Promise.all(
          filteredEmployees.map(async (emp: any) => {
            const employeeData = await this.firestoreService.getEmployeeData(emp.employeeNumber);
            return employeeData || emp;
          })
        );
        
        this.insuranceList = employeeDetails
          .filter((emp: any) => emp && emp.employeeNumber && emp.name)
          .map((emp: any) => {
            // 固定的賃金額を見込み給与額（給与）と見込み給与額（賞与）の合計にする
            const expectedMonthlySalary = Number(emp.expectedMonthlySalary) || 0;
            // 見込み給与額（賞与）は年額なので、月額に変換（12で割る）
            // 賞与は年1回支給される想定で、年額を12で割って月額換算
            // 新入社員データから賞与情報を取得（applicationDataからも取得を試みる）
            const expectedAnnualBonus = Number(emp.expectedAnnualBonus) || 
                                       Number(emp.applicationData?.expectedAnnualBonus) || 0;
            const expectedMonthlyBonus = expectedAnnualBonus / 12;
            
            // 固定的賃金額 = 見込み給与額（給与）+ 見込み給与額（賞与の月額換算）
            const fixedSalary = expectedMonthlySalary + expectedMonthlyBonus;
            
            // 給与設定履歴から、現在の年月以前の最新の給与を取得
            // （給与設定は「その年月以降の給与を設定する」という意味）
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            
            const relevantSalaries = this.salaryHistory
              .filter((s: any) => s['employeeNumber'] === emp.employeeNumber)
              .filter((s: any) => {
                const salaryYear = Number(s['year']);
                const salaryMonth = Number(s['month']);
                if (salaryYear < currentYear) return true;
                if (salaryYear === currentYear && salaryMonth <= currentMonth) return true;
                return false;
              })
              .sort((a: any, b: any) => {
                const aYear = Number(a['year']);
                const bYear = Number(b['year']);
                const aMonth = Number(a['month']);
                const bMonth = Number(b['month']);
                if (aYear !== bYear) return bYear - aYear;
                return bMonth - aMonth;
              });
            
            const latestSalary = relevantSalaries.length > 0 ? relevantSalaries[0] : null;
            const finalFixedSalary = latestSalary ? latestSalary['amount'] : fixedSalary;
            // 標準報酬月額を計算
            const standardSalaryInfo = this.calculateStandardMonthlySalary(finalFixedSalary);
            let standardMonthlySalary = standardSalaryInfo ? standardSalaryInfo.monthlyStandard : 0;
            const grade = standardSalaryInfo ? standardSalaryInfo.grade : 0;
            
            // 年齢を計算
            const age = this.calculateAge(emp.birthDate);
            
            // 40歳以上の従業員は介護保険料を0円にする
            const isOver40 = age !== null && age >= 40;
            
            // 厚生年金保険料計算用の標準報酬月額（kouseinenkinReiwa7リストを参照）
            const pensionStandardMonthlySalary = this.calculatePensionStandardMonthlySalary(finalFixedSalary);
            
            // 各保険料を計算（標準報酬月額 × 保険料率 / 100）
            // 小数第2位まで保持（表示用）
            const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100);
            const nursingInsuranceRaw = isOver40 ? 0 : standardMonthlySalary * (nursingInsuranceRate / 100);
            const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100);
            
            // 社員負担額を計算
            // (健康保険料 + 介護保険料) ÷ 2 の端数が0.50以下なら切り捨て、0.51以上なら切り上げ
            const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2;
            const healthNursingBurden = this.roundHalf(healthNursingHalf);
            
            // 厚生年金保険料 ÷ 2 の端数が0.50以下なら切り捨て、0.51以上なら切り上げ
            const pensionHalf = pensionInsuranceRaw / 2;
            const pensionBurden = this.roundHalf(pensionHalf);
            
            // 社員負担額（合計）
            const employeeBurden = healthNursingBurden + pensionBurden;
            
            return {
              employeeNumber: emp.employeeNumber || '',
              name: emp.name || '',
              fixedSalary: finalFixedSalary,
              grade: grade,
              standardMonthlySalary: standardMonthlySalary,
              healthInsurance: healthInsuranceRaw, // 小数第2位まで
              nursingInsurance: nursingInsuranceRaw, // 小数第2位まで
              pensionInsurance: pensionInsuranceRaw, // 小数第2位まで
              employeeBurden: employeeBurden, // 社員負担額
              birthDate: emp.birthDate || null, // 生年月日（年齢計算用）
              maternityLeaveStartDate: emp.maternityLeaveStartDate || null, // 産前産後休業開始日
              maternityLeaveEndDate: emp.maternityLeaveEndDate || null, // 産前産後休業終了日
              employmentStatus: emp.employmentStatus || '在籍', // 在籍状況
              resignationDate: emp.resignationDate || null, // 退職日
              healthInsuranceType: emp.healthInsuranceType || '', // 健康保険者種別
              joinDate: emp.joinDate || null // 入社年月日
            };
          });
      } else {
        this.insuranceList = [];
      }
      
      // 初期表示時は現在の年月の給与でフィルタリング
      const now = new Date();
      this.insuranceListYear = now.getFullYear();
      this.insuranceListMonth = now.getMonth() + 1;
      this.insuranceListType = 'salary';
      await this.filterInsuranceListByDate();
    } catch (error) {
      console.error('Error loading insurance list:', error);
      this.insuranceList = [];
      this.filteredInsuranceList = [];
    } finally {
      this.isLoadingInsuranceList = false;
    }
  }
  
  // 事業主負担額合計を計算
  getTotalEmployerBurden(): number {
    let totalHealthInsurance = 0;
    let totalNursingInsurance = 0;
    let totalPensionInsurance = 0;
    let totalEmployeeBurden = 0;
    
    // 賞与テーブルの場合はfilteredInsuranceListのみを使用（給与テーブルのデータを参照しない）
    const listToUse = this.insuranceListType === 'bonus' 
      ? this.filteredInsuranceList 
      : (this.filteredInsuranceList.length > 0 ? this.filteredInsuranceList : this.insuranceList);
    
    listToUse.forEach((item: any) => {
      // 全体の健康保険料（端数を切り落とした額）
      totalHealthInsurance += Math.floor(item.healthInsurance || 0);
      
      // 全体の介護保険料（端数を切り落とした額）
      totalNursingInsurance += Math.floor(item.nursingInsurance || 0);
      
      // 全体の厚生年金保険料（端数を切り落とした額）
      totalPensionInsurance += Math.floor(item.pensionInsurance || 0);
      
      // 社員負担額の合計
      totalEmployeeBurden += item.employeeBurden || 0;
    });
    
    // 事業主負担額 = （全体の健康保険料＋全体の介護保険料）の端数を切り落とした額
    //                ＋全体の厚生年金保険料の端数を切り落とした額
    //                －社員負担額の合計
    return (totalHealthInsurance + totalNursingInsurance) + totalPensionInsurance - totalEmployeeBurden;
  }
  
  // 健康保険料合計を計算
  getTotalHealthInsurance(): number {
    // 賞与テーブルの場合はfilteredInsuranceListのみを使用（給与テーブルのデータを参照しない）
    const listToUse = this.insuranceListType === 'bonus' 
      ? this.filteredInsuranceList 
      : (this.filteredInsuranceList.length > 0 ? this.filteredInsuranceList : this.insuranceList);
    return listToUse.reduce((sum: number, item: any) => sum + (item.healthInsurance || 0), 0);
  }
  
  // 介護保険料合計を計算
  getTotalNursingInsurance(): number {
    // 賞与テーブルの場合はfilteredInsuranceListのみを使用（給与テーブルのデータを参照しない）
    const listToUse = this.insuranceListType === 'bonus' 
      ? this.filteredInsuranceList 
      : (this.filteredInsuranceList.length > 0 ? this.filteredInsuranceList : this.insuranceList);
    return listToUse.reduce((sum: number, item: any) => sum + (item.nursingInsurance || 0), 0);
  }
  
  // 厚生年金保険料合計を計算
  getTotalPensionInsurance(): number {
    // 賞与テーブルの場合はfilteredInsuranceListのみを使用（給与テーブルのデータを参照しない）
    const listToUse = this.insuranceListType === 'bonus' 
      ? this.filteredInsuranceList 
      : (this.filteredInsuranceList.length > 0 ? this.filteredInsuranceList : this.insuranceList);
    return listToUse.reduce((sum: number, item: any) => sum + (item.pensionInsurance || 0), 0);
  }
  
  // 社員負担額合計を計算
  getTotalEmployeeBurden(): number {
    // 賞与テーブルの場合はfilteredInsuranceListのみを使用（給与テーブルのデータを参照しない）
    const listToUse = this.insuranceListType === 'bonus' 
      ? this.filteredInsuranceList 
      : (this.filteredInsuranceList.length > 0 ? this.filteredInsuranceList : this.insuranceList);
    return listToUse.reduce((sum: number, item: any) => sum + (item.employeeBurden || 0), 0);
  }

  // トラッキング関数（パフォーマンス向上）
  trackByEmployeeNumber(index: number, item: any): string {
    return item.employeeNumber || index.toString();
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

  switchTab(tabName: string) {
    this.currentTab = tabName;
    
    // 社会保険料タブが選択された場合、社会保険料一覧を読み込む
    if (tabName === '社会保険料') {
      this.loadInsuranceList().catch(err => {
        console.error('Error in loadInsuranceList:', err);
      });
    }
    
    // 給与タブが選択された場合、給与データを読み込む
    if (tabName === '給与') {
      this.loadSalaryData().catch(err => {
        console.error('Error in loadSalaryData:', err);
      });
    }
    
    // 賞与タブが選択された場合、賞与データを読み込む
    if (tabName === '賞与') {
      this.loadBonusData().catch(err => {
        console.error('Error in loadBonusData:', err);
      });
    }
    
    // 設定タブが選択された場合、設定を読み込む
    if (tabName === '設定') {
      this.loadSettings().catch(err => {
        console.error('Error in loadSettings:', err);
      });
    }
  }
  
  // 退職済み社員を表示すべきかどうかを判定
  shouldShowResignedEmployee(employmentStatus: string, resignationDate: any, healthInsuranceType: string, year: number, month: number): boolean {
    // 在籍中の場合は表示
    if (employmentStatus !== '退職' && employmentStatus !== '退職済み') {
      return true;
    }
    
    // 退職日がない場合は表示しない
    if (!resignationDate) {
      return false;
    }
    
    // 退職日をDateオブジェクトに変換
    let resignation: Date;
    if (resignationDate instanceof Date) {
      resignation = resignationDate;
    } else if (resignationDate && typeof resignationDate.toDate === 'function') {
      resignation = resignationDate.toDate();
    } else if (typeof resignationDate === 'string') {
      resignation = new Date(resignationDate);
    } else {
      return false;
    }
    
    if (isNaN(resignation.getTime())) {
      return false;
    }
    
    // 退職月を取得
    const resignationYear = resignation.getFullYear();
    const resignationMonth = resignation.getMonth() + 1;
    
    // 選択された年月が退職月以前の場合は表示
    if (year < resignationYear || (year === resignationYear && month <= resignationMonth)) {
      return true;
    }
    
    // 任意継続被保険者の場合、退職月の翌月から2年間は表示
    if (healthInsuranceType === '任意継続被保険者') {
      // 退職月の翌月を計算
      let nextMonthYear = resignationYear;
      let nextMonth = resignationMonth + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextMonthYear++;
      }
      
      // 2年後の月を計算
      let twoYearsLaterYear = nextMonthYear + 2;
      let twoYearsLaterMonth = nextMonth;
      
      // 選択された年月が退職月の翌月から2年間の範囲内かどうかを判定
      if (year < nextMonthYear || (year === nextMonthYear && month < nextMonth)) {
        return false; // 退職月以前は既に処理済み
      }
      if (year < twoYearsLaterYear || (year === twoYearsLaterYear && month <= twoYearsLaterMonth)) {
        return true; // 2年間の範囲内
      }
    }
    
    return false;
  }

  // 産前産後休業期間内かどうかを判定
  isInMaternityLeavePeriod(maternityLeaveStartDate: any, maternityLeaveEndDate: any, year: number, month: number): boolean {
    if (!maternityLeaveStartDate || !maternityLeaveEndDate) {
      return false;
    }
    
    // 日付をDateオブジェクトに変換
    let startDate: Date;
    let endDate: Date;
    
    if (maternityLeaveStartDate instanceof Date) {
      startDate = maternityLeaveStartDate;
    } else if (maternityLeaveStartDate && typeof maternityLeaveStartDate.toDate === 'function') {
      startDate = maternityLeaveStartDate.toDate();
    } else if (typeof maternityLeaveStartDate === 'string') {
      startDate = new Date(maternityLeaveStartDate);
    } else {
      return false;
    }
    
    if (maternityLeaveEndDate instanceof Date) {
      endDate = maternityLeaveEndDate;
    } else if (maternityLeaveEndDate && typeof maternityLeaveEndDate.toDate === 'function') {
      endDate = maternityLeaveEndDate.toDate();
    } else if (typeof maternityLeaveEndDate === 'string') {
      endDate = new Date(maternityLeaveEndDate);
    } else {
      return false;
    }
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return false;
    }
    
    // 開始月と終了月を取得
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;
    
    // 終了月の前月までが免除対象
    let exemptEndYear = endYear;
    let exemptEndMonth = endMonth - 1;
    if (exemptEndMonth < 1) {
      exemptEndMonth = 12;
      exemptEndYear--;
    }
    
    // 選択された年月が開始月から終了月の前月までの範囲内かどうかを判定
    if (year < startYear || (year === startYear && month < startMonth)) {
      return false;
    }
    if (year > exemptEndYear || (year === exemptEndYear && month > exemptEndMonth)) {
      return false;
    }
    
    return true;
  }

  // 保険料一覧を年月でフィルタリング
  async filterInsuranceListByDate() {
    this.isLoadingInsuranceList = true;
    try {
      // 年月を数値型に変換（HTMLのselectから文字列型で来る可能性があるため）
      const filterYear = Number(this.insuranceListYear);
      const filterMonth = Number(this.insuranceListMonth);
      
      // 設定から保険料率を取得
      const settings = await this.firestoreService.getSettings();
      const healthInsuranceRate = settings?.insuranceRates?.healthInsurance || this.insuranceRates.healthInsurance || 0;
      const nursingInsuranceRate = settings?.insuranceRates?.nursingInsurance || this.insuranceRates.nursingInsurance || 0;
      const pensionInsuranceRate = settings?.insuranceRates?.pensionInsurance || this.insuranceRates.pensionInsurance || 0;
      
      if (this.insuranceListType === 'salary') {
        // 給与の場合：選択された年月の固定的賃金で計算
        const filteredItems = await Promise.all(this.insuranceList
          .filter((item: any) => {
            // 退職済み社員の表示条件をチェック
            const shouldShow = this.shouldShowResignedEmployee(
              item.employmentStatus || '在籍',
              item.resignationDate,
              item.healthInsuranceType || '',
              filterYear,
              filterMonth
            );
            
            if (!shouldShow) return false;
            
            // 入社月以降の分のみ表示
            if (item.joinDate) {
              let joinDate: Date;
              if (item.joinDate instanceof Date) {
                joinDate = item.joinDate;
              } else if (item.joinDate && typeof item.joinDate.toDate === 'function') {
                joinDate = item.joinDate.toDate();
              } else if (typeof item.joinDate === 'string') {
                joinDate = new Date(item.joinDate);
              } else {
                return true; // 入社日が取得できない場合は表示
              }
              
              if (!isNaN(joinDate.getTime())) {
                const joinYear = joinDate.getFullYear();
                const joinMonth = joinDate.getMonth() + 1;
                
                // 選択された年月が入社月より前の場合は表示しない
                if (filterYear < joinYear || (filterYear === joinYear && filterMonth < joinMonth)) {
                  return false;
                }
              }
            }
            
            return true;
          })
          .map(async (item: any) => {
            // 給与設定履歴から該当年月以前の最新の固定的賃金を取得
            const relevantSalaries = this.salaryHistory
              .filter((s: any) => s['employeeNumber'] === item.employeeNumber)
              .filter((s: any) => {
                const salaryYear = Number(s['year']);
                const salaryMonth = Number(s['month']);
                if (salaryYear < filterYear) return true;
                if (salaryYear === filterYear && salaryMonth <= filterMonth) return true;
                return false;
              })
              .sort((a: any, b: any) => {
                if (a['year'] !== b['year']) return b['year'] - a['year'];
                return b['month'] - a['month'];
              });
            
            const latestSalary = relevantSalaries.length > 0 ? relevantSalaries[0] : null;
            let fixedSalary = latestSalary ? latestSalary['amount'] : item.fixedSalary;
            
            // 任意継続被保険者の場合の処理
            const isVoluntaryContinuation = item.healthInsuranceType === '任意継続被保険者' && 
                                           (item.employmentStatus === '退職' || item.employmentStatus === '退職済み');
            
            if (isVoluntaryContinuation) {
              // 退職時の固定的賃金を取得（退職月以前の最新の給与設定）
              const resignationDate = item.resignationDate;
              let resignation: Date | null = null;
              
              if (resignationDate) {
                if (resignationDate instanceof Date) {
                  resignation = resignationDate;
                } else if (resignationDate && typeof resignationDate.toDate === 'function') {
                  resignation = resignationDate.toDate();
                } else if (typeof resignationDate === 'string') {
                  resignation = new Date(resignationDate);
                }
              }
              
              if (resignation && !isNaN(resignation.getTime())) {
                const resignationYear = resignation.getFullYear();
                const resignationMonth = resignation.getMonth() + 1;
                
                // 退職月以前の最新の給与設定を取得
                const preResignationSalaries = this.salaryHistory
                  .filter((s: any) => s['employeeNumber'] === item.employeeNumber)
                  .filter((s: any) => {
                    const salaryYear = Number(s['year']);
                    const salaryMonth = Number(s['month']);
                    if (salaryYear < resignationYear) return true;
                    if (salaryYear === resignationYear && salaryMonth <= resignationMonth) return true;
                    return false;
                  })
                  .sort((a: any, b: any) => {
                    if (a['year'] !== b['year']) return b['year'] - a['year'];
                    return b['month'] - a['month'];
                  });
                
                if (preResignationSalaries.length > 0) {
                  fixedSalary = preResignationSalaries[0]['amount'];
                }
              }
              
              // 給料は0にする
              fixedSalary = 0;
            }
            
            // 産前産後休業期間内かどうかを判定
            const isInMaternityLeave = this.isInMaternityLeavePeriod(
              item.maternityLeaveStartDate,
              item.maternityLeaveEndDate,
              filterYear,
              filterMonth
            );
            
            // 標準報酬月額を再計算
            let standardMonthlySalary = 0;
            let grade = 0;
            
            // 標準報酬月額変更情報を取得（該当年月以前の最新の変更情報）
            const standardChange = await this.firestoreService.getStandardMonthlySalaryChange(
              item.employeeNumber,
              filterYear,
              filterMonth
            );
            
            // 標準報酬月額変更が適用されているかチェック（適用月以降の場合のみ）
            let useStandardChange = false;
            if (standardChange) {
              const effectiveYear = Number(standardChange.effectiveYear);
              const effectiveMonth = Number(standardChange.effectiveMonth);
              
              // 選択された年月が適用月以降の場合のみ変更を適用
              if (filterYear > effectiveYear || 
                  (filterYear === effectiveYear && filterMonth >= effectiveMonth)) {
                useStandardChange = true;
              }
            }
            
            if (useStandardChange) {
              // 標準報酬月額変更が適用されている場合
              standardMonthlySalary = standardChange.monthlyStandard;
              grade = standardChange.grade;
            } else if (isVoluntaryContinuation) {
              // 任意継続被保険者の場合、退職時の標準報酬月額を使用（最大32万円）
              // 退職時の固定的賃金を再取得
              const relevantSalariesForResignation = this.salaryHistory
                .filter((s: any) => s['employeeNumber'] === item.employeeNumber)
                .sort((a: any, b: any) => {
                  if (a['year'] !== b['year']) return b['year'] - a['year'];
                  return b['month'] - a['month'];
                });
              
              const latestSalaryBeforeResignation = relevantSalariesForResignation.length > 0 
                ? relevantSalariesForResignation[0]['amount'] 
                : item.fixedSalary;
              
              const standardSalaryInfo = this.calculateStandardMonthlySalary(latestSalaryBeforeResignation);
              standardMonthlySalary = standardSalaryInfo ? standardSalaryInfo.monthlyStandard : 0;
              grade = standardSalaryInfo ? standardSalaryInfo.grade : 0;
              
              // 最大32万円に制限
              if (standardMonthlySalary > 320000) {
                standardMonthlySalary = 320000;
                // 32万円に対応する等級を再計算
                const maxStandardInfo = this.calculateStandardMonthlySalary(320000);
                if (maxStandardInfo) {
                  grade = maxStandardInfo.grade;
                }
              }
            } else {
              // 標準報酬月額変更情報が適用されていない場合、入社時の見込み給与から等級を計算
              // （入社時決定による等級を使用）
              // 社員情報から入社時の見込み給与を取得
              const employeeData = await this.firestoreService.getEmployeeData(item.employeeNumber);
              if (employeeData) {
                const expectedMonthlySalary = Number(employeeData.expectedMonthlySalary) || 0;
                const expectedAnnualBonus = Number(employeeData.expectedAnnualBonus) || 
                                           Number(employeeData.applicationData?.expectedAnnualBonus) || 0;
                const expectedMonthlyBonus = expectedAnnualBonus / 12;
                const initialFixedSalary = expectedMonthlySalary + expectedMonthlyBonus;
                
                const initialStandardInfo = this.calculateStandardMonthlySalary(initialFixedSalary);
                standardMonthlySalary = initialStandardInfo ? initialStandardInfo.monthlyStandard : 0;
                grade = initialStandardInfo ? initialStandardInfo.grade : 0;
              } else {
                // 社員情報が取得できない場合、保険料一覧の初期値を使用
                const standardSalaryInfo = this.calculateStandardMonthlySalary(item.fixedSalary);
                standardMonthlySalary = standardSalaryInfo ? standardSalaryInfo.monthlyStandard : 0;
                grade = standardSalaryInfo ? standardSalaryInfo.grade : 0;
              }
            }
            
            // 年齢を計算
            const age = this.calculateAge(item.birthDate);
            
            // 40歳以上の従業員は介護保険料を0円にする
            const isOver40 = age !== null && age >= 40;
            
            // 厚生年金保険料計算用の標準報酬月額（任意継続被保険者の場合は0）
            const pensionStandardMonthlySalary = isVoluntaryContinuation ? 0 : this.calculatePensionStandardMonthlySalary(fixedSalary);
            
            // 各保険料を計算（産前産後休業期間内の場合は0円）
            const healthInsuranceRaw = isInMaternityLeave ? 0 : standardMonthlySalary * (healthInsuranceRate / 100);
            const nursingInsuranceRaw = isInMaternityLeave ? 0 : (isOver40 ? 0 : standardMonthlySalary * (nursingInsuranceRate / 100));
            const pensionInsuranceRaw = isInMaternityLeave ? 0 : (isVoluntaryContinuation ? 0 : pensionStandardMonthlySalary * (pensionInsuranceRate / 100));
            
            // 社員負担額を計算
            let employeeBurden = 0;
            if (!isInMaternityLeave) {
              if (isVoluntaryContinuation) {
                // 任意継続被保険者の場合、健康保険料と介護保険料は全額社員負担
                employeeBurden = healthInsuranceRaw + nursingInsuranceRaw;
              } else {
                // (健康保険料 + 介護保険料) ÷ 2 の端数が0.50以下なら切り捨て、0.51以上なら切り上げ
                const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2;
                const healthNursingBurden = this.roundHalf(healthNursingHalf);
                
                // 厚生年金保険料 ÷ 2 の端数が0.50以下なら切り捨て、0.51以上なら切り上げ
                const pensionHalf = pensionInsuranceRaw / 2;
                const pensionBurden = this.roundHalf(pensionHalf);
                
                // 社員負担額（合計）
                employeeBurden = healthNursingBurden + pensionBurden;
              }
            }
            
          return {
            ...item,
            fixedSalary: fixedSalary,
            grade: grade,
            standardMonthlySalary: standardMonthlySalary,
            healthInsurance: healthInsuranceRaw,
            nursingInsurance: nursingInsuranceRaw,
            pensionInsurance: pensionInsuranceRaw,
            employeeBurden: employeeBurden
          };
          }));
        
        this.filteredInsuranceList = filteredItems;
      } else {
        // 賞与の場合：選択された年月の賞与で計算
        // 設定を取得（年4回以上の賞与を報酬と扱うか）
        const settings = await this.firestoreService.getSettings();
        const treatBonusAsReward = settings?.treatBonusAsReward !== undefined ? settings.treatBonusAsReward : true;
        
        // その年の7月から翌年6月までの間に、賞与が4回以上支給された場合、4回目以降の賞与は表示しない（設定が「はい」の場合のみ）
        const bonusListFiltered = this.bonusList.filter((bonus: any) => {
          // 年月を数値型に変換して比較（Firestoreから取得したデータが文字列型の場合があるため）
          const bonusYear = Number(bonus['year']);
          const bonusMonth = Number(bonus['month']);
          
          // 選択された年月の賞与かどうかをチェック
          if (bonusYear !== filterYear || bonusMonth !== filterMonth) {
            return false;
          }
          
          // 設定が「いいえ」の場合は、すべての賞与を表示
          if (!treatBonusAsReward) {
            return true;
          }
          
          // 年度を判定（7月～翌年6月が1年度）
          let bonusFiscalYear: number;
          if (bonusMonth >= 7) {
            bonusFiscalYear = bonusYear;
          } else {
            bonusFiscalYear = bonusYear - 1;
          }
          
          // 該当年度の7月から選択された年月までの賞与を取得
          const fiscalYearBonuses = this.bonusList.filter((b: any) => {
            const bYear = Number(b['year']);
            const bMonth = Number(b['month']);
            if (b['employeeNumber'] !== bonus['employeeNumber']) return false;
            
            // 年度を判定
            let bFiscalYear: number;
            if (bMonth >= 7) {
              bFiscalYear = bYear;
            } else {
              bFiscalYear = bYear - 1;
            }
            
            // 同じ年度で、選択された年月以前の賞与を取得
            if (bFiscalYear !== bonusFiscalYear) return false;
            if (bYear < bonusYear) return true;
            if (bYear === bonusYear && bMonth <= bonusMonth) return true;
            return false;
          }).sort((a: any, b: any) => {
            const aYear = Number(a['year']);
            const bYear = Number(b['year']);
            const aMonth = Number(a['month']);
            const bMonth = Number(b['month']);
            if (aYear !== bYear) return aYear - bYear;
            return aMonth - bMonth;
          });
          
          // 4回目以降の賞与は表示しない
          const bonusIndex = fiscalYearBonuses.findIndex((b: any) => 
            Number(b['year']) === bonusYear && Number(b['month']) === bonusMonth
          );
          return bonusIndex < 3; // 0, 1, 2の3回まで表示（4回目以降は表示しない）
        });
        
        this.filteredInsuranceList = await Promise.all(
          bonusListFiltered
            .map(async (bonus: any) => {
              // 社員情報を取得
              const employeeData = await this.firestoreService.getEmployeeData(bonus['employeeNumber']);
              
              // 退職済み社員の表示条件をチェック
              const shouldShow = this.shouldShowResignedEmployee(
                employeeData?.employmentStatus || '在籍',
                employeeData?.resignationDate,
                employeeData?.healthInsuranceType || '',
                filterYear,
                filterMonth
              );
              
              if (!shouldShow) {
                return null;
              }
              
              // 標準賞与額 = 賞与の1000円未満の値を切り捨てた額
              let standardBonusAmount = Math.floor(bonus['amount'] / 1000) * 1000;
              
              // 任意継続被保険者の場合、賞与は0円にする
              const isVoluntaryContinuation = employeeData?.healthInsuranceType === '任意継続被保険者' && 
                                             (employeeData?.employmentStatus === '退職' || employeeData?.employmentStatus === '退職済み');
              
              if (isVoluntaryContinuation) {
                standardBonusAmount = 0;
              }
              
              // 健康保険料・介護保険料計算用の標準賞与額（年度間上限573万円を考慮）
              // 年度を判定（4月～3月が1年度）
              let fiscalYear: number;
              if (filterMonth >= 4) {
                fiscalYear = filterYear;
              } else {
                fiscalYear = filterYear - 1;
              }
              
              // 該当年度の4月から選択された年月までの賞与の合計を計算
              const fiscalYearBonuses = this.bonusList.filter((b: any) => {
                const bYear = Number(b['year']);
                const bMonth = Number(b['month']);
                if (b['employeeNumber'] !== bonus['employeeNumber']) return false;
                
                // 年度を判定
                let bFiscalYear: number;
                if (bMonth >= 4) {
                  bFiscalYear = bYear;
                } else {
                  bFiscalYear = bYear - 1;
                }
                
                // 同じ年度で、選択された年月以前の賞与を取得
                if (bFiscalYear !== fiscalYear) return false;
                if (bYear < filterYear) return true;
                if (bYear === filterYear && bMonth <= filterMonth) return true;
                return false;
              });
              
              // 年度内の標準賞与額の合計を計算
              const fiscalYearTotalStandardBonus = fiscalYearBonuses.reduce((sum: number, b: any) => {
                const amount = Math.floor(Number(b['amount']) / 1000) * 1000;
                return sum + amount;
              }, 0);
              
              // 健康保険料・介護保険料計算用の標準賞与額（年度間上限573万円）
              const healthNursingStandardBonusAmount = isVoluntaryContinuation ? 0 : 
                Math.min(standardBonusAmount, Math.max(0, 5730000 - (fiscalYearTotalStandardBonus - standardBonusAmount)));
              
              // 厚生年金保険料計算用の標準賞与額（月上限150万円、任意継続被保険者の場合は0）
              // 賞与の場合は等級を関係なく、賞与額をそのまま使用（1000円未満切り捨て）
              const pensionStandardBonusAmount = isVoluntaryContinuation ? 0 : 
                Math.min(1500000, standardBonusAmount);
              
              const age = this.calculateAge(employeeData?.birthDate);
              
              // 産前産後休業期間内かどうかを判定
              const isInMaternityLeave = this.isInMaternityLeavePeriod(
                employeeData?.maternityLeaveStartDate,
                employeeData?.maternityLeaveEndDate,
                filterYear,
                filterMonth
              );
              
              // 40歳以上の従業員は介護保険料を0円にする
              const isOver40 = age !== null && age >= 40;
              
              // 各保険料を計算（産前産後休業期間内の場合は0円）
              const healthInsuranceRaw = isInMaternityLeave ? 0 : healthNursingStandardBonusAmount * (healthInsuranceRate / 100);
              const nursingInsuranceRaw = isInMaternityLeave ? 0 : (isOver40 ? 0 : healthNursingStandardBonusAmount * (nursingInsuranceRate / 100));
              const pensionInsuranceRaw = isInMaternityLeave ? 0 : (isVoluntaryContinuation ? 0 : pensionStandardBonusAmount * (pensionInsuranceRate / 100));
              
              // 社員負担額を計算
              let employeeBurden = 0;
              if (!isInMaternityLeave) {
                if (isVoluntaryContinuation) {
                  // 任意継続被保険者の場合、健康保険料と介護保険料は全額社員負担
                  employeeBurden = healthInsuranceRaw + nursingInsuranceRaw;
                } else {
                  // (健康保険料 + 介護保険料) ÷ 2 の端数が0.50以下なら切り捨て、0.51以上なら切り上げ
                  const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2;
                  const healthNursingBurden = this.roundHalf(healthNursingHalf);
                  
                  // 厚生年金保険料 ÷ 2 の端数が0.50以下なら切り捨て、0.51以上なら切り上げ
                  const pensionHalf = pensionInsuranceRaw / 2;
                  const pensionBurden = this.roundHalf(pensionHalf);
                  
                  // 社員負担額（合計）
                  employeeBurden = healthNursingBurden + pensionBurden;
                }
              }
              
              return {
                employeeNumber: bonus['employeeNumber'],
                name: bonus.name,
                bonusAmount: bonus['amount'],
                standardBonusAmount: standardBonusAmount,
                healthInsurance: healthInsuranceRaw,
                nursingInsurance: nursingInsuranceRaw,
                pensionInsurance: pensionInsuranceRaw,
                employeeBurden: employeeBurden
              };
            })
        );
        
        // nullを除外
        this.filteredInsuranceList = this.filteredInsuranceList.filter((item: any) => item !== null);
      }
    } catch (error) {
      console.error('Error filtering insurance list:', error);
      this.filteredInsuranceList = [];
    } finally {
      this.isLoadingInsuranceList = false;
    }
  }
  
  // 保険料一覧のタイプを切り替え
  async switchInsuranceListType(type: 'salary' | 'bonus') {
    this.insuranceListType = type;
    // 年月を数値型に変換（HTMLのselectから文字列型で来る可能性があるため）
    this.insuranceListYear = Number(this.insuranceListYear);
    this.insuranceListMonth = Number(this.insuranceListMonth);
    await this.filterInsuranceListByDate();
  }
  
  // 保険料一覧の年月を変更
  async onInsuranceListDateChange() {
    // 年月を数値型に変換（HTMLのselectから文字列型で来る可能性があるため）
    this.insuranceListYear = Number(this.insuranceListYear);
    this.insuranceListMonth = Number(this.insuranceListMonth);
    await this.filterInsuranceListByDate();
  }
  
  // 給与データを読み込む
  async loadSalaryData() {
    try {
      await this.loadEmployees();
      this.salaryEmployees = this.employees;
      
      // 給与設定履歴を読み込む（Firestoreから）
      const history = await this.firestoreService.getSalaryHistory();
      
      // 日時順にソート（新しいものから）
      this.salaryHistory = history.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // 社員名を追加
      for (const salary of this.salaryHistory) {
        const employee = this.employees.find((e: any) => e.employeeNumber === salary['employeeNumber']);
        if (employee) {
          salary.name = employee.name;
        }
      }
      
      // フィルターを適用
      this.filterSalaryHistory();
    } catch (error) {
      console.error('Error loading salary data:', error);
    }
  }
  
  // 賞与データを読み込む
  async loadBonusData() {
    try {
      await this.loadEmployees();
      this.bonusEmployees = this.employees;
      
      // 賞与設定履歴を読み込む（Firestoreから）
      const bonuses = await this.firestoreService.getBonusHistory();
      
      // 日時順にソート（新しいものから）
      this.bonusHistory = bonuses.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // 社員名を追加してbonusListに設定
      this.bonusList = bonuses.map((bonus: any) => {
        const employee = this.employees.find((e: any) => e.employeeNumber === bonus['employeeNumber']);
        return {
          ...bonus,
          year: Number(bonus['year']), // 数値型に変換
          month: Number(bonus['month']), // 数値型に変換
          name: employee?.name || ''
        };
      });
    } catch (error) {
      console.error('Error loading bonus data:', error);
    }
  }
  
  // 給与額の入力制限（マイナス値や先頭が0の数値を防ぐ）
  onSalaryAmountInput(event: any) {
    let value = event.target.value;
    
    // 空の場合は0に
    if (value === '' || value === null || value === undefined) {
      this.salaryAmount = 0;
      event.target.value = '';
      return;
    }
    
    // マイナス記号を削除
    value = value.replace(/-/g, '');
    
    // 先頭の0を削除（ただし、0のみの場合は残す）
    if (value.length > 1 && value.startsWith('0')) {
      value = value.replace(/^0+/, '');
      if (value === '') {
        value = '0';
      }
    }
    
    // 数値に変換
    let numValue = Number(value);
    
    // マイナス値やNaNの場合は0に
    if (isNaN(numValue) || numValue < 0) {
      numValue = 0;
      value = '0';
    }
    
    this.salaryAmount = numValue;
    event.target.value = value;
  }
  
  // 賞与額の入力制限（マイナス値や先頭が0の数値を防ぐ）
  onBonusAmountInput(event: any) {
    let value = event.target.value;
    
    // 空の場合は0に
    if (value === '' || value === null || value === undefined) {
      this.bonusAmount = 0;
      event.target.value = '';
      return;
    }
    
    // マイナス記号を削除
    value = value.replace(/-/g, '');
    
    // 先頭の0を削除（ただし、0のみの場合は残す）
    if (value.length > 1 && value.startsWith('0')) {
      value = value.replace(/^0+/, '');
      if (value === '') {
        value = '0';
      }
    }
    
    // 数値に変換
    let numValue = Number(value);
    
    // マイナス値やNaNの場合は0に
    if (isNaN(numValue) || numValue < 0) {
      numValue = 0;
      value = '0';
    }
    
    this.bonusAmount = numValue;
    event.target.value = value;
  }
  
  // 社員名を取得
  getEmployeeName(employeeNumber: string): string {
    const employee = this.employees.find(emp => emp.employeeNumber === employeeNumber);
    return employee ? employee.name : '-';
  }

  // 日時をフォーマット
  formatDateTime(date: any): string {
    if (!date) return '-';
    try {
      let dateObj: Date;
      if (date.toDate && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else {
        return '-';
      }
      
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    } catch (error) {
      return '-';
    }
  }

  // 日付をフォーマット（YYYY/MM/DD形式）
  formatDate(date: any): string {
    if (!date) return '-';
    try {
      let dateObj: Date;
      if (date.toDate && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else {
        return '-';
      }
      
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      
      return `${year}/${month}/${day}`;
    } catch (error) {
      return '-';
    }
  }

  // 入社月をフォーマット（YYYY年MM月形式）
  formatJoinDate(date: any): string {
    if (!date) return '-';
    try {
      let dateObj: Date;
      if (date.toDate && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else {
        return '-';
      }
      
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      
      return `${year}年${month}月`;
    } catch (error) {
      return '-';
    }
  }

  // 給与を保存
  async saveSalary() {
    if (!this.selectedSalaryEmployee || !this.salaryAmount || this.salaryAmount <= 0) {
      alert('社員と給与額を入力してください');
      return;
    }
    
    // 年月を数値型に変換（selectから文字列型で来る可能性があるため）
    this.salaryYear = Number(this.salaryYear);
    this.salaryMonth = Number(this.salaryMonth);
    
    this.isSavingSalary = true;
    try {
      // 給与設定をFirestoreに保存（指定年月以降の2030年12月までの給与を設定）
      console.log(`[給与設定] 給与設定開始。社員番号: ${this.selectedSalaryEmployee}, 年: ${this.salaryYear}, 月: ${this.salaryMonth}, 金額: ${this.salaryAmount}`);
      
      // 最初に設定した年月のみを手動設定として記録
      await this.firestoreService.saveSalary(
        this.selectedSalaryEmployee,
        this.salaryYear,
        this.salaryMonth,
        this.salaryAmount,
        true // isManual = true（手動設定）
      );
      
      // 設定年月から2030年12月までの残りの月に給与を自動設定
      let currentYear = this.salaryYear;
      let currentMonth = this.salaryMonth + 1; // 次の月から開始
      
      // 月が12を超える場合の処理
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      
      while (currentYear < 2030 || (currentYear === 2030 && currentMonth <= 12)) {
        await this.firestoreService.saveSalary(
          this.selectedSalaryEmployee,
          currentYear,
          currentMonth,
          this.salaryAmount,
          false // isManual = false（自動設定）
        );
        
        // 次の月に進む
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
      
      console.log(`[給与設定] 給与設定完了。${this.salaryYear}年${this.salaryMonth}月から2030年12月まで設定しました。`);
      
      // 給与設定履歴を再読み込み（標準報酬月額変更チェックの前に必要）
      // 定時改定・随時改定の計算には、すべての給与（自動設定含む）が必要なため、getAllSalaryHistoryを使用
      const history = await this.firestoreService.getAllSalaryHistory();
      
      // 日時順にソート（新しいものから）
      const sortedHistory = history.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // デバッグ用：該当社員の給与設定履歴をログ出力
      const employeeSalaries = sortedHistory.filter((s: any) => s['employeeNumber'] === this.selectedSalaryEmployee);
      console.log(`[定時改定] 該当社員（${this.selectedSalaryEmployee}）の給与設定履歴:`, employeeSalaries.map((s: any) => ({
        year: s['year'],
        month: s['month'],
        amount: s['amount'],
        employeeNumber: s['employeeNumber']
      })));
      
      // 標準報酬月額の変更を検出して処理（随時改定）
      // 新しい給与設定を行った際、その社員のすべての随時改定を再計算
      await this.recalculateAllZujijiKaitei(
        this.selectedSalaryEmployee,
        sortedHistory
      );
      
      // 定時改定の処理（2030年12月までのすべての年度で定時改定をチェック）
      // 2025年度から2030年度まで、すべての年度について定時改定をチェック
      console.log(`[定時改定] 給与設定後の定時改定チェック開始。社員番号: ${this.selectedSalaryEmployee}`);
      
      for (let fiscalYear = 2025; fiscalYear <= 2030; fiscalYear++) {
        console.log(`[定時改定] ${fiscalYear}年度（${fiscalYear}年4月～${fiscalYear + 1}年3月）のチェック開始`);
        
        // 該当年度の4月、5月、6月の給与を取得できるかチェック
        // 給与設定は「その年月以降の給与を設定する」という意味なので、
        // 該当月の給与設定がない場合は、該当月以前の最新の給与設定を使用する
        let canCalculate = false;
        
        // 4月、5月、6月の各月について、給与設定が取得できるかチェック
        for (let month = 4; month <= 6; month++) {
          // 該当月の給与設定を探す
          const exactMonthSalary = sortedHistory.find((s: any) => {
            const salaryYear = Number(s['year']);
            const salaryMonth = Number(s['month']);
            return s['employeeNumber'] === this.selectedSalaryEmployee &&
                   salaryYear === fiscalYear &&
                   salaryMonth === month;
          });
          
          if (exactMonthSalary) {
            canCalculate = true;
            break;
          }
          
          // 該当月以前の最新の給与設定を探す
          const relevantSalaries = sortedHistory
            .filter((s: any) => {
              const salaryYear = Number(s['year']);
              const salaryMonth = Number(s['month']);
              // 該当年度の該当月以前、または前年度の給与設定
              if (salaryYear < fiscalYear) return true;
              if (salaryYear === fiscalYear && salaryMonth < month) return true;
              return false;
            })
            .filter((s: any) => s['employeeNumber'] === this.selectedSalaryEmployee)
            .sort((a: any, b: any) => {
              const aYear = Number(a['year']);
              const bYear = Number(b['year']);
              const aMonth = Number(a['month']);
              const bMonth = Number(b['month']);
              if (aYear !== bYear) return bYear - aYear;
              return bMonth - aMonth;
            });
          
          if (relevantSalaries.length > 0) {
            canCalculate = true;
            break;
          }
        }
        
        if (canCalculate) {
          // 6月の給与設定があるかチェック（6月の給与設定がある場合は6月として、ない場合は7月として処理）
          const hasJuneSalary = sortedHistory.some((s: any) => {
            const salaryYear = Number(s['year']);
            const salaryMonth = Number(s['month']);
            return s['employeeNumber'] === this.selectedSalaryEmployee &&
                   salaryYear === fiscalYear &&
                   salaryMonth === 6;
          });
          
          const checkMonth = hasJuneSalary ? 6 : 7;
          console.log(`[定時改定] ${fiscalYear}年度の定時改定処理を実行します。checkMonth: ${checkMonth}`);
          await this.checkAndUpdateStandardMonthlySalaryByFiscalYear(
            this.selectedSalaryEmployee,
            fiscalYear,
            checkMonth,
            sortedHistory
          );
        } else {
          console.log(`[定時改定] ${fiscalYear}年度 - 4月、5月、6月の給与が取得できないため、スキップします。`);
        }
      }
      
      console.log(`[定時改定] 給与設定後の定時改定チェック完了`);
      
      // 給与設定履歴を設定
      this.salaryHistory = sortedHistory;
      
      // 社員名を追加
      for (const salary of this.salaryHistory) {
        if (!salary.name) {
          const employee = this.employees.find((e: any) => e.employeeNumber === salary['employeeNumber']);
          if (employee) {
            salary.name = employee.name;
          }
        }
      }
      
      // フィルターを適用
      this.filterSalaryHistory();
      
      // 保険料一覧を再読み込み
      await this.loadInsuranceList();
      await this.filterInsuranceListByDate();
      
      alert('給与を設定しました');
      
      // フォームをリセット
      this.selectedSalaryEmployee = '';
      this.salaryAmount = 0;
    } catch (error) {
      console.error('Error saving salary:', error);
      alert('給与の設定に失敗しました');
    } finally {
      this.isSavingSalary = false;
    }
  }

  // 指定された年月の報酬加算額を計算（その年月が属する年度の7月から翌年6月までの賞与が4回以上の場合）
  async calculateMonthlyRewardAddition(
    employeeNumber: string,
    year: number,
    month: number,
    bonusList: any[]
  ): Promise<number> {
    try {
      // 設定を取得（年4回以上の賞与を報酬と扱うか）
      const settings = await this.firestoreService.getSettings();
      const treatBonusAsReward = settings?.treatBonusAsReward !== undefined ? settings.treatBonusAsReward : true;
      
      if (!treatBonusAsReward) {
        return 0;
      }
      
      // その年月が属する年度を判定（7月～翌年6月が1年度）
      let fiscalYear: number;
      if (month >= 7) {
        fiscalYear = year;
      } else {
        fiscalYear = year - 1;
      }
      
      // 該当年度の7月から翌年6月までの賞与を取得
      const fiscalYearBonuses = bonusList.filter((b: any) => {
        const bYear = Number(b['year']);
        const bMonth = Number(b['month']);
        if (b['employeeNumber'] !== employeeNumber) return false;
        
        // 年度を判定
        let bFiscalYear: number;
        if (bMonth >= 7) {
          bFiscalYear = bYear;
        } else {
          bFiscalYear = bYear - 1;
        }
        
        return bFiscalYear === fiscalYear;
      });
      
      // 年度賞与支給回数
      const fiscalYearBonusCount = fiscalYearBonuses.length;
      
      // 賞与支給回数が4回以上の場合のみ報酬加算額を計算
      if (fiscalYearBonusCount >= 4) {
        // 年度内の賞与合計額を計算
        const fiscalYearTotalBonus = fiscalYearBonuses.reduce((sum: number, b: any) => {
          return sum + Number(b['amount']);
        }, 0);
        
        // 年度報酬加算額（賞与合計額を12で割った額）
        return fiscalYearTotalBonus / 12;
      }
      
      return 0;
    } catch (error) {
      console.error('Error calculating monthly reward addition:', error);
      return 0;
    }
  }

  // その社員のすべての随時改定を再計算
  async recalculateAllZujijiKaitei(
    employeeNumber: string,
    salaryHistory: any[]
  ) {
    try {
      // その社員の手動設定された給与（isManual = true）を時系列順に取得
      const manualSalaries = salaryHistory
        .filter((s: any) => s['employeeNumber'] === employeeNumber && s['isManual'] === true)
        .sort((a: any, b: any) => {
          const aYear = Number(a['year']);
          const bYear = Number(b['year']);
          const aMonth = Number(a['month']);
          const bMonth = Number(b['month']);
          if (aYear !== bYear) return aYear - bYear;
          return aMonth - bMonth;
        });
      
      console.log(`[随時改定再計算] 社員番号: ${employeeNumber}, 手動設定された給与数: ${manualSalaries.length}`);
      
      // 各給与設定月について、随時改定を再計算
      for (const salary of manualSalaries) {
        const changeYear = Number(salary['year']);
        const changeMonth = Number(salary['month']);
        const changeAmount = Number(salary['amount']);
        
        console.log(`[随時改定再計算] ${changeYear}年${changeMonth}月の給与設定（${changeAmount}円）について随時改定を計算`);
        
        await this.checkAndUpdateStandardMonthlySalary(
          employeeNumber,
          changeYear,
          changeMonth,
          changeAmount,
          salaryHistory
        );
      }
    } catch (error) {
      console.error('Error recalculating all zujiji kaitei:', error);
    }
  }

  // 標準報酬月額の変更を検出して処理
  async checkAndUpdateStandardMonthlySalary(
    employeeNumber: string, 
    changeYear: number, 
    changeMonth: number, 
    newSalary: number,
    salaryHistory: any[]
  ) {
    try {
      // 変更前の標準報酬月額を取得（変更月の時点での等級）
      // まず、変更月以前の最新の標準報酬月額変更情報を取得
      const standardChangeBeforeChange = await this.firestoreService.getStandardMonthlySalaryChange(
        employeeNumber,
        changeYear,
        changeMonth
      );
      
      let previousGrade: number | null = null;
      
      // 変更月以前に標準報酬月額変更情報がある場合、その等級を使用
      if (standardChangeBeforeChange) {
        const effectiveYearBefore = Number(standardChangeBeforeChange.effectiveYear);
        const effectiveMonthBefore = Number(standardChangeBeforeChange.effectiveMonth);
        // 変更月以前に適用された変更情報の場合、その等級を使用
        if (effectiveYearBefore < changeYear || (effectiveYearBefore === changeYear && effectiveMonthBefore < changeMonth)) {
          previousGrade = standardChangeBeforeChange.grade;
        }
      }
      
      // 標準報酬月額変更情報がない場合、変更月以前の最新の給与設定から等級を計算
      if (previousGrade === null) {
        const previousSalaries = salaryHistory
          .filter((s: any) => s['employeeNumber'] === employeeNumber)
          .filter((s: any) => {
            const salaryYear = Number(s['year']);
            const salaryMonth = Number(s['month']);
            if (salaryYear < changeYear) return true;
            if (salaryYear === changeYear && salaryMonth < changeMonth) return true;
            return false;
          })
          .sort((a: any, b: any) => {
            if (a['year'] !== b['year']) return b['year'] - a['year'];
            return b['month'] - a['month'];
          });
        
        const previousSalary = previousSalaries.length > 0 ? previousSalaries[0]['amount'] : null;
        if (previousSalary) {
          const previousStandardInfo = this.calculateStandardMonthlySalary(Number(previousSalary));
          previousGrade = previousStandardInfo ? previousStandardInfo.grade : null;
        } else {
          // 変更月以前の給与設定がない場合、入社時の給与見込み額から等級を計算
          const employeeData = await this.firestoreService.getEmployeeData(employeeNumber);
          if (employeeData) {
            const expectedMonthlySalary = Number(employeeData.expectedMonthlySalary) || 0;
            const expectedAnnualBonus = Number(employeeData.expectedAnnualBonus) || 
                                       Number(employeeData.applicationData?.expectedAnnualBonus) || 0;
            const expectedMonthlyBonus = expectedAnnualBonus / 12;
            const initialFixedSalary = expectedMonthlySalary + expectedMonthlyBonus;
            
            const initialStandardInfo = this.calculateStandardMonthlySalary(initialFixedSalary);
            previousGrade = initialStandardInfo ? initialStandardInfo.grade : null;
          }
        }
      }
      
      // 3か月の固定的賃金の平均を計算（変更月、変更月+1、変更月+2の3か月）
      const salariesForAverage: number[] = [];
      
      // 賞与一覧を取得（報酬加算額の計算に必要）
      const allBonuses = await this.firestoreService.getBonusHistory();
      const bonusList = allBonuses.map((bonus: any) => ({
        ...bonus,
        year: Number(bonus['year']),
        month: Number(bonus['month']),
        employeeNumber: bonus['employeeNumber']
      }));
      
      for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
        let targetYear = changeYear;
        let targetMonth = changeMonth + monthOffset;
        
        // 月が12を超える場合の処理
        while (targetMonth > 12) {
          targetMonth -= 12;
          targetYear += 1;
        }
        
        // 該当月の給与設定を取得（該当月に設定がある場合はそれを使用、ない場合は該当月以前の最新の給与設定を使用）
        const allSalaries = salaryHistory.filter((s: any) => s['employeeNumber'] === employeeNumber);
        
        // まず、該当月の給与設定を探す
        const exactMonthSalary = allSalaries.find((s: any) => {
          const salaryYear = Number(s['year']);
          const salaryMonth = Number(s['month']);
          return salaryYear === targetYear && salaryMonth === targetMonth;
        });
        
        let monthlySalary = 0;
        if (exactMonthSalary) {
          // 該当月に給与設定がある場合はそれを使用
          monthlySalary = Number(exactMonthSalary['amount']);
        } else {
          // 該当月に給与設定がない場合は、該当月以前の最新の給与設定を取得
          const relevantSalaries = allSalaries
            .filter((s: any) => {
              const salaryYear = Number(s['year']);
              const salaryMonth = Number(s['month']);
              if (salaryYear < targetYear) return true;
              if (salaryYear === targetYear && salaryMonth < targetMonth) return true;
              return false;
            })
            .sort((a: any, b: any) => {
              if (a['year'] !== b['year']) return b['year'] - a['year'];
              return b['month'] - a['month'];
            });
          
          if (relevantSalaries.length > 0) {
            monthlySalary = Number(relevantSalaries[0]['amount']);
          } else {
            // 該当月以前の給与設定がない場合、変更月の給与を使用
            monthlySalary = Number(newSalary);
          }
        }
        
        // 報酬加算額を計算して加算
        const rewardAddition = await this.calculateMonthlyRewardAddition(
          employeeNumber,
          targetYear,
          targetMonth,
          bonusList
        );
        
        salariesForAverage.push(monthlySalary + rewardAddition);
      }
      
      // 平均を計算
      const averageSalary = salariesForAverage.reduce((sum, val) => sum + val, 0) / salariesForAverage.length;
      
      // 新しい標準報酬月額を計算
      const newStandardInfo = this.calculateStandardMonthlySalary(averageSalary);
      if (!newStandardInfo) return;
      
      const newGrade = newStandardInfo.grade;
      
      // 等級差が2以上の場合、3か月後から新等級を適用
      if (previousGrade !== null && Math.abs(newGrade - previousGrade) >= 2) {
        // 3か月後の年月を計算
        let effectiveYear = changeYear;
        let effectiveMonth = changeMonth + 3;
        while (effectiveMonth > 12) {
          effectiveMonth -= 12;
          effectiveYear += 1;
        }
        
        // 標準報酬月額変更情報を保存
        await this.firestoreService.saveStandardMonthlySalaryChange(
          employeeNumber,
          effectiveYear,
          effectiveMonth,
          newGrade,
          newStandardInfo.monthlyStandard
        );
      }
    } catch (error) {
      console.error('Error checking standard monthly salary change:', error);
      // エラーが発生しても給与設定は保存されているので、処理を続行
    }
  }

  // 年度ごとの4月～6月の平均による標準報酬月額の変更を検出して処理（定時改定）
  async checkAndUpdateStandardMonthlySalaryByFiscalYear(
    employeeNumber: string,
    changeYear: number,
    changeMonth: number,
    salaryHistory: any[]
  ) {
    console.log(`[定時改定] メソッドが呼び出されました。社員番号: ${employeeNumber}, 変更年: ${changeYear}, 変更月: ${changeMonth}`);
    
    try {
      // 年度を判定（4月～3月が1年度）
      let fiscalYear: number;
      if (changeMonth >= 4) {
        fiscalYear = changeYear;
      } else {
        fiscalYear = changeYear - 1;
      }
      
      console.log(`[定時改定] 判定された年度: ${fiscalYear}年度`);
      
      // 6月の給与設定が完了しているかチェック（6月の給与設定があるか、または6月以降の給与設定があるか）
      // ただし、6月の給与設定がなくても、4月、5月の給与設定があれば処理を続行
      const hasJuneSalary = salaryHistory.some((s: any) => {
        const salaryYear = Number(s['year']);
        const salaryMonth = Number(s['month']);
        return s['employeeNumber'] === employeeNumber && 
               salaryYear === fiscalYear && 
               salaryMonth === 6;
      });
      
      // 6月の給与設定がない場合、6月以降の給与設定があるかチェック
      const hasAfterJuneSalary = !hasJuneSalary && salaryHistory.some((s: any) => {
        const salaryYear = Number(s['year']);
        const salaryMonth = Number(s['month']);
        return s['employeeNumber'] === employeeNumber && 
               salaryYear === fiscalYear && 
               salaryMonth > 6;
      });
      
      // 6月の給与設定がなく、6月以降の給与設定もない場合、かつ現在の変更月が6月でない場合は処理しない
      // ただし、ページ読み込み時の一括計算の場合は、6月の給与設定がなくても処理を続行
      // （changeMonthが6月でない場合でも、6月以降の給与設定があれば処理を続行）
      if (!hasJuneSalary && !hasAfterJuneSalary && changeMonth !== 6) {
        // ただし、6月以降の給与設定が将来的にある可能性があるため、4月、5月の給与設定があれば処理を続行
        const hasAprilOrMaySalary = salaryHistory.some((s: any) => {
          const salaryYear = Number(s['year']);
          const salaryMonth = Number(s['month']);
          return s['employeeNumber'] === employeeNumber && 
                 salaryYear === fiscalYear && 
                 (salaryMonth === 4 || salaryMonth === 5);
        });
        
        if (!hasAprilOrMaySalary) {
          console.log(`[定時改定] 6月の給与設定がなく、4月・5月の給与設定もないため、処理をスキップします。`);
          return;
        }
      }
      
      console.log(`[定時改定] 処理を続行します。6月の給与設定: ${hasJuneSalary}, 6月以降の給与設定: ${hasAfterJuneSalary}`);
      
      // 4月、5月、6月の各月の給与を取得
      const salariesForAverage: number[] = [];
      const salaryDetails: { month: number; amount: number; source: string }[] = [];
      
      // 賞与一覧を取得（報酬加算額の計算に必要）
      const allBonuses = await this.firestoreService.getBonusHistory();
      const bonusList = allBonuses.map((bonus: any) => ({
        ...bonus,
        year: Number(bonus['year']),
        month: Number(bonus['month']),
        employeeNumber: bonus['employeeNumber']
      }));
      
      for (let month = 4; month <= 6; month++) {
        // 該当月の給与設定を取得
        const allSalaries = salaryHistory.filter((s: any) => s['employeeNumber'] === employeeNumber);
        
        // まず、該当月の給与設定を探す
        const exactMonthSalary = allSalaries.find((s: any) => {
          const salaryYear = Number(s['year']);
          const salaryMonth = Number(s['month']);
          return salaryYear === fiscalYear && salaryMonth === month;
        });
        
        let monthlySalary = 0;
        if (exactMonthSalary) {
          // 該当月に給与設定がある場合はそれを使用
          monthlySalary = Number(exactMonthSalary['amount']);
          salaryDetails.push({ month, amount: monthlySalary, source: '該当月の給与設定' });
        } else {
          // 該当月に給与設定がない場合は、該当月以前の最新の給与設定を取得
          const relevantSalaries = allSalaries
            .filter((s: any) => {
              const salaryYear = Number(s['year']);
              const salaryMonth = Number(s['month']);
              if (salaryYear < fiscalYear) return true;
              if (salaryYear === fiscalYear && salaryMonth < month) return true;
              return false;
            })
            .sort((a: any, b: any) => {
              if (a['year'] !== b['year']) return b['year'] - a['year'];
              return b['month'] - a['month'];
            });
          
          if (relevantSalaries.length > 0) {
            monthlySalary = Number(relevantSalaries[0]['amount']);
            const sourceYear = Number(relevantSalaries[0]['year']);
            const sourceMonth = Number(relevantSalaries[0]['month']);
            salaryDetails.push({ 
              month, 
              amount: monthlySalary, 
              source: `該当月以前の最新の給与設定（${sourceYear}年${sourceMonth}月）` 
            });
          } else {
            salaryDetails.push({ month, amount: 0, source: '給与設定なし' });
          }
        }
        
        // 報酬加算額を計算して加算
        const rewardAddition = await this.calculateMonthlyRewardAddition(
          employeeNumber,
          fiscalYear,
          month,
          bonusList
        );
        
        salariesForAverage.push(monthlySalary + rewardAddition);
      }
      
      // コンソールログ出力：計算に用いられた月の給与額
      console.log(`[定時改定] 社員番号: ${employeeNumber}, 年度: ${fiscalYear}年度`);
      console.log(`[定時改定] 計算に用いられた月の給与額:`, salaryDetails);
      
      // 4月～6月の給与が全て取得できたかチェック
      if (salariesForAverage.length < 3) {
        console.log(`[定時改定] 4月～6月の給与が全て取得できませんでした。取得できた給与数: ${salariesForAverage.length}`);
        return; // 4月～6月の給与が全て取得できない場合は処理しない
      }
      
      // 平均を計算
      const averageSalary = salariesForAverage.reduce((sum, val) => sum + val, 0) / salariesForAverage.length;
      
      // コンソールログ出力：計算された平均給与
      console.log(`[定時改定] 計算された平均給与: ${averageSalary}円`);
      
      // 平均が有効な数値でない場合は処理しない
      if (isNaN(averageSalary) || averageSalary <= 0) {
        console.log(`[定時改定] 平均給与が無効な値です: ${averageSalary}`);
        return;
      }
      
      // 新しい標準報酬月額を計算
      const newStandardInfo = this.calculateStandardMonthlySalary(averageSalary);
      if (!newStandardInfo) {
        console.log(`[定時改定] 標準報酬月額の計算に失敗しました。平均給与: ${averageSalary}円`);
        return;
      }
      
      const newGrade = newStandardInfo.grade;
      console.log(`[定時改定] 算出された等級: ${newGrade}, 標準報酬月額: ${newStandardInfo.monthlyStandard}円`);
      
      // 7月、8月、9月に随時改定が適用されたかチェック
      // 随時改定は、給与変更月から3か月後に適用されるため、
      // 7,8,9月に適用される随時改定は、4,5,6月の給与変更によるもの
      const hasZujijiKaiteiInJulyToSeptember = await this.hasZujijiKaiteiInJulyToSeptember(
        employeeNumber,
        fiscalYear,
        salaryHistory
      );
      
      // 随時改定が適用されている場合は、定時改定をスキップ
      if (hasZujijiKaiteiInJulyToSeptember) {
        console.log(`[定時改定] 7月、8月、9月に随時改定が適用されているため、定時改定をスキップします。`);
        return;
      }
      
      // 既に9月からの標準報酬月額変更情報が保存されているかチェック
      const existingChange = await this.firestoreService.getStandardMonthlySalaryChange(
        employeeNumber,
        fiscalYear,
        9
      );
      
      // 既に9月からの変更情報がある場合、等級が異なる場合のみ更新
      if (existingChange && existingChange.grade === newGrade) {
        console.log(`[定時改定] 既に同じ等級（${newGrade}）が設定されているため、処理をスキップします。`);
        return; // 既に同じ等級が設定されている場合は処理しない
      }
      
      // 9月から新等級を適用（4.5.6月の平均給与から算出した等級）
      const effectiveYear = fiscalYear;
      const effectiveMonth = 9;
      
      console.log(`[定時改定] 9月から等級${newGrade}を適用します。標準報酬月額: ${newStandardInfo.monthlyStandard}円`);
      
      // 標準報酬月額変更情報を保存
      await this.firestoreService.saveStandardMonthlySalaryChange(
        employeeNumber,
        effectiveYear,
        effectiveMonth,
        newGrade,
        newStandardInfo.monthlyStandard
      );
      
      console.log(`[定時改定] 標準報酬月額変更情報を保存しました。`);
    } catch (error) {
      console.error('Error checking standard monthly salary change by fiscal year:', error);
      // エラーが発生しても給与設定は保存されているので、処理を続行
    }
  }

  // 7月、8月、9月に随時改定が適用されたかチェック
  // 随時改定は、給与変更月から3か月後に適用されるため、
  // 7,8,9月に適用される随時改定は、4,5,6月の給与変更によるもの
  async hasZujijiKaiteiInJulyToSeptember(
    employeeNumber: string,
    fiscalYear: number,
    salaryHistory: any[]
  ): Promise<boolean> {
    try {
      // 標準報酬月額変更情報を取得（該当年度の7,8,9月に適用された変更）
      const changes = await this.firestoreService.getStandardMonthlySalaryChangesInPeriod(
        employeeNumber,
        fiscalYear,
        7,
        fiscalYear,
        9
      );
      
      // 7,8,9月に適用された変更がある場合、それが随時改定かどうかを判定
      // 随時改定は、給与変更月から3か月後に適用されるため、
      // 7月に適用される随時改定は、4月の給与変更によるもの
      // 8月に適用される随時改定は、5月の給与変更によるもの
      // 9月に適用される随時改定は、6月の給与変更によるもの
      // 9月に適用される変更は、定時改定の可能性もあるが、随時改定を優先する
      for (const change of changes) {
        const effectiveMonth = Number(change.effectiveMonth);
        const effectiveYear = Number(change.effectiveYear);
        
        console.log(`[随時改定チェック] ${fiscalYear}年度 - 変更情報: 適用年月=${effectiveYear}年${effectiveMonth}月, 等級=${change.grade}`);
        
        // 随時改定の給与変更月を計算（適用月の3か月前）
        let changeYear = effectiveYear;
        let changeMonth = effectiveMonth - 3;
        while (changeMonth < 1) {
          changeMonth += 12;
          changeYear -= 1;
        }
        
        console.log(`[随時改定チェック] ${fiscalYear}年度 - 適用月${effectiveMonth}月の変更は、${changeYear}年${changeMonth}月の給与変更によるものと判定`);
        
        // 該当年度の4,5,6月の給与変更があるかチェック
        // 7月に適用される随時改定は、4月の給与変更によるもの
        // 8月に適用される随時改定は、5月の給与変更によるもの
        // 9月に適用される随時改定は、6月の給与変更によるもの
        if (changeMonth >= 4 && changeMonth <= 6 && changeYear === fiscalYear) {
          // 手動設定された給与（isManual = true）のみをチェック
          // また、前月の給与と異なる場合のみ「給与変更」とみなす
          const targetSalary = salaryHistory.find((s: any) => {
            const salaryYear = Number(s['year']);
            const salaryMonth = Number(s['month']);
            return s['employeeNumber'] === employeeNumber &&
                   salaryYear === changeYear && 
                   salaryMonth === changeMonth &&
                   s['isManual'] === true; // 手動設定された給与のみ
          });
          
          if (targetSalary) {
            // 前月の給与を取得
            let previousMonth = changeMonth - 1;
            let previousYear = changeYear;
            if (previousMonth < 1) {
              previousMonth = 12;
              previousYear -= 1;
            }
            
            const previousSalary = salaryHistory.find((s: any) => {
              const salaryYear = Number(s['year']);
              const salaryMonth = Number(s['month']);
              return s['employeeNumber'] === employeeNumber &&
                     salaryYear === previousYear && 
                     salaryMonth === previousMonth;
            });
            
            const targetAmount = Number(targetSalary['amount']);
            const previousAmount = previousSalary ? Number(previousSalary['amount']) : null;
            
            // 前月の給与と異なる場合のみ「給与変更」とみなす
            const isSalaryChange = previousAmount === null || targetAmount !== previousAmount;
            
            console.log(`[随時改定チェック] ${fiscalYear}年度 - ${changeYear}年${changeMonth}月の給与: ${targetAmount}円, 前月(${previousYear}年${previousMonth}月)の給与: ${previousAmount !== null ? previousAmount + '円' : 'なし'}, 給与変更: ${isSalaryChange ? 'あり' : 'なし'}`);
            
            if (isSalaryChange) {
              console.log(`[随時改定チェック] ${fiscalYear}年度 - 随時改定が検出されました（${effectiveMonth}月適用、${changeYear}年${changeMonth}月の給与変更による）`);
              return true;
            }
          } else {
            console.log(`[随時改定チェック] ${fiscalYear}年度 - ${changeYear}年${changeMonth}月の手動設定された給与: なし`);
          }
        } else {
          console.log(`[随時改定チェック] ${fiscalYear}年度 - ${changeYear}年${changeMonth}月は該当年度の4,5,6月ではないため、スキップ`);
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking zujiji kaitei in July to September:', error);
      return false;
    }
  }

  // 全社員について、2030年までの給与設定履歴を確認して定時改定と随時改定を計算
  async calculateStandardMonthlySalaryChangesForAllEmployees() {
    try {
      // 定時改定・随時改定の計算には、すべての給与（自動設定含む）が必要なため、getAllSalaryHistoryを使用
      const allHistory = await this.firestoreService.getAllSalaryHistory();
      
      // 2030年までの給与設定履歴をフィルタリング
      const filteredHistory = allHistory.filter((s: any) => {
        const salaryYear = Number(s['year']);
        return salaryYear <= 2030;
      });
      
      // 社員番号ごとにグループ化
      const employeeNumbers = [...new Set(filteredHistory.map((s: any) => s['employeeNumber']))];
      
      // 各社員について処理
      for (const employeeNumber of employeeNumbers) {
        const employeeSalaries = filteredHistory
          .filter((s: any) => s['employeeNumber'] === employeeNumber)
          .sort((a: any, b: any) => {
            const aYear = Number(a['year']);
            const bYear = Number(b['year']);
            const aMonth = Number(a['month']);
            const bMonth = Number(b['month']);
            if (aYear !== bYear) return aYear - bYear;
            return aMonth - bMonth;
          });
        
        // 各給与設定について、随時改定を計算
        for (const salary of employeeSalaries) {
          const salaryYear = Number(salary['year']);
          const salaryMonth = Number(salary['month']);
          const salaryAmount = Number(salary['amount']);
          
          // 随時改定の計算
          await this.checkAndUpdateStandardMonthlySalary(
            employeeNumber,
            salaryYear,
            salaryMonth,
            salaryAmount,
            filteredHistory
          );
        }
        
        // 各年度について定時改定を計算（2025年度から2030年度まで）
        for (let fiscalYear = 2025; fiscalYear <= 2030; fiscalYear++) {
          // 6月の給与設定が完了しているかチェック
          const hasJuneSalary = filteredHistory.some((s: any) => {
            const salaryYear = Number(s['year']);
            const salaryMonth = Number(s['month']);
            return s['employeeNumber'] === employeeNumber && 
                   salaryYear === fiscalYear && 
                   salaryMonth === 6;
          });
          
          // 6月以降の給与設定があるかチェック
          const hasAfterJuneSalary = filteredHistory.some((s: any) => {
            const salaryYear = Number(s['year']);
            const salaryMonth = Number(s['month']);
            return s['employeeNumber'] === employeeNumber && 
                   salaryYear === fiscalYear && 
                   salaryMonth > 6;
          });
          
          // 6月の給与設定があるか、6月以降の給与設定がある場合、定時改定を計算
          if (hasJuneSalary || hasAfterJuneSalary) {
            // 6月の給与設定がある場合は6月として、ない場合は7月として処理
            const checkMonth = hasJuneSalary ? 6 : 7;
            await this.checkAndUpdateStandardMonthlySalaryByFiscalYear(
              employeeNumber,
              fiscalYear,
              checkMonth,
              filteredHistory
            );
          }
        }
      }
    } catch (error) {
      console.error('Error calculating standard monthly salary changes for all employees:', error);
      // エラーが発生しても処理を続行
    }
  }
  
  // 給与設定履歴をフィルタリング
  filterSalaryHistory() {
    // isManual === true のもののみを表示（手動設定された給与のみ）
    let filtered = this.salaryHistory.filter((record: any) => {
      return record['isManual'] === true;
    });
    
    if (this.selectedSalaryHistoryFilter) {
      filtered = filtered.filter(
        (record: any) => record['employeeNumber'] === this.selectedSalaryHistoryFilter
      );
    }
    
    this.filteredSalaryHistory = filtered;
    
    // 常に追加された順番（新しいものが上）でソート
    this.filteredSalaryHistory.sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }

  // 賞与設定履歴をフィルタリング
  filterBonusHistory() {
    if (!this.selectedBonusHistoryFilter) {
      this.filteredBonusHistory = [...this.bonusHistory];
    } else {
      this.filteredBonusHistory = this.bonusHistory.filter(
        (record: any) => record['employeeNumber'] === this.selectedBonusHistoryFilter
      );
    }
    
    // 常に追加された順番（新しいものが上）でソート
    this.filteredBonusHistory.sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }
  
  // 賞与を保存
  async saveBonus() {
    if (!this.selectedBonusEmployee || !this.bonusAmount || this.bonusAmount <= 0) {
      alert('社員と賞与額を入力してください');
      return;
    }
    
    // 年月を数値型に変換（selectから文字列型で来る可能性があるため）
    this.bonusYear = Number(this.bonusYear);
    this.bonusMonth = Number(this.bonusMonth);
    
    this.isSavingBonus = true;
    try {
      // 賞与設定をFirestoreに保存
      await this.firestoreService.saveBonus(
        this.selectedBonusEmployee,
        this.bonusYear,
        this.bonusMonth,
        this.bonusAmount
      );
      
      // 賞与設定履歴を再読み込み
      const bonuses = await this.firestoreService.getBonusHistory();
      
      // 日時順にソート（新しいものから）
      this.bonusHistory = bonuses.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // 社員名を追加
      for (const bonus of this.bonusHistory) {
        const employee = this.employees.find((e: any) => e.employeeNumber === bonus['employeeNumber']);
        if (employee) {
          bonus.name = employee.name;
        }
      }
      
      // フィルターを適用
      this.filterBonusHistory();
      
      // 社員名を追加してbonusListに設定
      this.bonusList = bonuses.map((bonus: any) => {
        const employee = this.employees.find((e: any) => e.employeeNumber === bonus['employeeNumber']);
        return {
          ...bonus,
          year: Number(bonus['year']), // 数値型に変換
          month: Number(bonus['month']), // 数値型に変換
          name: employee?.name || ''
        };
      });
      
      // 設定を取得（年4回以上の賞与を報酬と扱うか）
      const settings = await this.firestoreService.getSettings();
      const treatBonusAsReward = settings?.treatBonusAsReward !== undefined ? settings.treatBonusAsReward : true;
      
      // 年4回以上の賞与を報酬と扱う設定が「はい」の場合、賞与支給月を給与変更月として随時改定処理を行う
      if (treatBonusAsReward) {
        // その年度の賞与支給回数を確認
        const bonusFiscalYear = this.bonusMonth >= 7 ? this.bonusYear : this.bonusYear - 1;
        const fiscalYearBonuses = bonuses.filter((b: any) => {
          const bYear = Number(b['year']);
          const bMonth = Number(b['month']);
          if (b['employeeNumber'] !== this.selectedBonusEmployee) return false;
          
          let bFiscalYear: number;
          if (bMonth >= 7) {
            bFiscalYear = bYear;
          } else {
            bFiscalYear = bYear - 1;
          }
          
          return bFiscalYear === bonusFiscalYear;
        });
        
        const fiscalYearBonusCount = fiscalYearBonuses.length;
        
        // 賞与支給回数が4回以上になった場合、随時改定処理を行う
        if (fiscalYearBonusCount >= 4) {
          console.log(`[賞与設定] 年度賞与支給回数が4回以上（${fiscalYearBonusCount}回）になったため、随時改定処理を実行します。`);
          
          // 給与設定履歴を取得（随時改定の計算に必要）
          const allSalaryHistory = await this.firestoreService.getAllSalaryHistory();
          
          // 賞与支給月を給与変更月として随時改定処理を行う
          // ただし、実際の給与変更ではないため、給与額は0として処理し、報酬加算額のみを考慮する
          // 実際には、その月の給与に報酬加算額を加算した額で随時改定を計算する必要がある
          // しかし、賞与支給月に給与設定がない場合もあるため、その月以前の最新の給与設定を使用する
          
          // その社員のすべての随時改定を再計算（報酬加算額が変更されたため）
          await this.recalculateAllZujijiKaitei(
            this.selectedBonusEmployee,
            allSalaryHistory
          );
        }
      }
      
      // 保険料一覧を再フィルタリング
      await this.filterInsuranceListByDate();
      
      alert('賞与を設定しました');
      
      // フォームをリセット
      this.selectedBonusEmployee = '';
      this.bonusAmount = 0;
    } catch (error) {
      console.error('Error saving bonus:', error);
      alert('賞与の設定に失敗しました');
    } finally {
      this.isSavingBonus = false;
    }
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.clear();
    }
    this.router.navigate(['/login']);
  }

  async openEmployeeInfoModal(employeeNumber: string): Promise<void> {
    try {
      this.showEmployeeInfoModal = true;
      this.selectedEmployeeInfo = null;
      
      // 社員情報を取得
      const employeeData = await this.firestoreService.getEmployeeData(employeeNumber);
      
      if (employeeData) {
        // 年齢を計算（生年月日から）
        let age: number | null = null;
        if (employeeData.birthDate) {
          const birthDate = employeeData.birthDate instanceof Date 
            ? employeeData.birthDate 
            : (employeeData.birthDate.toDate ? employeeData.birthDate.toDate() : new Date(employeeData.birthDate));
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }
        
        // 保険料一覧から等級を取得
        let grade: number | null = null;
        const insuranceItem = this.filteredInsuranceList.find((item: any) => item.employeeNumber === employeeNumber);
        if (insuranceItem && insuranceItem.grade) {
          grade = insuranceItem.grade;
        } else {
          // 保険料一覧にない場合は、固定的賃金から計算
          const expectedMonthlySalary = Number(employeeData.expectedMonthlySalary) || 0;
          const expectedAnnualBonus = Number(employeeData.expectedAnnualBonus) || 
                                     Number(employeeData.applicationData?.expectedAnnualBonus) || 0;
          const expectedMonthlyBonus = expectedAnnualBonus / 12;
          const fixedSalary = expectedMonthlySalary + expectedMonthlyBonus;
          
          // 給与設定履歴から最新の給与を取得
          const relevantSalaries = this.salaryHistory
            .filter((s: any) => s['employeeNumber'] === employeeNumber)
            .sort((a: any, b: any) => {
              if (a['year'] !== b['year']) return b['year'] - a['year'];
              return b['month'] - a['month'];
            });
          
          const latestSalary = relevantSalaries.length > 0 ? relevantSalaries[0] : null;
          const finalFixedSalary = latestSalary ? latestSalary['amount'] : fixedSalary;
          
          const standardSalaryInfo = this.calculateStandardMonthlySalary(finalFixedSalary);
          grade = standardSalaryInfo ? standardSalaryInfo.grade : null;
        }
        
        // 年度報酬加算額を計算（その年の7月から翌年6月までの賞与合計額を12で割った額）
        // フィルターで選択されている年月に基づいて年度を判定
        const filterYear = Number(this.insuranceListYear);
        const filterMonth = Number(this.insuranceListMonth);
        
        // フィルターで選択されている年月の年度を判定（7月～翌年6月が1年度）
        let currentFiscalYear: number;
        if (filterMonth >= 7) {
          currentFiscalYear = filterYear;
        } else {
          currentFiscalYear = filterYear - 1;
        }
        
        // 該当年度の7月から6月までの賞与を取得
        const fiscalYearBonuses = this.bonusList.filter((b: any) => {
          const bYear = Number(b['year']);
          const bMonth = Number(b['month']);
          if (b['employeeNumber'] !== employeeNumber) return false;
          
          // 年度を判定
          let bFiscalYear: number;
          if (bMonth >= 7) {
            bFiscalYear = bYear;
          } else {
            bFiscalYear = bYear - 1;
          }
          
          return bFiscalYear === currentFiscalYear;
        });
        
        // 年度賞与支給回数
        const fiscalYearBonusCount = fiscalYearBonuses.length;
        
        // 設定を取得（年4回以上の賞与を報酬と扱うか）
        const settings = await this.firestoreService.getSettings();
        const treatBonusAsReward = settings?.treatBonusAsReward !== undefined ? settings.treatBonusAsReward : true;
        
        // 年度報酬加算額（設定が「はい」で、賞与支給回数が4回以上の場合のみ算出）
        let annualRewardAddition = 0;
        if (treatBonusAsReward && fiscalYearBonusCount >= 4) {
          // 年度内の賞与合計額を計算
          const fiscalYearTotalBonus = fiscalYearBonuses.reduce((sum: number, b: any) => {
            return sum + Number(b['amount']);
          }, 0);
          
          // 年度報酬加算額（賞与合計額を12で割った額）
          annualRewardAddition = fiscalYearTotalBonus / 12;
        }
        
        this.selectedEmployeeInfo = {
          ...employeeData,
          age: age,
          grade: grade,
          annualRewardAddition: annualRewardAddition,
          fiscalYear: currentFiscalYear,
          fiscalYearBonusCount: fiscalYearBonusCount
        };
      } else {
        alert('社員情報が見つかりませんでした。');
        this.closeEmployeeInfoModal();
      }
    } catch (error) {
      console.error('Error loading employee info:', error);
      alert('社員情報の読み込みに失敗しました。');
      this.closeEmployeeInfoModal();
    }
  }

  closeEmployeeInfoModal(): void {
    this.showEmployeeInfoModal = false;
    this.selectedEmployeeInfo = null;
  }
}

