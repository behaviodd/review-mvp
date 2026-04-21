/**
 * ReviewFlow — 리뷰 운영 데이터 Apps Script
 *
 * 스프레드시트 시트 구성 (없으면 자동 생성):
 *   - 리뷰       : 리뷰(사이클) 목록
 *   - 템플릿     : 평가 템플릿 목록
 *   - 제출내용   : 리뷰 제출 데이터
 *
 * 배포 방법:
 *   확장 프로그램 → Apps Script → 배포 → 새 배포
 *   종류: 웹 앱 / 액세스: 모든 사용자
 *
 * GET  ?action=getCycles|getTemplates|getSubmissions
 * POST { action, data }
 *   action: upsertCycle | deleteCycle
 *           upsertTemplate | deleteTemplate
 *           upsertSubmission | deleteSubmission
 */

/* ★ 스프레드시트 ID — 반드시 본인 시트 ID로 교체하세요 ★ */
var SPREADSHEET_ID = '138NMXPcwrG_lOIkC27BGtTZLN-3Ql3mVOttvM5xD-mg';

/* ── 시트 이름 상수 ─────────────────────────────────────────────── */
var SHEET_CYCLES      = '_리뷰';
var SHEET_TEMPLATES   = '_템플릿';
var SHEET_SUBMISSIONS = '_제출';

/* ── 컬럼 헤더 정의 ─────────────────────────────────────────────── */
var CYCLE_HEADERS = [
  '사이클ID', '제목', '유형', '상태', '템플릿ID', '대상부서',
  '자기평가마감', '매니저평가마감', '생성자ID', '생성일시', '완료율'
];
var TEMPLATE_HEADERS = [
  '템플릿ID', '이름', '설명', '기본템플릿', '생성자ID', '생성일시', '질문JSON'
];
var SUBMISSION_HEADERS = [
  '제출ID', '사이클ID', '평가자ID', '평가대상ID', '유형', '상태',
  '종합점수', '제출일시', '최종저장일시', '답변JSON'
];

/* ── 유틸: 스프레드시트 열기 ────────────────────────────────────── */
function getSpreadsheet() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

/* ── 유틸: 시트 가져오기 (없으면 생성 + 헤더 기록) ─────────────── */
function getSheet(name, headers) {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#f3f4f6');
  }
  return sheet;
}

/* ── 유틸: 시트 전체 행을 객체 배열로 반환 ─────────────────────── */
function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/* ── 유틸: 키 컬럼으로 행 번호 찾기 (1-based, 헤더 포함) ──────── */
function findRowByKey(sheet, keyHeader, keyValue) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 1) return -1;
  var headers = data[0];
  var colIdx  = headers.indexOf(keyHeader);
  if (colIdx < 0) return -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(keyValue)) return i + 1; // 1-based
  }
  return -1;
}

/* ── 유틸: upsert (있으면 덮어쓰기, 없으면 추가) ──────────────── */
function upsertRow(sheet, headers, keyHeader, rowData) {
  var keyValue = rowData[keyHeader];
  var rowNum   = findRowByKey(sheet, keyHeader, keyValue);
  var values   = headers.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ''; });

  if (rowNum > 0) {
    sheet.getRange(rowNum, 1, 1, headers.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

/* ── 유틸: 키로 행 삭제 ────────────────────────────────────────── */
function deleteRowByKey(sheet, keyHeader, keyValue) {
  var rowNum = findRowByKey(sheet, keyHeader, keyValue);
  if (rowNum > 0) sheet.deleteRow(rowNum);
}

/* ══════════════════════════════════════════════════════════════════
   doGet — 데이터 조회
   ══════════════════════════════════════════════════════════════════ */
function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) ? e.parameter.action : 'getCycles';
    var rows;

    if (action === 'getCycles') {
      rows = sheetToObjects(getSheet(SHEET_CYCLES, CYCLE_HEADERS));
    } else if (action === 'getTemplates') {
      rows = sheetToObjects(getSheet(SHEET_TEMPLATES, TEMPLATE_HEADERS));
    } else if (action === 'getSubmissions') {
      rows = sheetToObjects(getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS));
    } else {
      return jsonResponse({ error: '알 수 없는 action: ' + action });
    }

    return jsonResponse({ ok: true, rows: rows });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

/* ══════════════════════════════════════════════════════════════════
   doPost — 데이터 쓰기
   ══════════════════════════════════════════════════════════════════ */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;
    var data    = payload.data || {};

    /* ── 리뷰(사이클) ───────────────────────────────────────────── */
    if (action === 'upsertCycle') {
      upsertRow(
        getSheet(SHEET_CYCLES, CYCLE_HEADERS),
        CYCLE_HEADERS, '사이클ID', data
      );
      return jsonResponse({ ok: true });
    }

    if (action === 'deleteCycle') {
      var cycleId = data['사이클ID'];
      // 사이클 행 삭제
      deleteRowByKey(getSheet(SHEET_CYCLES, CYCLE_HEADERS), '사이클ID', cycleId);
      // 연관 제출내용 행 모두 삭제
      var subSheet = getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS);
      var subData  = subSheet.getDataRange().getValues();
      if (subData.length > 1) {
        var headers  = subData[0];
        var colIdx   = headers.indexOf('사이클ID');
        // 뒤에서부터 순회해야 행 번호 밀림 없이 삭제 가능
        for (var i = subData.length - 1; i >= 1; i--) {
          if (String(subData[i][colIdx]) === String(cycleId)) {
            subSheet.deleteRow(i + 1);
          }
        }
      }
      return jsonResponse({ ok: true });
    }

    /* ── 템플릿 ─────────────────────────────────────────────────── */
    if (action === 'upsertTemplate') {
      upsertRow(
        getSheet(SHEET_TEMPLATES, TEMPLATE_HEADERS),
        TEMPLATE_HEADERS, '템플릿ID', data
      );
      return jsonResponse({ ok: true });
    }

    if (action === 'deleteTemplate') {
      deleteRowByKey(getSheet(SHEET_TEMPLATES, TEMPLATE_HEADERS), '템플릿ID', data['템플릿ID']);
      return jsonResponse({ ok: true });
    }

    /* ── 제출내용 ────────────────────────────────────────────────── */
    if (action === 'upsertSubmission') {
      upsertRow(
        getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS),
        SUBMISSION_HEADERS, '제출ID', data
      );
      return jsonResponse({ ok: true });
    }

    if (action === 'deleteSubmission') {
      deleteRowByKey(getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS), '제출ID', data['제출ID']);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: '알 수 없는 action: ' + action });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

/* ── JSON 응답 헬퍼 ─────────────────────────────────────────────── */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
