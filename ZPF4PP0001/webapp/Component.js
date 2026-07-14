sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], (UIComponent, JSONModel, Device) => {
    "use strict";

    return UIComponent.extend("zpf4pp0001.Component", {
        metadata: {
            manifest: "json"
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(new JSONModel({
                logoSrc: sap.ui.require.toUrl("zpf4pp0001/img/Releaf_Logo.png")
            }), "app");

            this.setModel(new JSONModel({
                system: {
                    phone: Device.system.phone
                }
            }), "device");

            this._syncColorScheme();
            sap.ui.getCore().attachThemeChanged(this._syncColorScheme.bind(this));
        },

        _syncColorScheme() {
            const sTheme = sap.ui.getCore().getConfiguration().getTheme() || "";
            const bThemeDark = /dark|hcb/i.test(sTheme);
            const sScheme = bThemeDark ? "dark" : "light";

            document.documentElement.setAttribute("data-color-scheme", sScheme);
        }
    });
});
