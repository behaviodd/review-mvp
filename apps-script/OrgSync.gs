/**
 * ReviewFlow — 조직·구성원 데이터 Apps Script
 *
 * ★ 필수 설정:
 *   아래 SPREADSHEET_ID 에 데이터가 있는 스프레드시트 URL의 ID를 입력하세요.
 *   URL 예: https://docs.google.com/spreadsheets/d/138NMXPcwrG_lOIkC27BGtTZLN-3Ql3mVOttvM5xD-mg/edit
 *
 * 시트 이름 (이미 있는 시트 이름과 다르면 아래 상수를 수정하세요):
 *   SHEET_USERS     : 구성원 목록 탭 이름
 *   SHEET_ORG       : 조직구조 탭 이름 (없으면 자동 생성)
 *   SHEET_SECONDARY : 겸임 탭 이름 (없으면 자동 생성)
 *
 * 배포: 확장 프로그램 → Apps Script → 배포 → 새 배포
 *       종류: 웹 앱 / 액세스: 모든 사용자
 *
 * GET  ?action=getOrg[&etag=...] | getOrgStructure | getSecondaryOrgs
 * POST { action, data }  또는  { action, rows }
 */

/* ★ 스프레드시트 ID — 반드시 본인 시트 ID로 교체하세요 ★ */
var SPREADSHEET_ID = '138NMXPcwrG_lOIkC27BGtTZLN-3Ql3mVOttvM5xD-mg';  // 예: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'

/* ── 시트 이름 상수 (기존 탭 이름이 다르면 여기만 수정) ────────── */
var SHEET_USERS      = '_구성원';
var SHEET_ORG        = '_조직구조';
var SHEET_SECONDARY  = '_겸임';

/* ── 컬럼 헤더 정의 ─────────────────────────────────────────────── */
var USER_HEADERS = [
  '사번', '주조직', '부조직', '팀', '스쿼드', '직책', '역할',
  '겸임 조직', '겸임 조직 직책', '직무',
  '성명', '영문이름', '입사일', '연락처', '이메일',
  '재직 여부', '보고대상(사번)'
];
var ORG_HEADERS = [
  '조직ID', '조직명', '조직유형', '상위조직ID', '조직장사번', '순서'
];
var SECONDARY_HEADERS = [
  '사번', '겸임조직ID', '겸임조직명', '겸임직책',
  '시작일', '종료일', '겸임비율', '비고'
];

/* ── 유틸: 스프레드시트 열기 ────────────────────────────────────── */
function getSpreadsheet() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

/* ── 유틸: 시트 가져오기 (없으면 생성 + 헤더) ──────────────────── */
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

/* ── 유틸: 시트 전체 행 → 객체 배열 ────────────────────────────── */
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

/* ── 유틸: 키 컬럼으로 행 번호 검색 (1-based, 헤더 포함) ───────── */
function findRowByKey(sheet, keyHeader, keyValue) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 1) return -1;
  var headers = data[0];
  var colIdx  = headers.indexOf(keyHeader);
  if (colIdx < 0) return -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(keyValue)) return i + 1;
  }
  return -1;
}

/* ── 유틸: upsert (있으면 덮어쓰기, 없으면 추가) ──────────────── */
function upsertRow(sheet, headers, keyHeader, rowData) {
  var keyValue = rowData[keyHeader];
  var rowNum   = findRowByKey(sheet, keyHeader, keyValue);
  var values   = headers.map(function(h) {
    return rowData[h] !== undefined ? rowData[h] : '';
  });
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

/* ── 유틸: 간단한 djb2 문자열 해시 (ETag용) ────────────────────── */
function simpleHash(str) {
  var hash = 5381;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // 32bit 정수 유지
  }
  return String(Math.abs(hash));
}

function computeEtag(sheet) {
  var data = sheet.getDataRange().getValues();
  return simpleHash(JSON.stringify(data));
}

