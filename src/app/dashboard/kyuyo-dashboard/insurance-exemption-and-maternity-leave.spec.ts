import { TestBed } from '@angular/core/testing';
import { KyuyoDashboardComponent } from './kyuyo-dashboard.component';
import { FirestoreService } from '../../services/firestore.service';
import { PLATFORM_ID } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormBuilder } from '@angular/forms';

describe('保険料免除機能・産前産後休業機能のテスト', () => {
  let component: KyuyoDashboardComponent;
  let firestoreService: jasmine.SpyObj<FirestoreService>;
  let fb: FormBuilder;

  beforeEach(async () => {
    spyOn(window, 'alert');
    
    const firestoreServiceSpy = jasmine.createSpyObj('FirestoreService', [
      'getAllEmployees',
      'getSettings',
      'saveInsuranceExemption',
      'getInsuranceExemptions',
      'deleteInsuranceExemption',
      'getEmployeeData',
      'saveEmployeeData',
      'loadLeaveVoluntaryList',
      'loadInsuranceList'
    ]);

    await TestBed.configureTestingModule({
      imports: [
        KyuyoDashboardComponent,
        HttpClientTestingModule
      ],
      providers: [
        { provide: FirestoreService, useValue: firestoreServiceSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
        FormBuilder
      ]
    }).compileComponents();

    component = TestBed.createComponent(KyuyoDashboardComponent).componentInstance;
    firestoreService = TestBed.inject(FirestoreService) as jasmine.SpyObj<FirestoreService>;
    fb = TestBed.inject(FormBuilder);
    
    // フォームを初期化
    component.maternityLeaveForm = fb.group({
      maternityLeaveStartDate: ['', []],
      maternityLeaveEndDate: ['', []]
    });
  });

  describe('1. 保険料免除機能（isExemptedメソッド）のテスト', () => {
    beforeEach(() => {
      // テスト用の免除設定データを設定
      component.insuranceExemptions = [
        {
          id: 'ex1',
          employeeNumber: 'EMP001',
          startYear: 2025,
          startMonth: 1,
          endYear: 2025,
          endMonth: 3,
          healthInsuranceExempt: true,
          pensionInsuranceExempt: false,
          exemptionType: 'both'
        },
        {
          id: 'ex2',
          employeeNumber: 'EMP001',
          startYear: 2025,
          startMonth: 6,
          endYear: 2025,
          endMonth: 8,
          healthInsuranceExempt: false,
          pensionInsuranceExempt: true,
          exemptionType: 'salary'
        },
        {
          id: 'ex3',
          employeeNumber: 'EMP002',
          startYear: 2025,
          startMonth: 4,
          endYear: 2025,
          endMonth: 5,
          healthInsuranceExempt: true,
          pensionInsuranceExempt: true,
          exemptionType: 'bonus'
        }
      ];
    });

    describe('期間判定のテスト', () => {
      it('免除期間の開始月は免除される', () => {
        const result = component.isExempted('EMP001', 2025, 1, 'health', 'salary');
        expect(result).toBe(true);
      });

      it('免除期間の終了月は免除される', () => {
        const result = component.isExempted('EMP001', 2025, 3, 'health', 'salary');
        expect(result).toBe(true);
      });

      it('免除期間の前月は免除されない', () => {
        const result = component.isExempted('EMP001', 2024, 12, 'health', 'salary');
        expect(result).toBe(false);
      });

      it('免除期間の翌月は免除されない', () => {
        const result = component.isExempted('EMP001', 2025, 4, 'health', 'salary');
        expect(result).toBe(false);
      });

      it('免除期間の中間月は免除される', () => {
        const result = component.isExempted('EMP001', 2025, 2, 'health', 'salary');
        expect(result).toBe(true);
      });
    });

    describe('保険種類による判定のテスト', () => {
      it('健康保険が免除設定されている場合、健康保険は免除される', () => {
        const result = component.isExempted('EMP001', 2025, 1, 'health', 'salary');
        expect(result).toBe(true);
      });

      it('健康保険が免除設定されていない場合、健康保険は免除されない', () => {
        const result = component.isExempted('EMP001', 2025, 6, 'health', 'salary');
        expect(result).toBe(false);
      });

      it('厚生年金保険が免除設定されている場合、厚生年金保険は免除される', () => {
        const result = component.isExempted('EMP001', 2025, 6, 'pension', 'salary');
        expect(result).toBe(true);
      });

      it('厚生年金保険が免除設定されていない場合、厚生年金保険は免除されない', () => {
        const result = component.isExempted('EMP001', 2025, 1, 'pension', 'salary');
        expect(result).toBe(false);
      });
    });

    describe('給与/賞与による判定のテスト', () => {
      it('exemptionTypeが"both"の場合、給与も賞与も免除される', () => {
        const resultSalary = component.isExempted('EMP001', 2025, 1, 'health', 'salary');
        const resultBonus = component.isExempted('EMP001', 2025, 1, 'health', 'bonus');
        expect(resultSalary).toBe(true);
        expect(resultBonus).toBe(true);
      });

      it('exemptionTypeが"salary"の場合、給与のみ免除される', () => {
        const resultSalary = component.isExempted('EMP001', 2025, 6, 'pension', 'salary');
        const resultBonus = component.isExempted('EMP001', 2025, 6, 'pension', 'bonus');
        expect(resultSalary).toBe(true);
        expect(resultBonus).toBe(false);
      });

      it('exemptionTypeが"bonus"の場合、賞与のみ免除される', () => {
        const resultSalary = component.isExempted('EMP002', 2025, 4, 'health', 'salary');
        const resultBonus = component.isExempted('EMP002', 2025, 4, 'health', 'bonus');
        expect(resultSalary).toBe(false);
        expect(resultBonus).toBe(true);
      });
    });

    describe('社員番号による判定のテスト', () => {
      it('異なる社員の免除設定は適用されない', () => {
        const result = component.isExempted('EMP999', 2025, 1, 'health', 'salary');
        expect(result).toBe(false);
      });
    });

    describe('閾値テスト（期間の境界値）', () => {
      it('開始月の1日が含まれる月は免除される', () => {
        component.insuranceExemptions = [{
          id: 'ex4',
          employeeNumber: 'EMP003',
          startYear: 2025,
          startMonth: 1,
          endYear: 2025,
          endMonth: 3,
          healthInsuranceExempt: true,
          pensionInsuranceExempt: false,
          exemptionType: 'both'
        }];
        const result = component.isExempted('EMP003', 2025, 1, 'health', 'salary');
        expect(result).toBe(true);
      });

      it('終了月の最終日が含まれる月は免除される', () => {
        component.insuranceExemptions = [{
          id: 'ex5',
          employeeNumber: 'EMP004',
          startYear: 2025,
          startMonth: 1,
          endYear: 2025,
          endMonth: 3,
          healthInsuranceExempt: true,
          pensionInsuranceExempt: false,
          exemptionType: 'both'
        }];
        const result = component.isExempted('EMP004', 2025, 3, 'health', 'salary');
        expect(result).toBe(true);
      });

      it('開始月の前月は免除されない', () => {
        component.insuranceExemptions = [{
          id: 'ex6',
          employeeNumber: 'EMP005',
          startYear: 2025,
          startMonth: 2,
          endYear: 2025,
          endMonth: 3,
          healthInsuranceExempt: true,
          pensionInsuranceExempt: false,
          exemptionType: 'both'
        }];
        const result = component.isExempted('EMP005', 2025, 1, 'health', 'salary');
        expect(result).toBe(false);
      });

      it('終了月の翌月は免除されない', () => {
        component.insuranceExemptions = [{
          id: 'ex7',
          employeeNumber: 'EMP006',
          startYear: 2025,
          startMonth: 1,
          endYear: 2025,
          endMonth: 3,
          healthInsuranceExempt: true,
          pensionInsuranceExempt: false,
          exemptionType: 'both'
        }];
        const result = component.isExempted('EMP006', 2025, 4, 'health', 'salary');
        expect(result).toBe(false);
      });

      it('年を跨ぐ免除期間（12月から1月）', () => {
        component.insuranceExemptions = [{
          id: 'ex8',
          employeeNumber: 'EMP007',
          startYear: 2024,
          startMonth: 12,
          endYear: 2025,
          endMonth: 2,
          healthInsuranceExempt: true,
          pensionInsuranceExempt: false,
          exemptionType: 'both'
        }];
        expect(component.isExempted('EMP007', 2024, 12, 'health', 'salary')).toBe(true);
        expect(component.isExempted('EMP007', 2025, 1, 'health', 'salary')).toBe(true);
        expect(component.isExempted('EMP007', 2025, 2, 'health', 'salary')).toBe(true);
        expect(component.isExempted('EMP007', 2025, 3, 'health', 'salary')).toBe(false);
      });
    });
  });

  describe('2. 産前産後休業期間変更機能（saveMaternityLeavePeriodメソッド）のテスト', () => {
    beforeEach(() => {
      component.selectedMaternityEmployee = {
        employeeNumber: 'EMP001',
        name: 'テスト社員'
      };
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve({
        employeeNumber: 'EMP001',
        name: 'テスト社員',
        maternityLeaveStartDate: '2025-01-10',
        maternityLeaveEndDate: '2025-03-20'
      }));
      firestoreService.saveEmployeeData.and.returnValue(Promise.resolve());
      component.loadLeaveVoluntaryList = jasmine.createSpy('loadLeaveVoluntaryList').and.returnValue(Promise.resolve());
      component.loadInsuranceList = jasmine.createSpy('loadInsuranceList').and.returnValue(Promise.resolve());
    });

    it('正常に期間を更新できる', async () => {
      component.maternityLeaveForm.patchValue({
        maternityLeaveStartDate: '2025-02-01',
        maternityLeaveEndDate: '2025-04-30'
      });

      await component.saveMaternityLeavePeriod();

      expect(firestoreService.getEmployeeData).toHaveBeenCalledWith('EMP001');
      expect(firestoreService.saveEmployeeData).toHaveBeenCalledWith('EMP001', jasmine.objectContaining({
        maternityLeaveStartDate: '2025-02-01',
        maternityLeaveEndDate: '2025-04-30'
      }));
      expect(window.alert).toHaveBeenCalledWith('産前産後休業期間を更新しました');
    });

    it('開始日が終了日より後の場合はエラー', async () => {
      component.maternityLeaveForm.patchValue({
        maternityLeaveStartDate: '2025-04-30',
        maternityLeaveEndDate: '2025-02-01'
      });

      await component.saveMaternityLeavePeriod();

      expect(window.alert).toHaveBeenCalledWith('産前産後休業開始日は終了日より前である必要があります');
      expect(firestoreService.saveEmployeeData).not.toHaveBeenCalled();
    });

    it('開始日が空の場合はエラー', async () => {
      component.maternityLeaveForm.patchValue({
        maternityLeaveStartDate: '',
        maternityLeaveEndDate: '2025-04-30'
      });

      await component.saveMaternityLeavePeriod();

      expect(window.alert).toHaveBeenCalledWith('産前産後休業開始日と終了日を入力してください');
      expect(firestoreService.saveEmployeeData).not.toHaveBeenCalled();
    });

    it('終了日が空の場合はエラー', async () => {
      component.maternityLeaveForm.patchValue({
        maternityLeaveStartDate: '2025-02-01',
        maternityLeaveEndDate: ''
      });

      await component.saveMaternityLeavePeriod();

      expect(window.alert).toHaveBeenCalledWith('産前産後休業開始日と終了日を入力してください');
      expect(firestoreService.saveEmployeeData).not.toHaveBeenCalled();
    });

    it('社員データが見つからない場合はエラー', async () => {
      component.maternityLeaveForm.patchValue({
        maternityLeaveStartDate: '2025-02-01',
        maternityLeaveEndDate: '2025-04-30'
      });
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(null));

      await component.saveMaternityLeavePeriod();

      expect(window.alert).toHaveBeenCalledWith('社員データが見つかりませんでした');
      expect(firestoreService.saveEmployeeData).not.toHaveBeenCalled();
    });

    it('保存後に一覧を再読み込みする', async () => {
      component.maternityLeaveForm.patchValue({
        maternityLeaveStartDate: '2025-02-01',
        maternityLeaveEndDate: '2025-04-30'
      });
      component.loadLeaveVoluntaryList = jasmine.createSpy('loadLeaveVoluntaryList').and.returnValue(Promise.resolve());
      component.loadInsuranceList = jasmine.createSpy('loadInsuranceList').and.returnValue(Promise.resolve());

      await component.saveMaternityLeavePeriod();

      expect(component.loadLeaveVoluntaryList).toHaveBeenCalled();
      expect(component.loadInsuranceList).toHaveBeenCalled();
    });
  });

  describe('3. 産前産後休業保険料免除ロジック（isInMaternityLeavePeriodメソッド）のテスト', () => {
    describe('基本的な期間判定のテスト', () => {
      it('休業期間内の月は免除される', () => {
        const startDate = '2025-01-10';
        const endDate = '2025-03-20';
        const result = component.isInMaternityLeavePeriod(startDate, endDate, 2025, 2);
        expect(result).toBe(true);
      });

      it('休業期間前の月は免除されない', () => {
        const startDate = '2025-01-10';
        const endDate = '2025-03-20';
        const result = component.isInMaternityLeavePeriod(startDate, endDate, 2024, 12);
        expect(result).toBe(false);
      });

      it('休業期間後の月は免除されない', () => {
        const startDate = '2025-01-10';
        const endDate = '2025-03-20';
        const result = component.isInMaternityLeavePeriod(startDate, endDate, 2025, 4);
        expect(result).toBe(false);
      });
    });

    describe('終了日の翌日が属する月の前月まで免除されるロジック', () => {
      it('10月末まで休業した場合、10月の保険料は免除される', () => {
        // 10/31まで休業 → 11/1が翌日 → 11月の前月は10月 → 10月は免除
        const startDate = '2025-09-01';
        const endDate = '2025-10-31';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 10)).toBe(true);
      });

      it('10月末の一日前まで休業した場合、10月の保険料は免除されない', () => {
        // 10/30まで休業 → 10/31が翌日 → 10/31は10月 → 開始日も10月 → 同じ月 → 免除されない
        const startDate = '2025-10-01';
        const endDate = '2025-10-30';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 10)).toBe(false);
      });

      it('9/10開始、9/28終了の場合、保険料を徴収する（同じ月）', () => {
        // 9/28まで休業 → 9/29が翌日 → 9/29は9月 → 開始日も9月 → 同じ月 → 免除されない
        const startDate = '2025-09-10';
        const endDate = '2025-09-28';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 9)).toBe(false);
      });

      it('9/10開始、9/30終了の場合、9月の保険料は免除される', () => {
        // 9/30まで休業 → 10/1が翌日 → 10/1は10月 → 開始日は9月 → 異なる月 → 9月は免除
        const startDate = '2025-09-10';
        const endDate = '2025-09-30';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 9)).toBe(true);
      });
    });

    describe('閾値テスト（月の境界値）', () => {
      it('開始月の1日が含まれる月は免除される', () => {
        const startDate = '2025-01-01';
        const endDate = '2025-03-31';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 1)).toBe(true);
      });

      it('開始月の最終日が含まれる月は免除される', () => {
        const startDate = '2025-01-31';
        const endDate = '2025-03-31';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 1)).toBe(true);
      });

      it('終了日の翌日が属する月の前月は免除される', () => {
        // 3/20まで休業 → 3/21が翌日 → 3/21は3月 → 前月は2月 → 2月は免除
        const startDate = '2025-01-10';
        const endDate = '2025-03-20';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 2)).toBe(true);
      });

      it('終了日の翌日が属する月は免除されない', () => {
        // 3/20まで休業 → 3/21が翌日 → 3/21は3月 → 3月は免除されない
        const startDate = '2025-01-10';
        const endDate = '2025-03-20';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 3)).toBe(false);
      });
    });

    describe('年を跨ぐ場合のテスト', () => {
      it('12月から翌年2月までの休業期間', () => {
        const startDate = '2024-12-10';
        const endDate = '2025-02-20';
        // 12月は免除
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2024, 12)).toBe(true);
        // 1月は免除（終了日の翌日が2/21なので、前月の1月まで）
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 1)).toBe(true);
        // 2月は免除されない（終了日の翌日が2/21で2月なので、前月の1月までが免除対象）
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 2)).toBe(false);
        // 3月は免除されない
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 3)).toBe(false);
      });

      it('12/31まで休業した場合、12月は免除される', () => {
        const startDate = '2024-11-01';
        const endDate = '2024-12-31';
        // 12/31まで休業 → 1/1が翌日 → 1/1は1月 → 前月は12月 → 12月は免除
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2024, 12)).toBe(true);
      });

      it('12/30まで休業した場合、12月は免除されない（開始日も12月の場合）', () => {
        const startDate = '2024-12-01';
        const endDate = '2024-12-30';
        // 12/30まで休業 → 12/31が翌日 → 12/31は12月 → 開始日も12月 → 同じ月 → 免除されない
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2024, 12)).toBe(false);
      });
    });

    describe('開始日と終了日の翌日が同じ月の場合のテスト', () => {
      it('同じ月で開始・終了した場合、保険料を徴収する', () => {
        const startDate = '2025-01-10';
        const endDate = '2025-01-20';
        // 1/20まで休業 → 1/21が翌日 → 1/21は1月 → 開始日も1月 → 同じ月 → 免除されない
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 1)).toBe(false);
      });

      it('同じ月で開始・終了した場合でも、開始月より前の月は免除されない', () => {
        const startDate = '2025-01-10';
        const endDate = '2025-01-20';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2024, 12)).toBe(false);
      });
    });

    describe('日付形式のテスト', () => {
      it('文字列形式の日付を正しく処理できる', () => {
        const startDate = '2025-01-10';
        const endDate = '2025-03-20';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 2)).toBe(true);
      });

      it('Dateオブジェクト形式の日付を正しく処理できる', () => {
        const startDate = new Date('2025-01-10');
        const endDate = new Date('2025-03-20');
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 2)).toBe(true);
      });

      it('開始日または終了日がnullの場合はfalseを返す', () => {
        expect(component.isInMaternityLeavePeriod(null, '2025-03-20', 2025, 2)).toBe(false);
        expect(component.isInMaternityLeavePeriod('2025-01-10', null, 2025, 2)).toBe(false);
        expect(component.isInMaternityLeavePeriod(null, null, 2025, 2)).toBe(false);
      });

      it('無効な日付の場合はfalseを返す', () => {
        expect(component.isInMaternityLeavePeriod('invalid', '2025-03-20', 2025, 2)).toBe(false);
        expect(component.isInMaternityLeavePeriod('2025-01-10', 'invalid', 2025, 2)).toBe(false);
      });
    });

    describe('具体的なシナリオテスト', () => {
      it('産前休業：9/1開始、10/31終了 → 9月と10月は免除', () => {
        const startDate = '2025-09-01';
        const endDate = '2025-10-31';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 9)).toBe(true);
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 10)).toBe(true);
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 11)).toBe(false);
      });

      it('産後休業：11/1開始、12/31終了 → 11月と12月は免除', () => {
        const startDate = '2025-11-01';
        const endDate = '2025-12-31';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 11)).toBe(true);
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 12)).toBe(true);
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2026, 1)).toBe(false);
      });

      it('短期休業：1/15開始、1/25終了 → 1月は免除されない（同じ月）', () => {
        const startDate = '2025-01-15';
        const endDate = '2025-01-25';
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 1)).toBe(false);
      });

      it('月跨ぎ休業：1/25開始、2/5終了 → 1月は免除、2月は免除されない', () => {
        const startDate = '2025-01-25';
        const endDate = '2025-02-05';
        // 2/5まで休業 → 2/6が翌日 → 2/6は2月 → 前月は1月 → 1月は免除
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 1)).toBe(true);
        // 2月は免除されない
        expect(component.isInMaternityLeavePeriod(startDate, endDate, 2025, 2)).toBe(false);
      });
    });
  });
});

