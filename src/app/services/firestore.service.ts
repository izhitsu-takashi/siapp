import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, Firestore } from 'firebase/firestore';

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

  async saveEmployeeData(employeeNumber: string, data: any): Promise<void> {
    try {
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        ...data,
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
}

