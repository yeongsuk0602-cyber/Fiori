METHOD esprodorderset_get_entity.

  TYPES: BEGIN OF ty_order,
           aufnr TYPE ztf4pp0008-aufnr,
           plnnr TYPE ztf4pp0008-plnnr,
           matnr TYPE ztf4pp0008-matnr,
           maktx TYPE ztf4mm0001-maktx,
           gamng TYPE ztf4pp0008-gamng,
           meins TYPE ztf4pp0008-meins,
           werks TYPE ztf4pp0008-werks,
           aufst TYPE ztf4pp0008-aufst,
           erdat TYPE ztf4pp0008-erdat,
         END OF ty_order,
         BEGIN OF ty_operation,
           vornr TYPE ztf4pp0009-vornr,
         END OF ty_operation.

  DATA: ls_order        TYPE ty_order,
        lt_operation    TYPE TABLE OF ty_operation,
        lv_aufnr        TYPE ztf4pp0008-aufnr,
        lv_vgw01        TYPE ztf4pp0004-vgw01,
        lv_vgw02        TYPE ztf4pp0004-vgw02,
        lv_process_time TYPE decfloat34,
        lv_work_time    TYPE decfloat34.

  lv_aufnr = VALUE #( it_key_tab[ name = 'Aufnr' ]-value OPTIONAL ).

  IF lv_aufnr IS INITIAL.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = '생산오더 번호가 없습니다.'.
  ENDIF.

  SELECT SINGLE a~aufnr,
                a~plnnr,
                a~matnr,
                b~maktx,
                a~gamng,
                a~meins,
                a~werks,
                a~aufst,
                a~erdat
    FROM ztf4pp0008 AS a
    LEFT OUTER JOIN ztf4mm0001 AS b
      ON b~matnr = a~matnr
    WHERE a~aufnr = @lv_aufnr
      AND a~aufst = 'REL'
    INTO @ls_order.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        message = 'REL 상태의 생산오더가 존재하지 않습니다.'.
  ENDIF.

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

  er_entity-aufnr = ls_order-aufnr.
  er_entity-matnr = ls_order-matnr.
  er_entity-maktx = ls_order-maktx.
  er_entity-gamng = ls_order-gamng.
  er_entity-meins = ls_order-meins.
  er_entity-werks = ls_order-werks.
  er_entity-aufst = ls_order-aufst.
  er_entity-work_time = lv_work_time.

  CONVERT DATE ls_order-erdat
          TIME '000000'
          INTO TIME STAMP er_entity-erdat
          TIME ZONE sy-zonlo.

ENDMETHOD.
