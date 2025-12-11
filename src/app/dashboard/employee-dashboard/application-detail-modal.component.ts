// Angularのコア機能をインポート
// Component: コンポーネントデコレータ
// Input: 親コンポーネントからデータを受け取るためのデコレータ
// Output: 親コンポーネントにイベントを送信するためのデコレータ
// EventEmitter: イベントを発火するためのクラス
// OnInit: コンポーネント初期化時のライフサイクルフック
// ChangeDetectorRef: 変更検知を手動でトリガーするためのサービス
import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
// Angularの共通機能（*ngIf, *ngFor, DatePipeなど）をインポート
import { CommonModule } from '@angular/common';
// フォーム関連の機能をインポート
// FormBuilder: フォームグループを作成するためのビルダー
// FormGroup: フォームコントロールのグループ
// Validators: フォームバリデーション
// ReactiveFormsModule: リアクティブフォームを使用するためのモジュール
// FormsModule: テンプレート駆動フォームを使用するためのモジュール
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
// Firestoreサービスをインポート（データベース操作に使用）
import { FirestoreService } from '../../services/firestore.service';

// コンポーネントデコレータ：このクラスをAngularコンポーネントとして定義
@Component({
  selector: 'app-application-detail-modal', // HTMLテンプレートで使用するセレクタ名
  standalone: true, // スタンドアロンコンポーネント（NgModule不要）
  imports: [CommonModule, ReactiveFormsModule, FormsModule], // このコンポーネントで使用するモジュール
  templateUrl: './application-detail-modal.component.html', // HTMLテンプレートファイルのパス
  styleUrl: './application-detail-modal.component.css' // CSSスタイルファイルのパス
})
// 申請詳細モーダルコンポーネントクラス
// OnInitインターフェースを実装（ngOnInitメソッドを使用するため）
export class ApplicationDetailModalComponent implements OnInit {
  // ========== 入力プロパティ（親コンポーネントから受け取るデータ） ==========
  
  // 表示する申請データ（申請ID、申請種類、ステータス、申請内容など）
  @Input() application: any = null;
  
  // モーダルの表示/非表示を制御するフラグ
  @Input() isVisible: boolean = false;
  
  // 扶養家族のデータ配列（扶養家族追加申請などで使用）
  @Input() dependentsData: any[] = [];
  
  // 従業員番号（申請を識別するために使用）
  @Input() employeeNumber: string = '';
  
  // ========== 出力プロパティ（親コンポーネントにイベントを送信） ==========
  
  // モーダルを閉じる際に発火するイベント
  @Output() close = new EventEmitter<void>();
  
  // 再申請が送信された際に発火するイベント
  @Output() reapplicationSubmitted = new EventEmitter<void>();

  // ========== コンポーネント内部の状態管理 ==========
  
  // 差し戻し申請の編集モードかどうかを示すフラグ
  // true: 編集モード（修正ボタンが押された状態）
  isEditModeForReapplication = false;
  
  // 再申請の送信処理中かどうかを示すフラグ
  // true: 送信処理中（ボタンを無効化するために使用）
  isSubmittingReapplication = false;

  // ========== フォームグループ（各種申請フォーム） ==========
  // 各申請タイプに対応するフォームグループ
  // 現在は宣言のみで、必要に応じて初期化される
  
  // 扶養家族追加申請用のフォーム
  dependentApplicationForm!: FormGroup;
  
  // 扶養削除申請用のフォーム
  dependentRemovalForm!: FormGroup;
  
  // 住所変更申請用のフォーム
  addressChangeForm!: FormGroup;
  
  // 氏名変更申請用のフォーム
  nameChangeForm!: FormGroup;
  
  // マイナンバー変更申請用のフォーム
  myNumberChangeForm!: FormGroup;
  
  // 産前産後休業申請用のフォーム
  maternityLeaveForm!: FormGroup;
  
  // 退職申請用のフォーム
  resignationForm!: FormGroup;
  
  // 入社時申請用のフォーム
  onboardingApplicationForm!: FormGroup;

  // ========== ファイルアップロード用の変数 ==========
  // 各申請でアップロードされるファイルを保持
  
