sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/ui/Device"
], function (UIComponent, JSONModel, Device) {
  "use strict";

  return UIComponent.extend("zrf4pp0002.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      this.setModel(new JSONModel({
        logoSrc: sap.ui.require.toUrl("zrf4pp0002/img/Releaf_Logo.png")
      }), "app");

      this.setModel(new JSONModel(Device), "device");
    }
  });
});
