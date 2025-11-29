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
        } catch (error) {
          console.warn('企業情報の取得に失敗しました:', error);
        }
      }

      // 文書タイプに応じて記入処理を実行
      switch (documentType) {
        case '健康保険・厚生年金保険被保険者資格取得届':
          this.fillQualificationAcquisitionForm(firstPage, font, employeeData, hasJapaneseFont, companyInfo);
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
    companyInfo: any = null
  ) {
    const { width, height } = page.getSize();
    
    // フォントサイズの設定
    const fontSize = 10;
    const smallFontSize = 8;
    
    // ①提出日（本日の日付を令和〇年〇月〇日とする）
    const today = new Date();
    const reiwaYear = today.getFullYear() - 2018; // 令和年を計算
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // 年の数字：(35,60)
    page.drawText(String(reiwaYear).padStart(2, '0'), {
      x: 35,
      y: height - 60,
      size: fontSize,
      font: font,
    });
    
    // 月の数字：(65,60)
    page.drawText(month, {
      x: 65,
      y: height - 60,
      size: fontSize,
      font: font,
    });
    
    // 日の数字：(93,60)
    page.drawText(day, {
      x: 93,
      y: height - 60,
      size: fontSize,
      font: font,
    });
    
    // ②事業所整理番号
    if (companyInfo?.officeCode) {
      const officeCode = companyInfo.officeCode;
      // 最初の数字2桁(間隔はx座標10くらい開ける）：(80,80)
      if (officeCode.length >= 2) {
        const part1 = officeCode.substring(0, 2);
        page.drawText(part1, {
          x: 80,
          y: height - 80,
          size: fontSize,
          font: font,
        });
      }
      // 英数字4桁(間隔はx座標10くらい開ける）：(105,80)
      if (officeCode.length >= 6) {
        const part2 = officeCode.substring(2, 6);
        page.drawText(part2, {
          x: 105,
          y: height - 80,
          size: fontSize,
          font: font,
        });
      }
    }
    
    // ③事業所番号(間隔はx座標12くらい開ける）：(197,80)
    if (companyInfo?.officeNumber) {
      const officeNumber = companyInfo.officeNumber;
      let xPos = 197;
      for (let i = 0; i < officeNumber.length; i++) {
        page.drawText(officeNumber[i], {
          x: xPos,
          y: height - 80,
          size: fontSize,
          font: font,
        });
        xPos += 12;
      }
    }
    
    // ④事業所郵便番号
    if (companyInfo?.officePostalCode) {
      const postalCode = companyInfo.officePostalCode.replace(/\D/g, '');
      // 最初の3桁：(70,103)
      if (postalCode.length >= 3) {
        page.drawText(postalCode.substring(0, 3), {
          x: 70,
          y: height - 103,
          size: fontSize,
          font: font,
        });
      }
      // 残りの4桁：(110,103)
      if (postalCode.length >= 7) {
        page.drawText(postalCode.substring(3, 7), {
          x: 110,
          y: height - 103,
          size: fontSize,
          font: font,
        });
      }
    }
    
    // ⑤事業所所在地：(50,120)※表示がx=270を超える場合は文字を少し小さくして折り返し表示する。
    if (companyInfo?.officeAddress && hasJapaneseFont) {
      const address = companyInfo.officeAddress;
      this.drawTextWithWrap(page, font, address, 50, height - 120, 270, fontSize, hasJapaneseFont);
    }
    
    // ⑥事業所名称：(50,160)※表示がx=270を超える場合は文字を少し小さくして折り返し表示する。
    if (companyInfo?.officeName && hasJapaneseFont) {
      const officeName = companyInfo.officeName;
      this.drawTextWithWrap(page, font, officeName, 50, height - 160, 270, fontSize, hasJapaneseFont);
    }
    
    // ⑦事業主氏名：(50,180)
    if (companyInfo?.employerName && hasJapaneseFont) {
      page.drawText(companyInfo.employerName, {
        x: 50,
        y: height - 180,
        size: fontSize,
        font: font,
      });
    }
    
    // ⑧事業所電話番号
    if (companyInfo?.officePhoneNumber) {
      const phone = companyInfo.officePhoneNumber.replace(/\D/g, '');
      // 最初の2桁：(90,202)
      if (phone.length >= 2) {
        page.drawText(phone.substring(0, 2), {
          x: 90,
          y: height - 202,
          size: fontSize,
          font: font,
        });
      }
      // 次の4桁：(150,202)
      if (phone.length >= 6) {
        page.drawText(phone.substring(2, 6), {
          x: 150,
          y: height - 202,
          size: fontSize,
          font: font,
        });
      }
      // 残った数字：(205,202)
      if (phone.length > 6) {
        page.drawText(phone.substring(6), {
          x: 205,
          y: height - 202,
          size: fontSize,
          font: font,
        });
      }
    }
    
    // ⑨被保険者氏名（フリガナ）※小さめのフォント
    const nameKana = employeeData.nameKana || '';
    if (nameKana && hasJapaneseFont) {
      // 姓と名を分割
      const nameKanaParts = this.splitName(nameKana);
      // 姓：(135,220)
      if (nameKanaParts.lastName) {
        page.drawText(nameKanaParts.lastName, {
          x: 135,
          y: height - 220,
          size: smallFontSize,
          font: font,
        });
      }
      // 名：(235,220)
      if (nameKanaParts.firstName) {
        page.drawText(nameKanaParts.firstName, {
          x: 235,
          y: height - 220,
          size: smallFontSize,
          font: font,
        });
      }
    }
    
    // ⑩被保険者氏名（漢字）
    const name = employeeData.name || '';
    if (name && hasJapaneseFont) {
      // 姓と名を分割
      const nameParts = this.splitName(name);
      // 姓：(130,238)
      if (nameParts.lastName) {
        page.drawText(nameParts.lastName, {
          x: 130,
          y: height - 238,
          size: fontSize,
          font: font,
        });
      }
      // 名：(235,238)
      if (nameParts.firstName) {
        page.drawText(nameParts.firstName, {
          x: 235,
          y: height - 238,
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
      
      // 元号の丸を描画
      if (era === '昭和') {
        this.drawCircle(page, 350, height - 222, 4, font);
      } else if (era === '平成') {
        this.drawCircle(page, 350, height - 230, 4, font);
      } else if (era === '令和') {
        this.drawCircle(page, 350, height - 240, 4, font);
      }
      
      // 年（1月の場合は01と記入。数字の間隔を5座標分開ける。月も日も同様）：(370,230)
      let xPos = 370;
      const yearStr = String(eraYear).padStart(2, '0');
      for (let i = 0; i < yearStr.length; i++) {
        page.drawText(yearStr[i], {
          x: xPos,
          y: height - 230,
          size: fontSize,
          font: font,
        });
        xPos += 5;
      }
      
      // 月：(390,230)
      xPos = 390;
      for (let i = 0; i < month.length; i++) {
        page.drawText(month[i], {
          x: xPos,
          y: height - 230,
          size: fontSize,
          font: font,
        });
        xPos += 5;
      }
      
      // 日：(413,230)
      xPos = 413;
      for (let i = 0; i < day.length; i++) {
        page.drawText(day[i], {
          x: xPos,
          y: height - 230,
          size: fontSize,
          font: font,
        });
        xPos += 5;
      }
    }
    
    // ⑫性別※指定の場所に直径6座標分の〇を付ける
    const gender = employeeData.gender || '';
    if (gender === '男') {
      this.drawCircle(page, 480, height - 223, 3, font);
    } else if (gender === '女') {
      this.drawCircle(page, 480, height - 228, 3, font);
    }
    
    // ⑬指定の場所に直径6座標分の〇付け：(49,252)
    this.drawCircle(page, 49, height - 252, 3, font);
    
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
    
    // マイナンバー(ハイフンなしで12桁ならべて入力)：(102,265)
    // 基礎年金番号(ハイフンなしで10桁ならべて入力)：(102,265)
    if (myNumber && myNumber.length === 12) {
      let xPos = 102;
      for (let i = 0; i < myNumber.length; i++) {
        page.drawText(myNumber[i], {
          x: xPos,
          y: height - 265,
          size: fontSize,
          font: font,
        });
        xPos += 12;
      }
    } else if (basicPensionNumber && basicPensionNumber.length === 10) {
      let xPos = 102;
      for (let i = 0; i < basicPensionNumber.length; i++) {
        page.drawText(basicPensionNumber[i], {
          x: xPos,
          y: height - 265,
          size: fontSize,
          font: font,
        });
        xPos += 12;
      }
    }
    
    // ⑮資格取得年月日（令和〇年〇月〇日の形式で入力）
    if (employeeData.socialInsuranceAcquisitionDate) {
      const acquisitionDate = new Date(employeeData.socialInsuranceAcquisitionDate);
      const reiwaYearAcq = acquisitionDate.getFullYear() - 2018;
      const monthAcq = String(acquisitionDate.getMonth() + 1).padStart(2, '0');
      const dayAcq = String(acquisitionDate.getDate()).padStart(2, '0');
      
      // 年（令和１年の場合は01と入力、間隔5座標分開ける。月も日も同様）：(370,265)
      let xPos = 370;
      const yearStrAcq = String(reiwaYearAcq).padStart(2, '0');
      for (let i = 0; i < yearStrAcq.length; i++) {
        page.drawText(yearStrAcq[i], {
          x: xPos,
          y: height - 265,
          size: fontSize,
          font: font,
        });
        xPos += 5;
      }
      
      // 月：(389,265)
      xPos = 389;
      for (let i = 0; i < monthAcq.length; i++) {
        page.drawText(monthAcq[i], {
          x: xPos,
          y: height - 265,
          size: fontSize,
          font: font,
        });
        xPos += 5;
      }
      
      // 日：(425,265)
      xPos = 425;
      for (let i = 0; i < dayAcq.length; i++) {
        page.drawText(dayAcq[i], {
          x: xPos,
          y: height - 265,
          size: fontSize,
          font: font,
        });
        xPos += 5;
      }
    }
    
    // ⑯被扶養者（指定の場所に直径8座標分の丸を付ける）
    const hasDependents = employeeData.hasDependents === 'true' || employeeData.dependentStatus === '有';
    if (hasDependents) {
      this.drawCircle(page, 527, height - 265, 4, font);
    } else {
      this.drawCircle(page, 483, height - 265, 4, font);
    }
    
    // ⑰見込み給与額
    const standardMonthlySalary = employeeData.standardMonthlySalary || 0;
    if (standardMonthlySalary > 0) {
      // 給与：(80,285)
      page.drawText('給与', {
        x: 80,
        y: height - 285,
        size: fontSize,
        font: font,
      });
      
      // 現物：(80,305)
      page.drawText('現物', {
        x: 80,
        y: height - 305,
        size: fontSize,
        font: font,
      });
      
      // 給与と現物の合計額(数字の間隔を15座標分開ける、この要素だけx座標右詰め）：(295,300)
      const salaryStr = String(standardMonthlySalary);
      let xPos = 295 - (salaryStr.length * 15); // 右詰め
      for (let i = 0; i < salaryStr.length; i++) {
        page.drawText(salaryStr[i], {
          x: xPos,
          y: height - 300,
          size: fontSize,
          font: font,
        });
        xPos += 15;
      }
    }
    
    // ⑱備考(条件に当てはまれば指定の位置に直径6座標分の丸を付ける)
    const age = employeeData.age || 0;
    const isPartTime = employeeData.isPartTime === 'true';
    if (age >= 70) {
      this.drawCircle(page, 357, height - 295, 3, font);
    }
    if (isPartTime) {
      this.drawCircle(page, 440, height - 280, 3, font);
    }
    
    // ⑲被保険者住所（⑭にて基礎年金番号を記入した場合のみ記入）
    if (basicPensionNumber && basicPensionNumber.length === 10) {
      const postalCode = (employeeData.currentPostalCode || employeeData.postalCode || '').replace(/\D/g, '');
      const address = employeeData.currentAddress || employeeData.address || '';
      const addressKana = employeeData.currentAddressKana || employeeData.addressKana || '';
      
      // 郵便番号の最初の3桁（小さめのフォント）：(60,320)
      if (postalCode.length >= 3) {
        page.drawText(postalCode.substring(0, 3), {
          x: 60,
          y: height - 320,
          size: smallFontSize,
          font: font,
        });
      }
      
      // 郵便番号の残りの4桁（小さめのフォント）：(78,320)
      if (postalCode.length >= 7) {
        page.drawText(postalCode.substring(3, 7), {
          x: 78,
          y: height - 320,
          size: smallFontSize,
          font: font,
        });
      }
      
      // 住所(要素のx座標が300を超える場合は小さめのフォント）：(55,330)
      if (address && hasJapaneseFont) {
        this.drawTextWithWrap(page, font, address, 55, height - 330, 300, fontSize, hasJapaneseFont);
      }
      
      // 住所（ヨミガナ）（小さめのフォント）：(130,319)
      if (addressKana && hasJapaneseFont) {
        page.drawText(addressKana, {
          x: 130,
          y: height - 319,
          size: smallFontSize,
          font: font,
        });
      }
    }
    
    // ⑳資格確認書発行要否（必要の場合のみ指定の場所に✓を付ける）
    const qualificationCertificateRequired = employeeData.qualificationCertificateRequired || 
                                            employeeData.applicationData?.qualificationCertificateRequired;
    if (qualificationCertificateRequired === '必要') {
      // チェックマークを描画：(478,325)
      this.drawCheckMark(page, 478, height - 325, font);
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
    hasJapaneseFont: boolean
  ) {
    if (!hasJapaneseFont) return;
    
    let currentX = x;
    let currentY = y;
    const charWidth = fontSize * 0.6; // おおよその文字幅
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (currentX + charWidth > maxX) {
        // 折り返し
        currentX = x;
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
    try {
      // pdf-libのdrawCircleを使用
      page.drawCircle({
        x: x,
        y: y,
        size: radius * 2,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
    } catch (error) {
      // drawCircleが存在しない場合は、テキストで円を描画（簡易的な方法）
      if (font) {
        page.drawText('○', {
          x: x - radius,
          y: y - radius,
          size: radius * 2,
          font: font,
        });
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

