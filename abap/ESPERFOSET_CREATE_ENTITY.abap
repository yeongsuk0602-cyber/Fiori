METHOD esperfoset_create_entity.

  CONSTANTS: lc_werks TYPE ztf4mm0002-werks VALUE '1000',
             lc_lgort TYPE ztf4mm0002-lgort VALUE '1700',
             lc_lgtyp TYPE ztf4mm0002-lgtyp VALUE '1',
             lc_vgart TYPE ztf4mm0006-vgart VALUE 'RF',
             lc_issue_vgart TYPE ztf4mm0006-vgart VALUE 'IP'.

  DATA: ls_input       TYPE zcl_zgwf4pp0001_mpc=>ts_esperfo,
        ls_head        TYPE ztf4pp0008,
        ls_save        TYPE ztf4pp0011,
        ls_quality     TYPE ztf4pp0006,
        ls_settle      TYPE ztf4pp0012,
        lt_component   TYPE TABLE OF ztf4pp0010,
        ls_component   TYPE ztf4pp0010,
        lt_bulk_comp   TYPE TABLE OF ztf4pp0010,
        ls_bulk_comp   TYPE ztf4pp0010,
        ls_bulk_mat    TYPE ztf4mm0001,
        lt_raw_move    TYPE TABLE OF ztf4mm0006,
        ls_raw_move    TYPE ztf4mm0006,
        lt_bulk_head   TYPE TABLE OF ztf4pp0008,
        ls_bulk_head   TYPE ztf4pp0008,
        ls_comp_value  TYPE ztf4mm0003,
        ls_comp_mat    TYPE ztf4mm0001,
        ls_material    TYPE ztf4mm0001,
        ls_stock       TYPE ztf4mm0002,
        ls_value       TYPE ztf4mm0003,
        ls_batch       TYPE ztf4mm0005,
        ls_batch_move  TYPE ztf4mm0006,
        ls_batch_link  TYPE ztf4mm0007,
        ls_matdoc_head TYPE ztf4mm0013,
        ls_matdoc_item TYPE ztf4mm0014,
        lv_confno      TYPE ztf4pp0011-conf_no,
        lv_settle_id   TYPE ztf4pp0012-settle_id,
        lv_settle_num  TYPE n LENGTH 8,
        lv_charg       TYPE ztf4mm0005-charg,
        lv_mblnr       TYPE ztf4mm0013-mblnr,
        lv_mblnr_raw   TYPE string,
        lv_vfdat       TYPE ztf4mm0005-vfdat,
        lv_netwr       TYPE ztf4pp0012-netwr,
        lv_cost01      TYPE ztf4pp0012-act_cost01,
        lv_cost02      TYPE ztf4pp0012-act_cost02,
        lv_total       TYPE ztf4pp0012-total_amt,
        lv_verpr       TYPE ztf4mm0003-verpr,
        lv_labor_rate  TYPE p DECIMALS 2,
        lv_mach_rate   TYPE p DECIMALS 2,
        lv_fi_total    TYPE zef4_fi_net_dmbtr,
        lv_fi_netwr    TYPE zef4_fi_net_dmbtr,
        lv_fi_cost01   TYPE zef4_fi_net_dmbtr,
        lv_fi_cost02   TYPE zef4_fi_net_dmbtr,
        lv_fi_carbon   TYPE zef4_rf_zcarbon,
        lv_belnr       TYPE char10,
        lv_gjahr       TYPE numc4,
        lv_link_count  TYPE i,
        lv_raw_cnt     TYPE i,
        lv_bulk_aufnr  TYPE ztf4pp0008-aufnr,
        lv_ref_no      TYPE ztf4mm0006-ref_no.

  io_data_provider->read_entry_data(
    IMPORTING
      es_data = ls_input
  ).

* 생산오더 상태 검증
  SELECT SINGLE *
    FROM ztf4pp0008
    INTO ls_head
   WHERE aufnr = ls_input-aufnr.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산오더가 존재하지 않습니다.'.
  ENDIF.

  IF ls_head-werks <> lc_werks.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = 'Plant 1000 생산오더만 처리할 수 있습니다.'.
  ENDIF.

  IF ls_head-aufst = 'TECO'.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '이미 최종 승인된 생산오더입니다.'.
  ENDIF.

  IF ls_head-aufst <> 'CNF'.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산확정(CNF) 상태의 오더만 승인할 수 있습니다.'.
  ENDIF.

