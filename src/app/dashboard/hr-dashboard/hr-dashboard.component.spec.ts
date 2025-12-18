import { TestBed } from '@angular/core/testing';
import { HrDashboardComponent } from './hr-dashboard.component';
import { FirestoreService } from '../../services/firestore.service';
import { PdfEditService } from '../../services/pdf-edit.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';

describe('HrDashboardComponent - 海外在住チェックによるフォーム表示統一性テスト', () => {
  let component: HrDashboardComponent;
  let firestoreService: jasmine.SpyObj<FirestoreService>;
  let pdfEditService: jasmine.SpyObj<PdfEditService>;
  let httpClient: jasmine.SpyObj<HttpClient>;
  let router: jasmine.SpyObj<Router>;
  let formBuilder: FormBuilder;
  let changeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(async () => {
    const firestoreServiceSpy = jasmine.createSpyObj('FirestoreService', [
      'getAllEmployees',
      'getAllOnboardingEmployees',
      'getEmployeeData',
      'saveEmployeeData',
      'updateApplicationStatus',
      'getEmployeeApplications',
      'updateEmployeeResignation',
      'updateEmployeeAddress',
      'updateEmployeeName',
      'updateEmployeeMyNumber',
      'removeDependentFromEmployee',
      'loadInsuranceCards'
    ]);

    const pdfEditServiceSpy = jasmine.createSpyObj('PdfEditService', [
      'generatePdf',
      'editPdf'
    ]);

    const httpClientSpy = jasmine.createSpyObj('HttpClient', ['get', 'post']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const changeDetectorRefSpy = jasmine.createSpyObj('ChangeDetectorRef', ['detectChanges', 'markForCheck']);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: FirestoreService, useValue: firestoreServiceSpy },
        { provide: PdfEditService, useValue: pdfEditServiceSpy },
        { provide: HttpClient, useValue: httpClientSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ChangeDetectorRef, useValue: changeDetectorRefSpy },
        FormBuilder
      ]
    }).compileComponents();

    firestoreService = TestBed.inject(FirestoreService) as jasmine.SpyObj<FirestoreService>;
    pdfEditService = TestBed.inject(PdfEditService) as jasmine.SpyObj<PdfEditService>;
    httpClient = TestBed.inject(HttpClient) as jasmine.SpyObj<HttpClient>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    formBuilder = TestBed.inject(FormBuilder);
    changeDetectorRef = TestBed.inject(ChangeDetectorRef) as jasmine.SpyObj<ChangeDetectorRef>;

    component = new HrDashboardComponent(
      router,
      formBuilder,
      firestoreService,
      httpClient,
      pdfEditService,
      changeDetectorRef
    );
  });

  describe('isOverseasResidentチェックによるフォーム表示統一性', () => {
    beforeEach(() => {
      // モーダルを開く状態をシミュレート
      component.showEmployeeEditModal = true;
      component.selectedEmployeeNumber = 'EMP001';
    });

    it('isOverseasResidentがfalseの場合、国内住所フィールドが必須で、海外住所は必須ではない', async () => {
      // 国内在住の社員データ
      const domesticEmployeeData = {
        employeeNumber: 'EMP001',
        name: '国内在住テスト',
        isOverseasResident: false,
        postalCode: '1234567',
        currentAddress: '東京都新宿区テスト1-2-3',
        currentAddressKana: 'トウキョウトシンジュククテスト1-2-3',
        overseasAddress: ''
      };

      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(domesticEmployeeData));
      firestoreService.getEmployeeApplications.and.returnValue(Promise.resolve([]));

      // データを読み込む
      await component.loadEmployeeData('EMP001');

      // フォームの値を確認
      expect(component.employeeEditForm.get('isOverseasResident')?.value).toBe(false);
      expect(component.employeeEditForm.get('postalCode')?.value).toBe('1234567');
      expect(component.employeeEditForm.get('currentAddress')?.value).toBe('東京都新宿区テスト1-2-3');
      expect(component.employeeEditForm.get('currentAddressKana')?.value).toBe('トウキョウトシンジュククテスト1-2-3');
      expect(component.employeeEditForm.get('overseasAddress')?.value).toBe('');

      // バリデーションを確認
      const postalCodeControl = component.employeeEditForm.get('postalCode');
      const currentAddressControl = component.employeeEditForm.get('currentAddress');
      const currentAddressKanaControl = component.employeeEditForm.get('currentAddressKana');
      const overseasAddressControl = component.employeeEditForm.get('overseasAddress');

      // 国内在住の場合：国内住所は必須、海外住所は必須ではない
      expect(currentAddressControl?.hasError('required')).toBeFalsy(); // 値が入っているのでエラーなし
      expect(currentAddressKanaControl?.hasError('required')).toBeFalsy(); // 値が入っているのでエラーなし
      expect(overseasAddressControl?.hasError('required')).toBeFalsy(); // 必須ではない

      // 値をクリアして必須チェック
      currentAddressControl?.setValue('');
      currentAddressKanaControl?.setValue('');
      currentAddressControl?.updateValueAndValidity();
      currentAddressKanaControl?.updateValueAndValidity();

      expect(currentAddressControl?.hasError('required')).toBe(true);
      expect(currentAddressKanaControl?.hasError('required')).toBe(true);
    });

    it('isOverseasResidentがtrueの場合、海外住所が必須で、国内住所フィールドは必須ではない', async () => {
      // 海外在住の社員データ
      const overseasEmployeeData = {
        employeeNumber: 'EMP002',
        name: '海外在住テスト',
        isOverseasResident: true,
        postalCode: '',
        currentAddress: '',
        currentAddressKana: '',
        overseasAddress: '123 Main Street, New York, NY 10001, USA'
      };

      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(overseasEmployeeData));
      firestoreService.getEmployeeApplications.and.returnValue(Promise.resolve([]));

      // データを読み込む
      await component.loadEmployeeData('EMP002');

      // フォームの値を確認
      expect(component.employeeEditForm.get('isOverseasResident')?.value).toBe(true);
      expect(component.employeeEditForm.get('postalCode')?.value).toBe('');
      expect(component.employeeEditForm.get('currentAddress')?.value).toBe('');
      expect(component.employeeEditForm.get('currentAddressKana')?.value).toBe('');
      expect(component.employeeEditForm.get('overseasAddress')?.value).toBe('123 Main Street, New York, NY 10001, USA');

      // バリデーションを確認
      const postalCodeControl = component.employeeEditForm.get('postalCode');
      const currentAddressControl = component.employeeEditForm.get('currentAddress');
      const currentAddressKanaControl = component.employeeEditForm.get('currentAddressKana');
      const overseasAddressControl = component.employeeEditForm.get('overseasAddress');

      // 海外在住の場合：海外住所は必須、国内住所は必須ではない
      expect(overseasAddressControl?.hasError('required')).toBeFalsy(); // 値が入っているのでエラーなし
      expect(currentAddressControl?.hasError('required')).toBeFalsy(); // 必須ではない
      expect(currentAddressKanaControl?.hasError('required')).toBeFalsy(); // 必須ではない
      expect(postalCodeControl?.hasError('required')).toBeFalsy(); // 必須ではない

      // 海外住所をクリアして必須チェック
      overseasAddressControl?.setValue('');
      overseasAddressControl?.updateValueAndValidity();

      expect(overseasAddressControl?.hasError('required')).toBe(true);
    });

    it('isOverseasResidentがundefinedでもoverseasAddressに値がある場合、isOverseasResidentがtrueに推論される', async () => {
      // overseasAddressに値があるが、isOverseasResidentがundefinedのデータ
      const employeeDataWithOverseasAddress = {
        employeeNumber: 'EMP003',
        name: '推論テスト',
        isOverseasResident: undefined,
        postalCode: '',
        currentAddress: '',
        currentAddressKana: '',
        overseasAddress: '456 Oak Avenue, Los Angeles, CA 90001, USA'
      };

      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(employeeDataWithOverseasAddress));
      firestoreService.getEmployeeApplications.and.returnValue(Promise.resolve([]));

      // データを読み込む
      await component.loadEmployeeData('EMP003');

      // isOverseasResidentがtrueに推論されていることを確認
      expect(component.employeeEditForm.get('isOverseasResident')?.value).toBe(true);
      expect(component.employeeEditForm.get('overseasAddress')?.value).toBe('456 Oak Avenue, Los Angeles, CA 90001, USA');

      // バリデーションを確認（海外在住として扱われる）
      const overseasAddressControl = component.employeeEditForm.get('overseasAddress');
      const currentAddressControl = component.employeeEditForm.get('currentAddress');
      const currentAddressKanaControl = component.employeeEditForm.get('currentAddressKana');

      expect(overseasAddressControl?.hasError('required')).toBeFalsy(); // 値が入っているのでエラーなし
      expect(currentAddressControl?.hasError('required')).toBeFalsy(); // 必須ではない
      expect(currentAddressKanaControl?.hasError('required')).toBeFalsy(); // 必須ではない
    });

    it('isOverseasResidentチェックボックスの状態を変更すると、バリデーションが正しく切り替わる', async () => {
      // 初期状態：国内在住
      const employeeData = {
        employeeNumber: 'EMP004',
        name: '切り替えテスト',
        isOverseasResident: false,
        postalCode: '1234567',
        currentAddress: '東京都新宿区テスト1-2-3',
        currentAddressKana: 'トウキョウトシンジュククテスト1-2-3',
        overseasAddress: ''
      };

      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(employeeData));
      firestoreService.getEmployeeApplications.and.returnValue(Promise.resolve([]));

      await component.loadEmployeeData('EMP004');

      // 初期状態の確認（国内在住）
      expect(component.employeeEditForm.get('isOverseasResident')?.value).toBe(false);
      const currentAddressControl = component.employeeEditForm.get('currentAddress');
      const overseasAddressControl = component.employeeEditForm.get('overseasAddress');

      // 国内住所をクリアして必須チェック
      currentAddressControl?.setValue('');
      currentAddressControl?.updateValueAndValidity();
      expect(currentAddressControl?.hasError('required')).toBe(true);

      // 海外在住に変更
      component.employeeEditForm.get('isOverseasResident')?.setValue(true);

      // バリデーションが切り替わっていることを確認
      currentAddressControl?.updateValueAndValidity();
      overseasAddressControl?.updateValueAndValidity();

      // 国内住所は必須ではなくなる
      expect(currentAddressControl?.hasError('required')).toBe(false);
      // 海外住所が必須になる
      expect(overseasAddressControl?.hasError('required')).toBe(true);

      // 海外住所を入力
      overseasAddressControl?.setValue('789 Pine Street, San Francisco, CA 94102, USA');
      overseasAddressControl?.updateValueAndValidity();
      expect(overseasAddressControl?.hasError('required')).toBe(false);

      // 再度国内在住に戻す
      component.employeeEditForm.get('isOverseasResident')?.setValue(false);

      // バリデーションが再度切り替わっていることを確認
      currentAddressControl?.updateValueAndValidity();
      overseasAddressControl?.updateValueAndValidity();

      // 国内住所が再度必須になる
      expect(currentAddressControl?.hasError('required')).toBe(true);
      // 海外住所は必須ではなくなる
      expect(overseasAddressControl?.hasError('required')).toBe(false);
    });

    it('住所変更申請承認時に、isOverseasResidentの状態に応じてフォームが正しく更新される（国内在住）', async () => {
      component.showEmployeeEditModal = true;
      component.selectedEmployeeNumber = 'EMP005';

      // 承認前のデータ（国内在住）
      const beforeData = {
        employeeNumber: 'EMP005',
        name: '住所変更テスト',
        isOverseasResident: false,
        postalCode: '1111111',
        currentAddress: '旧住所',
        currentAddressKana: 'キュウジュウショ',
        overseasAddress: ''
      };

      // 承認後のデータ（国内在住、住所変更）
      const afterData = {
        employeeNumber: 'EMP005',
        name: '住所変更テスト',
        isOverseasResident: false,
        postalCode: '2222222',
        currentAddress: '新住所',
        currentAddressKana: 'シンジュウショ',
        overseasAddress: ''
      };

      component.selectedApplication = {
        id: 'app001',
        applicationType: '住所変更申請',
        employeeNumber: 'EMP005',
        status: '承認待ち',
        isOverseasResident: false,
        newAddress: {
          postalCode: '2222222',
          address: '新住所',
          addressKana: 'シンジュウショ'
        }
      };

      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(beforeData));
      firestoreService.getEmployeeApplications.and.returnValue(Promise.resolve([]));
      firestoreService.updateEmployeeAddress.and.returnValue(Promise.resolve());

      // 最初にデータを読み込む
      await component.loadEmployeeData('EMP005');

      // 承認後のデータを返すように変更
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(afterData));

      // 申請を承認
      component.statusChangeForm = formBuilder.group({
        status: ['承認済み'],
        comment: ['']
      });

      await component.updateApplicationStatus();

      // フォームが正しく更新されていることを確認
      expect(component.employeeEditForm.get('isOverseasResident')?.value).toBe(false);
      expect(component.employeeEditForm.get('postalCode')?.value).toBe('2222222');
      expect(component.employeeEditForm.get('currentAddress')?.value).toBe('新住所');
      expect(component.employeeEditForm.get('currentAddressKana')?.value).toBe('シンジュウショ');
      expect(component.employeeEditForm.get('overseasAddress')?.value).toBe('');

      // バリデーションが正しく設定されていることを確認（国内在住として）
      const currentAddressControl = component.employeeEditForm.get('currentAddress');
      const overseasAddressControl = component.employeeEditForm.get('overseasAddress');

      currentAddressControl?.setValue('');
      currentAddressControl?.updateValueAndValidity();
      expect(currentAddressControl?.hasError('required')).toBe(true);

      expect(overseasAddressControl?.hasError('required')).toBe(false);
    });

    it('住所変更申請承認時に、isOverseasResidentの状態に応じてフォームが正しく更新される（海外在住）', async () => {
      component.showEmployeeEditModal = true;
      component.selectedEmployeeNumber = 'EMP006';

      // 承認前のデータ（海外在住）
      const beforeData = {
        employeeNumber: 'EMP006',
        name: '海外住所変更テスト',
        isOverseasResident: true,
        postalCode: '',
        currentAddress: '',
        currentAddressKana: '',
        overseasAddress: 'Old Address, USA'
      };

      // 承認後のデータ（海外在住、住所変更）
      const afterData = {
        employeeNumber: 'EMP006',
        name: '海外住所変更テスト',
        isOverseasResident: true,
        postalCode: '',
        currentAddress: '',
        currentAddressKana: '',
        overseasAddress: 'New Address, USA'
      };

      component.selectedApplication = {
        id: 'app002',
        applicationType: '住所変更申請',
        employeeNumber: 'EMP006',
        status: '承認待ち',
        isOverseasResident: true,
        newAddress: {
          overseasAddress: 'New Address, USA'
        }
      };

      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(beforeData));
      firestoreService.getEmployeeApplications.and.returnValue(Promise.resolve([]));
      firestoreService.updateEmployeeAddress.and.returnValue(Promise.resolve());

      // 最初にデータを読み込む
      await component.loadEmployeeData('EMP006');

      // 承認後のデータを返すように変更
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(afterData));

      // 申請を承認
      component.statusChangeForm = formBuilder.group({
        status: ['承認済み'],
        comment: ['']
      });

      await component.updateApplicationStatus();

      // フォームが正しく更新されていることを確認
      expect(component.employeeEditForm.get('isOverseasResident')?.value).toBe(true);
      expect(component.employeeEditForm.get('overseasAddress')?.value).toBe('New Address, USA');
      expect(component.employeeEditForm.get('postalCode')?.value).toBe('');
      expect(component.employeeEditForm.get('currentAddress')?.value).toBe('');
      expect(component.employeeEditForm.get('currentAddressKana')?.value).toBe('');

      // バリデーションが正しく設定されていることを確認（海外在住として）
      const currentAddressControl = component.employeeEditForm.get('currentAddress');
      const overseasAddressControl = component.employeeEditForm.get('overseasAddress');

      overseasAddressControl?.setValue('');
      overseasAddressControl?.updateValueAndValidity();
      expect(overseasAddressControl?.hasError('required')).toBe(true);

      expect(currentAddressControl?.hasError('required')).toBe(false);
    });

    it('住民票住所のバリデーションがisOverseasResidentの状態に応じて正しく設定される', async () => {
      const employeeData = {
        employeeNumber: 'EMP007',
        name: '住民票テスト',
        isOverseasResident: false,
        sameAsCurrentAddress: false,
        skipResidentAddress: false
      };

      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(employeeData));
      firestoreService.getEmployeeApplications.and.returnValue(Promise.resolve([]));

      await component.loadEmployeeData('EMP007');

      // 国内在住の場合、住民票住所は必須
      const residentAddressControl = component.employeeEditForm.get('residentAddress');
      residentAddressControl?.setValue('');
      residentAddressControl?.updateValueAndValidity();
      expect(residentAddressControl?.hasError('required')).toBe(true);

      // 海外在住に変更
      component.employeeEditForm.get('isOverseasResident')?.setValue(true);

      // 住民票住所は必須ではなくなる
      residentAddressControl?.updateValueAndValidity();
      expect(residentAddressControl?.hasError('required')).toBe(false);
    });
  });
});

