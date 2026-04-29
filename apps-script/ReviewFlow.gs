/**
 * ReviewFlow — 통합 Apps Script (Phase 3.3b-1 기준)
 *
 * ★ 이 파일 하나만 사용하세요.
 *   Apps Script 프로젝트에 Code.gs / Code_v2.gs / OrgSync.gs / ReviewSync.gs 등
 *   다른 .gs 파일이 함께 있으면 doPost/doGet 이 충돌하여 일부 action 이 사라집니다.
 *
 * 배포: 확장 프로그램 → Apps Script → 배포 → 배포 관리 → 편집(연필) → 새 버전
 *       (기존 Web App URL 유지)
 *
 * 최초 실행 시 또는 신규 컬럼 추가 후 한번:
 *   함수 드롭다운에서 `migrate_addMissingColumns` 선택 → 실행
 */

/* ★ 스프레드시트 ID ★ */
var SPREADSHEET_ID = '138NMXPcwrG_lOIkC27BGtTZLN-3Ql3mVOttvM5xD-mg';

/* ── 시트 이름 ─────────────────────────────────────────────────── */
var SHEET_USERS       = '_구성원';
var SHEET_ORG         = '_조직구조';
var SHEET_SECONDARY   = '_겸임';
var SHEET_CYCLES      = '_리뷰';
var SHEET_TEMPLATES   = '_템플릿';
var SHEET_SUBMISSIONS = '_제출';
var SHEET_ACCOUNTS    = '_계정';   /* @deprecated R7 — 폐기 예정. Migrate_R7 의 cleanupDeadSheets 로 삭제. */
var SHEET_AUDIT       = '_감사로그';
// R1: 평가권 / 인사 스냅샷 / 마스터 로그인
var SHEET_ASSIGNMENTS = '_평가권';
var SHEET_SNAPSHOTS   = '_인사스냅샷';
var SHEET_IMPLOG      = '_마스터로그인';
// R6: 권한 그룹
var SHEET_PERMGROUPS  = '_권한그룹';
// R7: 신규 시트 (Migrate_R7.gs migrateR7_run() 으로 생성)
var SHEET_USERS_V2    = '구성원_v2';
var SHEET_ORG_V2      = '조직_v2';
var SHEET_PENDING     = '대기승인';
var SHEET_CYCLES_V2   = '사이클_v2';

/* ── 헤더 정의 ──────────────────────────────────────────────────
 * 신규 컬럼은 항상 뒤에만 추가. upsertRow / appendRowData 가 자동 보강하므로
 * 기존 시트 레이아웃을 변경·삭제·재배치하지 않습니다.
 */
var USER_HEADERS = [
  '사번', '주조직', '부조직', '팀', '스쿼드', '직책', '역할',
  '겸임 조직', '겸임 조직 직책', '직무',
  '성명', '영문이름', '입사일', '연락처', '이메일',
  '재직 여부', '보고대상(사번)',
  // R1
  '주조직ID', '상태분류', '상태변경일시', '상태사유'
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
  '자기평가마감', '매니저평가마감', '생성자ID', '생성일시', '완료율',
  // Phase 3.1
  '태그', '보관일시', '템플릿스냅샷JSON', '템플릿스냅샷일시', '복제원본ID',
  // Phase 3.2a
  '폴더ID', '대상모드', '대상매니저ID', '대상사용자IDS',
  // Phase 3.2b
  '예약발행일시', '자동전환JSON', '알림정책JSON', '편집잠금일시', '자동보관플래그', '종료일시',
  // Phase 3.3a
  '익명정책JSON', '공개정책JSON', '참고정보JSON',
  // Phase 3.3b-1
  '리뷰유형', '동료선택정책JSON',
  // R1: 인사정보 적용 방식
  '인사적용방식', '인사스냅샷ID',
  // R3: downward 평가 차수
  '평가차수배열'
];

// R1: 평가권 시트
var ASSIGNMENT_HEADERS = [
  '평가권ID', '피평가자사번', '평가자사번', '차수', '부여출처',
  '시작일', '종료일', '생성일시', '생성자', '비고'
];

// R1: 인사 스냅샷 시트
var SNAPSHOT_HEADERS = [
  '스냅샷ID', '생성일시', '생성자', '설명', 'payloadJSON'
];

// R1: 마스터 로그인 감사 로그
var IMPLOG_HEADERS = [
  '로그ID', '작업자사번', '대상사번', '시작일시', '종료일시', 'IP', 'UserAgent'
];

// R6: 권한 그룹
var PERMGROUP_HEADERS = [
  '그룹ID', '그룹명', '설명', '권한코드JSON', '멤버사번JSON', '시스템그룹', '생성일시', '생성자'
];
var TEMPLATE_HEADERS = [
  '템플릿ID', '이름', '설명', '기본템플릿', '생성자ID', '생성일시', '질문JSON'
];
var SUBMISSION_HEADERS = [
  '제출ID', '사이클ID', '평가자ID', '평가대상ID', '유형', '상태',
  '종합점수', '제출일시', '최종저장일시', '답변JSON',
  // Phase 1
  '리마인드JSON',
  // Phase 2
  '연장기한JSON', '대리작성자', '작성자이력JSON',
  // Phase 3.2a
  '자동제외JSON',
  // R3: 평가자 차수 (downward 만 사용)
  '평가자차수'
];
// _계정 시트는 권한관리 인덱스로 사용 — 사번/이메일만 자동 동기화. 비밀번호 컬럼은 코드에서 더 이상 다루지 않음.
// @deprecated R7 — Google SSO 도입으로 폐기. Migrate_R7.migrateR7_cleanupDeadSheets() 로 삭제.
var ACCOUNT_HEADERS  = ['사번', '이메일'];
var AUDIT_HEADERS = [
  '로그ID', '사이클ID', '발생자ID', '액션', '대상IDS', '요약', '메타JSON', '발생일시'
];

