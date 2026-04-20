// ============================================================
// ReviewFlow — Google Apps Script 백엔드
//
// [설정 방법]
// 1. Google Sheets 새 스프레드시트 생성
// 2. 확장 프로그램 → Apps Script → 기존 코드 전부 지우고 이 파일 내용 붙여넣기
// 3. 배포 → 새 배포 → 웹 앱
//    - 다음 사용자로 실행: 나(본인)
//    - 액세스 권한: 모든 사용자 (Anyone)
// 4. 배포 URL을 Vercel 환경변수에 등록
//    APPS_SCRIPT_URL=<배포 URL>
//    REVIEW_SCRIPT_URL=<배포 URL>  ← 동일한 URL 사용
// ============================================================

// ── 시트 이름 상수 ──────────────────────────────────────────────
var SHEET = {
  USERS:       '_구성원',
  ORG_UNITS:   '_조직구조',
  SECONDARY:   '_겸임',
  ACCOUNTS:    '_계정',
  CYCLES:      '_사이클',
  TEMPLATES:   '_템플릿',
  SUBMISSIONS: '_제출',
};

// ── 각 시트의 헤더 정의 ─────────────────────────────────────────
var HEADERS = {};
HEADERS[SHEET.USERS]       = ['사번','주조직','부조직','팀','스쿼드','직책','역할','겸임 조직','겸임 조직 직책','직무','성명','영문이름','입사일','연락처','이메일','재직 여부','보고대상(사번)'];
HEADERS[SHEET.ORG_UNITS]   = ['조직ID','조직명','조직유형','상위조직ID','조직장사번','순서'];
HEADERS[SHEET.SECONDARY]   = ['사번','겸임조직ID','겸임조직명','겸임직책','시작일','종료일','겸임비율','비고'];
HEADERS[SHEET.ACCOUNTS]    = ['사번','이메일','비밀번호해시'];
HEADERS[SHEET.CYCLES]      = ['사이클ID','제목','유형','상태','템플릿ID','대상부서','자기평가마감','매니저평가마감','생성자ID','생성일시','완료율'];
HEADERS[SHEET.TEMPLATES]   = ['템플릿ID','이름','설명','기본템플릿','생성자ID','생성일시','질문JSON'];
HEADERS[SHEET.SUBMISSIONS] = ['제출ID','사이클ID','평가자ID','평가대상ID','유형','상태','종합점수','제출일시','최종저장일시','답변JSON'];

// ── 공통 유틸 ───────────────────────────────────────────────────

function jsonOk(extra) {
  var body = JSON.stringify(Object.assign({ ok: true }, extra || {}));
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr(msg) {
  return ContentService.createTextOutput(JSON.stringify({ error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 시트가 없으면 헤더와 함께 생성, 있으면 반환 */
function getSheet(name) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(HEADERS[name]);
    sheet.getRange(1, 1, 1, HEADERS[name].length)
      .setFontWeight('bold')
      .setBackground('#f3f4f6');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** 시트 전체 데이터를 객체 배열로 변환 (헤더 행 제외, 빈 행 제거) */
function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1)
    .filter(function(r) { return r.some(function(c) { return c !== ''; }); })
    .map(function(r) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = r[i] !== undefined ? r[i] : ''; });
      return obj;
    });
}

/** 특정 컬럼값으로 행 번호(1-based) 검색. 없으면 -1 반환 */
function findRowIndex(sheet, colName, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colIdx  = headers.indexOf(colName);
  if (colIdx < 0) return -1;
  var col = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim() === String(value).trim()) return i + 2;
  }
  return -1;
}

/** 기본키(pkCol)를 기준으로 행을 upsert */
function upsertRow(sheet, pkCol, pkValue, data) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row     = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
  var rowIdx  = findRowIndex(sheet, pkCol, pkValue);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

/** SHA-256 해시 (Apps Script 내장 Utilities 사용) */
function sha256Hex(text) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

// ── doGet — 읽기 처리 ────────────────────────────────────────────
//
// 쿼리 파라미터: ?action=<액션명>
//
// 지원 액션:
//   getOrg          → _구성원 탭 (재직자만)
//   getOrgStructure → _조직구조 탭
//   getSecondaryOrgs→ _겸임 탭
//   getCycles       → _사이클 탭
//   getTemplates    → _템플릿 탭
//   getSubmissions  → _제출 탭

