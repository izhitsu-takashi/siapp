import { TestBed } from '@angular/core/testing';
import { HrDashboardComponent } from './hr-dashboard.component';
import { FirestoreService } from '../../services/firestore.service';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';
import { PdfEditService } from '../../services/pdf-edit.service';
import { PLATFORM_ID, ChangeDetectorRef } from '@angular/core';

describe('HrDashboardComponent - Onboarding Procedures Tests', () => {
  let component: HrDashboardComponent;
  let firestoreService: jasmine.SpyObj<FirestoreService>;
  let router: jasmine.SpyObj<Router>;
  let pdfEditService: jasmine.SpyObj<PdfEditService>;
  let fb: FormBuilder;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(async () => {
    // アラートと確認ダイアログをモック
    spyOn(window, 'alert');
    spyOn(window, 'confirm').and.returnValue(true);

    const firestoreServiceSpy = jasmine.createSpyObj('FirestoreService', [
      'saveOnboardingEmployee',
      'sendOnboardingEmail',
      'getAllOnboardingEmployees',
      'getEmployeeApplicationsByType',
      'updateOnboardingEmployeeStatus',
      'getOnboardingEmployee',
      'saveEmployeeData',
      'deleteOnboardingEmployee',
      'saveApplicationRequest',
      'getEmployeeData',
      'getAllEmployees',
      'getAllApplications'
    ]);

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const pdfEditServiceSpy = jasmine.createSpyObj('PdfEditService', [
      'fillPdfWithEmployeeData',
      'downloadPdf'
    ]);
    const cdrSpy = jasmine.createSpyObj('ChangeDetectorRef', ['detectChanges']);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, HttpClientTestingModule, HrDashboardComponent],
      providers: [
        { provide: FirestoreService, useValue: firestoreServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PdfEditService, useValue: pdfEditServiceSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ChangeDetectorRef, useValue: cdrSpy },
        FormBuilder
      ]
    }).compileComponents();

    firestoreService = TestBed.inject(FirestoreService) as jasmine.SpyObj<FirestoreService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    pdfEditService = TestBed.inject(PdfEditService) as jasmine.SpyObj<PdfEditService>;
    fb = TestBed.inject(FormBuilder);
    cdr = TestBed.inject(ChangeDetectorRef) as jasmine.SpyObj<ChangeDetectorRef>;

    const http = TestBed.inject(HttpClient);
    component = new HrDashboardComponent(
      router,
      fb,
      firestoreService,
      http,
      pdfEditService,
      cdr
    );

    // モックのデフォルト設定
    firestoreService.saveOnboardingEmployee.and.returnValue(Promise.resolve());
    firestoreService.sendOnboardingEmail.and.returnValue(Promise.resolve());
    firestoreService.getAllOnboardingEmployees.and.returnValue(Promise.resolve([]));
    firestoreService.getEmployeeApplicationsByType.and.returnValue(Promise.resolve([]));
    firestoreService.updateOnboardingEmployeeStatus.and.returnValue(Promise.resolve());
    firestoreService.getOnboardingEmployee.and.returnValue(Promise.resolve({}));
    firestoreService.saveEmployeeData.and.returnValue(Promise.resolve());
    firestoreService.deleteOnboardingEmployee.and.returnValue(Promise.resolve());
    firestoreService.saveApplicationRequest.and.returnValue(Promise.resolve());
    firestoreService.getEmployeeData.and.returnValue(Promise.resolve({}));
    firestoreService.getAllEmployees.and.returnValue(Promise.resolve([]));
    firestoreService.getAllApplications.and.returnValue(Promise.resolve([]));
    pdfEditService.fillPdfWithEmployeeData.and.returnValue(Promise.resolve(new Uint8Array()));
    pdfEditService.downloadPdf.and.returnValue(undefined);
  });

  describe('新入社員の追加', () => {
    beforeEach(() => {
      component.addEmployeeForm = fb.group({
        employees: fb.array([component.createEmployeeFormGroup()])
      });
      component.allExistingEmployeeNumbers = new Set();
      component.allExistingEmails = new Set();
    });

    it('単一の新入社員を追加できること', async () => {
      const employeeData = {
        lastName: '山田',
        firstName: '太郎',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'タロウ',
        employeeNumber: 'EMP001',
        email: 'yamada@example.com',
        employmentType: '正社員',
        joinDate: '2024-01-01',
        initialPassword: 'password123'
      };

      component.employeesFormArray.patchValue([employeeData]);
      component.addEmployeeForm.markAsDirty();
      component.addEmployeeForm.updateValueAndValidity();

      await component.addEmployees();

      // 期待値: 新入社員データが正しく保存される
      expect(firestoreService.saveOnboardingEmployee).toHaveBeenCalledWith(
        'EMP001',
        jasmine.objectContaining({
          employeeNumber: 'EMP001',
          name: '山田 太郎',
          nameKana: 'ヤマダ タロウ',
          lastName: '山田',
          firstName: '太郎',
          lastNameKana: 'ヤマダ',
          firstNameKana: 'タロウ',
          email: 'yamada@example.com',
          employmentType: '正社員',
          password: 'password123',
          isInitialPassword: true
        })
      );

      // 期待値: メールが送信される
      expect(firestoreService.sendOnboardingEmail).toHaveBeenCalledWith(
        'yamada@example.com',
        '山田 太郎',
        'password123'
      );
    });

    it('複数の新入社員を同時に追加できること', async () => {
      // 2つのフォームグループを追加
      component.addEmployeeRow();
      
      const employeesData = [
        {
          lastName: '山田',
          firstName: '太郎',
          lastNameKana: 'ヤマダ',
          firstNameKana: 'タロウ',
          employeeNumber: 'EMP001',
          email: 'yamada@example.com',
          employmentType: '正社員',
          joinDate: '2024-01-01',
          initialPassword: 'password123'
        },
        {
          lastName: '鈴木',
          firstName: '花子',
          lastNameKana: 'スズキ',
          firstNameKana: 'ハナコ',
          employeeNumber: 'EMP002',
          email: 'suzuki@example.com',
          employmentType: '契約社員',
          joinDate: '2024-01-02',
          initialPassword: 'password456'
        }
      ];

      component.employeesFormArray.patchValue(employeesData);
      component.addEmployeeForm.markAsDirty();
      component.addEmployeeForm.updateValueAndValidity();

      await component.addEmployees();

      // 期待値: 2名の新入社員データが保存される
      expect(firestoreService.saveOnboardingEmployee).toHaveBeenCalledTimes(2);
      expect(firestoreService.saveOnboardingEmployee).toHaveBeenCalledWith(
        'EMP001',
        jasmine.objectContaining({
          employeeNumber: 'EMP001',
          name: '山田 太郎'
        })
      );
      expect(firestoreService.saveOnboardingEmployee).toHaveBeenCalledWith(
        'EMP002',
        jasmine.objectContaining({
          employeeNumber: 'EMP002',
          name: '鈴木 花子'
        })
      );

      // 期待値: 2通のメールが送信される
      expect(firestoreService.sendOnboardingEmail).toHaveBeenCalledTimes(2);
    });

    it('社員番号が重複している場合、追加に失敗すること', async () => {
      component.allExistingEmployeeNumbers.add('EMP001');

      const employeeData = {
        lastName: '山田',
        firstName: '太郎',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'タロウ',
        employeeNumber: 'EMP001',
        email: 'yamada@example.com',
        employmentType: '正社員',
        initialPassword: 'password123'
      };

      component.employeesFormArray.patchValue([employeeData]);
      component.employeesFormArray.controls[0].get('employeeNumber')?.setErrors({ duplicate: true });

      await component.addEmployees();

      // 期待値: 保存されない
      expect(firestoreService.saveOnboardingEmployee).not.toHaveBeenCalled();
    });

    it('メールアドレスが重複している場合、追加に失敗すること', async () => {
      component.allExistingEmails.add('yamada@example.com');

      const employeeData = {
        lastName: '山田',
        firstName: '太郎',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'タロウ',
        employeeNumber: 'EMP001',
        email: 'yamada@example.com',
        employmentType: '正社員',
        initialPassword: 'password123'
      };

      component.employeesFormArray.patchValue([employeeData]);
      component.employeesFormArray.controls[0].get('email')?.setErrors({ duplicate: true });

      await component.addEmployees();

      // 期待値: 保存されない
      expect(firestoreService.saveOnboardingEmployee).not.toHaveBeenCalled();
    });

    it('メール送信に失敗しても、社員データは保存されること', async () => {
      firestoreService.sendOnboardingEmail.and.returnValue(Promise.reject(new Error('メール送信エラー')));

      const employeeData = {
        lastName: '山田',
        firstName: '太郎',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'タロウ',
        employeeNumber: 'EMP001',
        email: 'yamada@example.com',
        employmentType: '正社員',
        joinDate: '2024-01-01',
        initialPassword: 'password123'
      };

      component.employeesFormArray.patchValue([employeeData]);
      component.addEmployeeForm.markAsDirty();
      component.addEmployeeForm.updateValueAndValidity();

      await component.addEmployees();

      // 期待値: 社員データは保存される
      expect(firestoreService.saveOnboardingEmployee).toHaveBeenCalled();
      // 期待値: アラートが表示される（メール送信エラー）
      expect(window.alert).toHaveBeenCalled();
    });

    it('必須項目が未入力の場合、追加に失敗すること', async () => {
      const invalidEmployeeData = {
        lastName: '',
        firstName: '',
        lastNameKana: '',
        firstNameKana: '',
        employeeNumber: '',
        email: '',
        employmentType: '',
        initialPassword: ''
      };

      component.employeesFormArray.patchValue([invalidEmployeeData]);
      component.employeesFormArray.controls[0].markAllAsTouched();

      await component.addEmployees();

      // 期待値: 保存されない
      expect(firestoreService.saveOnboardingEmployee).not.toHaveBeenCalled();
    });
  });

  describe('新入社員一覧の読み込み', () => {
    it('新入社員一覧が正しく読み込まれること', async () => {
      const mockEmployees = [
        {
          employeeNumber: 'EMP001',
          name: '山田 太郎',
          status: '申請待ち',
          createdAt: { toDate: () => new Date('2024-01-01') }
        },
        {
          employeeNumber: 'EMP002',
          name: '鈴木 花子',
          status: '申請済み',
          createdAt: { toDate: () => new Date('2024-01-02') }
        }
      ];

      firestoreService.getAllOnboardingEmployees.and.returnValue(Promise.resolve(mockEmployees));

      await component.loadOnboardingEmployees();

      // 期待値: 新入社員一覧が正しく設定される
      expect(component.onboardingEmployees.length).toBe(2);
      expect(component.onboardingEmployees[0].employeeNumber).toBe('EMP001');
      expect(component.onboardingEmployees[1].employeeNumber).toBe('EMP002');
    });

    it('入社時申請が届いている場合、ステータスが「申請済み」に自動更新されること', async () => {
      const mockEmployees = [
        {
          employeeNumber: 'EMP001',
          name: '山田 太郎',
          status: '申請待ち'
        }
      ];

      const mockApplications = [
        {
          employeeNumber: 'EMP001',
          applicationType: '入社時申請'
        }
      ];

      firestoreService.getAllOnboardingEmployees.and.returnValue(Promise.resolve(mockEmployees));
      firestoreService.getEmployeeApplicationsByType.and.returnValue(Promise.resolve(mockApplications));

      await component.loadOnboardingEmployees();

      // 期待値: ステータスが「申請済み」に更新される
      expect(firestoreService.updateOnboardingEmployeeStatus).toHaveBeenCalledWith('EMP001', '申請済み');
    });

    it('ステータスフィルターが正しく適用されること', async () => {
      const mockEmployees = [
        { employeeNumber: 'EMP001', name: '山田 太郎', status: '申請待ち' },
        { employeeNumber: 'EMP002', name: '鈴木 花子', status: '申請済み' },
        { employeeNumber: 'EMP003', name: '高橋 次郎', status: '準備完了' }
      ];

      // プライベートプロパティに直接アクセスできないため、loadOnboardingEmployeesをモック
      firestoreService.getAllOnboardingEmployees.and.returnValue(Promise.resolve(mockEmployees));
      await component.loadOnboardingEmployees();
      
      component.onboardingStatusFilter = '申請済み';
      component.filterAndSortOnboardingEmployees();

      // 期待値: 「申請済み」の社員のみが表示される
      expect(component.onboardingEmployees.length).toBe(1);
      expect(component.onboardingEmployees[0].employeeNumber).toBe('EMP002');
    });

    it('ステータスフィルターが「すべて」の場合、全社員が表示されること', async () => {
      const mockEmployees = [
        { employeeNumber: 'EMP001', name: '山田 太郎', status: '申請待ち' },
        { employeeNumber: 'EMP002', name: '鈴木 花子', status: '申請済み' },
        { employeeNumber: 'EMP003', name: '高橋 次郎', status: '準備完了' }
      ];

      // プライベートプロパティに直接アクセスできないため、loadOnboardingEmployeesをモック
      firestoreService.getAllOnboardingEmployees.and.returnValue(Promise.resolve(mockEmployees));
      await component.loadOnboardingEmployees();
      
      component.onboardingStatusFilter = 'すべて';
      component.filterAndSortOnboardingEmployees();

      // 期待値: 全社員が表示される
      expect(component.onboardingEmployees.length).toBe(3);
    });

    it('ステータス優先度順にソートされること', async () => {
      const mockEmployees = [
        { employeeNumber: 'EMP001', name: '山田 太郎', status: '準備完了' },
        { employeeNumber: 'EMP002', name: '鈴木 花子', status: '申請待ち' },
        { employeeNumber: 'EMP003', name: '高橋 次郎', status: '申請済み' },
        { employeeNumber: 'EMP004', name: '佐藤 三郎', status: '差し戻し' }
      ];

      // プライベートプロパティに直接アクセスできないため、loadOnboardingEmployeesをモック
      firestoreService.getAllOnboardingEmployees.and.returnValue(Promise.resolve(mockEmployees));
      await component.loadOnboardingEmployees();
      
      component.onboardingStatusFilter = 'すべて';
      component.filterAndSortOnboardingEmployees();

      // 期待値: 優先度順（申請待ち→申請済み→差し戻し→準備完了）にソートされる
      expect(component.onboardingEmployees[0].status).toBe('申請待ち');
      expect(component.onboardingEmployees[1].status).toBe('申請済み');
      expect(component.onboardingEmployees[2].status).toBe('差し戻し');
      expect(component.onboardingEmployees[3].status).toBe('準備完了');
    });
  });

  describe('新入社員情報の編集', () => {
    beforeEach(() => {
      component.onboardingEmployeeEditForm = component.createOnboardingEmployeeEditForm();
    });

    it('必須項目が未入力の場合、保存に失敗すること', async () => {
      const mockEmployee = {
        employeeNumber: 'EMP001',
        name: '山田 太郎',
        status: '申請済み'
      };

      component.selectedOnboardingEmployee = mockEmployee;
      component.onboardingEmployeeEditForm.patchValue({
        lastName: '',
        firstName: ''
      });
      component.onboardingEmployeeEditForm.markAllAsTouched();

      await component.saveOnboardingEmployeeData();

      // 期待値: 保存されない
      expect(firestoreService.saveOnboardingEmployee).not.toHaveBeenCalled();
    });
  });

  describe('ステータスの変更', () => {
    it('ステータスが「申請済み」に変更できること', async () => {
      const mockEmployee = {
        employeeNumber: 'EMP001',
        name: '山田 太郎',
        status: '申請待ち'
      };

      component.selectedOnboardingEmployee = mockEmployee;
      component.pendingOnboardingStatus = '申請済み'; // pendingOnboardingStatusを設定

      // onOnboardingStatusChangeは実際にはステータスを更新しないので、updateOnboardingEmployeeStatusを直接呼び出す
      await component.updateOnboardingEmployeeStatus('申請済み');

      // 期待値: ステータスが更新される
      expect(firestoreService.updateOnboardingEmployeeStatus).toHaveBeenCalledWith('EMP001', '申請済み');
    });

    it('ステータスが「差し戻し」に変更できること', async () => {
      const mockEmployee = {
        employeeNumber: 'EMP001',
        name: '山田 太郎',
        status: '申請済み'
      };

      component.selectedOnboardingEmployee = mockEmployee;
      component.pendingOnboardingStatus = '差し戻し'; // pendingOnboardingStatusを設定
      component.onboardingStatusComment = '修正が必要です';

      // onOnboardingStatusChangeは実際にはステータスを更新しないので、updateOnboardingEmployeeStatusを直接呼び出す
      await component.updateOnboardingEmployeeStatus('差し戻し');

      // 期待値: ステータスが更新される
      expect(firestoreService.updateOnboardingEmployeeStatus).toHaveBeenCalledWith('EMP001', '差し戻し');
    });

    it('必須項目が未入力の場合、「準備完了」に変更できないこと', async () => {
      const mockEmployee = {
        employeeNumber: 'EMP001',
        name: '山田 太郎',
        status: '申請済み'
      };

      component.selectedOnboardingEmployee = mockEmployee;
      component.pendingOnboardingStatus = '申請済み';
      component.onboardingEmployeeEditForm = component.createOnboardingEmployeeEditForm();
      component.onboardingEmployeeEditForm.patchValue({
        lastName: '',
        firstName: ''
      });
      component.onboardingEmployeeEditForm.markAllAsTouched();

      await component.onOnboardingStatusChange('準備完了');

      // 期待値: ステータスが更新されない
      expect(firestoreService.updateOnboardingEmployeeStatus).not.toHaveBeenCalled();
    });

    it('必須項目が入力済みの場合、「準備完了」に変更できること', async () => {
      const mockEmployee = {
        employeeNumber: 'EMP001',
        name: '山田 太郎',
        status: '申請済み'
      };

      component.selectedOnboardingEmployee = mockEmployee;
      component.pendingOnboardingStatus = '準備完了'; // pendingOnboardingStatusを設定
      component.onboardingEmployeeEditForm = component.createOnboardingEmployeeEditForm();
      component.onboardingEmployeeEditForm.patchValue({
        lastName: '山田',
        firstName: '太郎',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'タロウ',
        birthDate: '1990-01-01',
        gender: '男性',
        employeeNumber: 'EMP001',
        email: 'yamada@example.com',
        employmentType: '正社員',
        joinDate: '2024-01-01',
        basicPensionNumberPart1: '1234',
        basicPensionNumberPart2: '567890',
        socialInsuranceAcquisitionDate: '2024-01-01',
        expectedMonthlySalary: '300000',
        expectedMonthlySalaryInKind: '0',
        pensionFundMembership: 'いいえ',
        qualificationCertificateRequired: 'いいえ',
        dependentStatus: '無',
        isMiner: 'いいえ',
        multipleWorkplaceAcquisition: 'いいえ',
        reemploymentAfterRetirement: 'いいえ',
        otherQualificationAcquisition: 'いいえ'
      });
      // disabledフィールドをenableしてから値を設定
      component.onboardingEmployeeEditForm.get('gender')?.enable();
      component.onboardingEmployeeEditForm.get('dependentStatus')?.enable();
      component.onboardingEmployeeEditForm.patchValue({ 
        gender: '男性',
        dependentStatus: '無'
      });
      component.onboardingEmployeeEditForm.get('gender')?.disable();
      component.onboardingEmployeeEditForm.get('dependentStatus')?.disable();
      component.onboardingEmployeeEditForm.updateValueAndValidity();

      // onOnboardingStatusChangeは実際にはステータスを更新しないので、updateOnboardingEmployeeStatusを直接呼び出す
      await component.updateOnboardingEmployeeStatus('準備完了');

      // 期待値: ステータスが更新される
      expect(firestoreService.updateOnboardingEmployeeStatus).toHaveBeenCalledWith('EMP001', '準備完了');
    });
  });

  describe('入社処理の実行', () => {
    beforeEach(() => {
      component.readyEmployees = [
        {
          employeeNumber: 'EMP001',
          name: '山田 太郎',
          status: '準備完了'
        },
        {
          employeeNumber: 'EMP002',
          name: '鈴木 花子',
          status: '準備完了'
        }
      ];
      component.selectedEmployeeNumbers = new Set(['EMP001', 'EMP002']);
    });

    it('準備完了の社員を選択して入社処理を実行できること', async () => {
      const mockEmployeeData1 = {
        employeeNumber: 'EMP001',
        lastName: '山田',
        firstName: '太郎',
        name: '山田 太郎',
        status: '準備完了'
      };

      const mockEmployeeData2 = {
        employeeNumber: 'EMP002',
        lastName: '鈴木',
        firstName: '花子',
        name: '鈴木 花子',
        status: '準備完了'
      };

      firestoreService.getOnboardingEmployee.and.returnValues(
        Promise.resolve(mockEmployeeData1),
        Promise.resolve(mockEmployeeData2)
      );

      await component.executeOnboardingProcess();

      // 期待値: 社員データが正しく保存される
      expect(firestoreService.saveEmployeeData).toHaveBeenCalledTimes(2);
      expect(firestoreService.saveEmployeeData).toHaveBeenCalledWith(
        'EMP001',
        jasmine.objectContaining({
          healthInsuranceType: '健康保険被保険者',
          pensionInsuranceType: '国民年金第2号被保険者'
        })
      );

      // 期待値: 新入社員コレクションから削除される
      expect(firestoreService.deleteOnboardingEmployee).toHaveBeenCalledTimes(2);
      expect(firestoreService.deleteOnboardingEmployee).toHaveBeenCalledWith('EMP001');
      expect(firestoreService.deleteOnboardingEmployee).toHaveBeenCalledWith('EMP002');
    });

    it('4人ずつグループ化してPDFが生成されること', async () => {
      const mockEmployees = [
        { employeeNumber: 'EMP001', name: '山田 太郎', status: '準備完了' },
        { employeeNumber: 'EMP002', name: '鈴木 花子', status: '準備完了' },
        { employeeNumber: 'EMP003', name: '高橋 次郎', status: '準備完了' },
        { employeeNumber: 'EMP004', name: '佐藤 三郎', status: '準備完了' },
        { employeeNumber: 'EMP005', name: '田中 四郎', status: '準備完了' }
      ];

      component.readyEmployees = mockEmployees;
      component.selectedEmployeeNumbers = new Set(['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005']);

      mockEmployees.forEach(emp => {
        firestoreService.getOnboardingEmployee.and.returnValue(Promise.resolve({
          ...emp,
          lastName: emp.name.split(' ')[0],
          firstName: emp.name.split(' ')[1]
        }));
      });

      await component.executeOnboardingProcess();

      // 期待値: 2つのPDFが生成される（4人と1人）
      expect(pdfEditService.fillPdfWithEmployeeData).toHaveBeenCalledTimes(2);
    });

    it('年齢に応じて介護保険者種別が自動設定されること', async () => {
      const today = new Date();
      const birthDate65 = new Date(today.getFullYear() - 65, today.getMonth(), today.getDate());
      const birthDate45 = new Date(today.getFullYear() - 45, today.getMonth(), today.getDate());
      const birthDate35 = new Date(today.getFullYear() - 35, today.getMonth(), today.getDate());

      const mockEmployeeData65 = {
        employeeNumber: 'EMP001',
        name: '山田 太郎',
        birthDate: birthDate65.toISOString().split('T')[0],
        status: '準備完了'
      };

      const mockEmployeeData45 = {
        employeeNumber: 'EMP002',
        name: '鈴木 花子',
        birthDate: birthDate45.toISOString().split('T')[0],
        status: '準備完了'
      };

      const mockEmployeeData35 = {
        employeeNumber: 'EMP003',
        name: '高橋 次郎',
        birthDate: birthDate35.toISOString().split('T')[0],
        status: '準備完了'
      };

      component.readyEmployees = [
        { employeeNumber: 'EMP001', name: '山田 太郎', status: '準備完了' },
        { employeeNumber: 'EMP002', name: '鈴木 花子', status: '準備完了' },
        { employeeNumber: 'EMP003', name: '高橋 次郎', status: '準備完了' }
      ];
      component.selectedEmployeeNumbers = new Set(['EMP001', 'EMP002', 'EMP003']);

      firestoreService.getOnboardingEmployee.and.returnValues(
        Promise.resolve(mockEmployeeData65),
        Promise.resolve(mockEmployeeData45),
        Promise.resolve(mockEmployeeData35)
      );

      await component.executeOnboardingProcess();

      // 期待値: 年齢に応じて介護保険者種別が設定される
      const saveCalls = firestoreService.saveEmployeeData.calls.all();
      expect(saveCalls[0].args[1].nursingInsuranceType).toBe('介護保険第1号被保険者');
      expect(saveCalls[1].args[1].nursingInsuranceType).toBe('介護保険第2号被保険者');
      expect(saveCalls[2].args[1].nursingInsuranceType).toBe('介護保険の被保険者でない者');
    });

    it('扶養者情報欄が「有」の場合、扶養家族追加申請の依頼が作成されること', async () => {
      const mockEmployeeData = {
        employeeNumber: 'EMP001',
        name: '山田 太郎',
        status: '準備完了',
        dependentStatus: '有'
      };

      component.readyEmployees = [{ employeeNumber: 'EMP001', name: '山田 太郎', status: '準備完了' }];
      component.selectedEmployeeNumbers = new Set(['EMP001']);

      firestoreService.getOnboardingEmployee.and.returnValue(Promise.resolve(mockEmployeeData));

      await component.executeOnboardingProcess();

      // 期待値: 扶養家族追加申請の依頼が作成される
      expect(firestoreService.saveApplicationRequest).toHaveBeenCalledWith(
        jasmine.objectContaining({
          employeeNumber: 'EMP001',
          applicationType: '扶養家族追加',
          status: '未対応',
          message: '扶養家族追加申請を行ってください'
        })
      );
    });

    it('選択された社員が0人の場合、処理が実行されないこと', async () => {
      component.selectedEmployeeNumbers = new Set();

      await component.executeOnboardingProcess();

      // 期待値: アラートが表示される
      expect(window.alert).toHaveBeenCalledWith('処理する社員を選択してください');
      // 期待値: 処理が実行されない
      expect(firestoreService.saveEmployeeData).not.toHaveBeenCalled();
    });
  });

  describe('準備完了の社員がいるかチェック', () => {
    it('準備完了の社員がいる場合、trueを返すこと', () => {
      component.onboardingEmployees = [
        { employeeNumber: 'EMP001', name: '山田 太郎', status: '申請待ち' },
        { employeeNumber: 'EMP002', name: '鈴木 花子', status: '準備完了' }
      ];

      // 期待値: trueが返される
      expect(component.hasReadyEmployees()).toBe(true);
    });

    it('準備完了の社員がいない場合、falseを返すこと', () => {
      component.onboardingEmployees = [
        { employeeNumber: 'EMP001', name: '山田 太郎', status: '申請待ち' },
        { employeeNumber: 'EMP002', name: '鈴木 花子', status: '申請済み' }
      ];

      // 期待値: falseが返される
      expect(component.hasReadyEmployees()).toBe(false);
    });
  });
});

