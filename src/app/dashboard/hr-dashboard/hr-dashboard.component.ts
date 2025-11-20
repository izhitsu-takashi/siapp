import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormArray, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './hr-dashboard.component.html',
  styleUrl: './hr-dashboard.component.css'
})
export class HrDashboardComponent {
  currentTab: string = 'メインページ';
  
  tabs = [
    { id: 'main', name: 'メインページ' },
    { id: 'employee-management', name: '社員情報管理' }
  ];

  // サンプルデータ（実際の実装では認証サービスから取得）
  hrName = '人事 花子';

  // 社員一覧
  employees: Employee[] = [];
  showAddModal = false;
  addEmployeeForm: FormGroup;
  employmentTypes = ['正社員', '契約社員', 'パート', 'アルバイト', '派遣社員'];

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private firestoreService: FirestoreService
  ) {
    this.addEmployeeForm = this.fb.group({
      employees: this.fb.array([this.createEmployeeFormGroup()])
    });
    this.loadEmployees();
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
}


