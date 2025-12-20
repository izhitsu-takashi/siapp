import { TestBed } from '@angular/core/testing';
import { EmployeeDashboardComponent } from './employee-dashboard.component';
import { FirestoreService } from '../../services/firestore.service';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ChatService } from '../../services/chat.service';

describe('EmployeeDashboardComponent - Application Detail Modal Mode Switch Tests', () => {
  let component: EmployeeDashboardComponent;
  let firestoreService: jasmine.SpyObj<FirestoreService>;
  let router: jasmine.SpyObj<Router>;
  let fb: FormBuilder;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;

  const mockEmployeeNumber = 'EMP001';
  const mockEmployeeName = 'テスト太郎';

  beforeEach(async () => {
    // アラートをモック（テスト中にアラートが表示されないようにする）
    spyOn(window, 'alert');

    const firestoreServiceSpy = jasmine.createSpyObj('FirestoreService', [
      'saveApplication',
      'getEmployeeData',
      'getEmployeeApplications',
      'uploadFile',
      'sanitizeFileName',
      'getApplicationRequestsByEmployee',
      'deleteApplicationRequest'
    ]);

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const chatServiceSpy = jasmine.createSpyObj('ChatService', ['sendMessage']);
    const cdrSpy = jasmine.createSpyObj('ChangeDetectorRef', ['detectChanges']);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, HttpClientTestingModule, EmployeeDashboardComponent],
      providers: [
        { provide: FirestoreService, useValue: firestoreServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ChatService, useValue: chatServiceSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ChangeDetectorRef, useValue: cdrSpy },
        FormBuilder
      ]
    }).compileComponents();

    firestoreService = TestBed.inject(FirestoreService) as jasmine.SpyObj<FirestoreService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fb = TestBed.inject(FormBuilder);
    cdr = TestBed.inject(ChangeDetectorRef) as jasmine.SpyObj<ChangeDetectorRef>;

    component = new EmployeeDashboardComponent(
      router,
      fb,
      firestoreService,
      chatServiceSpy,
      'browser' as any,
      cdr
    );
    component.employeeNumber = mockEmployeeNumber;
    component.employeeName = mockEmployeeName;
    component.employeeData = {
      joinDate: new Date('2020-01-01')
    };

    // モックのデフォルト設定
    firestoreService.saveApplication.and.returnValue(Promise.resolve('APP001'));
    firestoreService.getEmployeeData.and.returnValue(Promise.resolve({}));
    firestoreService.getEmployeeApplications.and.returnValue(Promise.resolve([]));
    firestoreService.uploadFile.and.returnValue(Promise.resolve('https://example.com/file.pdf'));
    firestoreService.sanitizeFileName.and.returnValue('test.pdf');
    firestoreService.getApplicationRequestsByEmployee.and.returnValue(Promise.resolve([]));
    firestoreService.deleteApplicationRequest.and.returnValue(Promise.resolve());
  });

  describe('扶養家族追加申請 - 照会モードと編集モードの切り替え', () => {
    it('照会モードから編集モードに切り替えたとき、基本データが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP001',
        applicationId: 1,
        employeeNumber: mockEmployeeNumber,
        applicationType: '扶養家族追加',
        status: '差し戻し',
        relationshipType: '配偶者',
        spouseType: '妻',
        lastName: '山田',
        firstName: '花子',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'ハナコ',
        birthDate: '1990-01-01',
        basicPensionNumber: '12345678',
        livingTogether: '同居',
        dependentStartDate: '2024-01-01',
        dependentReason: '婚姻',
        occupation: '無職',
        annualIncome: '0'
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // フォームが正しく初期化されていることを確認
      expect(component.dependentApplicationForm).toBeDefined();
      expect(component.isEditModeForReapplication).toBe(true);

      // データが正しく保持されていることを確認
      expect(component.dependentApplicationForm.get('relationshipType')?.value).toBe('配偶者');
      expect(component.dependentApplicationForm.get('spouseType')?.value).toBe('妻');
      expect(component.dependentApplicationForm.get('lastName')?.value).toBe('山田');
      expect(component.dependentApplicationForm.get('firstName')?.value).toBe('花子');
      expect(component.dependentApplicationForm.get('lastNameKana')?.value).toBe('ヤマダ');
      expect(component.dependentApplicationForm.get('firstNameKana')?.value).toBe('ハナコ');
      expect(component.dependentApplicationForm.get('birthDate')?.value).toBe('1990-01-01');
      expect(component.dependentApplicationForm.get('basicPensionNumberPart1')?.value).toBe('1234');
      expect(component.dependentApplicationForm.get('basicPensionNumberPart2')?.value).toBe('5678');
      expect(component.dependentApplicationForm.get('livingTogether')?.value).toBe('同居');
      expect(component.dependentApplicationForm.get('dependentStartDate')?.value).toBe('2024-01-01');
      expect(component.dependentApplicationForm.get('dependentReason')?.value).toBe('婚姻');
      expect(component.dependentApplicationForm.get('occupation')?.value).toBe('無職');
      expect(component.dependentApplicationForm.get('annualIncome')?.value).toBe('0');
    });

    it('照会モードから編集モードに切り替えたとき、「その他」選択のデータが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP002',
        applicationId: 2,
        employeeNumber: mockEmployeeNumber,
        applicationType: '扶養家族追加',
        status: '差し戻し',
        relationshipType: '配偶者以外',
        relationship: '義理の兄弟', // 「その他」の値が直接保存されている
        lastName: '鈴木',
        firstName: '次郎',
        lastNameKana: 'スズキ',
        firstNameKana: 'ジロウ',
        birthDate: '2005-09-10',
        gender: '男性',
        myNumber: '111122223333',
        livingTogether: '同居',
        dependentStartDate: '2024-05-01',
        dependentReason: '特別な事情', // 「その他」の値が直接保存されている
        occupation: '自営業', // 「その他」の値が直接保存されている
        annualIncome: '0',
        spouseAnnualIncome: '4000000'
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // 「その他」が選択され、正しい値が保持されていることを確認
      expect(component.dependentApplicationForm.get('relationshipType')?.value).toBe('配偶者以外');
      expect(component.dependentApplicationForm.get('relationship')?.value).toBe('その他');
      expect(component.dependentApplicationForm.get('relationshipOther')?.value).toBe('義理の兄弟');
      expect(component.dependentApplicationForm.get('dependentReason')?.value).toBe('その他');
      expect(component.dependentApplicationForm.get('dependentReasonOther')?.value).toBe('特別な事情');
      expect(component.dependentApplicationForm.get('occupation')?.value).toBe('その他');
      expect(component.dependentApplicationForm.get('occupationOther')?.value).toBe('自営業');
    });

    it('照会モードから編集モードに切り替えたとき、海外居住者「その他」選択のデータが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP002B',
        applicationId: 2,
        employeeNumber: mockEmployeeNumber,
        applicationType: '扶養家族追加',
        status: '差し戻し',
        relationshipType: '配偶者以外',
        relationship: '実子・養子',
        lastName: '鈴木',
        firstName: '次郎',
        lastNameKana: 'スズキ',
        firstNameKana: 'ジロウ',
        birthDate: '2005-09-10',
        gender: '男性',
        myNumber: '111122223333',
        livingTogether: '同居',
        dependentStartDate: '2024-05-01',
        dependentReason: '配偶者の就職',
        occupation: '小中学生',
        annualIncome: '0',
        spouseAnnualIncome: '4000000',
        isOverseasResident: 'はい',
        overseasSpecialRequirementDate: '2024-05-15',
        overseasReason: '特別な理由', // 「その他」の値が直接保存されている
        overseasReasonOther: '特別な理由'
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // 海外居住者「その他」が選択され、正しい値が保持されていることを確認
      expect(component.dependentApplicationForm.get('isOverseasResident')?.value).toBe('はい');
      expect(component.dependentApplicationForm.get('overseasSpecialRequirementDate')?.value).toBe('2024-05-15');
      expect(component.dependentApplicationForm.get('overseasReason')?.value).toBe('その他');
      expect(component.dependentApplicationForm.get('overseasReasonOther')?.value).toBe('特別な理由');
    });

    it('照会モードから編集モードに切り替えたとき、大学生の学年が正しく保持されること', () => {
      const mockApplication = {
        id: 'APP003',
        applicationId: 3,
        employeeNumber: mockEmployeeNumber,
        applicationType: '扶養家族追加',
        status: '差し戻し',
        relationshipType: '配偶者以外',
        relationship: '実子・養子',
        lastName: '高橋',
        firstName: '三郎',
        lastNameKana: 'タカハシ',
        firstNameKana: 'サブロウ',
        birthDate: '2003-11-25',
        gender: '男性',
        myNumber: '555566667777',
        livingTogether: '同居',
        dependentStartDate: '2024-06-01',
        dependentReason: '収入減少',
        occupation: '大学生',
        studentYear: '2年',
        annualIncome: '0',
        spouseAnnualIncome: '3500000'
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // 大学生の学年が正しく保持されていることを確認
      expect(component.dependentApplicationForm.get('occupation')?.value).toBe('大学生');
      expect(component.dependentApplicationForm.get('studentYear')?.value).toBe('2年');
    });

    it('編集モードから照会モードに戻したとき、データが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP001',
        applicationId: 1,
        employeeNumber: mockEmployeeNumber,
        applicationType: '扶養家族追加',
        status: '差し戻し',
        relationshipType: '配偶者',
        spouseType: '妻',
        lastName: '山田',
        firstName: '花子',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'ハナコ',
        birthDate: '1990-01-01',
        basicPensionNumber: '12345678',
        livingTogether: '同居',
        dependentStartDate: '2024-01-01',
        dependentReason: '婚姻',
        occupation: '無職',
        annualIncome: '0'
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // フォームの値を変更
      component.dependentApplicationForm.patchValue({
        lastName: '変更後山田',
        firstName: '変更後花子'
      });

      // 照会モードに戻す（selectedApplicationは変更されない）
      component.isEditModeForReapplication = false;

      // selectedApplicationのデータは変更されていないことを確認
      expect(component.selectedApplication.lastName).toBe('山田');
      expect(component.selectedApplication.firstName).toBe('花子');
    });
  });

  describe('退職申請 - 照会モードと編集モードの切り替え', () => {
    it('照会モードから編集モードに切り替えたとき、基本データが正しく保持されること', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const mockApplication = {
        id: 'APP004',
        applicationId: 4,
        employeeNumber: mockEmployeeNumber,
        applicationType: '退職申請',
        status: '差し戻し',
        resignationDate: futureDateStr,
        lastWorkDate: futureDateStr,
        resignationReason: '転職のため',
        separationNotice: 'あり',
        postResignationAddress: '東京都港区4-5-6',
        postResignationPhone: '080-1111-2222',
        postResignationEmail: 'newemail@example.com',
        postResignationInsurance: '国民健康保険',
        sameAsCurrentAddress: false,
        sameAsCurrentPhone: false,
        sameAsCurrentEmail: false
      };

      component.selectedApplication = mockApplication;
      component.currentContactInfo = {
        address: '東京都新宿区1-2-3',
        phone: '090-1234-5678',
        email: 'test@example.com'
      };
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // フォームが正しく初期化されていることを確認
      expect(component.resignationForm).toBeDefined();
      expect(component.isEditModeForReapplication).toBe(true);

      // データが正しく保持されていることを確認
      expect(component.resignationForm.get('resignationDate')?.value).toBe(futureDateStr);
      expect(component.resignationForm.get('lastWorkDate')?.value).toBe(futureDateStr);
      expect(component.resignationForm.get('resignationReason')?.value).toBe('転職のため');
      expect(component.resignationForm.get('separationNotice')?.value).toBe('あり');
      expect(component.resignationForm.get('postResignationAddress')?.value).toBe('東京都港区4-5-6');
      expect(component.resignationForm.get('postResignationPhone')?.value).toBe('080-1111-2222');
      expect(component.resignationForm.get('postResignationEmail')?.value).toBe('newemail@example.com');
      expect(component.resignationForm.get('postResignationInsurance')?.value).toBe('国民健康保険');
      expect(component.sameAsCurrentAddressForResignation).toBe(false);
      expect(component.sameAsCurrentPhoneForResignation).toBe(false);
      expect(component.sameAsCurrentEmailForResignation).toBe(false);
    });

    it('照会モードから編集モードに切り替えたとき、変更なしフラグが正しく保持されること', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const mockApplication = {
        id: 'APP005',
        applicationId: 5,
        employeeNumber: mockEmployeeNumber,
        applicationType: '退職申請',
        status: '差し戻し',
        resignationDate: futureDateStr,
        lastWorkDate: futureDateStr,
        resignationReason: '転職のため',
        separationNotice: 'あり',
        postResignationInsurance: '国民健康保険',
        sameAsCurrentAddress: true,
        sameAsCurrentPhone: true,
        sameAsCurrentEmail: true
      };

      component.selectedApplication = mockApplication;
      component.currentContactInfo = {
        address: '東京都新宿区1-2-3',
        phone: '090-1234-5678',
        email: 'test@example.com'
      };
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // 変更なしフラグが正しく保持されていることを確認
      expect(component.sameAsCurrentAddressForResignation).toBe(true);
      expect(component.sameAsCurrentPhoneForResignation).toBe(true);
      expect(component.sameAsCurrentEmailForResignation).toBe(true);
    });
  });

  describe('扶養削除申請 - 照会モードと編集モードの切り替え', () => {
    beforeEach(() => {
      component.dependentsData = [
        {
          name: '山田花子',
          relationship: '配偶者'
        }
      ];
    });

    it('照会モードから編集モードに切り替えたとき、基本データが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP006',
        applicationId: 6,
        employeeNumber: mockEmployeeNumber,
        applicationType: '扶養削除申請',
        status: '差し戻し',
        removalDate: '2024-08-01',
        removalReason: '離婚',
        needsQualificationConfirmation: 'いいえ',
        dependent: {
          name: '山田花子',
          relationship: '配偶者'
        }
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // フォームが正しく初期化されていることを確認
      expect(component.dependentRemovalForm).toBeDefined();
      expect(component.isEditModeForReapplication).toBe(true);

      // データが正しく保持されていることを確認
      expect(component.dependentRemovalForm.get('removalDate')?.value).toBe('2024-08-01');
      expect(component.dependentRemovalForm.get('removalReason')?.value).toBe('離婚');
      expect(component.dependentRemovalForm.get('needsQualificationConfirmation')?.value).toBe('いいえ');
    });

    it('照会モードから編集モードに切り替えたとき、「その他」選択のデータが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP007',
        applicationId: 7,
        employeeNumber: mockEmployeeNumber,
        applicationType: '扶養削除申請',
        status: '差し戻し',
        removalDate: '2024-09-01',
        removalReason: '特別な理由', // 「その他」の値が直接保存されている
        removalReasonOther: '特別な理由',
        needsQualificationConfirmation: 'いいえ',
        dependent: {
          name: '山田花子',
          relationship: '配偶者'
        }
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // 「その他」が選択され、正しい値が保持されていることを確認
      expect(component.dependentRemovalForm.get('removalReason')?.value).toBe('その他');
      expect(component.dependentRemovalForm.get('removalReasonOther')?.value).toBe('特別な理由');
    });

    it('照会モードから編集モードに切り替えたとき、海外居住者「その他」選択のデータが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP007B',
        applicationId: 7,
        employeeNumber: mockEmployeeNumber,
        applicationType: '扶養削除申請',
        status: '差し戻し',
        removalDate: '2024-09-01',
        removalReason: '離婚',
        isOverseasResident: 'はい',
        overseasNonQualificationDate: '2024-09-15',
        overseasReason: '特別な理由', // 「その他」の値が直接保存されている
        overseasReasonOther: '特別な理由',
        needsQualificationConfirmation: 'いいえ',
        dependent: {
          name: '山田花子',
          relationship: '配偶者'
        }
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // 海外居住者「その他」が選択され、正しい値が保持されていることを確認
      expect(component.dependentRemovalForm.get('isOverseasResident')?.value).toBe('はい');
      expect(component.dependentRemovalForm.get('overseasNonQualificationDate')?.value).toBe('2024-09-15');
      expect(component.dependentRemovalForm.get('overseasReason')?.value).toBe('その他');
      expect(component.dependentRemovalForm.get('overseasReasonOther')?.value).toBe('特別な理由');
    });
  });

  describe('住所変更申請 - 照会モードと編集モードの切り替え', () => {
    it('照会モードから編集モードに切り替えたとき、基本データが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP008',
        applicationId: 8,
        employeeNumber: mockEmployeeNumber,
        applicationType: '住所変更申請',
        status: '差し戻し',
        moveDate: '2024-10-01',
        isOverseasResident: false,
        newAddress: {
          postalCode: '123-4567',
          address: '東京都新宿区1-2-3',
          addressKana: 'トウキョウトシンジュクク'
        },
        residentAddress: {
          postalCode: '123-4567',
          address: '東京都新宿区1-2-3',
          addressKana: 'トウキョウトシンジュクク',
          sameAsOldAddress: false,
          sameAsNewAddress: false
        }
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // フォームが正しく初期化されていることを確認
      expect(component.addressChangeForm).toBeDefined();
      expect(component.isEditModeForReapplication).toBe(true);

      // データが正しく保持されていることを確認
      expect(component.addressChangeForm.get('moveDate')?.value).toBe('2024-10-01');
      expect(component.addressChangeForm.get('isOverseasResident')?.value).toBe(false);
      expect(component.addressChangeForm.get('newPostalCode')?.value).toBe('123-4567');
      expect(component.addressChangeForm.get('newAddress')?.value).toBe('東京都新宿区1-2-3');
      expect(component.addressChangeForm.get('newAddressKana')?.value).toBe('トウキョウトシンジュクク');
      expect(component.addressChangeForm.get('residentPostalCode')?.value).toBe('123-4567');
      expect(component.addressChangeForm.get('residentAddress')?.value).toBe('東京都新宿区1-2-3');
      expect(component.sameAsOldAddress).toBe(false);
      expect(component.sameAsNewAddress).toBe(false);
    });
  });

  describe('氏名変更申請 - 照会モードと編集モードの切り替え', () => {
    it('照会モードから編集モードに切り替えたとき、基本データが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP009',
        applicationId: 9,
        employeeNumber: mockEmployeeNumber,
        applicationType: '氏名変更申請',
        status: '差し戻し',
        changeDate: '2024-11-01',
        newName: {
          lastName: '新姓',
          firstName: '新名',
          lastNameKana: 'シンセイ',
          firstNameKana: 'シンメイ'
        }
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // フォームが正しく初期化されていることを確認
      expect(component.nameChangeForm).toBeDefined();
      expect(component.isEditModeForReapplication).toBe(true);

      // データが正しく保持されていることを確認
      expect(component.nameChangeForm.get('changeDate')?.value).toBe('2024-11-01');
      expect(component.nameChangeForm.get('newLastName')?.value).toBe('新姓');
      expect(component.nameChangeForm.get('newFirstName')?.value).toBe('新名');
      expect(component.nameChangeForm.get('newLastNameKana')?.value).toBe('シンセイ');
      expect(component.nameChangeForm.get('newFirstNameKana')?.value).toBe('シンメイ');
    });
  });

  describe('産前産後休業申請 - 照会モードと編集モードの切り替え', () => {
    it('照会モードから編集モードに切り替えたとき、基本データが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP010',
        applicationId: 10,
        employeeNumber: mockEmployeeNumber,
        applicationType: '産前産後休業申請',
        status: '差し戻し',
        expectedDeliveryDate: '2024-12-01',
        isMultipleBirth: 'いいえ',
        maternityLeaveStartDate: '2024-11-15',
        maternityLeaveEndDate: '2025-03-15',
        stayAddress: '東京都港区1-2-3'
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // フォームが正しく初期化されていることを確認
      expect(component.maternityLeaveForm).toBeDefined();
      expect(component.isEditModeForReapplication).toBe(true);

      // データが正しく保持されていることを確認
      expect(component.maternityLeaveForm.get('expectedDeliveryDate')?.value).toBe('2024-12-01');
      expect(component.maternityLeaveForm.get('isMultipleBirth')?.value).toBe('いいえ');
      expect(component.maternityLeaveForm.get('maternityLeaveStartDate')?.value).toBe('2024-11-15');
      expect(component.maternityLeaveForm.get('maternityLeaveEndDate')?.value).toBe('2025-03-15');
      expect(component.maternityLeaveForm.get('stayAddress')?.value).toBe('東京都港区1-2-3');
    });
  });

  describe('マイナンバー変更申請 - 照会モードと編集モードの切り替え', () => {
    it('照会モードから編集モードに切り替えたとき、基本データが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP011',
        applicationId: 11,
        employeeNumber: mockEmployeeNumber,
        applicationType: 'マイナンバー変更申請',
        status: '差し戻し',
        changeDate: '2024-12-15',
        newMyNumber: {
          part1: '1111',
          part2: '2222',
          part3: '3333'
        }
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // フォームが正しく初期化されていることを確認
      expect(component.myNumberChangeForm).toBeDefined();
      expect(component.isEditModeForReapplication).toBe(true);

      // データが正しく保持されていることを確認
      expect(component.myNumberChangeForm.get('changeDate')?.value).toBe('2024-12-15');
      expect(component.myNumberChangeForm.get('newMyNumberPart1')?.value).toBe('1111');
      expect(component.myNumberChangeForm.get('newMyNumberPart2')?.value).toBe('2222');
      expect(component.myNumberChangeForm.get('newMyNumberPart3')?.value).toBe('3333');
    });
  });

  describe('入社時申請 - 照会モードと編集モードの切り替え', () => {
    it('照会モードから編集モードに切り替えたとき、基本データが正しく保持されること', () => {
      const mockApplication = {
        id: 'APP012',
        applicationId: 12,
        employeeNumber: mockEmployeeNumber,
        applicationType: '入社時申請',
        status: '差し戻し',
        lastName: '田中',
        firstName: '太郎',
        lastNameKana: 'タナカ',
        firstNameKana: 'タロウ',
        birthDate: '1995-05-15',
        gender: '男性',
        email: 'tanaka@example.com',
        myNumber: '123456789012',
        basicPensionNumber: '12345678',
        isOverseasResident: false,
        postalCode: '123-4567',
        currentAddress: '東京都渋谷区1-2-3',
        phoneNumber: '090-1234-5678',
        sameAsCurrentAddress: false,
        skipResidentAddress: false,
        residentPostalCode: '123-4567',
        residentAddress: '東京都渋谷区1-2-3',
        pensionHistoryStatus: '無',
        dependentStatus: '無',
        qualificationCertificateRequired: 'いいえ',
        pensionFundMembership: 'いいえ',
        emergencyContact: {
          name: '田中花子',
          nameKana: 'タナカハナコ',
          relationship: '配偶者',
          phone: '090-9876-5432',
          address: '東京都渋谷区1-2-3'
        },
        bankAccount: {
          bankName: 'テスト銀行',
          accountType: '普通',
          accountHolder: 'タナカタロウ',
          branchName: '渋谷支店',
          accountNumber: '1234567'
        }
      };

      component.selectedApplication = mockApplication;
      component.showApplicationDetailModal = true;
      component.isEditModeForReapplication = false;

      // 編集モードを有効化
      component.enableEditMode();

      // フォームが正しく初期化されていることを確認
      expect(component.onboardingApplicationForm).toBeDefined();
      expect(component.isEditModeForReapplication).toBe(true);

      // データが正しく保持されていることを確認
      expect(component.onboardingApplicationForm.get('lastName')?.value).toBe('田中');
      expect(component.onboardingApplicationForm.get('firstName')?.value).toBe('太郎');
      expect(component.onboardingApplicationForm.get('lastNameKana')?.value).toBe('タナカ');
      expect(component.onboardingApplicationForm.get('firstNameKana')?.value).toBe('タロウ');
      expect(component.onboardingApplicationForm.get('birthDate')?.value).toBe('1995-05-15');
      expect(component.onboardingApplicationForm.get('gender')?.value).toBe('男性');
      expect(component.onboardingApplicationForm.get('email')?.value).toBe('tanaka@example.com');
      expect(component.onboardingApplicationForm.get('myNumberPart1')?.value).toBe('1234');
      expect(component.onboardingApplicationForm.get('myNumberPart2')?.value).toBe('5678');
      expect(component.onboardingApplicationForm.get('myNumberPart3')?.value).toBe('9012');
      expect(component.onboardingApplicationForm.get('basicPensionNumberPart1')?.value).toBe('1234');
      expect(component.onboardingApplicationForm.get('basicPensionNumberPart2')?.value).toBe('5678');
      
      // ネストされたフォームグループのデータも確認
      const emergencyContactGroup = component.onboardingApplicationForm.get('emergencyContact') as any;
      expect(emergencyContactGroup.get('name')?.value).toBe('田中花子');
      expect(emergencyContactGroup.get('relationship')?.value).toBe('配偶者');
      
      const bankAccountGroup = component.onboardingApplicationForm.get('bankAccount') as any;
      expect(bankAccountGroup.get('bankName')?.value).toBe('テスト銀行');
      expect(bankAccountGroup.get('accountType')?.value).toBe('普通');
    });
  });
});