* 생산오더 구성품 조회
  SELECT *
    FROM ztf4pp0010
    INTO TABLE lt_component
   WHERE aufnr = ls_head-aufnr.

  IF lt_component IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산오더 구성품이 없습니다. ZTF4PP0010을 확인하세요.'.
  ENDIF.

* 최신 생산실적 조회
  SELECT MAX( conf_no )
    FROM ztf4pp0011
    INTO lv_confno
   WHERE aufnr = ls_input-aufnr.

  IF lv_confno IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '등록된 생산실적이 없습니다.'.
  ENDIF.

  SELECT SINGLE *
    FROM ztf4pp0011
    INTO ls_save
   WHERE conf_no = lv_confno.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '최신 생산실적을 조회할 수 없습니다.'.
  ENDIF.

* 중복 승인 방지
  SELECT SINGLE settle_id
    FROM ztf4pp0012
    INTO lv_settle_id
   WHERE aufnr = ls_input-aufnr.

  IF sy-subrc = 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '이미 정산 및 최종 승인된 생산오더입니다.'.
  ENDIF.

* 입력값 검증 및 양품 수량 재계산
* 화면의 목표 수량은 생산오더 기준 수량이며, 실제 양품 수량은 목표 수량 - 불량 수량으로 확정한다.
  IF ls_head-gamng IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산오더의 목표 수량이 없습니다.'.
  ENDIF.

  IF ls_input-scrap_qty < 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '불량 수량은 0 이상이어야 합니다.'.
  ENDIF.

  IF ls_input-scrap_qty > ls_head-gamng.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '불량 수량이 목표 수량을 초과할 수 없습니다.'.
  ENDIF.

  ls_input-yield_qty = ls_head-gamng - ls_input-scrap_qty.

  IF ls_input-yield_qty <= 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '양품 수량이 0이 됩니다. 불량 수량을 확인하세요.'.
  ENDIF.

  IF ls_input-insp_mode <> 'AUTO' AND
     ls_input-insp_mode <> 'MANU'.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '검사 방식은 AUTO 또는 MANU만 가능합니다.'.
  ENDIF.

  IF ls_input-vcode <> 'ACC' AND
     ls_input-vcode <> 'PAR' AND
     ls_input-vcode <> 'REJ'.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '품질 사용결정 코드를 확인하세요.'.
  ENDIF.

* 품질검사 이력 조회
  SELECT SINGLE *
    FROM ztf4pp0006
    INTO ls_quality
   WHERE aufnr = ls_input-aufnr
     AND matnr = ls_head-matnr.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '품질검사 이력이 존재하지 않습니다.'.
  ENDIF.

* 완제품 자재 및 재고 마스터 조회
  SELECT SINGLE *
    FROM ztf4mm0001
    INTO ls_material
   WHERE matnr = ls_head-matnr.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 자재 마스터가 존재하지 않습니다.'.
  ENDIF.

  IF ls_material-mtart <> 'FERT'.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 자재만 생산실적 확정 대상입니다.'.
  ENDIF.

  SELECT SINGLE *
    FROM ztf4mm0002
    INTO ls_stock
   WHERE matnr = ls_head-matnr
     AND werks = lc_werks
     AND lgort = lc_lgort.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 재고 행(Plant 1000, 저장위치 1700)이 없습니다.'.
  ENDIF.

  SELECT SINGLE *
    FROM ztf4mm0003
    INTO ls_value
   WHERE matnr = ls_head-matnr
     AND werks = lc_werks.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 평가 재고 행이 없습니다.'.
  ENDIF.


  CLEAR lv_netwr.

  IF ls_value-verpr IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 단가(VERPR)가 0입니다. ZTF4MM0003을 확인하세요.'.
  ENDIF.

  lv_netwr = ls_save-yield_qty * ls_value-verpr.


* 제조원가와 완제품 금액 계산
  lv_labor_rate = 25000.
  lv_mach_rate  = 30000.

  lv_cost01 = ls_save-work_time * lv_labor_rate.
  lv_cost02 = ls_save-work_time * lv_mach_rate.
  lv_total  = lv_netwr + lv_cost01 + lv_cost02.

  lv_fi_total  = lv_total  / 100.
  lv_fi_netwr  = lv_netwr  / 100.
  lv_fi_cost01 = lv_cost01 / 100.
  lv_fi_cost02 = lv_cost02 / 100.

