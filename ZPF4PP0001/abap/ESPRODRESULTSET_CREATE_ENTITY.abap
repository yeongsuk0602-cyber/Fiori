METHOD esprodresultset_create_entity.

  TYPES: BEGIN OF ty_input,
           aufnr      TYPE ztf4pp0008-aufnr,
           yield_qty  TYPE ztf4pp0011-yield_qty,
           scrap_qty  TYPE ztf4pp0011-scrap_qty,
           vcode      TYPE ztf4pp0006-vcode,
         END OF ty_input,
         BEGIN OF ty_operation,
           vornr TYPE ztf4pp0009-vornr,
         END OF ty_operation.

  CONSTANTS lc_werks TYPE ztf4pp0008-werks VALUE '1000'.
  CONSTANTS lc_lgort TYPE ztf4mm0002-lgort VALUE '1700'.

  DATA: ls_input       TYPE ty_input,
        ls_order       TYPE ztf4pp0008,
        ls_performance TYPE ztf4pp0011,
        ls_quality     TYPE ztf4pp0006,
        lt_operation   TYPE TABLE OF ty_operation,
        lv_existing_conf_no TYPE ztf4pp0011-conf_no,
        lv_conf_no     TYPE ztf4pp0011-conf_no,
        lv_prueflos    TYPE ztf4pp0006-prueflos,
        lv_conf_no_raw TYPE string,
        lv_prueflos_raw TYPE string,
        lv_vgw01       TYPE ztf4pp0004-vgw01,
        lv_vgw02       TYPE ztf4pp0004-vgw02,
        lv_process_time TYPE decfloat34,
        lv_work_time   TYPE decfloat34,
        lv_dummy_matnr TYPE ztf4mm0002-matnr,
        lo_message_container TYPE REF TO /iwbep/if_message_container.

  io_data_provider->read_entry_data(
    IMPORTING
      es_data = er_entity
  ).

  ls_input-aufnr     = er_entity-aufnr.
  ls_input-yield_qty = er_entity-yield_qty.
  ls_input-scrap_qty = er_entity-scrap_qty.
  ls_input-vcode     = er_entity-vcode.

  IF ls_input-aufnr IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산오더는 필수입니다.'.
  ENDIF.

  SELECT SINGLE *
    FROM ztf4pp0008
    INTO @ls_order
   WHERE aufnr = @ls_input-aufnr.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '존재하지 않는 생산오더입니다.'.
  ENDIF.

  IF ls_order-werks <> lc_werks.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = 'Plant 1000 생산오더만 실행할 수 있습니다.'.
  ENDIF.

  IF ls_order-aufst <> 'REL'.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = 'REL 상태의 오더만 실행 가능합니다.'.
  ENDIF.

* 작업시간 자동 계산
  SELECT vornr
    FROM ztf4pp0009
    WHERE aufnr = @ls_order-aufnr
    INTO TABLE @lt_operation.

  IF lt_operation IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산오더의 공정 정보가 없습니다.'.
  ENDIF.

  LOOP AT lt_operation ASSIGNING FIELD-SYMBOL(<ls_operation>).

    CLEAR: lv_vgw01, lv_vgw02, lv_process_time.

    SELECT SINGLE vgw01,
                  vgw02
      FROM ztf4pp0004
      WHERE plnnr = @ls_order-plnnr
        AND vornr = @<ls_operation>-vornr
      INTO (@lv_vgw01, @lv_vgw02).

    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = |공정표 정보가 없습니다. 공정 { <ls_operation>-vornr }|.
    ENDIF.

    lv_process_time = lv_vgw01 + lv_vgw02.
    lv_work_time = lv_work_time + lv_process_time.

  ENDLOOP.

  SELECT SINGLE conf_no
    FROM ztf4pp0011
    INTO @lv_existing_conf_no
   WHERE aufnr = @ls_input-aufnr.

  IF sy-subrc = 0.
    lo_message_container = mo_context->get_message_container( ).
    lo_message_container->add_message_text_only(
      iv_msg_type = 'E'
      iv_msg_text = '이미 실적이 확정된 오더입니다.'
    ).

    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message_container = lo_message_container.
  ENDIF.

  IF ls_input-yield_qty <= 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '양품 수량은 0보다 커야 합니다.'.
  ENDIF.

  IF ls_input-scrap_qty < 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '불량 수량은 0 이상이어야 합니다.'.
  ENDIF.

  IF ls_input-yield_qty + ls_input-scrap_qty > ls_order-gamng.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '실적 수량 합계가 계획 수량을 초과합니다.'.
  ENDIF.

  IF lv_work_time <= 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '계산된 전체 작업시간이 0보다 커야 합니다.'.
  ENDIF.

  IF ls_input-vcode <> 'ACC' AND ls_input-vcode <> 'REJ'.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '검사 결과는 합격 또는 불합격이어야 합니다.'.
  ENDIF.

