# ZRF4PP0002 - 생산 실적 확정

SAP Fiori UI5 화면 프로젝트입니다.

## OData Assumption

- Service URL: `/sap/opu/odata/sap/ZRF4PP0002_SRV/`
- EntitySet:
  - `ProductionOrderSet`: 생산오더 조회
  - `ConfirmationSet`: 생산 실적 확정 저장 처리

실제 Gateway 서비스명이 다르면 `webapp/manifest.json`의 `sap.app.dataSources.mainService.uri`를 수정하세요.

## Run

```bash
npm install
npm start
```

`ui5.yaml`의 proxy `baseUri`는 실제 SAP Gateway 호스트로 변경해야 합니다.

## Main Files

- `webapp/view/Main.view.xml`: 검색 목록 및 입력 화면
- `webapp/controller/Main.controller.js`: 조회, 입력 검증, 확정 POST/PATCH 로직
- `webapp/manifest.json`: OData model 설정