* 정산번호 채번
  CLEAR lv_settle_id.

  SELECT MAX( settle_id )
    FROM ztf4pp0012
    INTO lv_settle_id
   WHERE settle_id LIKE 'ST%'.

  IF lv_settle_id IS INITIAL.
    lv_settle_num = '00000001'.
  ELSE.
    lv_settle_num = lv_settle_id+2(8).
    lv_settle_num = lv_settle_num + 1.
  ENDIF.

* 완제품 배치번호 채번
  CALL FUNCTION 'ZFF4RF0007'
    EXPORTING
      iv_matnr = ls_head-matnr
    IMPORTING
      ev_charg = lv_charg.

  IF lv_charg IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 배치번호 채번에 실패했습니다.'.
  ENDIF.

  SELECT SINGLE charg
    FROM ztf4mm0005
    INTO lv_charg
   WHERE charg = lv_charg
     AND matnr = ls_head-matnr.

  IF sy-subrc = 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '이미 존재하는 완제품 배치번호입니다.'.
  ENDIF.

* 자재문서번호 채번
  CLEAR: lv_mblnr, lv_mblnr_raw.

  CALL FUNCTION 'ZFF4RF0003'
    EXPORTING
      iv_module  = 'MM'
      iv_fieldnm = 'MBLNR'
    IMPORTING
      ev_nrnum   = lv_mblnr_raw.

  lv_mblnr = lv_mblnr_raw.

  IF lv_mblnr IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '자재문서번호 채번에 실패했습니다.'.
  ENDIF.

* 유통기한: 생산일로부터 1년
  CALL FUNCTION 'RP_CALC_DATE_IN_INTERVAL'
    EXPORTING
      date      = sy-datum
      days      = '00'
      months    = '00'
      signum    = '+'
      years     = '01'
    IMPORTING
      calc_date = lv_vfdat.

* 생산실적 수정
  ls_save-yield_qty = ls_input-yield_qty.
  ls_save-scrap_qty = ls_input-scrap_qty.
  ls_save-act_carbon = ls_input-act_carbon.
  ls_save-zcrb_meins = 'KG'.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_save ).

  UPDATE ztf4pp0011 FROM ls_save.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산실적 변경 중 오류가 발생했습니다.'.
  ENDIF.

* 품질검사 결과와 완제품 배치 반영
  ls_quality-insp_mode = ls_input-insp_mode.
  ls_quality-vcode     = ls_input-vcode.
  ls_quality-charg     = lv_charg.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_quality ).

  UPDATE ztf4pp0006 FROM ls_quality.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '품질검사 결과 변경 중 오류가 발생했습니다.'.
  ENDIF.

* 완제품 배치 마스터 생성
  CLEAR ls_batch.
  ls_batch-charg = lv_charg.
  ls_batch-matnr = ls_head-matnr.
  ls_batch-mtart = ls_material-mtart.
  ls_batch-rpdat = sy-datum.
  ls_batch-vfdat = lv_vfdat.
  ls_batch-aufnr = ls_head-aufnr.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_batch ).

  INSERT ztf4mm0005 FROM ls_batch.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 배치 생성 중 오류가 발생했습니다.'.
  ENDIF.

* 완제품 수량 재고 반영
  ls_stock-labst = ls_stock-labst + ls_input-yield_qty.
  ls_stock-speme = ls_stock-speme + ls_input-scrap_qty.
  ls_stock-meins = ls_save-meins.
  ls_stock-lgtyp = lc_lgtyp.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_stock ).

  UPDATE ztf4mm0002 FROM ls_stock.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 수량 재고 반영 중 오류가 발생했습니다.'.
  ENDIF.

* 완제품 평가 재고와 단가 반영
  ls_value-stock = ls_value-stock + ls_input-yield_qty.
  ls_value-waers = 'KRW'.
  ls_value-meins = ls_save-meins.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_value ).

  UPDATE ztf4mm0003 FROM ls_value.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 평가 재고 반영 중 오류가 발생했습니다.'.
  ENDIF.

