import { TestBed } from '@angular/core/testing';
import { EmployeeDashboardComponent } from './employee-dashboard.component';
import { FirestoreService } from '../../services/firestore.service';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ChatService } from '../../services/chat.service';

describe('EmployeeDashboardComponent - Application Submission Tests', () => {
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

    // モックのデフォルト設定
    firestoreService.saveApplication.and.returnValue(Promise.resolve('APP001'));
    firestoreService.getEmployeeData.and.returnValue(Promise.resolve({}));
    firestoreService.getEmployeeApplications.and.returnValue(Promise.resolve([]));
    firestoreService.uploadFile.and.returnValue(Promise.resolve('https://example.com/file.pdf'));
    firestoreService.sanitizeFileName.and.returnValue('test.pdf');
    firestoreService.getApplicationRequestsByEmployee.and.returnValue(Promise.resolve([]));
    firestoreService.deleteApplicationRequest.and.returnValue(Promise.resolve());
  });

  describe('扶養家族追加申請 - 配偶者の場合', () => {
    it('配偶者の基本情報が正しく保存されること', async () => {
      // フォームを初期化
      component.dependentApplicationForm = component.createDependentApplicationForm();
      
      // フォームに値を設定（配偶者の場合）
      component.dependentApplicationForm.patchValue({
        relationshipType: '配偶者',
        spouseType: '妻',
        lastName: '山田',
        firstName: '花子',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'ハナコ',
        birthDate: '1990-01-01',
        isForeignNational: 'いいえ',
        basicPensionNumberPart1: '1234',
        basicPensionNumberPart2: '5678',
        livingTogether: '同居',
        phone: '090-1234-5678',
        dependentStartDate: '2024-01-01',
        dependentReason: '婚姻',
        occupation: '無職',
        annualIncome: '0',
        isOverseasResident: 'いいえ',
        needsQualificationConfirmation: 'いいえ'
      });

      // 申請を送信
      await component.submitDependentApplication();

      // 期待値の検証
      expect(firestoreService.saveApplication).toHaveBeenCalled();
      const savedData = firestoreService.saveApplication.calls.mostRecent().args[0];
      
      expect(savedData.employeeNumber).toBe(mockEmployeeNumber);
      expect(savedData.applicationType).toBe('扶養家族追加');
      expect(savedData.relationshipType).toBe('配偶者');
      expect(savedData.spouseType).toBe('妻');
      expect(savedData.lastName).toBe('山田');
      expect(savedData.firstName).toBe('花子');
      expect(savedData.lastNameKana).toBe('ヤマダ');
      expect(savedData.firstNameKana).toBe('ハナコ');
      expect(savedData.birthDate).toBe('1990-01-01');
      expect(savedData.basicPensionNumber).toBe('12345678');
      expect(savedData.livingTogether).toBe('同居');
      expect(savedData.dependentStartDate).toBe('2024-01-01');
      expect(savedData.dependentReason).toBe('婚姻');
      expect(savedData.occupation).toBe('無職');
      expect(savedData.annualIncome).toBe('0');
      // statusはFirestoreService側で設定されるため、ここでは検証しない
    });

    it('配偶者で外国籍の場合、国籍と通称名が正しく保存されること', async () => {
      component.dependentApplicationForm = component.createDependentApplicationForm();
      
      component.dependentApplicationForm.patchValue({
        relationshipType: '配偶者',
        spouseType: '夫',
        lastName: 'Smith',
        firstName: 'John',
        lastNameKana: 'スミス',
        firstNameKana: 'ジョン',
        birthDate: '1985-05-15',
        isForeignNational: 'はい',
        nationality: 'アメリカ',
        aliasName: 'ジョン・スミス',
        basicPensionNumberPart1: '1111',
        basicPensionNumberPart2: '2222',
        livingTogether: '同居',
        phone: '080-1111-2222',
        dependentStartDate: '2024-02-01',
        dependentReason: '婚姻',
        occupation: '無職',
        annualIncome: '0',
        isOverseasResident: 'いいえ',
        needsQualificationConfirmation: 'いいえ'
      });

      await component.submitDependentApplication();

      const savedData = firestoreService.saveApplication.calls.mostRecent().args[0];
      expect(savedData.isForeignNational).toBe('はい');
      expect(savedData.nationality).toBe('アメリカ');
      expect(savedData.aliasName).toBe('ジョン・スミス');
    });

    it('配偶者で別居の場合、住所情報と仕送り額が正しく保存されること', async () => {
      component.dependentApplicationForm = component.createDependentApplicationForm();
      
      component.dependentApplicationForm.patchValue({
        relationshipType: '配偶者',
        spouseType: '妻',
        lastName: '佐藤',
        firstName: '美咲',
        lastNameKana: 'サトウ',
        firstNameKana: 'ミサキ',
        birthDate: '1992-03-20',
        isForeignNational: 'いいえ',
        basicPensionNumberPart1: '9999',
        basicPensionNumberPart2: '8888',
        livingTogether: '別居',
        postalCode: '123-4567',
        address: '東京都渋谷区1-2-3',
        addressKana: 'トウキョウトシブヤク',
        monthlySupportAmount: '50000',
        phone: '070-9999-8888',
        dependentStartDate: '2024-03-01',
        dependentReason: '婚姻',
        occupation: '無職',
        annualIncome: '0',
        isOverseasResident: 'いいえ',
        needsQualificationConfirmation: 'いいえ'
      });

      await component.submitDependentApplication();

      const savedData = firestoreService.saveApplication.calls.mostRecent().args[0];
      expect(savedData.livingTogether).toBe('別居');
      expect(savedData.postalCode).toBe('123-4567');
      expect(savedData.address).toBe('東京都渋谷区1-2-3');
      expect(savedData.monthlySupportAmount).toBe('50000');
    });
  });

  describe('扶養家族追加申請 - 配偶者以外の場合', () => {
    it('配偶者以外で続柄が「実子・養子」の場合、正しく保存されること', async () => {
      component.dependentApplicationForm = component.createDependentApplicationForm();
      
      component.dependentApplicationForm.patchValue({
        relationshipType: '配偶者以外',
        relationship: '実子・養子',
        lastName: '田中',
        firstName: '太郎',
        lastNameKana: 'タナカ',
        firstNameKana: 'タロウ',
        birthDate: '2010-06-15',
        gender: '男性',
        myNumberPart1: '1234',
        myNumberPart2: '5678',
        myNumberPart3: '9012',
        livingTogether: '同居',
        dependentStartDate: '2024-04-01',
        dependentReason: '配偶者の就職',
        occupation: '小中学生',
        annualIncome: '0',
        isOverseasResident: 'いいえ',
        needsQualificationConfirmation: 'いいえ',
        spouseAnnualIncome: '3000000'
      });

      await component.submitDependentApplication();

      const savedData = firestoreService.saveApplication.calls.mostRecent().args[0];
      expect(savedData.relationshipType).toBe('配偶者以外');
      expect(savedData.relationship).toBe('実子・養子');
      expect(savedData.gender).toBe('男性');
      expect(savedData.myNumber).toBe('123456789012');
      expect(savedData.occupation).toBe('小中学生');
      expect(savedData.spouseAnnualIncome).toBe('3000000');
    });

    it('配偶者以外で続柄が「その他」の場合、relationshipOtherが正しく保存されること', async () => {
      component.dependentApplicationForm = component.createDependentApplicationForm();
      
      component.dependentApplicationForm.patchValue({
        relationshipType: '配偶者以外',
        relationship: 'その他',
        relationshipOther: '義理の兄弟',
        lastName: '鈴木',
        firstName: '次郎',
        lastNameKana: 'スズキ',
        firstNameKana: 'ジロウ',
        birthDate: '2005-09-10',
        gender: '男性',
        myNumberPart1: '1111',
        myNumberPart2: '2222',
        myNumberPart3: '3333',
        livingTogether: '同居',
        dependentStartDate: '2024-05-01',
        dependentReason: 'その他',
        dependentReasonOther: '特別な事情',
        occupation: '高校生',
        annualIncome: '0',
        isOverseasResident: 'いいえ',
        needsQualificationConfirmation: 'いいえ',
        spouseAnnualIncome: '4000000'
      });

      await component.submitDependentApplication();

      expect(firestoreService.saveApplication).toHaveBeenCalled();
      const savedData = firestoreService.saveApplication.calls.mostRecent().args[0];
      // 「その他」が選択された場合、relationshipOtherの値がrelationshipに保存される
      expect(savedData.relationship).toBe('義理の兄弟');
      // relationshipOtherフィールドは保存されない（relationshipに統合される）
      // expect(savedData.relationshipOther).toBe('義理の兄弟');
      // dependentReasonが「その他」の場合、dependentReasonOtherの値がdependentReasonに保存される
      expect(savedData.dependentReason).toBe('特別な事情');
      expect(savedData.dependentReasonOther).toBe('特別な事情');
    });

    it('配偶者以外で職業が「大学生」の場合、学年が正しく保存されること', async () => {
      component.dependentApplicationForm = component.createDependentApplicationForm();
      
      component.dependentApplicationForm.patchValue({
        relationshipType: '配偶者以外',
        relationship: '実子・養子',
        lastName: '高橋',
        firstName: '三郎',
        lastNameKana: 'タカハシ',
        firstNameKana: 'サブロウ',
        birthDate: '2003-11-25',
        gender: '男性',
        myNumberPart1: '5555',
        myNumberPart2: '6666',
        myNumberPart3: '7777',
        livingTogether: '同居',
        dependentStartDate: '2024-06-01',
        dependentReason: '収入減少',
        occupation: '大学生',
        occupationOther: '',
        studentYear: '2年',
        annualIncome: '0',
        isOverseasResident: 'いいえ',
        needsQualificationConfirmation: 'いいえ',
        spouseAnnualIncome: '3500000'
      });

      await component.submitDependentApplication();

      const savedData = firestoreService.saveApplication.calls.mostRecent().args[0];
      expect(savedData.occupation).toBe('大学生');
      expect(savedData.studentYear).toBe('2年');
    });

    it('配偶者以外で職業が「その他」の場合、occupationOtherが正しく保存されること', async () => {
      component.dependentApplicationForm = component.createDependentApplicationForm();
      
      component.dependentApplicationForm.patchValue({
        relationshipType: '配偶者以外',
        relationship: '父母・養父母',
        lastName: '伊藤',
        firstName: '四郎',
        lastNameKana: 'イトウ',
        firstNameKana: 'シロウ',
        birthDate: '1970-07-30',
        gender: '男性',
        myNumberPart1: '8888',
        myNumberPart2: '9999',
        myNumberPart3: '0000',
        livingTogether: '別居',
        postalCode: '456-7890',
        address: '大阪府大阪市1-2-3',
        addressKana: 'オオサカフオオサカシ',
        dependentStartDate: '2024-07-01',
        dependentReason: '収入減少',
        occupation: 'その他',
        occupationOther: '自営業',
        annualIncome: '500000',
        isOverseasResident: 'いいえ',
        needsQualificationConfirmation: 'いいえ',
        spouseAnnualIncome: '2500000'
      });

      await component.submitDependentApplication();

      expect(firestoreService.saveApplication).toHaveBeenCalled();
      const savedData = firestoreService.saveApplication.calls.mostRecent().args[0];
      // 「その他」が選択された場合、occupationOtherの値がoccupationに保存される
      expect(savedData.occupation).toBe('自営業');
      expect(savedData.occupationOther).toBe('自営業');
    });
  });

  describe('退職申請', () => {
    beforeEach(() => {
      // employeeDataを設定（futureDateValidatorで使用される）
      component.employeeData = {
        joinDate: new Date('2020-01-01')
      };
    });

    it('退職申請の基本情報が正しく保存されること', async () => {
      component.resignationForm = component.createResignationForm();
      component.currentContactInfo = {
        address: '東京都新宿区1-2-3',
        phone: '090-1234-5678',
        email: 'test@example.com'
      };
      
      // 未来の日付を設定（バリデーションをパスするため）
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      component.resignationForm.patchValue({
        resignationDate: futureDateStr,
        lastWorkDate: futureDateStr,
        resignationReason: '転職のため',
        separationNotice: 'あり',
        postResignationAddress: '東京都港区4-5-6',
        postResignationPhone: '080-1111-2222',
        postResignationEmail: 'newemail@example.com',
        postResignationInsurance: '国民健康保険'
      });
      component.sameAsCurrentAddressForResignation = false;
      component.sameAsCurrentPhoneForResignation = false;
      component.sameAsCurrentEmailForResignation = false;

      // フォームが有効であることを確認
      expect(component.resignationForm.valid).toBe(true);

      await component.submitResignationApplication();

      expect(firestoreService.saveApplication).toHaveBeenCalled();
      const savedData = firestoreService.saveApplication.calls.mostRecent().args[0];
      expect(savedData.employeeNumber).toBe(mockEmployeeNumber);
      expect(savedData.applicationType).toBe('退職申請');
      expect(savedData.resignationDate).toBe(futureDateStr);
      expect(savedData.lastWorkDate).toBe(futureDateStr);
      expect(savedData.resignationReason).toBe('転職のため');
      expect(savedData.separationNotice).toBe('あり');
      expect(savedData.postResignationAddress).toBe('東京都港区4-5-6');
      expect(savedData.postResignationPhone).toBe('080-1111-2222');
      expect(savedData.postResignationEmail).toBe('newemail@example.com');
      expect(savedData.postResignationInsurance).toBe('国民健康保険');
      expect(savedData.sameAsCurrentAddress).toBe(false);
      expect(savedData.sameAsCurrentPhone).toBe(false);
      expect(savedData.sameAsCurrentEmail).toBe(false);
    });

    it('退職申請で連絡先が変更なしの場合、現在の連絡先情報が使用されること', async () => {
      component.resignationForm = component.createResignationForm();
      component.currentContactInfo = {
        address: '東京都新宿区1-2-3',
        phone: '090-1234-5678',
        email: 'test@example.com'
      };
      
      // 未来の日付を設定（バリデーションをパスするため）
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      component.resignationForm.patchValue({
        resignationDate: futureDateStr,
        lastWorkDate: futureDateStr,
        resignationReason: '転職のため',
        separationNotice: 'あり',
        postResignationInsurance: '国民健康保険'
      });
      component.sameAsCurrentAddressForResignation = true;
      component.sameAsCurrentPhoneForResignation = true;
      component.sameAsCurrentEmailForResignation = true;

      // フォームが有効であることを確認
      expect(component.resignationForm.valid).toBe(true);

      await component.submitResignationApplication();

      expect(firestoreService.saveApplication).toHaveBeenCalled();
      const savedData = firestoreService.saveApplication.calls.mostRecent().args[0];
      expect(savedData.postResignationAddress).toBe('東京都新宿区1-2-3');
      expect(savedData.postResignationPhone).toBe('090-1234-5678');
      expect(savedData.postResignationEmail).toBe('test@example.com');
      expect(savedData.sameAsCurrentAddress).toBe(true);
      expect(savedData.sameAsCurrentPhone).toBe(true);
      expect(savedData.sameAsCurrentEmail).toBe(true);
    });
  });
});