/* R7: 새 시트 헤더 (단일 진실 = docs/db-schema.md / Migrate_R7.gs) */
var USER_V2_HEADERS = [
  '사번', '이메일', '이름', '직책', '소속조직ID', '보조조직IDs',
  '입사일', '퇴사일', '비고'
];
var ORG_V2_HEADERS = [
  '조직ID', '조직명', '부모조직ID', '표시순서', '조직장사번', '비고'
];
var PENDING_HEADERS = [
  '이메일', '이름', 'Google_sub', '최초로그인일시',
  '상태', '처리자', '처리일시'
];
// CYCLE_V2_HEADERS 는 핵심 9 + 스페이서 + 부가. 기존 CYCLE_HEADERS 의 모든 컬럼 호환.
var CYCLE_V2_HEADERS = [
  '사이클ID', '제목', '상태', '자기평가시작', '자기평가종료',
  '하향평가시작', '하향평가종료', '템플릿ID', '비고',
  '_',
  '유형', '리뷰유형', '대상모드', '대상매니저ID', '대상사용자IDS', '폴더ID', '태그',
  '인사적용방식', '인사스냅샷ID', '평가차수배열',
  '자기평가마감', '매니저평가마감', '예약발행일시', '편집잠금일시', '종료일시', '보관일시',
  '익명정책JSON', '공개정책JSON', '참고정보JSON', '동료선택정책JSON', '자동전환JSON', '알림정책JSON',
  '템플릿스냅샷JSON', '템플릿스냅샷일시', '복제원본ID',
  '생성자ID', '생성일시', '완료율', '자동보관플래그'
];

/* ── 유틸: 스프레드시트 ─────────────────────────────────────────── */
function getSpreadsheet() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

/* 시트 가져오기 (없으면 생성 + 초기 헤더, 있으면 누락 컬럼 자동 보강) */
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
  } else {
    ensureHeaders(sheet, headers);
  }
  return sheet;
}

/* 누락된 헤더를 시트 뒤에 자동 추가 (기존 컬럼은 보존) */
function ensureHeaders(sheet, requiredHeaders) {
  var lastCol  = sheet.getLastColumn();
  var existing = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];
  if (existing.length === 0 || existing.every(function(x) { return x === ''; })) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, requiredHeaders.length)
         .setFontWeight('bold')
         .setBackground('#f3f4f6');
    return;
  }
  var missing = requiredHeaders.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length === 0) return;
  var startCol = existing.length + 1;
  sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
  sheet.getRange(1, startCol, 1, missing.length)
       .setFontWeight('bold')
       .setBackground('#f3f4f6');
}

/* 시트 전체 행 → 객체 배열 */
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

/* 키 컬럼으로 행 번호 검색 */
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

/* upsert (있으면 덮어쓰기, 없으면 추가) — 시트에 없는 키는 헤더로 자동 추가 */
function upsertRow(sheet, knownHeaders, keyHeader, rowData) {
  var dataKeys  = Object.keys(rowData);
  var extraKeys = dataKeys.filter(function(k) { return knownHeaders.indexOf(k) < 0; });
  if (extraKeys.length > 0) {
    ensureHeaders(sheet, knownHeaders.concat(extraKeys));
  } else {
    ensureHeaders(sheet, knownHeaders);
  }
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

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

/* append-only (감사 로그) */
function appendRowData(sheet, knownHeaders, rowData) {
  var dataKeys  = Object.keys(rowData);
  var extraKeys = dataKeys.filter(function(k) { return knownHeaders.indexOf(k) < 0; });
  if (extraKeys.length > 0) ensureHeaders(sheet, knownHeaders.concat(extraKeys));
  else ensureHeaders(sheet, knownHeaders);
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values  = headers.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ''; });
  sheet.appendRow(values);
}

function deleteRowByKey(sheet, keyHeader, keyValue) {
  var rowNum = findRowByKey(sheet, keyHeader, keyValue);
  if (rowNum > 0) sheet.deleteRow(rowNum);
}

/* ──────────────────────────────────────────────────────────────────
   R7 Phase 5: bulkGetAll 응답 캐시 — 비활성화 (시트 직접 편집 감지 불가)
   - 운영자가 시트를 직접 편집해도 onEdit 트리거 없이는 ScriptCache 무효화
     안 됨 → 최대 5분 staleness 발생
   - 차후 Drive.Files.modifiedTime 기반 invalidation 으로 재활성화 검토.
   - 헬퍼는 보존 (재활성화 시 활용).
   ────────────────────────────────────────────────────────────────── */
var BULK_CACHE_KEY_      = 'bulk_v1';
var BULK_CACHE_TTL_SEC_  = 300;
var BULK_CACHE_MAX_SIZE_ = 95 * 1024;
var BULK_CACHE_ENABLED_  = false; // R7 Phase 5: 안정성 우선 — 비활성화

function _getBulkCache_() {
  if (!BULK_CACHE_ENABLED_) return null;
  try { return CacheService.getScriptCache().get(BULK_CACHE_KEY_); }
  catch (e) { return null; }
}
function _setBulkCache_(serialized) {
  if (!BULK_CACHE_ENABLED_) return;
  if (!serialized || serialized.length > BULK_CACHE_MAX_SIZE_) return;
  try { CacheService.getScriptCache().put(BULK_CACHE_KEY_, serialized, BULK_CACHE_TTL_SEC_); }
  catch (e) { /* graceful */ }
}
function _invalidateBulkCache_() {
  try { CacheService.getScriptCache().remove(BULK_CACHE_KEY_); }
  catch (e) { /* graceful */ }
}

/* ETag (djb2) */
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

function sha256Hex(text) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

/**
 * Google ID Token (JWT) 검증.
 * Google `tokeninfo` 엔드포인트로 서명·만료까지 검증한 뒤
 * aud / iss / hd / email_verified 클레임을 추가 확인.
 *
 * @param {string} idToken
 * @returns {{ email: string, name: string, sub: string } | { error: string }}
 */
