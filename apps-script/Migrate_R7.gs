/**
 * Migrate_R7.gs — R7 스프레드시트 DB 개편 마이그레이션 (단일 진실 = docs/db-schema.md)
 *
 * [목적]
 *   - 기존 `_구성원` / `_조직구조` / `_리뷰` 시트를 보존한 채 새 시트
 *     `구성원_v2` / `조직_v2` / `대기승인` / `사이클_v2` 를 생성·이전합니다.
 *   - admin role 보유자를 `_권한그룹.pg_owner.멤버사번JSON` 에 자동 병합합니다.
 *   - `_계정` 시트(Google SSO 도입으로 폐기)는 즉시 삭제 가능합니다.
 *   - 기존 시트의 archive(이름 변경)는 별도 함수로 분리 — 1주일 검증 후 수동 실행.
 *
 * [실행 순서]
 *   1) Apps Script 편집기 → 함수 드롭다운 → `migrateR7_run` 선택 → ▶ 실행
 *   2) 새 시트 4개가 생성되고 기존 데이터가 복사되는지 확인
 *   3) 클라이언트(localhost:5174 / 운영) 에서 정상 동작 확인 (1주일 권장)
 *   4) `migrateR7_cleanupDeadSheets` 실행 → `_계정` 등 폐기 시트 정리
 *   5) `migrateR7_archiveOldSheets` 실행 → 구버전 시트를 `_archived_YYYYMMDD` 로 보관
 *
 * [안전장치]
 *   - 새 시트가 이미 존재하면 데이터 손실 없이 backup 으로 복사 후 재생성합니다.
 *   - 기존 운영 시트(`_구성원`, `_조직구조`, `_리뷰`)는 마이그레이션 단계에서 절대 수정하지 않습니다.
 *   - 모든 함수는 멱등(여러 번 실행해도 같은 결과).
 */

/* ── 시트 이름 (R7 단일 진실) ─────────────────────────────────────── */
var R7_SHEET_USERS    = '구성원_v2';
var R7_SHEET_ORG      = '조직_v2';
var R7_SHEET_PENDING  = '대기승인';
var R7_SHEET_CYCLES   = '사이클_v2';

/* ── 헤더 (db-schema.md §2 와 일치) ─────────────────────────────── */
var R7_USER_HEADERS = [
  '사번', '이메일', '이름', '직책', '소속조직ID', '보조조직IDs',
  '입사일', '퇴사일', '비고'
];

var R7_ORG_HEADERS = [
  '조직ID', '조직명', '부모조직ID', '표시순서', '조직장사번', '비고'
];

var R7_PENDING_HEADERS = [
  '이메일', '이름', 'Google_sub', '최초로그인일시',
  '상태', '처리자', '처리일시'
];

// 사이클은 핵심 9 + 스페이서('_') + 부가 = 컬럼 그룹핑.
// 부가 컬럼 의미는 기존 CYCLE_HEADERS 와 동일.
var R7_CYCLE_HEADERS = [
  // 핵심 9
  '사이클ID', '제목', '상태', '자기평가시작', '자기평가종료',
  '하향평가시작', '하향평가종료', '템플릿ID', '비고',
  // 스페이서
  '_',
  // 부가 (기존 CYCLE_HEADERS 호환)
  '유형', '리뷰유형', '대상모드', '대상매니저ID', '대상사용자IDS', '폴더ID', '태그',
  '인사적용방식', '인사스냅샷ID', '평가차수배열',
  '자기평가마감', '매니저평가마감', '예약발행일시', '편집잠금일시', '종료일시', '보관일시',
  '익명정책JSON', '공개정책JSON', '참고정보JSON', '동료선택정책JSON', '자동전환JSON', '알림정책JSON',
  '템플릿스냅샷JSON', '템플릿스냅샷일시', '복제원본ID',
  '생성자ID', '생성일시', '완료율', '자동보관플래그'
];

/* ══════════════════════════════════════════════════════════════════
   1) 메인 마이그레이션 — 새 시트 생성 + 데이터 복사
   ══════════════════════════════════════════════════════════════════ */
