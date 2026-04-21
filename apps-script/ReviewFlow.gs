/**
 * ReviewFlow — 통합 Apps Script
 *
 * ★ 필수 설정: SPREADSHEET_ID 에 스프레드시트 URL의 ID를 입력하세요.
 *   URL 예: https://docs.google.com/spreadsheets/d/★여기★/edit
 *
 * 시트 이름 (기존 탭 이름이 다르면 아래 상수만 수정):
 *   SHEET_USERS     : 구성원 탭 이름
 *   SHEET_ORG       : 조직구조 탭 이름 (없으면 자동 생성)
 *   SHEET_SECONDARY : 겸임 탭 이름 (없으면 자동 생성)
 *   SHEET_CYCLES    : 리뷰 탭 이름 (없으면 자동 생성)
 *   SHEET_TEMPLATES : 템플릿 탭 이름 (없으면 자동 생성)
 *   SHEET_SUBMISSIONS: 제출 탭 이름 (없으면 자동 생성)
 *
 * 배포: 확장 프로그램 → Apps Script → 배포 → 새 배포
 *       종류: 웹 앱 / 액세스: 모든 사용자
 */

/* ★ 스프레드시트 ID ★ */
var SPREADSHEET_ID = '138NMXPcwrG_lOIkC27BGtTZLN-3Ql3mVOttvM5xD-mg';

/* ── 시트 이름 상수 ─────────────────────────────────────────────── */
var SHEET_USERS       = '_구성원';
var SHEET_ORG         = '_조직구조';
var SHEET_SECONDARY   = '_겸임';
var SHEET_CYCLES      = '_리뷰';
var SHEET_TEMPLATES   = '_템플릿';
var SHEET_SUBMISSIONS = '_제출';

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

var SHEET_ACCOUNTS   = '_계정';
var ACCOUNT_HEADERS  = ['사번', '이메일', '비밀번호해시'];

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

/* ── 유틸: 키 컬럼으로 행 번호 검색 ────────────────────────────── */
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

/* ── 유틸: upsert ───────────────────────────────────────────────── */
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

/* ── 유틸: 키로 행 삭제 ─────────────────────────────────────────── */
function deleteRowByKey(sheet, keyHeader, keyValue) {
  var rowNum = findRowByKey(sheet, keyHeader, keyValue);
  if (rowNum > 0) sheet.deleteRow(rowNum);
}

/* ── 유틸: ETag (djb2 해시) ─────────────────────────────────────── */
function simpleHash(str) {
  var hash = 5381;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return String(Math.abs(hash));
}
function computeEtag(sheet) {
  return simpleHash(JSON.stringify(sheet.getDataRange().getValues()));
}

/* ── 유틸: 사번 자동 생성 ──────────────────────────────────────── */
function generateEmployeeId(sheet) {
  var year    = String(new Date().getFullYear());
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

/* ── SHA-256 해시 ───────────────────────────────────────────────── */
function sha256Hex(text) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

/** 헤더 이름 정규화 — 공백 제거 + 소문자 (열 이름 변형 대응) */
function normalizeKey(k) {
  return String(k).replace(/\s+/g, '').toLowerCase();
}

/** 특정 열의 일부 값만 업데이트 (나머지 값 유지). 행 없으면 false 반환 */
function patchRowByKey(sheet, keyHeader, keyValue, patch) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return false;
  var headers = data[0];
  // 정규화된 키로 열 인덱스 찾기
  var keyCol = -1;
  for (var i = 0; i < headers.length; i++) {
    if (normalizeKey(headers[i]) === normalizeKey(keyHeader)) { keyCol = i; break; }
  }
  if (keyCol < 0) return false;
  var rowNum = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][keyCol]).trim() === String(keyValue).trim()) { rowNum = r + 1; break; }
  }
  if (rowNum < 0) return false;
  var existing = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  var normPatch = {};
  Object.keys(patch).forEach(function(k) { normPatch[normalizeKey(k)] = patch[k]; });
  var updated = headers.map(function(h, i) {
    var v = normPatch[normalizeKey(h)];
    return v !== undefined ? v : existing[i];
  });
  sheet.getRange(rowNum, 1, 1, updated.length).setValues([updated]);
  return true;
}

