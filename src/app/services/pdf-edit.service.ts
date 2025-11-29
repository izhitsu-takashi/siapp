import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import { FirestoreService } from './firestore.service';

@Injectable({
  providedIn: 'root'
})
export class PdfEditService {
  // 文書タイプとPDFファイル名のマッピング
  private documentTypeToFileName: { [key: string]: string } = {
    '健康保険・厚生年金保険被保険者資格取得届': '被保険者資格取得届.pdf',
    '健康保険・厚生年金保険被保険者資格喪失届': '被保険者資格喪失届.pdf',
    '健康保険 任意継続被保険者資格取得申請書': '任意継続保険申請.pdf',
    '健康保険被扶養者（異動）届': '健康保険被扶養者（異動）届.pdf',
    '健康保険資格確認書交付申請書': '健康保険資格確認書交付申請書.pdf',
    '健康保険資格確認書再交付申請書': '健康保険資格確認書再交付申請書.pdf',
    '被保険者住所変更届': '住所変更届.pdf',
    '健康保険・厚生年金保険 被保険者住所変更届': '住所変更届.pdf',
    '被保険者氏名変更届': '氏名変更届.pdf',
    '産前産後休業取得者申出書／変更（終了）届': '産前産後休業届.pdf',
    '健康保険・厚生年金保険 産前産後休業取得者申出書／変更（終了）届': '産前産後休業届.pdf',
    '算定基礎届': '被保険者報酬月額算定基礎届.pdf',
    '被保険者報酬月額変更届': '被保険者報酬月額変更届.pdf',
    '健康保険・厚生年金保険被保険者賞与支払届': '被保険者賞与支払い届.pdf',
    '健康保険被保険者証再交付申請書': '健康保険資格確認書再交付申請書.pdf'
  };

  // 日本語フォントのキャッシュ
  private japaneseFontCache: Uint8Array | null = null;

  constructor(
    private http: HttpClient,
    private firestoreService: FirestoreService
  ) {}

  /**
   * 日本語フォントを読み込む
   * フォントファイルが存在する場合は読み込み、存在しない場合はnullを返す
   */
  async loadJapaneseFont(): Promise<Uint8Array | null> {
    // 既にキャッシュされている場合はそれを返す
    if (this.japaneseFontCache) {
      return this.japaneseFontCache;
    }

    try {
      // Noto Sans JP Regularフォントを読み込む
      // フォントファイルは src/assets/fonts/NotoSansJP-Regular.ttf に配置する必要があります
      const response = await this.http.get('/assets/fonts/NotoSansJP-Regular.ttf', {
        responseType: 'arraybuffer'
      }).toPromise();
      
      if (response) {
        this.japaneseFontCache = new Uint8Array(response);
        return this.japaneseFontCache;
      }
    } catch (error) {
      console.warn('日本語フォントファイルが見つかりません。英数字のみの記入になります。');
      console.warn('日本語フォントを使用する場合は、src/assets/fonts/NotoSansJP-Regular.ttf を配置してください。');
    }
    
    return null;
  }

  /**
   * PDFテンプレートを読み込む
   */
  async loadPdfTemplate(documentType: string): Promise<Uint8Array> {
    const fileName = this.documentTypeToFileName[documentType];
    if (!fileName) {
      throw new Error(`文書タイプ "${documentType}" に対応するPDFファイルが見つかりません`);
    }

    try {
      const response = await this.http.get(`/assets/${fileName}`, {
        responseType: 'arraybuffer'
      }).toPromise();
      
      if (!response) {
        throw new Error('PDFファイルの読み込みに失敗しました');
      }
      
      return new Uint8Array(response);
    } catch (error) {
      console.error('Error loading PDF template:', error);
      throw new Error(`PDFテンプレート "${fileName}" の読み込みに失敗しました`);
    }
  }

