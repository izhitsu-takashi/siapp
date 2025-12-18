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
    { id: 'leave-voluntary', name: '休業・任意保険者' },
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
  // コメント要素（ダウンロード時に保持するため）
  gradeTableComment: any = null;
  
  // 設定ページ用データ
  settingsForm!: FormGroup;
  healthInsuranceType: string = '協会けんぽ';
  selectedPrefecture: string = '';
  
  // 保険料を現金で徴収する社員
  cashCollectionEmployees: any[] = []; // 現金徴収する社員のリスト
  selectedCashCollectionEmployee: string = ''; // 選択された社員番号（追加用）
  
  // 健康保険料率データ
  kenpoRates: any[] = [];
  // コメント要素（ダウンロード時に保持するため）
  kenpoRatesComment: any = null;
  
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
  
  // 給与設定の進行状況
  salarySaveProgress: {
    message: string;
    progress: number; // 0-100
  } = {
    message: '',
    progress: 0
  };

  // ブラウザ更新を防止するハンドラー
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  // 社員情報モーダル
  showEmployeeInfoModal = false;
  selectedEmployeeInfo: any = null;
  
  // 休業・任意保険者ページ用データ
  leaveVoluntaryListType: 'maternity' | 'voluntary' = 'maternity'; // 産前産後休業中または任意継続被保険者の切り替え
  leaveVoluntaryList: any[] = []; // 休業・任意保険者一覧
  filteredLeaveVoluntaryList: any[] = []; // フィルタリング後の一覧
  isLoadingLeaveVoluntaryList: boolean = false; // 読み込み中フラグ
  
  // 任意継続終了設定モーダル
  showVoluntaryEndModal = false;
  selectedVoluntaryEmployee: any = null;
  voluntaryEndForm!: FormGroup;
  isSavingVoluntaryEnd = false;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private firestoreService: FirestoreService,
    private http: HttpClient,
    private fb: FormBuilder
  ) {
    this.settingsForm = this.createSettingsForm();
    this.voluntaryEndForm = this.createVoluntaryEndForm();
    
    // 年月フィルター用の選択肢を初期化（2025年から2028年まで）
    const currentYear = new Date().getFullYear();
    for (let year = 2025; year <= 2028; year++) {
      this.availableYears.push(year);
    }
    
    // 現在の年月が2028年12月を超えている場合は、2028年12月に設定
    if (this.insuranceListYear > 2028 || (this.insuranceListYear === 2028 && this.insuranceListMonth > 12)) {
      this.insuranceListYear = 2028;
      this.insuranceListMonth = 12;
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
    const form = this.fb.group({
      // 都道府県設定
      prefecture: [''], // 都道府県
      // 保険料率設定
      healthInsuranceRate: [{value: 0, disabled: true}], // 編集無効
      nursingInsuranceRate: [{value: 0, disabled: true}], // 編集無効
      pensionInsuranceRate: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    });
    
    return form;
  }
  
  // 任意継続終了設定フォームを作成
  createVoluntaryEndForm(): FormGroup {
    return this.fb.group({
      voluntaryEndDate: ['', Validators.required]
    });
  }
  
  // 任意継続終了設定モーダルを開く
  openVoluntaryEndModal(employee: any) {
    this.selectedVoluntaryEmployee = employee;
    
    // バリデーターを設定
    const voluntaryEndDateControl = this.voluntaryEndForm.get('voluntaryEndDate');
    if (voluntaryEndDateControl && employee.resignationDate) {
      const resignationDate = new Date(employee.resignationDate);
      const minDate = new Date(resignationDate);
      minDate.setDate(minDate.getDate() + 1);
      
      // カスタムバリデーターを追加（退職日の翌日以降であることを確認）
      voluntaryEndDateControl.setValidators([
        Validators.required,
        (control) => {
          if (!control.value || !employee.resignationDate) {
            return null;
          }
          const selectedDate = new Date(control.value);
          const resignation = new Date(employee.resignationDate);
          
          // 退職日を含む退職日より前の日付は無効
          if (selectedDate <= resignation) {
            return { minDate: true };
          }
          return null;
        }
      ]);
      voluntaryEndDateControl.updateValueAndValidity();
    }
    
    // 退職日の翌日から2年後の日をデフォルト値として設定
    if (employee.resignationDate) {
      const resignationDate = new Date(employee.resignationDate);
      const nextDay = new Date(resignationDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // 2年後を計算
      const twoYearsLater = new Date(nextDay);
      twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
      
      const year = twoYearsLater.getFullYear();
      const month = String(twoYearsLater.getMonth() + 1).padStart(2, '0');
      const day = String(twoYearsLater.getDate()).padStart(2, '0');
      const defaultDateString = `${year}-${month}-${day}`;
      
      this.voluntaryEndForm.patchValue({
        voluntaryEndDate: defaultDateString
      });
    }
    
    this.showVoluntaryEndModal = true;
  }
  
  // 任意継続終了日の最小日付を取得（退職日の翌日）
  getMinVoluntaryEndDate(): string {
    if (!this.selectedVoluntaryEmployee || !this.selectedVoluntaryEmployee.resignationDate) {
      return '';
    }
    
    const resignationDate = new Date(this.selectedVoluntaryEmployee.resignationDate);
    const nextDay = new Date(resignationDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const year = nextDay.getFullYear();
    const month = String(nextDay.getMonth() + 1).padStart(2, '0');
    const day = String(nextDay.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 任意継続終了日の最大日付を取得（退職日の翌日から2年後）
  getMaxVoluntaryEndDate(): string {
    if (!this.selectedVoluntaryEmployee || !this.selectedVoluntaryEmployee.resignationDate) {
      return '';
    }
    
    const resignationDate = new Date(this.selectedVoluntaryEmployee.resignationDate);
    const nextDay = new Date(resignationDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // 2年後を計算
    const twoYearsLater = new Date(nextDay);
    twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
    
    const year = twoYearsLater.getFullYear();
    const month = String(twoYearsLater.getMonth() + 1).padStart(2, '0');
    const day = String(twoYearsLater.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 任意継続終了設定モーダルを閉じる
  closeVoluntaryEndModal() {
    this.showVoluntaryEndModal = false;
    this.selectedVoluntaryEmployee = null;
    
    // バリデーターをリセット
    const voluntaryEndDateControl = this.voluntaryEndForm.get('voluntaryEndDate');
    if (voluntaryEndDateControl) {
      voluntaryEndDateControl.setValidators([Validators.required]);
      voluntaryEndDateControl.updateValueAndValidity();
    }
    
    this.voluntaryEndForm.reset();
  }
  
  // 任意継続終了日を保存
  async saveVoluntaryEndDate() {
    if (this.voluntaryEndForm.invalid || !this.selectedVoluntaryEmployee) {
      return;
    }
    
    this.isSavingVoluntaryEnd = true;
    try {
      const voluntaryEndDate = this.voluntaryEndForm.get('voluntaryEndDate')?.value;
      
      if (!voluntaryEndDate) {
        alert('任意継続終了日を入力してください');
        return;
      }
      
      // 退職日より前の日付が選択されていないかチェック
      if (this.selectedVoluntaryEmployee.resignationDate) {
        const resignationDate = new Date(this.selectedVoluntaryEmployee.resignationDate);
        const selectedDate = new Date(voluntaryEndDate);
        
        // 退職日を含む退職日より前の日付は設定不可
        if (selectedDate <= resignationDate) {
          alert('任意継続終了日は退職日の翌日以降である必要があります');
          this.isSavingVoluntaryEnd = false;
          return;
        }
      }
      
      // 社員データを取得
      const employeeData = await this.firestoreService.getEmployeeData(this.selectedVoluntaryEmployee.employeeNumber);
      
      if (!employeeData) {
        alert('社員データが見つかりませんでした');
        return;
      }
      
      // 任意継続終了日を設定（文字列として保存）
      const updatedData: any = {
        ...employeeData,
        voluntaryInsuranceEndDate: voluntaryEndDate,
        updatedAt: new Date()
      };
      
      // 社員データを更新
      await this.firestoreService.saveEmployeeData(this.selectedVoluntaryEmployee.employeeNumber, updatedData);
      
      console.log('任意継続終了日を保存しました:', voluntaryEndDate);
      alert('任意継続終了日を設定しました');
      
      // モーダルを閉じる
      this.closeVoluntaryEndModal();
      
      // 一覧を再読み込み
      await this.loadLeaveVoluntaryList();
    } catch (error) {
      console.error('Error saving voluntary end date:', error);
      alert('任意継続終了日の設定に失敗しました');
    } finally {
      this.isSavingVoluntaryEnd = false;
    }
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
        // kenpoRatesを読み込む（コメント要素は既に除外されている）
        this.kenpoRates = settings.kenpoRates;
        // コメント要素があれば読み込む
        if (settings.kenpoRatesComment) {
          this.kenpoRatesComment = settings.kenpoRatesComment;
        }
        return;
      }
      
      // Firestoreに保存されていない場合は、assetsから読み込む
      const data = await this.http.get<any[]>('/assets/kenpo-rates.json').toPromise();
      if (data) {
        // _comment要素を分離
        const commentItem = data.find((item: any) => item._comment !== undefined);
        if (commentItem) {
          this.kenpoRatesComment = commentItem;
        }
        // _comment要素を除外して読み込む
        this.kenpoRates = data.filter((item: any) => item._comment === undefined);
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
        // 都道府県設定を読み込む
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
        
        // 現金徴収する社員を読み込む
        if (settings.cashCollectionEmployees && Array.isArray(settings.cashCollectionEmployees)) {
          this.cashCollectionEmployees = settings.cashCollectionEmployees;
        } else {
          this.cashCollectionEmployees = [];
        }
        
        // フォームに値を設定
        this.settingsForm.patchValue({
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
  
  // 都道府県が選択されたときの処理
  // IME入力中フラグ
  private isPensionInsuranceRateComposing = false;
  
  // IME入力開始時（全角文字入力を防ぐ）
  onPensionInsuranceRateCompositionStart(event: CompositionEvent) {
    this.isPensionInsuranceRateComposing = true;
    event.preventDefault(); // IME入力をブロック
  }
  
  // IME入力終了時
  onPensionInsuranceRateCompositionEnd(event: CompositionEvent) {
    this.isPensionInsuranceRateComposing = false;
    // IME入力で入力された文字を削除
    const input = event.target as HTMLInputElement;
    const previousValue = input.getAttribute('data-previous-value') || '';
    input.value = previousValue;
    this.settingsForm.get('pensionInsuranceRate')?.setValue(previousValue === '' ? 0 : parseFloat(previousValue) || 0, { emitEvent: false });
  }
  
  // 厚生年金保険料率のキー入力制限（「e」や「-」、全角文字をブロック）
  onPensionInsuranceRateKeydown(event: KeyboardEvent) {
    // 編集キー（Backspace、Delete、Tab、矢印キーなど）は常に許可
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (allowedKeys.includes(event.key)) {
      return;
    }
    
    // Ctrlキーとの組み合わせ（コピー、ペーストなど）は許可
    if (event.ctrlKey && (event.key === 'a' || event.key === 'c' || event.key === 'v' || event.key === 'x')) {
      return;
    }
    
    // IME入力中はすべての入力をブロック
    if (this.isPensionInsuranceRateComposing) {
      event.preventDefault();
      return;
    }
    
    // 「e」「E」「-」「+」をブロック
    if (event.key === 'e' || event.key === 'E' || event.key === '-' || event.key === '+') {
      event.preventDefault();
      return;
    }
    
    // 全角文字をブロック（全角数字、全角スペースなど）
    const isFullWidth = /[０-９]/.test(event.key) || /[　]/.test(event.key);
    if (isFullWidth) {
      event.preventDefault();
      return;
    }
    
    // 半角数字、小数点は許可
    const isNumber = /^[0-9]$/.test(event.key);
    const isDecimal = event.key === '.' || event.code === 'Period' || event.code === 'NumpadDecimal';
    
    if (!isNumber && !isDecimal) {
      event.preventDefault();
    }
  }
  
  // 厚生年金保険料率の入力制限（0-100の範囲に制限、小数点以下第二位まで）
  onPensionInsuranceRateInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let inputValue = input.value;
    
    // 前回の値を保存（全角文字が検出された場合に戻すため）
    const previousValue = input.getAttribute('data-previous-value') || '';
    
    // 空の場合は何もしない（入力途中の可能性があるため）
    if (inputValue === '' || inputValue === '-' || inputValue === '.') {
      input.setAttribute('data-previous-value', inputValue);
      return;
    }
    
    // 全角文字が含まれているかチェック（半角数字と小数点は除外）
    const hasFullWidthNumber = /[０-９]/.test(inputValue);
    const hasFullWidthSpace = /[　]/.test(inputValue);
    // 半角数字と小数点を除いた文字列に全角文字が含まれているかチェック
    const cleanedValue = inputValue.replace(/[0-9.]/g, '');
    const hasOtherFullWidth = cleanedValue.length > 0 && /[^\x00-\x7F]/.test(cleanedValue);
    
    // 全角文字が含まれている場合は、前回の値に戻す
    if (hasFullWidthNumber || hasFullWidthSpace || hasOtherFullWidth) {
      input.value = previousValue;
      this.settingsForm.get('pensionInsuranceRate')?.setValue(previousValue === '' ? 0 : parseFloat(previousValue) || 0, { emitEvent: false });
      return;
    }
    
    // 負の符号が含まれている場合は削除
    if (inputValue.startsWith('-')) {
      inputValue = inputValue.replace(/^-+/, '');
      input.value = inputValue;
    }
    
    // 小数点以下第二位までに制限
    if (inputValue.includes('.')) {
      const parts = inputValue.split('.');
      if (parts.length > 2) {
        // 複数の小数点がある場合は最初の小数点のみ残す
        inputValue = parts[0] + '.' + parts.slice(1).join('');
      }
      const decimalPart = parts[1];
      if (decimalPart && decimalPart.length > 2) {
        // 小数点以下が2桁を超える場合は2桁に制限
        inputValue = parts[0] + '.' + decimalPart.substring(0, 2);
        input.value = inputValue;
      }
    }
    
    // 小数点のみ、または小数点で終わる場合は許可（入力途中）
    if (inputValue === '.' || inputValue.endsWith('.')) {
      return;
    }
    
    // 数値に変換を試みる
    let value = parseFloat(inputValue);
    
    // 数値でない場合は何もしない（入力途中の可能性があるため）
    if (isNaN(value)) {
      return;
    }
    
    // 0未満の場合は0に、100超の場合は100に制限
    if (value < 0) {
      value = 0;
      input.value = '0';
      input.setAttribute('data-previous-value', '0');
      this.settingsForm.get('pensionInsuranceRate')?.setValue(0, { emitEvent: false });
    } else if (value > 100) {
      value = 100;
      input.value = '100';
      input.setAttribute('data-previous-value', '100');
      this.settingsForm.get('pensionInsuranceRate')?.setValue(100, { emitEvent: false });
    } else {
      // 有効な範囲内の場合は、小数点以下第二位までに丸めてフォームに設定
      const roundedValue = Math.round(value * 100) / 100;
      if (inputValue !== roundedValue.toString() && !inputValue.endsWith('.')) {
        // 入力値と丸めた値が異なる場合（小数点以下第三位以降が入力された場合）のみ更新
        input.value = roundedValue.toString();
        input.setAttribute('data-previous-value', roundedValue.toString());
        this.settingsForm.get('pensionInsuranceRate')?.setValue(roundedValue, { emitEvent: false });
      } else {
        // 前回の値を更新（次回のチェック用）
        input.setAttribute('data-previous-value', inputValue);
      }
    }
  }
  
  onPrefectureChange() {
    const prefecture = this.settingsForm.get('prefecture')?.value;
    if (prefecture && this.kenpoRates.length > 0) {
      // 選択された都道府県に対応する保険料率を取得
      const rateData = this.kenpoRates.find((rate: any) => rate.prefecture === prefecture);
      if (rateData) {
        // 健康保険料率と介護保険料率を自動設定（disabledフィールドなのでenableしてから設定）
        const healthInsuranceRateControl = this.settingsForm.get('healthInsuranceRate');
        const nursingInsuranceRateControl = this.settingsForm.get('nursingInsuranceRate');
        if (healthInsuranceRateControl) {
          healthInsuranceRateControl.enable();
          healthInsuranceRateControl.setValue(rateData.healthRate);
          healthInsuranceRateControl.disable();
        }
        if (nursingInsuranceRateControl) {
          nursingInsuranceRateControl.enable();
          nursingInsuranceRateControl.setValue(rateData.careRate);
          nursingInsuranceRateControl.disable();
        }
        this.selectedPrefecture = prefecture;
      }
    }
  }
  // 詳細設定を保存
  
  // 現金徴収する社員を追加
  addCashCollectionEmployee() {
    if (!this.selectedCashCollectionEmployee) {
      return;
    }
    
    // 既に追加されているかチェック
    if (this.isCashCollectionEmployeeAdded(this.selectedCashCollectionEmployee)) {
      alert('この社員は既に追加されています');
      return;
    }
    
    // 社員情報を取得
    const employee = this.employees.find(emp => emp.employeeNumber === this.selectedCashCollectionEmployee);
    if (employee) {
      this.cashCollectionEmployees.push({
        employeeNumber: employee.employeeNumber,
        name: employee.name
      });
      this.selectedCashCollectionEmployee = '';
    }
  }
  
  // 現金徴収する社員を削除
  removeCashCollectionEmployee(employeeNumber: string) {
    this.cashCollectionEmployees = this.cashCollectionEmployees.filter(
      emp => emp.employeeNumber !== employeeNumber
    );
  }
  
  // 現金徴収する社員が既に追加されているかチェック
  isCashCollectionEmployeeAdded(employeeNumber: string): boolean {
    return this.cashCollectionEmployees.some(emp => emp.employeeNumber === employeeNumber);
  }
  
  // 現金徴収する社員の選択が変更されたとき
  onCashCollectionEmployeeChange() {
    // 特に処理は不要
  }
  
  // 現金徴収する社員の設定を保存
  async saveCashCollectionEmployees() {
    try {
      // Firestoreから現在の設定を取得してマージ
      const currentSettings = await this.firestoreService.getSettings() || {};
      
      // Firestoreに保存
      await this.firestoreService.saveSettings({
        ...currentSettings,
        cashCollectionEmployees: this.cashCollectionEmployees
      });
      
      alert('現金徴収社員設定を保存しました');
      
      // 社会保険料一覧を再読み込み
      await this.loadInsuranceList();
    } catch (error) {
      console.error('Error saving cash collection employees:', error);
      alert('現金徴収社員設定の保存中にエラーが発生しました');
    }
  }
  
  // 保険料率設定を保存
  async saveInsuranceRates() {
    try {
      // disabledフィールドも含めて値を取得
      const formValue = this.settingsForm.getRawValue();
      
      // 都道府県設定を更新
      this.selectedPrefecture = formValue.prefecture || '';
      
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
        prefecture: this.selectedPrefecture,
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
  
  // オブジェクトのプロパティを特定の順序で並べ替えるヘルパー関数
  private sortObjectProperties(obj: any, propertyOrder: string[]): any {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }
    
    const sorted: any = {};
    // 指定された順序でプロパティを追加
    for (const prop of propertyOrder) {
      if (prop in obj) {
        sorted[prop] = obj[prop];
      }
    }
    // 残りのプロパティを追加（順序指定されていないもの）
    for (const key in obj) {
      if (!propertyOrder.includes(key)) {
        sorted[key] = obj[key];
      }
    }
    return sorted;
  }

  // kenpo-rates.jsonをダウンロード
  downloadKenpoRates() {
    try {
      // コメント要素がある場合は先頭に追加
      const downloadData: any[] = [];
      if (this.kenpoRatesComment) {
        downloadData.push(this.kenpoRatesComment);
      }
      // 保険料率データを追加（プロパティ順序を固定）
      const sortedRates = this.kenpoRates.map((item: any) => 
        this.sortObjectProperties(item, ['prefecture', 'careRate', 'healthRate'])
      );
      downloadData.push(...sortedRates);
      
      const jsonData = JSON.stringify(downloadData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '健康介護保険料率.json';
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
      
      // 各要素の形式を検証（_comment要素をスキップ）
      const validData: any[] = [];
      let commentData: any = null;
      
      for (const item of parsedData) {
        // _commentプロパティを持つ要素はコメント要素として保存
        if (item._comment !== undefined) {
          commentData = item;
          continue;
        }
        
        // 必須フィールドの検証
        if (!item.prefecture || typeof item.healthRate !== 'number' || typeof item.careRate !== 'number') {
          alert('JSONファイルの形式が正しくありません。各要素にprefecture、healthRate、careRateが必要です。');
          return;
        }
        
        validData.push(item);
      }
      
      // 有効なデータが存在することを確認
      if (validData.length === 0) {
        alert('有効な保険料率データが見つかりませんでした。');
        return;
      }
      
      // kenpoRatesを更新（コメント要素を除外したデータのみ）
      this.kenpoRates = validData;
      // コメント要素を別途保存
      this.kenpoRatesComment = commentData;
      
      // Firestoreに保存（kenpoRatesとkenpoRatesCommentをsettingsに保存）
      const currentSettings = await this.firestoreService.getSettings() || {};
      await this.firestoreService.saveSettings({
        ...currentSettings,
        kenpoRates: this.kenpoRates,
        kenpoRatesComment: this.kenpoRatesComment
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
      if (!this.gradeTable) {
        alert('等級表データが読み込まれていません');
        return;
      }
      
      // 新しい形式に変換（配列形式）
      const downloadData: any[] = [];
      
      // コメント要素がある場合は先頭に追加
      if (this.gradeTableComment) {
        downloadData.push(this.gradeTableComment);
      }
      
      // データ要素を新しい形式に変換（プロパティ順序を固定）
      const dataElement: any = {};
      
      // 健康介護保険等級表を追加（プロパティ順序を固定）
      if (this.gradeTable.hyouzyungetugakuReiwa7) {
        dataElement['健康介護保険等級表'] = this.gradeTable.hyouzyungetugakuReiwa7.map((item: any) =>
          this.sortObjectProperties(item, ['grade', 'from', 'to', 'monthlyStandard'])
        );
      }
      
      // 厚生年金保険等級表を追加（プロパティ順序を固定）
      if (this.gradeTable.kouseinenkinReiwa7) {
        dataElement['厚生年金保険等級表'] = this.gradeTable.kouseinenkinReiwa7.map((item: any) =>
          this.sortObjectProperties(item, ['grade', 'from', 'to', 'monthlyStandard'])
        );
      }
      
      // データ要素を追加（プロパティ順序を固定）
      const sortedDataElement = this.sortObjectProperties(dataElement, ['健康介護保険等級表', '厚生年金保険等級表']);
      downloadData.push(sortedDataElement);
      
      const jsonData = JSON.stringify(downloadData, null, 2);
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
      
      // 新しい形式（配列）か古い形式（オブジェクト）かを判定
      let gradeTableData: any = null;
      let commentData: any = null;
      
      if (Array.isArray(parsedData)) {
        // 新しい形式: 配列の最初の要素がコメント、2番目がデータ
        for (const item of parsedData) {
          if (item._comment !== undefined) {
            commentData = item;
          } else if (item['健康介護保険等級表'] || item['厚生年金保険等級表']) {
            // データ要素を内部形式に変換
            gradeTableData = {
              hyouzyungetugakuReiwa7: item['健康介護保険等級表'] || [],
              kouseinenkinReiwa7: item['厚生年金保険等級表'] || []
            };
          }
        }
      } else if (parsedData && typeof parsedData === 'object') {
        // 古い形式: 直接オブジェクト
        gradeTableData = parsedData;
      } else {
        alert('JSONファイルの形式が正しくありません。配列形式またはオブジェクト形式である必要があります。');
        return;
      }
      
      // データが存在することを確認
      if (!gradeTableData) {
        alert('JSONファイルの形式が正しくありません。等級表データが見つかりませんでした。');
        return;
      }
      
      // hyouzyungetugakuReiwa7が存在するか確認
      if (!gradeTableData.hyouzyungetugakuReiwa7 || !Array.isArray(gradeTableData.hyouzyungetugakuReiwa7)) {
        alert('JSONファイルの形式が正しくありません。健康介護保険等級表が必要です。');
        return;
      }
      
      // 各要素の形式を検証（hyouzyungetugakuReiwa7）
      for (const item of gradeTableData.hyouzyungetugakuReiwa7) {
        if (typeof item.grade !== 'number' || 
            typeof item.monthlyStandard !== 'number' || 
            typeof item.from !== 'number' || 
            typeof item.to !== 'number') {
          alert('JSONファイルの形式が正しくありません。各要素にgrade、monthlyStandard、from、toが必要です。');
          return;
        }
      }
      
      // kouseinenkinReiwa7が存在するか確認（オプション、存在しない場合は警告のみ）
      if (gradeTableData.kouseinenkinReiwa7) {
        if (!Array.isArray(gradeTableData.kouseinenkinReiwa7)) {
          alert('JSONファイルの形式が正しくありません。kouseinenkinReiwa7は配列である必要があります。');
          return;
        }
        
        // 各要素の形式を検証（kouseinenkinReiwa7）
        for (const item of gradeTableData.kouseinenkinReiwa7) {
          if (typeof item.grade !== 'number' || 
              typeof item.monthlyStandard !== 'number' || 
              typeof item.from !== 'number' || 
              typeof item.to !== 'number') {
            alert('JSONファイルの形式が正しくありません。kouseinenkinReiwa7の各要素にgrade、monthlyStandard、from、toが必要です。');
            return;
          }
        }
      }
      
      // gradeTableを更新（内部形式で保存）
      this.gradeTable = gradeTableData;
      // コメント要素を別途保存
      this.gradeTableComment = commentData;
      
      // Firestoreに保存（gradeTableとgradeTableCommentをsettingsに保存）
      const currentSettings = await this.firestoreService.getSettings() || {};
      await this.firestoreService.saveSettings({
        ...currentSettings,
        gradeTable: this.gradeTable,
        gradeTableComment: this.gradeTableComment
      });
      
      // 等級表を再読み込みして、確実に最新のデータを使用する
      await this.loadGradeTable();
      
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
        // gradeTableを読み込む（内部形式で保存されている）
        this.gradeTable = settings.gradeTable;
        // コメント要素があれば読み込む
        if (settings.gradeTableComment) {
          this.gradeTableComment = settings.gradeTableComment;
        }
        return;
      }
      
      // Firestoreに保存されていない場合は、assetsから読み込む
      const response = await this.http.get<any>('/assets/grade-table.json').toPromise();
      if (response) {
        // 新しい形式（配列）か古い形式（オブジェクト）かを判定
        if (Array.isArray(response)) {
          // 新しい形式: 配列の最初の要素がコメント、2番目がデータ
          for (const item of response) {
            if (item._comment !== undefined) {
              this.gradeTableComment = item;
            } else if (item['健康介護保険等級表'] || item['厚生年金保険等級表']) {
              // データ要素を内部形式に変換
              this.gradeTable = {
                hyouzyungetugakuReiwa7: item['健康介護保険等級表'] || [],
                kouseinenkinReiwa7: item['厚生年金保険等級表'] || []
              };
            }
          }
        } else {
          // 古い形式: 直接オブジェクト
          this.gradeTable = response;
        }
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
        // 新しい形式（配列）か古い形式（オブジェクト）かを判定
        if (Array.isArray(data)) {
          // 新しい形式: 配列の最初の要素がコメント、2番目がデータ
          for (const item of data) {
            if (item._comment !== undefined) {
              this.gradeTableComment = item;
            } else if (item['健康介護保険等級表'] || item['厚生年金保険等級表']) {
              // データ要素を内部形式に変換
              this.gradeTable = {
                hyouzyungetugakuReiwa7: item['健康介護保険等級表'] || [],
                kouseinenkinReiwa7: item['厚生年金保険等級表'] || []
              };
            }
          }
        } else {
          // 古い形式: 直接オブジェクト
          this.gradeTable = data;
        }
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
  
  // 健康介護保険等級表の最大標準報酬月額を取得
  getMaxHealthStandardMonthlySalary(): number {
    if (!this.gradeTable || !this.gradeTable.hyouzyungetugakuReiwa7 || this.gradeTable.hyouzyungetugakuReiwa7.length === 0) {
      // フォールバック: デフォルト値139万円
      return 1390000;
    }
    const lastGrade = this.gradeTable.hyouzyungetugakuReiwa7[this.gradeTable.hyouzyungetugakuReiwa7.length - 1];
    return lastGrade.monthlyStandard;
  }

  // 厚生年金保険等級表の最大標準報酬月額を取得
  getMaxPensionStandardMonthlySalary(): number {
    if (!this.gradeTable || !this.gradeTable.kouseinenkinReiwa7 || this.gradeTable.kouseinenkinReiwa7.length === 0) {
      // フォールバック: デフォルト値65万円
      return 650000;
    }
    const lastGrade = this.gradeTable.kouseinenkinReiwa7[this.gradeTable.kouseinenkinReiwa7.length - 1];
    return lastGrade.monthlyStandard;
  }

  // 固定的賃金から厚生年金保険料計算用の標準報酬月額を計算
  // 固定的賃金から厚生年金保険料計算用の標準報酬月額を計算
  // 健康介護保険の標準報酬月額を計算してから、それを厚生年金保険用の等級表に適用
  calculatePensionStandardMonthlySalary(fixedSalary: number): number {
    // まず、固定的賃金から健康介護保険の標準報酬月額を計算
    const healthStandardSalaryInfo = this.calculateStandardMonthlySalary(fixedSalary);
    if (!healthStandardSalaryInfo) {
      return 0;
    }
    
    const healthStandardMonthlySalary = healthStandardSalaryInfo.monthlyStandard;
    
    // 健康介護保険の標準報酬月額を厚生年金保険用の等級表に適用
    return this.calculatePensionStandardMonthlySalaryFromStandard(healthStandardMonthlySalary);
  }

  // 標準報酬月額から厚生年金保険料計算用の標準報酬月額を計算
  // 健康介護保険の標準報酬月額を厚生年金保険用の等級表に適用
  calculatePensionStandardMonthlySalaryFromStandard(standardMonthlySalary: number): number {
    if (!this.gradeTable || !this.gradeTable.kouseinenkinReiwa7) {
      // kouseinenkinReiwa7が存在しない場合は、従来のロジック（88000円未満の場合は88000円）を使用
      return standardMonthlySalary < 88000 ? 88000 : standardMonthlySalary;
    }
    
    const salary = Number(standardMonthlySalary) || 0;
    const pensionGradeList = this.gradeTable.kouseinenkinReiwa7;
    
    // 範囲内に当てはまる等級を全て収集（範囲が重複している場合があるため）
    const matchingGrades = pensionGradeList.filter((gradeItem: any) => 
      salary >= gradeItem.from && salary <= gradeItem.to
    );
    
    if (matchingGrades.length > 0) {
      // 複数の等級が該当する場合、範囲が最も狭い（to - fromが最小）等級を優先
      // 範囲が同じ場合は、等級番号が大きい（より新しい）等級を優先
      matchingGrades.sort((a: any, b: any) => {
        const rangeA = a.to - a.from;
        const rangeB = b.to - b.from;
        if (rangeA !== rangeB) {
          return rangeA - rangeB; // 範囲が狭い順
        }
        return b.grade - a.grade; // 範囲が同じ場合は等級番号が大きい順
      });
      return matchingGrades[0].monthlyStandard;
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
    
    // フォールバック: 従来のロジック（88000円未満の場合は88000円）
    return salary < 88000 ? 88000 : salary;
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
  
  // 現金徴収用：端数が0.50未満なら切り捨て、0.50以上なら切り上げ（1円単位）
  roundHalfCash(amount: number): number {
    const decimal = amount % 1;
    if (decimal < 0.50) {
      return Math.floor(amount);
    } else {
      return Math.ceil(amount);
    }
  }
  
  // 社員が現金徴収対象かどうかを判定
  isCashCollectionEmployee(employeeNumber: string): boolean {
    return this.cashCollectionEmployees.some(emp => emp.employeeNumber === employeeNumber);
  }
  
  // 年齢を計算（生年月日から、現在の日付基準）
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

  // 年齢を計算（フィルター年月での年齢）
  calculateAgeAtDate(birthDate: any, year: number, month: number): number | null {
    if (!birthDate) return null;
    
    try {
      let birth: Date;
      if (birthDate instanceof Date) {
        birth = birthDate;
      } else if (typeof birthDate === 'string') {
        birth = new Date(birthDate);
      } else if (birthDate && typeof birthDate === 'object' && typeof birthDate.toDate === 'function') {
        // Firestore Timestamp形式の場合
        birth = birthDate.toDate();
      } else {
        return null;
      }
      
      if (isNaN(birth.getTime())) return null;
      
      const filterDate = new Date(year, month - 1, 1);
      const birthYear = birth.getFullYear();
      const birthMonth = birth.getMonth() + 1; // 1-12の範囲
      const birthDay = birth.getDate();
      
      // 基本年齢 = フィルター年 - 誕生年
      let age = year - birthYear;
      
      // 誕生日が1日の場合
      if (birthDay === 1) {
        // 74歳から75歳になる場合のみ、前月から年齢を加算しない（75歳になる月から年齢を加算）
        // 誕生月の前月で基本年齢が74歳または75歳の場合、特別処理が必要
        const isTurning75PreviousMonth = (age === 74 || age === 75) && month === birthMonth - 1;
        const isTurning75BirthMonth = age === 74 && month === birthMonth;
        const isAfterTurning75 = age === 74 && month > birthMonth;
        const isAlready75AfterBirthMonth = age === 75 && month >= birthMonth;
        
        if (isTurning75PreviousMonth) {
          // 74歳→75歳になる前月の場合：前月から年齢を加算しない（74歳のまま）
          age = 74;
        } else if (isTurning75BirthMonth || isAfterTurning75) {
          // 74歳→75歳になる誕生月以降の場合：75歳にする
          age = 75;
        } else if (isAlready75AfterBirthMonth) {
          // 誕生月以降で既に75歳以上の場合：75歳のまま
          age = 75;
        } else if (age === 75 && month < birthMonth) {
          // 誕生月より前で基本年齢が75歳の場合：74歳にする（前年など）
          age = 74;
        } else {
          // それ以外の場合：誕生月の前月から年齢を加算
          if (month >= birthMonth - 1) {
            // 年齢はそのまま（既に加算済み）
          } else {
            // フィルター月 < 誕生月 - 1の場合は1歳減らす
            age--;
          }
        }
      } else {
        // 誕生日が1日でない場合
        // 誕生月がフィルターしている年月なら年齢を加算
        if (month > birthMonth) {
          // 年齢はそのまま（既に加算済み）
        } else if (month === birthMonth) {
          // 誕生月なので年齢を加算（そのまま）
        } else {
          // フィルター月 < 誕生月の場合は1歳減らす
          age--;
        }
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
      
      // 保険料一覧データを構築（社員情報管理票の社員のみ、ただし退職済みでも任意継続被保険者は含める）
      // 全社員データを取得
      const allEmployees = await this.firestoreService.getAllEmployees();
      
      // 新入社員コレクションに存在する社員を除外（入社手続きが完了した社員のみ）
      const onboardingEmployees = await this.firestoreService.getAllOnboardingEmployees();
      const onboardingEmployeeNumbers = new Set(
        onboardingEmployees.map((emp: any) => emp.employeeNumber).filter((num: any) => num)
      );
      
      // 社員情報管理票の社員番号を取得（emailとemploymentTypeがある社員）
      const employeeNumbers = new Set(this.employees.map((emp: any) => emp.employeeNumber));
      
      // フィルタリング：新入社員コレクションに存在しない社員で、
      // かつ（社員情報管理票に存在する OR 任意継続被保険者）
      const filteredEmployees = allEmployees.filter((emp: any) => {
        if (!emp || !emp.employeeNumber) return false;
        // 新入社員コレクションに存在する場合は除外
        if (onboardingEmployeeNumbers.has(emp.employeeNumber)) return false;
        // 社員情報管理票に存在する場合は含める
        if (employeeNumbers.has(emp.employeeNumber)) return true;
        // 任意継続被保険者の場合は含める（退職済みでも）
        if (emp.healthInsuranceType === '任意継続被保険者' && 
            (emp.employmentStatus === '退職' || emp.employmentStatus === '退職済み')) {
          return true;
        }
        return false;
      });
      
      if (filteredEmployees.length > 0) {
        
        // 各社員の詳細データを取得
        const employeeDetails = await Promise.all(
          filteredEmployees.map(async (emp: any) => {
            const employeeData = await this.firestoreService.getEmployeeData(emp.employeeNumber);
            return employeeData || emp;
          })
        );
        
        this.insuranceList = await Promise.all(
          employeeDetails
            .filter((emp: any) => emp && emp.employeeNumber && emp.name)
            .map(async (emp: any) => {
            // 固定的賃金額を見込み給与額（給与）と見込み現物額の合計にする
            const expectedMonthlySalary = Number(emp.expectedMonthlySalary) || 0;
            const expectedMonthlySalaryInKind = Number(emp.expectedMonthlySalaryInKind) || 0;
            
            // 固定的賃金額 = 見込み給与額（給与）+ 見込み現物額
            const fixedSalary = expectedMonthlySalary + expectedMonthlySalaryInKind;
            
            // 給与設定履歴から、現在の年月以前の最新の給与を取得
            // （給与設定は「その年月以降の給与を設定する」という意味）
            const now = new Date();
            const nowYear = now.getFullYear();
            const nowMonth = now.getMonth() + 1;
            
            const relevantSalaries = this.salaryHistory
              .filter((s: any) => s['employeeNumber'] === emp.employeeNumber)
              .filter((s: any) => {
                const salaryYear = Number(s['year']);
                const salaryMonth = Number(s['month']);
                if (salaryYear < nowYear) return true;
                if (salaryYear === nowYear && salaryMonth <= nowMonth) return true;
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
            // 標準報酬月額を計算（健康介護保険の標準報酬月額）
            const standardSalaryInfo = this.calculateStandardMonthlySalary(finalFixedSalary);
            let standardMonthlySalary = standardSalaryInfo ? standardSalaryInfo.monthlyStandard : 0;
            let grade = standardSalaryInfo ? standardSalaryInfo.grade : 0;
            
            // 標準報酬月額変更情報を取得（健康介護保険用）
            const standardChange = await this.firestoreService.getStandardMonthlySalaryChange(
              emp.employeeNumber,
              nowYear,
              nowMonth
            );
            
            // 標準報酬月額変更が適用されているかチェック（適用月以降の場合のみ）
            if (standardChange) {
              const effectiveYear = Number(standardChange.effectiveYear);
              const effectiveMonth = Number(standardChange.effectiveMonth);
              
              // 現在の年月が適用月以降の場合のみ変更を適用
              if (nowYear > effectiveYear || 
                  (nowYear === effectiveYear && nowMonth >= effectiveMonth)) {
                // 標準報酬月額変更情報がある場合は、その標準報酬月額を使用
                // ただし、等級表の最大値を超えている場合は、等級表の最大値に制限
                let changeStandard = standardChange.monthlyStandard;
                const maxHealthStandard = this.getMaxHealthStandardMonthlySalary();
                if (changeStandard > maxHealthStandard) {
                  changeStandard = maxHealthStandard;
                  // 等級も再計算
                  const maxStandardInfo = this.calculateStandardMonthlySalary(maxHealthStandard);
                  if (maxStandardInfo) {
                    grade = maxStandardInfo.grade;
                  } else {
                    grade = standardChange.grade;
                  }
                } else {
                  grade = standardChange.grade;
                }
                standardMonthlySalary = changeStandard;
              }
            }
            
            // 年齢を計算（現在の年月での年齢、loadInsuranceListでは現在の年月を使用）
            const nowForAge = new Date();
            const ageYear = nowForAge.getFullYear();
            const ageMonth = nowForAge.getMonth() + 1;
            const age = this.calculateAgeAtDate(emp.birthDate, ageYear, ageMonth);
            
            // 介護保険料は40歳以上65歳未満の従業員のみ対象（40歳未満または65歳以上は0円）
            const isNursingInsuranceTarget = age !== null && age >= 40 && age < 65;
            
            // 厚生年金保険料計算用の標準報酬月額
            // まず、厚生年金保険用の標準報酬月額変更情報を取得（該当年月以前の最新の変更情報）
            const pensionStandardChange = await this.firestoreService.getPensionStandardMonthlySalaryChange(
              emp.employeeNumber,
              nowYear,
              nowMonth
            );
            
            let pensionStandardMonthlySalary = 0;
            
            // 厚生年金保険用の標準報酬月額変更が適用されているかチェック（適用月以降の場合のみ）
            if (pensionStandardChange) {
              const effectiveYear = Number(pensionStandardChange.effectiveYear);
              const effectiveMonth = Number(pensionStandardChange.effectiveMonth);
              
              // 現在の年月が適用月以降の場合のみ変更を適用
              if (nowYear > effectiveYear || 
                  (nowYear === effectiveYear && nowMonth >= effectiveMonth)) {
                // 標準報酬月額変更情報がある場合は、その標準報酬月額を使用
                // ただし、等級表の最大値を超えている場合は、等級表の最大値に制限
                let changeStandard = pensionStandardChange.monthlyStandard;
                const maxPensionStandard = this.getMaxPensionStandardMonthlySalary();
                if (changeStandard > maxPensionStandard) {
                  changeStandard = maxPensionStandard;
                }
                pensionStandardMonthlySalary = changeStandard;
              } else {
                // 適用月以前の場合は、健康介護保険の標準報酬月額を基準に計算
                pensionStandardMonthlySalary = this.calculatePensionStandardMonthlySalaryFromStandard(standardMonthlySalary);
              }
            } else {
              // 標準報酬月額変更情報がない場合は、健康介護保険の標準報酬月額を基準に計算
              // 社会保険一覧表に表示されている標準報酬月額（健康介護保険の標準報酬月額）を基準に厚生年金保険の標準報酬月額を計算
              pensionStandardMonthlySalary = this.calculatePensionStandardMonthlySalaryFromStandard(standardMonthlySalary);
            }
            
            // 各保険料を計算（標準報酬月額 × 保険料率 / 100）
            // 小数第2位まで保持（表示用）
            // 健康保険料：75歳以上の場合は0円
            const isHealthInsuranceTarget = age !== null && age < 75;
            const healthInsuranceRaw = isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0;
            // 介護保険料：40歳未満または65歳以上の場合は0円
            const nursingInsuranceRaw = isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0;
            // 厚生年金保険料：70歳以上の場合は0円
            const isPensionInsuranceTarget = age !== null && age < 70;
            const pensionInsuranceRaw = isPensionInsuranceTarget ? pensionStandardMonthlySalary * (pensionInsuranceRate / 100) : 0;
            
            // 社員負担額を計算
            // 現金徴収する社員かどうかを判定
            const isCashCollection = this.isCashCollectionEmployee(emp.employeeNumber);
            const roundFunction = isCashCollection ? this.roundHalfCash.bind(this) : this.roundHalf.bind(this);
            
            // (健康保険料 + 介護保険料) ÷ 2 の端数処理
            const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2;
            const healthNursingBurden = roundFunction(healthNursingHalf);
            
            // 厚生年金保険料 ÷ 2 の端数処理
            const pensionHalf = pensionInsuranceRaw / 2;
            const pensionBurden = roundFunction(pensionHalf);
            
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
              voluntaryInsuranceEndDate: emp.voluntaryInsuranceEndDate || null, // 任意継続終了日
              joinDate: emp.joinDate || null, // 入社年月日
              socialInsuranceAcquisitionDate: emp.socialInsuranceAcquisitionDate || null // 資格取得年月日
            };
          })
        );
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
    let totalHealthNursingInsuranceBeforeFloor = 0; // 健康保険料と介護保険料の合計（端数処理前）
    let totalPensionInsuranceBeforeFloor = 0; // 厚生年金保険料の合計（端数処理前）
    let totalEmployeeBurden = 0;
    
    // 賞与テーブルの場合はfilteredInsuranceListのみを使用（給与テーブルのデータを参照しない）
    const listToUse = this.insuranceListType === 'bonus' 
      ? this.filteredInsuranceList 
      : (this.filteredInsuranceList.length > 0 ? this.filteredInsuranceList : this.insuranceList);
    
    listToUse.forEach((item: any) => {
      // 健康保険料と介護保険料を足した額（端数処理は後で行う）
      const healthInsurance = item.healthInsurance || 0;
      const nursingInsurance = item.nursingInsurance || 0;
      const healthNursingTotal = healthInsurance + nursingInsurance;
      totalHealthNursingInsuranceBeforeFloor += healthNursingTotal;
      
      // 厚生年金保険料（端数処理は後で行う）
      const pensionInsurance = item.pensionInsurance || 0;
      totalPensionInsuranceBeforeFloor += pensionInsurance;
      
      // 社員負担額の合計
      totalEmployeeBurden += item.employeeBurden || 0;
    });
    
    // 全社員の合計を計算してから端数処理
    const totalHealthNursingInsurance = Math.floor(totalHealthNursingInsuranceBeforeFloor);
    const totalPensionInsurance = Math.floor(totalPensionInsuranceBeforeFloor);
    
    // 事業主負担額 = （全体の健康保険料＋全体の介護保険料）の端数を切り落とした額
    //                ＋全体の厚生年金保険料の端数を切り落とした額
    //                －社員負担額の合計
    return totalHealthNursingInsurance + totalPensionInsurance - totalEmployeeBurden;
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
  
  // 任意継続終了日を取得（表示用）
  getVoluntaryEndDate(item: any): string {
    if (!item.voluntaryInsuranceEndDate) {
      return '-';
    }
    
    // 空のオブジェクトをチェック
    if (typeof item.voluntaryInsuranceEndDate === 'object' && Object.keys(item.voluntaryInsuranceEndDate).length === 0) {
      return '-';
    }
    
    // 有効な日付形式かチェック
    if (item.voluntaryInsuranceEndDate instanceof Date) {
      return this.formatDate(item.voluntaryInsuranceEndDate);
    } else if (typeof item.voluntaryInsuranceEndDate === 'string') {
      return this.formatDate(item.voluntaryInsuranceEndDate);
    } else if (typeof item.voluntaryInsuranceEndDate === 'object') {
      // Firestore Timestamp形式かチェック
      if (item.voluntaryInsuranceEndDate.seconds || item.voluntaryInsuranceEndDate._seconds || typeof item.voluntaryInsuranceEndDate.toDate === 'function') {
        return this.formatDate(item.voluntaryInsuranceEndDate);
      }
    }
    
    return '-';
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
    
    // 休業・任意保険者タブが選択された場合、休業・任意保険者一覧を読み込む
    if (tabName === '休業・任意保険者') {
      this.loadLeaveVoluntaryList().catch(err => {
        console.error('Error in loadLeaveVoluntaryList:', err);
      });
    }
    
    // 設定タブが選択された場合、社員一覧を読み込む（現金徴収社員設定用）
    if (tabName === '設定') {
      this.loadEmployees().catch(err => {
        console.error('Error in loadEmployees:', err);
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
  shouldShowResignedEmployee(employmentStatus: string, resignationDate: any, healthInsuranceType: string, year: number, month: number, voluntaryInsuranceEndDate?: any, socialInsuranceAcquisitionDate?: any): boolean {
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
    
    // 資格喪失年月日を計算（退職日の翌日）
    const nextDay = new Date(resignation);
    nextDay.setDate(nextDay.getDate() + 1);
    const lossYear = nextDay.getFullYear();
    const lossMonth = nextDay.getMonth() + 1;
    
    // 資格取得年月日を取得
    let acquisitionDate: Date | null = null;
    if (socialInsuranceAcquisitionDate) {
      if (socialInsuranceAcquisitionDate instanceof Date) {
        acquisitionDate = socialInsuranceAcquisitionDate;
      } else if (socialInsuranceAcquisitionDate && typeof socialInsuranceAcquisitionDate.toDate === 'function') {
        acquisitionDate = socialInsuranceAcquisitionDate.toDate();
      } else if (typeof socialInsuranceAcquisitionDate === 'string') {
        acquisitionDate = new Date(socialInsuranceAcquisitionDate);
      }
      
      if (acquisitionDate && isNaN(acquisitionDate.getTime())) {
        acquisitionDate = null;
      }
    }
    
    // 資格取得年月日と資格喪失年月日が同年月の場合、その月も徴収する
    if (acquisitionDate && !isNaN(acquisitionDate.getTime())) {
      const acquisitionYear = acquisitionDate.getFullYear();
      const acquisitionMonth = acquisitionDate.getMonth() + 1;
      
      // 資格取得年月日と資格喪失年月日が同年月の場合
      if (acquisitionYear === lossYear && acquisitionMonth === lossMonth) {
        // その月も表示する（通常通り徴収する）
        if (year === lossYear && month === lossMonth) {
          return true;
        }
      }
    }
    
    // 選択された年月が資格喪失年月日の前月以前の場合は表示（在籍中として）
    // 資格喪失年月日の前月まで社会保険料を徴収する
    if (year < lossYear || (year === lossYear && month < lossMonth)) {
      return true;
    }
    
    // 退職月より後の期間で、任意継続被保険者の場合のみ表示
    if (healthInsuranceType === '任意継続被保険者') {
      // 退職日の翌日を計算
      const nextDay = new Date(resignation);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // 任意継続終了日を計算
      let endDate: Date;
      if (voluntaryInsuranceEndDate) {
        // 任意継続終了日が設定されている場合
        if (voluntaryInsuranceEndDate instanceof Date) {
          endDate = voluntaryInsuranceEndDate;
        } else if (voluntaryInsuranceEndDate && typeof voluntaryInsuranceEndDate.toDate === 'function') {
          endDate = voluntaryInsuranceEndDate.toDate();
        } else if (typeof voluntaryInsuranceEndDate === 'string') {
          endDate = new Date(voluntaryInsuranceEndDate);
        } else {
          // フォールバック：2年後
          endDate = new Date(nextDay);
          endDate.setFullYear(endDate.getFullYear() + 2);
        }
      } else {
        // 任意継続終了日が設定されていない場合は2年後
        endDate = new Date(nextDay);
        endDate.setFullYear(endDate.getFullYear() + 2);
      }
      
      if (isNaN(endDate.getTime())) {
        // 終了日が無効な場合は2年後を使用
        endDate = new Date(nextDay);
        endDate.setFullYear(endDate.getFullYear() + 2);
      }
      
      // 選択された年月の1日を計算
      const selectedDate = new Date(year, month - 1, 1);
      
      // 任意継続終了日の月の1日を計算（終了月の前日まで徴収するため）
      const endDateMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      
      // 任意継続開始日は退職日の翌日
      const voluntaryStartDate = nextDay;
      
      // 任意継続開始日が属する月の1日を計算（徴収は月単位で行うため）
      const voluntaryStartMonth = new Date(voluntaryStartDate.getFullYear(), voluntaryStartDate.getMonth(), 1);
      
      // 選択年月が任意継続開始日が属する月より前は表示しない
      if (selectedDate < voluntaryStartMonth) {
        return false;
      }
      
      // 加入月と終了月が同じ場合は、その月のみ表示
      if (voluntaryStartMonth.getTime() === endDateMonthStart.getTime()) {
        return selectedDate.getTime() === voluntaryStartMonth.getTime();
      }
      
      // 加入月から終了月の前日まで表示
      if (selectedDate >= voluntaryStartMonth && selectedDate < endDateMonthStart) {
        return true;
      }
      
      return false; // 任意継続終了月以降は表示しない
    }
    
    // 任意継続被保険者以外の退職済み社員の場合、退職月より後は表示しない
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
      let filterYear = Number(this.insuranceListYear);
      let filterMonth = Number(this.insuranceListMonth);
      
      // 2028年12月を超える年月は2028年12月に制限
      if (filterYear > 2028 || (filterYear === 2028 && filterMonth > 12)) {
        filterYear = 2028;
        filterMonth = 12;
        this.insuranceListYear = 2028;
        this.insuranceListMonth = 12;
      }
      
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
              filterMonth,
              item.voluntaryInsuranceEndDate,
              item.socialInsuranceAcquisitionDate
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
            // 退職済み社員の場合は、資格喪失年月日の前月までの給与設定のみ使用
            let relevantSalaries = this.salaryHistory
              .filter((s: any) => s['employeeNumber'] === item.employeeNumber);
            
            // 退職済み社員の場合、資格喪失年月日の前月までの給与設定のみ使用
            if ((item.employmentStatus === '退職' || item.employmentStatus === '退職済み') && 
                item.resignationDate && 
                item.healthInsuranceType !== '任意継続被保険者') {
              let resignation: Date | null = null;
              if (item.resignationDate instanceof Date) {
                resignation = item.resignationDate;
              } else if (item.resignationDate && typeof item.resignationDate.toDate === 'function') {
                resignation = item.resignationDate.toDate();
              } else if (typeof item.resignationDate === 'string') {
                resignation = new Date(item.resignationDate);
              }
              
              if (resignation && !isNaN(resignation.getTime())) {
                // 資格喪失年月日を計算（退職日の翌日）
                const nextDay = new Date(resignation);
                nextDay.setDate(nextDay.getDate() + 1);
                const lossYear = nextDay.getFullYear();
                const lossMonth = nextDay.getMonth() + 1;
                
                // 資格喪失年月日の前月までの給与設定のみ使用
                relevantSalaries = relevantSalaries.filter((s: any) => {
                  const salaryYear = Number(s['year']);
                  const salaryMonth = Number(s['month']);
                  if (salaryYear < lossYear) return true;
                  if (salaryYear === lossYear && salaryMonth < lossMonth) return true;
                  return false;
                });
              }
            }
            
            // 該当年月以前の最新の給与設定を取得
            relevantSalaries = relevantSalaries
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
            // 任意継続被保険者の保険料徴収は退職日の翌日から任意継続終了日まで
            const resignationDate = item.resignationDate;
            const voluntaryInsuranceEndDate = item.voluntaryInsuranceEndDate;
            const socialInsuranceAcquisitionDate = item.socialInsuranceAcquisitionDate;
            let resignation: Date | null = null;
            let isVoluntaryContinuation = false;
            let isSameMonthAcquisitionAndLoss = false; // 資格取得年月日と資格喪失年月日が同年月かどうか
            
            // 資格取得年月日と資格喪失年月日が同年月かどうかを判定
            if (resignationDate && socialInsuranceAcquisitionDate) {
              let resignationDateObj: Date | null = null;
              if (resignationDate instanceof Date) {
                resignationDateObj = resignationDate;
              } else if (resignationDate && typeof resignationDate.toDate === 'function') {
                resignationDateObj = resignationDate.toDate();
              } else if (typeof resignationDate === 'string') {
                resignationDateObj = new Date(resignationDate);
              }
              
              let acquisitionDateObj: Date | null = null;
              if (socialInsuranceAcquisitionDate instanceof Date) {
                acquisitionDateObj = socialInsuranceAcquisitionDate;
              } else if (socialInsuranceAcquisitionDate && typeof socialInsuranceAcquisitionDate.toDate === 'function') {
                acquisitionDateObj = socialInsuranceAcquisitionDate.toDate();
              } else if (typeof socialInsuranceAcquisitionDate === 'string') {
                acquisitionDateObj = new Date(socialInsuranceAcquisitionDate);
              }
              
              if (resignationDateObj && acquisitionDateObj && !isNaN(resignationDateObj.getTime()) && !isNaN(acquisitionDateObj.getTime())) {
                // 資格喪失年月日を計算（退職日の翌日）
                const lossDate = new Date(resignationDateObj);
                lossDate.setDate(lossDate.getDate() + 1);
                const lossYear = lossDate.getFullYear();
                const lossMonth = lossDate.getMonth() + 1;
                
                const acquisitionYear = acquisitionDateObj.getFullYear();
                const acquisitionMonth = acquisitionDateObj.getMonth() + 1;
                
                // 資格取得年月日と資格喪失年月日が同年月の場合
                if (acquisitionYear === lossYear && acquisitionMonth === lossMonth) {
                  isSameMonthAcquisitionAndLoss = true;
                }
              }
            }
            
            if (item.healthInsuranceType === '任意継続被保険者' && 
                (item.employmentStatus === '退職' || item.employmentStatus === '退職済み') &&
                resignationDate) {
              if (resignationDate instanceof Date) {
                resignation = resignationDate;
              } else if (resignationDate && typeof resignationDate.toDate === 'function') {
                resignation = resignationDate.toDate();
              } else if (typeof resignationDate === 'string') {
                resignation = new Date(resignationDate);
              }
              
              if (resignation && !isNaN(resignation.getTime())) {
                // 任意継続開始日は退職日の翌日
                const nextDay = new Date(resignation);
                nextDay.setDate(nextDay.getDate() + 1);
                const voluntaryStartDate = nextDay;
                
                // 任意継続開始日が属する月の1日を計算（徴収は月単位で行うため）
                const voluntaryStartMonth = new Date(voluntaryStartDate.getFullYear(), voluntaryStartDate.getMonth(), 1);
                
                // 任意継続終了日を計算
                let endDate: Date;
                if (voluntaryInsuranceEndDate) {
                  if (voluntaryInsuranceEndDate instanceof Date) {
                    endDate = voluntaryInsuranceEndDate;
                  } else if (voluntaryInsuranceEndDate && typeof voluntaryInsuranceEndDate.toDate === 'function') {
                    endDate = voluntaryInsuranceEndDate.toDate();
                  } else if (typeof voluntaryInsuranceEndDate === 'string') {
                    endDate = new Date(voluntaryInsuranceEndDate);
                  } else {
                    // フォールバック：2年後
                    endDate = new Date(voluntaryStartDate);
                    endDate.setFullYear(endDate.getFullYear() + 2);
                  }
                } else {
                  // 任意継続終了日が設定されていない場合は2年後
                  endDate = new Date(voluntaryStartDate);
                  endDate.setFullYear(endDate.getFullYear() + 2);
                }
                
                if (isNaN(endDate.getTime())) {
                  // 終了日が無効な場合は2年後を使用
                  endDate = new Date(voluntaryStartDate);
                  endDate.setFullYear(endDate.getFullYear() + 2);
                }
                
                // 選択された年月の1日を計算
                const selectedDate = new Date(filterYear, filterMonth - 1, 1);
                
                // 任意継続終了日の月の1日を計算（終了月の前日まで徴収するため）
                const endDateMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                
                // 資格取得年月日と資格喪失年月日が同年月で、かつ任意継続被保険者の場合
                // その月は通常の社会保険料も徴収するため、isVoluntaryContinuationはfalseのまま
                if (isSameMonthAcquisitionAndLoss && selectedDate.getTime() === voluntaryStartMonth.getTime()) {
                  // 同年月で任意継続の場合、その月は通常の社会保険料も徴収する
                  // isVoluntaryContinuationはfalseのまま（通常の社会保険料を計算）
                } else {
                  // 任意継続開始日は退職日の翌日。徴収はその日が属する月から開始
                  // 加入月と終了月が同じ場合は、その月のみ任意継続保険料を徴収
                  if (voluntaryStartMonth.getTime() === endDateMonthStart.getTime()) {
                    if (selectedDate.getTime() === voluntaryStartMonth.getTime()) {
                      isVoluntaryContinuation = true;
                    }
                  } else {
                    // 加入月から終了月の前日まで徴収
                    if (selectedDate >= voluntaryStartMonth && selectedDate < endDateMonthStart) {
                      isVoluntaryContinuation = true;
                    }
                  }
                }
              }
            }
            
            if (isVoluntaryContinuation) {
              // 退職時の固定的賃金を取得（資格喪失年月日の前月以前の最新の給与設定）
              if (resignation && !isNaN(resignation.getTime())) {
                // 資格喪失年月日を計算（退職日の翌日）
                const nextDay = new Date(resignation);
                nextDay.setDate(nextDay.getDate() + 1);
                const lossYear = nextDay.getFullYear();
                const lossMonth = nextDay.getMonth() + 1;
                
                // 資格喪失年月日の前月以前の最新の給与設定を取得
                const preResignationSalaries = this.salaryHistory
                  .filter((s: any) => s['employeeNumber'] === item.employeeNumber)
                  .filter((s: any) => {
                    const salaryYear = Number(s['year']);
                    const salaryMonth = Number(s['month']);
                    if (salaryYear < lossYear) return true;
                    if (salaryYear === lossYear && salaryMonth < lossMonth) return true;
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
            
            if (useStandardChange && !isVoluntaryContinuation) {
              // 標準報酬月額変更が適用されている場合（任意継続被保険者以外）
              // ただし、等級表の最大値を超えている場合は、等級表の最大値に制限
              let changeStandard = standardChange.monthlyStandard;
              const maxHealthStandard = this.getMaxHealthStandardMonthlySalary();
              if (changeStandard > maxHealthStandard) {
                changeStandard = maxHealthStandard;
                // 等級も再計算
                const maxStandardInfo = this.calculateStandardMonthlySalary(maxHealthStandard);
                if (maxStandardInfo) {
                  grade = maxStandardInfo.grade;
                } else {
                  grade = standardChange.grade;
                }
              } else {
                grade = standardChange.grade;
              }
              standardMonthlySalary = changeStandard;
            } else if (isVoluntaryContinuation) {
              // 任意継続被保険者の場合、退職時の標準報酬月額を使用（最大32万円）
              // 32万円以下の場合はその値を採用し、32万円を超える場合は32万円に制限
              // 標準報酬月額変更情報があっても、32万円の上限を優先する
              
              // 退職時の固定的賃金を再取得（資格喪失年月日の前月以前の最新の給与設定）
              let latestSalaryBeforeResignation = item.fixedSalary;
              if (resignation && !isNaN(resignation.getTime())) {
                // 資格喪失年月日を計算（退職日の翌日）
                const nextDay = new Date(resignation);
                nextDay.setDate(nextDay.getDate() + 1);
                const lossYear = nextDay.getFullYear();
                const lossMonth = nextDay.getMonth() + 1;
                
                // 資格喪失年月日の前月以前の最新の給与設定を取得
                const relevantSalariesForResignation = this.salaryHistory
                  .filter((s: any) => s['employeeNumber'] === item.employeeNumber)
                  .filter((s: any) => {
                    const salaryYear = Number(s['year']);
                    const salaryMonth = Number(s['month']);
                    if (salaryYear < lossYear) return true;
                    if (salaryYear === lossYear && salaryMonth < lossMonth) return true;
                    return false;
                  })
                  .sort((a: any, b: any) => {
                    if (a['year'] !== b['year']) return b['year'] - a['year'];
                    return b['month'] - a['month'];
                  });
                
                latestSalaryBeforeResignation = relevantSalariesForResignation.length > 0 
                  ? relevantSalariesForResignation[0]['amount'] 
                  : item.fixedSalary;
              }
              
              const standardSalaryInfo = this.calculateStandardMonthlySalary(latestSalaryBeforeResignation);
              standardMonthlySalary = standardSalaryInfo ? standardSalaryInfo.monthlyStandard : 0;
              grade = standardSalaryInfo ? standardSalaryInfo.grade : 0;
              
              // 最大32万円に制限（32万円以下の場合はその値を採用）
              if (standardMonthlySalary > 320000) {
                standardMonthlySalary = 320000;
                // 32万円に対応する等級を再計算
                const maxStandardInfo = this.calculateStandardMonthlySalary(320000);
                if (maxStandardInfo) {
                  grade = maxStandardInfo.grade;
                }
              }
            } else if (useStandardChange) {
              // 標準報酬月額変更が適用されている場合（任意継続被保険者以外）
              standardMonthlySalary = standardChange.monthlyStandard;
              grade = standardChange.grade;
            } else {
              // 標準報酬月額変更情報が適用されていない場合、入社時の見込み給与から等級を計算
              // （入社時決定による等級を使用）
              // 社員情報から入社時の見込み給与を取得
              const employeeData = await this.firestoreService.getEmployeeData(item.employeeNumber);
              if (employeeData) {
                const expectedMonthlySalary = Number(employeeData.expectedMonthlySalary) || 0;
                const expectedMonthlySalaryInKind = Number(employeeData.expectedMonthlySalaryInKind) || 0;
                const initialFixedSalary = expectedMonthlySalary + expectedMonthlySalaryInKind;
                
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
            
            // 年齢を計算（フィルター年月での年齢）
            const age = this.calculateAgeAtDate(item.birthDate, filterYear, filterMonth);
            
            // 介護保険料は40歳以上65歳未満の従業員のみ対象（40歳未満または65歳以上は0円）
            const isNursingInsuranceTarget = age !== null && age >= 40 && age < 65;
            
            // 厚生年金保険料計算用の標準報酬月額
            let pensionStandardMonthlySalary = 0;
            
            if (!isVoluntaryContinuation) {
              // まず、厚生年金保険用の標準報酬月額変更情報を取得（該当年月以前の最新の変更情報）
              const pensionStandardChange = await this.firestoreService.getPensionStandardMonthlySalaryChange(
                item.employeeNumber,
                filterYear,
                filterMonth
              );
              
              // 厚生年金保険用の標準報酬月額変更が適用されているかチェック（適用月以降の場合のみ）
              if (pensionStandardChange) {
                const effectiveYear = Number(pensionStandardChange.effectiveYear);
                const effectiveMonth = Number(pensionStandardChange.effectiveMonth);
                
                // 選択された年月が適用月以降の場合のみ変更を適用
                if (filterYear > effectiveYear || 
                    (filterYear === effectiveYear && filterMonth >= effectiveMonth)) {
                  // 標準報酬月額変更情報がある場合は、その標準報酬月額を使用
                  // ただし、等級表の最大値を超えている場合は、等級表の最大値に制限
                  let changeStandard = pensionStandardChange.monthlyStandard;
                  const maxPensionStandard = this.getMaxPensionStandardMonthlySalary();
                  if (changeStandard > maxPensionStandard) {
                    changeStandard = maxPensionStandard;
                  }
                  pensionStandardMonthlySalary = changeStandard;
                } else {
                  // 適用月以前の場合は、健康介護保険の標準報酬月額を基準に計算
                  pensionStandardMonthlySalary = this.calculatePensionStandardMonthlySalaryFromStandard(standardMonthlySalary);
                }
              } else {
                // 標準報酬月額変更情報がない場合は、健康介護保険の標準報酬月額を基準に計算
                // 社会保険一覧表に表示されている標準報酬月額（健康介護保険の標準報酬月額）を基準に厚生年金保険の標準報酬月額を計算
                pensionStandardMonthlySalary = this.calculatePensionStandardMonthlySalaryFromStandard(standardMonthlySalary);
              }
            }
            
            // 各保険料を計算（産前産後休業期間内の場合は0円、ただし任意継続被保険者の場合は免除しない）
            // 健康保険料：75歳以上の場合は0円
            const isHealthInsuranceTarget = age !== null && age < 75;
            let healthInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0);
            // 介護保険料：40歳未満または65歳以上の場合は0円（任意継続被保険者でも40歳以上65歳未満は徴収）
            let nursingInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0);
            // 厚生年金保険料：70歳以上の場合は0円
            const isPensionInsuranceTarget = age !== null && age < 70;
            let pensionInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isVoluntaryContinuation ? 0 : (isPensionInsuranceTarget ? pensionStandardMonthlySalary * (pensionInsuranceRate / 100) : 0));
            
            // 同年月で任意継続の場合、任意継続保険料も加算
            let voluntaryHealthInsurance = 0;
            let voluntaryNursingInsurance = 0;
            if (isSameMonthAcquisitionAndLoss && item.healthInsuranceType === '任意継続被保険者' && resignation && !isNaN(resignation.getTime())) {
              // 任意継続開始日は退職日の翌日
              const nextDay = new Date(resignation);
              nextDay.setDate(nextDay.getDate() + 1);
              const voluntaryStartDate = nextDay;
              const voluntaryStartMonth = new Date(voluntaryStartDate.getFullYear(), voluntaryStartDate.getMonth(), 1);
              const selectedDate = new Date(filterYear, filterMonth - 1, 1);
              
              // 選択年月が任意継続開始月の場合、任意継続保険料も計算
              if (selectedDate.getTime() === voluntaryStartMonth.getTime()) {
                // 退職時の固定的賃金を取得（資格喪失年月日の前月以前の最新の給与設定）
                const lossDate = new Date(resignation);
                lossDate.setDate(lossDate.getDate() + 1);
                const lossYear = lossDate.getFullYear();
                const lossMonth = lossDate.getMonth() + 1;
                
                const preResignationSalaries = this.salaryHistory
                  .filter((s: any) => s['employeeNumber'] === item.employeeNumber)
                  .filter((s: any) => {
                    const salaryYear = Number(s['year']);
                    const salaryMonth = Number(s['month']);
                    if (salaryYear < lossYear) return true;
                    if (salaryYear === lossYear && salaryMonth < lossMonth) return true;
                    return false;
                  })
                  .sort((a: any, b: any) => {
                    if (a['year'] !== b['year']) return b['year'] - a['year'];
                    return b['month'] - a['month'];
                  });
                
                const latestSalaryBeforeResignation = preResignationSalaries.length > 0 
                  ? preResignationSalaries[0]['amount'] 
                  : item.fixedSalary;
                
                // 任意継続保険料用の標準報酬月額を計算（最大32万円）
                const voluntaryStandardInfo = this.calculateStandardMonthlySalary(latestSalaryBeforeResignation);
                let voluntaryStandardMonthlySalary = voluntaryStandardInfo ? voluntaryStandardInfo.monthlyStandard : 0;
                
                // 最大32万円に制限
                if (voluntaryStandardMonthlySalary > 320000) {
                  voluntaryStandardMonthlySalary = 320000;
                }
                
                // 任意継続保険料を計算（全額自己負担）
                voluntaryHealthInsurance = isHealthInsuranceTarget ? voluntaryStandardMonthlySalary * (healthInsuranceRate / 100) : 0;
                voluntaryNursingInsurance = isNursingInsuranceTarget ? voluntaryStandardMonthlySalary * (nursingInsuranceRate / 100) : 0;
              }
            }
            
            // 同年月で任意継続の場合、通常の社会保険料と任意継続保険料の両方を加算
            if (isSameMonthAcquisitionAndLoss && item.healthInsuranceType === '任意継続被保険者') {
              healthInsuranceRaw += voluntaryHealthInsurance;
              nursingInsuranceRaw += voluntaryNursingInsurance;
              // 厚生年金保険料は通常通り（任意継続でも0にはしない）
            }
            
            // 社員負担額を計算
            let employeeBurden = 0;
            if (!isInMaternityLeave || isVoluntaryContinuation || isSameMonthAcquisitionAndLoss) {
              // 現金徴収する社員かどうかを判定
              const isCashCollection = this.isCashCollectionEmployee(item.employeeNumber);
              const roundFunction = isCashCollection ? this.roundHalfCash.bind(this) : this.roundHalf.bind(this);
              
              if (isVoluntaryContinuation) {
                // 任意継続被保険者の場合、健康保険料と介護保険料は全額社員負担
                // 端数処理（現金徴収の場合は50未満なら切り捨て、50以上なら切り上げ）
                const healthNursingTotal = healthInsuranceRaw + nursingInsuranceRaw;
                employeeBurden = roundFunction(healthNursingTotal);
              } else if (isSameMonthAcquisitionAndLoss && item.healthInsuranceType === '任意継続被保険者') {
                // 同年月で任意継続の場合、通常の社会保険料（会社と折半）＋任意継続保険料（全額自己負担）
                // 通常の社会保険料（会社と折半）
                const normalHealthNursingHalf = (healthInsuranceRaw - voluntaryHealthInsurance + nursingInsuranceRaw - voluntaryNursingInsurance) / 2;
                const normalHealthNursingBurden = roundFunction(normalHealthNursingHalf);
                
                // 厚生年金保険料 ÷ 2 の端数処理
                const pensionHalf = pensionInsuranceRaw / 2;
                const pensionBurden = roundFunction(pensionHalf);
                
                // 任意継続保険料（全額自己負担）
                const voluntaryTotal = voluntaryHealthInsurance + voluntaryNursingInsurance;
                const voluntaryBurden = roundFunction(voluntaryTotal);
                
                // 社員負担額（合計）
                employeeBurden = normalHealthNursingBurden + pensionBurden + voluntaryBurden;
              } else {
                // (健康保険料 + 介護保険料) ÷ 2 の端数処理
                const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2;
                const healthNursingBurden = roundFunction(healthNursingHalf);
                
                // 厚生年金保険料 ÷ 2 の端数処理
                const pensionHalf = pensionInsuranceRaw / 2;
                const pensionBurden = roundFunction(pensionHalf);
                
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
        // その年の7月から翌年6月までの間に、賞与が4回以上支給された場合、4回目以降の賞与は表示しない
        
        // まず、選択された年月の賞与を取得
        const selectedMonthBonuses = this.bonusList.filter((bonus: any) => {
          const bonusYear = Number(bonus['year']);
          const bonusMonth = Number(bonus['month']);
          return bonusYear === filterYear && bonusMonth === filterMonth;
        });
        
        // 社員ごとに処理
        const employeeBonusMap = new Map<string, any[]>();
        selectedMonthBonuses.forEach((bonus: any) => {
          const employeeNumber = bonus['employeeNumber'];
          if (!employeeBonusMap.has(employeeNumber)) {
            employeeBonusMap.set(employeeNumber, []);
          }
          employeeBonusMap.get(employeeNumber)!.push(bonus);
        });
        
        // 各社員の賞与に対して、年度内の支給回数をチェックし、4回目以降の賞与を除外
        const bonusListFiltered: any[] = [];
        
        employeeBonusMap.forEach((bonuses: any[], employeeNumber: string) => {
          // 年度を判定（7月～翌年6月が1年度）
          let bonusFiscalYear: number;
          if (filterMonth >= 7) {
            bonusFiscalYear = filterYear;
          } else {
            bonusFiscalYear = filterYear - 1;
          }
          
          // 該当年度の7月から選択された年月までのすべての賞与を取得（時系列で並べる）
          const fiscalYearBonuses = this.bonusList
            .filter((b: any) => {
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
              
              // 同じ年度で、選択された年月以前の賞与を取得
              if (bFiscalYear !== bonusFiscalYear) return false;
              if (bYear < filterYear) return true;
              if (bYear === filterYear && bMonth <= filterMonth) return true;
              return false;
            })
            .sort((a: any, b: any) => {
              const aYear = Number(a['year']);
              const bYear = Number(b['year']);
              const aMonth = Number(a['month']);
              const bMonth = Number(b['month']);
              if (aYear !== bYear) return aYear - bYear;
              if (aMonth !== bMonth) return aMonth - bMonth;
              // 同じ年月の場合は、タイムスタンプでソート（FirestoreのドキュメントIDに含まれる）
              const aId = a['id'] || '';
              const bId = b['id'] || '';
              return aId.localeCompare(bId);
            });
          
          // 年度内の賞与支給回数（実際の支給回数）をカウント
          const fiscalYearBonusCount = fiscalYearBonuses.length;
          
          // 4回目以降の賞与を除外（選択された年月の賞与のみ）
          const validBonuses = bonuses.filter((bonus: any) => {
            // この賞与が年度内の何回目かを判定（idで比較）
            const bonusIndex = fiscalYearBonuses.findIndex((b: any) => 
              b['id'] === bonus['id']
            );
            
            // 見つからない場合は除外（念のため）
            if (bonusIndex === -1) {
              return false;
            }
            
            // 4回目以降（インデックス3以降）の賞与は除外
            return bonusIndex < 3; // 0, 1, 2の3回まで（4回目以降は除外）
          });
          
          // 有効な賞与がある場合、同じ年月の賞与を合計してグループ化
          if (validBonuses.length > 0) {
            const totalAmount = validBonuses.reduce((sum: number, b: any) => sum + Number(b['amount']), 0);
            const firstBonus = validBonuses[0];
            bonusListFiltered.push({
              employeeNumber: employeeNumber,
              year: firstBonus['year'],
              month: firstBonus['month'],
              name: firstBonus.name,
              totalAmount: totalAmount,
              bonuses: validBonuses
            });
          }
        });
        
        // グループ化した賞与で保険料を計算
        this.filteredInsuranceList = await Promise.all(
          bonusListFiltered
            .map(async (bonusGroup: any) => {
              // 社員情報を取得
              const employeeData = await this.firestoreService.getEmployeeData(bonusGroup.employeeNumber);
              
              // 退職済み社員の表示条件をチェック
              const shouldShow = this.shouldShowResignedEmployee(
                employeeData?.employmentStatus || '在籍',
                employeeData?.resignationDate,
                employeeData?.healthInsuranceType || '',
                filterYear,
                filterMonth,
                employeeData?.voluntaryInsuranceEndDate,
                employeeData?.socialInsuranceAcquisitionDate
              );
              
              if (!shouldShow) {
                return null;
              }
              
              // 標準賞与額 = 合計賞与額の1000円未満の値を切り捨てた額
              let standardBonusAmount = Math.floor(bonusGroup.totalAmount / 1000) * 1000;
              
              // 任意継続被保険者の場合、賞与は0円にする
              // 任意継続被保険者の保険料徴収は退職日の翌日から任意継続終了日まで
              const resignationDate = employeeData?.resignationDate;
              const voluntaryInsuranceEndDate = employeeData?.voluntaryInsuranceEndDate;
              let resignation: Date | null = null;
              let isVoluntaryContinuation = false;
              
              if (employeeData?.healthInsuranceType === '任意継続被保険者' && 
                  (employeeData?.employmentStatus === '退職' || employeeData?.employmentStatus === '退職済み') &&
                  resignationDate) {
                if (resignationDate instanceof Date) {
                  resignation = resignationDate;
                } else if (resignationDate && typeof resignationDate.toDate === 'function') {
                  resignation = resignationDate.toDate();
                } else if (typeof resignationDate === 'string') {
                  resignation = new Date(resignationDate);
                }
                
                if (resignation && !isNaN(resignation.getTime())) {
                  // 任意継続開始日は退職日の翌日
                  const nextDay = new Date(resignation);
                  nextDay.setDate(nextDay.getDate() + 1);
                  const voluntaryStartDate = nextDay;
                  
                  // 任意継続開始日が属する月の1日を計算（徴収は月単位で行うため）
                  const voluntaryStartMonth = new Date(voluntaryStartDate.getFullYear(), voluntaryStartDate.getMonth(), 1);
                  
                  // 任意継続終了日を計算
                  let endDate: Date;
                  if (voluntaryInsuranceEndDate) {
                    if (voluntaryInsuranceEndDate instanceof Date) {
                      endDate = voluntaryInsuranceEndDate;
                    } else if (voluntaryInsuranceEndDate && typeof voluntaryInsuranceEndDate.toDate === 'function') {
                      endDate = voluntaryInsuranceEndDate.toDate();
                    } else if (typeof voluntaryInsuranceEndDate === 'string') {
                      endDate = new Date(voluntaryInsuranceEndDate);
                    } else {
                      // フォールバック：2年後
                      endDate = new Date(voluntaryStartDate);
                      endDate.setFullYear(endDate.getFullYear() + 2);
                    }
                  } else {
                    // 任意継続終了日が設定されていない場合は2年後
                    endDate = new Date(voluntaryStartDate);
                    endDate.setFullYear(endDate.getFullYear() + 2);
                  }
                  
                  if (isNaN(endDate.getTime())) {
                    // 終了日が無効な場合は2年後を使用
                    endDate = new Date(voluntaryStartDate);
                    endDate.setFullYear(endDate.getFullYear() + 2);
                  }
                  
                  // 選択された年月の1日を計算
                  const selectedDate = new Date(filterYear, filterMonth - 1, 1);
                  
                  // 任意継続終了日の月の1日を計算（終了月の前日まで徴収するため）
                  const endDateMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                  
                  // 任意継続開始日は退職日の翌日。徴収はその日が属する月から開始
                  // 加入月と終了月が同じ場合は、その月のみ任意継続保険料を徴収
                  if (voluntaryStartMonth.getTime() === endDateMonthStart.getTime()) {
                    if (selectedDate.getTime() === voluntaryStartMonth.getTime()) {
                      isVoluntaryContinuation = true;
                    }
                  } else {
                    // 加入月から終了月の前日まで徴収
                    if (selectedDate >= voluntaryStartMonth && selectedDate < endDateMonthStart) {
                      isVoluntaryContinuation = true;
                    }
                  }
                }
              }
              
              if (isVoluntaryContinuation) {
                standardBonusAmount = 0;
              }
              
              // 健康保険料・介護保険料計算用の標準賞与額（年度間上限573万円を考慮）
              // 健康介護保険料の賞与累積額の計算の年度は、4月～翌年3月
              let healthNursingFiscalYear: number;
              if (filterMonth >= 4) {
                healthNursingFiscalYear = filterYear;
              } else {
                healthNursingFiscalYear = filterYear - 1;
              }
              
              // 該当年度の4月から選択された年月までの賞与の合計を計算
              const healthNursingFiscalYearBonuses = this.bonusList.filter((b: any) => {
                const bYear = Number(b['year']);
                const bMonth = Number(b['month']);
                if (b['employeeNumber'] !== bonusGroup.employeeNumber) return false;
                
                // 年度を判定（4月～翌年3月が1年度）
                let bHealthNursingFiscalYear: number;
                if (bMonth >= 4) {
                  bHealthNursingFiscalYear = bYear;
                } else {
                  bHealthNursingFiscalYear = bYear - 1;
                }
                
                // 同じ年度で、選択された年月以前の賞与を取得
                if (bHealthNursingFiscalYear !== healthNursingFiscalYear) return false;
                if (bYear < filterYear) return true;
                if (bYear === filterYear && bMonth <= filterMonth) return true;
                return false;
              });
              
              // 年度内の標準賞与額の合計を計算（健康介護保険料用：4月～翌年3月の年度）
              const healthNursingFiscalYearTotalStandardBonus = healthNursingFiscalYearBonuses.reduce((sum: number, b: any) => {
                const amount = Math.floor(Number(b['amount']) / 1000) * 1000;
                return sum + amount;
              }, 0);
              
              // 健康保険料・介護保険料計算用の標準賞与額（年度間上限573万円）
              // 健康介護保険料の賞与累積額の計算の年度は、4月～翌年3月
              const healthNursingStandardBonusAmount = isVoluntaryContinuation ? 0 : 
                Math.min(standardBonusAmount, Math.max(0, 5730000 - (healthNursingFiscalYearTotalStandardBonus - standardBonusAmount)));
              
              // 厚生年金保険料計算用の標準賞与額（月上限150万円、任意継続被保険者の場合は0）
              // 賞与の場合は等級を関係なく、賞与額をそのまま使用（1000円未満切り捨て）
              const pensionStandardBonusAmount = isVoluntaryContinuation ? 0 : 
                Math.min(1500000, standardBonusAmount);
              
              // 年齢を計算（フィルター年月での年齢）
              const age = this.calculateAgeAtDate(employeeData?.birthDate, filterYear, filterMonth);
              
              // 産前産後休業期間内かどうかを判定
              const isInMaternityLeave = this.isInMaternityLeavePeriod(
                employeeData?.maternityLeaveStartDate,
                employeeData?.maternityLeaveEndDate,
                filterYear,
                filterMonth
              );
              
              // 介護保険料は40歳以上65歳未満の従業員のみ対象（40歳未満または65歳以上は0円）
              const isNursingInsuranceTarget = age !== null && age >= 40 && age < 65;
              
              // 各保険料を計算（産前産後休業期間内の場合は0円、ただし任意継続被保険者の場合は免除しない）
              // 健康保険料：75歳以上の場合は0円
              const isHealthInsuranceTarget = age !== null && age < 75;
              const healthInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isHealthInsuranceTarget ? healthNursingStandardBonusAmount * (healthInsuranceRate / 100) : 0);
              // 介護保険料：40歳未満または65歳以上の場合は0円（任意継続被保険者でも40歳以上65歳未満は徴収）
              const nursingInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isNursingInsuranceTarget ? healthNursingStandardBonusAmount * (nursingInsuranceRate / 100) : 0);
              // 厚生年金保険料：70歳以上の場合は0円
              const isPensionInsuranceTarget = age !== null && age < 70;
              const pensionInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isVoluntaryContinuation ? 0 : (isPensionInsuranceTarget ? pensionStandardBonusAmount * (pensionInsuranceRate / 100) : 0));
              
              // 社員負担額を計算
              let employeeBurden = 0;
              if (!isInMaternityLeave || isVoluntaryContinuation) {
                // 現金徴収する社員かどうかを判定
                const isCashCollection = this.isCashCollectionEmployee(bonusGroup.employeeNumber);
                const roundFunction = isCashCollection ? this.roundHalfCash.bind(this) : this.roundHalf.bind(this);
                
                if (isVoluntaryContinuation) {
                  // 任意継続被保険者の場合、健康保険料と介護保険料は全額社員負担
                  // 端数処理（現金徴収の場合は50未満なら切り捨て、50以上なら切り上げ）
                  const healthNursingTotal = healthInsuranceRaw + nursingInsuranceRaw;
                  employeeBurden = roundFunction(healthNursingTotal);
                } else {
                  // (健康保険料 + 介護保険料) ÷ 2 の端数処理
                  const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2;
                  const healthNursingBurden = roundFunction(healthNursingHalf);
                  
                  // 厚生年金保険料 ÷ 2 の端数処理
                  const pensionHalf = pensionInsuranceRaw / 2;
                  const pensionBurden = roundFunction(pensionHalf);
                  
                  // 社員負担額（合計）
                  employeeBurden = healthNursingBurden + pensionBurden;
                }
              }
              
              return {
                employeeNumber: bonusGroup.employeeNumber,
                name: bonusGroup.name,
                bonusAmount: bonusGroup.totalAmount,
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
  
  // 休業・任意保険者一覧のタイプを切り替え
  switchLeaveVoluntaryListType(type: 'maternity' | 'voluntary') {
    this.leaveVoluntaryListType = type;
    this.filterLeaveVoluntaryList();
  }
  
  // 休業・任意保険者一覧を読み込む
  async loadLeaveVoluntaryList() {
    this.isLoadingLeaveVoluntaryList = true;
    try {
      const allEmployees = await this.firestoreService.getAllEmployees();
      // 新入社員コレクションに存在する社員を除外（入社手続きが完了した社員のみ）
      const onboardingEmployees = await this.firestoreService.getAllOnboardingEmployees();
      const onboardingEmployeeNumbers = new Set(
        onboardingEmployees.map((emp: any) => emp.employeeNumber).filter((num: any) => num)
      );
      
      const completedEmployees = allEmployees.filter(
        (emp: any) => emp.employeeNumber && !onboardingEmployeeNumbers.has(emp.employeeNumber)
      );
      
      // 産前産後休業中または任意継続被保険者の社員をフィルタリング
      this.leaveVoluntaryList = completedEmployees.filter((emp: any) => {
        // 産前産後休業中かどうか
        const hasMaternityLeave = emp.maternityLeaveStartDate && emp.maternityLeaveEndDate;
        
        // 任意継続被保険者かどうか
        const isVoluntaryContinuation = emp.healthInsuranceType === '任意継続被保険者' && 
                                       (emp.employmentStatus === '退職' || emp.employmentStatus === '退職済み');
        
        // 任意継続被保険者の場合、デバッグログを出力
        if (isVoluntaryContinuation) {
          console.log('[任意継続被保険者一覧] 社員を確認:', {
            employeeNumber: emp.employeeNumber,
            name: emp.name,
            healthInsuranceType: emp.healthInsuranceType,
            employmentStatus: emp.employmentStatus,
            resignationDate: emp.resignationDate,
            resignationDateType: typeof emp.resignationDate,
            voluntaryInsuranceEndDate: emp.voluntaryInsuranceEndDate,
            voluntaryInsuranceEndDateType: typeof emp.voluntaryInsuranceEndDate,
            hasVoluntaryInsuranceEndDate: !!emp.voluntaryInsuranceEndDate
          });
        }
        
        // 任意継続被保険者で、任意継続終了日が設定されていない場合、デフォルト値を設定（退職日の翌日から2年後）
        if (isVoluntaryContinuation && !emp.voluntaryInsuranceEndDate && emp.resignationDate) {
          try {
            // 退職日を取得（様々な形式に対応）
            let resignationDateStr = '';
            
            if (emp.resignationDate instanceof Date) {
              const year = emp.resignationDate.getFullYear();
              const month = String(emp.resignationDate.getMonth() + 1).padStart(2, '0');
              const day = String(emp.resignationDate.getDate()).padStart(2, '0');
              resignationDateStr = `${year}-${month}-${day}`;
            } else if (emp.resignationDate && typeof emp.resignationDate.toDate === 'function') {
              const date = emp.resignationDate.toDate();
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              resignationDateStr = `${year}-${month}-${day}`;
            } else if (typeof emp.resignationDate === 'string') {
              // 文字列形式の場合、YYYY-MM-DD形式に統一
              const dateParts = emp.resignationDate.split(/[-/]/);
              if (dateParts.length === 3) {
                const year = dateParts[0].padStart(4, '0');
                const month = dateParts[1].padStart(2, '0');
                const day = dateParts[2].padStart(2, '0');
                resignationDateStr = `${year}-${month}-${day}`;
              } else {
                resignationDateStr = emp.resignationDate;
              }
            } else if (emp.resignationDate && typeof emp.resignationDate === 'object') {
              // Firestore Timestamp形式の場合
              let timestamp: number | null = null;
              if (emp.resignationDate.seconds) {
                timestamp = emp.resignationDate.seconds * 1000;
              } else if (emp.resignationDate._seconds) {
                timestamp = emp.resignationDate._seconds * 1000;
              }
              
              if (timestamp) {
                const date = new Date(timestamp);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                resignationDateStr = `${year}-${month}-${day}`;
              }
            }
            
            // 退職日から2年後の日付を計算
            if (resignationDateStr) {
              const dateParts = resignationDateStr.split('-');
              if (dateParts.length === 3) {
                const year = parseInt(dateParts[0], 10);
                const month = parseInt(dateParts[1], 10) - 1; // 月は0ベース
                const day = parseInt(dateParts[2], 10);
                
                // 退職日の翌日
                const nextDay = new Date(year, month, day + 1);
                
                // 2年後を計算
                const twoYearsLater = new Date(nextDay);
                twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
                
                // 日付を設定
                emp.voluntaryInsuranceEndDate = twoYearsLater;
                console.log('Set voluntary insurance end date:', emp.employeeNumber, 'resignationDate:', resignationDateStr, 'endDate:', twoYearsLater);
              } else {
                console.warn('Could not parse resignation date string:', emp.employeeNumber, resignationDateStr);
              }
            } else {
              console.warn('Could not get resignation date string:', emp.employeeNumber, emp.resignationDate);
            }
          } catch (error) {
            console.error('Error calculating default voluntary insurance end date:', error, 'employee:', emp.employeeNumber, 'resignationDate:', emp.resignationDate);
          }
        }
        
        return hasMaternityLeave || isVoluntaryContinuation;
      });
      
      this.filterLeaveVoluntaryList();
    } catch (error) {
      console.error('Error loading leave/voluntary list:', error);
      this.leaveVoluntaryList = [];
      this.filteredLeaveVoluntaryList = [];
    } finally {
      this.isLoadingLeaveVoluntaryList = false;
    }
  }
  
  // 休業・任意保険者一覧をフィルタリング
  filterLeaveVoluntaryList() {
    if (this.leaveVoluntaryListType === 'maternity') {
      // 産前産後休業中の社員のみ
      this.filteredLeaveVoluntaryList = this.leaveVoluntaryList.filter((emp: any) => {
        return emp.maternityLeaveStartDate && emp.maternityLeaveEndDate;
      });
    } else {
      // 任意継続被保険者のみ
      this.filteredLeaveVoluntaryList = this.leaveVoluntaryList.filter((emp: any) => {
        return emp.healthInsuranceType === '任意継続被保険者' && 
               (emp.employmentStatus === '退職' || emp.employmentStatus === '退職済み');
      });
    }
  }
  
  // 保険料一覧の年月を変更
  async onInsuranceListDateChange() {
    // 年月を数値型に変換（HTMLのselectから文字列型で来る可能性があるため）
    let year = Number(this.insuranceListYear);
    let month = Number(this.insuranceListMonth);
    
    // 2028年12月を超える年月は2028年12月に制限
    if (year > 2028 || (year === 2028 && month > 12)) {
      year = 2028;
      month = 12;
      this.insuranceListYear = 2028;
      this.insuranceListMonth = 12;
    }
    
    await this.filterInsuranceListByDate();
  }
  
  // 給与データを読み込む
  async loadSalaryData() {
    try {
      await this.loadEmployees();
      // 退職者を除外（給与設定は在籍者のみ）
      this.salaryEmployees = this.employees.filter((emp: any) => {
        // 社員データを取得して退職者かどうかを確認
        // employeesにはemploymentStatusが含まれていない可能性があるため、
        // 全社員データから取得する必要がある
        return true; // 一旦全員を含める（後でフィルタリング）
      });
      
      // 全社員データを取得して退職者を除外
      const allEmployees = await this.firestoreService.getAllEmployees();
      const employeeStatusMap = new Map<string, string>();
      allEmployees.forEach((emp: any) => {
        if (emp.employeeNumber && emp.employmentStatus) {
          employeeStatusMap.set(emp.employeeNumber, emp.employmentStatus);
        }
      });
      
      // 退職者を除外
      this.salaryEmployees = this.salaryEmployees.filter((emp: any) => {
        const status = employeeStatusMap.get(emp.employeeNumber);
        return status !== '退職' && status !== '退職済み';
      });
      
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
      
      // 全社員データを取得して退職済み社員を除外
      const allEmployees = await this.firestoreService.getAllEmployees();
      
      // 退職済み社員を除外（賞与設定は在籍者のみ）
      this.bonusEmployees = this.employees.filter((emp: any) => {
        // 全社員データから該当する社員を取得
        const fullEmployeeData = allEmployees.find((e: any) => e.employeeNumber === emp.employeeNumber);
        if (!fullEmployeeData) {
          return false; // データが見つからない場合は除外
        }
        
        // 退職済み社員を除外
        const employmentStatus = fullEmployeeData.employmentStatus || '在籍';
        return employmentStatus !== '退職' && employmentStatus !== '退職済み';
      });
      
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
    
    // 空のオブジェクトをチェック
    if (typeof date === 'object' && Object.keys(date).length === 0) {
      return '-';
    }
    
    try {
      let dateObj: Date | null = null;
      
      if (date.toDate && typeof date.toDate === 'function') {
        // Firestore Timestamp形式の場合
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        // 文字列形式の場合
        // まず、YYYY-MM-DD形式を直接パース（タイムゾーンの問題を避けるため）
        const dateParts = date.split(/[-/]/);
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1; // 月は0ベース
          const day = parseInt(dateParts[2], 10);
          dateObj = new Date(year, month, day);
          // 無効な日付の場合は、new Date()を試す
          if (isNaN(dateObj.getTime())) {
            dateObj = new Date(date);
          }
        } else {
          dateObj = new Date(date);
        }
      } else if (date && typeof date === 'object') {
        // Firestore Timestamp形式（オブジェクト）の場合
        if (date.seconds) {
          dateObj = new Date(date.seconds * 1000);
        } else if (date._seconds) {
          dateObj = new Date(date._seconds * 1000);
        } else if (typeof date.toDate === 'function') {
          dateObj = date.toDate();
        } else if (date.getTime && typeof date.getTime === 'function') {
          // Dateオブジェクトのような場合
          dateObj = new Date(date.getTime());
        } else {
          // 空のオブジェクトや無効なオブジェクトの場合はスキップ
          return '-';
        }
      }
      
      // 日付が有効かチェック
      if (!dateObj || isNaN(dateObj.getTime())) {
        return '-';
      }
      
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      
      return `${year}/${month}/${day}`;
    } catch (error) {
      console.error('Error formatting date:', error, date);
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
    
    // 社員の入社日を取得して、入社月以降の給与しか設定できないようにする
    try {
      const employeeData = await this.firestoreService.getEmployeeData(this.selectedSalaryEmployee);
      if (employeeData && employeeData.socialInsuranceAcquisitionDate) {
        const acquisitionDate = new Date(employeeData.socialInsuranceAcquisitionDate);
        const acquisitionYear = acquisitionDate.getFullYear();
        const acquisitionMonth = acquisitionDate.getMonth() + 1;
        
        // 選択された年月が入社月より前の場合はエラー
        if (this.salaryYear < acquisitionYear || (this.salaryYear === acquisitionYear && this.salaryMonth < acquisitionMonth)) {
          alert(`入社月（${acquisitionYear}年${acquisitionMonth}月）以降の給与しか設定できません。`);
          return;
        }
      }
    } catch (error) {
      console.error('Error getting employee data:', error);
      // エラーが発生しても処理は続行（入社日が取得できない場合のフォールバック）
    }
    
    // その社員の最新の給与設定年月を取得（手動設定された給与のみ）
    const employeeSalaries = this.salaryHistory.filter((s: any) => 
      s['employeeNumber'] === this.selectedSalaryEmployee && s['isManual'] === true
    );
    
    if (employeeSalaries.length > 0) {
      // 最新の給与設定年月を取得
      const latestSalary = employeeSalaries.sort((a: any, b: any) => {
        const aYear = Number(a['year']);
        const bYear = Number(b['year']);
        const aMonth = Number(a['month']);
        const bMonth = Number(b['month']);
        if (aYear !== bYear) return bYear - aYear;
        return bMonth - aMonth;
      })[0];
      
      const latestYear = Number(latestSalary['year']);
      const latestMonth = Number(latestSalary['month']);
      
      // 新しい設定年月が最新の設定年月より過去の場合はエラー
      if (this.salaryYear < latestYear || (this.salaryYear === latestYear && this.salaryMonth < latestMonth)) {
        alert(`最新の情報より過去の年月の給与は設定できません。\n最新の給与設定: ${latestYear}年${latestMonth}月`);
        return;
      }
    }
    
    this.isSavingSalary = true;
    this.salarySaveProgress = { message: '給与設定を開始しています...', progress: 0 };
    
    // ブラウザ更新を防止
    this.setBeforeUnloadHandler();
    
    try {
      // 給与設定をFirestoreに保存（指定年月以降の2028年12月までの給与を設定）
      console.log(`[給与設定] 給与設定開始。社員番号: ${this.selectedSalaryEmployee}, 年: ${this.salaryYear}, 月: ${this.salaryMonth}, 金額: ${this.salaryAmount}`);
      
      // 設定年月が2028年12月を超えている場合はエラー
      if (this.salaryYear > 2028 || (this.salaryYear === 2028 && this.salaryMonth > 12)) {
        alert('給与設定は2028年12月までしか設定できません。');
        this.isSavingSalary = false;
        return;
      }
      
      // 設定年月から2028年12月までのすべての給与設定を一度にバッチ保存（アトミックな処理）
      this.salarySaveProgress = { message: '給与設定を準備しています...', progress: 5 };
      
      // 設定年月から2028年12月までの残りの月に給与を自動設定
      let currentYear = this.salaryYear;
      let currentMonth = this.salaryMonth + 1; // 次の月から開始
      
      // 月が12を超える場合の処理
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      
      // 自動設定する年月のリストを作成
      const salaryMonths: { year: number; month: number }[] = [];
      let listYear = currentYear;
      let listMonth = currentMonth;
      while (listYear < 2028 || (listYear === 2028 && listMonth <= 12)) {
        salaryMonths.push({ year: listYear, month: listMonth });
        listMonth++;
        if (listMonth > 12) {
          listMonth = 1;
          listYear++;
        }
      }
      
      // すべての給与設定を配列にまとめる（手動設定 + 自動設定）
      const allSalaries: Array<{employeeNumber: string, year: number, month: number, amount: number, isManual: boolean}> = [
        // 手動設定（最初の1件）
        {
          employeeNumber: this.selectedSalaryEmployee,
          year: this.salaryYear,
          month: this.salaryMonth,
          amount: this.salaryAmount,
          isManual: true
        },
        // 自動設定（残りのすべて）
        ...salaryMonths.map(monthData => ({
          employeeNumber: this.selectedSalaryEmployee,
          year: monthData.year,
          month: monthData.month,
          amount: this.salaryAmount,
          isManual: false
        }))
      ];
      
      // バッチ書き込みで一度に保存（各バッチはアトミック）
      this.salarySaveProgress = { message: '給与設定を保存しています...', progress: 10 };
      
      const totalMonths = allSalaries.length;
      await this.firestoreService.saveSalariesBatch(
        allSalaries,
        (current, total) => {
          // 進捗を更新（10-30%の範囲）
          const progress = 10 + Math.floor((current / total) * 20);
          this.salarySaveProgress = { 
            message: `給与設定を保存しています... (${current}/${total}件)`, 
            progress: progress 
          };
        }
      );
      
      this.salarySaveProgress = { message: `給与設定を保存しました (${totalMonths}件)`, progress: 30 };
      
      console.log(`[給与設定] 給与設定完了。${this.salaryYear}年${this.salaryMonth}月から2028年12月まで設定しました。`);
      
      // その社員のstandardMonthlySalaryChangesを全て削除
      // 給与設定によって標準報酬月額を再計算するため、既存の標準報酬月額変更情報を削除
      this.salarySaveProgress = { message: '標準報酬月額変更情報を削除しています...', progress: 32 };
      
      // その社員の全ての標準報酬月額変更情報を取得（2025年1月から2099年12月まで）
      const allStandardChanges = await this.firestoreService.getStandardMonthlySalaryChangesInPeriod(
        this.selectedSalaryEmployee,
        2025,
        1,
        2099,
        12
      );
      
      // 全ての標準報酬月額変更情報を削除
      for (const change of allStandardChanges) {
        const effectiveYear = Number(change.effectiveYear);
        const effectiveMonth = Number(change.effectiveMonth);
        try {
          await this.firestoreService.deleteStandardMonthlySalaryChange(
            this.selectedSalaryEmployee,
            effectiveYear,
            effectiveMonth
          );
          console.log(`[給与設定] 社員番号: ${this.selectedSalaryEmployee}, ${effectiveYear}年${effectiveMonth}月の標準報酬月額変更情報を削除しました`);
        } catch (error) {
          console.error(`[給与設定] 社員番号: ${this.selectedSalaryEmployee}, ${effectiveYear}年${effectiveMonth}月の標準報酬月額変更情報の削除に失敗しました:`, error);
        }
      }
      
      // その社員の全ての厚生年金保険用標準報酬月額変更情報も削除
      // その社員の全ての厚生年金保険用標準報酬月額変更情報を取得（2025年1月から2099年12月まで）
      const allPensionChanges = await this.firestoreService.getPensionStandardMonthlySalaryChangesInPeriod(
        this.selectedSalaryEmployee,
        2025,
        1,
        2099,
        12
      );
      
      // 全ての厚生年金保険用標準報酬月額変更情報を削除
      for (const change of allPensionChanges) {
        const effectiveYear = Number(change.effectiveYear);
        const effectiveMonth = Number(change.effectiveMonth);
        try {
          await this.firestoreService.deletePensionStandardMonthlySalaryChange(
            this.selectedSalaryEmployee,
            effectiveYear,
            effectiveMonth
          );
          console.log(`[給与設定] 社員番号: ${this.selectedSalaryEmployee}, ${effectiveYear}年${effectiveMonth}月の厚生年金保険用標準報酬月額変更情報を削除しました`);
        } catch (error) {
          console.error(`[給与設定] 社員番号: ${this.selectedSalaryEmployee}, ${effectiveYear}年${effectiveMonth}月の厚生年金保険用標準報酬月額変更情報の削除に失敗しました:`, error);
        }
      }
      
      console.log(`[給与設定] 標準報酬月額変更情報の削除完了。健康介護保険: ${allStandardChanges.length}件、厚生年金保険: ${allPensionChanges.length}件の標準報酬月額変更情報を削除しました。`);
      
      // 給与設定履歴を再読み込み（標準報酬月額変更チェックの前に必要）
      // 定時改定・随時改定の計算には、すべての給与（自動設定含む）が必要なため、getAllSalaryHistoryを使用
      this.salarySaveProgress = { message: '給与設定履歴を読み込んでいます...', progress: 35 };
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
      // データ取得を事前にキャッシュ（パフォーマンス向上）
      this.salarySaveProgress = { message: '随時改定を再計算しています...', progress: 40 };
      
      // 賞与一覧を事前に取得（随時改定の再計算で使用）
      const allBonuses = await this.firestoreService.getBonusHistory();
      const bonusList = allBonuses.map((bonus: any) => ({
        ...bonus,
        year: Number(bonus['year']),
        month: Number(bonus['month']),
        employeeNumber: bonus['employeeNumber']
      }));
      
      // 社員データを事前に取得（随時改定の再計算で使用）
      const employeeData = await this.firestoreService.getEmployeeData(this.selectedSalaryEmployee);
      
      await this.recalculateAllZujijiKaitei(
        this.selectedSalaryEmployee,
        sortedHistory,
        bonusList,
        employeeData
      );
      
      // 定時改定の処理（2028年12月までのすべての年度で定時改定をチェック）
      // 2025年度から2028年度まで、すべての年度について定時改定をチェック
      console.log(`[定時改定] 給与設定後の定時改定チェック開始。社員番号: ${this.selectedSalaryEmployee}`);
      
      const totalFiscalYears = 4; // 2025-2028年度
      let processedFiscalYears = 0;
      
      for (let fiscalYear = 2025; fiscalYear <= 2028; fiscalYear++) {
        console.log(`[定時改定] ${fiscalYear}年度（${fiscalYear}年4月～${fiscalYear + 1}年3月）のチェック開始`);
        
        const progress = 50 + Math.floor((processedFiscalYears / totalFiscalYears) * 30); // 50-80%
        this.salarySaveProgress = { 
          message: `定時改定をチェックしています... (${fiscalYear}年度)`, 
          progress: progress 
        };
        
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
        
        processedFiscalYears++;
      }
      
      console.log(`[定時改定] 給与設定後の定時改定チェック完了`);
      
      // 給与設定履歴を設定
      this.salarySaveProgress = { message: '給与設定履歴を更新しています...', progress: 85 };
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
      this.salarySaveProgress = { message: '社会保険料一覧を更新しています...', progress: 90 };
      await this.loadInsuranceList();
      await this.filterInsuranceListByDate();
      
      this.salarySaveProgress = { message: '完了しました', progress: 100 };
      
      alert('給与を設定しました');
      
      // フォームをリセット
      this.selectedSalaryEmployee = '';
      this.salaryAmount = 0;
    } catch (error: any) {
      console.error('Error saving salary:', error);
      const errorMessage = error?.message || '給与の設定に失敗しました';
      this.salarySaveProgress = { message: 'エラーが発生しました', progress: 0 };
      
      // エラーメッセージを表示
      if (errorMessage.includes('一部のみ保存')) {
        alert(`給与設定の保存中にエラーが発生しました。\n\n${errorMessage}\n\nページを更新して、保存された給与設定を確認してください。`);
      } else {
        alert(`給与の設定に失敗しました。\n\n${errorMessage}`);
      }
    } finally {
      this.isSavingSalary = false;
      
      // ブラウザ更新防止を解除（賞与設定が処理中でない場合のみ）
      if (!this.isSavingBonus) {
        this.removeBeforeUnloadHandler();
      }
      
      // 少し遅延してからプログレスをリセット（完了メッセージを表示するため）
      setTimeout(() => {
        this.salarySaveProgress = { message: '', progress: 0 };
      }, 1000);
    }
  }

  // 指定された年月の報酬加算額を計算（その年月が属する年度の7月から翌年6月までの賞与が4回以上の場合）
  // asOfYear, asOfMonth: この時点までの賞与のみを考慮する（給与設定月の時点での報酬加算額を計算するため）
  async calculateMonthlyRewardAddition(
    employeeNumber: string,
    year: number,
    month: number,
    bonusList: any[],
    asOfYear?: number,
    asOfMonth?: number
  ): Promise<number> {
    try {
      // 年4回以上の賞与は常に報酬加算額として計算する
      // その年月が属する年度を判定（7月～翌年6月が1年度）
      let fiscalYear: number;
      if (month >= 7) {
        fiscalYear = year;
      } else {
        fiscalYear = year - 1;
      }
      
      // 該当年度の7月から翌年6月までの賞与を取得
      // asOfYear, asOfMonthが指定されている場合、その時点までの賞与のみを考慮
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
        
        // 年度が一致しない場合は除外
        if (bFiscalYear !== fiscalYear) return false;
        
        // asOfYear, asOfMonthが指定されている場合、その時点までの賞与のみを考慮
        if (asOfYear !== undefined && asOfMonth !== undefined) {
          if (bYear < asOfYear) return true;
          if (bYear === asOfYear && bMonth <= asOfMonth) return true;
          return false;
        }
        
        return true;
      });
      
      // 年度賞与支給回数
      const fiscalYearBonusCount = fiscalYearBonuses.length;
      
      console.log(`[報酬加算額計算] ${year}年${month}月（年度: ${fiscalYear}年度）の報酬加算額計算: 賞与支給回数=${fiscalYearBonusCount}回, asOf=${asOfYear !== undefined ? `${asOfYear}年${asOfMonth}月` : '全期間'}`);
      if (fiscalYearBonusCount > 0) {
        console.log(`[報酬加算額計算] 該当年度の賞与一覧:`, fiscalYearBonuses.map((b: any) => ({
          year: b['year'],
          month: b['month'],
          amount: b['amount']
        })));
      }
      
      // 賞与支給回数が4回以上の場合のみ報酬加算額を計算
      if (fiscalYearBonusCount >= 4) {
        // 年度内の賞与合計額を計算
        const fiscalYearTotalBonus = fiscalYearBonuses.reduce((sum: number, b: any) => {
          return sum + Number(b['amount']);
        }, 0);
        
        // 年度報酬加算額（賞与合計額を12で割った額）
        const rewardAddition = fiscalYearTotalBonus / 12;
        console.log(`[報酬加算額計算] 賞与合計額: ${fiscalYearTotalBonus}円, 報酬加算額: ${rewardAddition}円`);
        return rewardAddition;
      }
      
      console.log(`[報酬加算額計算] 賞与支給回数が4回未満のため、報酬加算額は0円`);
      return 0;
    } catch (error) {
      console.error('Error calculating monthly reward addition:', error);
      return 0;
    }
  }

  // その社員のすべての随時改定を再計算
  async recalculateAllZujijiKaitei(
    employeeNumber: string,
    salaryHistory: any[],
    bonusList?: any[],
    employeeData?: any
  ) {
    try {
      console.log(`[随時改定再計算] 開始。社員番号: ${employeeNumber}`);
      
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
      console.log(`[随時改定再計算] 手動設定された給与一覧:`, manualSalaries.map((s: any) => ({
        year: s['year'],
        month: s['month'],
        amount: s['amount']
      })));
      
      // 賞与一覧を取得（報酬加算額の計算に必要）
      // 事前に取得されていない場合のみ取得（パフォーマンス向上）
      let actualBonusList = bonusList;
      if (!actualBonusList) {
        const allBonuses = await this.firestoreService.getBonusHistory();
        actualBonusList = allBonuses.map((bonus: any) => ({
          ...bonus,
          year: Number(bonus['year']),
          month: Number(bonus['month']),
          employeeNumber: bonus['employeeNumber']
        }));
      }
      
      console.log(`[随時改定再計算] 賞与一覧を取得しました。全件数: ${actualBonusList.length}, 該当社員の件数: ${actualBonusList.filter((b: any) => b['employeeNumber'] === employeeNumber).length}`);
      
      // 各給与設定月について、随時改定を再計算
      for (const salary of manualSalaries) {
        const changeYear = Number(salary['year']);
        const changeMonth = Number(salary['month']);
        const changeAmount = Number(salary['amount']);
        
        console.log(`[随時改定再計算] ${changeYear}年${changeMonth}月の給与設定（${changeAmount}円）について随時改定を計算開始`);
        
        // 給与設定月の時点での賞与のみを考慮して随時改定を計算
        await this.checkAndUpdateStandardMonthlySalary(
          employeeNumber,
          changeYear,
          changeMonth,
          changeAmount,
          salaryHistory,
          bonusList,
          changeYear,
          changeMonth
        );
        
        console.log(`[随時改定再計算] ${changeYear}年${changeMonth}月の給与設定について随時改定を計算完了`);
      }
      
      // 賞与を4回以上支給したタイミングでの随時改定処理
      const employeeBonuses = actualBonusList.filter((b: any) => b['employeeNumber'] === employeeNumber);
      
      // 年度ごとに賞与をグループ化
      const bonusByFiscalYear = new Map<number, any[]>();
      
      employeeBonuses.forEach((bonus: any) => {
        const bonusYear = bonus['year'];
        const bonusMonth = bonus['month'];
        
        // 年度を判定（7月～翌年6月が1年度）
        let fiscalYear: number;
        if (bonusMonth >= 7) {
          fiscalYear = bonusYear;
        } else {
          fiscalYear = bonusYear - 1;
        }
        
        if (!bonusByFiscalYear.has(fiscalYear)) {
          bonusByFiscalYear.set(fiscalYear, []);
        }
        bonusByFiscalYear.get(fiscalYear)!.push(bonus);
      });
      
      // 各年度について、4回目以降の賞与が支給されたすべての月を時系列順に処理
      for (const [fiscalYear, bonuses] of bonusByFiscalYear.entries()) {
        // 時系列順にソート
        const sortedBonuses = bonuses.sort((a: any, b: any) => {
          if (a['year'] !== b['year']) return a['year'] - b['year'];
          if (a['month'] !== b['month']) return a['month'] - b['month'];
          // 同じ年月の場合は、idでソート（タイムスタンプが含まれている）
          const aId = a['id'] || '';
          const bId = b['id'] || '';
          return aId.localeCompare(bId);
        });
        
        // 4回目以降の賞与が支給された月を特定（同じ月は1回だけ処理）
        if (sortedBonuses.length >= 4) {
          // 4回目以降の賞与が支給された月を時系列順に取得（重複を除去）
          const bonusMonths = new Map<string, { year: number; month: number; index: number }>();
          
          for (let i = 3; i < sortedBonuses.length; i++) {
            const bonus = sortedBonuses[i];
            const bonusYear = bonus['year'];
            const bonusMonth = bonus['month'];
            const key = `${bonusYear}_${bonusMonth}`;
            
            // 同じ月の最初の賞与（4回目以降）のインデックスを記録
            if (!bonusMonths.has(key)) {
              bonusMonths.set(key, { year: bonusYear, month: bonusMonth, index: i });
            }
          }
          
          // 時系列順にソート
          const sortedBonusMonths = Array.from(bonusMonths.values()).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          });
          
          // 各月について、その時点での報酬加算額を使用して随時改定を実行
          // さらに、その月以前の月（3か月前まで）で随時改定が行われた場合、それらも再計算する
          for (const bonusMonth of sortedBonusMonths) {
            const bonusYear = bonusMonth.year;
            const bonusMonthNum = bonusMonth.month;
            
            // その月以前の月（3か月前まで）で随時改定が行われた可能性がある月を特定
            const monthsToRecalculate: { year: number; month: number }[] = [];
            
            // その月を給与変更月として随時改定を実行
            monthsToRecalculate.push({ year: bonusYear, month: bonusMonthNum });
            
            // その月以前の月（3か月前まで）も再計算する
            for (let offset = 1; offset <= 3; offset++) {
              let targetYear = bonusYear;
              let targetMonth = bonusMonthNum - offset;
              
              // 月が0以下になった場合の処理
              while (targetMonth <= 0) {
                targetMonth += 12;
                targetYear -= 1;
              }
              
              // その月が4回目以降の賞与が支給された月より前の場合、再計算対象に追加
              if (targetYear < bonusYear || (targetYear === bonusYear && targetMonth < bonusMonthNum)) {
                monthsToRecalculate.push({ year: targetYear, month: targetMonth });
              }
            }
            
            // 各月について、その時点での報酬加算額を使用して随時改定を実行
            for (const monthToRecalc of monthsToRecalculate) {
              const changeYear = monthToRecalc.year;
              const changeMonth = monthToRecalc.month;
              
              console.log(`[随時改定再計算] ${fiscalYear}年度で4回目以降の賞与が支給されたため、${changeYear}年${changeMonth}月を給与変更月として随時改定処理を実行します。`);
              
              // その時点での給与額を取得
              const relevantSalaries = salaryHistory
                .filter((s: any) => s['employeeNumber'] === employeeNumber)
                .filter((s: any) => {
                  const salaryYear = Number(s['year']);
                  const salaryMonth = Number(s['month']);
                  if (salaryYear < changeYear) return true;
                  if (salaryYear === changeYear && salaryMonth <= changeMonth) return true;
                  return false;
                })
                .sort((a: any, b: any) => {
                  const aYear = Number(a['year']);
                  const bYear = Number(b['year']);
                  const aMonth = Number(a['month']);
                  const bMonth = Number(b['month']);
                  if (aYear !== bYear) return bYear - aYear;
                  return bMonth - bMonth;
                });
              
              let salaryAmount = 0;
              if (relevantSalaries.length > 0) {
                salaryAmount = Number(relevantSalaries[0]['amount']);
              } else {
                // 給与設定がない場合、入社時の給与見込み額から計算（給与と現物の合計）
                // 事前に取得された社員データを使用（パフォーマンス向上）
                let actualEmployeeData = employeeData;
                if (!actualEmployeeData) {
                  actualEmployeeData = await this.firestoreService.getEmployeeData(employeeNumber);
                }
                if (actualEmployeeData) {
                  const expectedMonthlySalary = Number(actualEmployeeData.expectedMonthlySalary) || 0;
                  const expectedMonthlySalaryInKind = Number(actualEmployeeData.expectedMonthlySalaryInKind) || 0;
                  salaryAmount = expectedMonthlySalary + expectedMonthlySalaryInKind;
                  console.log(`[随時改定再計算] 給与設定がないため、入社時の給与見込み額（給与: ${expectedMonthlySalary}円 + 現物: ${expectedMonthlySalaryInKind}円 = 合計: ${salaryAmount}円）を使用します。`);
                }
              }
              
              // その時点での報酬加算額を使用して随時改定処理を実行
              // 各月の報酬加算額は、その月の時点での賞与を使用して計算される（checkAndUpdateStandardMonthlySalary内で修正済み）
              // asOfYear, asOfMonthは指定しない（各月の時点での賞与を使用するため）
              await this.checkAndUpdateStandardMonthlySalary(
                employeeNumber,
                changeYear,
                changeMonth,
                salaryAmount,
                salaryHistory,
                actualBonusList
              );
              
              console.log(`[随時改定再計算] ${changeYear}年${changeMonth}月について随時改定を計算完了`);
            }
          }
        }
      }
      
      console.log(`[随時改定再計算] 完了。社員番号: ${employeeNumber}`);
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
    salaryHistory: any[],
    bonusList?: any[],
    asOfYear?: number,
    asOfMonth?: number,
    collectChanges?: boolean  // trueの場合、変更情報を保存せずに返す
  ): Promise<Array<{employeeNumber: string, effectiveYear: number, effectiveMonth: number, grade: number, monthlyStandard: number}> | null> {
    try {
      console.log(`[随時改定] 処理開始。社員番号: ${employeeNumber}, 変更年: ${changeYear}, 変更月: ${changeMonth}, 給与額: ${newSalary}円, asOfYear: ${asOfYear}, asOfMonth: ${asOfMonth}`);
      
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
      // bonusListが渡されていない場合のみ取得
      let actualBonusList = bonusList;
      if (!actualBonusList) {
        const allBonuses = await this.firestoreService.getBonusHistory();
        actualBonusList = allBonuses.map((bonus: any) => ({
          ...bonus,
          year: Number(bonus['year']),
          month: Number(bonus['month']),
          employeeNumber: bonus['employeeNumber']
        }));
      }
      
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
        // 各月の報酬加算額は、その月の時点での賞与を使用して計算する
        // asOfYear, asOfMonthが指定されている場合でも、各月の時点での賞与を使用する
        const rewardAddition = await this.calculateMonthlyRewardAddition(
          employeeNumber,
          targetYear,
          targetMonth,
          actualBonusList,
          targetYear,  // その月の時点での賞与を使用
          targetMonth  // その月の時点での賞与を使用
        );
        
        console.log(`[随時改定] ${targetYear}年${targetMonth}月: 給与額=${monthlySalary}円, 報酬加算額=${rewardAddition}円, 合計=${monthlySalary + rewardAddition}円`);
        
        salariesForAverage.push(monthlySalary + rewardAddition);
      }
      
      // 平均を計算
      const averageSalary = salariesForAverage.reduce((sum, val) => sum + val, 0) / salariesForAverage.length;
      console.log(`[随時改定] 3か月の平均給与: ${averageSalary}円`);
      
      // 新しい標準報酬月額を計算
      const newStandardInfo = this.calculateStandardMonthlySalary(averageSalary);
      if (!newStandardInfo) {
        if (collectChanges) return [];
        return null;
      }
      
      const newGrade = newStandardInfo.grade;
      
      console.log(`[随時改定] 前の等級: ${previousGrade}, 新しい等級: ${newGrade}, 等級差: ${previousGrade !== null ? Math.abs(newGrade - previousGrade) : 'N/A'}`);
      
      // 随時改定を適用する条件：
      // 1. 等級差が2以上の場合
      // 2. または、前の等級が2等級で新しい等級が1等級の場合（下限到達）
      // 3. または、前の等級が49等級で新しい等級が50等級の場合（上限到達）
      // 4. または、前の等級が1等級で新しい等級が2等級の場合（下限から離れる）
      // 5. または、前の等級が50等級で新しい等級が49等級の場合（上限から離れる）
      const gradeDifference = previousGrade !== null ? Math.abs(newGrade - previousGrade) : 0;
      const isLowerBoundReached = previousGrade === 2 && newGrade === 1;
      const isUpperBoundReached = previousGrade === 49 && newGrade === 50;
      const isLowerBoundLeaving = previousGrade === 1 && newGrade === 2;
      const isUpperBoundLeaving = previousGrade === 50 && newGrade === 49;
      const shouldApplyRevision = previousGrade !== null && (
        gradeDifference >= 2 || 
        isLowerBoundReached || 
        isUpperBoundReached ||
        isLowerBoundLeaving ||
        isUpperBoundLeaving
      );
      
      if (shouldApplyRevision) {
        // 3か月後の年月を計算
        let effectiveYear = changeYear;
        let effectiveMonth = changeMonth + 3;
        while (effectiveMonth > 12) {
          effectiveMonth -= 12;
          effectiveYear += 1;
        }
        
        let reasonMessage = '';
        if (isLowerBoundReached) {
          reasonMessage = `等級の下限（1等級）に到達したため`;
        } else if (isUpperBoundReached) {
          reasonMessage = `等級の上限（50等級）に到達したため`;
        } else if (isLowerBoundLeaving) {
          reasonMessage = `等級の下限（1等級）から離れるため`;
        } else if (isUpperBoundLeaving) {
          reasonMessage = `等級の上限（50等級）から離れるため`;
        } else {
          reasonMessage = `等級差が2以上（${gradeDifference}等級）のため`;
        }
        
        console.log(`[随時改定] ${reasonMessage}、${effectiveYear}年${effectiveMonth}月から等級${newGrade}を適用します。`);
        
        // 変更情報を返すモードの場合、保存せずに変更情報を返す
        if (collectChanges) {
          return [{
            employeeNumber,
            effectiveYear,
            effectiveMonth,
            grade: newGrade,
            monthlyStandard: newStandardInfo.monthlyStandard
          }];
        }
        
        // 標準報酬月額変更情報を保存
        await this.firestoreService.saveStandardMonthlySalaryChange(
          employeeNumber,
          effectiveYear,
          effectiveMonth,
          newGrade,
          newStandardInfo.monthlyStandard
        );
        
        console.log(`[随時改定] 標準報酬月額変更情報を保存しました。`);
      } else {
        console.log(`[随時改定] 等級差が2未満かつ上限・下限に到達していないため、随時改定を適用しません。`);
      }
      
      console.log(`[随時改定] 処理完了。社員番号: ${employeeNumber}, 変更年: ${changeYear}, 変更月: ${changeMonth}`);
      
      // 厚生年金保険用の標準報酬月額変更も処理
      const pensionChanges = await this.checkAndUpdatePensionStandardMonthlySalary(
        employeeNumber,
        changeYear,
        changeMonth,
        newSalary,
        salaryHistory,
        bonusList,
        asOfYear,
        asOfMonth,
        collectChanges
      );
      
      // 変更情報を返すモードの場合、健康介護保険と厚生年金保険の変更情報をまとめて返す
      if (collectChanges) {
        let healthChanges: Array<{employeeNumber: string, effectiveYear: number, effectiveMonth: number, grade: number, monthlyStandard: number}> = [];
        if (shouldApplyRevision) {
          // 3か月後の年月を計算
          let effectiveYear = changeYear;
          let effectiveMonth = changeMonth + 3;
          while (effectiveMonth > 12) {
            effectiveMonth -= 12;
            effectiveYear += 1;
          }
          healthChanges = [{
            employeeNumber,
            effectiveYear,
            effectiveMonth,
            grade: newGrade,
            monthlyStandard: newStandardInfo.monthlyStandard
          }];
        }
        return [...healthChanges, ...(pensionChanges || [])];
      }
      
      return null;
    } catch (error) {
      console.error('Error checking standard monthly salary change:', error);
      // エラーが発生しても給与設定は保存されているので、処理を続行
      if (collectChanges) {
        return [];
      }
      return null;
    }
  }

  // 厚生年金保険用の標準報酬月額の変更を検出して処理
  async checkAndUpdatePensionStandardMonthlySalary(
    employeeNumber: string, 
    changeYear: number, 
    changeMonth: number, 
    newSalary: number,
    salaryHistory: any[],
    bonusList?: any[],
    asOfYear?: number,
    asOfMonth?: number,
    collectChanges?: boolean  // trueの場合、変更情報を保存せずに返す
  ): Promise<Array<{employeeNumber: string, effectiveYear: number, effectiveMonth: number, grade: number, monthlyStandard: number}> | null> {
    try {
      // kouseinenkinReiwa7が存在しない場合は処理をスキップ
      if (!this.gradeTable || !this.gradeTable.kouseinenkinReiwa7) {
        console.log(`[厚生年金随時改定] kouseinenkinReiwa7が存在しないため、処理をスキップします。`);
        if (collectChanges) return [];
        return null;
      }

      console.log(`[厚生年金随時改定] ====================================`);
      console.log(`[厚生年金随時改定] 処理開始`);
      console.log(`[厚生年金随時改定] 社員番号: ${employeeNumber}`);
      console.log(`[厚生年金随時改定] 変更年月: ${changeYear}年${changeMonth}月`);
      console.log(`[厚生年金随時改定] 給与額: ${newSalary}円`);
      
      // 変更前の厚生年金保険用標準報酬月額を取得（変更月+3か月以前に適用される最新の等級）
      // 変更月の給与設定によって決定される適用年月は変更月+3か月なので、
      // 変更月+3か月以前に適用される最新の変更情報を取得する必要がある
      let targetYearForPrevious = changeYear;
      let targetMonthForPrevious = changeMonth + 3;
      while (targetMonthForPrevious > 12) {
        targetMonthForPrevious -= 12;
        targetYearForPrevious += 1;
      }
      
      const pensionStandardChangeBeforeChange = await this.firestoreService.getPensionStandardMonthlySalaryChange(
        employeeNumber,
        targetYearForPrevious,
        targetMonthForPrevious
      );
      
      console.log(`[厚生年金随時改定] ---------- 前の等級の取得 ----------`);
      console.log(`[厚生年金随時改定] 変更月+3か月: ${targetYearForPrevious}年${targetMonthForPrevious}月`);
      console.log(`[厚生年金随時改定] 変更前の標準報酬月額変更情報: ${pensionStandardChangeBeforeChange ? '存在' : '不存在'}`);
      if (pensionStandardChangeBeforeChange) {
        console.log(`[厚生年金随時改定] 変更情報の適用年月: ${pensionStandardChangeBeforeChange.effectiveYear}年${pensionStandardChangeBeforeChange.effectiveMonth}月`);
        console.log(`[厚生年金随時改定] 変更情報の等級: ${pensionStandardChangeBeforeChange.grade}`);
        console.log(`[厚生年金随時改定] 変更情報の標準報酬月額: ${pensionStandardChangeBeforeChange.monthlyStandard}円`);
      }
      
      let previousPensionGrade: number | null = null;
      
      // 変更月+3か月以前に厚生年金保険用標準報酬月額変更情報がある場合、その等級を使用
      if (pensionStandardChangeBeforeChange) {
        const effectiveYearBefore = Number(pensionStandardChangeBeforeChange.effectiveYear);
        const effectiveMonthBefore = Number(pensionStandardChangeBeforeChange.effectiveMonth);
        const isBeforeTarget = effectiveYearBefore < targetYearForPrevious || (effectiveYearBefore === targetYearForPrevious && effectiveMonthBefore < targetMonthForPrevious);
        console.log(`[厚生年金随時改定] 変更情報の適用年月が変更月+3か月以前か: ${isBeforeTarget}`);
        if (isBeforeTarget) {
          previousPensionGrade = pensionStandardChangeBeforeChange.grade;
          console.log(`[厚生年金随時改定] 変更情報から前の等級を取得: ${previousPensionGrade}`);
        }
      }
      
      // 標準報酬月額変更情報がない場合、変更月以前の最新の給与設定から等級を計算
      // 上限・下限の境界での改定を判定するために、前の等級を取得する必要がある
      if (previousPensionGrade === null) {
        console.log(`[厚生年金随時改定] 変更情報から前の等級を取得できなかったため、給与設定履歴から計算します`);
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
        
        console.log(`[厚生年金随時改定] 変更月以前の給与設定件数: ${previousSalaries.length}`);
        const previousSalary = previousSalaries.length > 0 ? previousSalaries[0]['amount'] : null;
        if (previousSalary) {
          console.log(`[厚生年金随時改定] 変更月以前の最新給与: ${previousSalary}円`);
          const previousPensionStandard = this.calculatePensionStandardMonthlySalary(Number(previousSalary));
          console.log(`[厚生年金随時改定] 計算された前の標準報酬月額: ${previousPensionStandard}円`);
          // 標準報酬月額から等級を逆引き
          const pensionGradeList = this.gradeTable.kouseinenkinReiwa7;
          const matchingGrade = pensionGradeList.find((item: any) => item.monthlyStandard === previousPensionStandard);
          previousPensionGrade = matchingGrade ? matchingGrade.grade : null;
          console.log(`[厚生年金随時改定] 給与設定から前の等級を取得: ${previousPensionGrade !== null ? previousPensionGrade : 'null'}`);
        } else {
          console.log(`[厚生年金随時改定] 変更月以前の給与設定がないため、入社時の給与見込み額から計算します`);
          // 変更月以前の給与設定がない場合、入社時の給与見込み額から等級を計算
          const employeeData = await this.firestoreService.getEmployeeData(employeeNumber);
          if (employeeData) {
            const expectedMonthlySalary = Number(employeeData.expectedMonthlySalary) || 0;
            const expectedAnnualBonus = Number(employeeData.expectedAnnualBonus) || 
                                       Number(employeeData.applicationData?.expectedAnnualBonus) || 0;
            const expectedMonthlyBonus = expectedAnnualBonus / 12;
            const initialFixedSalary = expectedMonthlySalary + expectedMonthlyBonus;
            
            console.log(`[厚生年金随時改定] 入社時の見込み給与: ${initialFixedSalary}円`);
            const initialPensionStandard = this.calculatePensionStandardMonthlySalary(initialFixedSalary);
            console.log(`[厚生年金随時改定] 計算された入社時の標準報酬月額: ${initialPensionStandard}円`);
            const pensionGradeList = this.gradeTable.kouseinenkinReiwa7;
            const matchingGrade = pensionGradeList.find((item: any) => item.monthlyStandard === initialPensionStandard);
            previousPensionGrade = matchingGrade ? matchingGrade.grade : null;
            console.log(`[厚生年金随時改定] 入社時の見込み給与から前の等級を取得: ${previousPensionGrade !== null ? previousPensionGrade : 'null'}`);
          } else {
            console.log(`[厚生年金随時改定] 社員情報が取得できませんでした`);
          }
        }
      }
      
      // 前の等級が取得できなかった場合でも、新しい等級が上限・下限の境界（1等級または32等級）の場合は改定を検討
      // ただし、前の等級が不明な場合は改定しない（初回設定時など）
      
      // 3か月の固定的賃金の平均を計算（変更月、変更月+1、変更月+2の3か月）
      const salariesForAverage: number[] = [];
      
      // 賞与一覧を取得（報酬加算額の計算に必要）
      let actualBonusList = bonusList;
      if (!actualBonusList) {
        const allBonuses = await this.firestoreService.getBonusHistory();
        actualBonusList = allBonuses.map((bonus: any) => ({
          ...bonus,
          year: Number(bonus['year']),
          month: Number(bonus['month']),
          employeeNumber: bonus['employeeNumber']
        }));
      }
      
      for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
        let targetYear = changeYear;
        let targetMonth = changeMonth + monthOffset;
        
        while (targetMonth > 12) {
          targetMonth -= 12;
          targetYear += 1;
        }
        
        const allSalaries = salaryHistory.filter((s: any) => s['employeeNumber'] === employeeNumber);
        
        const exactMonthSalary = allSalaries.find((s: any) => {
          const salaryYear = Number(s['year']);
          const salaryMonth = Number(s['month']);
          return salaryYear === targetYear && salaryMonth === targetMonth;
        });
        
        let monthlySalary = 0;
        if (exactMonthSalary) {
          monthlySalary = Number(exactMonthSalary['amount']);
        } else {
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
            monthlySalary = Number(newSalary);
          }
        }
        
        const rewardAddition = await this.calculateMonthlyRewardAddition(
          employeeNumber,
          targetYear,
          targetMonth,
          actualBonusList,
          targetYear,
          targetMonth
        );
        
        salariesForAverage.push(monthlySalary + rewardAddition);
      }
      
      // 平均を計算
      const averageSalary = salariesForAverage.reduce((sum, val) => sum + val, 0) / salariesForAverage.length;
      console.log(`[厚生年金随時改定] ---------- 3か月平均の計算 ----------`);
      console.log(`[厚生年金随時改定] 3か月の給与: ${salariesForAverage.map((s, i) => {
        let targetYear = changeYear;
        let targetMonth = changeMonth + i;
        while (targetMonth > 12) {
          targetMonth -= 12;
          targetYear += 1;
        }
        return `${targetYear}年${targetMonth}月: ${s}円`;
      }).join(', ')}`);
      console.log(`[厚生年金随時改定] 3か月の平均給与: ${averageSalary}円`);
      
      // 新しい厚生年金保険用標準報酬月額を計算
      const newPensionStandard = this.calculatePensionStandardMonthlySalary(averageSalary);
      console.log(`[厚生年金随時改定] 計算された新しい標準報酬月額: ${newPensionStandard}円`);
      if (!newPensionStandard || newPensionStandard === 0) {
        console.log(`[厚生年金随時改定] ❌ 新しい標準報酬月額が0または無効なため、処理を中断します`);
        if (collectChanges) return [];
        return null;
      }
      
      // 標準報酬月額から等級を逆引き
      const pensionGradeList = this.gradeTable.kouseinenkinReiwa7;
      const matchingNewGrade = pensionGradeList.find((item: any) => item.monthlyStandard === newPensionStandard);
      if (!matchingNewGrade) {
        console.log(`[厚生年金随時改定] ❌ 新しい標準報酬月額に対応する等級が見つかりませんでした`);
        if (collectChanges) return [];
        return null;
      }
      
      const newPensionGrade = matchingNewGrade.grade;
      
      console.log(`[厚生年金随時改定] ========== デバッグ情報 ==========`);
      console.log(`[厚生年金随時改定] 社員番号: ${employeeNumber}`);
      console.log(`[厚生年金随時改定] 変更年月: ${changeYear}年${changeMonth}月`);
      console.log(`[厚生年金随時改定] 前の等級: ${previousPensionGrade !== null ? previousPensionGrade : 'null（初回設定）'}`);
      console.log(`[厚生年金随時改定] 新しい等級: ${newPensionGrade}`);
      console.log(`[厚生年金随時改定] 前の標準報酬月額: ${pensionStandardChangeBeforeChange ? pensionStandardChangeBeforeChange.monthlyStandard : 'N/A'}`);
      console.log(`[厚生年金随時改定] 新しい標準報酬月額: ${newPensionStandard}`);
      console.log(`[厚生年金随時改定] 等級差: ${previousPensionGrade !== null ? Math.abs(newPensionGrade - previousPensionGrade) : 'N/A'}`);
      
      // 厚生年金等級の変更をログ出力
      if (previousPensionGrade !== null && previousPensionGrade !== newPensionGrade) {
        console.log(`[厚生年金等級変更] 前の等級: ${previousPensionGrade}等級 → 新しい等級: ${newPensionGrade}等級（等級差: ${Math.abs(newPensionGrade - previousPensionGrade)}）`);
      } else if (previousPensionGrade === null) {
        console.log(`[厚生年金等級変更] 前の等級が存在しないため、等級変更の判定は行いません（初回設定の可能性）`);
      } else {
        console.log(`[厚生年金等級変更] 等級に変更はありません（前の等級: ${previousPensionGrade}等級、新しい等級: ${newPensionGrade}等級）`);
      }
      
      // 随時改定を適用する条件：
      // 1. 等級差が2以上の場合（前の等級が存在する場合のみ）
      // 2. または、前の等級が2等級で新しい等級が1等級の場合（下限到達）- 1等級差でも改定
      // 3. または、前の等級が31等級で新しい等級が32等級の場合（上限到達）- 1等級差でも改定
      // 4. または、前の等級が1等級で新しい等級が2等級の場合（下限から離れる）- 1等級差でも改定
      // 5. または、前の等級が32等級で新しい等級が31等級の場合（上限から離れる）- 1等級差でも改定
      // 注意：上限・下限以外の1等級差の変更は随時改定を適用しない
      const gradeDifference = previousPensionGrade !== null ? Math.abs(newPensionGrade - previousPensionGrade) : 0;
      const isLowerBoundReached = previousPensionGrade !== null && previousPensionGrade === 2 && newPensionGrade === 1;
      const isUpperBoundReached = previousPensionGrade !== null && previousPensionGrade === 31 && newPensionGrade === 32;
      const isLowerBoundLeaving = previousPensionGrade !== null && previousPensionGrade === 1 && newPensionGrade === 2;
      const isUpperBoundLeaving = previousPensionGrade !== null && previousPensionGrade === 32 && newPensionGrade === 31;
      
      // 境界条件の判定（上限・下限の境界での改定かどうか）
      const isBoundaryCondition = isLowerBoundReached || isUpperBoundReached || isLowerBoundLeaving || isUpperBoundLeaving;
      
      console.log(`[厚生年金随時改定] ---------- 境界条件の判定 ----------`);
      console.log(`[厚生年金随時改定] isLowerBoundReached (2→1): ${isLowerBoundReached}`);
      console.log(`[厚生年金随時改定] isUpperBoundReached (31→32): ${isUpperBoundReached}`);
      console.log(`[厚生年金随時改定] isLowerBoundLeaving (1→2): ${isLowerBoundLeaving}`);
      console.log(`[厚生年金随時改定] isUpperBoundLeaving (32→31): ${isUpperBoundLeaving}`);
      console.log(`[厚生年金随時改定] isBoundaryCondition: ${isBoundaryCondition}`);
      console.log(`[厚生年金随時改定] gradeDifference >= 2: ${gradeDifference >= 2}`);
      console.log(`[厚生年金随時改定] previousPensionGrade !== null: ${previousPensionGrade !== null}`);
      
      // 随時改定を適用する条件：
      // - 等級差が2以上の場合（前の等級が存在する場合のみ）
      // - または、上限・下限の境界での改定（1等級差でも改定）
      //   ・前の等級が2等級で新しい等級が1等級の場合（下限到達）
      //   ・前の等級が31等級で新しい等級が32等級の場合（上限到達）
      //   ・前の等級が1等級で新しい等級が2等級の場合（下限から離れる）
      //   ・前の等級が32等級で新しい等級が31等級の場合（上限から離れる）
      // 注意：上限・下限の境界での改定は、前の等級が存在する場合のみ適用（1等級差でも改定）
      // 注意：上限・下限以外の1等級差の変更は随時改定を適用しない（バグ修正）
      // 注意：健康介護保険等級は変更しないため、社会保険料一覧表には健康介護保険等級に応じた標準報酬月額を表示する
      const shouldApplyRevision = previousPensionGrade !== null && (
        gradeDifference >= 2 || 
        isBoundaryCondition
      );
      
      console.log(`[厚生年金随時改定] ---------- 改定判定結果 ----------`);
      console.log(`[厚生年金随時改定] shouldApplyRevision: ${shouldApplyRevision}`);
      if (!shouldApplyRevision && previousPensionGrade !== null && gradeDifference === 1) {
        console.log(`[厚生年金随時改定] ⚠️ 等級差が1で上限・下限の境界条件に該当しないため、随時改定を適用しません（前の等級: ${previousPensionGrade}等級、新しい等級: ${newPensionGrade}等級）`);
      }
      console.log(`[厚生年金随時改定] ====================================`);
      
      if (shouldApplyRevision) {
        // 3か月後の年月を計算
        let effectiveYear = changeYear;
        let effectiveMonth = changeMonth + 3;
        while (effectiveMonth > 12) {
          effectiveMonth -= 12;
          effectiveYear += 1;
        }
        
        let reasonMessage = '';
        if (isLowerBoundReached) {
          reasonMessage = `等級の下限（1等級）に到達したため`;
        } else if (isUpperBoundReached) {
          reasonMessage = `等級の上限（32等級）に到達したため`;
        } else if (isLowerBoundLeaving) {
          reasonMessage = `等級の下限（1等級）から離れるため`;
        } else if (isUpperBoundLeaving) {
          reasonMessage = `等級の上限（32等級）から離れるため`;
        } else {
          reasonMessage = `等級差が2以上（${gradeDifference}等級）のため`;
        }
        
        console.log(`[厚生年金随時改定] ✅ 改定を適用します`);
        console.log(`[厚生年金随時改定] 理由: ${reasonMessage}`);
        console.log(`[厚生年金随時改定] 適用年月: ${effectiveYear}年${effectiveMonth}月`);
        console.log(`[厚生年金随時改定] 適用等級: ${newPensionGrade}等級（前の等級: ${previousPensionGrade}等級 → 新しい等級: ${newPensionGrade}等級）`);
        console.log(`[厚生年金随時改定] 適用標準報酬月額: ${newPensionStandard}円`);
        
        // 厚生年金保険用標準報酬月額変更情報を保存
        await this.firestoreService.savePensionStandardMonthlySalaryChange(
          employeeNumber,
          effectiveYear,
          effectiveMonth,
          newPensionGrade,
          newPensionStandard
        );
        
        console.log(`[厚生年金随時改定] ✅ 標準報酬月額変更情報を保存しました。`);
      } else {
        console.log(`[厚生年金随時改定] ❌ 改定を適用しません`);
        if (previousPensionGrade === null) {
          console.log(`[厚生年金随時改定] 理由: 前の等級が存在しないため（初回設定の可能性）`);
        } else if (gradeDifference === 1 && !isBoundaryCondition) {
          console.log(`[厚生年金随時改定] 理由: 等級差が1（${previousPensionGrade}等級 → ${newPensionGrade}等級）で上限・下限の境界条件に該当しないため、随時改定を適用しません`);
        } else if (gradeDifference < 2) {
          console.log(`[厚生年金随時改定] 理由: 等級差が2未満（${gradeDifference}等級）かつ上限・下限の境界条件に該当しないため`);
        } else {
          console.log(`[厚生年金随時改定] 理由: 不明（予期しない状態）`);
        }
      }
      
      console.log(`[厚生年金随時改定] 処理完了。社員番号: ${employeeNumber}, 変更年: ${changeYear}, 変更月: ${changeMonth}`);
      
      if (collectChanges) {
        return [];
      }
      return null;
    } catch (error) {
      console.error('Error checking pension standard monthly salary change:', error);
      // エラーが発生しても給与設定は保存されているので、処理を続行
      if (collectChanges) {
        return [];
      }
      return null;
    }
  }

  // 年度ごとの4月～6月の平均による標準報酬月額の変更を検出して処理（定時改定）
  async checkAndUpdateStandardMonthlySalaryByFiscalYear(
    employeeNumber: string,
    changeYear: number,
    changeMonth: number,
    salaryHistory: any[],
    collectChanges?: boolean  // trueの場合、変更情報を保存せずに返す
  ): Promise<Array<{employeeNumber: string, effectiveYear: number, effectiveMonth: number, grade: number, monthlyStandard: number}> | null> {
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
      
      console.log(`[定時改定] 給与設定履歴の件数: ${salaryHistory.length}`);
      const employeeSalaries = salaryHistory.filter((s: any) => s['employeeNumber'] === employeeNumber);
      console.log(`[定時改定] 社員番号 ${employeeNumber} の給与設定件数: ${employeeSalaries.length}`);
      const fiscalYearSalaries = employeeSalaries.filter((s: any) => {
        const salaryYear = Number(s['year']);
        return salaryYear === fiscalYear;
      });
      console.log(`[定時改定] ${fiscalYear}年度の給与設定件数: ${fiscalYearSalaries.length}`);
      if (fiscalYearSalaries.length > 0) {
        console.log(`[定時改定] ${fiscalYear}年度の給与設定一覧:`, fiscalYearSalaries.map((s: any) => ({
          year: s['year'],
          month: s['month'],
          amount: s['amount']
        })));
      }
      
      // 入社情報を取得（入社時の給与見込み額を使用するため）
      const employeeData = await this.firestoreService.getEmployeeData(employeeNumber);
      let hasAcquisitionDate = false;
      let acquisitionYear = 0;
      let acquisitionMonth = 0;
      if (employeeData && employeeData.socialInsuranceAcquisitionDate) {
        const acquisitionDate = new Date(employeeData.socialInsuranceAcquisitionDate);
        acquisitionYear = acquisitionDate.getFullYear();
        acquisitionMonth = acquisitionDate.getMonth() + 1;
        hasAcquisitionDate = true;
        console.log(`[定時改定] 入社月: ${acquisitionYear}年${acquisitionMonth}月`);
      }
      
      // 該当年度の4月～6月が入社月以降かチェック
      const canCalculateTeiji = hasAcquisitionDate && (
        fiscalYear > acquisitionYear || 
        (fiscalYear === acquisitionYear && 6 >= acquisitionMonth)
      );
      console.log(`[定時改定] 定時改定計算可能（入社月基準）: ${canCalculateTeiji ? 'はい' : 'いいえ'}`);
      
      // 6月の給与設定がなく、6月以降の給与設定もない場合、かつ現在の変更月が6月でない場合は処理しない
      // ただし、ページ読み込み時の一括計算の場合は、6月の給与設定がなくても処理を続行
      // （changeMonthが6月でない場合でも、6月以降の給与設定があれば処理を続行）
      console.log(`[定時改定] 条件チェック: hasJuneSalary=${hasJuneSalary}, hasAfterJuneSalary=${hasAfterJuneSalary}, changeMonth=${changeMonth}`);
      if (!hasJuneSalary && !hasAfterJuneSalary && changeMonth !== 6) {
        // ただし、6月以降の給与設定が将来的にある可能性があるため、4月、5月の給与設定があれば処理を続行
        const hasAprilOrMaySalary = salaryHistory.some((s: any) => {
          const salaryYear = Number(s['year']);
          const salaryMonth = Number(s['month']);
          return s['employeeNumber'] === employeeNumber && 
                 salaryYear === fiscalYear && 
                 (salaryMonth === 4 || salaryMonth === 5);
        });
        console.log(`[定時改定] 4月・5月の給与設定: ${hasAprilOrMaySalary ? 'あり' : 'なし'}`);
        
        // 4月・5月の給与設定がない場合でも、入社時の給与見込み額を使用できる場合は処理を続行
        if (!hasAprilOrMaySalary && !canCalculateTeiji) {
          console.log(`[定時改定] 6月の給与設定がなく、4月・5月の給与設定もなく、入社情報も不足のため、処理をスキップします。`);
          // collectChangesパラメータはこの関数にはないので、nullを返す
          return null;
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
        console.log(`[定時改定] ${fiscalYear}年度${month}月の給与を取得中...`);
        // 該当月の給与設定を取得
        const allSalaries = salaryHistory.filter((s: any) => s['employeeNumber'] === employeeNumber);
        console.log(`[定時改定] 社員番号 ${employeeNumber} の給与設定件数: ${allSalaries.length}`);
        
        // まず、該当月の給与設定を探す
        const exactMonthSalary = allSalaries.find((s: any) => {
          const salaryYear = Number(s['year']);
          const salaryMonth = Number(s['month']);
          return salaryYear === fiscalYear && salaryMonth === month;
        });
        console.log(`[定時改定] ${fiscalYear}年度${month}月の給与設定: ${exactMonthSalary ? 'あり' : 'なし'}`);
        
        let monthlySalary = 0;
        if (exactMonthSalary) {
          // 該当月に給与設定がある場合はそれを使用
          monthlySalary = Number(exactMonthSalary['amount']);
          console.log(`[定時改定] ${fiscalYear}年度${month}月の給与額: ${monthlySalary}円（該当月の給与設定）`);
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
          
          console.log(`[定時改定] ${fiscalYear}年度${month}月以前の給与設定件数: ${relevantSalaries.length}`);
          
          if (relevantSalaries.length > 0) {
            monthlySalary = Number(relevantSalaries[0]['amount']);
            const sourceYear = Number(relevantSalaries[0]['year']);
            const sourceMonth = Number(relevantSalaries[0]['month']);
            console.log(`[定時改定] ${fiscalYear}年度${month}月の給与額: ${monthlySalary}円（${sourceYear}年${sourceMonth}月の給与設定を使用）`);
            salaryDetails.push({ 
              month, 
              amount: monthlySalary, 
              source: `該当月以前の最新の給与設定（${sourceYear}年${sourceMonth}月）` 
            });
          } else {
            // 給与設定がない場合、入社時の給与見込み額から計算
            console.log(`[定時改定] ${fiscalYear}年度${month}月以前の給与設定がないため、入社時の給与見込み額を取得します。`);
            const employeeData = await this.firestoreService.getEmployeeData(employeeNumber);
            if (employeeData && employeeData.socialInsuranceAcquisitionDate) {
              const acquisitionDate = new Date(employeeData.socialInsuranceAcquisitionDate);
              const acquisitionYear = acquisitionDate.getFullYear();
              const acquisitionMonth = acquisitionDate.getMonth() + 1;
              
              // 該当月が入社月以降の場合、入社時の給与見込み額を使用
              const targetYear = fiscalYear;
              const targetMonth = month;
              if (targetYear > acquisitionYear || (targetYear === acquisitionYear && targetMonth >= acquisitionMonth)) {
                const expectedMonthlySalary = Number(employeeData.expectedMonthlySalary) || 0;
                const expectedMonthlySalaryInKind = Number(employeeData.expectedMonthlySalaryInKind) || 0;
                monthlySalary = expectedMonthlySalary + expectedMonthlySalaryInKind;
                console.log(`[定時改定] ${fiscalYear}年度${month}月の給与額: ${monthlySalary}円（入社時の給与見込み額を使用、入社月: ${acquisitionYear}年${acquisitionMonth}月）`);
                salaryDetails.push({ 
                  month, 
                  amount: monthlySalary, 
                  source: `入社時の給与見込み額（入社月: ${acquisitionYear}年${acquisitionMonth}月）` 
                });
              } else {
                console.log(`[定時改定] ${fiscalYear}年度${month}月は入社月（${acquisitionYear}年${acquisitionMonth}月）より前のため、給与額: 0円`);
                salaryDetails.push({ month, amount: 0, source: '入社月より前' });
              }
            } else {
              console.log(`[定時改定] ${fiscalYear}年度${month}月の給与額: 0円（給与設定なし、入社情報なし）`);
              salaryDetails.push({ month, amount: 0, source: '給与設定なし' });
            }
          }
        }
        
        // 報酬加算額を計算して加算
        console.log(`[定時改定] ${fiscalYear}年度${month}月の報酬加算額を計算中...`);
        const rewardAddition = await this.calculateMonthlyRewardAddition(
          employeeNumber,
          fiscalYear,
          month,
          bonusList
        );
        console.log(`[定時改定] ${fiscalYear}年度${month}月の報酬加算額: ${rewardAddition}円`);
        console.log(`[定時改定] ${fiscalYear}年度${month}月の合計（給与+報酬加算額）: ${monthlySalary + rewardAddition}円`);
        
        salariesForAverage.push(monthlySalary + rewardAddition);
      }
      
      // コンソールログ出力：計算に用いられた月の給与額
      console.log(`[定時改定] 社員番号: ${employeeNumber}, 年度: ${fiscalYear}年度`);
      console.log(`[定時改定] 計算に用いられた月の給与額:`, salaryDetails);
      
      // 4月～6月の給与が全て取得できたかチェック
      if (salariesForAverage.length < 3) {
        console.log(`[定時改定] 4月～6月の給与が全て取得できませんでした。取得できた給与数: ${salariesForAverage.length}`);
        if (collectChanges) return [];
        return null; // 4月～6月の給与が全て取得できない場合は処理しない
      }
      
      // 平均を計算
      const averageSalary = salariesForAverage.reduce((sum, val) => sum + val, 0) / salariesForAverage.length;
      
      // コンソールログ出力：計算された平均給与
      console.log(`[定時改定] 計算された平均給与: ${averageSalary}円`);
      
      // 平均が有効な数値でない場合は処理しない
      if (isNaN(averageSalary) || averageSalary <= 0) {
        console.log(`[定時改定] 平均給与が無効な値です: ${averageSalary}`);
        if (collectChanges) return [];
        return null;
      }
      
      // 新しい標準報酬月額を計算
      const newStandardInfo = this.calculateStandardMonthlySalary(averageSalary);
      if (!newStandardInfo) {
        console.log(`[定時改定] 標準報酬月額の計算に失敗しました。平均給与: ${averageSalary}円`);
        if (collectChanges) return [];
        return null;
      }
      
      const newGrade = newStandardInfo.grade;
      console.log(`[定時改定] 算出された等級: ${newGrade}, 標準報酬月額: ${newStandardInfo.monthlyStandard}円`);
      
      // 7月、8月に標準報酬月額変更情報が適用されているかチェック
      // 随時改定は、給与変更月から3か月後に適用されるため、
      // 7,8月に適用される随時改定は、4,5月の給与変更によるもの
      // 7月または8月に変更情報が存在する場合、定時改定をスキップ
      // 注意: 9月の変更情報は定時改定によって作成される可能性があるため、7月・8月のみをチェック
      const changesInJulyToAugust = await this.firestoreService.getStandardMonthlySalaryChangesInPeriod(
        employeeNumber,
        fiscalYear,
        7,
        fiscalYear,
        8
      );
      
      console.log(`[定時改定] 7月、8月の変更情報チェック: 取得件数=${changesInJulyToAugust ? changesInJulyToAugust.length : 0}`);
      if (changesInJulyToAugust && changesInJulyToAugust.length > 0) {
        console.log(`[定時改定] 7月、8月に標準報酬月額変更情報が適用されているため、定時改定をスキップします。`);
        console.log(`[定時改定] 検出された変更情報（生データ）:`, changesInJulyToAugust);
        console.log(`[定時改定] 検出された変更情報:`, changesInJulyToAugust.map((c: any) => ({
          適用年月: `${c.effectiveYear}年${c.effectiveMonth}月`,
          等級: c.grade,
          標準報酬月額: c.monthlyStandard
        })));
        console.log(`[定時改定] 定時改定をスキップして処理を終了します。`);
        if (collectChanges) return [];
        return null;
      } else {
        console.log(`[定時改定] 7月、8月に標準報酬月額変更情報は存在しません。定時改定を続行します。`);
      }
      
      // 既に9月からの標準報酬月額変更情報が保存されているかチェック
      const existingChange = await this.firestoreService.getStandardMonthlySalaryChange(
        employeeNumber,
        fiscalYear,
        9
      );
      
      // 9月の変更情報が存在する場合、それが随時改定によるものかどうかを確認
      // 6月の給与変更がある場合、9月に随時改定が適用される可能性がある
      if (existingChange) {
        // 6月の手動給与変更があるかどうかを確認（isManual = true のもののみ）
        const hasJuneManualSalaryChange = salaryHistory.some((s: any) => {
          const salaryYear = Number(s['year']);
          const salaryMonth = Number(s['month']);
          return s['employeeNumber'] === employeeNumber &&
                 salaryYear === fiscalYear &&
                 salaryMonth === 6 &&
                 s['isManual'] === true;
        });
        
        console.log(`[定時改定] 6月の手動給与変更チェック: ${hasJuneManualSalaryChange ? 'あり' : 'なし'}`);
        
        if (hasJuneManualSalaryChange) {
          // 6月の手動給与変更がある場合、9月の変更情報は随時改定によるものと判断
          console.log(`[定時改定] 6月の手動給与変更があるため、9月の変更情報は随時改定によるものと判断します。定時改定をスキップします。`);
          console.log(`[定時改定] 既存の9月の変更情報: 等級${existingChange.grade}, 標準報酬月額${existingChange.monthlyStandard}円`);
          if (collectChanges) return [];
          return null;
        }
        
        // 6月の給与変更がない場合、既に9月からの変更情報がある場合、等級が異なる場合のみ更新
        if (existingChange.grade === newGrade) {
          console.log(`[定時改定] 既に同じ等級（${newGrade}）が設定されているため、処理をスキップします。`);
          if (collectChanges) return [];
          return null; // 既に同じ等級が設定されている場合は処理しない
        }
      }
      
      // 9月から新等級を適用（4.5.6月の平均給与から算出した等級）
      const effectiveYear = fiscalYear;
      const effectiveMonth = 9;
      
      console.log(`[定時改定] 9月から等級${newGrade}を適用します。標準報酬月額: ${newStandardInfo.monthlyStandard}円`);
      
      // 変更情報を返すモードの場合、保存せずに変更情報を返す
      if (collectChanges) {
        return [{
          employeeNumber,
          effectiveYear,
          effectiveMonth,
          grade: newGrade,
          monthlyStandard: newStandardInfo.monthlyStandard
        }];
      }
      
      // 標準報酬月額変更情報を保存
      await this.firestoreService.saveStandardMonthlySalaryChange(
        employeeNumber,
        effectiveYear,
        effectiveMonth,
        newGrade,
        newStandardInfo.monthlyStandard
      );
      
      console.log(`[定時改定] 標準報酬月額変更情報を保存しました。`);
      
      return null;
    } catch (error) {
      console.error('Error checking standard monthly salary change by fiscal year:', error);
      // エラーが発生しても給与設定は保存されているので、処理を続行
      if (collectChanges) {
        return [];
      }
      return null;
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
        for (let fiscalYear = 2025; fiscalYear <= 2028; fiscalYear++) {
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
    
    // 社員の入社日を取得して、入社月以降の賞与しか設定できないようにする
    try {
      const employeeData = await this.firestoreService.getEmployeeData(this.selectedBonusEmployee);
      if (employeeData && employeeData.socialInsuranceAcquisitionDate) {
        const acquisitionDate = new Date(employeeData.socialInsuranceAcquisitionDate);
        const acquisitionYear = acquisitionDate.getFullYear();
        const acquisitionMonth = acquisitionDate.getMonth() + 1;
        
        // 選択された年月が入社月より前の場合はエラー
        if (this.bonusYear < acquisitionYear || (this.bonusYear === acquisitionYear && this.bonusMonth < acquisitionMonth)) {
          alert(`入社月（${acquisitionYear}年${acquisitionMonth}月）以降の賞与しか設定できません。`);
          return;
        }
      }
    } catch (error) {
      console.error('Error getting employee data:', error);
      // エラーが発生しても処理は続行（入社日が取得できない場合のフォールバック）
    }
    
    // 設定年月が2028年12月を超えている場合はエラー
    if (this.bonusYear > 2028 || (this.bonusYear === 2028 && this.bonusMonth > 12)) {
      alert('賞与設定は2028年12月までしか設定できません。');
      this.isSavingBonus = false;
      return;
    }
    
    // その社員の最新の賞与設定年月を取得
    const employeeBonuses = this.bonusHistory.filter((b: any) => 
      b['employeeNumber'] === this.selectedBonusEmployee
    );
    
    if (employeeBonuses.length > 0) {
      // 最新の賞与設定年月を取得
      const latestBonus = employeeBonuses.sort((a: any, b: any) => {
        const aYear = Number(a['year']);
        const bYear = Number(b['year']);
        const aMonth = Number(a['month']);
        const bMonth = Number(b['month']);
        if (aYear !== bYear) return bYear - aYear;
        return bMonth - aMonth;
      })[0];
      
      const latestYear = Number(latestBonus['year']);
      const latestMonth = Number(latestBonus['month']);
      
      // 新しい設定年月が最新の設定年月より過去の場合はエラー
      if (this.bonusYear < latestYear || (this.bonusYear === latestYear && this.bonusMonth < latestMonth)) {
        alert(`最新の情報より過去の年月の賞与は設定できません。\n最新の賞与設定: ${latestYear}年${latestMonth}月`);
        return;
      }
    }
    
    this.isSavingBonus = true;
    
    // ブラウザ更新を防止
    this.setBeforeUnloadHandler();
    
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
      
        // 年4回以上の賞与は常に報酬加算額として計算するため、賞与支給月を給与変更月として随時改定処理を行う
        // その年度の賞与支給回数を確認
        const bonusFiscalYear = this.bonusMonth >= 7 ? this.bonusYear : this.bonusYear - 1;
        console.log(`[賞与設定] 賞与支給年度: ${bonusFiscalYear}年度（${this.bonusYear}年${this.bonusMonth}月）`);
        
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
        console.log(`[賞与設定] 年度賞与支給回数: ${fiscalYearBonusCount}回`);
        console.log(`[賞与設定] 年度内の賞与一覧:`, fiscalYearBonuses.map((b: any) => ({
          year: b['year'],
          month: b['month'],
          amount: b['amount']
        })));
        
        // 賞与支給回数が4回以上になった場合、随時改定処理を行う
        if (fiscalYearBonusCount >= 4) {
          console.log(`[賞与設定] 年度賞与支給回数が4回以上（${fiscalYearBonusCount}回）になったため、随時改定処理を実行します。`);
          
          // 給与設定履歴を取得（随時改定の計算に必要）
          const allSalaryHistory = await this.firestoreService.getAllSalaryHistory();
          console.log(`[賞与設定] 給与設定履歴を取得しました。件数: ${allSalaryHistory.length}`);
          
          // その社員のすべての随時改定を再計算（報酬加算額が変更されたため）
          await this.recalculateAllZujijiKaitei(
            this.selectedBonusEmployee,
            allSalaryHistory
          );
          
          // 賞与支給月を給与変更月として随時改定処理を行う
          // 賞与支給月に給与設定がない場合、その月以前の最新の給与設定を使用
          const allSalaries = allSalaryHistory.filter((s: any) => s['employeeNumber'] === this.selectedBonusEmployee);
          
          // 賞与支給月の給与設定を探す
          const exactMonthSalary = allSalaries.find((s: any) => {
            const salaryYear = Number(s['year']);
            const salaryMonth = Number(s['month']);
            return salaryYear === this.bonusYear && salaryMonth === this.bonusMonth;
          });
          
          let salaryAmount = 0;
          if (exactMonthSalary) {
            // 賞与支給月に給与設定がある場合はそれを使用
            salaryAmount = Number(exactMonthSalary['amount']);
            console.log(`[賞与設定] 賞与支給月（${this.bonusYear}年${this.bonusMonth}月）に給与設定があります。給与額: ${salaryAmount}円`);
          } else {
            // 賞与支給月に給与設定がない場合は、その月以前の最新の給与設定を取得
            const relevantSalaries = allSalaries
              .filter((s: any) => {
                const salaryYear = Number(s['year']);
                const salaryMonth = Number(s['month']);
                if (salaryYear < this.bonusYear) return true;
                if (salaryYear === this.bonusYear && salaryMonth < this.bonusMonth) return true;
                return false;
              })
              .sort((a: any, b: any) => {
                if (a['year'] !== b['year']) return b['year'] - a['year'];
                return b['month'] - a['month'];
              });
            
            if (relevantSalaries.length > 0) {
              salaryAmount = Number(relevantSalaries[0]['amount']);
              const sourceYear = Number(relevantSalaries[0]['year']);
              const sourceMonth = Number(relevantSalaries[0]['month']);
              console.log(`[賞与設定] 賞与支給月（${this.bonusYear}年${this.bonusMonth}月）に給与設定がないため、${sourceYear}年${sourceMonth}月の給与設定（${salaryAmount}円）を使用します。`);
            } else {
              // 給与設定がない場合、入社時の給与見込み額から計算（給与と現物の合計）
              const employeeData = await this.firestoreService.getEmployeeData(this.selectedBonusEmployee);
              if (employeeData) {
                const expectedMonthlySalary = Number(employeeData.expectedMonthlySalary) || 0;
                const expectedMonthlySalaryInKind = Number(employeeData.expectedMonthlySalaryInKind) || 0;
                salaryAmount = expectedMonthlySalary + expectedMonthlySalaryInKind;
                console.log(`[賞与設定] 給与設定がないため、入社時の給与見込み額（給与: ${expectedMonthlySalary}円 + 現物: ${expectedMonthlySalaryInKind}円 = 合計: ${salaryAmount}円）を使用します。`);
              }
            }
          }
          
          // 賞与支給月を給与変更月として随時改定処理を行う
          // 賞与支給月の時点での賞与のみを考慮（asOfYear, asOfMonthを指定）
          console.log(`[賞与設定] 賞与支給月（${this.bonusYear}年${this.bonusMonth}月）を給与変更月として随時改定処理を実行します。`);
          
          // 賞与一覧を取得
          const allBonuses = await this.firestoreService.getBonusHistory();
          const bonusList = allBonuses.map((bonus: any) => ({
            ...bonus,
            year: Number(bonus['year']),
            month: Number(bonus['month']),
            employeeNumber: bonus['employeeNumber']
          }));
          
          // すべての標準報酬月額変更情報を蓄積
          const allStandardChanges: Array<{employeeNumber: string, effectiveYear: number, effectiveMonth: number, grade: number, monthlyStandard: number}> = [];
          const allPensionChanges: Array<{employeeNumber: string, effectiveYear: number, effectiveMonth: number, grade: number, monthlyStandard: number}> = [];
          
          // 随時改定処理（変更情報を収集）
          const standardChanges = await this.checkAndUpdateStandardMonthlySalary(
            this.selectedBonusEmployee,
            this.bonusYear,
            this.bonusMonth,
            salaryAmount,
            allSalaryHistory,
            bonusList,
            this.bonusYear,
            this.bonusMonth,
            true  // collectChanges = true
          );
          
          if (standardChanges) {
            // 健康介護保険と厚生年金保険の変更情報を分離（gradeで判定）
            standardChanges.forEach((change: any) => {
              // 健康介護保険の変更情報（gradeが1-50の範囲）
              if (change.grade >= 1 && change.grade <= 50) {
                allStandardChanges.push(change);
              } else {
                // 厚生年金保険の変更情報（gradeが1-32の範囲）
                allPensionChanges.push(change);
              }
            });
          }
          
          // 定時改定処理も実行（報酬加算額が考慮されるため、4月～6月の平均給与が変わる可能性がある）
          // 定時改定は、各年度の4月～6月の平均給与に基づいて9月から適用される
          // 報酬加算額が変更された場合、その影響は複数の年度に及ぶ可能性があるため、全年度の定時改定を再計算する
          console.log(`[賞与設定] 報酬加算額が変更されたため、全年度の定時改定処理を実行します。`);
          
          // 2025年度から2028年度までの各年度について定時改定を実行
          for (let fiscalYear = 2025; fiscalYear <= 2028; fiscalYear++) {
            console.log(`[賞与設定] ${fiscalYear}年度の定時改定処理を実行します。`);
            console.log(`[賞与設定] 給与設定履歴の件数: ${allSalaryHistory.length}`);
            
            // 該当社員の給与設定をフィルタリング
            const employeeSalaries = allSalaryHistory.filter((s: any) => 
              s['employeeNumber'] === this.selectedBonusEmployee
            );
            console.log(`[賞与設定] 社員番号 ${this.selectedBonusEmployee} の給与設定件数: ${employeeSalaries.length}`);
            
            // 該当年度の給与設定をフィルタリング
            const fiscalYearSalaries = employeeSalaries.filter((s: any) => {
              const salaryYear = Number(s['year']);
              return salaryYear === fiscalYear;
            });
            console.log(`[賞与設定] ${fiscalYear}年度の給与設定件数: ${fiscalYearSalaries.length}`);
            if (fiscalYearSalaries.length > 0) {
              console.log(`[賞与設定] ${fiscalYear}年度の給与設定一覧:`, fiscalYearSalaries.map((s: any) => ({
                year: s['year'],
                month: s['month'],
                amount: s['amount']
              })));
            }
            
            // 6月の給与設定が完了しているかチェック
            const hasJuneSalary = allSalaryHistory.some((s: any) => {
              const salaryYear = Number(s['year']);
              const salaryMonth = Number(s['month']);
              return s['employeeNumber'] === this.selectedBonusEmployee && 
                     salaryYear === fiscalYear && 
                     salaryMonth === 6;
            });
            console.log(`[賞与設定] ${fiscalYear}年度 - 6月の給与設定: ${hasJuneSalary ? 'あり' : 'なし'}`);
            
            // 6月以降の給与設定があるかチェック
            const hasAfterJuneSalary = allSalaryHistory.some((s: any) => {
              const salaryYear = Number(s['year']);
              const salaryMonth = Number(s['month']);
              return s['employeeNumber'] === this.selectedBonusEmployee && 
                     salaryYear === fiscalYear && 
                     salaryMonth > 6;
            });
            console.log(`[賞与設定] ${fiscalYear}年度 - 6月以降の給与設定: ${hasAfterJuneSalary ? 'あり' : 'なし'}`);
            
            // 入社情報を取得（入社時の給与見込み額を使用するため）
            const employeeData = await this.firestoreService.getEmployeeData(this.selectedBonusEmployee);
            let hasAcquisitionDate = false;
            let acquisitionYear = 0;
            let acquisitionMonth = 0;
            if (employeeData && employeeData.socialInsuranceAcquisitionDate) {
              const acquisitionDate = new Date(employeeData.socialInsuranceAcquisitionDate);
              acquisitionYear = acquisitionDate.getFullYear();
              acquisitionMonth = acquisitionDate.getMonth() + 1;
              hasAcquisitionDate = true;
              console.log(`[賞与設定] ${fiscalYear}年度 - 入社月: ${acquisitionYear}年${acquisitionMonth}月`);
            }
            
            // 該当年度の4月～6月が入社月以降かチェック
            const canCalculateTeiji = hasAcquisitionDate && (
              fiscalYear > acquisitionYear || 
              (fiscalYear === acquisitionYear && 6 >= acquisitionMonth)
            );
            console.log(`[賞与設定] ${fiscalYear}年度 - 定時改定計算可能: ${canCalculateTeiji ? 'はい' : 'いいえ'}`);
            
            // 6月の給与設定があるか、6月以降の給与設定がある場合、定時改定を計算
            if (hasJuneSalary || hasAfterJuneSalary) {
              // 6月の給与設定がある場合は6月として、ない場合は7月として処理
              const checkMonth = hasJuneSalary ? 6 : 7;
              console.log(`[賞与設定] ${fiscalYear}年度 - 定時改定処理を実行します（checkMonth: ${checkMonth}月）`);
              const teijiChanges = await this.checkAndUpdateStandardMonthlySalaryByFiscalYear(
                this.selectedBonusEmployee,
                fiscalYear,
                checkMonth,
                allSalaryHistory,
                true  // collectChanges = true
              );
              if (teijiChanges) {
                allStandardChanges.push(...teijiChanges);
              }
            } else {
              // 4月、5月の給与設定があるかチェック
              const hasAprilOrMaySalary = allSalaryHistory.some((s: any) => {
                const salaryYear = Number(s['year']);
                const salaryMonth = Number(s['month']);
                return s['employeeNumber'] === this.selectedBonusEmployee && 
                       salaryYear === fiscalYear && 
                       (salaryMonth === 4 || salaryMonth === 5);
              });
              console.log(`[賞与設定] ${fiscalYear}年度 - 4月・5月の給与設定: ${hasAprilOrMaySalary ? 'あり' : 'なし'}`);
              
              // 4月、5月の給与設定がある場合、または入社時の給与見込み額を使用できる場合、定時改定を計算
              if (hasAprilOrMaySalary || canCalculateTeiji) {
                console.log(`[賞与設定] ${fiscalYear}年度 - 定時改定処理を実行します（${hasAprilOrMaySalary ? '4月・5月の給与設定あり' : '入社時の給与見込み額を使用'}）`);
                const teijiChanges = await this.checkAndUpdateStandardMonthlySalaryByFiscalYear(
                  this.selectedBonusEmployee,
                  fiscalYear,
                  6, // 6月として処理
                  allSalaryHistory,
                  true  // collectChanges = true
                );
                if (teijiChanges) {
                  allStandardChanges.push(...teijiChanges);
                }
              } else {
                console.log(`[賞与設定] ${fiscalYear}年度 - 定時改定処理をスキップします（給与設定が不足、かつ入社情報が不足）`);
              }
            }
          }
          
          console.log(`[賞与設定] 全年度の定時改定処理が完了しました。`);
          
          // すべての標準報酬月額変更情報を一度にバッチ書き込みで保存
          if (allStandardChanges.length > 0 || allPensionChanges.length > 0) {
            console.log(`[賞与設定] 標準報酬月額変更情報をバッチ保存します。健康介護保険: ${allStandardChanges.length}件、厚生年金保険: ${allPensionChanges.length}件`);
            
            try {
              // 健康介護保険と厚生年金保険の変更情報を並列で保存
              await Promise.all([
                allStandardChanges.length > 0 ? this.firestoreService.saveStandardMonthlySalaryChangesBatch(allStandardChanges) : Promise.resolve(),
                allPensionChanges.length > 0 ? this.firestoreService.savePensionStandardMonthlySalaryChangesBatch(allPensionChanges) : Promise.resolve()
              ]);
              
              console.log(`[賞与設定] 標準報酬月額変更情報をバッチ保存しました。`);
            } catch (error) {
              console.error('[賞与設定] 標準報酬月額変更情報のバッチ保存に失敗しました:', error);
              throw new Error(`標準報酬月額変更情報の保存に失敗しました。賞与設定は保存されましたが、標準報酬月額変更情報は保存されませんでした。`);
            }
          }
        } else {
          console.log(`[賞与設定] 年度賞与支給回数が4回未満（${fiscalYearBonusCount}回）のため、随時改定処理をスキップします。`);
        }
      
      // 保険料一覧を再フィルタリング
      await this.filterInsuranceListByDate();
      
      alert('賞与を設定しました');
      
      // フォームをリセット
      this.selectedBonusEmployee = '';
      this.bonusAmount = 0;
    } catch (error: any) {
      console.error('Error saving bonus:', error);
      const errorMessage = error?.message || '賞与の設定に失敗しました';
      
      // エラーメッセージを表示
      if (errorMessage.includes('一部のみ保存')) {
        alert(`賞与設定の保存中にエラーが発生しました。\n\n${errorMessage}\n\nページを更新して、保存された賞与設定を確認してください。`);
      } else {
        alert(`賞与の設定に失敗しました。\n\n${errorMessage}`);
      }
    } finally {
      this.isSavingBonus = false;
      
      // ブラウザ更新防止を解除（給与設定が処理中でない場合のみ）
      if (!this.isSavingSalary) {
        this.removeBeforeUnloadHandler();
      }
    }
  }

  // ブラウザ更新を防止するハンドラーを設定
  private setBeforeUnloadHandler(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // 既にハンドラーが設定されている場合はスキップ
    if (this.beforeUnloadHandler) return;
    
    this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (this.isSavingSalary || this.isSavingBonus) {
        e.preventDefault();
        e.returnValue = '給与設定または賞与設定の処理中です。ページを離れると処理が中断される可能性があります。';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  // ブラウザ更新を防止するハンドラーを削除
  private removeBeforeUnloadHandler(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
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
        // フィルターで選択されている年月を取得
        const filterYear = Number(this.insuranceListYear);
        const filterMonth = Number(this.insuranceListMonth);
        
        // 年齢を計算（フィルター年月での年齢）
        let age: number | null = null;
        let birthDate: Date | null = null;
        if (employeeData.birthDate) {
          birthDate = employeeData.birthDate instanceof Date 
            ? employeeData.birthDate 
            : (employeeData.birthDate.toDate ? employeeData.birthDate.toDate() : new Date(employeeData.birthDate));
          
          // フィルター年月での年齢を計算（calculateAgeAtDateメソッドを使用）
          if (birthDate && !isNaN(birthDate.getTime())) {
            age = this.calculateAgeAtDate(birthDate, filterYear, filterMonth);
          }
        }
        
        // 保険料一覧から健康介護保険等級を取得
        let healthNursingGrade: number | null = null;
        const insuranceItem = this.filteredInsuranceList.find((item: any) => item.employeeNumber === employeeNumber);
        
        // 固定的賃金を計算
        const expectedMonthlySalary = Number(employeeData.expectedMonthlySalary) || 0;
        const expectedMonthlySalaryInKind = Number(employeeData.expectedMonthlySalaryInKind) || 0;
        const fixedSalary = expectedMonthlySalary + expectedMonthlySalaryInKind;
        
        // 給与設定履歴から、フィルターで選択されている年月以前の最新の給与を取得
        const relevantSalaries = this.salaryHistory
          .filter((s: any) => s['employeeNumber'] === employeeNumber)
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
        const finalFixedSalary = latestSalary ? latestSalary['amount'] : fixedSalary;
        
        // 健康介護保険の標準報酬月額を計算
        let healthNursingStandardMonthlySalary = 0;
        if (insuranceItem && insuranceItem.standardMonthlySalary) {
          healthNursingStandardMonthlySalary = insuranceItem.standardMonthlySalary;
          healthNursingGrade = insuranceItem.grade;
        } else {
          // 保険料一覧にない場合は、固定的賃金から計算
          const standardSalaryInfo = this.calculateStandardMonthlySalary(finalFixedSalary);
          healthNursingStandardMonthlySalary = standardSalaryInfo ? standardSalaryInfo.monthlyStandard : 0;
          healthNursingGrade = standardSalaryInfo ? standardSalaryInfo.grade : null;
        }
        
        // 健康介護保険の標準報酬月額変更情報を取得
        const standardChange = await this.firestoreService.getStandardMonthlySalaryChange(
          employeeNumber,
          filterYear,
          filterMonth
        );
        
        // 標準報酬月額変更が適用されているかチェック（適用月以降の場合のみ）
        if (standardChange) {
          const effectiveYear = Number(standardChange.effectiveYear);
          const effectiveMonth = Number(standardChange.effectiveMonth);
          
          // 選択された年月が適用月以降の場合のみ変更を適用
          if (filterYear > effectiveYear || 
              (filterYear === effectiveYear && filterMonth >= effectiveMonth)) {
            // 標準報酬月額変更情報がある場合は、その標準報酬月額を使用
            // ただし、等級表の最大値を超えている場合は、等級表の最大値に制限
            let changeStandard = standardChange.monthlyStandard;
            const maxHealthStandard = this.getMaxHealthStandardMonthlySalary();
            if (changeStandard > maxHealthStandard) {
              changeStandard = maxHealthStandard;
              // 等級も再計算
              const maxStandardInfo = this.calculateStandardMonthlySalary(maxHealthStandard);
              if (maxStandardInfo) {
                healthNursingGrade = maxStandardInfo.grade;
              } else {
                healthNursingGrade = standardChange.grade;
              }
            } else {
              healthNursingGrade = standardChange.grade;
            }
            healthNursingStandardMonthlySalary = changeStandard;
          }
        }
        
        // 厚生年金保険等級を計算
        let pensionGrade: number | null = null;
        
        // まず、厚生年金保険用の標準報酬月額変更情報を取得（フィルターで選択されている年月に応じた情報）
        const pensionStandardChange = await this.firestoreService.getPensionStandardMonthlySalaryChange(
          employeeNumber,
          filterYear,
          filterMonth
        );
        
        let pensionStandardMonthlySalary = 0;
        
        // 厚生年金保険用の標準報酬月額変更が適用されているかチェック（適用月以降の場合のみ）
        if (pensionStandardChange) {
          const effectiveYear = Number(pensionStandardChange.effectiveYear);
          const effectiveMonth = Number(pensionStandardChange.effectiveMonth);
          
          // 選択された年月が適用月以降の場合のみ変更を適用
          if (filterYear > effectiveYear || 
              (filterYear === effectiveYear && filterMonth >= effectiveMonth)) {
            // 標準報酬月額変更情報がある場合は、その標準報酬月額と等級を使用
            // ただし、等級表の最大値を超えている場合は、等級表の最大値に制限
            let changeStandard = pensionStandardChange.monthlyStandard;
            const maxPensionStandard = this.getMaxPensionStandardMonthlySalary();
            if (changeStandard > maxPensionStandard) {
              changeStandard = maxPensionStandard;
              // 等級も再計算
              pensionGrade = null; // 等級を再計算するためnullに設定
            } else {
              pensionGrade = pensionStandardChange.grade;
            }
            pensionStandardMonthlySalary = changeStandard;
          } else {
            // 適用月以前の場合は、健康介護保険の標準報酬月額を基準に計算
            pensionStandardMonthlySalary = this.calculatePensionStandardMonthlySalaryFromStandard(healthNursingStandardMonthlySalary);
          }
        } else {
          // 標準報酬月額変更情報がない場合は、健康介護保険の標準報酬月額を基準に計算
          // 社会保険一覧表に表示されている標準報酬月額（健康介護保険の標準報酬月額）を基準に厚生年金保険の標準報酬月額を計算
          pensionStandardMonthlySalary = this.calculatePensionStandardMonthlySalaryFromStandard(healthNursingStandardMonthlySalary);
        }
        
        // 標準報酬月額から等級を逆引き（等級がまだ取得できていない場合）
        if (pensionGrade === null && this.gradeTable && this.gradeTable.kouseinenkinReiwa7) {
          const pensionGradeList = this.gradeTable.kouseinenkinReiwa7;
          // 完全一致を探す（複数の等級が同じmonthlyStandardを持つ場合、等級番号が大きいものを優先）
          const matchingGrades = pensionGradeList.filter((item: any) => item.monthlyStandard === pensionStandardMonthlySalary);
          
          let matchingGrade: any = null;
          if (matchingGrades.length > 0) {
            // 等級番号が大きい（より新しい）等級を優先
            matchingGrade = matchingGrades.reduce((prev: any, current: any) => 
              (current.grade > prev.grade) ? current : prev
            );
          } else {
            // 完全一致が見つからない場合、最も近い値を探す（±1円の範囲内）
            const nearMatchingGrades = pensionGradeList.filter((item: any) => 
              Math.abs(item.monthlyStandard - pensionStandardMonthlySalary) <= 1
            );
            if (nearMatchingGrades.length > 0) {
              // 等級番号が大きい（より新しい）等級を優先
              matchingGrade = nearMatchingGrades.reduce((prev: any, current: any) => 
                (current.grade > prev.grade) ? current : prev
              );
            }
          }
          
          pensionGrade = matchingGrade ? matchingGrade.grade : null;
        }
        
        // 年度報酬加算額を計算（その年の7月から翌年6月までの賞与合計額を12で割った額）
        
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
        
        // 年度報酬加算額（賞与支給回数が4回以上の場合のみ算出）
        let annualRewardAddition = 0;
        if (fiscalYearBonusCount >= 4) {
          // 年度内の賞与合計額を計算
          const fiscalYearTotalBonus = fiscalYearBonuses.reduce((sum: number, b: any) => {
            return sum + Number(b['amount']);
          }, 0);
          
          // 年度報酬加算額（賞与合計額を12で割った額）
          annualRewardAddition = fiscalYearTotalBonus / 12;
        }
        
        this.selectedEmployeeInfo = {
          ...employeeData,
          age: age, // フィルター年月での年齢
          grade: healthNursingGrade, // 健康介護保険等級（後方互換性のため残す）
          healthNursingGrade: healthNursingGrade, // 健康介護保険等級
          pensionGrade: pensionGrade, // 厚生年金保険等級
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