function migrateR7_run() {
  var ss = _r7_ss();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');

  // 1. 신규 시트 생성 (이미 있으면 backup 후 재생성)
  _r7_recreateSheet(ss, R7_SHEET_USERS,   R7_USER_HEADERS,    stamp);
  _r7_recreateSheet(ss, R7_SHEET_ORG,     R7_ORG_HEADERS,     stamp);
  _r7_recreateSheet(ss, R7_SHEET_PENDING, R7_PENDING_HEADERS, stamp);
  _r7_recreateSheet(ss, R7_SHEET_CYCLES,  R7_CYCLE_HEADERS,   stamp);

  // 2. 데이터 이전
  var orgRowsByLegacyId = _r7_migrateOrgs(ss);
  var userMigratedCount = _r7_migrateUsers(ss, orgRowsByLegacyId);
  var cycleCount = _r7_migrateCycles(ss);

  // 3. admin role 보유자를 pg_owner 그룹에 병합
  var adminMergedCount = _r7_mergeAdminsToOwnerGroup(ss);

  var msg = [
    'R7 마이그레이션 완료',
    '',
    '- 구성원_v2 :  ' + userMigratedCount + '명 이전',
    '- 조직_v2   :  ' + Object.keys(orgRowsByLegacyId).length + '건 이전',
    '- 대기승인  :  빈 시트 생성 완료',
    '- 사이클_v2 :  ' + cycleCount + '건 이전',
    '- pg_owner :  admin role 보유자 ' + adminMergedCount + '명 병합',
    '',
    '기존 시트는 수정하지 않았습니다.',
    '운영 검증(1주일 권장) 후 migrateR7_archiveOldSheets() 를 실행하세요.'
  ].join('\n');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
}

/* ══════════════════════════════════════════════════════════════════
   2) 폐기 시트 정리 — 즉시 실행 가능 (Google SSO 도입 후 사용 안 함)
   ══════════════════════════════════════════════════════════════════ */
function migrateR7_cleanupDeadSheets() {
  var ss = _r7_ss();
  var deadSheets = ['_계정']; // 향후 필요 시 추가
  var deleted = [];
  deadSheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      ss.deleteSheet(sheet);
      deleted.push(name);
    }
  });
  var msg = deleted.length > 0
    ? '폐기 시트 삭제 완료: ' + deleted.join(', ')
    : '삭제할 폐기 시트가 없습니다.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
}

/* ══════════════════════════════════════════════════════════════════
   3) 구버전 시트 archive — 1주일 검증 후 수동 실행 권장
   ══════════════════════════════════════════════════════════════════ */
function migrateR7_archiveOldSheets() {
  var ss = _r7_ss();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var oldSheets = ['_구성원', '_조직구조', '_리뷰'];
  var archived = [];
  oldSheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.setName(name + '_archived_' + stamp);
      archived.push(name);
    }
  });
  var msg = archived.length > 0
    ? 'archive 완료: ' + archived.map(function(n){return n + ' → ' + n + '_archived_' + stamp;}).join('\n')
    : 'archive 대상 시트가 없습니다.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
}

/* ══════════════════════════════════════════════════════════════════
   4) 롤백 — 새 시트 4종을 backup 으로 옮기고 다시 빈 시트로 시작
   ══════════════════════════════════════════════════════════════════ */
function migrateR7_rollback() {
  var ss = _r7_ss();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  var moved = [];
  [R7_SHEET_USERS, R7_SHEET_ORG, R7_SHEET_PENDING, R7_SHEET_CYCLES].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.setName(name + '_rollback_' + stamp);
      moved.push(name);
    }
  });
  var msg = moved.length > 0
    ? '롤백 완료: ' + moved.join(', ') + ' → 각 _rollback_' + stamp
    : '롤백할 R7 시트가 없습니다.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
}

/* ══════════════════════════════════════════════════════════════════
   내부 헬퍼
   ══════════════════════════════════════════════════════════════════ */

