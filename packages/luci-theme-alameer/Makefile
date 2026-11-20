include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-alameer
PKG_VERSION:=2.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=Eng. Abdulrahim Al-Makhadhi

include $(INCLUDE_DIR)/package.mk

define Package/luci-theme-alameer
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=4. Themes
  TITLE:=ALAMEER SOFTWARE theme v2 (sidebar layout, Deep Crimson)
  DEPENDS:=+luci-base +luci-theme-bootstrap
  PKGARCH:=all
endef

define Package/luci-theme-alameer/description
  ALAMEER SOFTWARE theme: fixed sidebar (Quick Setup, Dashboard, Network, Wireless, System, Status, Security,
  System Logs), card layout, responsive. Wraps the stock Bootstrap templates (include) so all LuCI views keep working.
  Requires Lua LuCI (21.02/22.03).
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef
define Build/Configure
endef
define Build/Compile
endef

define Package/luci-theme-alameer/install
	$(INSTALL_DIR) $(1)/www/luci-static/alameer
	$(INSTALL_DATA) ./files/www/luci-static/alameer/* $(1)/www/luci-static/alameer/
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/themes/alameer
	$(INSTALL_DATA) ./luasrc/view/themes/alameer/*.htm $(1)/usr/lib/lua/luci/view/themes/alameer/
endef

$(eval $(call BuildPackage,luci-theme-alameer))
