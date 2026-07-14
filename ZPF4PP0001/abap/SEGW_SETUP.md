# ZPF4PP0001 Gateway 설정

## 프로젝트

- SEGW 프로젝트: `ZPP_PRODUCTION_EXEC`
- 등록 서비스: `ZGWF4PP0002_SRV`
- OData: V2

## ProductionOrder Entity Type

| Property | ABAP 필드 | Key | 타입 |
| --- | --- | --- | --- |
| Aufnr | ZTF4PP0008-AUFNR | X | CHAR(12) |
| Matnr | ZTF4PP0008-MATNR |  | CHAR(6) |
| Maktx | ZTF4MM0001-MAKTX |  | CHAR(40) |
| Gamng | ZTF4PP0008-GAMNG |  | QUAN(13) |
| Meins | ZTF4PP0008-MEINS |  | UNIT(3) |
| Werks | ZTF4PP0008-WERKS |  | CHAR(4) |
| Aufst | ZTF4PP0008-AUFST |  | CHAR(4) |
| Erdat | ZTF4PP0008-ERDAT |  | DATS(8) |
| WorkTime | ZTF4PP0011-WORK_TIME |  | DEC(13,3) |

EntitySet 이름은 `esProdOrderSet`으로 설정한다.

## ProductionExecResult Entity Type

| Property | Key | 타입 |
| --- | --- | --- |
| ConfNo | X | Edm.String(10) |
| Aufnr |  | Edm.String(12) |
| YieldQty |  | Edm.Decimal(13,3) |
| Matnr |  | Edm.String(6) |
| Meins |  | Edm.String(3) |
| ScrapQty |  | Edm.Decimal(13,3) |
| ActCarbon |  | Edm.String(10) |
| WorkTime |  | Edm.Decimal(13,3) |
| ZcrbMeins |  | Edm.String(10) |
| Vcode |  | Edm.String(3) |

EntitySet 이름은 `esProdResultSet`으로 설정한다.

## 생산실적 등록

- Function Import는 사용하지 않는다.
- `POST /esProdResultSet` 요청을 사용한다.
- `DPC_EXT`의 `ESPRODRESULTSET_CREATE_ENTITY`에 저장 로직을 구현한다.

| 입력 Property | 타입 |
| --- | --- |
| Aufnr | Edm.String(12) |
| YieldQty | Edm.Decimal(13,3) |
| ScrapQty | Edm.Decimal(13,3) |
| Vcode | Edm.String(3) |

모델 생성 후 Runtime Objects를 생성하고 `/IWBEP/REG_SERVICE`에서 서비스를 등록한다.