  // 扶養家族の基礎年金番号がわかる書類ファイル
  dependentBasicPensionNumberDocFile: File | null = null;
  
  // 扶養家族のマイナンバーがわかる書類ファイル
  dependentMyNumberDocFile: File | null = null;
  
  // 扶養家族の本人確認書類ファイル
  dependentIdentityDocFile: File | null = null;
  
  // 扶養家族の障害者手帳ファイル
  dependentDisabilityCardFile: File | null = null;
  
  // 履歴書ファイル（入社時申請などで使用）
  resumeFile: File | null = null;
  
  // 職務経歴書ファイル（入社時申請などで使用）
  careerHistoryFile: File | null = null;
  
  // 基礎年金番号がわかる書類ファイル
  basicPensionNumberDocFile: File | null = null;
  
  // 本人確認書類ファイル
  idDocumentFile: File | null = null;
  
  // 氏名変更時の本人確認書類ファイル
  nameChangeIdDocumentFile: File | null = null;
  
  // 産前産後休業申請の書類ファイル
  maternityLeaveDocumentFile: File | null = null;

  // ========== その他の状態変数 ==========
  
  // 住所変更申請で、新住所が旧住所と同じかどうかのフラグ
  sameAsOldAddress = false;
  
  // 住所変更申請で、新住所が現在の住所と同じかどうかのフラグ
  sameAsNewAddress = false;
  
  // 退職申請で、退職後の住所が現在の住所と同じかどうかのフラグ
  sameAsCurrentAddressForResignation = false;
  
  // 退職申請で、退職後の電話番号が現在の電話番号と同じかどうかのフラグ
  sameAsCurrentPhoneForResignation = false;
  
  // 退職申請で、退職後のメールアドレスが現在のメールアドレスと同じかどうかのフラグ
  sameAsCurrentEmailForResignation = false;
  
  // 現在の住所情報を保持するオブジェクト（退職申請などで使用）
  currentAddressInfo: any = {};
  
  // 現在の連絡先情報を保持するオブジェクト（退職申請などで使用）
  currentContactInfo: any = {};

  // ========== コンストラクタ（依存性注入） ==========
  constructor(
    private fb: FormBuilder, // フォームビルダー（フォームグループを作成するため）
    private firestoreService: FirestoreService, // Firestoreサービス（データベース操作のため）
    private cdr: ChangeDetectorRef // 変更検知リファレンス（手動で変更検知をトリガーするため）
  ) {}

  // ========== ライフサイクルフック ==========
  
  // コンポーネント初期化時に呼ばれるメソッド
  ngOnInit() {
    // フォームを初期化
    this.initializeForms();
  }

  // ========== フォーム初期化メソッド ==========
  
  // 各種申請フォームを初期化するメソッド
  // 現在は空実装で、必要に応じて各フォームを初期化する
  initializeForms() {
    // フォームは必要に応じて初期化
  }

  // ========== モーダル操作メソッド ==========
  
  // モーダルを閉じるメソッド
  closeModal() {
    // 再申請送信処理中は閉じる操作を無効化
    if (this.isSubmittingReapplication) {
      return;
    }
    // 編集モードを解除
    this.isEditModeForReapplication = false;
    // 親コンポーネントにモーダルを閉じるイベントを送信
    this.close.emit();
  }

  // ========== 再申請関連メソッド ==========
  
  // 差し戻し申請の編集モードを有効化するメソッド
  enableEditMode() {
    // 申請が存在し、かつステータスが「差し戻し」の場合のみ編集モードを有効化
    if (this.application && this.application.status === '差し戻し') {
      // 編集モードフラグをtrueに設定
      this.isEditModeForReapplication = true;
      // 申請データをフォームにロード
      this.loadApplicationDataToForm(this.application);
    }
  }