* 자재문서 헤더 생성
  CLEAR ls_matdoc_head.
  ls_matdoc_head-mblnr = lv_mblnr.
  ls_matdoc_head-werks = lc_werks.
  ls_matdoc_head-vgart = lc_vgart.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_matdoc_head ).

  INSERT ztf4mm0013 FROM ls_matdoc_head.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '자재문서 헤더 생성 중 오류가 발생했습니다.'.
  ENDIF.

* 자재문서 아이템 생성
  CLEAR ls_matdoc_item.
  ls_matdoc_item-mblnr      = lv_mblnr.
  ls_matdoc_item-zeile      = '0001'.
  ls_matdoc_item-matnr      = ls_head-matnr.
  ls_matdoc_item-charg      = lv_charg.
  ls_matdoc_item-menge      = ls_input-yield_qty.
  ls_matdoc_item-meins      = ls_save-meins.
  ls_matdoc_item-netpr      = lv_total.
  ls_matdoc_item-waers      = 'KRW'.
  ls_matdoc_item-zcarbon    = ls_save-act_carbon.
  ls_matdoc_item-zcrb_meins = 'KG'.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_matdoc_item ).

  INSERT ztf4mm0014 FROM ls_matdoc_item.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '자재문서 아이템 생성 중 오류가 발생했습니다.'.
  ENDIF.

* 완제품 배치 입고 이력 생성
  CLEAR ls_batch_move.
  ls_batch_move-matnr  = ls_head-matnr.
  ls_batch_move-charg  = lv_charg.
  ls_batch_move-werks  = lc_werks.
  ls_batch_move-lgort  = lc_lgort.
  ls_batch_move-zeile  = '0010'.
  ls_batch_move-vgart  = lc_vgart.
  ls_batch_move-menge  = ls_input-yield_qty.
  ls_batch_move-stock  = ls_input-yield_qty.
  ls_batch_move-meins  = ls_save-meins.
  ls_batch_move-ref_no = lv_mblnr.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_batch_move ).

  INSERT ztf4mm0006 FROM ls_batch_move.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 배치 입고 이력 생성 중 오류가 발생했습니다.'.
  ENDIF.

* 생산오더 구성품과 완제품 배치의 부모-자식 관계 생성
* - PN* 일반자재는 배치 없이 완제품에 직접 연결
* - PF* 벌크는 직접 넣지 않고, PF 벌크오더의 ROH 원자재를 펼쳐 완제품에 연결
* - ROH 원자재는 배치번호 필수
  CLEAR lv_link_count.

  IF lv_charg IS INITIAL.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '완제품 배치번호가 없어 배치 관계를 생성할 수 없습니다.'.
  ENDIF.

  LOOP AT lt_component INTO ls_component.
    CLEAR: ls_batch_link, ls_comp_mat.

    SELECT SINGLE *
      FROM ztf4mm0001
      INTO ls_comp_mat
     WHERE matnr = ls_component-matnr.

    IF sy-subrc <> 0.
      CONTINUE.
    ENDIF.

*   PN* 일반자재는 배치번호 없이 완제품에 직접 연결
    IF ls_component-matnr(2) = 'PN'.
      ls_batch_link-p_matnr  = ls_component-matnr.
      CLEAR ls_batch_link-p_charg.
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
            message = '일반자재 배치 관계 생성 중 오류가 발생했습니다.'.
      ENDIF.

      lv_link_count = lv_link_count + 1.
      CONTINUE.
    ENDIF.

*   PF* 벌크는 직접 연결하지 않고, 해당 벌크 생산오더의 원자재를 펼쳐 연결
    IF ls_component-matnr(2) = 'PF'.
      CLEAR lv_bulk_aufnr.

*     PF 라인에 배치번호가 있으면, 배치마스터 기준으로 실제 벌크 생산오더를 먼저 찾음
      IF ls_component-charg IS NOT INITIAL.
        SELECT SINGLE aufnr
          FROM ztf4mm0005
          INTO lv_bulk_aufnr
         WHERE matnr = ls_component-matnr
           AND charg = ls_component-charg.
      ENDIF.