function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) ? e.parameter.action : 'getOrg';

    if (action === 'getOrg') {
      var rows = sheetToObjects(getSheet(SHEET.USERS)).filter(function(r) {
        return String(r['재직 여부']).toLowerCase() !== 'false';
      });
      return ContentService.createTextOutput(JSON.stringify({ rows: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getOrgStructure') {
      var rows = sheetToObjects(getSheet(SHEET.ORG_UNITS));
      return ContentService.createTextOutput(JSON.stringify({ rows: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getSecondaryOrgs') {
      var rows = sheetToObjects(getSheet(SHEET.SECONDARY));
      return ContentService.createTextOutput(JSON.stringify({ rows: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getCycles') {
      var rows = sheetToObjects(getSheet(SHEET.CYCLES));
      return ContentService.createTextOutput(JSON.stringify({ rows: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getTemplates') {
      var rows = sheetToObjects(getSheet(SHEET.TEMPLATES));
      return ContentService.createTextOutput(JSON.stringify({ rows: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getSubmissions') {
      var rows = sheetToObjects(getSheet(SHEET.SUBMISSIONS));
      return ContentService.createTextOutput(JSON.stringify({ rows: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return jsonErr('알 수 없는 action: ' + action);
  } catch (ex) {
    return jsonErr('doGet 오류: ' + ex.message);
  }
}

// ── doPost — 쓰기 처리 ───────────────────────────────────────────
//
// 요청 Body (JSON):
//   { action: string, data?: object, rows?: object[] }
//
// 지원 액션:
//   [인증]
//     verifyLogin     → { userId, isTemp }
//     setPassword     → { ok }
//     resetAccount    → { ok }
//     initAccount     → { ok }
//   [구성원]
//     createUser      → { ok, userId }
//     updateUser      → { ok }
//     deleteUser      → { ok }  (soft delete: 재직 여부 = false)
//     batchUpsertUsers→ { ok }
//   [조직구조]
//     upsertOrgUnit   → { ok }
//     deleteOrgUnit   → { ok }
//   [겸임]
//     upsertSecondaryOrg → { ok }
//     deleteSecondaryOrg → { ok }
//   [리뷰 사이클]
//     upsertCycle     → { ok }
//   [템플릿]
//     upsertTemplate  → { ok }
//     deleteTemplate  → { ok }
//   [제출내용]
//     upsertSubmission→ { ok }

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;
    var data    = payload.data  || {};
    var rows    = payload.rows  || [];

    // ── 인증 ──────────────────────────────────────────────────────

    if (action === 'verifyLogin') {
      var accountSheet = getSheet(SHEET.ACCOUNTS);
      var accounts     = sheetToObjects(accountSheet);
      var account      = null;
      for (var i = 0; i < accounts.length; i++) {
        if (String(accounts[i]['이메일']).toLowerCase().trim() ===
            String(data['email']).toLowerCase().trim()) {
          account = accounts[i];
          break;
        }
      }
      if (!account) return jsonErr('계정을 찾을 수 없습니다.');

      var userId   = String(account['사번']).trim();
      var stored   = String(account['비밀번호해시']).trim();
      var provided = String(data['passwordHash']).trim();

      // 저장된 해시가 비어 있으면 초기 비밀번호 = sha256(사번)
      var expected = (stored === '') ? sha256Hex(userId) : stored;
      if (provided !== expected) return jsonErr('비밀번호가 올바르지 않습니다.');

      return ContentService.createTextOutput(
        JSON.stringify({ userId: userId, isTemp: stored === '' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'setPassword') {
      var sheet = getSheet(SHEET.ACCOUNTS);
      upsertRow(sheet, '사번', data['userId'], {
        '사번':         data['userId'],
        '비밀번호해시': data['passwordHash'],
      });
      return jsonOk();
    }

    if (action === 'resetAccount') {
      var sheet = getSheet(SHEET.ACCOUNTS);
      upsertRow(sheet, '사번', data['userId'], {
        '사번':         data['userId'],
        '비밀번호해시': '',
      });
      return jsonOk();
    }

    if (action === 'initAccount') {
      var sheet    = getSheet(SHEET.ACCOUNTS);
      var rowIdx   = findRowIndex(sheet, '사번', data['userId']);
      if (rowIdx < 0) {
        upsertRow(sheet, '사번', data['userId'], {
          '사번':         data['userId'],
          '이메일':       data['email'] || '',
          '비밀번호해시': '',
        });
      }
      return jsonOk();
    }

    // ── 구성원 ────────────────────────────────────────────────────

    if (action === 'createUser') {
      var sheet  = getSheet(SHEET.USERS);
      var userId = String(data['사번'] || '').trim();

      // 사번이 없으면 자동 발급: 현재연도 + 3자리 시퀀스
      if (!userId) {
        var year   = String(new Date().getFullYear());
        var allIds = sheetToObjects(sheet)
          .map(function(r) { return String(r['사번']); })
          .filter(function(id) { return id.indexOf(year) === 0; })
          .map(function(id) { return parseInt(id.slice(year.length), 10); })
          .filter(function(n) { return !isNaN(n); });
        var next   = allIds.length ? Math.max.apply(null, allIds) + 1 : 1;
        userId     = year + String(next).padStart(3, '0');
        data['사번'] = userId;
      }

      upsertRow(sheet, '사번', userId, data);

      // 계정 탭에도 자동 등록 (비밀번호 해시 빈값 = 초기 비밀번호는 사번)
      var accountSheet = getSheet(SHEET.ACCOUNTS);
      if (findRowIndex(accountSheet, '사번', userId) < 0) {
        upsertRow(accountSheet, '사번', userId, {
          '사번':         userId,
          '이메일':       data['이메일'] || '',
          '비밀번호해시': '',
        });
      }

      return ContentService.createTextOutput(
        JSON.stringify({ ok: true, userId: userId })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'updateUser') {
      upsertRow(getSheet(SHEET.USERS), '사번', data['사번'], data);
      return jsonOk();
    }

    if (action === 'deleteUser') {
      // soft delete: 재직 여부 컬럼을 false로 변경
      var sheet   = getSheet(SHEET.USERS);
      var rowIdx  = findRowIndex(sheet, '사번', data['사번']);
      if (rowIdx > 0) {
        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        var colIdx  = headers.indexOf('재직 여부') + 1;
        if (colIdx > 0) sheet.getRange(rowIdx, colIdx).setValue('false');
      }
      return jsonOk();
    }

    if (action === 'batchUpsertUsers') {
      var sheet = getSheet(SHEET.USERS);
      rows.forEach(function(r) { upsertRow(sheet, '사번', r['사번'], r); });
      return jsonOk();
    }

    // ── 조직구조 ──────────────────────────────────────────────────

    if (action === 'upsertOrgUnit') {
      upsertRow(getSheet(SHEET.ORG_UNITS), '조직ID', data['조직ID'], data);
      return jsonOk();
    }

    if (action === 'deleteOrgUnit') {
      var sheet  = getSheet(SHEET.ORG_UNITS);
      var rowIdx = findRowIndex(sheet, '조직ID', data['조직ID']);
      if (rowIdx > 0) sheet.deleteRow(rowIdx);
      return jsonOk();
    }

    // ── 겸임 ──────────────────────────────────────────────────────

    if (action === 'upsertSecondaryOrg') {
      // 복합키: 사번 + 겸임조직ID
      var sheet   = getSheet(SHEET.SECONDARY);
      var objects = sheetToObjects(sheet);
      var idx     = -1;
      for (var i = 0; i < objects.length; i++) {
        if (String(objects[i]['사번'])     === String(data['사번']) &&
            String(objects[i]['겸임조직ID']) === String(data['겸임조직ID'])) {
          idx = i;
          break;
        }
      }
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var row     = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
      if (idx >= 0) {
        sheet.getRange(idx + 2, 1, 1, row.length).setValues([row]);
      } else {
        sheet.appendRow(row);
      }
      return jsonOk();
    }

    if (action === 'deleteSecondaryOrg') {
      var sheet   = getSheet(SHEET.SECONDARY);
      var objects = sheetToObjects(sheet);
      for (var i = 0; i < objects.length; i++) {
        if (String(objects[i]['사번'])     === String(data['사번']) &&
            String(objects[i]['겸임조직ID']) === String(data['겸임조직ID'])) {
          sheet.deleteRow(i + 2);
          break;
        }
      }
      return jsonOk();
    }

    // ── 리뷰 사이클 ───────────────────────────────────────────────

    if (action === 'upsertCycle') {
      upsertRow(getSheet(SHEET.CYCLES), '사이클ID', data['사이클ID'], data);
      return jsonOk();
    }

    // ── 템플릿 ────────────────────────────────────────────────────

    if (action === 'upsertTemplate') {
      upsertRow(getSheet(SHEET.TEMPLATES), '템플릿ID', data['템플릿ID'], data);
      return jsonOk();
    }

    if (action === 'deleteTemplate') {
      var sheet  = getSheet(SHEET.TEMPLATES);
      var rowIdx = findRowIndex(sheet, '템플릿ID', data['템플릿ID']);
      if (rowIdx > 0) sheet.deleteRow(rowIdx);
      return jsonOk();
    }

    // ── 제출내용 ──────────────────────────────────────────────────

    if (action === 'upsertSubmission') {
      upsertRow(getSheet(SHEET.SUBMISSIONS), '제출ID', data['제출ID'], data);
      return jsonOk();
    }

    return jsonErr('알 수 없는 action: ' + action);
  } catch (ex) {
    return jsonErr('doPost 오류: ' + ex.message);
  }
}
