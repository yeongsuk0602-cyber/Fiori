*---------------------------------------------------------------------*
* ZTF4MM0007 배치 부모-자식 관계 생성 규칙
*---------------------------------------------------------------------*
* 적용 위치:
* 1) DATA 선언부에 ls_comp_mat 추가
* 2) 완제품 자재 마스터 조회 직후 FERT 검증 추가
* 3) 기존 "투입 자재 배치와 완제품 배치의 부모-자식 관계 생성" LOOP 전체 교체
*---------------------------------------------------------------------*

*---------------------------------------------------------------------*
* 1. DATA 선언부 추가
*---------------------------------------------------------------------*
* 아래 라인을 DATA 선언부의 ls_comp_value 근처에 추가한다.

        ls_comp_mat    TYPE ztf4mm0001,


*---------------------------------------------------------------------*
* 2. 완제품 자재 유형 검증 추가
*---------------------------------------------------------------------*
* 위치:
* SELECT SINGLE * FROM ztf4mm0001 INTO ls_material WHERE matnr = ls_head-matnr.
* 이후, ZTF4MM0002 재고 조회 전에 추가한다.

  IF ls_material-mtart <> 'FERT'.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 자재만 생산실적 확정 대상입니다.'.
  ENDIF.


*---------------------------------------------------------------------*
* 3. ZTF4MM0007 부모-자식 배치 관계 생성 LOOP 교체
*---------------------------------------------------------------------*
* 기존 "투입 자재 배치와 완제품 배치의 부모-자식 관계 생성" LOOP 전체를
* 아래 코드로 교체한다.

* 투입 자재 배치와 완제품 배치의 부모-자식 관계 생성
  LOOP AT lt_component INTO ls_component.
    CLEAR: ls_batch_link, ls_comp_mat.

    SELECT SINGLE *
      FROM ztf4mm0001
      INTO ls_comp_mat
     WHERE matnr = ls_component-matnr.

    IF sy-subrc <> 0.
      ROLLBACK WORK.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = '투입 자재 마스터가 존재하지 않습니다.'.
    ENDIF.

*   완제품은 부모 자재가 될 수 없다.
    IF ls_comp_mat-mtart = 'FERT'.
      ROLLBACK WORK.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = '완제품은 배치 관계의 부모 자재가 될 수 없습니다.'.
    ENDIF.

*   원자재만 부모 자재로 등록한다.
*   일반 자재는 배치 관리 대상이 아니므로 ZTF4MM0007 생성 제외.
    IF ls_comp_mat-mtart <> 'ROH'.
      CONTINUE.
    ENDIF.

*   원자재는 부모 배치번호가 필수다.
*   P_CHARG가 비어 있는 ZTF4MM0007 행은 생성하지 않는다.
    IF ls_component-charg IS INITIAL.
      ROLLBACK WORK.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = '원자재 배치번호가 없어 배치 관계를 생성할 수 없습니다.'.
    ENDIF.

*   완제품 배치번호도 필수다.
*   C_CHARG가 비어 있는 ZTF4MM0007 행은 생성하지 않는다.
    IF lv_charg IS INITIAL.
      ROLLBACK WORK.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = '완제품 배치번호가 없어 배치 관계를 생성할 수 없습니다.'.
    ENDIF.

    ls_batch_link-p_matnr  = ls_component-matnr.
    ls_batch_link-p_charg  = ls_component-charg.
    ls_batch_link-c_matnr  = ls_head-matnr.
    ls_batch_link-c_charg  = lv_charg.
    ls_batch_link-aufnr    = ls_head-aufnr.
    ls_batch_link-used_qty = ls_component-enmng.
    ls_batch_link-meins    = ls_component-meins.

    zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_batch_link ).

    INSERT ztf4mm0007 FROM ls_batch_link.

    IF sy-subrc <> 0.
      ROLLBACK WORK.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = '배치 부모-자식 관계 생성 중 오류가 발생했습니다.'.
    ENDIF.
  ENDLOOP.

