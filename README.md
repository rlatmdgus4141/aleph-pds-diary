# 플랜두씨 다이어리 · ALEPH T06

로그인 없이 이용하는 공개 Plan–Do–See 다이어리입니다. 링크를 아는 방문자는 자료를 읽고 편집할 수 있습니다. 비밀값·민감한 개인정보를 넣지 마세요.

## 기능
- 계획의 기간·우선순위·성공 기준·예상 시간과 변경 이력
- 할 일 생성·수정·완료·되돌리기·소프트 삭제, 검색·상태/우선순위/태그 필터·결정적 정렬
- 실행 시작/종료 UTC 저장, 서울 시간 입력/표시, 실제 분·막힌 이유 별도 저장
- 완료 PK 및 실행 request_key UNIQUE로 중복 방지
- 선택 계획의 마감일 기간별 집계 및 숫자별 근거 기록
- 돌아보기 개선점으로 다음 계획 생성
- 서버 D1 저장, 전체 데이터 JSON 내보내기

## 데이터의 출처와 남은 입력
사용자가 직접 제공한 실행 3건을 최초 방문 시 서버에 한 번 저장합니다: 2026-10-01 면접 준비 180분, 독서 110분, 2026-10-02 ALEPH 과제5 37분. 첫 두 건의 막힘은 없고, 마지막 한 건에 사용자가 준 막힌 이유를 저장했습니다.
사용자가 아직 계획 기간·우선순위·성공 기준·예상 시간, 할 일별 예정 마감/예상을 제공하지 않아 NULL/빈 값과 draft=1로 남겼습니다. 3개 활동은 실행 기록을 연결하기 위한 완료 할 일로 가져옵니다. 미래 할 일 2개를 꾸며 넣지 않았습니다. 실제 계획 1개와 실제 할 일 5개 조건은 사용자가 추가 입력해야 완성됩니다.

## 실행과 검사
Node.js 24.x, pnpm 사용. `pnpm install --frozen-lockfile` 후 `pnpm run dev`.
Cloudflare D1 바인딩 DB가 필요합니다. `.openai/hosting.json`은 논리 바인딩만 선언합니다. 비밀키를 브라우저에 넣지 않습니다.

```sh
node --experimental-strip-types tests/pds.test.ts
pnpm exec tsc --noEmit
pnpm run build
```

로컬 D1은 build 이후 다음을 최초 1회 실행합니다 (동일 마이그레이션 중복 적용 금지).
```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_strong_frightful_four.sql
```
호스팅 플랫폼에서 production 마이그레이션을 적용합니다. 스키마 정본 설명은 `contracts/pds-schema-v2.json`입니다.

## 검사 범위
`tests/results.json`: 23개 서버 로직/SQLite 통합 검사. 초기 검사 모형의 두 오류(중첩 트랜잭션 모형, 객체 prototype 비교)는 `tests/initial-harness-results.json`에 보존하고 모형 수정 후 재검사했습니다. 테스트 데이터는 메모리 SQLite 안에만 존재하며 실제 사용자 DB로 배포되지 않습니다.
실제 브라우저 UI·스크립트 입력 실행 여부·WebMCP 등록 동작 검사는 환경에 지원되는 브라우저 제어 경로가 없어 미실행입니다. React 텍스트 렌더링과 SQL 바인딩을 사용하며 `dangerouslySetInnerHTML`·eval은 사용하지 않습니다. 사용자 브라우저에서 저장·새로고침·내보내기 및 근거 숫자 클릭을 확인해야 합니다.

## 집계 규칙
계획 수는 선택 계획의 지우지 않은 할 일 수, 완료 수는 현재 done 수입니다. 지연은 서울 오늘보다 이전 마감의 미완료 할 일, 막힘은 이유가 있는 실행 기록을 가진 할 일 수입니다. 예상 합계는 할 일 예상 분의 합계이며 미입력은 0으로 계산하되 개수를 경고합니다. 실제 합계는 대상 할 일의 모든 실행 기록 합계, 차이는 실제-예상입니다. 기간 필터는 할 일 마감일 양끝 포함이며 필터 지정 시 마감 미입력은 제외됩니다.