  /**
   * 従業員データをPDFに記入する
   */
  async fillPdfWithEmployeeData(
    documentType: string,
    employeeData: any
  ): Promise<Uint8Array> {
    try {
      // fontkitを動的にインポート
      // @pdf-lib/fontkitを使用（pdf-libの公式推奨パッケージ）
      let fontkit: any = null;
      try {
        // @ts-ignore - fontkitの型定義が不完全な場合があるため
        const fontkitModule = await import('@pdf-lib/fontkit');
        // デフォルトエクスポートまたは名前付きエクスポートを確認
        fontkit = fontkitModule.default || fontkitModule;
        console.log('@pdf-lib/fontkitを読み込みました');
      } catch (error) {
        // @pdf-lib/fontkitが失敗した場合、通常のfontkitを試す
        try {
          // @ts-ignore
          const fontkitModule = await import('fontkit');
          fontkit = fontkitModule.default || fontkitModule;
          console.log('fontkitを読み込みました');
        } catch (error2) {
          console.warn('fontkitの読み込みに失敗しました:', error2);
          fontkit = null;
        }
      }
      
      // PDFテンプレートを読み込む
      const pdfBytes = await this.loadPdfTemplate(documentType);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // fontkitを登録（カスタムフォントを使用するために必要）
      // pdf-lib v1.17.1では、registerFontkitはPDFDocumentのインスタンスメソッドとして存在する
      if (fontkit) {
        // PDFDocumentのインスタンスに対してregisterFontkitを呼び出す
        if (typeof (pdfDoc as any).registerFontkit === 'function') {
          (pdfDoc as any).registerFontkit(fontkit);
          console.log('fontkitを登録しました');
        } else {
          console.warn('pdfDoc.registerFontkitが存在しません。');
          console.warn('日本語フォントは使用できませんが、英数字のみで続行します。');
          fontkit = null; // fontkitを使用しない
        }
      } else {
        console.warn('fontkitが読み込まれていません。カスタムフォントは使用できません。');
      }
      
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // フォントを取得または埋め込み
      let font: PDFFont;
      let hasJapaneseFont = false;
      
      try {
        // 日本語フォントを読み込む
        const japaneseFontBytes = await this.loadJapaneseFont();
        
        if (japaneseFontBytes && fontkit) {
          // 日本語フォントを埋め込む（pdf-libのembedFontはフォントファイルのバイト配列を受け取る）
          font = await pdfDoc.embedFont(japaneseFontBytes);
          hasJapaneseFont = true;
          console.log('日本語フォントを埋め込みました');
        } else {
          // 日本語フォントが存在しない、またはfontkitが読み込まれていない場合は標準フォントを使用
          font = await pdfDoc.embedFont('Helvetica');
          console.warn('日本語フォントが見つかりません。日本語文字は表示できません。');
          if (!fontkit) {
            console.warn('fontkitが読み込まれていません。');
          }
          if (!japaneseFontBytes) {
            console.warn('日本語フォントを使用する場合は、src/assets/fonts/NotoSansJP-Regular.ttf を配置してください。');
          }
        }
      } catch (error) {
        console.error('フォントの埋め込みに失敗しました:', error);
        // フォントの埋め込みに失敗した場合はデフォルトフォントを使用
        try {
          font = await pdfDoc.embedFont('Helvetica');
        } catch (fallbackError) {
          throw new Error('フォントの埋め込みに失敗しました。fontkitが正しく設定されているか確認してください。');
        }
      }

      // 企業情報を取得（資格取得届の場合）
      let companyInfo: any = null;
      if (documentType === '健康保険・厚生年金保険被保険者資格取得届') {
        try {
          const settings = await this.firestoreService.getSettings();
          companyInfo = settings?.companyInfo || null;
          // デバッグログ
          console.log('Company info for PDF:', companyInfo);
          console.log('Full settings:', settings);
          if (companyInfo) {
            console.log('officeCodePart1:', companyInfo.officeCodePart1);
            console.log('officeCodePart2:', companyInfo.officeCodePart2);
            console.log('officeCode:', companyInfo.officeCode);
            // officeCodePart1とofficeCodePart2が存在しない場合、officeCodeから分割を試みる
            if (!companyInfo.officeCodePart1 && !companyInfo.officeCodePart2 && companyInfo.officeCode) {
              const officeCode = companyInfo.officeCode;
              const match = officeCode.match(/^(\d{0,2})([ァ-ヶーA-Za-z0-9]{0,4})?/);
              if (match) {
                companyInfo.officeCodePart1 = match[1] || '';
                companyInfo.officeCodePart2 = match[2] || '';
                console.log('Parsed from officeCode:', { officeCodePart1: companyInfo.officeCodePart1, officeCodePart2: companyInfo.officeCodePart2 });
              }
            }
          }
        } catch (error) {
          console.warn('企業情報の取得に失敗しました:', error);
        }
      }

      // 文書タイプに応じて記入処理を実行
      switch (documentType) {
        case '健康保険・厚生年金保険被保険者資格取得届':
          // employeeDataが配列の場合は複数人対応
          if (Array.isArray(employeeData)) {
            employeeData.forEach((empData, index) => {
              const yOffset = index * 121.5; // 2人目以降はy座標を130増やす
              const includeHeaderFields = index === 0 || index % 4 === 0; // 1人目と5人目、9人目...は①②③④⑤⑥⑦⑧を記入
              this.fillQualificationAcquisitionForm(firstPage, font, empData, hasJapaneseFont, companyInfo, yOffset, includeHeaderFields);
            });
          } else {
            // 単一の従業員データの場合（後方互換性のため）
            this.fillQualificationAcquisitionForm(firstPage, font, employeeData, hasJapaneseFont, companyInfo, 0, true);
          }
          break;
        case '健康保険・厚生年金保険被保険者資格喪失届':
          this.fillQualificationLossForm(firstPage, font, employeeData);
          break;
        case '健康保険 任意継続被保険者資格取得申請書':
          this.fillVoluntaryContinuationForm(firstPage, font, employeeData);
          break;
        case '健康保険被扶養者（異動）届':
          this.fillDependentChangeForm(firstPage, font, employeeData);
          break;
        case '健康保険資格確認書交付申請書':
          this.fillQualificationConfirmationForm(firstPage, font, employeeData);
          break;
        case '健康保険資格確認書再交付申請書':
          this.fillQualificationReissueForm(firstPage, font, employeeData);
          break;
        case '被保険者住所変更届':
          this.fillAddressChangeForm(firstPage, font, employeeData);
          break;
        case '被保険者氏名変更届':
          this.fillNameChangeForm(firstPage, font, employeeData);
          break;
        case '産前産後休業取得者申出書／変更（終了）届':
          this.fillMaternityLeaveForm(firstPage, font, employeeData);
          break;
        case '算定基礎届':
          this.fillStandardSalaryForm(firstPage, font, employeeData);
          break;
        case '被保険者報酬月額変更届':
          this.fillSalaryChangeForm(firstPage, font, employeeData);
          break;
        case '健康保険・厚生年金保険被保険者賞与支払届':
          this.fillBonusPaymentForm(firstPage, font, employeeData);
          break;
        default:
          console.warn(`文書タイプ "${documentType}" の記入処理が未実装です`);
      }

      // 編集したPDFを保存
      return await pdfDoc.save();
    } catch (error) {
      console.error('Error filling PDF:', error);
      throw error;
    }
  }

