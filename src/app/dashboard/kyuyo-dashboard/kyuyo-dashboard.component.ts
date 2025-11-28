import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-kyuyo-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
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
  
  // 健康保険料率データ
  kenpoRates: any[] = [];

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private firestoreService: FirestoreService,
    private http: HttpClient,
    private fb: FormBuilder
  ) {
    this.settingsForm = this.createSettingsForm();
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
      pensionInsuranceRate: [0]
    });
  }
  
  // 健康保険料率データを読み込む
  async loadKenpoRates() {
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
        
        // フォームに値を設定
        this.settingsForm.patchValue({
          healthInsuranceType: this.healthInsuranceType,
          prefecture: this.selectedPrefecture,
          healthInsuranceRate: this.insuranceRates.healthInsurance,
          nursingInsuranceRate: this.insuranceRates.nursingInsurance,
          pensionInsuranceRate: this.insuranceRates.pensionInsurance
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
      
      // 社会保険料一覧を再読み込み
      await this.loadInsuranceList();
    } catch (error) {
      console.error('Error saving insurance rates:', error);
      alert('保険料率設定の保存中にエラーが発生しました');
    }
  }

  // 等級表を読み込む
  async loadGradeTable() {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      
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

  // 50円単位で切り上げ/切り捨て
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
    
    // 設定タブが選択された場合、設定を読み込む
    if (tabName === '設定') {
      this.loadSettings().catch(err => {
        console.error('Error in loadSettings:', err);
      });
    }
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.clear();
    }
    this.router.navigate(['/login']);
  }
}