function _r7_ss() {
  // ReviewFlow.gs 의 SPREADSHEET_ID 가 있으면 사용, 없으면 활성 시트
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** 기존 시트가 있으면 backup 으로 복사 후 새 시트로 재생성 (헤더만) */
function _r7_recreateSheet(ss, name, headers, stamp) {
  var existing = ss.getSheetByName(name);
  if (existing) {
    existing.copyTo(ss).setName(name + '_backup_' + stamp);
    ss.deleteSheet(existing);
  }
  var sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
  // 사이클: 핵심 9 컬럼은 진한 배경, 부가 컬럼은 옅은 회색
  if (name === R7_SHEET_CYCLES) {
    sheet.getRange(1, 1, 1, 9).setBackground('#e0e7ff');           // 핵심 9
    sheet.getRange(1, 10, 1, 1).setBackground('#f9fafb');          // 스페이서
    sheet.getRange(1, 11, 1, headers.length - 10).setBackground('#f3f4f6'); // 부가
  }
  return sheet;
}

/** 시트 → 객체 배열 (헤더 키) */
function _r7_readObjects(sheet) {
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function(h) { return String(h).trim(); });
  return values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  }).filter(function(obj) {
    // 모든 컬럼이 비어있는 행은 스킵
    return headers.some(function(h) {
      var v = obj[h];
      return v !== '' && v !== null && v !== undefined;
    });
  });
}