* 생산실적 확정번호 채번
  CALL FUNCTION 'ZFF4RF0003'
    EXPORTING
      iv_module  = 'PP'
      iv_fieldnm = 'CONF_NO'
    IMPORTING
      ev_nrnum   = lv_conf_no_raw
    EXCEPTIONS
      OTHERS     = 1.

  IF sy-subrc <> 0 OR lv_conf_no_raw IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산실적 확정번호 채번에 실패했습니다.'.
  ENDIF.

  lv_conf_no = lv_conf_no_raw.

* 검사로트번호 채번
  CALL FUNCTION 'ZFF4RF0003'
    EXPORTING
      iv_module  = 'PP'
      iv_fieldnm = 'PRUEFLOS'
    IMPORTING
      ev_nrnum   = lv_prueflos_raw
    EXCEPTIONS
      OTHERS     = 1.

  IF sy-subrc <> 0 OR lv_prueflos_raw IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '검사로트번호 채번에 실패했습니다.'.
  ENDIF.

  lv_prueflos = lv_prueflos_raw.

  CLEAR ls_performance.
  ls_performance-conf_no    = lv_conf_no.
  ls_performance-aufnr      = ls_order-aufnr.
  ls_performance-yield_qty  = ls_input-yield_qty.
  ls_performance-matnr      = ls_order-matnr.
  ls_performance-meins      = ls_order-meins.
  ls_performance-scrap_qty  = ls_input-scrap_qty.
  ls_performance-work_time  = lv_work_time.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_performance ).

  INSERT ztf4pp0011 FROM @ls_performance.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산실적 저장 중 오류가 발생했습니다.'.
  ENDIF.

  CLEAR ls_quality.
  ls_quality-prueflos = lv_prueflos.
  ls_quality-aufnr    = ls_order-aufnr.
  ls_quality-matnr    = ls_order-matnr.
  ls_quality-vcode    = ls_input-vcode.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_quality ).

  INSERT ztf4pp0006 FROM @ls_quality.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '품질검사 결과 저장 중 오류가 발생했습니다.'.
  ENDIF.

  IF ls_input-scrap_qty > 0.
    SELECT SINGLE matnr
      FROM ztf4mm0002
      INTO @lv_dummy_matnr
     WHERE matnr = @ls_order-matnr
       AND werks = @ls_order-werks
       AND lgort = @lc_lgort.

    IF sy-subrc <> 0.
      ROLLBACK WORK.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = '완제품 불량 재고를 반영할 재고 데이터가 없습니다.'.
    ENDIF.

    UPDATE ztf4mm0002
       SET speme = speme + @ls_input-scrap_qty
     WHERE matnr = @ls_order-matnr
       AND werks = @ls_order-werks
       AND lgort = @lc_lgort.

    IF sy-subrc <> 0.
      ROLLBACK WORK.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = '완제품 불량 재고 반영 중 오류가 발생했습니다.'.
    ENDIF.
  ENDIF.

  ls_order-aufst = 'CNF'.
  zcl_f4_rf_common=>set_log_fields( CHANGING cs_data = ls_order ).

  UPDATE ztf4pp0008 FROM @ls_order.

  IF sy-subrc <> 0.
    ROLLBACK WORK.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산오더 상태 변경 중 오류가 발생했습니다.'.
  ENDIF.

  COMMIT WORK AND WAIT.

  CLEAR er_entity.
  er_entity-vcode      = ls_quality-vcode.
  er_entity-mandt      = ls_performance-mandt.
  er_entity-conf_no    = ls_performance-conf_no.
  er_entity-aufnr      = ls_performance-aufnr.
  er_entity-yield_qty  = ls_performance-yield_qty.
  er_entity-matnr      = ls_performance-matnr.
  er_entity-meins      = ls_performance-meins.
  er_entity-scrap_qty  = ls_performance-scrap_qty.
  er_entity-act_carbon = ls_performance-act_carbon.
  er_entity-work_time  = ls_performance-work_time.
  er_entity-zcrb_meins = ls_performance-zcrb_meins.
  er_entity-usnam      = ls_performance-usnam.
  er_entity-erzet      = ls_performance-erzet.

  CONVERT DATE ls_performance-erdat
          TIME ls_performance-erzet
          INTO TIME STAMP er_entity-erdat
          TIME ZONE sy-zonlo.

ENDMETHOD.