  /**
   * 被保険者資格取得届の記入
   * 座標ファイル（必要記入事項と座標.txt）に基づいて実装
   */
  private fillQualificationAcquisitionForm(
    page: any,
    font: PDFFont,
    employeeData: any,
    hasJapaneseFont: boolean = false,
    companyInfo: any = null,
    yOffset: number = 0,
    includeHeaderFields: boolean = true
  ) {
    const { width, height } = page.getSize();
    
    // フォントサイズの設定
    const fontSize = 10;
    const smallFontSize = 8;
    
    // y座標にオフセットを適用する関数
    const y = (baseY: number) => height - (baseY + yOffset);
    
    // ①提出日（本日の日付を令和〇年〇月〇日とする）
    if (includeHeaderFields) {
      const today = new Date();
      const reiwaYear = today.getFullYear() - 2018; // 令和年を計算
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      // 年の数字：(47,62) - x座標は各文字の左端
      const yearStr = String(reiwaYear).padStart(2, '0');
      let xPos = 47;
      for (let i = 0; i < yearStr.length; i++) {
        page.drawText(yearStr[i], {
          x: xPos,
          y: y(62),
          size: fontSize,
          font: font,
        });
        xPos += 5; // 次の文字の左端位置（間隔5座標分）
      }
      
      // 月の数字：(75,62) - x座標は各文字の左端
      xPos = 75;
      for (let i = 0; i < month.length; i++) {
        page.drawText(month[i], {
          x: xPos,
          y: y(62),
          size: fontSize,
          font: font,
        });
        xPos += 5; // 次の文字の左端位置（間隔5座標分）
      }
      
      // 日の数字：(105,62) - x座標は各文字の左端
      xPos = 105;
      for (let i = 0; i < day.length; i++) {
        page.drawText(day[i], {
          x: xPos,
          y: y(62),
          size: fontSize,
          font: font,
        });
        xPos += 5; // 次の文字の左端位置（間隔5座標分）
      }
      
      // ②事業所整理番号
      // officeCodePart1とofficeCodePart2から直接取得
      const officeCodePart1 = companyInfo?.officeCodePart1 || '';
      const officeCodePart2 = companyInfo?.officeCodePart2 || '';
      console.log('Office code parts:', { officeCodePart1, officeCodePart2 });
      
      // 最初の数字2桁(間隔はx座標13開ける）：(86,80)
      if (officeCodePart1) {
        let xPos = 88;
        for (let i = 0; i < officeCodePart1.length; i++) {
          page.drawText(officeCodePart1[i], {
            x: xPos,
            y: y(80),
            size: fontSize,
            font: font,
          });
          xPos += 13; // 次の文字の左端位置（間隔13座標分）
        }
      }
      
      // 第2部の英数字4桁(間隔はx座標13開ける）：(118,80)
      if (officeCodePart2) {
        let xPos = 118;
        for (let i = 0; i < officeCodePart2.length; i++) {
          page.drawText(officeCodePart2[i], {
            x: xPos,
            y: y(80),
            size: fontSize,
            font: font,
          });
          xPos += 13.5; // 次の文字の左端位置（間隔13座標分）
        }
      }
      
      // ③事業所番号(間隔はx座標17開ける）：(210,80)
      // x座標は各文字の左端として扱う
      if (companyInfo?.officeNumber) {
        const officeNumber = companyInfo.officeNumber;
        let xPos = 210;
        for (let i = 0; i < officeNumber.length; i++) {
          page.drawText(officeNumber[i], {
            x: xPos,
            y: y(80),
            size: fontSize,
            font: font,
          });
          xPos += 17; // 次の文字の左端位置（間隔17座標分）
        }
      }
      
      // ④事業所郵便番号
      // x座標は各文字の左端として扱う
      if (companyInfo?.officePostalCode) {
        const postalCode = companyInfo.officePostalCode.replace(/\D/g, '');
        // 最初の3桁：(80,101)
        if (postalCode.length >= 3) {
          let xPos = 80;
          for (let i = 0; i < 3; i++) {
            page.drawText(postalCode[i], {
              x: xPos,
              y: y(101),
              size: fontSize,
              font: font,
            });
            xPos += 5; // 次の文字の左端位置（間隔5座標分）
          }
        }
        // 残りの4桁：(123,101)
        if (postalCode.length >= 7) {
          let xPos = 123;
          for (let i = 3; i < 7; i++) {
            page.drawText(postalCode[i], {
              x: xPos,
              y: y(101),
              size: fontSize,
              font: font,
            });
            xPos += 5; // 次の文字の左端位置（間隔5座標分）
          }
        }
      }
      
      // ⑤事業所所在地：(65,120)
      // ※23文字を超えた以降の値は、(65,137)から追加で表示
      if (companyInfo?.officeAddress && hasJapaneseFont) {
        const address = companyInfo.officeAddress;
        if (address.length <= 23) {
          page.drawText(address, {
            x: 65,
            y: y(120),
            size: fontSize,
            font: font,
          });
        } else {
          // 最初の23文字
          page.drawText(address.substring(0, 23), {
            x: 65,
            y: y(120),
            size: fontSize,
            font: font,
          });
          // 23文字以降は(65,137)から表示
          page.drawText(address.substring(23), {
            x: 65,
            y: y(137),
            size: fontSize,
            font: font,
          });
        }
      }
      
      // ⑥事業所名称：(65,155)
      // ※23文字を超えた以降の値は、(65,171)から追加で表示
      if (companyInfo?.officeName && hasJapaneseFont) {
        const officeName = companyInfo.officeName;
        if (officeName.length <= 23) {
          page.drawText(officeName, {
            x: 65,
            y: y(155),
            size: fontSize,
            font: font,
          });
        } else {
          // 最初の23文字
          page.drawText(officeName.substring(0, 23), {
            x: 65,
            y: y(155),
            size: fontSize,
            font: font,
          });
          // 23文字以降は(65,171)から表示
          page.drawText(officeName.substring(23), {
            x: 65,
            y: y(171),
            size: fontSize,
            font: font,
          });
        }
      }
      
      // ⑦事業主氏名：(65,183)
      if (companyInfo?.employerName && hasJapaneseFont) {
        page.drawText(companyInfo.employerName, {
          x: 65,
          y: y(183),
          size: fontSize,
          font: font,
        });
      }
      
      // ⑧事業所電話番号
      // x座標は各文字の左端として扱う
      if (companyInfo?.officePhoneNumber) {
        const phone = companyInfo.officePhoneNumber.replace(/\D/g, '');
        // 最初の2桁：(115,203)
        if (phone.length >= 2) {
          let xPos = 115;
          for (let i = 0; i < 2; i++) {
            page.drawText(phone[i], {
              x: xPos,
              y: y(203),
              size: fontSize,
              font: font,
            });
            xPos += 5; // 次の文字の左端位置（間隔5座標分）
          }
        }
        // 次の4桁：(160,203)
        if (phone.length >= 6) {
          let xPos = 160;
          for (let i = 2; i < 6; i++) {
            page.drawText(phone[i], {
              x: xPos,
              y: y(203),
              size: fontSize,
              font: font,
            });
            xPos += 5; // 次の文字の左端位置（間隔5座標分）
          }
        }
        // 残った数字：(220,203)
        if (phone.length > 6) {
          let xPos = 220;
          for (let i = 6; i < phone.length; i++) {
            page.drawText(phone[i], {
              x: xPos,
              y: y(203),
              size: fontSize,
              font: font,
            });
            xPos += 5; // 次の文字の左端位置（間隔5座標分）
          }
        }
      }
    }
    
    // ⑨被保険者氏名（フリガナ）※小さめのフォント、指定したX座標は要素の中心
    const nameKana = employeeData.nameKana || '';
    if (nameKana && hasJapaneseFont) {
      // 姓と名を分割
      const nameKanaParts = this.splitName(nameKana);
      // 姓：(170,221) - X座標は要素の中心
      if (nameKanaParts.lastName) {
        const textWidth = this.getTextWidth(nameKanaParts.lastName, smallFontSize, font);
        page.drawText(nameKanaParts.lastName, {
          x: 170 - (textWidth / 2),
          y: y(221),
          size: smallFontSize,
          font: font,
        });
      }
      // 名：(280,221) - X座標は要素の中心
      if (nameKanaParts.firstName) {
        const textWidth = this.getTextWidth(nameKanaParts.firstName, smallFontSize, font);
        page.drawText(nameKanaParts.firstName, {
          x: 270 - (textWidth / 2),
          y: y(221),
          size: smallFontSize,
          font: font,
        });
      }
    }
    
    // ⑩被保険者氏名（漢字）※指定したX座標は要素の中心
    const name = employeeData.name || '';
    if (name && hasJapaneseFont) {
      // 姓と名を分割
      const nameParts = this.splitName(name);
      // 姓：(180,240) - X座標は要素の中心
      if (nameParts.lastName) {
        const textWidth = this.getTextWidth(nameParts.lastName, fontSize, font);
        page.drawText(nameParts.lastName, {
          x: 170 - (textWidth / 2),
          y: y(240),
          size: fontSize,
          font: font,
        });
      }
      // 名：(295,240) - X座標は要素の中心
      if (nameParts.firstName) {
        const textWidth = this.getTextWidth(nameParts.firstName, fontSize, font);
        page.drawText(nameParts.firstName, {
          x: 270 - (textWidth / 2),
          y: y(240),
          size: fontSize,
          font: font,
        });
      }
    }
    
    // ⑪生年月日※昭和/平成/令和〇年〇月〇日方式、元号は指定の座標に直径8座標分の丸を付ける
    if (employeeData.birthDate) {
      const birthDate = new Date(employeeData.birthDate);
      const era = this.getEra(birthDate);
      const eraYear = this.getEraYear(birthDate, era);
      const month = String(birthDate.getMonth() + 1).padStart(2, '0');
      const day = String(birthDate.getDate()).padStart(2, '0');
      
      // 元号の丸を描画（直径3座標分）
      if (era === '昭和') {
        this.drawCircle(page, 363, y(220), 1.5, font);
      } else if (era === '平成') {
        this.drawCircle(page, 363, y(230), 1.5, font);
      } else if (era === '令和') {
        this.drawCircle(page, 363, y(240), 1.5, font);
      }
      
      // 年（1月の場合は01と記入。間隔はx座標12開ける。月も日も同様）：(382,233)
      // x座標は各文字の左端として扱う
      let xPos = 382;
      const yearStr = String(eraYear).padStart(2, '0');
      for (let i = 0; i < yearStr.length; i++) {
        page.drawText(yearStr[i], {
          x: xPos,
          y: y(233),
          size: fontSize,
          font: font,
        });
        xPos += 12; // 次の文字の左端位置（間隔12座標分）
      }
      
      // 月：(408,233)
      xPos = 408;
      for (let i = 0; i < month.length; i++) {
        page.drawText(month[i], {
          x: xPos,
          y: y(233),
          size: fontSize,
          font: font,
        });
        xPos += 12; // 次の文字の左端位置（間隔12座標分）
      }
      
      // 日：(433,233)
      xPos = 433;
      for (let i = 0; i < day.length; i++) {
        page.drawText(day[i], {
          x: xPos,
          y: y(233),
          size: fontSize,
          font: font,
        });
        xPos += 12; // 次の文字の左端位置（間隔12座標分）
      }
    }
    
    // ⑫性別※指定の場所に直径4座標分の〇を付ける
    const gender = employeeData.gender || '';
    console.log('Gender for PDF:', gender, 'from employeeData:', employeeData);
    if (gender === '男' || gender === '男性') {
      this.drawCircle(page, 492, y(220), 2, font);
    } else if (gender === '女' || gender === '女性') {
      this.drawCircle(page, 492, y(227), 2, font);
    }
    
    // ⑬指定の場所に直径4座標分の〇付け：(62,252)
    this.drawCircle(page, 62, y(252), 2, font);
    
    // ⑭マイナンバー（マイナンバーの情報が無い場合は基礎年金番号を入力、どちらの場合も数字の間隔を12座標分開ける）
    let myNumber = '';
    if (employeeData?.myNumber && employeeData.myNumber.length === 12) {
      myNumber = employeeData.myNumber.replace(/\D/g, '');
    } else if (employeeData?.myNumberPart1 && employeeData?.myNumberPart2 && employeeData?.myNumberPart3) {
      myNumber = (employeeData.myNumberPart1 + employeeData.myNumberPart2 + employeeData.myNumberPart3).replace(/\D/g, '');
    }
    
    let basicPensionNumber = '';
    if (employeeData?.basicPensionNumber) {
      basicPensionNumber = String(employeeData.basicPensionNumber).replace(/\D/g, '');
    } else if (employeeData?.basicPensionNumberPart1 && employeeData?.basicPensionNumberPart2) {
      basicPensionNumber = (employeeData.basicPensionNumberPart1 + employeeData.basicPensionNumberPart2).replace(/\D/g, '');
    }
    
    // マイナンバー(ハイフンなしで12桁ならべて入力)：(123,267)
    // 基礎年金番号(ハイフンなしで10桁ならべて入力)：(123,267)
    // x座標は各文字の左端として扱う、間隔は18座標分
    let hasMyNumber = false;
    if (myNumber && myNumber.length === 12) {
      hasMyNumber = true;
      let xPos = 123;
      for (let i = 0; i < myNumber.length; i++) {
        page.drawText(myNumber[i], {
          x: xPos,
          y: y(267),
          size: fontSize,
          font: font,
        });
        xPos += 17.5; // 次の文字の左端位置（間隔18座標分）
      }
    } else if (basicPensionNumber && basicPensionNumber.length === 10) {
      let xPos = 123;
      for (let i = 0; i < basicPensionNumber.length; i++) {
        page.drawText(basicPensionNumber[i], {
          x: xPos,
          y: y(267),
          size: fontSize,
          font: font,
        });
        xPos += 17.5; // 次の文字の左端位置（間隔18座標分）
      }
    }
    
    // ⑮資格取得年月日（令和〇年〇月〇日の形式で入力）
    if (employeeData.socialInsuranceAcquisitionDate) {
      const acquisitionDate = new Date(employeeData.socialInsuranceAcquisitionDate);
      const reiwaYearAcq = acquisitionDate.getFullYear() - 2018;
      const monthAcq = String(acquisitionDate.getMonth() + 1).padStart(2, '0');
      const dayAcq = String(acquisitionDate.getDate()).padStart(2, '0');
      
      // 年（令和１年の場合は01と入力、間隔はx座標12開ける。月も日も同様）：(382,267)
      // x座標は各文字の左端として扱う
      let xPos = 382;
      const yearStrAcq = String(reiwaYearAcq).padStart(2, '0');
      for (let i = 0; i < yearStrAcq.length; i++) {
        page.drawText(yearStrAcq[i], {
          x: xPos,
          y: y(267),
          size: fontSize,
          font: font,
        });
        xPos += 12; // 次の文字の左端位置（間隔12座標分）
      }
      
      // 月：(408,267)
      xPos = 408;
      for (let i = 0; i < monthAcq.length; i++) {
        page.drawText(monthAcq[i], {
          x: xPos,
          y: y(267),
          size: fontSize,
          font: font,
        });
        xPos += 12; // 次の文字の左端位置（間隔12座標分）
      }
      
      // 日：(433,267)
      xPos = 433;
      for (let i = 0; i < dayAcq.length; i++) {
        page.drawText(dayAcq[i], {
          x: xPos,
          y: y(267),
          size: fontSize,
          font: font,
        });
        xPos += 12; // 次の文字の左端位置（間隔12座標分）
      }
    }
    
    // ⑯被扶養者（指定の場所に直径8座標分の丸を付ける）
    const dependentStatus = employeeData.dependentStatus || '';
    const hasDependentsValue = employeeData.hasDependents || '';
    const hasDependents = hasDependentsValue === 'true' || dependentStatus === '有';
    
    console.log('被扶養者情報チェック:', { 
      dependentStatus, 
      hasDependentsValue, 
      hasDependents,
      yOffset,
      yPosition: y(263)
    });
    
    // 被扶養者のy座標を計算
    const dependentY = y(263);
    const dependentX = hasDependents ? 544 : 500;
    
    console.log('被扶養者情報チェック:', { 
      dependentStatus, 
      hasDependentsValue, 
      hasDependents,
      yOffset,
      yPosition: dependentY,
      xPosition: dependentX,
      height: height,
      width: width,
      baseY: 263
    });
    
    // 座標がページの範囲内かチェック
    if (dependentX < 0 || dependentX > width || dependentY < 0 || dependentY > height) {
      console.warn('被扶養者情報の座標がページ範囲外:', { x: dependentX, y: dependentY, width, height });
    }
    
    if (hasDependents) {
      // 被扶養者が「有」の場合
      console.log('被扶養者「有」: 座標(', dependentX, ',', dependentY, ')に〇を描画');
      this.drawCircle(page, dependentX, dependentY, 4, font);
      console.log('被扶養者「有」の〇描画完了');
    } else {
      // 被扶養者が「無」の場合、または未設定の場合
      console.log('被扶養者「無」または未設定: 座標(', dependentX, ',', dependentY, ')に〇を描画');
      // 「無」の場合も必ず描画を実行
      this.drawCircle(page, dependentX, dependentY, 4, font);
      console.log('被扶養者「無」の〇描画完了');
    }
    
    // ⑰見込み給与額
    // 給与：expectedMonthlySalary
    // 現物：expectedMonthlySalaryInKind
    // 合計額：給与と現物の合計
    const expectedMonthlySalary = parseFloat(employeeData.expectedMonthlySalary) || 0;
    const expectedMonthlySalaryInKind = parseFloat(employeeData.expectedMonthlySalaryInKind) || 0;
    const totalSalary = expectedMonthlySalary + expectedMonthlySalaryInKind;
    console.log('Salary info:', { expectedMonthlySalary, expectedMonthlySalaryInKind, totalSalary });
    
    // 給与：(110,292)
    if (expectedMonthlySalary > 0) {
      const salaryStr = String(Math.floor(expectedMonthlySalary));
      let xPos = 110;
      for (let i = 0; i < salaryStr.length; i++) {
        page.drawText(salaryStr[i], {
          x: xPos,
          y: y(292),
          size: fontSize,
          font: font,
        });
        xPos += 5; // 次の文字の左端位置（間隔5座標分）
      }
    }
    
    // 現物：(110,305)
    if (expectedMonthlySalaryInKind > 0) {
      const inKindStr = String(Math.floor(expectedMonthlySalaryInKind));
      let xPos = 110;
      for (let i = 0; i < inKindStr.length; i++) {
        page.drawText(inKindStr[i], {
          x: xPos,
          y: y(305),
          size: fontSize,
          font: font,
        });
        xPos += 5; // 次の文字の左端位置（間隔5座標分）
      }
    }
    
    // 給与と現物の合計額(数字の間隔を13座標分開ける、この要素だけx座標右詰め）：(318,305)
    if (totalSalary > 0) {
      const totalStr = String(Math.floor(totalSalary));
      // 右詰め：最後の文字の右端が318になるように計算
      let xPos = 318 - (totalStr.length * 13);
      for (let i = 0; i < totalStr.length; i++) {
        page.drawText(totalStr[i], {
          x: xPos,
          y: y(305),
          size: fontSize,
          font: font,
        });
        xPos += 13; // 次の文字の左端位置（間隔13座標分）
      }
    }
    
    // ⑱備考(条件に当てはまれば指定の位置に直径4座標分の丸を付ける)
    // 年齢を計算（生年月日から）
    let age = 0;
    if (employeeData.birthDate) {
      const birthDate = new Date(employeeData.birthDate);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    } else if (employeeData.age) {
      age = parseInt(employeeData.age) || 0;
    }
    
    // 雇用形態が「短時間労働者」かチェック
    const isPartTime = employeeData.employmentType === '短時間労働者';
    
    // 70歳以上の場合
    if (age >= 70) {
      this.drawCircle(page, 372, y(293), 2, font);
    }
    // 短時間労働者の場合
    if (isPartTime) {
      this.drawCircle(page, 455, y(284), 2, font);
    }
    
    // ⑲被保険者住所（⑭にてマイナンバーを記入した場合はPDFに情報を記入しない）
    // 基礎年金番号を記入した場合のみ記入
    if (!hasMyNumber && basicPensionNumber && basicPensionNumber.length === 10) {
      const postalCode = (employeeData.currentPostalCode || employeeData.postalCode || '').replace(/\D/g, '');
      const address = employeeData.currentAddress || employeeData.address || '';
      const addressKana = employeeData.currentAddressKana || employeeData.addressKana || '';
      
      // 被保険者住所欄のフォントサイズ（統一）
      const verySmallFontSize = 6; // さらに小さなフォントサイズ
      
      // 郵便番号の最初の3桁：(72,321)
      // x座標は各文字の左端として扱う
      if (postalCode.length >= 3) {
        let xPos = 72;
        for (let i = 0; i < 3; i++) {
          page.drawText(postalCode[i], {
            x: xPos,
            y: y(321),
            size: verySmallFontSize,
            font: font,
          });
          xPos += 3; // 次の文字の左端位置（さらに小さめフォントなので間隔3座標分）
        }
      }
      
      // 郵便番号の残りの4桁：(97,321)
      if (postalCode.length >= 7) {
        let xPos = 97;
        for (let i = 3; i < 7; i++) {
          page.drawText(postalCode[i], {
            x: xPos,
            y: y(321),
            size: verySmallFontSize,
            font: font,
          });
          xPos += 3; // 次の文字の左端位置（さらに小さめフォントなので間隔3座標分）
        }
      }
      
      // 住所（さらに小さめのフォント、折り返しなし）：(63,328)
      if (address && hasJapaneseFont) {
        page.drawText(address, {
          x: 63,
          y: y(328),
          size: verySmallFontSize,
          font: font,
        });
      }
      
      // 住所（ヨミガナ）（さらに小さめのフォント）：(140,319)
      if (addressKana && hasJapaneseFont) {
        page.drawText(addressKana, {
          x: 140,
          y: y(321),
          size: verySmallFontSize,
          font: font,
        });
      }
    }
    
    // ⑳資格確認書発行要否（必要の場合のみ指定の場所に✓を付ける）
    const qualificationCertificateRequired = employeeData.qualificationCertificateRequired || 
                                            employeeData.applicationData?.qualificationCertificateRequired;
    if (qualificationCertificateRequired === '必要') {
      // チェックマークを描画：(490,325)
      this.drawCheckMark(page, 493, y(318), font);
    }
    
    console.log('被保険者資格取得届の記入処理を実行しました');
  }
  