/* ══════════════════════════════════════════════════════════════════
   doGet
   ══════════════════════════════════════════════════════════════════ */
function doGet(e) {
  try {
    var params     = e.parameter || {};
    var action     = params.action || 'getOrg';
    var clientEtag = params.etag || '';

    /* ── 조직/구성원 ── */
    if (action === 'getOrg') {
      var sheet      = getSheet(SHEET_USERS, USER_HEADERS);
      var serverEtag = computeEtag(sheet);
      if (clientEtag && clientEtag === serverEtag) {
        return jsonResponse({ unchanged: true, etag: serverEtag });
      }
      return jsonResponse({ ok: true, rows: sheetToObjects(sheet), etag: serverEtag });
    }
    if (action === 'getOrgStructure') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_ORG, ORG_HEADERS)) });
    }
    if (action === 'getSecondaryOrgs') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_SECONDARY, SECONDARY_HEADERS)) });
    }

    /* ── 리뷰 운영 ── */
    if (action === 'getCycles') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_CYCLES, CYCLE_HEADERS)) });
    }
    if (action === 'getTemplates') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_TEMPLATES, TEMPLATE_HEADERS)) });
    }
    if (action === 'getSubmissions') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS)) });
    }

    return jsonResponse({ error: '알 수 없는 action: ' + action });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

