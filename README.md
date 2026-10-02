# 플랜두씨 다이어리 · T07

T06 최종 제출 커밋 `f791fc84302f06b767e9b04f9a183b82265a6498`에서 이어지는 인증·계정별 자료 분리·실제 5일 관찰 앱입니다.

- 공개 URL에는 로그인/가입 화면만 표시됩니다. 개인 기록 API는 세션이 없으면 401입니다.
- bcryptjs 3.0.3 cost 12, DB 세션, 12시간 만료, 로그아웃/비밀번호 변경 시 서버 세션 폐기.
- 기존 T06 전체 내보내기 JSON은 새 계정으로 로그인한 뒤 빈 다이어리에서 가져옵니다. 최초 가입자가 기존 공개 자료를 자동 소유하지 않습니다.
- 계획·할 일·실행·돌아보기 및 5일 관찰을 내 계정에서 사용합니다. 전체 JSON 내보내기와 비밀번호 확인 후 계정/연결 자료 삭제를 제공합니다.
- 기존 배포: https://plan-do-see-diary.rlatmdgus4141.chatgpt.site

자세한 선택 이유·소스 흐름·검증·한계는 `t07/AUTH_IMPLEMENTATION.md`를 읽으세요.
`contracts/pds-schema-v2.json`은 T06 계약이며 T07 추가 계약은 `contracts/pds-schema-v3.json`입니다.

## 검증

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
node --experimental-strip-types tests/t07.test.ts
```

T06의 `tests/pds.test.ts`는 `tests/t06-service.ts`의 당시 서비스와 초기 마이그레이션을 검사하는 보존용입니다. 현재 인증 검증은 `tests/t07.test.ts`와 `t07/service-results.json`을 봅니다.

## 배포

Cloudflare Workers 호환 Vinext + D1. `.openai/hosting.json`은 기존 Sites 프로젝트/논리 DB 연결을 보존합니다. Sites 배포 흐름으로 생성된 `drizzle/*.sql` 마이그레이션을 순서대로 적용합니다. 이미 적용한 마이그레이션을 다시 실행하거나 고치지 마세요.

## 실제 사용자가 해야 할 일

1. 본인만 아는 비밀번호로 가입·로그인. 채팅이나 제출물에 비밀번호를 적지 않기.
2. T06 JSON을 가져와 5개 할 일, 3개 실행, 327분, 수정/돌아보기 연결을 확인.
3. 작업 전 오늘 관찰 대상 확정, 실행 기록 입력, 당일 관찰 마감.
4. 2일차 후 규칙 하나 변경, 실제 다른 날짜 5일 완료, 최신 JSON과 설명서 제출.

아직 수행하지 않은 5일 관찰·사용자 브라우저 검증은 완료로 간주하지 않습니다.