/** 객체 배열 → 시트 (헤더 순서대로) */
function _r7_writeObjects(sheet, headers, rows) {
  if (!sheet || rows.length === 0) return;
  var values = rows.map(function(r) {
    return headers.map(function(h) {
      var v = r[h];
      return v === undefined || v === null ? '' : v;
    });
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function _r7_str(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function _r7_lower(v) {
  return _r7_str(v).toLowerCase();
}

/* ── 조직 마이그레이션 ─────────────────────────────────────────────
   기존 `_조직구조` 의 `조직유형` 컬럼을 무시하고 부모 체인만 보존.
   반환: { legacyOrgId: { 조직ID, 조직명, ... } } — 사용자 매핑에 사용. */
function _r7_migrateOrgs(ss) {
  var oldSheet = ss.getSheetByName('_조직구조');
  if (!oldSheet) {
    Logger.log('_조직구조 시트가 없어 조직 마이그레이션 스킵');
    return {};
  }
  var oldOrgs = _r7_readObjects(oldSheet);
  var rowsByLegacyId = {};
  var newRows = oldOrgs.map(function(o) {
    var orgId    = _r7_str(o['조직ID']);
    var orgName  = _r7_str(o['조직명']);
    var parentId = _r7_str(o['상위조직ID']);
    var headId   = _r7_str(o['조직장사번']);
    var order    = _r7_str(o['순서']);
    if (!orgId) return null;
    var newRow = {
      '조직ID': orgId,
      '조직명': orgName,
      '부모조직ID': parentId,
      '표시순서': order || '',
      '조직장사번': headId,
      '비고': ''
    };
    rowsByLegacyId[orgId] = newRow;
    return newRow;
  }).filter(Boolean);

  // 5단계 검증 (경고만, 차단하지 않음)
  newRows.forEach(function(row) {
    var depth = _r7_orgDepth(row['조직ID'], rowsByLegacyId);
    if (depth >= 5) {
      Logger.log('[경고] 조직 ' + row['조직ID'] + '(' + row['조직명'] + ') depth=' + depth + ' — R7 5단계 제한 초과');
    }
  });

  _r7_writeObjects(ss.getSheetByName(R7_SHEET_ORG), R7_ORG_HEADERS, newRows);
  return rowsByLegacyId;
}

function _r7_orgDepth(orgId, byId) {
  var depth = 0;
  var seen = {};
  var cursor = byId[orgId];
  while (cursor && cursor['부모조직ID']) {
    if (seen[cursor['조직ID']]) break;  // cycle 방어
    seen[cursor['조직ID']] = true;
    cursor = byId[cursor['부모조직ID']];
    depth++;
    if (depth > 10) break;
  }
  return depth;
}

/* ── 구성원 마이그레이션 ─────────────────────────────────────────── */
function _r7_migrateUsers(ss, orgRowsByLegacyId) {
  var oldSheet = ss.getSheetByName('_구성원');
  if (!oldSheet) {
    Logger.log('_구성원 시트가 없어 구성원 마이그레이션 스킵');
    return 0;
  }
  var oldUsers = _r7_readObjects(oldSheet);

  // 보조조직 — `_겸임` 시트가 있으면 사번별로 묶기
  var secByUserId = {};
  var secSheet = ss.getSheetByName('_겸임');
  if (secSheet) {
    var secRows = _r7_readObjects(secSheet);
    secRows.forEach(function(s) {
      var uid = _r7_str(s['사번']);
      if (!uid) return;
      var oid = _r7_str(s['겸임조직ID']);
      if (!oid) return;
      var endDate = _r7_str(s['종료일']);
      if (endDate) return; // 종료된 겸임은 제외
      if (!secByUserId[uid]) secByUserId[uid] = [];
      secByUserId[uid].push(oid);
    });
  }

  var newRows = oldUsers.map(function(u) {
    var userId = _r7_str(u['사번']);
    if (!userId) return null;

    // 소속조직ID: 우선순위 = 주조직ID(R1) > 4단계 컬럼 매칭(주조직 → 부조직 → 팀 → 스쿼드)
    var orgUnitId = _r7_str(u['주조직ID']);
    if (!orgUnitId) {
      // legacy 4단계 컬럼에서 가장 깊은 비어있지 않은 값으로 조직명 매칭
      var candidates = [u['스쿼드'], u['팀'], u['부조직'], u['주조직']];
      for (var i = 0; i < candidates.length; i++) {
        var name = _r7_str(candidates[i]);
        if (!name) continue;
        for (var legacyId in orgRowsByLegacyId) {
          if (orgRowsByLegacyId[legacyId]['조직명'] === name) {
            orgUnitId = legacyId;
            break;
          }
        }
        if (orgUnitId) break;
      }
    }

    var secondaryIds = (secByUserId[userId] || []).join(',');

    return {
      '사번':         userId,
      '이메일':       _r7_lower(u['이메일']),
      '이름':         _r7_str(u['성명']) || _r7_str(u['이름']),
      '직책':         _r7_str(u['직책']) || _r7_str(u['직무']) || '',
      '소속조직ID':   orgUnitId,
      '보조조직IDs':  secondaryIds,
      '입사일':       _r7_str(u['입사일']),
      '퇴사일':       _r7_normalizeLeaveDate(u),
      '비고':         ''
    };
  }).filter(Boolean);

  _r7_writeObjects(ss.getSheetByName(R7_SHEET_USERS), R7_USER_HEADERS, newRows);
  return newRows.length;
}

function _r7_normalizeLeaveDate(user) {
  // R7: 퇴사일은 status='terminated' 인 경우만 채워짐
  var status = _r7_str(user['상태분류']).toLowerCase();
  if (status === 'terminated') {
    return _r7_str(user['상태변경일시']).slice(0, 10);
  }
  // legacy: 재직 여부 = false 면 상태변경일시 사용
  var active = _r7_str(user['재직 여부']).toLowerCase();
  if (active === 'false') return _r7_str(user['상태변경일시']).slice(0, 10);
  return '';
}

/* ── 사이클 마이그레이션 ─────────────────────────────────────────── */
function _r7_migrateCycles(ss) {
  var oldSheet = ss.getSheetByName('_리뷰');
  if (!oldSheet) {
    Logger.log('_리뷰 시트가 없어 사이클 마이그레이션 스킵');
    return 0;
  }
  var oldCycles = _r7_readObjects(oldSheet);
  var newRows = oldCycles.map(function(c) {
    var cycleId = _r7_str(c['사이클ID']);
    if (!cycleId) return null;
    var row = {
      // 핵심 9
      '사이클ID':       cycleId,
      '제목':           _r7_str(c['제목']),
      '상태':           _r7_str(c['상태']) || 'draft',
      '자기평가시작':   '', // legacy 시트에는 시작일이 별도로 없음 — 운영자 수기 기입
      '자기평가종료':   _r7_str(c['자기평가마감']),
      '하향평가시작':   '',
      '하향평가종료':   _r7_str(c['매니저평가마감']),
      '템플릿ID':       _r7_str(c['템플릿ID']),
      '비고':           '',
      // 스페이서
      '_': '',
      // 부가 (legacy 컬럼 그대로 보존)
      '유형':              _r7_str(c['유형']),
      '리뷰유형':          _r7_str(c['리뷰유형']),
      '대상모드':          _r7_str(c['대상모드']),
      '대상매니저ID':      _r7_str(c['대상매니저ID']),
      '대상사용자IDS':     _r7_str(c['대상사용자IDS']),
      '폴더ID':            _r7_str(c['폴더ID']),
      '태그':              _r7_str(c['태그']),
      '인사적용방식':      _r7_str(c['인사적용방식']),
      '인사스냅샷ID':      _r7_str(c['인사스냅샷ID']),
      '평가차수배열':      _r7_str(c['평가차수배열']),
      '자기평가마감':      _r7_str(c['자기평가마감']),
      '매니저평가마감':    _r7_str(c['매니저평가마감']),
      '예약발행일시':      _r7_str(c['예약발행일시']),
      '편집잠금일시':      _r7_str(c['편집잠금일시']),
      '종료일시':          _r7_str(c['종료일시']),
      '보관일시':          _r7_str(c['보관일시']),
      '익명정책JSON':      _r7_str(c['익명정책JSON']),
      '공개정책JSON':      _r7_str(c['공개정책JSON']),
      '참고정보JSON':      _r7_str(c['참고정보JSON']),
      '동료선택정책JSON':  _r7_str(c['동료선택정책JSON']),
      '자동전환JSON':      _r7_str(c['자동전환JSON']),
      '알림정책JSON':      _r7_str(c['알림정책JSON']),
      '템플릿스냅샷JSON':  _r7_str(c['템플릿스냅샷JSON']),
      '템플릿스냅샷일시':  _r7_str(c['템플릿스냅샷일시']),
      '복제원본ID':        _r7_str(c['복제원본ID']),
      '생성자ID':          _r7_str(c['생성자ID']),
      '생성일시':          _r7_str(c['생성일시']),
      '완료율':            _r7_str(c['완료율']),
      '자동보관플래그':    _r7_str(c['자동보관플래그'])
    };
    return row;
  }).filter(Boolean);

  _r7_writeObjects(ss.getSheetByName(R7_SHEET_CYCLES), R7_CYCLE_HEADERS, newRows);
  return newRows.length;
}

/* ── admin role → pg_owner 그룹 멤버 병합 ───────────────────────── */
function _r7_mergeAdminsToOwnerGroup(ss) {
  var permSheet = ss.getSheetByName('_권한그룹');
  if (!permSheet) {
    Logger.log('_권한그룹 시트가 없어 admin 병합 스킵');
    return 0;
  }
  var userSheet = ss.getSheetByName('_구성원');
  if (!userSheet) return 0;

  var users = _r7_readObjects(userSheet);
  var adminIds = users
    .filter(function(u) { return _r7_lower(u['역할']) === 'admin'; })
    .map(function(u) { return _r7_str(u['사번']); })
    .filter(Boolean);

  if (adminIds.length === 0) return 0;

  // pg_owner 행을 찾아 멤버사번JSON 병합
  var data = permSheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('그룹ID');
  var memCol = headers.indexOf('멤버사번JSON');
  if (idCol < 0 || memCol < 0) {
    Logger.log('_권한그룹 시트에 그룹ID 또는 멤버사번JSON 컬럼이 없습니다.');
    return 0;
  }

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === 'pg_owner') {
      var existing = [];
      try {
        var raw = String(data[r][memCol] || '[]');
        existing = JSON.parse(raw);
        if (!Array.isArray(existing)) existing = [];
      } catch (e) {
        existing = [];
      }
      var merged = existing.slice();
      adminIds.forEach(function(id) {
        if (merged.indexOf(id) < 0) merged.push(id);
      });
      permSheet.getRange(r + 1, memCol + 1).setValue(JSON.stringify(merged));
      return adminIds.length;
    }
  }
  // pg_owner 행이 없으면 신규 생성
  permSheet.appendRow([
    'pg_owner', '소유자', '시스템 기본 — 모든 권한',
    JSON.stringify(['cycles.manage','templates.manage','org.manage','reviewer_assignments.manage','permission_groups.manage','auth.impersonate','audit.view','reports.view_all','settings.manage']),
    JSON.stringify(adminIds), 'true', new Date().toISOString(), 'migration_r7'
  ]);
  return adminIds.length;
}