var ALLOWED_HD_DEFAULT_ = 'makestar.com';
function verifyGoogleIdToken_(idToken) {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('GOOGLE_CLIENT_ID');
  if (!clientId) return { error: '서버 설정 오류: GOOGLE_CLIENT_ID 가 Script Properties 에 없습니다. docs/runbooks/script-properties.md 참조.' };
  var allowedHd = props.getProperty('ALLOWED_HD') || ALLOWED_HD_DEFAULT_;

  var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var res;
  try {
    res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (e) {
    return { error: 'Google 토큰 검증 호출 실패: ' + String(e) };
  }
  if (res.getResponseCode() !== 200) {
    return { error: 'Google 토큰 검증 실패 (HTTP ' + res.getResponseCode() + ')' };
  }
  var claims;
  try { claims = JSON.parse(res.getContentText()); }
  catch (e) { return { error: '토큰 응답 파싱 실패' }; }

  if (claims.aud !== clientId) return { error: 'aud 불일치 — 다른 클라이언트의 토큰입니다.' };
  var iss = String(claims.iss || '');
  if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
    return { error: 'iss 불일치: ' + iss };
  }
  var nowSec = Math.floor(Date.now() / 1000);
  if (Number(claims.exp) <= nowSec) return { error: '토큰이 만료되었습니다.' };
  if (String(claims.email_verified) !== 'true') return { error: '이메일이 검증되지 않은 계정입니다.' };
  if (String(claims.hd || '') !== allowedHd) {
    return { error: '@' + allowedHd + ' 계정으로만 로그인할 수 있습니다.' };
  }
  return {
    email: String(claims.email || ''),
    name:  String(claims.name  || ''),
    sub:   String(claims.sub   || ''),
  };
}

function normalizeKey(k) {
  return String(k).replace(/\s+/g, '').toLowerCase();
}

function patchRowByKey(sheet, keyHeader, keyValue, patch) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return false;
  var headers = data[0];
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
   동시성 가드 — LockService

   B 그룹 audit (docs/stability-audit-B.md) 의 P0 수정.
   doPost 진입 시 ScriptLock 을 획득해 모든 쓰기를 직렬화.
   - tryLock(15_000) — Vercel Edge proxy 18s timeout 보다 짧게 잡아
     lock 대기 도중 timeout 으로 끊기지 않게 함
   - 획득 실패 시 {error:'lock_busy', retryAfterMs} 반환 — client 가
     transient 로 인식하고 재시도 가능 (idempotent action 만 자동 retry).
   - 본 audit 의 invariant 보장: B1(doPost 직렬화), B2(last-write-wins
     의 race window 제거), B3·B4(multi-step write 의 inter-write race 제거).
   doGet 은 read-only 라 lock 불필요 (시트는 row-level snapshot 일관성 제공).
   ══════════════════════════════════════════════════════════════════ */
var POST_LOCK_TIMEOUT_MS = 15000;
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(POST_LOCK_TIMEOUT_MS)) {
    return jsonResponse({
      error: 'lock_busy',
      retryAfterMs: 1000,
      message: '다른 요청이 처리 중입니다. 잠시 후 다시 시도해 주세요.',
    });
  }
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (e) { /* graceful */ }
  }
}

/* ══════════════════════════════════════════════════════════════════
   doGet — 데이터 조회
   ══════════════════════════════════════════════════════════════════ */
function doGet(e) {
  try {
    var params     = e.parameter || {};
    var action     = params.action || 'getOrg';
    var clientEtag = params.etag || '';

    /* 조직/구성원 */
    if (action === 'getOrg') {
      var sheet      = getSheet(SHEET_USERS, USER_HEADERS);
      var serverEtag = computeEtag(sheet);
      if (clientEtag && clientEtag === serverEtag) {
        return jsonResponse({ unchanged: true, etag: serverEtag });
      }
      return jsonResponse({ ok: true, rows: sheetToObjects(sheet), etag: serverEtag });
    }

    /* R7 Phase 4: 단일 호출로 모든 조직/권한 시트 일괄 반환.
       - 6개 fetch → 1개 fetch 로 HTTP 라운드트립 절감
       - ETag = 6개 시트 전체 데이터의 djb2 해시 — *모든 셀 변경* 정확히 감지
       - ScriptCache 는 운영자 직접 편집 무효화 어려움으로 비활성화 (R7 Phase 5 수정).
         차후 Drive.Files.modifiedTime 기반 invalidation 으로 재활성화 검토. */
    if (action === 'bulkGetAll') {
      var sheets = [
        { key: 'users',            sheet: getSheet(SHEET_USERS,       USER_HEADERS) },
        { key: 'orgUnits',         sheet: getSheet(SHEET_ORG,         ORG_HEADERS) },
        { key: 'secondaryOrgs',    sheet: getSheet(SHEET_SECONDARY,   SECONDARY_HEADERS) },
        { key: 'assignments',      sheet: getSheet(SHEET_ASSIGNMENTS, ASSIGNMENT_HEADERS) },
        { key: 'snapshots',        sheet: getSheet(SHEET_SNAPSHOTS,   SNAPSHOT_HEADERS) },
        { key: 'permissionGroups', sheet: getSheet(SHEET_PERMGROUPS,  PERMGROUP_HEADERS) },
      ];
      var payload = {};
      var etagInputs = [];
      for (var bi = 0; bi < sheets.length; bi++) {
        var item = sheets[bi];
        var values = item.sheet.getDataRange().getValues();

        // ETag = 시트 전체 직렬화 해시. 중간 행 변경도 정확히 감지.
        // simpleHash(djb2) 는 60KB 문자열도 ~5-10ms 로 빠름.
        etagInputs.push(item.key + ':' + simpleHash(JSON.stringify(values)));

        // values → 객체 배열 (중복 read 제거)
        var rows = [];
        if (values.length >= 2) {
          var headers = values[0];
          for (var rr = 1; rr < values.length; rr++) {
            var obj = {};
            for (var hh = 0; hh < headers.length; hh++) obj[headers[hh]] = values[rr][hh];
            rows.push(obj);
          }
        }
        payload[item.key] = rows;
      }
      var combinedEtag = simpleHash(etagInputs.join('||'));

      if (clientEtag && clientEtag === combinedEtag) {
        return jsonResponse({ unchanged: true, etag: combinedEtag });
      }
      var resp2 = { ok: true, etag: combinedEtag };
      for (var k2 in payload) resp2[k2] = payload[k2];
      return jsonResponse(resp2);
    }
    if (action === 'getOrgStructure') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_ORG, ORG_HEADERS)) });
    }
    if (action === 'getSecondaryOrgs') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_SECONDARY, SECONDARY_HEADERS)) });
    }

    /* 리뷰 운영 */
    if (action === 'getCycles') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_CYCLES, CYCLE_HEADERS)) });
    }
    if (action === 'getTemplates') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_TEMPLATES, TEMPLATE_HEADERS)) });
    }
    if (action === 'getSubmissions') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS)) });
    }
    if (action === 'getAuditLogs') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_AUDIT, AUDIT_HEADERS)) });
    }

    /* R1: 평가권 / 스냅샷 / 마스터 로그인 */
    if (action === 'getAssignments') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_ASSIGNMENTS, ASSIGNMENT_HEADERS)) });
    }
    if (action === 'getSnapshots') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_SNAPSHOTS, SNAPSHOT_HEADERS)) });
    }
    if (action === 'getImpersonationLogs') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_IMPLOG, IMPLOG_HEADERS)) });
    }
    /* R6: 권한 그룹 */
    if (action === 'getPermissionGroups') {
      return jsonResponse({ ok: true, rows: sheetToObjects(getSheet(SHEET_PERMGROUPS, PERMGROUP_HEADERS)) });
    }

    return jsonResponse({ error: '알 수 없는 action: ' + action });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

