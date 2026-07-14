*-----------------------------------------------------------------------
* ZPF4PP0001 material issue patch guide
*-----------------------------------------------------------------------
* Final rule confirmed:
* - ZFF4RF0005 function module is NOT changed.
* - PF* bulk material is skipped in availability check and goods issue.
* - PN* general material is not batch-managed, but should remain in
*   ZTF4PP0010 with blank CHARG.
* - ROH raw material is issued through ZFF4RF0005, and the issued batch
*   number must be written back to ZTF4PP0010-CHARG.
* - Use MODIFY for ZTF4PP0010. UPDATE does not create a row when the row
*   does not already exist.
*-----------------------------------------------------------------------

*-----------------------------------------------------------------------
* 1) Add these DATA declarations inside FORM execute_goods_issue
*-----------------------------------------------------------------------
* Add near the existing local DATA declarations.

  DATA: lv_ref_no_db  TYPE ztf4mm0006-ref_no,
        lt_issue_move TYPE TABLE OF ztf4mm0006,
        ls_issue_move TYPE ztf4mm0006,
        ls_pp0010     TYPE ztf4pp0010.

*-----------------------------------------------------------------------
* 2) After lv_ref_no is assigned, also fill lv_ref_no_db
*-----------------------------------------------------------------------
* Existing block normally looks like this:
*
*  IF gv_aufnr(2) = 'PP'.
*    lv_ref_no = gv_aufnr+2(10).
*  ELSE.
*    lv_ref_no = gv_aufnr.
*  ENDIF.
*
* Add directly below:

  lv_ref_no_db = lv_ref_no.

*-----------------------------------------------------------------------
* 3) Replace the component LOOP body in FORM execute_goods_issue
*-----------------------------------------------------------------------
* Put this inside the LOOP that processes GT_ORDER_ITEM / GS_ORDER_ITEM.
* This block should be before the old CALL FUNCTION 'ZFF4RF0005' block,
* or replace the old body of that LOOP.
*-----------------------------------------------------------------------

    CLEAR ls_pp0010.

    ls_pp0010-mandt = sy-mandt.
    ls_pp0010-aufnr = gs_order_item-aufnr.
    ls_pp0010-rspos = gs_order_item-rspos.
    ls_pp0010-vornr = gs_order_item-vornr.
    ls_pp0010-matnr = gs_order_item-matnr.
    ls_pp0010-bdmng = gs_order_item-bdmng.
    ls_pp0010-meins = gs_order_item-meins.
    ls_pp0010-enmng = gs_order_item-enmng.

*   PF* bulk is produced together in this scenario.
*   Do not check stock, do not call ZFF4RF0005, and do not create a
*   ZTF4PP0010 issue row for PF itself.
    IF gs_order_item-matnr(2) = 'PF'.
      CONTINUE.
    ENDIF.

*   PN* general material is not batch-managed.
*   Leave CHARG blank but keep the component usage in ZTF4PP0010.
    IF gs_order_item-matnr(2) = 'PN'.
      CLEAR ls_pp0010-charg.

      zcl_f4_rf_common=>set_log_fields(
        CHANGING
          cs_data = ls_pp0010
      ).

      MODIFY ztf4pp0010 FROM ls_pp0010.

      IF sy-subrc <> 0.
        gv_subrc = 4.
        gv_msg = '생산오더 일반자재 이력 저장 중 오류가 발생했습니다.'.
        RETURN.
      ENDIF.

      CONTINUE.
    ENDIF.

*   ROH raw material and other batch-managed issue targets use the
*   existing issue function module.
    CALL FUNCTION 'ZFF4RF0005'
      EXPORTING
        iv_matnr = gs_order_item-matnr
        iv_werks = '1000'
        iv_menge = gs_order_item-enmng
        iv_vgart = 'IP'
        iv_vbeln = lv_ref_no
      IMPORTING
        ev_subrc = gv_subrc
        ev_msg   = gv_msg.

    IF gv_subrc <> 0.
      RETURN.
    ENDIF.

*   Read the batch chosen by ZFF4RF0005 from ZTF4MM0006.
    CLEAR: lt_issue_move, ls_issue_move.

    SELECT *
      FROM ztf4mm0006
      INTO TABLE lt_issue_move
     WHERE matnr  = gs_order_item-matnr
       AND werks  = '1000'
       AND vgart  = 'IP'
       AND ref_no = lv_ref_no_db.

    IF lt_issue_move IS INITIAL.
      gv_subrc = 4.
      gv_msg = '자재출고 이력을 조회할 수 없습니다. ZTF4MM0006-REF_NO를 확인하세요.'.
      RETURN.
    ENDIF.

    SORT lt_issue_move BY erdat DESCENDING
                          erzet DESCENDING
                          zeile DESCENDING.

    READ TABLE lt_issue_move INTO ls_issue_move INDEX 1.

    IF ls_issue_move-charg IS INITIAL.
      gv_subrc = 4.
      gv_msg = '출고된 원자재 배치번호가 없습니다.'.
      RETURN.
    ENDIF.

    ls_pp0010-charg = ls_issue_move-charg.

    zcl_f4_rf_common=>set_log_fields(
      CHANGING
        cs_data = ls_pp0010
    ).

    MODIFY ztf4pp0010 FROM ls_pp0010.

    IF sy-subrc <> 0.
      gv_subrc = 4.
      gv_msg = '생산오더 원자재 배치 이력 저장 중 오류가 발생했습니다.'.
      RETURN.
    ENDIF.

*-----------------------------------------------------------------------
* 4) Availability check patch
*-----------------------------------------------------------------------
* Apply this inside availability check loops before stock shortage check.
* Use GS_ORDER_ITEM if that is the loop work area in the form.
*-----------------------------------------------------------------------

    IF gs_order_item-matnr(2) = 'PF'.
      CONTINUE.
    ENDIF.

*-----------------------------------------------------------------------
* 5) Important expected result
*-----------------------------------------------------------------------
* After material issue for a finished goods order:
*
* ZTF4PP0010 should contain:
* - PN* rows with CHARG blank
* - ROH rows with CHARG filled
* - PF* row can be absent/skipped for issue tracking
*
* Then the production confirmation/settlement program can create
* ZTF4MM0007 rows:
* - PN* -> FERT with blank P_CHARG
* - ROH -> FERT with filled P_CHARG
*-----------------------------------------------------------------------
