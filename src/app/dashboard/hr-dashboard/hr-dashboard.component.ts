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
    { id: 'social-insurance', name: '社会保険料' }
  ];

  // サンプルデータ（実際の実装では認証サービスから取得）
  hrName = '人事 花子';

  // 社員一覧
  employees: Employee[] = [];
  
  // 社会保険料一覧データ
  insuranceList: any[] = [];
  
  // 等級テーブルデータ
  gradeTable: any = null;
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
    this.loadEmployees();
    this.loadGradeTable();
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
    // 社会保険料タブが選択された場合、データを読み込む
    if (tabName === '社会保険料') {
      this.loadInsuranceList().catch(err => {
        console.error('Error in loadInsuranceList:', err);
      });
    }
  }
  
  // 社会保険料一覧を読み込む
  async loadInsuranceList() {
    try {
      // 全社員データを取得
      const allEmployees = await this.firestoreService.getAllEmployees();
      
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
            
            return {
              employeeNumber: emp.employeeNumber || '',
              name: emp.name || '',
              fixedSalary: fixedSalary,
              grade: grade,
              standardMonthlySalary: standardMonthlySalary,
              healthInsurance: 0, // 健康保険料（計算ロジック未実装）
              nursingInsurance: 0, // 介護保険料（計算ロジック未実装）
              pensionInsurance: 0, // 厚生年金保険料（計算ロジック未実装）
              personalBurden: 0 // 個人負担額（計算ロジック未実装）
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

  // トラッキング関数（パフォーマンス向上）
  trackByEmployeeNumber(index: number, item: any): string {
    return item.employeeNumber || index.toString();
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
    } catch (error) {
      console.error('Error loading employees:', error);
      this.employees = [];
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