  /**
   * テキストを折り返して描画する
   */
  private drawTextWithWrap(
    page: any,
    font: PDFFont,
    text: string,
    x: number,
    y: number,
    maxX: number,
    fontSize: number,
    hasJapaneseFont: boolean,
    wrapX?: number,
    wrapY?: number
  ) {
    if (!hasJapaneseFont) return;
    
    let currentX = x;
    let currentY = y;
    const charWidth = fontSize * 0.6; // おおよその文字幅
    const wrapStartX = wrapX !== undefined ? wrapX : x;
    const wrapStartY = wrapY !== undefined ? wrapY : y;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (currentX + charWidth > maxX) {
        // 折り返し（文字の間隔は変更せず、指定位置から折り返し）
        currentX = wrapStartX;
        currentY -= fontSize * 1.2; // 行間
      }
      page.drawText(char, {
        x: currentX,
        y: currentY,
        size: fontSize,
        font: font,
      });
      currentX += charWidth;
    }
  }
  
  /**
   * 名前を姓と名に分割する
   */
  private splitName(name: string): { lastName: string; firstName: string } {
    if (!name) return { lastName: '', firstName: '' };
    
    // スペースまたは全角スペースで分割
    const parts = name.split(/[\s　]+/);
    if (parts.length >= 2) {
      return {
        lastName: parts[0],
        firstName: parts.slice(1).join(' ')
      };
    }
    
    // 分割できない場合は、2文字目以降を名とする（簡易的な処理）
    if (name.length > 1) {
      return {
        lastName: name.substring(0, 1),
        firstName: name.substring(1)
      };
    }
    
    return { lastName: name, firstName: '' };
  }
  
  /**
   * テキストの幅を計算する（おおよその値）
   */
  private getTextWidth(text: string, fontSize: number, font: PDFFont): number {
    // 日本語文字は約1.0倍、英数字は約0.6倍の幅と仮定
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      // 日本語文字（ひらがな、カタカナ、漢字）の判定
      if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(char)) {
        width += fontSize * 1.0;
      } else {
        width += fontSize * 0.6;
      }
    }
    return width;
  }
  
  /**
   * 日付から元号を取得する
   */
  private getEra(date: Date): '昭和' | '平成' | '令和' {
    const year = date.getFullYear();
    if (year >= 2019) return '令和';
    if (year >= 1989) return '平成';
    return '昭和';
  }
  
  /**
   * 日付から元号年を取得する
   */
  private getEraYear(date: Date, era: '昭和' | '平成' | '令和'): number {
    const year = date.getFullYear();
    if (era === '令和') return year - 2018;
    if (era === '平成') return year - 1988;
    return year - 1925;
  }
  
  /**
   * 円を描画する
   */
  private drawCircle(page: any, x: number, y: number, radius: number, font?: PDFFont) {
    console.log(`drawCircle called: x=${x}, y=${y}, radius=${radius}`);
    try {
      // pdf-libのdrawCircleを使用
      page.drawCircle({
        x: x,
        y: y,
        size: radius * 2,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
      console.log(`drawCircle succeeded: x=${x}, y=${y}, radius=${radius}`);
    } catch (error) {
      // drawCircleが存在しない場合は、テキストで円を描画（簡易的な方法）
      console.warn('drawCircle failed, using text fallback:', error);
      if (font) {
        try {
          page.drawText('○', {
            x: x - radius,
            y: y - radius,
            size: radius * 2,
            font: font,
          });
          console.log(`drawCircle text fallback succeeded: x=${x}, y=${y}, radius=${radius}`);
        } catch (textError) {
          console.error('Failed to draw circle with text:', textError);
          // 最後の手段として、小さな円を線で描画
          try {
            const path = page.path();
            for (let angle = 0; angle < 360; angle += 10) {
              const rad = (angle * Math.PI) / 180;
              const px = x + radius * Math.cos(rad);
              const py = y + radius * Math.sin(rad);
              if (angle === 0) {
                path.moveTo(px, py);
              } else {
                path.lineTo(px, py);
              }
            }
            path.closePath();
            page.drawPath(path);
            console.log(`drawCircle path fallback succeeded: x=${x}, y=${y}, radius=${radius}`);
          } catch (pathError) {
            console.error('Failed to draw circle with path:', pathError);
          }
        }
      } else {
        console.warn('No font available for circle drawing');
      }
    }
  }
  
  /**
   * チェックマークを描画する
   */
  private drawCheckMark(page: any, x: number, y: number, font?: PDFFont) {
    // チェックマークをテキストで描画（簡易的な方法）
    if (font) {
      try {
        page.drawText('✓', {
          x: x - 3,
          y: y - 3,
          size: 6,
          font: font,
        });
      } catch (error) {
        // フォントにチェックマークが含まれていない場合は、線で描画を試みる
        // 代替実装：小さな四角形でチェックマークを表現
        page.drawText('✓', {
          x: x - 3,
          y: y - 3,
          size: 6,
        });
      }
    }
  }

  /**
   * 被保険者資格喪失届の記入
   */
  private fillQualificationLossForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('被保険者資格喪失届の記入処理（座標調整が必要）');
  }

  /**
   * 任意継続被保険者資格取得申請書の記入
   */
  private fillVoluntaryContinuationForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('任意継続被保険者資格取得申請書の記入処理（座標調整が必要）');
  }

  /**
   * 健康保険被扶養者（異動）届の記入
   */
  private fillDependentChangeForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('健康保険被扶養者（異動）届の記入処理（座標調整が必要）');
  }

  /**
   * 健康保険資格確認書交付申請書の記入
   */
  private fillQualificationConfirmationForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('健康保険資格確認書交付申請書の記入処理（座標調整が必要）');
  }

  /**
   * 健康保険資格確認書再交付申請書の記入
   */
  private fillQualificationReissueForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('健康保険資格確認書再交付申請書の記入処理（座標調整が必要）');
  }

  /**
   * 被保険者住所変更届の記入
   */
  private fillAddressChangeForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('被保険者住所変更届の記入処理（座標調整が必要）');
  }

  /**
   * 被保険者氏名変更届の記入
   */
  private fillNameChangeForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('被保険者氏名変更届の記入処理（座標調整が必要）');
  }

  /**
   * 産前産後休業取得者申出書／変更（終了）届の記入
   */
  private fillMaternityLeaveForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('産前産後休業取得者申出書／変更（終了）届の記入処理（座標調整が必要）');
  }

  /**
   * 算定基礎届の記入
   */
  private fillStandardSalaryForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('算定基礎届の記入処理（座標調整が必要）');
  }

  /**
   * 被保険者報酬月額変更届の記入
   */
  private fillSalaryChangeForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('被保険者報酬月額変更届の記入処理（座標調整が必要）');
  }

  /**
   * 健康保険・厚生年金保険被保険者賞与支払届の記入
   */
  private fillBonusPaymentForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('健康保険・厚生年金保険被保険者賞与支払届の記入処理（座標調整が必要）');
  }

  /**
   * PDFをダウンロードする
   */
  downloadPdf(pdfBytes: Uint8Array, fileName: string) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * PDFの座標を確認するためのヘルパーメソッド
   * デバッグ用: PDFの各位置にテキストを配置して座標を確認
   */
  async debugPdfCoordinates(documentType: string): Promise<Uint8Array> {
    try {
      const pdfBytes = await this.loadPdfTemplate(documentType);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const font = await pdfDoc.embedFont('Helvetica');
      const { width, height } = firstPage.getSize();

      // 座標グリッドを描画（デバッグ用）
      const gridSize = 50;
      for (let x = 0; x < width; x += gridSize) {
        for (let y = 0; y < height; y += gridSize) {
          firstPage.drawText(`(${x},${y})`, {
            x: x,
            y: height - y,
            size: 8,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
      }

      return await pdfDoc.save();
    } catch (error) {
      console.error('Error in debugPdfCoordinates:', error);
      throw error;
    }
  }

  /**
   * 日付をフォーマットする（YYYY-MM-DD → YYYY年MM月DD日）
   */
  private formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}年${month}月${day}日`;
    } catch (error) {
      return dateString;
    }
  }

  /**
   * 郵便番号をフォーマットする（1234567 → 123-4567）
   */
  private formatPostalCode(postalCode: string | null | undefined): string {
    if (!postalCode) return '';
    const cleaned = postalCode.replace(/\D/g, '');
    if (cleaned.length === 7) {
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`;
    }
    return postalCode;
  }

  /**
   * 電話番号をフォーマットする
   */
  private formatPhoneNumber(phone: string | null | undefined): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }
}