*     PF 배치번호가 없거나 배치마스터에서 못 찾으면,
*     같은 PF 자재의 최근 REL/CNF/TECO 벌크오더 중 원자재 배치가 있는 오더를 찾음
      IF lv_bulk_aufnr IS INITIAL.

        CLEAR lt_bulk_head.

        SELECT *
          FROM ztf4pp0008
          INTO TABLE lt_bulk_head
         WHERE matnr = ls_component-matnr
           AND werks = lc_werks
           AND aufst IN ('REL', 'CNF', 'TECO').

        SORT lt_bulk_head BY erdat DESCENDING erzet DESCENDING aufnr DESCENDING.

        LOOP AT lt_bulk_head INTO ls_bulk_head.

          CLEAR lv_raw_cnt.

          SELECT COUNT(*)
            FROM ztf4pp0010 AS r
            INNER JOIN ztf4mm0001 AS m
              ON m~matnr = r~matnr
            INTO lv_raw_cnt
           WHERE r~aufnr = ls_bulk_head-aufnr
             AND r~charg <> ''
             AND m~mtart = 'ROH'.

          IF lv_raw_cnt > 0.
            lv_bulk_aufnr = ls_bulk_head-aufnr.
            EXIT.
          ENDIF.

        ENDLOOP.
      ENDIF.

      IF lv_bulk_aufnr IS INITIAL.
        ROLLBACK WORK.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            message = '벌크액 생산오더를 찾을 수 없습니다. PF 자재의 생산오더와 원자재 배치 이력을 확인하세요.'.
      ENDIF.

      CLEAR lt_bulk_comp.

      SELECT *
        FROM ztf4pp0010
        INTO TABLE lt_bulk_comp
       WHERE aufnr = lv_bulk_aufnr.

      IF lt_bulk_comp IS INITIAL.
        ROLLBACK WORK.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            message = '벌크액 생산오더의 투입 원자재가 없습니다.'.
      ENDIF.

      LOOP AT lt_bulk_comp INTO ls_bulk_comp.
        CLEAR: ls_batch_link, ls_bulk_mat.

        SELECT SINGLE *
          FROM ztf4mm0001
          INTO ls_bulk_mat
         WHERE matnr = ls_bulk_comp-matnr.

        IF sy-subrc <> 0.
          CONTINUE.
        ENDIF.

        IF ls_bulk_mat-mtart <> 'ROH'.
          CONTINUE.
        ENDIF.

        IF ls_bulk_comp-charg IS INITIAL.
          ROLLBACK WORK.
          RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
            EXPORTING
              message = '벌크 원자재의 배치번호가 없습니다. ZTF4PP0010-CHARG를 확인하세요.'.
        ENDIF.

        ls_batch_link-p_matnr  = ls_bulk_comp-matnr.
        ls_batch_link-p_charg  = ls_bulk_comp-charg.
        ls_batch_link-c_matnr  = ls_head-matnr.
        ls_batch_link-c_charg  = lv_charg.
        ls_batch_link-aufnr    = ls_head-aufnr.
        ls_batch_link-used_qty = ls_bulk_comp-enmng.
        ls_batch_link-meins    = ls_bulk_comp-meins.
        zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_batch_link ).

        INSERT ztf4mm0007 FROM ls_batch_link.

        IF sy-subrc <> 0.
          ROLLBACK WORK.
          RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
            EXPORTING
              message = '벌크 원자재 배치 관계 생성 중 오류가 발생했습니다.'.
        ENDIF.

        lv_link_count = lv_link_count + 1.
      ENDLOOP.

      CONTINUE.
    ENDIF.

*   완제품 오더에 ROH가 직접 들어온 경우도 지원
    IF ls_comp_mat-mtart <> 'ROH'.
      CONTINUE.
    ENDIF.

    IF ls_component-charg IS INITIAL.
      ROLLBACK WORK.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = '투입 원자재의 배치번호가 없습니다. ZTF4PP0010-CHARG를 확인하세요.'.
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

    lv_link_count = lv_link_count + 1.
  ENDLOOP.

  IF lv_link_count = 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '배치 관계 생성 대상 투입 자재가 없습니다. ZTF4PP0010의 배치번호를 확인하세요.'.
  ENDIF.

* 생산오더 정산 생성
  CLEAR ls_settle.
  CONCATENATE 'ST' lv_settle_num INTO ls_settle-settle_id.
  ls_settle-aufnr      = ls_save-aufnr.
  ls_settle-matnr      = ls_save-matnr.
  ls_settle-yield_qty  = ls_save-yield_qty.
  ls_settle-netwr      = lv_netwr.
  ls_settle-act_cost01 = lv_cost01.
  ls_settle-act_cost02 = lv_cost02.
  ls_settle-total_amt  = lv_total.
  ls_settle-meins      = ls_save-meins.
  ls_settle-waers      = 'KRW'.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_settle ).

  INSERT ztf4pp0012 FROM ls_settle.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산오더 정산 저장 중 오류가 발생했습니다.'.
  ENDIF.