/* ══════════════════════════════════════════════════════════════════
   doPost
   ══════════════════════════════════════════════════════════════════ */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;
    var data    = payload.data || {};
    var rows    = payload.rows || [];

    /* ── 인증 ── */
    if (action === 'verifyLogin') {
      var accountSheet = getSheet(SHEET_ACCOUNTS, ACCOUNT_HEADERS);
      var accounts     = sheetToObjects(accountSheet);
      var account      = null;
      var emailInput   = String(data['email'] || '').toLowerCase().trim();
      for (var i = 0; i < accounts.length; i++) {
        if (String(accounts[i]['이메일']).toLowerCase().trim() === emailInput) {
          account = accounts[i]; break;
        }
      }
      // _계정에 없으면 _구성원에서 이메일로 찾아 자동 초기화 (초기 비밀번호 = 사번)
      if (!account) {
        var allUsers = sheetToObjects(getSheet(SHEET_USERS, USER_HEADERS));
        var matchUser = null;
        for (var j = 0; j < allUsers.length; j++) {
          if (String(allUsers[j]['이메일']).toLowerCase().trim() === emailInput) {
            matchUser = allUsers[j]; break;
          }
        }
        if (!matchUser) return jsonResponse({ error: '계정을 찾을 수 없습니다.' });
        var autoId = String(matchUser['사번']).trim();
        upsertRow(accountSheet, ACCOUNT_HEADERS, '사번', {
          '사번': autoId, '이메일': emailInput, '비밀번호해시': '',
        });
        account = { '사번': autoId, '이메일': emailInput, '비밀번호해시': '' };
      }
      var userId  = String(account['사번']).trim();
      // 열 이름 불일치 대응: 정규화된 키로 해시 찾기
      var hashKey = Object.keys(account).filter(function(k) {
        return normalizeKey(k) === '비밀번호해시';
      })[0] || '비밀번호해시';
      var stored   = String(account[hashKey] !== undefined ? account[hashKey] : '').trim();
      var provided = String(data['passwordHash'] || '').trim();
      var expected = (stored === '') ? sha256Hex(userId) : stored;
      if (provided !== expected) return jsonResponse({ error: '비밀번호가 올바르지 않습니다.' });
      return jsonResponse({ userId: userId, isTemp: stored === '' });
    }

    if (action === 'setPassword') {
      var sheet   = getSheet(SHEET_ACCOUNTS, ACCOUNT_HEADERS);
      var patched = patchRowByKey(sheet, '사번', data['userId'], {
        '비밀번호해시': data['passwordHash'],
      });
      // 계정 행이 없으면 _구성원에서 이메일 찾아 새로 생성
      if (!patched) {
        var email   = '';
        var urows   = sheetToObjects(getSheet(SHEET_USERS, USER_HEADERS));
        for (var k = 0; k < urows.length; k++) {
          if (String(urows[k]['사번']).trim() === String(data['userId']).trim()) {
            email = String(urows[k]['이메일'] || '').toLowerCase().trim(); break;
          }
        }
        upsertRow(sheet, ACCOUNT_HEADERS, '사번', {
          '사번': data['userId'], '이메일': email, '비밀번호해시': data['passwordHash'],
        });
      }
      return jsonResponse({ ok: true });
    }

    if (action === 'resetAccount') {
      var sheet   = getSheet(SHEET_ACCOUNTS, ACCOUNT_HEADERS);
      var patched = patchRowByKey(sheet, '사번', data['userId'], { '비밀번호해시': '' });
      if (!patched) return jsonResponse({ error: '계정을 찾을 수 없습니다: ' + data['userId'] });
      return jsonResponse({ ok: true });
    }

    if (action === 'initAccount') {
      var sheet  = getSheet(SHEET_ACCOUNTS, ACCOUNT_HEADERS);
      var rowNum = findRowByKey(sheet, '사번', data['userId']);
      if (rowNum < 0) {
        upsertRow(sheet, ACCOUNT_HEADERS, '사번', {
          '사번':         data['userId'],
          '이메일':       String(data['email'] || '').toLowerCase().trim(),
          '비밀번호해시': '',
        });
      }
      return jsonResponse({ ok: true });
    }

    if (action === 'batchInitAccounts') {
      var accountSheet = getSheet(SHEET_ACCOUNTS, ACCOUNT_HEADERS);
      var uRows        = sheetToObjects(getSheet(SHEET_USERS, USER_HEADERS));
      var created      = 0;
      uRows.forEach(function(u) {
        var uid = String(u['사번']).trim();
        if (!uid) return;
        if (findRowByKey(accountSheet, '사번', uid) < 0) {
          upsertRow(accountSheet, ACCOUNT_HEADERS, '사번', {
            '사번':         uid,
            '이메일':       String(u['이메일'] || '').toLowerCase().trim(),
            '비밀번호해시': '',
          });
          created++;
        }
      });
      return jsonResponse({ ok: true, created: created });
    }

    /* ── 구성원 ── */
    if (action === 'createUser') {
      var sheet  = getSheet(SHEET_USERS, USER_HEADERS);
      var userId = data['사번'] || generateEmployeeId(sheet);
      data['사번'] = userId;
      upsertRow(sheet, USER_HEADERS, '사번', data);
      // _계정 탭에 자동 등록 (초기 비밀번호 = 사번)
      var accSheet = getSheet(SHEET_ACCOUNTS, ACCOUNT_HEADERS);
      if (findRowByKey(accSheet, '사번', userId) < 0) {
        upsertRow(accSheet, ACCOUNT_HEADERS, '사번', {
          '사번': userId, '이메일': String(data['이메일'] || '').toLowerCase().trim(), '비밀번호해시': '',
        });
      }
      return jsonResponse({ ok: true, userId: userId });
    }
    if (action === 'updateUser') {
      upsertRow(getSheet(SHEET_USERS, USER_HEADERS), USER_HEADERS, '사번', data);
      return jsonResponse({ ok: true });
    }
    if (action === 'deleteUser') {
      var sheet  = getSheet(SHEET_USERS, USER_HEADERS);
      var rowNum = findRowByKey(sheet, '사번', data['사번']);
      if (rowNum > 0) {
        var hdrs = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        var col  = hdrs.indexOf('재직 여부') + 1;
        if (col > 0) sheet.getRange(rowNum, col).setValue('false');
      }
      return jsonResponse({ ok: true });
    }
    if (action === 'batchUpsertUsers') {
      var sheet = getSheet(SHEET_USERS, USER_HEADERS);
      rows.forEach(function(row) { upsertRow(sheet, USER_HEADERS, '사번', row); });
      return jsonResponse({ ok: true, count: rows.length });
    }

    /* ── 조직 ── */
    if (action === 'upsertOrgUnit') {
      upsertRow(getSheet(SHEET_ORG, ORG_HEADERS), ORG_HEADERS, '조직ID', data);
      return jsonResponse({ ok: true });
    }
    if (action === 'deleteOrgUnit') {
      deleteRowByKey(getSheet(SHEET_ORG, ORG_HEADERS), '조직ID', data['조직ID']);
      return jsonResponse({ ok: true });
    }

    /* ── 겸임 ── */
    if (action === 'upsertSecondaryOrg') {
      var sheet     = getSheet(SHEET_SECONDARY, SECONDARY_HEADERS);
      var sheetData = sheet.getDataRange().getValues();
      var hdrs      = sheetData[0];
      var userCol   = hdrs.indexOf('사번');
      var orgCol    = hdrs.indexOf('겸임조직ID');
      var existRow  = -1;
      for (var i = 1; i < sheetData.length; i++) {
        if (String(sheetData[i][userCol]) === String(data['사번']) &&
            String(sheetData[i][orgCol])  === String(data['겸임조직ID'])) {
          existRow = i + 1; break;
        }
      }
      var values = SECONDARY_HEADERS.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
      if (existRow > 0) sheet.getRange(existRow, 1, 1, SECONDARY_HEADERS.length).setValues([values]);
      else sheet.appendRow(values);
      return jsonResponse({ ok: true });
    }
    if (action === 'deleteSecondaryOrg') {
      var sheet     = getSheet(SHEET_SECONDARY, SECONDARY_HEADERS);
      var sheetData = sheet.getDataRange().getValues();
      var hdrs      = sheetData[0];
      var userCol   = hdrs.indexOf('사번');
      var orgCol    = hdrs.indexOf('겸임조직ID');
      for (var i = sheetData.length - 1; i >= 1; i--) {
        if (String(sheetData[i][userCol]) === String(data['사번']) &&
            String(sheetData[i][orgCol])  === String(data['겸임조직ID'])) {
          sheet.deleteRow(i + 1); break;
        }
      }
      return jsonResponse({ ok: true });
    }

    /* ── 리뷰(사이클) ── */
    if (action === 'upsertCycle') {
      upsertRow(getSheet(SHEET_CYCLES, CYCLE_HEADERS), CYCLE_HEADERS, '사이클ID', data);
      return jsonResponse({ ok: true });
    }
    if (action === 'deleteCycle') {
      var cycleId  = data['사이클ID'];
      deleteRowByKey(getSheet(SHEET_CYCLES, CYCLE_HEADERS), '사이클ID', cycleId);
      var subSheet = getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS);
      var subData  = subSheet.getDataRange().getValues();
      if (subData.length > 1) {
        var hdrs   = subData[0];
        var colIdx = hdrs.indexOf('사이클ID');
        for (var i = subData.length - 1; i >= 1; i--) {
          if (String(subData[i][colIdx]) === String(cycleId)) subSheet.deleteRow(i + 1);
        }
      }
      return jsonResponse({ ok: true });
    }

    /* ── 템플릿 ── */
    if (action === 'upsertTemplate') {
      upsertRow(getSheet(SHEET_TEMPLATES, TEMPLATE_HEADERS), TEMPLATE_HEADERS, '템플릿ID', data);
      return jsonResponse({ ok: true });
    }
    if (action === 'deleteTemplate') {
      deleteRowByKey(getSheet(SHEET_TEMPLATES, TEMPLATE_HEADERS), '템플릿ID', data['템플릿ID']);
      return jsonResponse({ ok: true });
    }

    /* ── 제출 ── */
    if (action === 'upsertSubmission') {
      upsertRow(getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS), SUBMISSION_HEADERS, '제출ID', data);
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
