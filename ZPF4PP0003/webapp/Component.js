sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/ui/Device"
], function (UIComponent, JSONModel, Device) {
  "use strict";

  return UIComponent.extend("zpf4pp0003.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      this.setModel(new JSONModel({
        logoSrc: sap.ui.require.toUrl("zpf4pp0003/img/Releaf_Logo.png")
      }), "app");

      this.setModel(new JSONModel(Device), "device");
    }
  });
});
