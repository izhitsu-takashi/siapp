import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, Firestore, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  projectId: 'kensyu10117',
  storageBucket: 'kensyu10117.firebasestorage.app'
};

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private db: Firestore;
  private storage: FirebaseStorage;

  constructor() {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
    // Storageを初期化（バケットを明示的に指定）
    this.storage = getStorage(app, firebaseConfig.storageBucket);
  }

  /**
   * 従業員データを正規化して保存する共通メソッド
   * 従業員側と人事側で同じデータ構造を保証する
   */
  normalizeEmployeeData(data: any): any {
    const normalized: any = { ...data };
    
    // マイナンバーと基礎年金番号の一時フィールドを削除（既に結合されている想定）
    delete normalized.myNumberPart1;
    delete normalized.myNumberPart2;
    delete normalized.myNumberPart3;
    delete normalized.basicPensionNumberPart1;
    delete normalized.basicPensionNumberPart2;
    
    // undefinedの値を削除
    return this.removeUndefinedValues(normalized);
  }

  /**
   * undefinedの値を再帰的に削除するヘルパー関数
   */
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

  async saveEmployeeData(employeeNumber: string, data: any): Promise<void> {
    try {
      // データを正規化してから保存
      const normalizedData = this.normalizeEmployeeData(data);
      
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        ...normalizedData,
        employeeNumber: employeeNumber, // 社員番号を明示的に設定
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving employee data:', error);
      throw error;
    }
  }

  async getEmployeeData(employeeNumber: string): Promise<any | null> {
    try {
      // まず通常の社員コレクションを検索
      const docRef = doc(this.db, 'employees', employeeNumber);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      
      // 通常の社員コレクションで見つからない場合、新入社員コレクションを検索
      const onboardingDocRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      const onboardingDocSnap = await getDoc(onboardingDocRef);
      
      if (onboardingDocSnap.exists()) {
        return onboardingDocSnap.data();
      }
      
      return null;
    } catch (error) {
      console.error('Error getting employee data:', error);
      throw error;
    }
  }

  /**
   * 申請要求を保存する
   */
  async saveApplicationRequest(requestData: any): Promise<void> {
    try {
      const requestId = `request_${requestData.employeeNumber}_${Date.now()}`;
      const docRef = doc(this.db, 'applicationRequests', requestId);
      await setDoc(docRef, {
        ...requestData,
        id: requestId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error saving application request:', error);
      throw error;
    }
  }

  /**
   * 社員番号に基づいて申請要求を取得する
   */
  async getApplicationRequestsByEmployee(employeeNumber: string): Promise<any[]> {
    try {
      const requestsCollection = collection(this.db, 'applicationRequests');
      const querySnapshot = await getDocs(requestsCollection);
      
      const requests: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['employeeNumber'] === employeeNumber && data['status'] !== '対応済み') {
          requests.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // 日付順にソート（新しいものから）
      return requests.sort((a, b) => {
        const dateA = a.requestedAt?.toDate ? a.requestedAt.toDate() : new Date(a.requestedAt || 0);
        const dateB = b.requestedAt?.toDate ? b.requestedAt.toDate() : new Date(b.requestedAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      console.error('Error getting application requests:', error);
      throw error;
    }
  }

  /**
   * 申請要求のステータスを更新する
   */
  async updateApplicationRequestStatus(requestId: string, status: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'applicationRequests', requestId);
      await updateDoc(docRef, {
        status: status,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating application request status:', error);
      throw error;
    }
  }

  /**
   * 申請要求を削除する
   */
  async deleteApplicationRequest(requestId: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'applicationRequests', requestId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting application request:', error);
      throw error;
    }
  }

  async getAllEmployees(): Promise<any[]> {
    try {
      const employeesCollection = collection(this.db, 'employees');
      const querySnapshot = await getDocs(employeesCollection);
      
      const employees: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        employees.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return employees;
    } catch (error) {
      console.error('Error getting all employees:', error);
      throw error;
    }
  }

  /**
   * 保険証ステータスのみを更新する（他のデータに影響を与えない）
   */
  async updateInsuranceCardStatus(employeeNumber: string, status: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        insuranceCardStatus: status,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating insurance card status:', error);
      throw error;
    }
  }

  async getEmployeeByEmail(email: string): Promise<any | null> {
    try {
      // まず通常の社員コレクションを検索
      const employeesCollection = collection(this.db, 'employees');
      const employeesSnapshot = await getDocs(employeesCollection);
      
      let employee = null;
      employeesSnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['email'] === email) {
          employee = {
            id: doc.id,
            ...data
          };
        }
      });
      
      // 通常の社員コレクションで見つからなかった場合、新入社員コレクションを検索
      if (!employee) {
        const onboardingCollection = collection(this.db, 'onboardingEmployees');
        const onboardingSnapshot = await getDocs(onboardingCollection);
        
        onboardingSnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
          const data = doc.data();
          if (data['email'] === email) {
            employee = {
              id: doc.id,
              ...data
            };
          }
        });
      }
      
      return employee;
    } catch (error) {
      console.error('Error getting employee by email:', error);
      throw error;
    }
  }

  /**
   * 設定を保存する
   */
  async saveSettings(settings: any): Promise<void> {
    try {
      const docRef = doc(this.db, 'settings', 'company');
      await setDoc(docRef, {
        ...settings,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  /**
   * 設定を読み込む
   */
  async getSettings(): Promise<any | null> {
    try {
      const docRef = doc(this.db, 'settings', 'company');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }

  /**
   * 申請データを保存する
   */
  async saveApplication(applicationData: any): Promise<string> {
    try {
      // 申請IDを取得（全申請の最大ID + 1）
      const nextApplicationId = await this.getNextApplicationId();
      
      const applicationWithId = {
        ...applicationData,
        applicationId: nextApplicationId,
        status: '承認待ち',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = doc(this.db, 'applications', `app_${nextApplicationId}`);
      await setDoc(docRef, applicationWithId);
      
      return nextApplicationId.toString();
    } catch (error) {
      console.error('Error saving application:', error);
      throw error;
    }
  }

  /**
   * 次の申請IDを取得する（全申請の最大ID + 1）
   */
  private async getNextApplicationId(): Promise<number> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      let maxId = 0;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        const applicationId = data['applicationId'];
        if (applicationId && typeof applicationId === 'number' && applicationId > maxId) {
          maxId = applicationId;
        }
      });
      
      return maxId + 1;
    } catch (error) {
      console.error('Error getting next application ID:', error);
      // エラー時は1から開始
      return 1;
    }
  }

  /**
   * 従業員の申請一覧を取得する
   */
  async getEmployeeApplications(employeeNumber: string): Promise<any[]> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      const applications: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['employeeNumber'] === employeeNumber) {
          applications.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // 申請IDでソート（古い順）
      applications.sort((a, b) => {
        const idA = a.applicationId || 0;
        const idB = b.applicationId || 0;
        return idA - idB;
      });
      
      return applications;
    } catch (error) {
      console.error('Error getting employee applications:', error);
      throw error;
    }
  }

  /**
   * 申請種類で申請一覧を取得する
   */
  async getEmployeeApplicationsByType(applicationType: string): Promise<any[]> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      const applications: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['applicationType'] === applicationType) {
          applications.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      return applications;
    } catch (error) {
      console.error('Error getting applications by type:', error);
      throw error;
    }
  }

  /**
   * 全申請一覧を取得する（人事用）
   */
  async getAllApplications(): Promise<any[]> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      const applications: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        applications.push({
          id: doc.id,
          ...data
        });
      });
      
      // 申請IDでソート（新しい順）
      applications.sort((a, b) => {
        const idA = a.applicationId || 0;
        const idB = b.applicationId || 0;
        return idB - idA;
      });
      
      return applications;
    } catch (error) {
      console.error('Error getting all applications:', error);
      throw error;
    }
  }
  
  // 申請のステータスを更新
  async updateApplicationStatus(applicationId: string, status: string, comment: string = ''): Promise<void> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      let targetDocId: string | null = null;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['applicationId'] === parseInt(applicationId) || data['id'] === applicationId || doc.id === applicationId) {
          targetDocId = doc.id;
        }
      });
      
      if (!targetDocId) {
        throw new Error('Application not found');
      }
      
      const applicationRef = doc(this.db, 'applications', targetDocId);
      const updateData: any = {
        status: status,
        updatedAt: new Date()
      };
      
      // 差し戻しの場合はコメントも保存
      if (status === '差し戻し' && comment) {
        updateData.statusComment = comment;
      } else {
        // 差し戻し以外の場合はコメントをクリア
        updateData.statusComment = '';
      }
      
      await updateDoc(applicationRef, updateData);
    } catch (error) {
      console.error('Error updating application status:', error);
      throw error;
    }
  }

  // 申請のデータを更新（ステータス以外のフィールドも更新可能）
  async updateApplicationData(applicationId: string, applicationData: any): Promise<void> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      let targetDocId: string | null = null;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['applicationId'] === parseInt(applicationId) || data['id'] === applicationId || doc.id === applicationId) {
          targetDocId = doc.id;
        }
      });
      
      if (!targetDocId) {
        throw new Error('Application not found');
      }
      
      const applicationRef = doc(this.db, 'applications', targetDocId);
      await updateDoc(applicationRef, {
        ...applicationData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating application data:', error);
      throw error;
    }
  }
  
  // 申請を再提出
  /**
   * 入社時メールを送信する
   * Firebase Functionsのエンドポイントを呼び出す（SMTPまたはTrigger Email拡張機能を使用）
   */
  async sendOnboardingEmail(email: string, name: string, initialPassword: string): Promise<void> {
    try {
      // 本番環境のURLを使用
      const appUrl = 'https://siapp-kadai3.web.app';
      
      // Firebase Functionsのエンドポイントを呼び出す
      const functionsUrl = 'https://us-central1-kensyu10117.cloudfunctions.net/sendOnboardingEmail';
      
      const response = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          name: name,
          initialPassword: initialPassword,
          appUrl: appUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'メール送信に失敗しました');
      }

      const result = await response.json();
      console.log('Email send result:', result);
    } catch (error) {
      console.error('Error sending onboarding email:', error);
      throw error;
    }
  }

  /**
   * パスワード再発行メールを送信する
   * Firebase Functionsのエンドポイントを呼び出す
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      // 本番環境のURLを使用
      const appUrl = 'https://siapp-kadai3.web.app';
      
      // Firebase Functionsのエンドポイントを呼び出す
      const functionsUrl = 'https://us-central1-kensyu10117.cloudfunctions.net/sendPasswordResetEmail';
      
      const response = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          appUrl: appUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'メール送信に失敗しました');
      }

      const result = await response.json();
      console.log('Password reset email send result:', result);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

  /**
   * パスワード再発行トークンの有効性を確認
   */
  async verifyPasswordResetToken(token: string, email: string): Promise<boolean> {
    try {
      const tokenRef = doc(this.db, 'passwordResets', token);
      const tokenDoc = await getDoc(tokenRef);

      if (!tokenDoc.exists()) {
        return false;
      }

      const tokenData = tokenDoc.data();

      // メールアドレスが一致するか確認
      if (tokenData['email'] !== email) {
        return false;
      }

      // 既に使用されているか確認
      if (tokenData['used'] === true) {
        return false;
      }

      // 有効期限を確認
      const expiresAt = tokenData['expiresAt']?.toDate();
      if (!expiresAt || expiresAt < new Date()) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error verifying password reset token:', error);
      return false;
    }
  }

  /**
   * パスワードを更新し、トークンを無効化
   */
  async resetPassword(token: string, email: string, newPassword: string): Promise<void> {
    try {
      // トークンの有効性を再確認
      const isValid = await this.verifyPasswordResetToken(token, email);
      if (!isValid) {
        throw new Error('無効なトークンです。');
      }

      // メールアドレスから社員情報を取得
      const employee = await this.getEmployeeByEmail(email);
      if (!employee || !employee.employeeNumber) {
        throw new Error('社員情報が見つかりません。');
      }

      // パスワードを更新
      await this.saveEmployeeData(employee.employeeNumber, {
        ...employee,
        password: newPassword,
        isInitialPassword: false,
      });

      // トークンを無効化
      const tokenRef = doc(this.db, 'passwordResets', token);
      await updateDoc(tokenRef, {
        used: true,
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  async resubmitApplication(applicationId: string, applicationData: any, newStatus: string = '承認待ち'): Promise<void> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      let targetDocId: string | null = null;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['applicationId'] === parseInt(applicationId) || data['id'] === applicationId || doc.id === applicationId) {
          targetDocId = doc.id;
        }
      });
      
      if (!targetDocId) {
        throw new Error('Application not found');
      }
      
      // newStatusが指定されていない場合は、入社時申請の場合は「申請済み」、それ以外は「承認待ち」に設定
      const status = newStatus || (applicationData.applicationType === '入社時申請' ? '申請済み' : '承認待ち');
      
      const applicationRef = doc(this.db, 'applications', targetDocId);
      await updateDoc(applicationRef, {
        ...applicationData,
        status: status,
        statusComment: '', // 差し戻しコメントをクリア
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error resubmitting application:', error);
      throw error;
    }
  }

  /**
   * 新入社員データを保存する
   */
  async saveOnboardingEmployee(employeeNumber: string, data: any): Promise<void> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};
      
      await setDoc(docRef, {
        ...existingData,
        ...data,
        employeeNumber: employeeNumber,
        status: existingData['status'] || '申請待ち',
        createdAt: existingData['createdAt'] || new Date(),
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving onboarding employee:', error);
      throw error;
    }
  }

  /**
   * 新入社員データを取得する
   */
  async getOnboardingEmployee(employeeNumber: string): Promise<any | null> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting onboarding employee:', error);
      throw error;
    }
  }

  /**
   * 全新入社員データを取得する
   */
  async getAllOnboardingEmployees(): Promise<any[]> {
    try {
      const onboardingCollection = collection(this.db, 'onboardingEmployees');
      const querySnapshot = await getDocs(onboardingCollection);
      
      const employees: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        employees.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return employees;
    } catch (error) {
      console.error('Error getting all onboarding employees:', error);
      throw error;
    }
  }

  /**
   * 新入社員のステータスを更新する
   */
  async updateOnboardingEmployeeStatus(employeeNumber: string, status: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      await updateDoc(docRef, {
        status: status,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating onboarding employee status:', error);
      throw error;
    }
  }

  /**
   * 新入社員データを更新する
   */
  async updateOnboardingEmployee(employeeNumber: string, data: any): Promise<void> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating onboarding employee:', error);
      throw error;
    }
  }

  /**
   * 新入社員を削除する
   */
  async deleteOnboardingEmployee(employeeNumber: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting onboarding employee:', error);
      throw error;
    }
  }

  /**
   * 社員の扶養家族情報に新しい扶養家族を追加する
   */
  async addDependentToEmployee(employeeNumber: string, dependentData: any): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 既存の扶養家族情報を取得（なければ空配列）
      const existingDependents = employeeData.dependents || [];
      
      // 新しい扶養家族情報を追加
      const newDependent = {
        name: `${dependentData.lastName || ''} ${dependentData.firstName || ''}`.trim(),
        nameKana: `${dependentData.lastNameKana || ''} ${dependentData.firstNameKana || ''}`.trim(),
        relationship: dependentData.relationshipType === '配偶者' 
          ? (dependentData.spouseType || '配偶者')
          : (dependentData.relationship || ''),
        birthDate: dependentData.birthDate || '',
        gender: dependentData.gender || '',
        myNumber: dependentData.myNumber || '',
        phoneNumber: dependentData.phoneNumber || '',
        occupation: dependentData.occupation || '',
        annualIncome: dependentData.annualIncome || '',
        monthlyIncome: dependentData.monthlyIncome || '',
        dependentStartDate: dependentData.dependentStartDate || '',
        dependentReason: dependentData.dependentReason || '',
        livingTogether: dependentData.livingTogether || '',
        postalCode: dependentData.postalCode || '',
        address: dependentData.address || '',
        addressKana: dependentData.addressKana || '',
        addressChangeDate: dependentData.addressChangeDate || '',
        basicPensionNumber: dependentData.basicPensionNumber || '',
        disabilityCategory: dependentData.disabilityCategory || '',
        disabilityCardType: dependentData.disabilityCardType || '',
        disabilityCardIssueDate: dependentData.disabilityCardIssueDate || ''
      };

      // 既存の扶養家族情報に追加
      const updatedDependents = [...existingDependents, newDependent];

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        ...employeeData,
        dependents: updatedDependents,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error adding dependent to employee:', error);
      throw error;
    }
  }

  /**
   * 社員の扶養家族情報から指定された扶養家族を削除する
   */
  async removeDependentFromEmployee(employeeNumber: string, dependentName: string, dependentRelationship: string): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 既存の扶養家族情報を取得（なければ空配列）
      const existingDependents = employeeData.dependents || [];
      
      // 指定された扶養家族を削除（氏名と続柄で一致するものを削除）
      const updatedDependents = existingDependents.filter((dep: any) => {
        return !(dep.name === dependentName && dep.relationship === dependentRelationship);
      });

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        ...employeeData,
        dependents: updatedDependents,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error removing dependent from employee:', error);
      throw error;
    }
  }

  /**
   * 社員の住所情報と住民票情報を更新する
   */
  async updateEmployeeAddress(employeeNumber: string, addressData: any): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 住所情報を更新（undefinedをnullまたは空文字列に変換）
      const isOverseasResident = addressData.isOverseasResident ?? employeeData.isOverseasResident ?? false;
      const skipResidentAddress = addressData.skipResidentAddress ?? employeeData.skipResidentAddress ?? false;
      const residentAddressSkipReason = addressData.residentAddressSkipReason ?? employeeData.residentAddressSkipReason ?? '';
      
      const updatedData: any = {
        ...employeeData,
        isOverseasResident: isOverseasResident,
        postalCode: isOverseasResident ? '' : (addressData.newAddress?.postalCode ?? employeeData.postalCode ?? ''),
        currentAddress: isOverseasResident ? '' : (addressData.newAddress?.address ?? employeeData.currentAddress ?? ''),
        currentAddressKana: isOverseasResident ? '' : (addressData.newAddress?.addressKana ?? employeeData.currentAddressKana ?? ''),
        overseasAddress: isOverseasResident ? (addressData.newAddress?.overseasAddress ?? employeeData.overseasAddress ?? '') : '',
        currentHouseholdHead: addressData.newAddress?.householdHead ?? employeeData.currentHouseholdHead ?? '',
        currentHouseholdHeadName: addressData.newAddress?.householdHeadName ?? employeeData.currentHouseholdHeadName ?? '',
        skipResidentAddress: skipResidentAddress,
        residentAddressSkipReason: skipResidentAddress ? residentAddressSkipReason : '',
        residentAddress: skipResidentAddress ? '' : (addressData.residentAddress?.address ?? employeeData.residentAddress ?? ''),
        residentAddressKana: skipResidentAddress ? '' : (addressData.residentAddress?.addressKana ?? employeeData.residentAddressKana ?? ''),
        residentHouseholdHead: addressData.residentAddress?.householdHead ?? employeeData.residentHouseholdHead ?? '',
        residentHouseholdHeadName: addressData.residentAddress?.householdHeadName ?? employeeData.residentHouseholdHeadName ?? '',
        updatedAt: new Date()
      };

      // undefinedの値を削除
      const cleanedData = this.removeUndefinedValues(updatedData);

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, cleanedData, { merge: true });
    } catch (error) {
      console.error('Error updating employee address:', error);
      throw error;
    }
  }

  /**
   * 社員の氏名を更新する
   */
  async updateEmployeeMyNumber(employeeNumber: string, myNumberData: any): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // マイナンバー情報を更新
      const updatedData: any = {
        ...employeeData,
        myNumberPart1: myNumberData.part1 || '',
        myNumberPart2: myNumberData.part2 || '',
        myNumberPart3: myNumberData.part3 || '',
        myNumber: `${myNumberData.part1 || ''}${myNumberData.part2 || ''}${myNumberData.part3 || ''}`,
        updatedAt: new Date()
      };

      // undefinedの値を削除
      const cleanedData = this.removeUndefinedValues(updatedData);

      // 社員データを更新
      await this.saveEmployeeData(employeeNumber, cleanedData);
    } catch (error) {
      console.error('Error updating employee my number:', error);
      throw error;
    }
  }

  async updateEmployeeName(employeeNumber: string, nameData: any): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 氏名を結合
      const newName = `${nameData.lastName || ''} ${nameData.firstName || ''}`.trim();
      const newNameKana = `${nameData.lastNameKana || ''} ${nameData.firstNameKana || ''}`.trim();

      // 氏名情報を更新（姓・名の個別フィールドも更新）
      const updatedData: any = {
        ...employeeData,
        // 結合された氏名（後方互換性のため）
        name: newName || employeeData.name || '',
        nameKana: newNameKana || employeeData.nameKana || '',
        // 姓・名の個別フィールド
        lastName: nameData.lastName || employeeData.lastName || '',
        firstName: nameData.firstName || employeeData.firstName || '',
        lastNameKana: nameData.lastNameKana || employeeData.lastNameKana || '',
        firstNameKana: nameData.firstNameKana || employeeData.firstNameKana || '',
        updatedAt: new Date()
      };

      // undefinedの値を削除
      const cleanedData = this.removeUndefinedValues(updatedData);

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, cleanedData, { merge: true });
    } catch (error) {
      console.error('Error updating employee name:', error);
      throw error;
    }
  }

  /**
   * 社員の退職情報を更新する
   */
  async updateEmployeeResignation(employeeNumber: string, resignationData: any): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 退職日の次の日を計算（資格喪失年月日）
      let socialInsuranceLossDate = '';
      if (resignationData.resignationDate) {
        const resignationDate = new Date(resignationData.resignationDate);
        resignationDate.setDate(resignationDate.getDate() + 1);
        const year = resignationDate.getFullYear();
        const month = String(resignationDate.getMonth() + 1).padStart(2, '0');
        const day = String(resignationDate.getDate()).padStart(2, '0');
        socialInsuranceLossDate = `${year}-${month}-${day}`;
      }

      // 退職後の社会保険加入が「社会保険を任意継続する」の場合のみ、保険者種別を「任意継続被保険者」に変更
      const isContinuingInsurance = resignationData.postResignationInsurance === '社会保険を任意継続する';
      
      // 任意継続被保険者の場合、任意継続終了日を計算（退職日の翌日から2年後）
      let voluntaryInsuranceEndDate = null;
      if (isContinuingInsurance && resignationData.resignationDate) {
        const resignationDate = new Date(resignationData.resignationDate);
        const nextDay = new Date(resignationDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        // 2年後を計算
        const twoYearsLater = new Date(nextDay);
        twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
        
        voluntaryInsuranceEndDate = twoYearsLater;
      }
      
      // 年齢を計算（介護保険被保険者種別の判定に使用）
      let age: number | null = null;
      if (employeeData.birthDate) {
        const birthDate = new Date(employeeData.birthDate);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }
      
      // 健康保険被保険者種別は「社会保険を任意継続する」が選択された場合「任意継続被保険者」に変更
      // 介護保険被保険者種別は「社会保険を任意継続する」が選択され、かつ40歳以上65歳未満の場合のみ「任意継続被保険者」に変更
      const isNursingInsuranceTarget = age !== null && age >= 40 && age < 65;
      const nursingInsuranceType = isContinuingInsurance && isNursingInsuranceTarget 
        ? '任意継続被保険者' 
        : (employeeData.nursingInsuranceType || '');
      
      // 退職情報を更新
      const updatedData: any = {
        ...employeeData,
        // 入退社情報
        employmentStatus: '退職',
        resignationDate: resignationData.resignationDate || employeeData.resignationDate || '',
        resignationReason: resignationData.resignationReason || employeeData.resignationReason || '',
        // 現住所や連絡先に変更があれば更新
        currentAddress: resignationData.postResignationAddress || employeeData.currentAddress || '',
        phoneNumber: resignationData.postResignationPhone || employeeData.phoneNumber || '',
        email: resignationData.postResignationEmail || employeeData.email || '',
        // 社会保険
        socialInsuranceLossDate: socialInsuranceLossDate || employeeData.socialInsuranceLossDate || '',
        // 保険者種別は「社会保険を任意継続する」が選択された場合のみ「任意継続被保険者」に変更
        healthInsuranceType: isContinuingInsurance ? '任意継続被保険者' : (employeeData.healthInsuranceType || ''),
        nursingInsuranceType: nursingInsuranceType,
        // 任意継続終了日（任意継続被保険者の場合のみ設定）
        voluntaryInsuranceEndDate: voluntaryInsuranceEndDate || employeeData.voluntaryInsuranceEndDate || null,
        // 保険証情報
        insuranceCardCollectionDate: resignationData.lastWorkDate || employeeData.insuranceCardCollectionDate || '',
        insuranceCardDistributionStatus: '回収済み',
        updatedAt: new Date()
      };

      // undefinedの値を削除
      const cleanedData = this.removeUndefinedValues(updatedData);

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, cleanedData, { merge: true });
    } catch (error) {
      console.error('Error updating employee resignation:', error);
      throw error;
    }
  }

  /**
   * 給与設定を保存
   */
  async saveSalary(employeeNumber: string, year: number, month: number, amount: number, isManual: boolean = false): Promise<void> {
    try {
      const docId = `${employeeNumber}_${year}_${month}`;
      const docRef = doc(this.db, 'salaries', docId);
      const data: any = {
        employeeNumber: employeeNumber,
        year: year,
        month: month,
        amount: amount,
        updatedAt: new Date()
      };
      
      // 手動設定の場合のみ、isManualフラグとcreatedAtを設定
      if (isManual) {
        data.isManual = true;
        data.createdAt = new Date();
      } else {
        // 自動設定の場合は、既存のcreatedAtを保持（なければ現在時刻）
        const existingDoc = await getDoc(docRef);
        if (existingDoc.exists()) {
          const existingData = existingDoc.data();
          if (existingData?.['createdAt']) {
            data.createdAt = existingData['createdAt'];
          } else {
            data.createdAt = new Date();
          }
        } else {
          data.createdAt = new Date();
        }
      }
      
      await setDoc(docRef, data, { merge: true });
    } catch (error) {
      console.error('Error saving salary:', error);
      throw error;
    }
  }

  /**
   * 給与設定履歴を取得
   */
  async saveStandardMonthlySalaryChange(
    employeeNumber: string,
    effectiveYear: number,
    effectiveMonth: number,
    grade: number,
    monthlyStandard: number
  ): Promise<void> {
    const changeRef = doc(this.db, 'standardMonthlySalaryChanges', `${employeeNumber}_${effectiveYear}_${effectiveMonth}`);
    await setDoc(changeRef, {
      employeeNumber,
      effectiveYear,
      effectiveMonth,
      grade,
      monthlyStandard,
      createdAt: new Date()
    }, { merge: true });
  }

  async deleteStandardMonthlySalaryChange(
    employeeNumber: string,
    effectiveYear: number,
    effectiveMonth: number
  ): Promise<void> {
    const changeRef = doc(this.db, 'standardMonthlySalaryChanges', `${employeeNumber}_${effectiveYear}_${effectiveMonth}`);
    await deleteDoc(changeRef);
  }

  async getStandardMonthlySalaryChange(employeeNumber: string, year: number, month: number): Promise<any | null> {
    // 該当年月以前の最新の変更情報を取得
    const changesRef = collection(this.db, 'standardMonthlySalaryChanges');
    const snapshot = await getDocs(changesRef);
    
    const changes = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((change: any) => {
        if (change.employeeNumber !== employeeNumber) return false;
        const changeYear = Number(change.effectiveYear);
        const changeMonth = Number(change.effectiveMonth);
        if (changeYear < year) return true;
        if (changeYear === year && changeMonth <= month) return true;
        return false;
      })
      .sort((a: any, b: any) => {
        const aYear = Number(a.effectiveYear);
        const bYear = Number(b.effectiveYear);
        const aMonth = Number(a.effectiveMonth);
        const bMonth = Number(b.effectiveMonth);
        if (aYear !== bYear) return bYear - aYear;
        return bMonth - aMonth;
      });
    
    return changes.length > 0 ? changes[0] : null;
  }

  async getStandardMonthlySalaryChangesInPeriod(
    employeeNumber: string,
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number
  ): Promise<any[]> {
    // 指定期間内に適用された標準報酬月額変更情報を取得
    const changesRef = collection(this.db, 'standardMonthlySalaryChanges');
    const snapshot = await getDocs(changesRef);
    
    const changes = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((change: any) => {
        if (change.employeeNumber !== employeeNumber) return false;
        const effectiveYear = Number(change.effectiveYear);
        const effectiveMonth = Number(change.effectiveMonth);
        
        // 期間内かどうかをチェック
        if (effectiveYear < startYear) return false;
        if (effectiveYear === startYear && effectiveMonth < startMonth) return false;
        if (effectiveYear > endYear) return false;
        if (effectiveYear === endYear && effectiveMonth > endMonth) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        const aYear = Number(a.effectiveYear);
        const bYear = Number(b.effectiveYear);
        const aMonth = Number(a.effectiveMonth);
        const bMonth = Number(b.effectiveMonth);
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
      });
    
    return changes;
  }

  async getSalaryHistory(employeeNumber?: string): Promise<any[]> {
    try {
      const salariesRef = collection(this.db, 'salaries');
      const snapshot = await getDocs(salariesRef);
      const salaries: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!employeeNumber || data['employeeNumber'] === employeeNumber) {
          // isManual === true のもののみを取得（手動設定された給与のみ）
          if (data['isManual'] === true) {
            salaries.push({
              id: doc.id,
              ...data
            });
          }
        }
      });
      
      return salaries;
    } catch (error) {
      console.error('Error getting salary history:', error);
      return [];
    }
  }

  /**
   * すべての給与設定履歴を取得（isManualに関係なく、定時改定・随時改定の計算用）
   */
  async getAllSalaryHistory(employeeNumber?: string): Promise<any[]> {
    try {
      const salariesRef = collection(this.db, 'salaries');
      const snapshot = await getDocs(salariesRef);
      const salaries: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!employeeNumber || data['employeeNumber'] === employeeNumber) {
          salaries.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      return salaries;
    } catch (error) {
      console.error('Error getting all salary history:', error);
      return [];
    }
  }

  /**
   * 賞与設定を保存（同じ年月の賞与も別々に保存される）
   */
  async saveBonus(employeeNumber: string, year: number, month: number, amount: number): Promise<void> {
    try {
      // タイムスタンプを追加して一意のドキュメントIDを生成（同じ年月でも別々に保存）
      const timestamp = Date.now();
      const docId = `${employeeNumber}_${year}_${month}_${timestamp}_bonus`;
      const docRef = doc(this.db, 'bonuses', docId);
      
      await setDoc(docRef, {
        employeeNumber: employeeNumber,
        year: year,
        month: month,
        amount: amount,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error saving bonus:', error);
      throw error;
    }
  }

  /**
   * 賞与設定履歴を取得
   */
  async getBonusHistory(employeeNumber?: string): Promise<any[]> {
    try {
      const bonusesRef = collection(this.db, 'bonuses');
      const snapshot = await getDocs(bonusesRef);
      const bonuses: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!employeeNumber || data['employeeNumber'] === employeeNumber) {
          bonuses.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      return bonuses;
    } catch (error) {
      console.error('Error getting bonus history:', error);
      return [];
    }
  }

  /**
   * ファイル名を安全な形式に変換（日本語や特殊文字をエンコード）
   */
  sanitizeFileName(fileName: string): string {
    // ファイル名から拡張子を取得
    const lastDotIndex = fileName.lastIndexOf('.');
    const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
    const nameWithoutExt = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    
    // ファイル名を安全な形式に変換
    // タイムスタンプベースのランダムな文字列を使用して、元のファイル名の代わりにする
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const sanitized = `file_${timestamp}_${randomStr}`;
    
    return sanitized + extension;
  }

  /**
   * ファイルをFirebase StorageにアップロードしてURLを取得
   */
  async uploadFile(file: File, path: string): Promise<string> {
    try {
      // パスからファイル名を抽出してサニタイズ
      const pathParts = path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const sanitizedFileName = this.sanitizeFileName(fileName);
      pathParts[pathParts.length - 1] = sanitizedFileName;
      const sanitizedPath = pathParts.join('/');
      
      const storageRef = ref(this.storage, sanitizedPath);
      
      await uploadBytes(storageRef, file);
      
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      
      // CORSエラーの場合は、より詳細な情報を提供
      if (error?.code === 'storage/unauthorized' || error?.message?.includes('CORS')) {
        throw new Error('Firebase Storageへのアクセスが拒否されました。Storageが正しくセットアップされているか確認してください。');
      }
      
      throw error;
    }
  }
}