/* ══════════════════════════════════════════════════════════════════
   doPost — 데이터 쓰기
   ══════════════════════════════════════════════════════════════════ */
/* R7 Phase 4: bulkGetAll 캐시에 영향을 주는 쓰기 액션 — 처리 전 캐시 invalidate. */
var BULK_AFFECTING_ACTIONS_ = {
  // 구성원
  createUser: 1, updateUser: 1, deleteUser: 1, batchUpsertUsers: 1,
  // 조직
  upsertOrgUnit: 1, deleteOrgUnit: 1, batchUpsertOrgUnits: 1,
  // 겸임
  upsertSecondaryOrg: 1, deleteSecondaryOrg: 1,
  // 평가권
  upsertAssignment: 1, endAssignment: 1,
  // 인사 스냅샷
  createSnapshot: 1,
  // 권한 그룹
  upsertPermissionGroup: 1, deletePermissionGroup: 1,
  // R7 신규 회원 승인 — 구성원 + 권한그룹 변경
  approveMember: 1,
};

function doPost(e) {
  return withLock_(function() {
    return doPostInner_(e);
  });
}

function doPostInner_(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;
    var data    = payload.data || {};
    var rows    = payload.rows || [];

    // R7 Phase 4: 쓰기 액션이면 bulk 캐시 invalidate
    if (BULK_AFFECTING_ACTIONS_[action]) {
      _invalidateBulkCache_();
    }

    /* ── 인증 (Google SSO, 도메인 제한) ──
       사전 설정:
         확장 → Apps Script → 프로젝트 설정 → 스크립트 속성 에서
           GOOGLE_CLIENT_ID = <웹 클라이언트 ID>.apps.googleusercontent.com
         (선택) ALLOWED_HD = makestar.com  ← 미설정 시 코드 상수 사용 */
    if (action === 'verifyGoogleLogin') {
      var idToken = String(data['idToken'] || '').trim();
      if (!idToken) return jsonResponse({ error: 'idToken 누락' });
      var verified = verifyGoogleIdToken_(idToken);
      if (verified.error) return jsonResponse({ error: verified.error });

      var emailInput = String(verified.email).toLowerCase().trim();

      // 1) 기존 구성원이면 정상 로그인
      var allUsers   = sheetToObjects(getSheet(SHEET_USERS, USER_HEADERS));
      var matchUser  = null;
      for (var i = 0; i < allUsers.length; i++) {
        if (String(allUsers[i]['이메일']).toLowerCase().trim() === emailInput) {
          matchUser = allUsers[i]; break;
        }
      }
      if (matchUser) {
        return jsonResponse({
          userId: String(matchUser['사번']).trim(),
          email:  emailInput,
          status: 'active',
        });
      }

      // 2) 미등록 → _대기승인 시트 확인 / upsert
      var pendingSheet = getSheet(SHEET_PENDING, PENDING_HEADERS);
      var pendingRows  = sheetToObjects(pendingSheet);
      var existing     = null;
      for (var p = 0; p < pendingRows.length; p++) {
        if (String(pendingRows[p]['이메일']).toLowerCase().trim() === emailInput) {
          existing = pendingRows[p]; break;
        }
      }

      // 반려된 이메일은 차단
      if (existing && String(existing['상태']).toLowerCase() === 'rejected') {
        return jsonResponse({ error: '승인이 거절된 계정입니다. 관리자에게 문의해주세요.' });
      }
      // 정합성 오류: approved 인데 _구성원에 행이 없음
      if (existing && String(existing['상태']).toLowerCase() === 'approved') {
        return jsonResponse({ error: '계정 데이터 정합성 오류입니다. 관리자에게 문의해주세요. (' + emailInput + ')' });
      }

      // 신규 또는 기존 pending — upsert (최초로그인일시는 보존, status 강제로 pending)
      upsertRow(pendingSheet, PENDING_HEADERS, '이메일', {
        '이메일':         emailInput,
        '이름':           String(verified.name || (existing && existing['이름']) || ''),
        'Google_sub':     String(verified.sub  || (existing && existing['Google_sub']) || ''),
        '최초로그인일시': (existing && existing['최초로그인일시']) || new Date().toISOString(),
        '상태':           'pending',
        '처리자':         '',
        '처리일시':       '',
      });

      return jsonResponse({
        userId: null,
        email:  emailInput,
        name:   String(verified.name || ''),
        status: 'pending',
      });
    }

    /* ── R7: 신규 회원 승인 흐름 ───────────────────────────────── */

    if (action === 'getPendingApprovals') {
      // /team 승인 대기 탭 + 사이드바 배지에서 사용. status='pending' 만 반환.
      var pendingSheet = getSheet(SHEET_PENDING, PENDING_HEADERS);
      var pendingRows  = sheetToObjects(pendingSheet);
      var items = [];
      for (var pi = 0; pi < pendingRows.length; pi++) {
        var p = pendingRows[pi];
        if (String(p['상태']).toLowerCase() !== 'pending') continue;
        items.push({
          email:        String(p['이메일'] || '').toLowerCase().trim(),
          name:         String(p['이름'] || ''),
          googleSub:    String(p['Google_sub'] || ''),
          firstLoginAt: String(p['최초로그인일시'] || ''),
          status:       'pending',
        });
      }
      return jsonResponse({ ok: true, items: items });
    }

    if (action === 'approveMember') {
      // 입력: { email, userId, name, position, jobFunction, orgUnitId, managerId, permissionGroupIds[], approverId }
      var emailA       = String(data['email'] || '').toLowerCase().trim();
      var userIdA      = String(data['userId'] || '').trim();
      var nameA        = String(data['name'] || '').trim();
      var positionA    = String(data['position'] || '').trim();
      var jobFunctionA = String(data['jobFunction'] || '').trim();
      var orgUnitIdA   = String(data['orgUnitId'] || '').trim();
      var managerIdA   = String(data['managerId'] || '').trim();
      var groupIdsA    = Array.isArray(data['permissionGroupIds']) ? data['permissionGroupIds'] : [];
      var approverIdA  = String(data['approverId'] || '').trim();

      if (!emailA)  return jsonResponse({ error: 'email 필요' });
      if (!userIdA) return jsonResponse({ error: '사번(userId) 필요' });

      // 1) _구성원 시트 — idempotent (B 그룹 audit B-1.2)
      //   - 같은 (사번, 이메일) 이미 있으면 OK 처리해 retry 시 차단 안 됨
      //   - 다른 이메일이 같은 사번을 점유 중이면 거부
      var userSheet = getSheet(SHEET_USERS, USER_HEADERS);
      var userExisted = false;
      if (findRowByKey(userSheet, '사번', userIdA) >= 0) {
        var existingUsersA = sheetToObjects(userSheet);
        var existingUserA = null;
        for (var eiA = 0; eiA < existingUsersA.length; eiA++) {
          if (String(existingUsersA[eiA]['사번']).trim() === userIdA) {
            existingUserA = existingUsersA[eiA]; break;
          }
        }
        var existingEmailA = existingUserA ? String(existingUserA['이메일'] || '').toLowerCase().trim() : '';
        if (existingEmailA && existingEmailA !== emailA) {
          return jsonResponse({ error: '이미 존재하는 사번입니다 (다른 이메일): ' + userIdA });
        }
        userExisted = true;
      } else {
        upsertRow(userSheet, USER_HEADERS, '사번', {
          '사번':           userIdA,
          '이메일':         emailA,
          '성명':           nameA,
          '직책':           positionA,
          '직무':           jobFunctionA,    // 신규 — 직무 (예: 엔지니어)
          '보고대상(사번)': managerIdA,      // 신규 — 보고대상 사번
          '주조직ID':       orgUnitIdA,
          '역할':           'member',
          '입사일':         new Date().toISOString().slice(0, 10),
          '재직 여부':      'true',
          '상태분류':       'active',
        });
      }

      // 2) 권한 그룹 멤버 추가
      var permSheet = getSheet(SHEET_PERMGROUPS, PERMGROUP_HEADERS);
      var permData  = permSheet.getDataRange().getValues();
      var permHdrs  = permData[0];
      var idColG    = permHdrs.indexOf('그룹ID');
      var memColG   = permHdrs.indexOf('멤버사번JSON');
      groupIdsA.forEach(function(gid) {
        for (var gr = 1; gr < permData.length; gr++) {
          if (String(permData[gr][idColG]) !== String(gid)) continue;
          var members = [];
          try {
            var raw = String(permData[gr][memColG] || '[]');
            members = JSON.parse(raw);
            if (!Array.isArray(members)) members = [];
          } catch (e) { members = []; }
          if (members.indexOf(userIdA) < 0) {
            members.push(userIdA);
            permSheet.getRange(gr + 1, memColG + 1).setValue(JSON.stringify(members));
          }
          break;
        }
      });

      // 3) _대기승인 상태 변경
      var pendingSheet2 = getSheet(SHEET_PENDING, PENDING_HEADERS);
      upsertRow(pendingSheet2, PENDING_HEADERS, '이메일', {
        '이메일':   emailA,
        '상태':     'approved',
        '처리자':   approverIdA,
        '처리일시': new Date().toISOString(),
      });

      // 4) 감사 로그
      // 주의: 현재 retry 시 중복 append 가능. B-2.4 (audit idempotency key) 에서 처리 예정.
      appendRowData(getSheet(SHEET_AUDIT, AUDIT_HEADERS), AUDIT_HEADERS, {
        '로그ID':     'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        '사이클ID':   '',
        '발생자ID':   approverIdA,
        '액션':       'member.approved',
        '대상IDS':    userIdA,
        '요약':       emailA + ' 신규 회원 승인 (사번 ' + userIdA + ')',
        '메타JSON':   JSON.stringify({ email: emailA, userId: userIdA, permissionGroupIds: groupIdsA }),
        '발생일시':   new Date().toISOString(),
      });

      return jsonResponse({
        ok: true,
        userId: userIdA,
        steps: {
          user:             userExisted ? 'already_exists' : 'created',
          permissionGroups: 'updated',
          pending:          'updated',
          audit:            'appended',
        },
      });
    }

    if (action === 'rejectMember') {
      // 입력: { email, reason, approverId }
      var emailR      = String(data['email'] || '').toLowerCase().trim();
      var reasonR     = String(data['reason'] || '').trim();
      var approverIdR = String(data['approverId'] || '').trim();
      if (!emailR) return jsonResponse({ error: 'email 필요' });

      var pendingSheet3 = getSheet(SHEET_PENDING, PENDING_HEADERS);
      if (findRowByKey(pendingSheet3, '이메일', emailR) < 0) {
        return jsonResponse({ error: '대기 row 가 없습니다: ' + emailR });
      }
      upsertRow(pendingSheet3, PENDING_HEADERS, '이메일', {
        '이메일':   emailR,
        '상태':     'rejected',
        '처리자':   approverIdR,
        '처리일시': new Date().toISOString(),
      });

      appendRowData(getSheet(SHEET_AUDIT, AUDIT_HEADERS), AUDIT_HEADERS, {
        '로그ID':     'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        '사이클ID':   '',
        '발생자ID':   approverIdR,
        '액션':       'member.rejected',
        '대상IDS':    emailR,
        '요약':       emailR + ' 신규 회원 반려 — ' + (reasonR || '사유 없음'),
        '메타JSON':   JSON.stringify({ email: emailR, reason: reasonR }),
        '발생일시':   new Date().toISOString(),
      });

      return jsonResponse({ ok: true });
    }

    /* ── _계정 시트 동기화 (권한관리 인덱스) ──
       비밀번호 검증은 더 이상 수행하지 않으나, 시트에 사번/이메일 행을 유지하여
       관리자가 추가 컬럼(예: 권한 활성여부 등)으로 권한관리할 수 있도록 동기화. */
    if (action === 'initAccount') {
      var sheet  = getSheet(SHEET_ACCOUNTS, ACCOUNT_HEADERS);
      if (findRowByKey(sheet, '사번', data['userId']) < 0) {
        upsertRow(sheet, ACCOUNT_HEADERS, '사번', {
          '사번':   data['userId'],
          '이메일': String(data['email'] || '').toLowerCase().trim(),
        });
      }
      return jsonResponse({ ok: true });
    }

    if (action === 'syncAccounts') {
      var accountSheet = getSheet(SHEET_ACCOUNTS, ACCOUNT_HEADERS);
      var uRows        = sheetToObjects(getSheet(SHEET_USERS, USER_HEADERS));
      var created      = 0;
      uRows.forEach(function(u) {
        var uid = String(u['사번']).trim();
        if (!uid) return;
        if (findRowByKey(accountSheet, '사번', uid) < 0) {
          upsertRow(accountSheet, ACCOUNT_HEADERS, '사번', {
            '사번':   uid,
            '이메일': String(u['이메일'] || '').toLowerCase().trim(),
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
      // _계정 시트 인덱스 동기화 (권한관리용)
      var accSheet = getSheet(SHEET_ACCOUNTS, ACCOUNT_HEADERS);
      if (findRowByKey(accSheet, '사번', userId) < 0) {
        upsertRow(accSheet, ACCOUNT_HEADERS, '사번', {
          '사번':   userId,
          '이메일': String(data['이메일'] || '').toLowerCase().trim(),
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
      // B-2.1 (audit-B 매트릭스 B5): partial result 가시화
      //   - 이전: forEach 도중 throw → 1·2 시트 반영, 3·4·5 미반영, 응답 {error}.
      //     client 는 어디까지 반영됐는지 모름.
      //   - 변경: row 별 try-catch + failed 배열 누적. 응답에 processed/total/failed.
      //     client (sheetWriter.postPayload) 가 failed 비어있지 않으면 throw → 사용자 가시화.
      //     멱등 액션이므로 retry 시 idempotent 하게 모든 row 재시도됨.
      var sheet = getSheet(SHEET_USERS, USER_HEADERS);
      var processed = 0;
      var failed = [];
      for (var bi = 0; bi < rows.length; bi++) {
        try {
          upsertRow(sheet, USER_HEADERS, '사번', rows[bi]);
          processed++;
        } catch (eRow) {
          failed.push({ index: bi, key: String(rows[bi]['사번'] || ''), error: String(eRow) });
        }
      }
      return jsonResponse({
        ok: failed.length === 0,
        count: processed,
        total: rows.length,
        failed: failed,
      });
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
    if (action === 'batchUpsertOrgUnits') {
      // B-2.1: batchUpsertUsers 와 동일 패턴 — partial result 가시화
      var orgSheet = getSheet(SHEET_ORG, ORG_HEADERS);
      var processedO = 0;
      var failedO = [];
      for (var boi = 0; boi < rows.length; boi++) {
        try {
          upsertRow(orgSheet, ORG_HEADERS, '조직ID', rows[boi]);
          processedO++;
        } catch (eRowO) {
          failedO.push({ index: boi, key: String(rows[boi]['조직ID'] || ''), error: String(eRowO) });
        }
      }
      return jsonResponse({
        ok: failedO.length === 0,
        count: processedO,
        total: rows.length,
        failed: failedO,
      });
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
      // B-2.2 (audit-B 매트릭스 B6): cascade 안전화
      //   - 이전: cycle 먼저 삭제 → submissions loop. submissions 삭제 도중
      //     실패하면 cycle 만 사라지고 submissions orphan 잔재.
      //   - 변경: submissions 먼저 삭제 → cycle 마지막. 부분 실패 시 cycle 이
      //     살아있어 retry 시 idempotent 하게 나머지 처리 가능 (orphan 위험 제거).
      var cycleId  = data['사이클ID'];
      var subSheet = getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS);
      var subData  = subSheet.getDataRange().getValues();
      var deletedSubmissions = 0;
      if (subData.length > 1) {
        var hdrs   = subData[0];
        var colIdx = hdrs.indexOf('사이클ID');
        for (var i = subData.length - 1; i >= 1; i--) {
          if (String(subData[i][colIdx]) === String(cycleId)) {
            subSheet.deleteRow(i + 1);
            deletedSubmissions++;
          }
        }
      }
      // 모든 submissions 삭제 성공 후에만 cycle 삭제
      deleteRowByKey(getSheet(SHEET_CYCLES, CYCLE_HEADERS), '사이클ID', cycleId);
      return jsonResponse({ ok: true, deletedSubmissions: deletedSubmissions });
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

    /* ── 감사 로그 (append-only) ──
       B-2.4 (audit-B 매트릭스 B10): client 측 deterministic id (auditLogStore
       의 deriveAuditId) + 본 dedupe 로 defense in depth.
       client retry 또는 동시 재시도 시 같은 로그ID 가 두 번 들어와도 시트엔
       1번만 기록됨. */
    if (action === 'appendAudit') {
      var auditSheet = getSheet(SHEET_AUDIT, AUDIT_HEADERS);
      var logIdA = String(data['로그ID'] || '');
      if (logIdA && findRowByKey(auditSheet, '로그ID', logIdA) >= 0) {
        return jsonResponse({ ok: true, deduped: true });
      }
      appendRowData(auditSheet, AUDIT_HEADERS, data);
      return jsonResponse({ ok: true });
    }

    /* ── R1: 평가권 ── */
    if (action === 'upsertAssignment') {
      upsertRow(getSheet(SHEET_ASSIGNMENTS, ASSIGNMENT_HEADERS), ASSIGNMENT_HEADERS, '평가권ID', data);
      return jsonResponse({ ok: true });
    }
    if (action === 'endAssignment') {
      var assignSheet = getSheet(SHEET_ASSIGNMENTS, ASSIGNMENT_HEADERS);
      var rowNum = findRowByKey(assignSheet, '평가권ID', data['평가권ID']);
      if (rowNum > 0) {
        var hdrs = assignSheet.getRange(1, 1, 1, assignSheet.getLastColumn()).getValues()[0];
        var col  = hdrs.indexOf('종료일') + 1;
        if (col > 0) assignSheet.getRange(rowNum, col).setValue(data['종료일'] || new Date().toISOString());
      }
      return jsonResponse({ ok: true });
    }

    /* ── R1: 인사 스냅샷 ── */
    if (action === 'createSnapshot') {
      appendRowData(getSheet(SHEET_SNAPSHOTS, SNAPSHOT_HEADERS), SNAPSHOT_HEADERS, data);
      return jsonResponse({ ok: true });
    }

    /* ── R6: 권한 그룹 ── */
    if (action === 'upsertPermissionGroup') {
      upsertRow(getSheet(SHEET_PERMGROUPS, PERMGROUP_HEADERS), PERMGROUP_HEADERS, '그룹ID', data);
      return jsonResponse({ ok: true });
    }
    if (action === 'deletePermissionGroup') {
      deleteRowByKey(getSheet(SHEET_PERMGROUPS, PERMGROUP_HEADERS), '그룹ID', data['그룹ID']);
      return jsonResponse({ ok: true });
    }

    /* ── R1: 마스터 로그인 감사 ── */
    if (action === 'logImpersonationStart') {
      appendRowData(getSheet(SHEET_IMPLOG, IMPLOG_HEADERS), IMPLOG_HEADERS, data);
      return jsonResponse({ ok: true });
    }
    if (action === 'logImpersonationEnd') {
      var implogSheet = getSheet(SHEET_IMPLOG, IMPLOG_HEADERS);
      var rowNum2 = findRowByKey(implogSheet, '로그ID', data['로그ID']);
      if (rowNum2 > 0) {
        var hdrs2 = implogSheet.getRange(1, 1, 1, implogSheet.getLastColumn()).getValues()[0];
        var col2  = hdrs2.indexOf('종료일시') + 1;
        if (col2 > 0) implogSheet.getRange(rowNum2, col2).setValue(data['종료일시'] || new Date().toISOString());
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

/* ══════════════════════════════════════════════════════════════════
   마이그레이션 — 신규 컬럼을 기존 시트에 일괄 보강.
   Apps Script 편집기에서 한번만 실행.
   ══════════════════════════════════════════════════════════════════ */
function migrate_addMissingColumns() {
  ensureHeaders(getSheet(SHEET_USERS,       USER_HEADERS),       USER_HEADERS);
  ensureHeaders(getSheet(SHEET_ORG,         ORG_HEADERS),        ORG_HEADERS);
  ensureHeaders(getSheet(SHEET_SECONDARY,   SECONDARY_HEADERS),  SECONDARY_HEADERS);
  ensureHeaders(getSheet(SHEET_CYCLES,      CYCLE_HEADERS),      CYCLE_HEADERS);
  ensureHeaders(getSheet(SHEET_TEMPLATES,   TEMPLATE_HEADERS),   TEMPLATE_HEADERS);
  ensureHeaders(getSheet(SHEET_SUBMISSIONS, SUBMISSION_HEADERS), SUBMISSION_HEADERS);
  ensureHeaders(getSheet(SHEET_ACCOUNTS,    ACCOUNT_HEADERS),    ACCOUNT_HEADERS);
  ensureHeaders(getSheet(SHEET_AUDIT,       AUDIT_HEADERS),      AUDIT_HEADERS);
  // R1: 신규 시트 3종
  ensureHeaders(getSheet(SHEET_ASSIGNMENTS, ASSIGNMENT_HEADERS), ASSIGNMENT_HEADERS);
  ensureHeaders(getSheet(SHEET_SNAPSHOTS,   SNAPSHOT_HEADERS),   SNAPSHOT_HEADERS);
  ensureHeaders(getSheet(SHEET_IMPLOG,      IMPLOG_HEADERS),     IMPLOG_HEADERS);
  // R6: 권한 그룹 시트
  ensureHeaders(getSheet(SHEET_PERMGROUPS,  PERMGROUP_HEADERS),  PERMGROUP_HEADERS);
  Logger.log('마이그레이션 완료 — 12개 시트 헤더 점검됨 (R1+R6).');
}

/* ══════════════════════════════════════════════════════════════════
   R1 마이그레이션 — _구성원 시트의 기존 데이터를 신규 컬럼에 채워넣음
   + _평가권 시트에 시드 데이터 생성.
   1회 실행 후에는 멱등 (이미 채워진 행은 건드리지 않음).
   ══════════════════════════════════════════════════════════════════ */
function migrateUsersToR1() {
  // 사전: 컬럼 보강
  migrate_addMissingColumns();

  var userSheet     = getSheet(SHEET_USERS, USER_HEADERS);
  var users         = sheetToObjects(userSheet);
  var orgSheet      = getSheet(SHEET_ORG, ORG_HEADERS);
  var orgUnits      = sheetToObjects(orgSheet);
  var assignSheet   = getSheet(SHEET_ASSIGNMENTS, ASSIGNMENT_HEADERS);
  var existAssigns  = sheetToObjects(assignSheet);

  // 활성 평가권 키 셋
  var activeKeys = {};
  existAssigns.forEach(function(a) {
    if (!a['종료일']) {
      activeKeys[a['피평가자사번'] + ':' + a['차수']] = true;
    }
  });

  // 헤더 행 확인 (사번 → 행 번호 매핑)
  var userData = userSheet.getDataRange().getValues();
  var userHdrs = userData[0];
  var idCol         = userHdrs.indexOf('사번');
  var orgUnitIdCol  = userHdrs.indexOf('주조직ID');
  var statusCol     = userHdrs.indexOf('상태분류');
  var statusAtCol   = userHdrs.indexOf('상태변경일시');
  var deptCol       = userHdrs.indexOf('주조직');
  var subOrgCol     = userHdrs.indexOf('부조직');
  var teamCol       = userHdrs.indexOf('팀');
  var squadCol      = userHdrs.indexOf('스쿼드');
  var activeCol     = userHdrs.indexOf('재직 여부');
  var leaveCol      = userHdrs.indexOf('보고대상(사번)'); // not directly used
  void leaveCol;

  // 1) User 매핑
  var migratedCount = 0;
  var fallbackCount = 0;
  for (var r = 1; r < userData.length; r++) {
    var row = userData[r];
    var userId = String(row[idCol] || '').trim();
    if (!userId) continue;

    // 주조직ID 채우기 (이미 있으면 보존)
    if (orgUnitIdCol >= 0 && !String(row[orgUnitIdCol] || '').trim()) {
      var found = null;
      var candidates = [
        { name: row[squadCol],  type: 'squad' },
        { name: row[teamCol],   type: 'team' },
        { name: row[subOrgCol], type: 'subOrg' },
        { name: row[deptCol],   type: 'mainOrg' },
      ];
      for (var ci = 0; ci < candidates.length && !found; ci++) {
        var c = candidates[ci];
        if (!c.name) continue;
        for (var oi = 0; oi < orgUnits.length; oi++) {
          var ou = orgUnits[oi];
          if (String(ou['조직명']) === String(c.name) && String(ou['조직유형']) === c.type) {
            found = ou; break;
          }
        }
        if (!found) {
          for (var oi2 = 0; oi2 < orgUnits.length; oi2++) {
            if (String(orgUnits[oi2]['조직명']) === String(c.name)) { found = orgUnits[oi2]; break; }
          }
        }
      }
      if (!found) {
        // fallback: 첫 mainOrg
        for (var oi3 = 0; oi3 < orgUnits.length; oi3++) {
          if (String(orgUnits[oi3]['조직유형']) === 'mainOrg') { found = orgUnits[oi3]; break; }
        }
        if (found) fallbackCount++;
      }
      if (found) {
        userSheet.getRange(r + 1, orgUnitIdCol + 1).setValue(found['조직ID']);
        migratedCount++;
      }
    }

    // 상태분류 채우기 (이미 있으면 보존)
    if (statusCol >= 0 && !String(row[statusCol] || '').trim()) {
      var isActiveRaw = String(row[activeCol] || 'true').toLowerCase().trim();
      var status = isActiveRaw === 'false' ? 'terminated' : 'active';
      userSheet.getRange(r + 1, statusCol + 1).setValue(status);
      if (status === 'terminated' && statusAtCol >= 0) {
        userSheet.getRange(r + 1, statusAtCol + 1).setValue(new Date().toISOString());
      }
    }
  }

  // 2) ReviewerAssignment 시드
  var seededFromManager = 0;
  var seededFromOrgHead = 0;
  var skipped           = 0;
  var freshUsers = sheetToObjects(userSheet); // 방금 업데이트된 데이터
  for (var ui = 0; ui < freshUsers.length; ui++) {
    var u = freshUsers[ui];
    if (String(u['권한']).trim() === 'admin' || String(u['역할']).trim() === 'admin') continue;
    var key = u['사번'] + ':1';
    if (activeKeys[key]) { skipped++; continue; }

    var managerId = String(u['보고대상(사번)'] || '').trim();
    var seedRow = null;

    // a) managerId 우선
    if (managerId) {
      seedRow = {
        '평가권ID':     'ra_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        '피평가자사번': u['사번'],
        '평가자사번':   managerId,
        '차수':         '1',
        '부여출처':     'manual',
        '시작일':       new Date().toISOString(),
        '종료일':       '',
        '생성일시':     new Date().toISOString(),
        '생성자':       'system_migration_r1',
        '비고':         '',
      };
      seededFromManager++;
    } else if (u['주조직ID']) {
      // b) 조직 트리에서 head 찾기
      var orgId = u['주조직ID'];
      var visited = {};
      var headFound = null;
      while (orgId && !visited[orgId]) {
        visited[orgId] = true;
        var ou = null;
        for (var oi = 0; oi < orgUnits.length; oi++) {
          if (String(orgUnits[oi]['조직ID']) === String(orgId)) { ou = orgUnits[oi]; break; }
        }
        if (!ou) break;
        if (ou['조직장사번'] && ou['조직장사번'] !== u['사번']) {
          headFound = ou['조직장사번']; break;
        }
        orgId = ou['상위조직ID'];
      }
      if (headFound) {
        seedRow = {
          '평가권ID':     'ra_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
          '피평가자사번': u['사번'],
          '평가자사번':   headFound,
          '차수':         '1',
          '부여출처':     'org_head_inherited',
          '시작일':       new Date().toISOString(),
          '종료일':       '',
          '생성일시':     new Date().toISOString(),
          '생성자':       'system_migration_r1',
          '비고':         '',
        };
        seededFromOrgHead++;
      }
    }

    if (seedRow) {
      appendRowData(assignSheet, ASSIGNMENT_HEADERS, seedRow);
      activeKeys[key] = true;
    }
  }

  Logger.log('R1 user 마이그레이션 완료: 주조직ID 채움=' + migratedCount + ', fallback=' + fallbackCount + ', 평가권 시드(매니저)=' + seededFromManager + ', 시드(조직장)=' + seededFromOrgHead + ', skip=' + skipped);
}