  // 再申請を送信するメソッド（非同期処理）
  async submitReapplication() {
    // 申請データが存在しない場合は処理を中断
    if (!this.application) {
      return;
    }
    
    // 既に送信処理中の場合は処理を中断（二重送信を防ぐ）
    if (this.isSubmittingReapplication) {
      return;
    }
    
    // 送信処理中フラグをtrueに設定（ボタンを無効化するため）
    this.isSubmittingReapplication = true;
    
    try {
      // 再申請処理は親コンポーネントに委譲
      // 親コンポーネントで実際の再申請処理を実行
      this.reapplicationSubmitted.emit();
    } finally {
      // 処理が完了したら送信処理中フラグをfalseに戻す
      this.isSubmittingReapplication = false;
    }
  }

  // 申請データをフォームにロードするメソッド
  // 現在は空実装で、必要に応じて各申請タイプに応じたフォームにデータを設定
  loadApplicationDataToForm(application: any) {
    // フォームにデータをロードする処理
    // 親コンポーネントから必要なメソッドを呼び出す
  }

  // ========== ヘルパーメソッド（表示用のフォーマット処理など） ==========
  
  // 基礎年金番号を表示用にフォーマットするメソッド
  // 例: "1234567890" → "1234-567890"
  formatBasicPensionNumberForDisplay(basicPensionNumber: string | null): string {
    // 基礎年金番号が存在しない、または10桁でない場合はそのまま返す（または"-"を返す）
    if (!basicPensionNumber || basicPensionNumber.length !== 10) {
      return basicPensionNumber || '-';
    }
    // 4桁目と5桁目の間にハイフンを挿入して返す
    return `${basicPensionNumber.substring(0, 4)}-${basicPensionNumber.substring(4)}`;
  }

  // マイナンバーを表示用にフォーマットするメソッド
  // 例: "123456789012" → "1234-5678-9012"
  formatMyNumberForDisplay(myNumber: string | null): string {
    // マイナンバーが存在しない、または12桁でない場合はそのまま返す（または"-"を返す）
    if (!myNumber || myNumber.length !== 12) {
      return myNumber || '-';
    }
    // 4桁目と5桁目の間、8桁目と9桁目の間にハイフンを挿入して返す
    return `${myNumber.substring(0, 4)}-${myNumber.substring(4, 8)}-${myNumber.substring(8)}`;
  }

  // 申請日を取得するメソッド
  // FirestoreのTimestampオブジェクトまたはDateオブジェクトからDateを取得
  getApplicationDate(application: any): Date | null {
    // createdAtプロパティが存在する場合
    if (application?.createdAt) {
      // FirestoreのTimestampオブジェクトの場合はtoDate()メソッドで変換
      // それ以外の場合はDateコンストラクタで変換
      return application.createdAt.toDate ? application.createdAt.toDate() : new Date(application.createdAt);
    }
    // applicationDateプロパティが存在する場合
    if (application?.applicationDate) {
      // FirestoreのTimestampオブジェクトの場合はtoDate()メソッドで変換
      // それ以外の場合はDateコンストラクタで変換
      return application.applicationDate.toDate ? application.applicationDate.toDate() : new Date(application.applicationDate);
    }
    // どちらも存在しない場合はnullを返す
    return null;
  }

  // 申請種類が実装済みの申請タイプ以外かどうかを判定するメソッド
  isOtherApplicationType(applicationType: string): boolean {
    // 実装済みの申請タイプのリスト
    const implementedTypes = [
      '扶養家族追加',
      '扶養削除申請',
      '住所変更申請',
      '氏名変更申請',
      '産前産後休業申請',
      '退職申請',
      '保険証再発行申請',
      '入社時申請',
      'マイナンバー変更申請'
    ];
    // 実装済みリストに含まれていない場合はtrueを返す
    return !implementedTypes.includes(applicationType);
  }

  // 申請に添付ファイルが存在するかどうかを判定するメソッド
  hasAttachmentFiles(application: any): boolean {
    // 以下のいずれかのファイルURLが存在する場合はtrueを返す
    // - 履歴書のURL
    // - 職務経歴書のURL
    // - 基礎年金番号がわかる書類のURL
    // - 本人確認書類のURL
    return !!(application?.resumeFileUrl || application?.careerHistoryFileUrl || 
              application?.basicPensionNumberDocFileUrl || application?.idDocumentFileUrl);
  }
}

