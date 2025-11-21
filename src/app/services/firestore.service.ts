import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, Firestore, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'kensyu10117'
};

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private db: Firestore;

  constructor() {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
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
      const docRef = doc(this.db, 'employees', employeeNumber);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting employee data:', error);
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

  async getEmployeeByEmail(email: string): Promise<any | null> {
    try {
      const employeesCollection = collection(this.db, 'employees');
      const querySnapshot = await getDocs(employeesCollection);
      
      let employee = null;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['email'] === email) {
          employee = {
            id: doc.id,
            ...data
          };
        }
      });
      
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
}

