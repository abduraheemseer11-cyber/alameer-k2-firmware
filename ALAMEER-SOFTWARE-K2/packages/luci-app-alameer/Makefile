include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-alameer
PKG_VERSION:=2.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=Eng. Abdulrahim Al-Makhadhi

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-alameer
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=ALAMEER Dashboard and Quick Setup (AP/Repeater/WISP/Router)
  DEPENDS:=+luci-base +swconfig +relayd +iwinfo +jsonfilter +uci
  PKGARCH:=all
endef

define Package/luci-app-alameer/description
  ALAMEER SOFTWARE dashboard and quick-setup wizard for LuCI (Lua LuCI, OpenWrt 21.02/22.03).
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef
define Build/Configure
endef
define Build/Compile
endef

define Package/luci-app-alameer/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DATA) ./luasrc/controller/alameer.lua $(1)/usr/lib/lua/luci/controller/alameer.lua
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/alameer
	$(INSTALL_DATA) ./luasrc/view/alameer/*.htm $(1)/usr/lib/lua/luci/view/alameer/
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./root/usr/sbin/alameer-apply $(1)/usr/sbin/alameer-apply
	$(INSTALL_BIN) ./root/usr/sbin/alameer-diag $(1)/usr/sbin/alameer-diag
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/alameer-boot $(1)/etc/init.d/alameer-boot
endef

$(eval $(call BuildPackage,luci-app-alameer))