* 생산오더 최종 완료 처리
  ls_head-aufst = 'TECO'.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_head ).

  UPDATE ztf4pp0008 FROM ls_head.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산오더 상태 변경 중 오류가 발생했습니다.'.
  ENDIF.

* FI 생산 정산 전표 생성
  lv_gjahr = sy-datum+0(4).

  CALL FUNCTION 'ZFF4FI0001'
    EXPORTING
      iv_gjahr = lv_gjahr
      iv_blart = 'PP'
      iv_bldat = sy-datum
    IMPORTING
      ev_belnr = lv_belnr.

  CALL FUNCTION 'ZFF4FI0002'
    EXPORTING
      iv_belnr   = lv_belnr
      iv_shkzg   = 'S'
      iv_dmbtr   = lv_fi_total
      iv_xblnr   = ls_settle-settle_id
      iv_saknr   = '1200'
      iv_dctype  = 'PP01'
      iv_mwskz   = 'S1'
      iv_gjahr   = lv_gjahr
      iv_waers   = 'KRW'
      iv_sgtxt   = '생산오더 정산 제품재고'
      iv_partner = ''.

  CALL FUNCTION 'ZFF4FI0002'
    EXPORTING
      iv_belnr   = lv_belnr
      iv_shkzg   = 'H'
      iv_dmbtr   = lv_fi_netwr
      iv_xblnr   = ls_settle-settle_id
      iv_saknr   = '1220'
      iv_dctype  = 'PP01'
      iv_mwskz   = 'S1'
      iv_gjahr   = lv_gjahr
      iv_waers   = 'KRW'
      iv_sgtxt   = '생산오더 정산 원재료'
      iv_partner = ''.

  CALL FUNCTION 'ZFF4FI0002'
    EXPORTING
      iv_belnr   = lv_belnr
      iv_shkzg   = 'H'
      iv_dmbtr   = lv_fi_cost01
      iv_xblnr   = ls_settle-settle_id
      iv_saknr   = '5100'
      iv_dctype  = 'PP01'
      iv_mwskz   = 'S1'
      iv_gjahr   = lv_gjahr
      iv_waers   = 'KRW'
      iv_sgtxt   = '생산오더 정산 제조급여'
      iv_partner = ''.

  CALL FUNCTION 'ZFF4FI0002'
    EXPORTING
      iv_belnr   = lv_belnr
      iv_shkzg   = 'H'
      iv_dmbtr   = lv_fi_cost02
      iv_xblnr   = ls_settle-settle_id
      iv_saknr   = '5220'
      iv_dctype  = 'PP01'
      iv_mwskz   = 'S1'
      iv_gjahr   = lv_gjahr
      iv_waers   = 'KRW'
      iv_sgtxt   = '생산오더 정산 기계사용비'
      iv_partner = ''.

* FI 탄소배출 이력 생성
  lv_fi_carbon = ls_save-act_carbon.

  CALL FUNCTION 'ZFF4FI0003'
    EXPORTING
      iv_scope   = '001'
      iv_zcrbar  = '공정 배출'
      iv_zcarbon = lv_fi_carbon.

  COMMIT WORK AND WAIT.

* OData 성공 응답
  CLEAR er_entity.
  er_entity-mandt      = sy-mandt.
  er_entity-conf_no    = ls_save-conf_no.
  er_entity-aufnr      = ls_save-aufnr.
  er_entity-yield_qty  = ls_save-yield_qty.
  er_entity-matnr      = ls_save-matnr.
  er_entity-meins      = ls_save-meins.
  er_entity-scrap_qty  = ls_save-scrap_qty.
  er_entity-act_carbon = ls_save-act_carbon.
  er_entity-work_time  = ls_save-work_time.
  er_entity-zcrb_meins = ls_save-zcrb_meins.
  er_entity-vcode      = ls_quality-vcode.
  er_entity-insp_mode  = ls_quality-insp_mode.

ENDMETHOD.