/* ── 유틸: 사번 자동 생성 ──────────────────────────────────────── */
function generateEmployeeId(sheet) {
  var year    = String(new Date().getFullYear()); // "2026"
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var colIdx  = headers.indexOf('사번');
  if (colIdx < 0) return year + '001';

  var maxSeq = 0;
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][colIdx]);
    if (id.startsWith(year)) {
      var seq = parseInt(id.slice(year.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return year + String(maxSeq + 1).padStart(3, '0');
}

/* ══════════════════════════════════════════════════════════════════
   doGet — 데이터 조회
   ══════════════════════════════════════════════════════════════════ */
function doGet(e) {
  try {
    var params = e.parameter || {};
    var action = params.action || 'getOrg';
    var clientEtag = params.etag || '';

    /* ── 구성원 목록 (ETag 캐시 지원) ── */
    if (action === 'getOrg') {
      var sheet = getSheet(SHEET_USERS, USER_HEADERS);
      var serverEtag = computeEtag(sheet);

      if (clientEtag && clientEtag === serverEtag) {
        return jsonResponse({ unchanged: true, etag: serverEtag });
      }

      var rows = sheetToObjects(sheet);
      return jsonResponse({ ok: true, rows: rows, etag: serverEtag });
    }

    /* ── 조직구조 ── */
    if (action === 'getOrgStructure') {
      var rows = sheetToObjects(getSheet(SHEET_ORG, ORG_HEADERS));
      return jsonResponse({ ok: true, rows: rows });
    }

    /* ── 겸임 ── */
    if (action === 'getSecondaryOrgs') {
      var rows = sheetToObjects(getSheet(SHEET_SECONDARY, SECONDARY_HEADERS));
      return jsonResponse({ ok: true, rows: rows });
    }

    return jsonResponse({ error: '알 수 없는 action: ' + action });
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
    var data    = payload.data  || {};
    var rows    = payload.rows  || [];

    /* ── 구성원 생성 ── */
    if (action === 'createUser') {
      var sheet = getSheet(SHEET_USERS, USER_HEADERS);
      var userId = data['사번'];
      if (!userId) {
        userId = generateEmployeeId(sheet);
        data['사번'] = userId;
      }
      upsertRow(sheet, USER_HEADERS, '사번', data);
      return jsonResponse({ ok: true, userId: userId });
    }

    /* ── 구성원 수정 ── */
    if (action === 'updateUser') {
      upsertRow(getSheet(SHEET_USERS, USER_HEADERS), USER_HEADERS, '사번', data);
      return jsonResponse({ ok: true });
    }

    /* ── 구성원 퇴사 처리 (soft delete) ── */
    if (action === 'deleteUser') {
      var sheet  = getSheet(SHEET_USERS, USER_HEADERS);
      var rowNum = findRowByKey(sheet, '사번', data['사번']);
      if (rowNum > 0) {
        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        var col     = headers.indexOf('재직 여부') + 1;
        if (col > 0) sheet.getRange(rowNum, col).setValue('false');
      }
      return jsonResponse({ ok: true });
    }

    /* ── 구성원 일괄 upsert ── */
    if (action === 'batchUpsertUsers') {
      var sheet = getSheet(SHEET_USERS, USER_HEADERS);
      rows.forEach(function(row) {
        upsertRow(sheet, USER_HEADERS, '사번', row);
      });
      return jsonResponse({ ok: true, count: rows.length });
    }

    /* ── 조직 단위 upsert ── */
    if (action === 'upsertOrgUnit') {
      upsertRow(getSheet(SHEET_ORG, ORG_HEADERS), ORG_HEADERS, '조직ID', data);
      return jsonResponse({ ok: true });
    }

    /* ── 조직 단위 삭제 ── */
    if (action === 'deleteOrgUnit') {
      deleteRowByKey(getSheet(SHEET_ORG, ORG_HEADERS), '조직ID', data['조직ID']);
      return jsonResponse({ ok: true });
    }

    /* ── 겸임 upsert ── */
    if (action === 'upsertSecondaryOrg') {
      // 복합 키: 사번 + 겸임조직ID
      var sheet = getSheet(SHEET_SECONDARY, SECONDARY_HEADERS);
      var sheetData = sheet.getDataRange().getValues();
      var headers   = sheetData[0];
      var userCol   = headers.indexOf('사번');
      var orgCol    = headers.indexOf('겸임조직ID');
      var existRow  = -1;
      for (var i = 1; i < sheetData.length; i++) {
        if (String(sheetData[i][userCol]) === String(data['사번']) &&
            String(sheetData[i][orgCol])  === String(data['겸임조직ID'])) {
          existRow = i + 1;
          break;
        }
      }
      var values = SECONDARY_HEADERS.map(function(h) {
        return data[h] !== undefined ? data[h] : '';
      });
      if (existRow > 0) {
        sheet.getRange(existRow, 1, 1, SECONDARY_HEADERS.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
      return jsonResponse({ ok: true });
    }

    /* ── 겸임 삭제 ── */
    if (action === 'deleteSecondaryOrg') {
      var sheet     = getSheet(SHEET_SECONDARY, SECONDARY_HEADERS);
      var sheetData = sheet.getDataRange().getValues();
      var headers   = sheetData[0];
      var userCol   = headers.indexOf('사번');
      var orgCol    = headers.indexOf('겸임조직ID');
      for (var i = sheetData.length - 1; i >= 1; i--) {
        if (String(sheetData[i][userCol]) === String(data['사번']) &&
            String(sheetData[i][orgCol])  === String(data['겸임조직ID'])) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
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
